"""
Page type detection module.
Classifies screenshots into: landing, dashboard, or content pages.
Uses Vision LLM for fast, cheap classification.
"""

import json
import asyncio
from typing import Literal
from models import stream_gemini_response, stream_openai_response, stream_claude_response
from config import ANTHROPIC_API_KEY, GEMINI_API_KEY, OPENAI_API_KEY, OPENAI_BASE_URL
from llm import Llm
from openai.types.chat import ChatCompletionMessageParam, ChatCompletionContentPartParam

PageType = Literal["landing", "dashboard", "content"]


DETECTOR_SYSTEM_PROMPT = """You are a classifier. Analyze the provided website/app screenshot and classify it into exactly one category:
- "landing": marketing/landing page with hero, CTA, sections, promotional content
- "dashboard": app dashboard with sidebar/topbar, tables, charts, filters, data-driven UI
- "content": content/article/wiki/documentation style page with reading focus, text-heavy

Return ONLY valid JSON in this exact schema:
{"pageType":"landing"|"dashboard"|"content","confidence":number}

Rules:
- No extra keys.
- confidence must be between 0 and 1.
- If unsure, choose the closest and set confidence <= 0.6.
- No markdown, no explanations, only JSON."""


async def detect_page_type(
    image_data_url: str,
    model: Llm = Llm.CLAUDE_3_5_SONNET,
) -> tuple[PageType, float]:
    """
    Detect page type from screenshot using Vision LLM.

    Args:
        image_data_url: Base64 or URL of the screenshot
        model: LLM model to use for detection

    Returns:
        (page_type, confidence) tuple
    """

    # Prepare message with image
    user_content: list[ChatCompletionContentPartParam] = [
        {
            "type": "image_url",
            "image_url": {"url": image_data_url, "detail": "low"},  # low detail = faster + cheaper
        },
        {
            "type": "text",
            "text": "Classify this screenshot.",
        },
    ]

    messages: list[ChatCompletionMessageParam] = [
        {
            "role": "system",
            "content": DETECTOR_SYSTEM_PROMPT,
        },
        {
            "role": "user",
            "content": user_content,  # type: ignore
        },
    ]

    try:
        # No-op async callback (we don't need streaming output for page type detection)
        async def noop_callback(x: str) -> None:
            pass

        # Call appropriate LLM provider with minimal tokens
        response_text = ""

        if model in [Llm.CLAUDE_3_5_SONNET, Llm.CLAUDE_OPUS_2025_05_14]:
            # Use Claude
            result = await stream_claude_response(
                messages=messages,
                api_key=ANTHROPIC_API_KEY,
                callback=noop_callback,
                model_name=model.value,
            )
            response_text = result["code"]

        elif model in [Llm.GPT_4_OMNI, Llm.GPT_4_OMNI_MINI]:
            # Use OpenAI
            result = await stream_openai_response(
                messages=messages,
                api_key=OPENAI_API_KEY,
                base_url=OPENAI_BASE_URL,
                callback=noop_callback,
                model=model.value,
            )
            response_text = result["code"]

        elif model in [Llm.GEMINI_2_0_FLASH]:
            # Use Gemini
            result = await stream_gemini_response(
                messages=messages,
                api_key=GEMINI_API_KEY,
                callback=noop_callback,
                model=model.value,
            )
            response_text = result["code"]

        # Parse JSON response
        try:
            # Try to extract JSON from response
            json_match = response_text.strip()
            if json_match.startswith("```"):
                # Remove markdown code blocks if present
                json_match = json_match.split("```")[1].strip()
                if json_match.startswith("json"):
                    json_match = json_match[4:].strip()

            data = json.loads(json_match)
            page_type = data.get("pageType", "landing")
            confidence = float(data.get("confidence", 0.5))

            # Validate page type
            if page_type not in ["landing", "dashboard", "content"]:
                print(f"[DETECT] Invalid pageType '{page_type}', defaulting to 'landing'")
                page_type = "landing"

            print(f"[DETECT] Classified as '{page_type}' (confidence: {confidence:.2f})")
            return page_type, confidence  # type: ignore

        except (json.JSONDecodeError, KeyError, ValueError) as e:
            print(f"[DETECT] JSON parse error: {e}, response was: {response_text[:200]}")
            print(f"[DETECT] Defaulting to 'landing'")
            return "landing", 0.0

    except Exception as e:
        print(f"[DETECT] Error during page type detection: {e}")
        print(f"[DETECT] Defaulting to 'landing'")
        return "landing", 0.0
