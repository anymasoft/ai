"""
Screenshot image asset extraction module.
Identifies and extracts embedded images (logos, hero images, illustrations)
from screenshots to reduce LLM workload and improve visual fidelity.
"""

import hashlib
import os
import json
from dataclasses import dataclass
from typing import Optional
from PIL import Image
import numpy as np
from pathlib import Path
import cv2

ASSETS_DIR = Path(__file__).parent.parent.parent / "public" / "generated-assets"
ASSETS_DIR.mkdir(parents=True, exist_ok=True)

# Configuration
MAX_ASSETS_PER_REQUEST = 8
MAX_SHAPES_PER_REQUEST = 6
MIN_ASSET_DIMENSION = 32  # Skip very small regions
MIN_ASSET_AREA = 64 * 64  # 4096 pixels minimum
MIN_SHAPE_DIMENSION = 40  # Shapes should be at least 40px
MIN_SHAPE_AREA = 40 * 40  # 1600 pixels minimum


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
    entropy: float = 0.0  # How "image-like" is this region
    asset_type: str = "image"  # "image" or "shape"

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


def _calculate_entropy(region: np.ndarray) -> float:
    """
    Calculate entropy of a region to determine how "image-like" it is.
    High entropy = varied colors/textures (real images)
    Low entropy = solid colors/gradients (UI elements)
    """
    # Flatten to 1D
    flat = region.flatten()

    # Count unique colors
    unique_colors = len(np.unique(flat)) / len(flat)

    # Calculate color variance
    variance = np.var(flat)

    # Combined score (0..1)
    entropy = min(1.0, (unique_colors * 0.5 + np.clip(variance / 256, 0, 1) * 0.5))
    return entropy


def _find_candidate_regions(img_array: np.ndarray, step: int = 64) -> list[BBox]:
    """
    Find potential image regions using simple heuristics.
    Look for areas with high entropy (varied colors/textures).
    """
    candidates = []
    height, width = img_array.shape[:2]

    # Scan with sliding window
    for y in range(0, height - MIN_ASSET_DIMENSION, step):
        for x in range(0, width - MIN_ASSET_DIMENSION, step):
            # Try multiple window sizes
            for window_size in [64, 96, 128, 192, 256, 384]:
                if x + window_size > width or y + window_size > height:
                    continue

                # Extract region
                region = img_array[y : y + window_size, x : x + window_size]

                # Calculate entropy
                entropy = _calculate_entropy(region)

                # Keep if entropy is high (image-like) and not too repetitive
                if entropy > 0.4:  # Threshold for "image-like" regions
                    bbox = BBox(x=x, y=y, w=window_size, h=window_size)
                    candidates.append((bbox, entropy))

    # Remove duplicates (overlapping regions)
    # Keep regions with highest entropy
    candidates.sort(key=lambda x: x[1], reverse=True)

    filtered = []
    for bbox, entropy in candidates:
        # Check if overlaps with existing filtered regions
        overlaps = False
        for existing_bbox, _ in filtered:
            overlap_ratio = _calculate_overlap(bbox, existing_bbox)
            if overlap_ratio > 0.6:  # More than 60% overlap
                overlaps = True
                break

        if not overlaps and len(filtered) < MAX_ASSETS_PER_REQUEST:
            filtered.append((bbox, entropy))

    return [bbox for bbox, _ in filtered]


def _calculate_overlap(bbox1: BBox, bbox2: BBox) -> float:
    """Calculate overlap ratio between two bounding boxes"""
    x1_min, y1_min = bbox1.x, bbox1.y
    x1_max, y1_max = bbox1.x + bbox1.w, bbox1.y + bbox1.h

    x2_min, y2_min = bbox2.x, bbox2.y
    x2_max, y2_max = bbox2.x + bbox2.w, bbox2.y + bbox2.h

    # Calculate intersection
    inter_x_min = max(x1_min, x2_min)
    inter_y_min = max(y1_min, y2_min)
    inter_x_max = min(x1_max, x2_max)
    inter_y_max = min(y1_max, y2_max)

    if inter_x_max <= inter_x_min or inter_y_max <= inter_y_min:
        return 0.0

    inter_area = (inter_x_max - inter_x_min) * (inter_y_max - inter_y_min)
    bbox1_area = bbox1.w * bbox1.h

    return inter_area / bbox1_area if bbox1_area > 0 else 0.0


