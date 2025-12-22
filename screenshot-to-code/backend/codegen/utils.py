import re
import traceback
from typing import Dict


def extract_html_content(text: str) -> str:
    """
    🎯 CRITICAL: Extract and ensure valid HTML structure.

    Rules:
    1. Look for <html> tags first
    2. If not found, look for <body> tags and wrap them
    3. If nothing found, wrap entire content in minimal HTML
    4. Ensure proper closing tags
    5. Always return structurally valid HTML
    """

    # Strategy 1: Look for complete <html>...</html>
    match = re.search(r"<html[^>]*>.*?</html>", text, re.DOTALL | re.IGNORECASE)
    if match:
        html = match.group(0)
        # Ensure proper structure
        html = _ensure_valid_structure(html)
        print(f"[HTML EXTRACTION] Found <html> tags, using extracted content ({len(html)} chars)")
        return html

    # Strategy 2: Look for <body> tags and wrap them
    match = re.search(r"<body[^>]*>.*?</body>", text, re.DOTALL | re.IGNORECASE)
    if match:
        body_content = match.group(0)
        html = f"""<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
{body_content}
</html>"""
        print(f"[HTML EXTRACTION] Found <body> tags, wrapped in HTML structure ({len(html)} chars)")
        return html

    # Strategy 3: Look for any content that looks like HTML
    if re.search(r"<[a-z]+[^>]*>", text, re.IGNORECASE):
        # Content has HTML tags, wrap it in minimal structure
        html = f"""<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
{text}
</body>
</html>"""
        print(f"[HTML EXTRACTION] No <html> or <body> tags, wrapping content in minimal structure ({len(html)} chars)")
        return html

    # Strategy 4: Last resort - entire text as body content
    html = f"""<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
{text}
</body>
</html>"""
    print(f"[HTML EXTRACTION] No HTML tags detected, treating entire content as body ({len(html)} chars)")
    return html


def _ensure_valid_structure(html: str) -> str:
    """
    Ensure HTML has proper closing tags and structure.
    """
    # Check if closing html tag exists
    if not re.search(r"</html>", html, re.IGNORECASE):
        html += "\n</html>"

    # Check if closing body tag exists
    if re.search(r"<body[^>]*>", html, re.IGNORECASE) and not re.search(r"</body>", html, re.IGNORECASE):
        # Find position to insert </body> before </html>
        html = re.sub(
            r"(</html>)",
            r"</body>\n\1",
            html,
            flags=re.IGNORECASE
        )

    # Check if closing head tag exists (if <head> is present)
    if re.search(r"<head[^>]*>", html, re.IGNORECASE) and not re.search(r"</head>", html, re.IGNORECASE):
        # Find position to insert </head> before <body>
        html = re.sub(
            r"(<body[^>]*>)",
            r"</head>\n\1",
            html,
            flags=re.IGNORECASE
        )

    return html


