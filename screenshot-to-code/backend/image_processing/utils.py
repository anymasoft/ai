import base64
import io
import time
from PIL import Image

# 🎯 VISUAL FIDELITY: Adjusted for pixel-perfect screenshot reproduction
CLAUDE_IMAGE_MAX_SIZE = 8 * 1024 * 1024  # Increased from 5MB to 8MB (Claude can handle it)
CLAUDE_MAX_IMAGE_DIMENSION = 8000  # Increased from 7990 to match API docs

# Maximum size for PNG before falling back to PNG compression
MAX_PNG_SIZE_BEFORE_COMPRESSION = 6 * 1024 * 1024  # 6MB threshold


def process_image(image_data_url: str) -> tuple[str, str]:
    """
    🎯 CRITICAL: Process image for MAXIMUM visual fidelity, not file size optimization.

    Strategy:
    1. Use PNG for lossless compression (preserves every pixel)
    2. Use NEAREST resize for UI elements (preserves pixel boundaries)
    3. Keep RGBA for accurate colors and transparency
    4. Only compress if absolutely necessary
    """

    # Extract bytes and media type from base64 data URL
    media_type = image_data_url.split(";")[0].split(":")[1]
    base64_data = image_data_url.split(",")[1]
    image_bytes = base64.b64decode(base64_data)

    img = Image.open(io.BytesIO(image_bytes))
    original_format = img.format or "PNG"

    print(f"[IMAGE PROCESSING] Input: {original_format} {img.size[0]}x{img.size[1]} ({len(base64_data)} bytes)")

    # Check if image is under max dimensions
    is_under_dimension_limit = (
        img.width <= CLAUDE_MAX_IMAGE_DIMENSION
        and img.height <= CLAUDE_MAX_IMAGE_DIMENSION
    )
    is_under_size_limit = len(base64_data) <= CLAUDE_IMAGE_MAX_SIZE

    # 🎯 If image fits limits, return with minimal processing
    if is_under_dimension_limit and is_under_size_limit:
        print("[IMAGE PROCESSING] ✅ No resize needed - within limits")
        # Always ensure RGBA for consistency
        if img.mode not in ("RGBA", "RGB"):
            img = img.convert("RGBA")

        # Use PNG for lossless format
        output = io.BytesIO()
        img.save(output, format="PNG", compress_level=9)
        png_data = base64.b64encode(output.getvalue()).decode("utf-8")
        print(f"[IMAGE PROCESSING] Output: PNG {img.size[0]}x{img.size[1]} ({len(output.getvalue())} bytes)")
        return ("image/png", png_data)

    # Time image processing
    start_time = time.time()

    # 🎯 CRITICAL FIX #1: Use NEAREST resize to preserve UI element boundaries
    # (LANCZOS blurs sharp corners, making buttons/text fuzzy)
    if not is_under_dimension_limit:
        # Calculate new dimensions while maintaining aspect ratio
        if img.width > img.height:
            new_width = CLAUDE_MAX_IMAGE_DIMENSION
            new_height = int((CLAUDE_MAX_IMAGE_DIMENSION / img.width) * img.height)
        else:
            new_height = CLAUDE_MAX_IMAGE_DIMENSION
            new_width = int((CLAUDE_MAX_IMAGE_DIMENSION / img.height) * img.width)

        # 🎯 Use NEAREST for pixel-perfect UI (not LANCZOS which blurs)
        img = img.resize((new_width, new_height), Image.Resampling.NEAREST)
        print(f"[IMAGE PROCESSING] Resized to {new_width}x{new_height} using NEAREST (pixel-perfect)")

    # 🎯 CRITICAL FIX #2: Keep RGBA to preserve color accuracy and transparency
    # (RGB conversion causes subtle color shifts)
    if img.mode != "RGBA":
        img = img.convert("RGBA")

    print(f"[IMAGE PROCESSING] Mode: RGBA (preserves transparency and color accuracy)")

    # 🎯 CRITICAL FIX #3: Use PNG for lossless compression (not JPEG)
    # JPEG artifacts destroy visual fidelity; PNG preserves every pixel
    output = io.BytesIO()
    img.save(output, format="PNG", compress_level=9)  # Max compression, but lossless

    output_size = len(base64.b64encode(output.getvalue()))

    # If PNG is still too large, try compression level reduction (still lossless)
    if output_size > CLAUDE_IMAGE_MAX_SIZE:
        print(f"[IMAGE PROCESSING] ⚠️ PNG too large ({output_size} bytes), reducing compression...")
        output = io.BytesIO()
        img.save(output, format="PNG", compress_level=6)  # Still lossless, just faster
        output_size = len(base64.b64encode(output.getvalue()))

    # Last resort: If STILL too large, convert to RGBA8 palette mode to reduce size
    # (this is better than JPEG because it still has 256 colors)
    if output_size > CLAUDE_IMAGE_MAX_SIZE and img.mode == "RGBA":
        print(f"[IMAGE PROCESSING] ⚠️ Still too large, using PNG with palette mode...")
        img_palletized = img.convert("P", palette=Image.Palette.ADAPTIVE)
        output = io.BytesIO()
        img_palletized.save(output, format="PNG", compress_level=9)
        output_size = len(base64.b64encode(output.getvalue()))

    png_data = base64.b64encode(output.getvalue()).decode("utf-8")

    end_time = time.time()
    processing_time = end_time - start_time

    print(f"[IMAGE PROCESSING] ✅ Output: PNG {img.size[0]}x{img.size[1]} ({output_size} bytes)")
    print(f"[IMAGE PROCESSING] Processing time: {processing_time:.2f}s")

    return ("image/png", png_data)
