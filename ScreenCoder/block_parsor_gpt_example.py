"""
ScreenCoder - Block Parser with GPT-4o
This is an example of how to use the block parser with OpenAI's GPT-4o model.

Usage:
1. Create gpt_api.txt with your OpenAI API key
2. Run: python block_parsor_gpt_example.py
"""

import os
import cv2
import json
from utils import GPT, encode_image, image_mask

# Configuration
DEFAULT_IMAGE_PATH = "data/input/test1.png"
DEFAULT_API_PATH = "gpt_api.txt"  # ← Change to your API key file

# Prompt for block detection (English)
PROMPT_MERGE = """Return the bounding boxes of the sidebar, main content, header, and navigation in this webpage screenshot.
Please only return the corresponding bounding boxes.

Important:
1. The areas should not overlap
2. All text and content must be framed inside
3. Keep it compact without excessive blank space
4. Output format: <bbox>x1 y1 x2 y2</bbox> for each labeled region

Return JSON format:
{
    "header": [x1, y1, x2, y2],
    "sidebar": [x1, y1, x2, y2],
    "navigation": [x1, y1, x2, y2],
    "main_content": [x1, y1, x2, y2]
}"""

BBOX_TAG_START = "<bbox>"
BBOX_TAG_END = "</bbox>"


def resolve_containment(bboxes: dict[str, tuple[int, int, int, int]]) -> dict[str, tuple[int, int, int, int]]:
    """
    Resolves containment issues among bounding boxes.
    If a box is found to be fully contained within another, it is removed.
    """

    def contains(box_a, box_b):
        """Checks if box_a completely contains box_b."""
        xa1, ya1, xa2, ya2 = box_a
        xb1, yb1, xb2, yb2 = box_b
        return xa1 <= xb1 and ya1 <= yb1 and xa2 >= xb2 and ya2 >= yb2

    names = list(bboxes.keys())
    removed = set()

    for i in range(len(names)):
        for j in range(len(names)):
            if i == j or names[i] in removed or names[j] in removed:
                continue
            if contains(bboxes[names[i]], bboxes[names[j]]):
                removed.add(names[j])

    return {name: bbox for name, bbox in bboxes.items() if name not in removed}


def parse_bboxes(bbox_content: str, image_path: str) -> dict:
    """
    Parses the response from the model to extract bounding boxes.
    """
    bboxes = {}
    try:
        # Try to parse as JSON first
        lines = bbox_content.strip().split('\n')
        for line in lines:
            if BBOX_TAG_START in line and BBOX_TAG_END in line:
                start_idx = line.find(BBOX_TAG_START) + len(BBOX_TAG_START)
                end_idx = line.find(BBOX_TAG_END)
                bbox_str = line[start_idx:end_idx].strip()
                coords = list(map(int, bbox_str.split()))
                if len(coords) == 4:
                    # Extract label from the line (e.g., "header: <bbox>...")
                    label = line[:line.find(BBOX_TAG_START)].strip().lower()
                    if ':' in label:
                        label = label.split(':')[0].strip()
                    if label in ['header', 'sidebar', 'navigation', 'main content', 'main_content']:
                        bboxes[label] = tuple(coords)
    except Exception as e:
        print(f"Error parsing bboxes: {e}")

    # Resolve containment
    if bboxes:
        bboxes = resolve_containment(bboxes)

    return bboxes


def detect_blocks(image_path: str, api_path: str) -> dict:
    """
    Detects major layout blocks in a webpage screenshot using GPT.
    """
    # Initialize GPT client
    try:
        client = GPT(api_path)
    except FileNotFoundError:
        print(f"Error: API key file '{api_path}' not found.")
        print("Please create it with: echo 'sk-your-key' > gpt_api.txt")
        return {}

    # Ask GPT to detect blocks
    print(f"Detecting blocks in {image_path}...")
    try:
        bbox_content = client.try_ask(PROMPT_MERGE, encode_image(image_path))
        if not bbox_content:
            print("Error: GPT returned empty response")
            return {}

        print(f"GPT Response:\n{bbox_content}\n")
        bboxes = parse_bboxes(bbox_content, image_path)

        if not bboxes:
            print("Warning: No bounding boxes detected")
        else:
            print(f"Detected blocks: {list(bboxes.keys())}")

        return bboxes
    except Exception as e:
        print(f"Error detecting blocks: {e}")
        return {}


if __name__ == "__main__":
    # Detect blocks
    bboxes = detect_blocks(DEFAULT_IMAGE_PATH, DEFAULT_API_PATH)

    if bboxes:
        print("\n✓ Successfully detected blocks!")
        print(f"Bounding boxes: {json.dumps(bboxes, indent=2)}")

        # Save to JSON
        output_path = "data/output/bboxes.json"
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, 'w') as f:
            json.dump(bboxes, f, indent=2)
        print(f"Saved to {output_path}")
    else:
        print("\n✗ Failed to detect blocks")
