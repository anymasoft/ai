import asyncio
from dataclasses import dataclass, field
from abc import ABC, abstractmethod
from typing import Callable, Awaitable
from fastapi import APIRouter, WebSocket
import openai
import uuid
from codegen.utils import extract_html_content, validate_react_output, validate_vue_output
from db import update_generation, get_conn
from api.config.plans import get_plan_limit, is_format_allowed
from datetime import datetime

# Import shutdown flag from main
import main as main_module
from config import (
    ANTHROPIC_API_KEY,
    GEMINI_API_KEY,
    IS_PROD,
    NODE_ENV,
    NUM_VARIANTS,
    OPENAI_API_KEY,
    OPENAI_BASE_URL,
    REPLICATE_API_KEY,
    SHOULD_MOCK_AI_RESPONSE,
    ACTIVE_VARIANT_INDEX,
)
from custom_types import InputMode
from llm import (
    Completion,
    Llm,
    OPENAI_MODELS,
    ANTHROPIC_MODELS,
    GEMINI_MODELS,
)
from models import (
    stream_claude_response,
    stream_claude_response_native,
    stream_openai_response,
    stream_gemini_response,
)
from fs_logging.core import write_logs
from mock_llm import mock_completion
from typing import (
    Any,
    Callable,
    Coroutine,
    Dict,
    List,
    Literal,
    cast,
    get_args,
)
from openai.types.chat import ChatCompletionMessageParam

from utils import print_prompt_summary

# WebSocket message types
MessageType = Literal[
    "chunk",
    "status",
    "setCode",
    "error",
    "variantComplete",
    "variantError",
    "variantCount",
    "generation_complete",
]
from image_generation.core import generate_images
from prompts import create_prompt
from prompts.claude_prompts import VIDEO_PROMPT
from prompts.types import Stack, PromptContent

# from utils import pprint_prompt
from ws.constants import APP_ERROR_WEB_SOCKET_CODE  # type: ignore
from db import save_generation, update_generation, save_generation_variant


router = APIRouter()


class VariantErrorAlreadySent(Exception):
    """Exception that indicates a variantError message has already been sent to frontend"""

    def __init__(self, original_error: Exception):
        self.original_error = original_error
        super().__init__(str(original_error))


@dataclass
class PipelineContext:
    """Context object that carries state through the pipeline"""

    websocket: WebSocket
    generation_id: str
    user_id: str = None  # User ID for tracking who created the generation
    ws_comm: "WebSocketCommunicator | None" = None
    params: Dict[str, str] = field(default_factory=dict)
    extracted_params: "ExtractedParams | None" = None
    prompt_messages: List[ChatCompletionMessageParam] = field(default_factory=list)
    image_cache: Dict[str, str] = field(default_factory=dict)
    variant_models: List[Llm] = field(default_factory=list)
    completions: List[str] = field(default_factory=list)
    variant_completions: Dict[int, str] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)
    websocket_already_accepted: bool = False  # Flag if WebSocket was already accepted by handler
    cancelled: bool = False  # Flag if generation was cancelled (Ctrl+C / client disconnect)

    @property
    def send_message(self):
        if self.ws_comm is None:
            raise RuntimeError("WebSocket communicator not initialized - cannot send message")
        return self.ws_comm.send_message

    @property
    def throw_error(self):
        if self.ws_comm is None:
            raise RuntimeError("WebSocket communicator not initialized - cannot throw error")
        return self.ws_comm.throw_error

    def mark_failed(self, error_message: str) -> None:
        """Mark generation as failed without crashing - graceful error handling"""
        print(f"[PIPELINE] Generation {self.generation_id} marked as failed: {error_message}")
        try:
            update_generation(
                generation_id=self.generation_id,
                status="failed",
                error_message=error_message,
            )
        except Exception as e:
            # Log DB error but don't crash
            print(f"[PIPELINE] Failed to update DB status: {e}")


class Middleware(ABC):
    """Base class for all pipeline middleware"""

    @abstractmethod
    async def process(
        self, context: PipelineContext, next_func: Callable[[], Awaitable[None]]
    ) -> None:
        """Process the context and call the next middleware"""
        pass


class Pipeline:
    """Pipeline for processing WebSocket code generation requests"""

    def __init__(self):
        self.middlewares: List[Middleware] = []

    def use(self, middleware: Middleware) -> "Pipeline":
        """Add a middleware to the pipeline"""
        self.middlewares.append(middleware)
        return self

    async def execute(self, websocket: WebSocket, params: Dict[str, str] = None, websocket_already_accepted: bool = False, generation_id: str = None) -> None:
        """Execute the pipeline with the given WebSocket

        Args:
            websocket: FastAPI WebSocket connection
            params: Optional pre-provided parameters (from queue worker)
            websocket_already_accepted: Flag if WebSocket was already accepted by handler
            generation_id: Generation ID from handler (if not provided, generate new one)
        """
        try:
            # If generation_id not provided, create new one (for backwards compatibility)
            if generation_id is None:
                generation_id = str(uuid.uuid4())
                print(f"[PIPELINE] Generated new generation_id={generation_id}")
            else:
                print(f"[PIPELINE] Using provided generation_id={generation_id}")

            # Extract user_id from session
            user = get_user_from_session(websocket)
            user_id = user.get("id") if user else None

            context = PipelineContext(websocket=websocket, generation_id=generation_id, user_id=user_id, websocket_already_accepted=websocket_already_accepted)
            print(f"[DEBUG] PipelineContext created with generation_id={context.generation_id}, user_id={context.user_id}")
            # If params are provided (from queue), skip parameter extraction
            if params:
                context.params = params

            # Build the middleware chain
            async def start(ctx: PipelineContext):
                pass  # End of pipeline

            chain = start
            for middleware in reversed(self.middlewares):
                chain = self._wrap_middleware(middleware, chain)

            await chain(context)
        except asyncio.CancelledError:
            # Request cancelled - silent exit
            return
        except Exception as e:
            # Catch any unhandled exceptions from middleware/stages
            # Mark generation as failed and log error
            print(f"[PIPELINE] Unhandled exception: {e}")
            context.mark_failed(f"pipeline_error: {str(e)}")
            return

    def _wrap_middleware(
        self,
        middleware: Middleware,
        next_func: Callable[[PipelineContext], Awaitable[None]],
    ) -> Callable[[PipelineContext], Awaitable[None]]:
        """Wrap a middleware with its next function"""

        async def wrapped(context: PipelineContext) -> None:
            await middleware.process(context, lambda: next_func(context))

        return wrapped


