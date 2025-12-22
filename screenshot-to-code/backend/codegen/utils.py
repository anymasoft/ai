import re


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


def fix_broken_img_icons(html: str) -> str:
    """
    Fix broken or missing <img> src attributes.

    Rules:
    1. If <img> has empty or missing src → use placeholder 1x1 PNG
    2. If <img src=""> → replace with valid data:image/png placeholder
    3. Ensure all <img> tags have valid src attributes

    This prevents broken image icons in the UI.
    """

    # Placeholder 1x1 transparent PNG (minimal, valid)
    PLACEHOLDER_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="

    try:
        # Fix <img> tags with empty src
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

        # Pattern 4: <img without src attribute at all
        # This is more complex - need to find img tags without src and add it
        def add_missing_src(match):
            tag = match.group(0)
            if 'src=' not in tag.lower():
                # Insert src before the closing >
                return tag.replace('>', f' src="{PLACEHOLDER_PNG}">', 1)
            return tag

        html = re.sub(
            r'<img\s+[^>]*?>',
            add_missing_src,
            html,
            flags=re.IGNORECASE
        )

        return html
    except Exception as e:
        print(f"[IMG FIX] Error fixing broken img tags: {e}")
        return html

