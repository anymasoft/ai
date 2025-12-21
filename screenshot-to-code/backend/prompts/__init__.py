from typing import Union, Any, cast
from openai.types.chat import ChatCompletionMessageParam, ChatCompletionContentPartParam

from custom_types import InputMode
from image_generation.core import create_alt_url_mapping
from prompts.imported_code_prompts import IMPORTED_CODE_SYSTEM_PROMPTS
from prompts.screenshot_system_prompts import SYSTEM_PROMPTS, get_system_prompt_for_page_type
from prompts.text_prompts import SYSTEM_PROMPTS as TEXT_SYSTEM_PROMPTS
from prompts.types import Stack, PromptContent
from video.utils import assemble_claude_prompt_video


# 🎯 CRITICAL: Explicit task, NO "confirm instructions" escape route
USER_PROMPT = """
Do an internal visual decomposition of the screenshot first (do NOT output the analysis).

Then, GENERATE THE HTML NOW.

Return ONLY a complete, valid HTML document.
- EXACTLY ONE <html> tag (opening).
- EXACTLY ONE <body> tag.
- All tags properly closed.
- <style> block fully formed and closed.
- No explanations, no markdown, no comments about what you're doing.
- Output starts with <html and ends with </html>.

IMPORTANT: If an ASSET_MANIFEST is provided below, use those image assets in the HTML.
- Place extracted images using <img src="..."> with the provided src URLs.
- Use the bbox (bounding box) coordinates to position assets correctly.
- DO NOT try to recreate these images using CSS or gradients.
- Preserve aspect ratio and use object-fit if needed.
"""

SVG_USER_PROMPT = """
Do an internal visual decomposition of the screenshot first (do NOT output the analysis).

Then, GENERATE THE SVG NOW.

Return ONLY a complete, valid SVG document.
- Starts with <svg and ends with </svg>.
- All tags properly closed.
- No explanations, no markdown, no comments about what you're doing.
"""

PARTIAL_UPDATE_PROMPT = """
You are editing a SINGLE HTML element.
Return ONLY the updated HTML of this element.
Do NOT return the entire document.
Do NOT add explanations or markdown.
Return valid HTML only."""


async def create_prompt(
    stack: Stack,
    input_mode: InputMode,
    generation_type: str,
    prompt: PromptContent,
    history: list[dict[str, Any]],
    is_imported_from_code: bool,
    update_mode: str = "full",
    page_type: str = "landing",
    asset_manifest: list[dict] = None,
) -> tuple[list[ChatCompletionMessageParam], dict[str, str]]:

    if asset_manifest is None:
        asset_manifest = []

    image_cache: dict[str, str] = {}

    # If this generation started off with imported code, we need to assemble the prompt differently
    if is_imported_from_code:
        original_imported_code = history[0]["text"]
        prompt_messages = assemble_imported_code_prompt(original_imported_code, stack)
        for index, item in enumerate(history[1:]):
            role = "user" if index % 2 == 0 else "assistant"
            message = create_message_from_history_item(item, role)
            prompt_messages.append(message)
    else:
        # Assemble the prompt for non-imported code
        if input_mode == "image":
            image_url = prompt["images"][0]
            prompt_messages = assemble_prompt(image_url, stack, page_type=page_type, asset_manifest=asset_manifest)
        elif input_mode == "text":
            prompt_messages = assemble_text_prompt(prompt["text"], stack)
        else:
            # Default to image mode for backward compatibility
            image_url = prompt["images"][0]
            prompt_messages = assemble_prompt(image_url, stack, page_type=page_type, asset_manifest=asset_manifest)

        if generation_type == "update":
            # Transform the history tree into message format
            for index, item in enumerate(history):
                role = "assistant" if index % 2 == 0 else "user"
                message = create_message_from_history_item(item, role)
                prompt_messages.append(message)

            # 🔧 PARTIAL UPDATE: Add special prompt if updating single element
            if update_mode == "partial":
                prompt_messages.append({
                    "role": "user",
                    "content": PARTIAL_UPDATE_PROMPT,
                })

            image_cache = create_alt_url_mapping(history[-2]["text"])

    if input_mode == "video":
        video_data_url = prompt["images"][0]
        prompt_messages = await assemble_claude_prompt_video(video_data_url)

    return prompt_messages, image_cache


def create_message_from_history_item(
    item: dict[str, Any], role: str
) -> ChatCompletionMessageParam:
    """
    Create a ChatCompletionMessageParam from a history item.
    Handles both text-only and text+images content.
    """
    # Check if this is a user message with images
    if role == "user" and item.get("images") and len(item["images"]) > 0:
        # Create multipart content for user messages with images
        user_content: list[ChatCompletionContentPartParam] = []

        # Add all images first
        for image_url in item["images"]:
            user_content.append(
                {
                    "type": "image_url",
                    "image_url": {"url": image_url, "detail": "high"},
                }
            )

        # Add text content
        user_content.append(
            {
                "type": "text",
                "text": item["text"],
            }
        )

        return cast(
            ChatCompletionMessageParam,
            {
                "role": role,
                "content": user_content,
            },
        )
    else:
        # Regular text-only message
        return cast(
            ChatCompletionMessageParam,
            {
                "role": role,
                "content": item["text"],
            },
        )


def assemble_imported_code_prompt(
    code: str, stack: Stack
) -> list[ChatCompletionMessageParam]:
    system_content = IMPORTED_CODE_SYSTEM_PROMPTS[stack]

    user_content = (
        "Here is the code of the app: " + code
        if stack != "svg"
        else "Here is the code of the SVG: " + code
    )

    return [
        {
            "role": "system",
            "content": system_content + "\n " + user_content,
        }
    ]


def assemble_prompt(
    image_data_url: str,
    stack: Stack,
    page_type: str = "landing",
    asset_manifest: list[dict] = None,
) -> list[ChatCompletionMessageParam]:
    import json

    if asset_manifest is None:
        asset_manifest = []

    # 🔍 PAGE TYPE AWARE: Use specialized prompt based on detected page type
    # For HTML/CSS stacks, use page-type-specific prompts
    # For other stacks (React, Vue, etc.), use default framework prompts
    if stack in ["html_css", "html_tailwind"] and page_type in ["landing", "dashboard", "content"]:
        system_content = get_system_prompt_for_page_type(page_type)
        print(f"📋 Using {page_type.upper()} page system prompt")
    else:
        # Fall back to standard framework prompts for other stacks
        system_content = SYSTEM_PROMPTS[stack]

    user_prompt = USER_PROMPT if stack != "svg" else SVG_USER_PROMPT

    # Add asset manifest to user prompt if available
    if asset_manifest:
        asset_text = f"\n\nASSET_MANIFEST:\n{json.dumps(asset_manifest, indent=2)}\n"
        user_prompt = user_prompt + asset_text

    user_content: list[ChatCompletionContentPartParam] = [
        {
            "type": "image_url",
            "image_url": {"url": image_data_url, "detail": "high"},
        },
        {
            "type": "text",
            "text": user_prompt,
        },
    ]
    return [
        {
            "role": "system",
            "content": system_content,
        },
        {
            "role": "user",
            "content": user_content,
        },
    ]


def assemble_text_prompt(
    text_prompt: str,
    stack: Stack,
) -> list[ChatCompletionMessageParam]:

    system_content = TEXT_SYSTEM_PROMPTS[stack]

    return [
        {
            "role": "system",
            "content": system_content,
        },
        {
            "role": "user",
            "content": "Generate UI for " + text_prompt,
        },
    ]