class WebSocketCommunicator:
    """Handles WebSocket communication with consistent error handling"""

    def __init__(self, websocket: WebSocket):
        self.websocket = websocket
        self.is_closed = False
        self.is_accepted = False  # Track if WebSocket is already accepted

    async def accept(self) -> None:
        """Accept the WebSocket connection"""
        # Skip if already accepted (e.g., by handler before worker processes it)
        if self.is_accepted:
            print("WebSocket already accepted, skipping...")
            return

        try:
            await self.websocket.accept()
            self.is_accepted = True
            print("Incoming websocket connection...")
        except asyncio.CancelledError:
            # Shutdown during accept - normal
            self.is_closed = True
            raise
        except Exception as e:
            print(f"[ERROR] Failed to accept websocket connection: {e}")
            self.is_closed = True
            raise

    async def send_message(
        self,
        type: MessageType,
        value: str,
        variantIndex: int,
    ) -> None:
        """Send a message to the client with debug logging"""
        # KILL SWITCH: Check if app is shutting down FIRST
        if main_module.app_shutting_down or self.is_closed:
            return

        # Print for debugging on the backend
        if type == "error":
            print(f"Error (variant {variantIndex + 1}): {value}")
        elif type == "status":
            print(f"Status (variant {variantIndex + 1}): {value}")
        elif type == "variantComplete":
            print(f"Variant {variantIndex + 1} complete")
        elif type == "variantError":
            print(f"Variant {variantIndex + 1} error: {value}")

        try:
            await self.websocket.send_json(
                {"type": type, "value": value, "variantIndex": variantIndex}
            )
        except asyncio.CancelledError:
            # Client disconnected or reload - silent
            self.is_closed = True
            return
        except Exception as e:
            # WebSocket is closed - silent (already checked at start)
            self.is_closed = True

    async def throw_error(self, message: str) -> None:
        """Send an error message and close the connection"""
        # KILL SWITCH: Check if app is shutting down FIRST
        if main_module.app_shutting_down or self.is_closed:
            return

        print(message)
        try:
            await self.websocket.send_json({"type": "error", "value": message})
        except asyncio.CancelledError:
            self.is_closed = True
            return
        except Exception:
            # WebSocket is closed - silent
            self.is_closed = True
            return

        try:
            await self.websocket.close(APP_ERROR_WEB_SOCKET_CODE)
        except asyncio.CancelledError:
            self.is_closed = True
            return
        except Exception:
            # WebSocket is closed - silent
            pass

        self.is_closed = True

    async def receive_params(self) -> Dict[str, str]:
        """Receive parameters from the client"""
        try:
            params: Dict[str, str] = await self.websocket.receive_json()
            print("Received params")
            return params
        except asyncio.CancelledError:
            # Client disconnected or reload - silent exit
            raise
        except Exception as e:
            # WebSocket error - silent
            raise

    async def close(self) -> None:
        """Close the WebSocket connection"""
        if not self.is_closed:
            try:
                await self.websocket.close()
            except asyncio.CancelledError:
                # Client disconnected - silent
                pass
            except Exception:
                # WebSocket might already be closed - silent
                pass
            finally:
                self.is_closed = True


@dataclass
class ExtractedParams:
    stack: Stack
    input_mode: InputMode
    should_generate_images: bool
    openai_api_key: str | None
    anthropic_api_key: str | None
    openai_base_url: str | None
    generation_type: Literal["create", "update"]
    prompt: PromptContent
    history: List[Dict[str, Any]]
    is_imported_from_code: bool


class ParameterExtractionStage:
    """Handles parameter extraction and validation from WebSocket requests"""

    def __init__(self, throw_error: Callable[[str], Coroutine[Any, Any, None]]):
        self.throw_error = throw_error

    async def extract_and_validate(self, params: Dict[str, str]) -> ExtractedParams:
        """Extract and validate all parameters from the request"""
        # Read the code config settings (stack) from the request.
        generated_code_config = params.get("generatedCodeConfig", "")
        print(f"[DIAG:EXTRACT] extracted generatedCodeConfig='{generated_code_config}'")
        print(f"[DIAG:EXTRACT] valid Stack values: {get_args(Stack)}")
        if generated_code_config not in get_args(Stack):
            await self.throw_error(
                f"Invalid generated code config: {generated_code_config}"
            )
            raise ValueError(f"Invalid generated code config: {generated_code_config}")
        validated_stack = cast(Stack, generated_code_config)
        print(f"[DIAG:EXTRACT] validated_stack='{validated_stack}'")

        # Validate the input mode
        input_mode = params.get("inputMode")
        if input_mode not in get_args(InputMode):
            await self.throw_error(f"Invalid input mode: {input_mode}")
            raise ValueError(f"Invalid input mode: {input_mode}")
        validated_input_mode = cast(InputMode, input_mode)

        # API keys ONLY from environment - never from frontend params
        openai_api_key = OPENAI_API_KEY
        anthropic_api_key = ANTHROPIC_API_KEY

        # Base URL for OpenAI API (from env only)
        openai_base_url = OPENAI_BASE_URL

        # Extract image generation setting from frontend (defaults to True for backward compatibility)
        should_generate_images_param = params.get("shouldGenerateImages", True)
        if isinstance(should_generate_images_param, str):
            should_generate_images = should_generate_images_param.lower() == "true"
        else:
            should_generate_images = bool(should_generate_images_param)
        print(f"[DIAG:EXTRACT] should_generate_images={should_generate_images}")

        # Extract and validate generation type
        generation_type = params.get("generationType", "create")
        if generation_type not in ["create", "update"]:
            await self.throw_error(f"Invalid generation type: {generation_type}")
            raise ValueError(f"Invalid generation type: {generation_type}")
        generation_type = cast(Literal["create", "update"], generation_type)

        # Extract prompt content
        prompt = params.get("prompt", {"text": "", "images": []})

        # Extract history (default to empty list)
        history = params.get("history", [])

        # Extract imported code flag
        is_imported_from_code = params.get("isImportedFromCode", False)

        return ExtractedParams(
            stack=validated_stack,
            input_mode=validated_input_mode,
            should_generate_images=should_generate_images,
            openai_api_key=openai_api_key,
            anthropic_api_key=anthropic_api_key,
            openai_base_url=openai_base_url,
            generation_type=generation_type,
            prompt=prompt,
            history=history,
            is_imported_from_code=is_imported_from_code,
        )