def _is_shape_like(region: np.ndarray) -> float:
    """
    Determine if a region looks like a decorative shape (circle, ellipse, curve).

    Heuristics:
    - Smooth edges (low edge complexity)
    - Significant contrast with background
    - Aspect ratio not too extreme (not a thin line)

    Returns: score from 0 to 1, where 1 = definitely a shape
    """
    # Convert to grayscale if needed
    if len(region.shape) == 3:
        gray = cv2.cvtColor(region.astype(np.uint8), cv2.COLOR_RGB2GRAY)
    else:
        gray = region.astype(np.uint8)

    # Detect edges
    edges = cv2.Canny(gray, 50, 150)

    # Count edge pixels
    edge_pixels = np.count_nonzero(edges)
    total_pixels = region.shape[0] * region.shape[1]
    edge_ratio = edge_pixels / total_pixels if total_pixels > 0 else 0

    # Shapes typically have moderate edge ratio (not too sparse, not too dense)
    # Too sparse = empty/gradient region, too dense = complex UI
    shape_score = 0.0

    if 0.01 < edge_ratio < 0.3:
        shape_score = 0.5

    # Check for circular/elliptical contours
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    if contours:
        # Get largest contour
        largest = max(contours, key=cv2.contourArea)
        contour_area = cv2.contourArea(largest)

        if contour_area > (total_pixels * 0.05):  # At least 5% of region
            # Try to fit ellipse
            if len(largest) >= 5:
                ellipse = cv2.fitEllipse(largest)
                # Calculate how well the contour fits an ellipse
                # by comparing contour area to ellipse area
                ellipse_area = (ellipse[1][0] / 2) * (ellipse[1][1] / 2) * np.pi
                fit_ratio = contour_area / ellipse_area if ellipse_area > 0 else 0

                # Good fit = 0.7-1.0 ratio
                if 0.6 < fit_ratio <= 1.0:
                    shape_score = max(shape_score, 0.8)

    return min(1.0, shape_score)


def _find_candidate_shapes(img_array: np.ndarray, step: int = 80) -> list[tuple[BBox, float]]:
    """
    Find potential decorative shapes (circles, ellipses, curves).
    Look for smooth regions with clean edges.
    """
    candidates = []
    height, width = img_array.shape[:2]

    # Scan with sliding window (shapes are typically medium-sized)
    for y in range(0, height - MIN_SHAPE_DIMENSION, step):
        for x in range(0, width - MIN_SHAPE_DIMENSION, step):
            # Try multiple window sizes for shapes
            for window_size in [64, 96, 128, 160]:
                if x + window_size > width or y + window_size > height:
                    continue

                # Extract region
                region = img_array[y : y + window_size, x : x + window_size]

                # Calculate shape likelihood
                shape_score = _is_shape_like(region)

                if shape_score > 0.5:  # Threshold for "shape-like"
                    bbox = BBox(x=x, y=y, w=window_size, h=window_size)
                    candidates.append((bbox, shape_score))

    # Sort by shape score (highest first)
    candidates.sort(key=lambda x: x[1], reverse=True)

    # Remove duplicates (overlapping regions)
    filtered = []
    for bbox, score in candidates:
        overlaps = False
        for existing_bbox, _ in filtered:
            overlap_ratio = _calculate_overlap(bbox, existing_bbox)
            if overlap_ratio > 0.6:
                overlaps = True
                break

        if not overlaps and len(filtered) < MAX_SHAPES_PER_REQUEST:
            filtered.append((bbox, score))

    return filtered


def _save_asset(
    img: Image.Image,
    region: BBox,
    asset_id: str,
    asset_type: str = "image",
) -> tuple[str, int]:
    """
    Save a cropped region as an image file.
    Returns (filename, file_size_bytes)
    """
    # Crop the image
    crop_box = (region.x, region.y, region.x + region.w, region.y + region.h)
    cropped = img.crop(crop_box)

    # Generate filename based on asset type
    prefix = "shape" if asset_type == "shape" else "asset"
    filename = f"{prefix}_{asset_id}_{region.x}_{region.y}.png"
    filepath = ASSETS_DIR / filename

    # Save as PNG
    cropped.save(filepath, format="PNG", optimize=True)

    # Get file size
    file_size = filepath.stat().st_size

    asset_type_label = "shape" if asset_type == "shape" else "image"
    print(f"[ASSETS] Saved {asset_type_label} {filename} ({file_size} bytes, {region.w}x{region.h}px)")

    return filename, file_size