def sanitize_html_output(html: str) -> str:
    """
    🔥 CRITICAL: Post-process HTML output to fix common model errors.

    Fixes:
    1. Remove nested <html> tags inside <body>
    2. Close unclosed <style> blocks
    3. Deduplicate exact duplicate CSS rules
    4. Remove incomplete CSS rules (e.g. "color: #" at end of file)
    5. Ensure single <html> and <body>

    Returns: Clean, valid HTML
    """

    # FIX #1: Remove nested <html> tags inside <body>
    # Pattern: <body...>...(<html...>...)...</body>
    # Keep only the innermost content
    html = re.sub(
        r"(<body[^>]*>.*?)(<html[^>]*>|<!DOCTYPE)",
        r"\1",
        html,
        flags=re.DOTALL | re.IGNORECASE
    )

    # FIX #2: Close unclosed <style> blocks
    # Simple approach: count opens/closes and add missing closes before </html>
    style_open_count = len(re.findall(r"<style[^>]*>", html, re.IGNORECASE))
    style_close_count = len(re.findall(r"</style>", html, re.IGNORECASE))

    if style_open_count > style_close_count:
        missing = style_open_count - style_close_count
        # Add missing </style> tags before </html>
        html = re.sub(
            r"(</html>)",
            r"</style>\n" * missing + r"\1",
            html,
            count=1,
            flags=re.IGNORECASE
        )
        print(f"[SANITIZE] Added {missing} missing </style> tag(s)")

    # FIX #3 & #4: Fix CSS block content - close incomplete rules & deduplicate
    # Find <style> blocks and process them
    def fix_style_block(match):
        style_tag = match.group(1)  # <style...>
        css_content = match.group(2)  # content between tags
        closing_tag = match.group(3)  # </style>

        # Remove incomplete CSS at the end (rules that end without "}")
        # Look for pattern: selector { ...properties... but no closing }
        css_content = re.sub(
            r"([{]\s*[^}]*?)(\s*)$",
            lambda m: m.group(1) + " }" if "{" in m.group(1) else m.group(0),
            css_content,
            flags=re.DOTALL
        )

        # Deduplicate entire CSS rule blocks (selector + all properties)
        # Strategy: parse rules as complete blocks, keep only unique ones
        seen_rules = {}
        unique_blocks = []

        # Split by "}" to get individual rule blocks
        blocks = re.split(r"(})", css_content)

        current_block = ""
        for block in blocks:
            if block.strip():
                current_block += block

                # If we just added a "}", we have a complete rule
                if block == "}":
                    block_normalized = re.sub(r"\s+", " ", current_block.strip())
                    if block_normalized not in seen_rules:
                        seen_rules[block_normalized] = True
                        unique_blocks.append(current_block)
                    current_block = ""

        # If there's leftover content (incomplete rule), add it
        if current_block.strip():
            block_normalized = re.sub(r"\s+", " ", current_block.strip())
            if block_normalized not in seen_rules:
                unique_blocks.append(current_block)

        dedup_content = "\n".join(unique_blocks)

        return f"{style_tag}\n{dedup_content}\n{closing_tag}"

    # Apply fix to all style blocks
    html = re.sub(
        r"(<style[^>]*>)(.*?)(</style>)",
        fix_style_block,
        html,
        flags=re.DOTALL | re.IGNORECASE
    )

    print("[SANITIZE] Fixed CSS blocks and deduplicated rules")

    # FIX #5: Ensure exactly one <html> and one <body>
    # Count tags
    html_open_count = len(re.findall(r"<html[^>]*>", html, re.IGNORECASE))
    body_open_count = len(re.findall(r"<body[^>]*>", html, re.IGNORECASE))

    if html_open_count > 1:
        # Keep only first <html>
        first_html = re.search(r"<html[^>]*>", html, re.IGNORECASE)
        if first_html:
            # Remove all other <html> tags
            html = html[:first_html.end()] + re.sub(
                r"<html[^>]*>",
                "",
                html[first_html.end():],
                flags=re.IGNORECASE
            )
        print(f"[SANITIZE] Removed {html_open_count - 1} duplicate <html> tag(s)")

    if body_open_count > 1:
        # Keep only first <body>
        first_body = re.search(r"<body[^>]*>", html, re.IGNORECASE)
        if first_body:
            # Remove all other <body> tags
            html = html[:first_body.end()] + re.sub(
                r"<body[^>]*>",
                "",
                html[first_body.end():],
                flags=re.IGNORECASE
            )
        print(f"[SANITIZE] Removed {body_open_count - 1} duplicate <body> tag(s)")

    return html