class ModelSelectionStage:
    """Handles selection of variant models based on available API keys and generation type"""

    def __init__(self, throw_error: Callable[[str], Coroutine[Any, Any, None]]):
        self.throw_error = throw_error

    async def select_models(
        self,
        generation_type: Literal["create", "update"],
        input_mode: InputMode,
        openai_api_key: str | None,
        anthropic_api_key: str | None,
        gemini_api_key: str | None = None,
    ) -> List[Llm]:
        """Select appropriate models based on available API keys"""
        try:
            variant_models = self._get_variant_models(
                generation_type,
                input_mode,
                NUM_VARIANTS,
                openai_api_key,
                anthropic_api_key,
                gemini_api_key,
            )

            # Print the variant models (one per line)
            print("Variant models:")
            for index, model in enumerate(variant_models):
                print(f"Variant {index + 1}: {model.value}")

            return variant_models
        except Exception:
            await self.throw_error(
                "No OpenAI or Anthropic API key found. Please add the environment variable "
                "OPENAI_API_KEY or ANTHROPIC_API_KEY to backend/.env or in the settings dialog. "
                "If you add it to .env, make sure to restart the backend server."
            )
            raise Exception("No OpenAI or Anthropic key")

    def _get_variant_models(
        self,
        generation_type: Literal["create", "update"],
        input_mode: InputMode,
        num_variants: int,
        openai_api_key: str | None,
        anthropic_api_key: str | None,
        gemini_api_key: str | None,
    ) -> List[Llm]:
        """🔧 OPTIMIZED: Return ONLY the active variant model to save tokens"""

        # All available models (for reference, but only one is active)
        # Variant 1 (index 0): gpt-4o-mini - DISABLED
        # Variant 2 (index 1): gpt-4.1-mini - DISABLED
        # Variant 3 (index 2): gpt-4.1 (prod) or gpt-4.1-mini (dev) - ACTIVE
        # Variant 4 (index 3): gpt-5-mini - DISABLED
        all_models = [
            Llm.GPT_4O_MINI,                 # Variant 1: DISABLED
            Llm.GPT_4_1_MINI,                # Variant 2: DISABLED
            Llm.GPT_4_1,                     # Variant 3: ACTIVE
            Llm.GPT_5_MINI,                  # Variant 4: DISABLED
        ]

        if not openai_api_key:
            raise RuntimeError("OpenAI API key is REQUIRED. Set OPENAI_API_KEY in backend/.env and restart backend.")

        # 🔧 OPTIMIZATION: Only generate the ACTIVE variant
        # This reduces token consumption from 4x to 1x
        # Return only the active variant model
        selected_models: List[Llm] = []

        # Variant 3 is at index 2
        # Choose model based on NODE_ENV environment variable
        if NODE_ENV == "production":
            active_model = Llm.GPT_4_1  # Production: full model
        else:
            active_model = Llm.GPT_4_1_MINI  # Development: cheaper model

        selected_models.append(active_model)

        return selected_models


class PromptCreationStage:
    """Handles prompt assembly for code generation"""

    def __init__(self, throw_error: Callable[[str], Coroutine[Any, Any, None]]):
        self.throw_error = throw_error

    async def create_prompt(
        self,
        extracted_params: ExtractedParams,
    ) -> tuple[List[ChatCompletionMessageParam], Dict[str, str]]:
        """Create prompt messages and return image cache"""
        try:
            print(f"[DIAG:PROMPT] About to create_prompt with stack='{extracted_params.stack}'")
            prompt_messages, image_cache = await create_prompt(
                stack=extracted_params.stack,
                input_mode=extracted_params.input_mode,
                generation_type=extracted_params.generation_type,
                prompt=extracted_params.prompt,
                history=extracted_params.history,
                is_imported_from_code=extracted_params.is_imported_from_code,
            )

            print_prompt_summary(prompt_messages, truncate=False)

            return prompt_messages, image_cache
        except Exception:
            await self.throw_error(
                "Error assembling prompt. Contact support at support@picoapps.xyz"
            )
            raise


class MockResponseStage:
    """Handles mock AI responses for testing"""

    def __init__(
        self,
        send_message: Callable[[MessageType, str, int], Coroutine[Any, Any, None]],
    ):
        self.send_message = send_message

    async def generate_mock_response(
        self,
        input_mode: InputMode,
    ) -> List[str]:
        """Generate mock response for testing"""

        async def process_chunk(content: str, variantIndex: int):
            await self.send_message("chunk", content, variantIndex)

        completion_results = [
            await mock_completion(process_chunk, input_mode=input_mode)
        ]
        completions = [result["code"] for result in completion_results]

        # Send the complete variant back to the client
        await self.send_message("setCode", completions[0], 0)
        await self.send_message("variantComplete", "Variant generation complete", 0)

        return completions


