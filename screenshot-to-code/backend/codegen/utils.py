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
