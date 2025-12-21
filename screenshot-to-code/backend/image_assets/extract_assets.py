"""
Asset-dominant image extraction module.
Extracts ALL non-rectilinear visual elements (icons, logos, photos, decorations)
as base64-encoded PNG assets for use in HTML generation.

Philosophy: Anything that requires curves, diagonals, or complex graphics = <img>.
Layout and text only in CSS/HTML.
"""

import hashlib
import json
import base64
import io
from dataclasses import dataclass
from typing import Optional
from PIL import Image
from pathlib import Path

from models import stream_openai_response
from config import OPENAI_API_KEY, OPENAI_BASE_URL
from llm import Llm
from openai.types.chat import ChatCompletionMessageParam, ChatCompletionContentPartParam

# Configuration
MAX_ASSETS_PER_REQUEST = 40  # Aggressive extraction
MIN_ASSET_DIMENSION = 8  # Even 8px icons are assets


@dataclass
class BBox:
    """Bounding box for an image region"""
    x: int
    y: int
    w: int
    h: int

    def to_dict(self) -> dict:
        return {"x": self.x, "y": self.y, "w": self.w, "h": self.h}

    def area(self) -> int:
        return self.w * self.h


@dataclass
class ImageAsset:
    """Extracted visual asset"""
    asset_id: str
    bbox: BBox
    base64_data: str  # data:image/png;base64,...
    role: str  # "icon", "logo", "photo", "decorative", "ui-symbol"
    mime_type: str = "image/png"

    def to_dict(self) -> dict:
        return {
            "id": self.asset_id,
            "src": self.base64_data,
            "bbox": self.bbox.to_dict(),
            "role": self.role,
            "mime": self.mime_type,
        }


@dataclass
class AssetExtractionResult:
    """Result of asset extraction"""
    assets: list[ImageAsset]
    asset_manifest: list[dict]  # For passing to LLM
    debug_info: Optional[dict] = None


# LLM detection prompt for asset-dominant mode
DETECTOR_SYSTEM_PROMPT = """You analyze a website screenshot and detect ALL visual elements that are NOT simple rectangular layout blocks.

This includes:
- icons (ANY size, including 8-24px)
- logos
- photos
- avatars
- SVG symbols
- decorative shapes
- curves, waves, blobs, gradients
- UI symbols (arrows, stars, checkmarks, badges, badges, etc.)
- brand marks
- illustrations

IGNORE:
- simple rectangular containers (divs, buttons without decorations)
- pure text areas
- solid color blocks

Return ONLY valid JSON array:
[
  {"id":"a1","x":100,"y":50,"w":24,"h":24,"role":"icon"},
  {"id":"a2","x":400,"y":200,"w":300,"h":250,"role":"photo"}
]

Rules:
- x, y, w, h are pixel coordinates and dimensions
- MAX 40 items
- Size does NOT matter (include 8px icons)
- If unsure about element type, INCLUDE it
- Roles: icon, logo, photo, decorative, ui-symbol
- Return ONLY the JSON array, no explanations"""