class VideoGenerationStage:
    """Handles video mode code generation using Claude 3 Opus"""

    def __init__(
        self,
        send_message: Callable[[MessageType, str, int], Coroutine[Any, Any, None]],
        throw_error: Callable[[str], Coroutine[Any, Any, None]],
    ):
        self.send_message = send_message
        self.throw_error = throw_error

    async def generate_video_code(
        self,
        prompt_messages: List[ChatCompletionMessageParam],
        anthropic_api_key: str | None,
    ) -> List[str]:
        """Generate code for video input mode"""
        if not anthropic_api_key:
            await self.throw_error(
                "Video only works with Anthropic models. No Anthropic API key found. "
                "Please add the environment variable ANTHROPIC_API_KEY to backend/.env "
                "or in the settings dialog"
            )
            raise Exception("No Anthropic key")

        async def process_chunk(content: str, variantIndex: int):
            await self.send_message("chunk", content, variantIndex)

        completion_results = [
            await stream_claude_response_native(
                system_prompt=VIDEO_PROMPT,
                messages=prompt_messages,  # type: ignore
                api_key=anthropic_api_key,
                callback=lambda x: process_chunk(x, 0),
                model_name=Llm.CLAUDE_3_OPUS.value,
                include_thinking=True,
            )
        ]
        completions = [result["code"] for result in completion_results]

        # Send the complete variant back to the client
        await self.send_message("setCode", completions[0], 0)
        await self.send_message("variantComplete", "Variant generation complete", 0)

        return completions


class PostProcessingStage:
    """Handles post-processing after code generation completes"""

    def __init__(self):
        pass

    async def process_completions(
        self,
        completions: List[str],
        prompt_messages: List[ChatCompletionMessageParam],
        websocket: WebSocket,
    ) -> None:
        """Process completions and perform cleanup"""
        # Only process non-empty completions
        valid_completions = [comp for comp in completions if comp]

        # Write the first valid completion to logs for debugging
        if valid_completions:
            # Strip the completion of everything except the HTML content
            html_content = extract_html_content(valid_completions[0])
            write_logs(prompt_messages, html_content)

        # Note: WebSocket closing is handled by the caller