def is_html_valid(html: str) -> tuple[bool, str]:
    """
    🔍 CRITICAL: Validate HTML output before sending to client.

    Checks:
    1. </html> must be the VERY LAST tag in response
    2. Exactly ONE <html> tag must exist
    3. Exactly ONE <body> tag must exist
    4. HTML must not be empty or just whitespace

    Returns: (is_valid, error_message)
    """

    if not html or not html.strip():
        return False, "HTML is empty"

    # Check 1: </html> must be last non-whitespace token
    html_stripped = html.rstrip()
    if not html_stripped.endswith("</html>"):
        return False, "HTML does not end with </html>"

    # Check 2: Exactly ONE <html> tag
    html_open_count = len(re.findall(r"<html[^>]*>", html, re.IGNORECASE))
    if html_open_count != 1:
        return False, f"Expected 1 <html> tag, found {html_open_count}"

    # Check 3: Exactly ONE <body> tag
    body_open_count = len(re.findall(r"<body[^>]*>", html, re.IGNORECASE))
    if body_open_count != 1:
        return False, f"Expected 1 <body> tag, found {body_open_count}"

    # Check 4: Match </html> count
    html_close_count = len(re.findall(r"</html>", html, re.IGNORECASE))
    if html_close_count != 1:
        return False, f"Expected 1 </html> tag, found {html_close_count}"

    # Check 5: Match </body> count
    body_close_count = len(re.findall(r"</body>", html, re.IGNORECASE))
    if body_close_count != 1:
        return False, f"Expected 1 </body> tag, found {body_close_count}"

    return True, "Valid HTML"


def strip_img_src_attributes(html: str) -> str:
    """
    SAFETY: Remove all non-data: src attributes from <img> tags.

    Rules:
    1. If <img src="logo.png"> → <img data-asset-id="...">
    2. If <img src="http://..."> → <img data-asset-id="...">
    3. If <img src="/path/..."> → <img data-asset-id="...">
    4. Keep data:image src values (for placeholders)
    5. Keep data-asset-id attributes

    This prevents LLM from generating broken relative/absolute image paths.
    """

    try:
        # Pattern: Remove any src that is NOT data:image
        # Match: src="something" where something doesn't start with "data:"

        # First, collect all <img> tags
        img_pattern = r'<img\s+([^>]*)>'

        def process_img_tag(match):
            tag_content = match.group(1)

            # Extract src attribute (if any)
            src_pattern = r'src=["\']?([^"\'>\s]+)["\']?'
            src_match = re.search(src_pattern, tag_content)

            if src_match:
                src_value = src_match.group(1)

                # Check if it's a data: URL (placeholder) - keep it
                if src_value.startswith("data:"):
                    return match.group(0)  # Keep as is

                # Remove this src (it's a relative/absolute path)
                # Replace the src attribute completely
                new_tag_content = re.sub(src_pattern, '', tag_content)

                # If there's no data-asset-id, add a placeholder one
                if 'data-asset-id' not in new_tag_content.lower():
                    # Generate asset ID from position or hash
                    asset_id = f"asset_{hash(new_tag_content) % 10000}"
                    new_tag_content = f'data-asset-id="{asset_id}" {new_tag_content}'

                return f'<img {new_tag_content.strip()}>'

            return match.group(0)  # Keep if no src

        html = re.sub(img_pattern, process_img_tag, html, flags=re.IGNORECASE)
        return html
    except Exception as e:
        print(f"[SAFETY] Error stripping img src: {e}")
        return html


def fix_broken_img_icons(html: str) -> str:
    """
    Fix broken or missing <img> attributes after LLM processing.

    Rules:
    1. Remove non-data: src attributes (SAFETY CHECK) ← CRITICAL FIX
    2. If <img> has empty or missing src → use placeholder 1x1 PNG
    3. Ensure all <img> tags have either data:image src OR data-asset-id

    This prevents broken image icons in the UI.
    """

    # Placeholder 1x1 transparent PNG (minimal, valid)
    PLACEHOLDER_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="

    try:
        # STEP 1: Strip any non-data: src attributes (safety) ← ENFORCES LLM RULES
        html = strip_img_src_attributes(html)

        # STEP 2: Fix <img> tags with empty src
        # Match: <img ... src="" ... > or <img ... src='' ... > or <img without src>

        # Pattern 1: src="" (empty double quotes)
        html = re.sub(
            r'<img\s+([^>]*?)src=""([^>]*)>',
            rf'<img \1src="{PLACEHOLDER_PNG}"\2>',
            html,
            flags=re.IGNORECASE
        )

        # Pattern 2: src='' (empty single quotes)
        html = re.sub(
            r"<img\s+([^>]*?)src=''([^>]*)>",
            rf'<img \1src="{PLACEHOLDER_PNG}"\2>',
            html,
            flags=re.IGNORECASE
        )

        # Pattern 3: src="/" or src="." (invalid paths)
        html = re.sub(
            r'<img\s+([^>]*?)src="[./]*"([^>]*)>',
            rf'<img \1src="{PLACEHOLDER_PNG}"\2>',
            html,
            flags=re.IGNORECASE
        )

        # Pattern 4: <img without src attribute but WITHOUT data-asset-id either
        # This case needs placeholder
        def ensure_img_has_src_or_asset_id(match):
            tag = match.group(0)

            # If it has src, skip
            if 'src=' in tag.lower():
                return tag

            # If it has data-asset-id, skip
            if 'data-asset-id' in tag.lower():
                return tag

            # Otherwise, add placeholder src
            return tag.replace('>', f' src="{PLACEHOLDER_PNG}">', 1)

        html = re.sub(
            r'<img\s+[^>]*?>',
            ensure_img_has_src_or_asset_id,
            html,
            flags=re.IGNORECASE
        )

        return html
    except Exception as e:
        print(f"[IMG FIX] Error fixing broken img tags: {e}")
        return html