async def _detect_all_assets_with_llm(image_data_url: str) -> list[dict]:
    """
    Detect ALL visual assets (not just images) using GPT-4.1-mini vision.
    Aggressive extraction: include anything that's not a simple rectangle.

    Args:
        image_data_url: Base64-encoded image data URL

    Returns:
        List of detected asset bboxes: [{"id", "x", "y", "w", "h", "role"}]
    """
    try:
        # Prepare vision message
        user_content: list[ChatCompletionContentPartParam] = [
            {
                "type": "image_url",
                "image_url": {"url": image_data_url, "detail": "high"},  # high detail for small icons
            },
            {
                "type": "text",
                "text": "Detect ALL visual elements that are not simple rectangular layout blocks. Include icons of any size, logos, photos, decorative elements, UI symbols.",
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

        # No-op callback
        async def noop_callback(x: str) -> None:
            pass

        # Call GPT-4.1-mini with high detail for asset detection
        result = await stream_openai_response(
            messages=messages,
            api_key=OPENAI_API_KEY,
            base_url=OPENAI_BASE_URL,
            callback=noop_callback,
            model=Llm.GPT_4_1_MINI.value,
            temperature=0.0,
            max_tokens=2000,  # More space for 40 assets
        )

        response_text = result["code"].strip()

        # Extract JSON from response
        if response_text.startswith("["):
            data = json.loads(response_text)
        elif "```json" in response_text:
            start = response_text.find("```json") + 7
            end = response_text.find("```", start)
            json_str = response_text[start:end].strip()
            data = json.loads(json_str)
        elif "```" in response_text:
            start = response_text.find("```") + 3
            end = response_text.find("```", start)
            json_str = response_text[start:end].strip()
            data = json.loads(json_str)
        else:
            data = json.loads(response_text)

        # Validate response
        if not isinstance(data, list):
            print(f"[ASSETS] Invalid response type, got: {type(data)}")
            return []

        # Filter valid entries
        valid_assets = []
        for item in data:
            if not isinstance(item, dict):
                continue
            if "x" not in item or "y" not in item or "w" not in item or "h" not in item:
                continue

            # Skip only really tiny (1-2px noise)
            if item["w"] < MIN_ASSET_DIMENSION or item["h"] < MIN_ASSET_DIMENSION:
                continue

            valid_assets.append(item)

        return valid_assets[:MAX_ASSETS_PER_REQUEST]

    except json.JSONDecodeError as e:
        print(f"[ASSETS] JSON parse error: {e}")
        return []
    except Exception as e:
        print(f"[ASSETS] Error during asset detection: {e}")
        return []


def _crop_to_base64(
    img: Image.Image,
    bbox: BBox,
) -> str:
    """
    Crop image region and convert to base64 data URL.

    Args:
        img: PIL Image
        bbox: Bounding box to crop

    Returns:
        data:image/png;base64,... string
    """
    try:
        # Crop region
        crop_box = (bbox.x, bbox.y, bbox.x + bbox.w, bbox.y + bbox.h)
        cropped = img.crop(crop_box)

        # Convert to PNG in memory
        buffer = io.BytesIO()
        cropped.save(buffer, format="PNG", optimize=True)
        png_bytes = buffer.getvalue()

        # Encode to base64
        b64_str = base64.b64encode(png_bytes).decode("utf-8")
        data_url = f"data:image/png;base64,{b64_str}"

        return data_url
    except Exception as e:
        print(f"[ASSETS] Error converting to base64: {e}")
        raise


async def extract_image_assets(
    image_data_url: str,
) -> AssetExtractionResult:
    """
    Extract all visual assets from screenshot in ASSET-DOMINANT mode.
    Converts assets to base64 inline data URLs instead of files.

    Args:
        image_data_url: Base64-encoded image data URL

    Returns:
        AssetExtractionResult with extracted assets and manifest
    """
    # Decode image
    try:
        base64_data = image_data_url.split(",")[1]
        image_bytes = base64.b64decode(base64_data)
        img = Image.open(io.BytesIO(image_bytes))

        # Convert to RGB if needed
        if img.mode != "RGB" and img.mode != "RGBA":
            img = img.convert("RGB")

        img_width, img_height = img.size
    except Exception as e:
        print(f"[ASSETS] Failed to decode image: {e}")
        return AssetExtractionResult(assets=[], asset_manifest=[])

    # Detect all assets using LLM
    print(f"[ASSETS] Analyzing {img_width}x{img_height} screenshot for visual assets (ASSET-DOMINANT mode)...")
    detected_assets = await _detect_all_assets_with_llm(image_data_url)

    if not detected_assets:
        print("[ASSETS] No visual assets detected")
        return AssetExtractionResult(assets=[], asset_manifest=[])

    print(f"[ASSETS] LLM detected {len(detected_assets)} visual assets")

    # Extract and convert to base64
    assets = []

    for detected_asset in detected_assets:
        try:
            # Validate bbox
            x, y, w, h = int(detected_asset["x"]), int(detected_asset["y"]), int(detected_asset["w"]), int(detected_asset["h"])

            # Skip if out of bounds
            if x < 0 or y < 0 or w < MIN_ASSET_DIMENSION or h < MIN_ASSET_DIMENSION:
                continue
            if x + w > img_width or y + h > img_height:
                continue

            bbox = BBox(x=x, y=y, w=w, h=h)

            # Generate asset ID
            asset_hash = hashlib.md5(f"{x}_{y}_{w}_{h}".encode()).hexdigest()[:12]
            asset_id = asset_hash

            # Get role from detection
            role = detected_asset.get("role", "decorative")

            # Convert to base64
            base64_data = _crop_to_base64(img, bbox)

            # Create asset record
            asset = ImageAsset(
                asset_id=asset_id,
                bbox=bbox,
                base64_data=base64_data,
                role=role,
                mime_type="image/png",
            )
            assets.append(asset)

            print(f"[ASSETS] Extracted {role} {asset_id[:8]} ({w}x{h}px)")

            if len(assets) >= MAX_ASSETS_PER_REQUEST:
                print(f"[ASSETS] Reached max assets limit ({MAX_ASSETS_PER_REQUEST})")
                break

        except Exception as e:
            print(f"[ASSETS] Error processing detected asset: {e}")
            continue

    # Build asset manifest for LLM
    asset_manifest = [asset.to_dict() for asset in assets]

    print(f"[ASSETS] Extracted {len(assets)} visual assets (ASSET-DOMINANT mode)")

    return AssetExtractionResult(
        assets=assets,
        asset_manifest=asset_manifest,
        debug_info={
            "detected_count": len(detected_assets),
            "extracted_count": len(assets),
            "mode": "asset-dominant",
        },
    )
