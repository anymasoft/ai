"""
Screenshot image asset extraction module.
Identifies and extracts embedded images (logos, hero images, illustrations)
from screenshots to reduce LLM workload and improve visual fidelity.

Uses LLM-only detection (no cv2 dependency).
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
MAX_ASSETS_PER_REQUEST = 8
MIN_ASSET_DIMENSION = 40


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
    """Extracted image asset"""
    asset_id: str
    filename: str
    bbox: BBox
    mime_type: str = "image/png"
    asset_type: str = "image"  # "image" or "logo" or "illustration"

    def to_dict(self) -> dict:
        return {
            "id": self.asset_id,
            "src": f"/generated-assets/{self.filename}",
            "bbox": self.bbox.to_dict(),
            "mime": self.mime_type,
            "type": self.asset_type,
        }


@dataclass
class AssetExtractionResult:
    """Result of image asset extraction"""
    assets: list[ImageAsset]
    asset_manifest: list[dict]  # For passing to LLM
    total_bytes: int = 0
    debug_info: Optional[dict] = None


# LLM-based image detection prompt
DETECTOR_SYSTEM_PROMPT = """You analyze a website screenshot and detect embedded image elements such as logos, photos, or illustrations.

Return ONLY valid JSON array with detected images:
[
  {"id":"img1","x":100,"y":50,"w":200,"h":150,"type":"image"},
  {"id":"img2","x":400,"y":200,"w":300,"h":250,"type":"logo"}
]

Rules:
- x, y, w, h are pixel coordinates and dimensions
- Max 8 items total
- Ignore very small elements (< 40px)
- type can be: "image" (photos, illustrations), "logo" (brand marks), "illustration" (decorative graphics)
- If no images detected, return []
- Return ONLY the JSON array, no explanations"""


async def _detect_images_with_llm(image_data_url: str) -> list[dict]:
    """
    Detect images in screenshot using GPT-4.1-mini vision.

    Args:
        image_data_url: Base64-encoded image data URL

    Returns:
        List of detected image bboxes: [{"id", "x", "y", "w", "h", "type"}]
    """
    try:
        # Prepare vision message
        user_content: list[ChatCompletionContentPartParam] = [
            {
                "type": "image_url",
                "image_url": {"url": image_data_url, "detail": "low"},
            },
            {
                "type": "text",
                "text": "Detect all embedded images and logos in this screenshot.",
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

        # No-op callback (we don't need streaming)
        async def noop_callback(x: str) -> None:
            pass

        # Call GPT-4.1-mini for image detection
        result = await stream_openai_response(
            messages=messages,
            api_key=OPENAI_API_KEY,
            base_url=OPENAI_BASE_URL,
            callback=noop_callback,
            model=Llm.GPT_4_1_MINI.value,
            temperature=0.0,
            max_tokens=500,
        )

        response_text = result["code"].strip()

        # Try to extract JSON
        if response_text.startswith("["):
            # Already JSON
            data = json.loads(response_text)
        elif "```json" in response_text:
            # JSON in code block
            start = response_text.find("```json") + 7
            end = response_text.find("```", start)
            json_str = response_text[start:end].strip()
            data = json.loads(json_str)
        elif "```" in response_text:
            # Generic code block
            start = response_text.find("```") + 3
            end = response_text.find("```", start)
            json_str = response_text[start:end].strip()
            data = json.loads(json_str)
        else:
            # Try direct parse
            data = json.loads(response_text)

        # Validate response
        if not isinstance(data, list):
            print(f"[ASSETS] Invalid response type (expected list), got: {type(data)}")
            return []

        # Filter valid entries
        valid_images = []
        for item in data:
            if not isinstance(item, dict):
                continue
            if "x" not in item or "y" not in item or "w" not in item or "h" not in item:
                continue

            # Skip too small
            if item["w"] < MIN_ASSET_DIMENSION or item["h"] < MIN_ASSET_DIMENSION:
                continue

            valid_images.append(item)

        return valid_images[:MAX_ASSETS_PER_REQUEST]

    except json.JSONDecodeError as e:
        print(f"[ASSETS] JSON parse error during LLM detection: {e}")
        return []
    except Exception as e:
        print(f"[ASSETS] Error during LLM image detection: {e}")
        return []


def _save_asset(
    img: Image.Image,
    bbox: BBox,
    asset_id: str,
    asset_type: str = "image",
) -> tuple[str, int]:
    """
    Save a cropped region as an image file.
    Returns (filename, file_size_bytes)
    """
    try:
        # Crop the image
        crop_box = (bbox.x, bbox.y, bbox.x + bbox.w, bbox.y + bbox.h)
        cropped = img.crop(crop_box)

        # Generate filename
        filename = f"asset_{asset_id}_{bbox.x}_{bbox.y}.png"
        filepath = ASSETS_DIR / filename

        # Save as PNG
        cropped.save(filepath, format="PNG", optimize=True)

        # Get file size
        file_size = filepath.stat().st_size

        print(f"[ASSETS] Saved {asset_type} {filename} ({file_size} bytes, {bbox.w}x{bbox.h}px)")

        return filename, file_size
    except Exception as e:
        print(f"[ASSETS] Error saving asset: {e}")
        raise


async def extract_image_assets(
    image_data_url: str,
) -> AssetExtractionResult:
    """
    Extract image assets from a screenshot using LLM-based detection.

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

    # Detect images using LLM
    print(f"[ASSETS] Analyzing {img_width}x{img_height} screenshot for images (LLM-based)...")
    detected_images = await _detect_images_with_llm(image_data_url)

    if not detected_images:
        print("[ASSETS] No images detected by LLM")
        return AssetExtractionResult(assets=[], asset_manifest=[])

    print(f"[ASSETS] LLM detected {len(detected_images)} images")

    # Extract and save assets
    assets = []
    total_bytes = 0

    for detected_img in detected_images:
        try:
            # Validate bbox
            x, y, w, h = detected_img["x"], detected_img["y"], detected_img["w"], detected_img["h"]

            # Skip if out of bounds or too small
            if x < 0 or y < 0 or w < MIN_ASSET_DIMENSION or h < MIN_ASSET_DIMENSION:
                continue
            if x + w > img_width or y + h > img_height:
                continue

            bbox = BBox(x=int(x), y=int(y), w=int(w), h=int(h))

            # Generate asset ID
            asset_hash = hashlib.md5(f"{x}{y}{w}{h}".encode()).hexdigest()[:8]
            asset_id = asset_hash

            # Determine asset type
            asset_type = detected_img.get("type", "image")

            # Save asset
            filename, file_size = _save_asset(img, bbox, asset_id, asset_type=asset_type)
            total_bytes += file_size

            # Create asset record
            asset = ImageAsset(
                asset_id=asset_id,
                filename=filename,
                bbox=bbox,
                mime_type="image/png",
                asset_type=asset_type,
            )
            assets.append(asset)

            if len(assets) >= MAX_ASSETS_PER_REQUEST:
                print(f"[ASSETS] Reached max assets limit ({MAX_ASSETS_PER_REQUEST})")
                break

        except Exception as e:
            print(f"[ASSETS] Error processing detected image: {e}")
            continue

    # Build asset manifest for LLM
    asset_manifest = [asset.to_dict() for asset in assets]

    print(f"[ASSETS] Extracted {len(assets)} assets ({total_bytes} bytes total)")

    return AssetExtractionResult(
        assets=assets,
        asset_manifest=asset_manifest,
        total_bytes=total_bytes,
        debug_info={
            "detected_count": len(detected_images),
            "extracted_count": len(assets),
        },
    )
