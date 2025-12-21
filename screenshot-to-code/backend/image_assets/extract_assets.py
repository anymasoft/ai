"""
Asset-dominant image extraction module.
Extracts ALL non-rectilinear visual elements (icons, logos, photos, decorations)
as PNG files for use in HTML generation.

Philosophy: Anything that requires curves, diagonals, or complex graphics = <img>.
Layout and text only in CSS/HTML.

CRITICAL: Assets are saved as PNG files with URL references, NOT base64 inline.
This prevents LLM from streaming gigabytes of base64 data.
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

ASSETS_DIR = Path(__file__).parent.parent.parent / "public" / "generated-assets"
ASSETS_DIR.mkdir(parents=True, exist_ok=True)

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
    """Extracted visual asset (saved as PNG file, NOT base64)"""
    asset_id: str
    filename: str  # PNG filename in /public/generated-assets/
    bbox: BBox
    role: str  # "icon", "logo", "photo", "decorative", "ui-symbol"
    mime_type: str = "image/png"
    layout_lock: bool = False  # If True, position is ABSOLUTE and must match bbox exactly
    element_type: str = "image"  # "button", "input", "badge", "progress", "rating", "icon", "image", etc.

    def to_dict(self) -> dict:
        """Return asset metadata for LLM (NO base64)"""
        return {
            "id": self.asset_id,
            "src": f"/generated-assets/{self.filename}",  # URL, NOT base64
            "bbox": self.bbox.to_dict(),
            "role": self.role,
            "mime": self.mime_type,
            "layout_lock": self.layout_lock,  # LLM must use position: absolute
            "element_type": self.element_type,  # UI element type
        }


@dataclass
class AssetExtractionResult:
    """Result of asset extraction"""
    assets: list[ImageAsset]
    asset_manifest: list[dict]  # For passing to LLM (NO base64)
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
- UI symbols (arrows, stars, checkmarks, badges, etc.)
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


async def _classify_ui_elements(
    image_data_url: str,
    detected_assets: list[dict],
) -> dict[str, tuple[str, bool]]:
    """
    Classify detected assets into UI element types (button, input, badge, etc.)
    and mark which ones need strict position locking.

    Args:
        image_data_url: Original screenshot data URL
        detected_assets: List of detected asset bboxes with coordinates

    Returns:
        Dict mapping asset_id → (element_type, layout_lock_bool)
        Examples:
          "a1" → ("button", True)  # layout_lock=True means position: absolute required
          "a2" → ("badge", True)
          "a3" → ("icon", False)   # layout_lock=False means decorative/icon
    """
    if not detected_assets:
        return {}

    try:
        # Build asset location list for classification
        assets_description = "\n".join([
            f"  id={item.get('id')}: x={item.get('x')}, y={item.get('y')}, "
            f"w={item.get('w')}, h={item.get('h')}, role={item.get('role')}"
            for item in detected_assets[:20]  # Limit to first 20 for token budget
        ])

        classifier_prompt = f"""You are a UI element classifier.

Given a screenshot and detected element locations, classify each element as one of:
- button: clickable button (may have text, icon, or both)
- input: text input field, search box, or form input
- badge: small label, tag, or status badge
- progress: progress bar, slider, or rating
- rating: star rating, review score, or percentage
- pagination: pagination controls, page numbers
- tabs: tab navigation
- icon: icon without functional purpose
- decorative: decorative shape or illustration
- image: photo or image

CRITICAL: Elements that are UI CONTROLS (button, input, badge, progress, rating, pagination, tabs) MUST have:
  layout_lock = true

These elements must be positioned at EXACT coordinates from the screenshot. Do NOT allow them to shift.

Elements that are DECORATIVE (icon, decorative, image) can have:
  layout_lock = false (visual/decorative, flexible positioning allowed)

Detected elements:
{assets_description}