class ParallelGenerationStage:
    """Handles parallel variant generation with independent processing for each variant"""

    def __init__(
        self,
        send_message: Callable[[MessageType, str, int], Coroutine[Any, Any, None]],
        openai_api_key: str | None,
        openai_base_url: str | None,
        anthropic_api_key: str | None,
        should_generate_images: bool,
        generation_id: str,
        stack: Stack,
    ):
        self.send_message = send_message
        self.openai_api_key = openai_api_key
        self.openai_base_url = openai_base_url
        self.anthropic_api_key = anthropic_api_key
        self.should_generate_images = should_generate_images
        self.generation_id = generation_id
        self.stack = stack

    async def process_variants(
        self,
        variant_models: List[Llm],
        prompt_messages: List[ChatCompletionMessageParam],
        image_cache: Dict[str, str],
        params: Dict[str, str],
    ) -> Dict[int, str]:
        """Process only ACTIVE variants and return completions"""
        # Store prompt_messages for potential retry
        self.prompt_messages = prompt_messages
        self.params = params

        # Create tasks with indices
        # Since we have only ACTIVE_VARIANT_INDEX (2) active, it becomes local_index 0 in UI
        tasks = self._create_generation_tasks(
            variant_models,
            prompt_messages,
            params,
            local_index=0,  # First (and only) active variant
            real_index=ACTIVE_VARIANT_INDEX,  # Real index in DB
        )

        # Dictionary to track variant tasks and their status
        variant_tasks: Dict[int, asyncio.Task[Completion]] = {}
        variant_completions: Dict[int, str] = {}

        # Create tasks for each variant
        # Map enumerate index to indices
        for local_index, task in enumerate(tasks):
            real_variant_index = ACTIVE_VARIANT_INDEX
            variant_task = asyncio.create_task(task)
            variant_tasks[local_index] = (real_variant_index, variant_task)

        # Process each variant independently
        variant_processors = []
        for local_index, (real_index, task) in variant_tasks.items():
            # Find corresponding model (should be only 1)
            model_idx = real_index if real_index < len(variant_models) else 0
            variant_processors.append(
                self._process_variant_completion(
                    local_index, real_index, task, variant_models[0], image_cache, variant_completions  # Pass both indices: local_index for UI, real_index for DB
                )
            )

        # Wait for all variants to complete
        await asyncio.gather(*variant_processors, return_exceptions=True)

        return variant_completions

    def _create_generation_tasks(
        self,
        variant_models: List[Llm],
        prompt_messages: List[ChatCompletionMessageParam],
        params: Dict[str, str],
        local_index: int = 0,
        real_index: int = ACTIVE_VARIANT_INDEX,
    ) -> List[Coroutine[Any, Any, Completion]]:
        """🔧 Create generation tasks only for ACTIVE variants

        Args:
            local_index: Index in active variants array (0-based for UI/WebSocket)
            real_index: Real historical variant index (for DB and logging)
        """
        tasks: List[Coroutine[Any, Any, Completion]] = []

        # Map enumerate index to real variant index
        # Since we only have active variants, index 0 in variant_models = ACTIVE_VARIANT_INDEX in reality
        for model_idx, model in enumerate(variant_models):
            # Use both indices: local_index for WebSocket, real_index for DB/logging
            # All WebSocket messages use local_index (0), real_index is for DB/logging only

            if model in OPENAI_MODELS:
                if self.openai_api_key is None:
                    raise Exception("OpenAI API key is missing.")

                tasks.append(
                    self._stream_openai_with_error_handling(
                        prompt_messages,
                        model_name=model.value,
                        local_index=local_index,  # Use local index for WebSocket
                        real_index=real_index,  # Use real index for logging
                    )
                )
            elif GEMINI_API_KEY and model in GEMINI_MODELS:
                tasks.append(
                    stream_gemini_response(
                        prompt_messages,
                        api_key=GEMINI_API_KEY,
                        callback=lambda x, i=local_index: self._process_chunk(x, i),
                        model_name=model.value,
                    )
                )
            elif model in ANTHROPIC_MODELS:
                if self.anthropic_api_key is None:
                    raise Exception("Anthropic API key is missing.")

                # For creation, use Claude Sonnet 3.7
                # For updates, we use Claude Sonnet 4.5 until we have tested Claude Sonnet 3.7
                if params["generationType"] == "create":
                    claude_model = Llm.CLAUDE_3_7_SONNET_2025_02_19
                else:
                    claude_model = Llm.CLAUDE_4_5_SONNET_2025_09_29

                tasks.append(
                    stream_claude_response(
                        prompt_messages,
                        api_key=self.anthropic_api_key,
                        callback=lambda x, i=local_index: self._process_chunk(x, i),
                        model_name=claude_model.value,
                    )
                )

        return tasks

    async def _process_chunk(self, content: str, variant_index: int):
        """Process streaming chunks"""
        await self.send_message("chunk", content, variant_index)

    async def _retry_with_repair_instruction(
        self,
        model: Llm,
        local_index: int,
        repair_instruction: str,
    ) -> Completion | None:
        """
        Retry generation with repair instruction.
        Returns Completion if successful, None if failed.
        """
        try:
            print(f"[VALIDATION] Retrying with repair instruction for {self.stack}")

            # Create repair prompt by appending user message
            repair_prompt = list(self.prompt_messages)  # Copy
            repair_prompt.append({
                "role": "user",
                "content": repair_instruction,
            })

            # Call model again with repair prompt
            if model in OPENAI_MODELS:
                if self.openai_api_key is None:
                    return None

                completion = await stream_openai_response(
                    repair_prompt,
                    api_key=self.openai_api_key,
                    base_url=self.openai_base_url,
                    callback=lambda x: self._process_chunk(x, local_index),
                    model_name=model.value,
                )
                return completion
            elif model in ANTHROPIC_MODELS:
                if self.anthropic_api_key is None:
                    return None

                # Determine Claude model based on generation type
                if self.params.get("generationType") == "create":
                    claude_model = Llm.CLAUDE_3_7_SONNET_2025_02_19
                else:
                    claude_model = Llm.CLAUDE_4_5_SONNET_2025_09_29

                completion = await stream_claude_response(
                    repair_prompt,
                    api_key=self.anthropic_api_key,
                    callback=lambda x: self._process_chunk(x, local_index),
                    model_name=claude_model.value,
                )
                return completion
            else:
                # Other models not supported for retry
                return None
        except Exception as e:
            print(f"[VALIDATION] Retry failed: {e}")
            return None

    async def _stream_openai_with_error_handling(
        self,
        prompt_messages: List[ChatCompletionMessageParam],
        model_name: str,
        local_index: int = 0,
        real_index: int = ACTIVE_VARIANT_INDEX,
    ) -> Completion:
        """Wrap OpenAI streaming with specific error handling

        Args:
            local_index: Index in active variants array (for WebSocket messages)
            real_index: Real historical variant index (for logging and DB)
        """
        try:
            if self.openai_api_key is None:
                raise VariantErrorAlreadySent(
                    Exception("OpenAI API key is not configured. Please provide a valid OpenAI API key.")
                )
            return await stream_openai_response(
                prompt_messages,
                api_key=self.openai_api_key,
                base_url=self.openai_base_url,
                callback=lambda x: self._process_chunk(x, local_index),
                model_name=model_name,
            )
        except openai.AuthenticationError as e:
            print(f"[VARIANT {real_index + 1}] OpenAI Authentication failed", e)
            error_message = (
                "Incorrect OpenAI key. Please make sure your OpenAI API key is correct, "
                "or create a new OpenAI API key on your OpenAI dashboard."
                + (
                    " Alternatively, you can purchase code generation credits directly on this website."
                    if IS_PROD
                    else ""
                )
            )
            await self.send_message("variantError", error_message, local_index)
            raise VariantErrorAlreadySent(e)
        except openai.NotFoundError as e:
            print(f"[VARIANT {real_index + 1}] OpenAI Model not found", e)
            error_message = (
                e.message
                + ". Please make sure you have followed the instructions correctly to obtain "
                "an OpenAI key with GPT vision access: "
                "https://github.com/abi/screenshot-to-code/blob/main/Troubleshooting.md"
                + (
                    " Alternatively, you can purchase code generation credits directly on this website."
                    if IS_PROD
                    else ""
                )
            )
            await self.send_message("variantError", error_message, local_index)
            raise VariantErrorAlreadySent(e)
        except openai.RateLimitError as e:
            print(f"[VARIANT {real_index + 1}] OpenAI Rate limit exceeded", e)
            error_message = (
                "OpenAI error - 'You exceeded your current quota, please check your plan and billing details.'"
                + (
                    " Alternatively, you can purchase code generation credits directly on this website."
                    if IS_PROD
                    else ""
                )
            )
            await self.send_message("variantError", error_message, local_index)
            raise VariantErrorAlreadySent(e)
        except openai.BadRequestError as e:
            # Model not available (403) - variant fails but doesn't break pipeline
            print(f"[VARIANT {real_index + 1}] Model not available (400 Bad Request)", e)
            error_message = (
                "Model not available for this account. Please check your OpenAI plan."
            )
            await self.send_message("variantError", error_message, local_index)
            raise VariantErrorAlreadySent(e)

    async def _perform_image_generation(
        self,
        completion: str,
        image_cache: dict[str, str],
    ):
        """Generate images for the completion if needed"""
        if not self.should_generate_images:
            return completion

        replicate_api_key = REPLICATE_API_KEY
        if replicate_api_key:
            image_generation_model = "flux"
            api_key = replicate_api_key
        else:
            if not self.openai_api_key:
                print(
                    "No OpenAI API key and Replicate key found. Skipping image generation."
                )
                return completion
            image_generation_model = "dalle3"
            api_key = self.openai_api_key

        print("Generating images with model: ", image_generation_model)

        return await generate_images(
            completion,
            api_key=api_key,
            base_url=self.openai_base_url,
            image_cache=image_cache,
            model=image_generation_model,
        )

    async def _process_variant_completion(
        self,
        local_index: int,
        real_index: int,
        task: asyncio.Task[Completion],
        model: Llm,
        image_cache: Dict[str, str],
        variant_completions: Dict[int, str],
    ):
        """Process a single variant completion including image generation

        Args:
            local_index: Index in active variants array (0-based for UI/WebSocket)
            real_index: Real historical variant index (ACTIVE_VARIANT_INDEX for DB)
        """
        try:
            completion = await task

            print(f"{model.value} completion took {completion['duration']:.2f} seconds")
            html_result = completion["code"]

            # ✅ VALIDATION AND RETRY FOR REACT/VUE
            # Only validate for react_tailwind and vue_tailwind stacks
            needs_validation = self.stack in ["react_tailwind", "vue_tailwind"]

            if needs_validation:
                # Validate the output
                is_valid = False
                if self.stack == "react_tailwind":
                    is_valid = validate_react_output(html_result)
                elif self.stack == "vue_tailwind":
                    is_valid = validate_vue_output(html_result)

                # If validation failed, try ONE retry with repair instruction
                if not is_valid:
                    print(f"[VALIDATION] Failed for {self.stack}. Attempting repair retry...")

                    # Prepare repair instruction
                    repair_instruction = (
                        "Your previous output was INVALID because it did not include REQUIRED FRAMEWORK MARKERS. "
                        "Fix it and output the full corrected <html>...</html> code with all required elements."
                    )

                    # Attempt retry
                    retry_completion = await self._retry_with_repair_instruction(
                        model=model,
                        local_index=local_index,
                        repair_instruction=repair_instruction,
                    )

                    if retry_completion:
                        retry_html = retry_completion["code"]

                        # Validate retry result
                        retry_valid = False
                        if self.stack == "react_tailwind":
                            retry_valid = validate_react_output(retry_html)
                        elif self.stack == "vue_tailwind":
                            retry_valid = validate_vue_output(retry_html)

                        if retry_valid:
                            print(f"[VALIDATION] Retry succeeded for {self.stack}")
                            html_result = retry_html  # Use retry result
                        else:
                            print(f"[VALIDATION] Retry also failed. Using original result as fallback.")
                            # Keep original html_result (don't crash, preserve UX)
                    else:
                        print(f"[VALIDATION] Retry failed to execute. Using original result as fallback.")
                        # Keep original html_result
                else:
                    print(f"[VALIDATION] Passed for {self.stack}")

            variant_completions[local_index] = html_result

            # 🔧 FIXED: Save variant immediately to generation_variants table
            # This captures individual variant results independent of WebSocket
            try:
                extracted_html = extract_html_content(html_result)
                save_generation_variant(
                    generation_id=self.generation_id,
                    variant_index=real_index,
                    model=model.value,
                    status="done",
                    html=extracted_html,
                    duration_ms=int(completion['duration'] * 1000),
                )
                print(f"[SAVED] Variant {real_index + 1} for generation {self.generation_id}")
            except Exception as variant_save_error:
                # Silent - result is in memory in variant_completions
                pass

            # Variant data is already saved in generation_variants table
            # Update the main generation metadata to mark completion
            try:
                update_generation(
                    generation_id=self.generation_id,
                    status="completed",
                )
                print(f"[SAVED] Generation {self.generation_id} variant {real_index + 1}: {model.value}")
            except Exception as db_error:
                print(f"[ERROR] Failed to update generation {self.generation_id}: {db_error}")
                # Log the error but continue with post-processing
                # The variant data is already saved in generation_variants

            try:
                # Process images for this variant
                processed_html = await self._perform_image_generation(
                    html_result,
                    image_cache,
                )

                # Extract HTML content
                processed_html = extract_html_content(processed_html)

                # Send the complete variant back to the client using LOCAL_INDEX (0 for single variant)
                await self.send_message("setCode", processed_html, local_index)
                await self.send_message(
                    "variantComplete",
                    "Variant generation complete",
                    local_index,
                )
            except Exception as inner_e:
                # If websocket is closed or other error during post-processing
                print(f"Post-processing error for variant {real_index + 1}: {inner_e}")
                # We still keep the completion in variant_completions
                # AND the HTML is already saved in the database

        except asyncio.CancelledError:
            # Client disconnected - silent exit
            return

        except Exception as e:
            # Handle any OTHER errors that occurred during generation
            print(f"Error in variant {real_index + 1}: {e}")

            # 🔧 FIXED: Save error to generation_variants so it's persisted
            try:
                save_generation_variant(
                    generation_id=self.generation_id,
                    variant_index=real_index,
                    model=model.value,
                    status="failed",
                    error_message=str(e),
                )
            except Exception:
                # Silent - error is already sent to client
                pass

            # Only send error message if it hasn't been sent already
            if not isinstance(e, VariantErrorAlreadySent):
                await self.send_message("variantError", str(e), local_index)


