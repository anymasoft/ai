"""
Asset matcher for finding best asset for broken img src.

Algorithm:
1. Extract desired size from img tag (class, style)
2. Find asset with closest dimensions
3. Consider aspect ratio similarity
"""

import re
from typing import Dict, Any, Optional


def find_best_asset(
    asset_manifest: Dict[str, Dict[str, Any]],
    target_w: Optional[int] = None,
    target_h: Optional[int] = None,
    target_aspect_ratio: Optional[float] = None,
) -> Optional[str]:
    """
    Find the best matching asset for the given dimensions.
    
    Args:
        asset_manifest: Manifest of available assets
        target_w: Target width (pixels)
        target_h: Target height (pixels)
        target_aspect_ratio: Target aspect ratio (w/h)
        
    Returns:
        Asset ID (e.g., "asset_1") or None if no assets available
    """
    
    if not asset_manifest:
        return None
    
    # If no target dimensions, return largest asset
    if target_w is None and target_h is None and target_aspect_ratio is None:
        return max(
            asset_manifest.keys(),
            key=lambda aid: (
                asset_manifest[aid]["w"] * asset_manifest[aid]["h"]
            ),
        )
    
    # Score each asset
    best_asset = None
    best_score = float("inf")
    
    for asset_id, asset_data in asset_manifest.items():
        asset_w = asset_data["w"]
        asset_h = asset_data["h"]
        asset_ar = asset_data["aspect_ratio"]
        
        score = 0
        
        # Penalize size difference
        if target_w is not None:
            score += abs(asset_w - target_w) ** 2
        
        if target_h is not None:
            score += abs(asset_h - target_h) ** 2
        
        # Penalize aspect ratio difference
        if target_aspect_ratio is not None:
            score += abs(asset_ar - target_aspect_ratio) ** 2 * 100
        
        # Prefer assets that aren't too much larger
        if target_w is not None and asset_w > target_w * 2:
            score += 1000
        
        if target_h is not None and asset_h > target_h * 2:
            score += 1000
        
        if score < best_score:
            best_score = score
            best_asset = asset_id
    
    return best_asset


def extract_size_from_img_tag(tag_attrs: str) -> tuple[Optional[int], Optional[int]]:
    """
    Extract width and height from img tag attributes.
    
    Looks in:
    1. width/height attributes
    2. style attribute (width: Xpx, height: Xpx)
    3. class attribute (w-*, h-* from Tailwind)
    
    Args:
        tag_attrs: img tag attributes string (e.g., 'class="w-12 h-12" alt="...')
        
    Returns:
        (width, height) or (None, None) if not found
    """
    
    w = None
    h = None
    
    # Try width/height attributes
    width_match = re.search(r'width=["\']?(\d+)["\']?', tag_attrs, re.IGNORECASE)
    if width_match:
        w = int(width_match.group(1))
    
    height_match = re.search(r'height=["\']?(\d+)["\']?', tag_attrs, re.IGNORECASE)
    if height_match:
        h = int(height_match.group(1))
    
    # Try style attribute
    style_match = re.search(r'style=["\']?([^"\']+)["\']?', tag_attrs, re.IGNORECASE)
    if style_match:
        style = style_match.group(1)
        
        if not w:
            width_style = re.search(r'width\s*:\s*(\d+)', style)
            if width_style:
                w = int(width_style.group(1))
        
        if not h:
            height_style = re.search(r'height\s*:\s*(\d+)', style)
            if height_style:
                h = int(height_style.group(1))
    
    # Try Tailwind classes
    class_match = re.search(r'class=["\']?([^"\']+)["\']?', tag_attrs, re.IGNORECASE)
    if class_match:
        classes = class_match.group(1)
        
        if not w:
            tailwind_w = re.search(r'w-(\d+)', classes)
            if tailwind_w:
                # Tailwind: w-12 = 3rem = 48px (approximate)
                w_value = int(tailwind_w.group(1))
                w = w_value * 4  # Rough approximation
        
        if not h:
            tailwind_h = re.search(r'h-(\d+)', classes)
            if tailwind_h:
                h_value = int(tailwind_h.group(1))
                h = h_value * 4  # Rough approximation
    
    return w, h