Return ONLY valid JSON:
{{
  "a1": {{"element_type": "button", "layout_lock": true}},
  "a2": {{"element_type": "icon", "layout_lock": false}},
  ...
}}"""

        # No-op callback
        async def noop_callback(x: str) -> None:
            pass

        # Call GPT-4.1-mini for classification
        result = await stream_openai_response(
            messages=[
                {
                    "role": "system",
                    "content": "You are a UI element classifier. Return only valid JSON.",
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {"url": image_data_url, "detail": "high"},
                        },
                        {
                            "type": "text",
                            "text": classifier_prompt,
                        },
                    ],
                },
            ],
            api_key=OPENAI_API_KEY,
            base_url=OPENAI_BASE_URL,
            callback=noop_callback,
            model=Llm.GPT_4_1_MINI.value,
            temperature=0.0,
            max_tokens=2000,
        )

        response_text = result["code"].strip()

        # Extract JSON from response
        if response_text.startswith("{"):
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

        if not isinstance(data, dict):
            print(f"[ASSETS] Invalid classification response, got: {type(data)}")
            # Return default classification
            return {
                item.get("id"): ("decorative", False)
                for item in detected_assets
                if item.get("id")
            }

        # Process classification results
        classification_map = {}
        for asset_id, classification in data.items():
            if isinstance(classification, dict):
                element_type = classification.get("element_type", "decorative")
                layout_lock = classification.get("layout_lock", False)
                classification_map[asset_id] = (element_type, layout_lock)
            else:
                # Fallback: assume decorative
                classification_map[asset_id] = ("decorative", False)

        print(
            f"[ASSETS] Classified {len(classification_map)} elements "
            f"({sum(1 for _, (_, lock) in classification_map.items() if lock)} with layout_lock)"
        )

        return classification_map

    except Exception as e:
        print(f"[ASSETS] Error during UI classification: {e}")
        # Return default classification (all decorative, no layout_lock)
        return {
            item.get("id"): ("decorative", False)
            for item in detected_assets
            if item.get("id")
        }


def _save_asset_file(
    img: Image.Image,
    bbox: BBox,
    asset_id: str,
) -> tuple[str, int]:
    """
    Save asset as PNG file to disk.

    Args:
        img: PIL Image
        bbox: Bounding box to crop
        asset_id: Asset ID for filename

    Returns:
        (filename, file_size_bytes)
    """
    try:
        # Crop region
        crop_box = (bbox.x, bbox.y, bbox.x + bbox.w, bbox.y + bbox.h)
        cropped = img.crop(crop_box)

        # Generate filename
        filename = f"asset_{asset_id}_{bbox.x}_{bbox.y}.png"
        filepath = ASSETS_DIR / filename

        # Save as PNG
        cropped.save(filepath, format="PNG", optimize=True)

        # Get file size
        file_size = filepath.stat().st_size

        print(f"[ASSETS] Saved {filename} ({file_size} bytes, {bbox.w}x{bbox.h}px)")

        return filename, file_size
    except Exception as e:
        print(f"[ASSETS] Error saving asset: {e}")
        raise


async def extract_image_assets(
    image_data_url: str,
) -> AssetExtractionResult:
    """
    Extract all visual assets from screenshot in ASSET-DOMINANT mode.
    Saves assets as PNG files with URL references (NOT base64 inline).

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

    # Classify UI elements (button, input, badge, etc.) to determine layout locking
    print("[ASSETS] Classifying UI elements for strict positioning...")
    classification_map = await _classify_ui_elements(image_data_url, detected_assets)

    # Extract and save assets
    assets = []
    total_bytes = 0

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

            # Get classification (element_type and layout_lock status)
            element_type, layout_lock = classification_map.get(detected_asset.get("id"), ("decorative", False))

            # Save as PNG file (NOT base64)
            filename, file_size = _save_asset_file(img, bbox, asset_id)
            total_bytes += file_size

            # Create asset record with layout_lock flag
            asset = ImageAsset(
                asset_id=asset_id,
                filename=filename,
                bbox=bbox,
                role=role,
                mime_type="image/png",
                layout_lock=layout_lock,  # UI controls get layout_lock=True
                element_type=element_type,  # button, input, badge, etc.
            )
            assets.append(asset)

            if len(assets) >= MAX_ASSETS_PER_REQUEST:
                print(f"[ASSETS] Reached max assets limit ({MAX_ASSETS_PER_REQUEST})")
                break

        except Exception as e:
            print(f"[ASSETS] Error processing detected asset: {e}")
            continue

    # Build asset manifest for LLM (NO base64 - only URLs)
    asset_manifest = [asset.to_dict() for asset in assets]

    print(f"[ASSETS] Extracted {len(assets)} visual assets ({total_bytes} bytes total)")

    return AssetExtractionResult(
        assets=assets,
        asset_manifest=asset_manifest,
        debug_info={
            "detected_count": len(detected_assets),
            "extracted_count": len(assets),
            "mode": "asset-dominant",
        },
    )