# Pipeline Middleware Implementations


class WebSocketSetupMiddleware(Middleware):
    """Handles WebSocket setup and teardown"""

    async def process(
        self, context: PipelineContext, next_func: Callable[[], Awaitable[None]]
    ) -> None:
        # Create and setup WebSocket communicator
        context.ws_comm = WebSocketCommunicator(context.websocket)
        # If WebSocket was already accepted by handler, mark it as such
        if context.websocket_already_accepted:
            context.ws_comm.is_accepted = True
        await context.ws_comm.accept()

        # KILL SWITCH: Exit immediately if shutdown started during accept
        if main_module.app_shutting_down:
            context.cancelled = True
            context.ws_comm.is_closed = True
            return

        # Initialize generation record in database (if not already created by handler)
        # This ensures that even if the generation fails or WebSocket closes,
        # we have a record with the generation_id for tracking purposes
        if not context.websocket_already_accepted:
            try:
                save_generation(
                    status="started",
                    generation_id=context.generation_id,
                    user_id=context.user_id,
                )
                print(f"[INIT] Generation started with id={context.generation_id}, user_id={context.user_id}")
            except Exception:
                # Silent - generation_id is still valid for future saves
                pass

        try:
            await next_func()
        except asyncio.CancelledError:
            # Request cancelled - silent exit
            context.cancelled = True
            context.ws_comm.is_closed = True
        finally:
            # Always close the WebSocket
            try:
                await context.ws_comm.close()
            except:
                pass


