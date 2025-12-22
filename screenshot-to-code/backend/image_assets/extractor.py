"""
Simple image asset extraction from screenshots.

Algorithm:
1. Take screenshot as PIL Image
2. Find non-text regions using simple heuristics:
   - Not white background
   - Not monochrome/solid color
   - Has color variance (indicates image/icon)
3. Extract regions with size limits (12x12 to 512x512)
4. Save to memory as base64 with metadata
"""

import base64
from io import BytesIO
from typing import Dict, List, Any
from PIL import Image
import numpy as np


def extract_image_assets(screenshot_b64: str) -> Dict[str, Dict[str, Any]]:
    """
    Extract image assets from a screenshot.
    
    Args:
        screenshot_b64: Base64-encoded screenshot image
        
    Returns:
        Dictionary mapping asset_id to asset data:
        {
            "asset_1": {
                "base64": "...",
                "w": 48,
                "h": 48,
                "aspect_ratio": 1.0
            },
            ...
        }
    """
    
    try:
        # Decode screenshot
        if screenshot_b64.startswith("data:image"):
            # data:image/png;base64,... format
            screenshot_b64 = screenshot_b64.split(",")[1]
        
        img_bytes = base64.b64decode(screenshot_b64)
        img = Image.open(BytesIO(img_bytes)).convert("RGB")
        
        img_array = np.array(img, dtype=np.float32)
        
        # Find potential image regions
        potential_regions = _find_non_text_regions(img_array)
        
        # Extract assets from regions
        asset_manifest = {}
        for idx, (y1, x1, y2, x2) in enumerate(potential_regions, 1):
            # Extract region
            region = img.crop((x1, y1, x2, y2))
            
            # Convert to base64
            region_bytes = BytesIO()
            region.save(region_bytes, format="PNG")
            region_base64 = base64.b64encode(region_bytes.getvalue()).decode()
            
            # Calculate metadata
            w = x2 - x1
            h = y2 - y1
            aspect_ratio = w / h if h > 0 else 1.0
            
            asset_id = f"asset_{idx}"
            asset_manifest[asset_id] = {
                "base64": region_base64,
                "w": w,
                "h": h,
                "aspect_ratio": aspect_ratio,
            }
        
        print(f"[IMAGE EXTRACTION] Found {len(asset_manifest)} image assets")
        return asset_manifest
    
    except Exception as e:
        print(f"[IMAGE EXTRACTION] Error extracting assets: {e}")
        return {}


def _find_non_text_regions(img_array: np.ndarray) -> List[tuple]:
    """
    Find potential image regions (non-text areas).
    
    Heuristic:
    - Split image into grid cells
    - For each cell, check color variance
    - If variance > threshold and not white: potential image region
    - Merge adjacent regions
    
    Args:
        img_array: numpy array (H, W, 3) with values 0-255
        
    Returns:
        List of (y1, x1, y2, x2) bounding boxes
    """
    
    MIN_SIZE = 12
    MAX_SIZE = 512
    GRID_SIZE = 32  # Cell size for initial analysis
    VARIANCE_THRESHOLD = 300  # Threshold for color variance
    
    h, w = img_array.shape[:2]
    
    regions = []
    
    # Scan grid cells
    for y in range(0, h - MIN_SIZE, GRID_SIZE):
        for x in range(0, w - MIN_SIZE, GRID_SIZE):
            # Get cell bounds
            y1 = y
            x1 = x
            y2 = min(y + GRID_SIZE * 2, h)  # 2x cell size to catch larger assets
            x2 = min(x + GRID_SIZE * 2, w)
            
            # Extract cell
            cell = img_array[y1:y2, x1:x2]
            
            # Calculate variance across RGB channels
            variance = np.var(cell)
            
            # Check if cell is not mostly white/uniform
            mean_brightness = np.mean(cell)
            is_white = mean_brightness > 200
            
            if variance > VARIANCE_THRESHOLD and not is_white:
                # Potential image region - expand to find exact bounds
                expanded = _expand_region(img_array, y1, x1, y2, x2)
                
                if expanded:
                    ey1, ex1, ey2, ex2 = expanded
                    
                    # Check size constraints
                    region_h = ey2 - ey1
                    region_w = ex2 - ex1
                    
                    if MIN_SIZE <= region_h <= MAX_SIZE and MIN_SIZE <= region_w <= MAX_SIZE:
                        regions.append((ey1, ex1, ey2, ex2))
    
    # Remove duplicate/overlapping regions
    regions = _merge_overlapping_regions(regions)
    
    return regions


def _expand_region(img_array: np.ndarray, y1: int, x1: int, y2: int, x2: int) -> tuple | None:
    """
    Expand region to find natural boundaries.
    
    Stop expanding when hitting white/uniform areas.
    """
    
    h, w = img_array.shape[:2]
    VARIANCE_THRESHOLD = 300
    
    try:
        # Try expanding in all directions
        while y1 > 0:
            row = img_array[y1 - 1, x1:x2]
            if np.var(row) < VARIANCE_THRESHOLD:
                break
            y1 -= 1
        
        while y2 < h:
            row = img_array[y2, x1:x2]
            if np.var(row) < VARIANCE_THRESHOLD:
                break
            y2 += 1
        
        while x1 > 0:
            col = img_array[y1:y2, x1 - 1]
            if np.var(col) < VARIANCE_THRESHOLD:
                break
            x1 -= 1
        
        while x2 < w:
            col = img_array[y1:y2, x2]
            if np.var(col) < VARIANCE_THRESHOLD:
                break
            x2 += 1
        
        return (y1, x1, y2, x2)
    except Exception:
        return None


def _merge_overlapping_regions(regions: List[tuple]) -> List[tuple]:
    """
    Remove duplicate/heavily overlapping regions.
    Keep larger regions when overlapping.
    """
    
    if not regions:
        return []
    
    regions = sorted(regions, key=lambda r: (r[2] - r[0]) * (r[3] - r[1]), reverse=True)
    
    merged = []
    for region in regions:
        y1, x1, y2, x2 = region
        
        # Check if overlaps with existing region
        overlaps = False
        for my1, mx1, my2, mx2 in merged:
            # Calculate overlap
            overlap_y = max(0, min(y2, my2) - max(y1, my1))
            overlap_x = max(0, min(x2, mx2) - max(x1, mx1))
            overlap_area = overlap_y * overlap_x
            
            region_area = (y2 - y1) * (x2 - x1)
            
            if overlap_area > region_area * 0.3:  # 30% overlap threshold
                overlaps = True
                break
        
        if not overlaps:
            merged.append(region)
    
    return merged