def inject_asset_src(html: str, asset_manifest: Dict[str, str] | None = None) -> str:
    """
    CRITICAL: Inject base64 src into <img data-asset-id="X"> tags.

    This is the FINAL STEP before streaming HTML to frontend.

    Rules:
    1. Find all <img data-asset-id="asset_X"> tags
    2. If asset_X is in asset_manifest → use base64 from manifest
    3. If asset_X not found → use placeholder PNG
    4. Convert: <img data-asset-id="X"> → <img src="data:image/png;base64,..." data-asset-id="X">
    5. ALL <img> tags MUST have src before going to frontend

    This prevents broken images in the browser.
    """

    if asset_manifest is None:
        asset_manifest = {}

    PLACEHOLDER_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="

    try:
        # Pattern: Find all <img> tags with data-asset-id
        img_pattern = r'<img\s+([^>]*)>'

        def inject_src_to_img(match):
            tag_content = match.group(1)

            # Check if it already has a src attribute
            if 'src=' in tag_content.lower():
                # Already has src, skip
                return match.group(0)

            # Extract data-asset-id attribute
            asset_id_pattern = r'data-asset-id=["\']?([^"\'>\s]+)["\']?'
            asset_id_match = re.search(asset_id_pattern, tag_content)

            if not asset_id_match:
                # No data-asset-id found, add placeholder
                return match.group(0).replace('>', f' src="{PLACEHOLDER_PNG}">', 1)

            # Extract asset ID
            asset_id = asset_id_match.group(1)

            # Look for base64 in manifest
            if asset_id in asset_manifest:
                base64_data = asset_manifest[asset_id]
            else:
                # Use placeholder if not found
                base64_data = PLACEHOLDER_PNG

            # Inject src into <img> tag
            # Find position to insert src (after <img )
            img_start = '<img '
            if tag_content.startswith(' '):
                # First attribute has leading space
                new_tag_content = f'src="{base64_data}" {tag_content.lstrip()}'
            else:
                new_tag_content = f'src="{base64_data}" {tag_content}'

            return f'<img {new_tag_content}>'

        html = re.sub(img_pattern, inject_src_to_img, html, flags=re.IGNORECASE)

        # Security check: ensure no <img> without src exist
        # This is protection against pipeline errors
        remaining_img_pattern = r'<img\s+([^>]*)>'
        remaining_matches = re.findall(remaining_img_pattern, html, re.IGNORECASE)

        img_without_src_count = 0
        for match in remaining_matches:
            if 'src=' not in match.lower():
                img_without_src_count += 1

        if img_without_src_count > 0:
            print(f"⚠️  [ASSET INJECTION] WARNING: {img_without_src_count} <img> tag(s) still missing src after injection!")
            # This should not happen, but if it does, apply emergency placeholder
            html = fix_broken_img_icons(html)

        return html
    except Exception as e:
        print(f"[ASSET INJECTION] Error injecting asset src: {e}")
        traceback.print_exc()
        return html