class ParameterExtractionMiddleware(Middleware):
    """Handles parameter extraction and validation"""

    async def process(
        self, context: PipelineContext, next_func: Callable[[], Awaitable[None]]
    ) -> None:
        # KILL SWITCH: Exit if app shutting down or cancelled
        if main_module.app_shutting_down or context.cancelled or (context.ws_comm and context.ws_comm.is_closed):
            return

        try:
            print(f"[DEBUG] ParameterExtractionMiddleware: generation_id={context.generation_id}")
            # Check if parameters are already provided (from queue worker)
            if not hasattr(context, 'params') or context.params is None:
                # Receive parameters from WebSocket
                if context.ws_comm is None:
                    print("[ERROR] WebSocket communicator not available for parameter extraction")
                    context.mark_failed("websocket_not_available")
                    return
                context.params = await context.ws_comm.receive_params()

            # Extract and validate
            param_extractor = ParameterExtractionStage(context.throw_error)
            context.extracted_params = await param_extractor.extract_and_validate(
                context.params
            )

            # Check if extraction succeeded
            if context.extracted_params is None:
                print("[ERROR] Failed to extract parameters")
                context.mark_failed("parameter_extraction_failed")
                return

            # Log what we're generating
            print(
                f"Generating {context.extracted_params.stack} code in {context.extracted_params.input_mode} mode"
            )

            await next_func()
        except asyncio.CancelledError:
            # Request cancelled - silent exit
            pass


class StatusBroadcastMiddleware(Middleware):
    """Sends initial status messages to ACTIVE variants only"""

    async def process(
        self, context: PipelineContext, next_func: Callable[[], Awaitable[None]]
    ) -> None:
        # KILL SWITCH: Exit if app shutting down or cancelled
        if main_module.app_shutting_down or context.cancelled or (context.ws_comm and context.ws_comm.is_closed):
            return

        try:
            # 🔧 OPTIMIZATION: Tell frontend only about ACTIVE variants
            # Only 1 variant is active to save tokens
            num_active_variants = 1
            await context.send_message("variantCount", str(num_active_variants), 0)

            # Send status only for the active variant
            # Use local_index 0 (not ACTIVE_VARIANT_INDEX) because frontend expects 0-based index for active variants
            await context.send_message("status", "Generating code...", 0)

            await next_func()
        except asyncio.CancelledError:
            pass


class PromptCreationMiddleware(Middleware):
    """Handles prompt creation"""

    async def process(
        self, context: PipelineContext, next_func: Callable[[], Awaitable[None]]
    ) -> None:
        # KILL SWITCH: Exit if app shutting down or cancelled
        if main_module.app_shutting_down or context.cancelled or (context.ws_comm and context.ws_comm.is_closed):
            return

        try:
            print(f"[DEBUG] PromptCreationMiddleware: generation_id={context.generation_id}, extracted_params={'OK' if context.extracted_params else 'None'}")
            # Check extracted_params without throwing
            if context.extracted_params is None:
                print("[ERROR] extracted_params is None in PromptCreationMiddleware")
                context.mark_failed("parameters_not_extracted")
                return

            prompt_creator = PromptCreationStage(context.throw_error)
            context.prompt_messages, context.image_cache = (
                await prompt_creator.create_prompt(
                    context.extracted_params,
                )
            )

            await next_func()
        except asyncio.CancelledError:
            pass


class CodeGenerationMiddleware(Middleware):
    """Handles the main code generation logic"""

    async def process(
        self, context: PipelineContext, next_func: Callable[[], Awaitable[None]]
    ) -> None:
        # KILL SWITCH: Exit if app shutting down or cancelled
        if main_module.app_shutting_down or context.cancelled or (context.ws_comm and context.ws_comm.is_closed):
            return

        print(f"[DEBUG] CodeGenerationMiddleware: generation_id={context.generation_id}")
        # Check extracted_params early without throwing
        if context.extracted_params is None:
            print("[ERROR] extracted_params is None in CodeGenerationMiddleware")
            context.mark_failed("parameters_not_extracted")
            return

        if SHOULD_MOCK_AI_RESPONSE:
            # Use mock response for testing
            mock_stage = MockResponseStage(context.send_message)
            context.completions = await mock_stage.generate_mock_response(
                context.extracted_params.input_mode
            )
        else:
            try:
                if context.extracted_params.input_mode == "video":
                    # Use video generation for video mode
                    video_stage = VideoGenerationStage(
                        context.send_message, context.throw_error
                    )
                    context.completions = await video_stage.generate_video_code(
                        context.prompt_messages,
                        context.extracted_params.anthropic_api_key,
                    )
                else:
                    # Select models
                    model_selector = ModelSelectionStage(context.throw_error)
                    context.variant_models = await model_selector.select_models(
                        generation_type=context.extracted_params.generation_type,
                        input_mode=context.extracted_params.input_mode,
                        openai_api_key=context.extracted_params.openai_api_key,
                        anthropic_api_key=context.extracted_params.anthropic_api_key,
                        gemini_api_key=GEMINI_API_KEY,
                    )

                    # Generate code for all variants
                    generation_stage = ParallelGenerationStage(
                        send_message=context.send_message,
                        openai_api_key=context.extracted_params.openai_api_key,
                        openai_base_url=context.extracted_params.openai_base_url,
                        anthropic_api_key=context.extracted_params.anthropic_api_key,
                        should_generate_images=context.extracted_params.should_generate_images,
                        generation_id=context.generation_id,
                        stack=context.extracted_params.stack,
                    )

                    context.variant_completions = (
                        await generation_stage.process_variants(
                            variant_models=context.variant_models,
                            prompt_messages=context.prompt_messages,
                            image_cache=context.image_cache,
                            params=context.params,
                        )
                    )

                    # Check if all variants failed
                    if len(context.variant_completions) == 0:
                        print("[ERROR] All variants failed to generate code")
                        context.mark_failed("all_variants_failed")
                        return  # Don't continue the pipeline

                    # 🔧 OPTIMIZATION: Convert completions to list format
                    # variant_completions has {ACTIVE_VARIANT_INDEX: html}
                    # We need to map it properly
                    context.completions = []
                    if ACTIVE_VARIANT_INDEX in context.variant_completions:
                        context.completions.append(context.variant_completions[ACTIVE_VARIANT_INDEX])
                    else:
                        context.completions.append("")

            except asyncio.CancelledError:
                # Request cancelled - silent exit
                pass
            except Exception as e:
                print(f"[GENERATE_CODE] Unexpected error: {e}")
                context.mark_failed(f"code_generation_error: {str(e)}")
                return  # Don't continue the pipeline

        await next_func()