async def extract_image_assets(
    image_data_url: str,
    use_llm_verification: bool = True,
) -> AssetExtractionResult:
    """
    Extract image assets from a screenshot.

    Args:
        image_data_url: Base64-encoded image data URL
        use_llm_verification: Whether to use LLM for classification (optional, can be expensive)

    Returns:
        AssetExtractionResult with extracted assets and manifest
    """
    import base64
    import io

    # Decode image
    try:
        base64_data = image_data_url.split(",")[1]
        image_bytes = base64.b64decode(base64_data)
        img = Image.open(io.BytesIO(image_bytes))

        # Convert to RGB if needed
        if img.mode != "RGB" and img.mode != "RGBA":
            img = img.convert("RGB")

        img_array = np.array(img)
    except Exception as e:
        print(f"[ASSETS] Failed to decode image: {e}")
        return AssetExtractionResult(assets=[], asset_manifest=[])

    # Find candidate regions
    print(f"[ASSETS] Analyzing {img_array.shape[1]}x{img_array.shape[0]} screenshot for assets...")
    candidates = _find_candidate_regions(img_array)

    if not candidates:
        print("[ASSETS] No candidate regions found")
        return AssetExtractionResult(assets=[], asset_manifest=[])

    print(f"[ASSETS] Found {len(candidates)} candidate regions")

    # For now, accept all candidates (no expensive LLM verification)
    # In future, could add LLM verification for top N candidates
    assets = []
    total_bytes = 0

    for i, bbox in enumerate(candidates):
        if bbox.area() < MIN_ASSET_AREA:
            continue

        # Generate asset ID (hash of bbox coordinates)
        asset_hash = hashlib.md5(f"{bbox.x}{bbox.y}{bbox.w}{bbox.h}".encode()).hexdigest()[:8]
        asset_id = asset_hash

        # Save asset
        filename, file_size = _save_asset(img, bbox, asset_id, asset_type="image")
        total_bytes += file_size

        # Create asset record
        asset = ImageAsset(
            asset_id=asset_id,
            filename=filename,
            bbox=bbox,
            mime_type="image/png",
            asset_type="image",
        )
        assets.append(asset)

        if len(assets) >= MAX_ASSETS_PER_REQUEST:
            print(f"[ASSETS] Reached max assets limit ({MAX_ASSETS_PER_REQUEST})")
            break

    # Extract decorative shapes
    print(f"[ASSETS] Analyzing screenshot for decorative shapes...")
    shape_candidates = _find_candidate_shapes(img_array)

    if shape_candidates:
        print(f"[ASSETS] Found {len(shape_candidates)} candidate shapes")

        for idx, (bbox, score) in enumerate(shape_candidates):
            if bbox.area() < MIN_SHAPE_AREA:
                continue

            # Generate shape ID
            shape_hash = hashlib.md5(f"shape_{bbox.x}_{bbox.y}_{bbox.w}_{bbox.h}".encode()).hexdigest()[:8]
            shape_id = shape_hash

            # Save shape asset
            filename, file_size = _save_asset(img, bbox, shape_id, asset_type="shape")
            total_bytes += file_size

            # Create shape asset record
            shape_asset = ImageAsset(
                asset_id=shape_id,
                filename=filename,
                bbox=bbox,
                mime_type="image/png",
                entropy=score,
                asset_type="shape",
            )
            assets.append(shape_asset)

            if len([a for a in assets if a.asset_type == "shape"]) >= MAX_SHAPES_PER_REQUEST:
                print(f"[ASSETS] Reached max shapes limit ({MAX_SHAPES_PER_REQUEST})")
                break
    else:
        print("[ASSETS] No candidate shapes found")

    # Build asset manifest for LLM
    asset_manifest = [asset.to_dict() for asset in assets]

    total_images = len([a for a in assets if a.asset_type == "image"])
    total_shapes = len([a for a in assets if a.asset_type == "shape"])
    print(f"[ASSETS] Extracted {total_images} images + {total_shapes} shapes ({total_bytes} bytes total)")

    return AssetExtractionResult(
        assets=assets,
        asset_manifest=asset_manifest,
        total_bytes=total_bytes,
        debug_info={
            "image_count": total_images,
            "shape_count": total_shapes,
            "total_candidates": len(candidates) + len(shape_candidates),
        },
    )