class PostProcessingMiddleware(Middleware):
    """Handles post-processing, logging, and sends final generation_complete signal"""

    async def process(
        self, context: PipelineContext, next_func: Callable[[], Awaitable[None]]
    ) -> None:
        # KILL SWITCH: Exit immediately if app shutting down or cancelled
        if main_module.app_shutting_down or context.cancelled or (context.ws_comm and context.ws_comm.is_closed):
            return

        try:
            post_processor = PostProcessingStage()
            await post_processor.process_completions(
                context.completions, context.prompt_messages, context.websocket
            )

            # 🔧 FIXED: Send final signal before closing WebSocket
            # This ensures frontend knows generation is complete and isn't left waiting
            try:
                if context.ws_comm and not context.ws_comm.is_closed:
                    # Increment user generations count on success
                    await increment_user_generations(context.websocket)

                    await context.websocket.send_json({"type": "generation_complete"})
                    print("Sent generation_complete signal to frontend")
            except asyncio.CancelledError:
                # Client disconnected - silent
                pass
            except Exception:
                # WebSocket is closed - silent
                pass

            await next_func()
        except asyncio.CancelledError:
            # Request cancelled - silent exit
            pass


def get_user_from_session(websocket: WebSocket) -> dict | None:
    """Get user info from session cookie in WebSocket connection."""
    try:
        session_id = websocket.cookies.get("session_id")
        if not session_id:
            return None

        conn = get_conn()
        cursor = conn.cursor()

        # Get session and user data
        now = datetime.utcnow().isoformat()
        cursor.execute("""
            SELECT u.id, u.email, u.plan, u.used_generations, u.disabled
            FROM sessions s
            JOIN users u ON s.user_id = u.id
            WHERE s.id = ? AND s.expires_at > ?
        """, (session_id, now))

        row = cursor.fetchone()
        conn.close()

        if not row:
            return None

        return {
            "id": row[0],
            "email": row[1],
            "plan": row[2],
            "used_generations": row[3],
            "disabled": bool(row[4]),
        }
    except Exception as e:
        print(f"[WS] Error getting user from session: {e}")
        return None


async def check_generation_limits(
    websocket: WebSocket, params: dict
) -> tuple[bool, str | None]:
    """
    Check if user can generate code based on plan limits.
    Returns (is_allowed, error_message)
    """
    user = get_user_from_session(websocket)

    if not user:
        # No user/session = can't check limits, but allow for demo
        return True, None

    if user.get("disabled"):
        return False, "Your account has been disabled"

    plan = user.get("plan", "free")
    used = user.get("used_generations", 0)
    limit = get_plan_limit(plan)

    # Check usage limit
    if used >= limit:
        return False, f"You have reached your {plan} plan limit ({limit} generations/month)"

    # Check format availability (if specified in params)
    format_name = params.get("generatedCodeConfig", "html_tailwind")
    if not is_format_allowed(plan, format_name):
        return False, f"Format '{format_name}' is not available in your {plan} plan"

    return True, None


async def increment_user_generations(websocket: WebSocket) -> None:
    """Increment used_generations for user after successful generation."""
    try:
        user = get_user_from_session(websocket)
        if not user:
            return

        conn = get_conn()
        cursor = conn.cursor()

        cursor.execute(
            "UPDATE users SET used_generations = used_generations + 1 WHERE id = ?",
            (user["id"],),
        )

        conn.commit()
        conn.close()
        print(f"[WS] Incremented generations for user {user['id']}")
    except Exception as e:
        print(f"[WS] Error incrementing generations: {e}")


@router.websocket("/generate-code")
async def stream_code(websocket: WebSocket):
    """Handle WebSocket code generation requests using a queue"""
    print("[WS] HANDLER ENTERED - frontend connected to generation route")

    from gen_queue.generation_queue import enqueue_generation, GenerationJob
    from db import save_generation
    import uuid

    print("[WS:0] Handler start")
    print(f"[WS:0] Client: {websocket.client}")

    print("[WS:1] accept WebSocket")
    await websocket.accept()
    print("[WS:1] DONE accept")

    print("[WS:2] receive_json from client")
    params: Dict[str, str] = await websocket.receive_json()
    print("[WS:2] DONE receive_json")

    print("[WS:3] check generation limits")
    is_allowed, error_message = await check_generation_limits(websocket, params)
    if not is_allowed:
        print(f"[WS:3] LIMIT CHECK FAILED: {error_message}")
        await websocket.send_json({
            "type": "error",
            "value": error_message or "Generation limit reached",
            "variantIndex": 0
        })
        await websocket.close(code=4029, reason="Limit exceeded")
        return
    print("[WS:3] DONE params check - limits OK")

    print("[WS:4] create generation_id")
    generation_id = str(uuid.uuid4().hex[:16])
    print(f"[WS:4] DONE generation_id={generation_id}")

    print("[WS:4.5] get user from session")
    user = get_user_from_session(websocket)
    user_id = user.get("id") if user else None
    print(f"[WS:4.5] DONE user_id={user_id}")

    print("[WS:5] save_generation to DB")
    save_generation(
        status="queued",
        generation_id=generation_id,
        user_id=user_id,
    )
    print(f"[WS:5] DONE save_generation record={generation_id}")

    print("[WS:6] send status message")
    await websocket.send_json({
        "type": "status",
        "value": "Queued for processing...",
        "variantIndex": 0
    })
    print("[WS:6] DONE send status")

    print("[WS:7] create GenerationJob")
    job = GenerationJob(
        generation_id=generation_id,
        websocket=websocket,
        params=params,
        websocket_already_accepted=True,
    )
    print(f"[WS:7] DONE GenerationJob created")

    print("[WS:8] enqueue_generation")
    await enqueue_generation(job)
    print(f"[WS:8] DONE enqueue_generation job_id={generation_id}")

    print("[WS:9] start keep-alive loop")
    while True:
        await asyncio.sleep(0.1)
