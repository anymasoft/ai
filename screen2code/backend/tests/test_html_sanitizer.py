"""
Tests for HTML sanitization and extraction logic.
🔥 Critical for ensuring valid HTML output even when model misbehaves.
"""

import pytest
from codegen.utils import extract_html_content, sanitize_html_output


class TestExtractHtmlContent:
    """Test HTML extraction from various malformed inputs."""

    def test_extract_complete_html(self):
        """Should extract valid <html>...</html> block."""
        text = """Some text before
<html>
<head><title>Test</title></head>
<body><p>Hello</p></body>
</html>
Some text after"""
        result = extract_html_content(text)
        assert "<html>" in result
        assert "</html>" in result
        assert "Some text before" not in result
        assert "Some text after" not in result

    def test_extract_body_only(self):
        """Should wrap <body>...</body> in full HTML."""
        text = """<body>
<h1>Title</h1>
<p>Content</p>
</body>"""
        result = extract_html_content(text)
        assert "<html>" in result
        assert "<head>" in result
        assert "<body>" in result
        assert "</body>" in result
        assert "</html>" in result

    def test_extract_partial_html(self):
        """Should wrap partial HTML in full structure."""
        text = """<div class="container">
<h1>Title</h1>
</div>"""
        result = extract_html_content(text)
        assert "<html>" in result
        assert "<body>" in result
        assert "<div" in result

    def test_extract_no_html_tags(self):
        """Should wrap plain text in full HTML."""
        text = "Just plain text content"
        result = extract_html_content(text)
        assert "<html>" in result
        assert "<body>" in result
        assert "</body>" in result
        assert "</html>" in result
        assert "plain text" in result


class TestSanitizeHtmlOutput:
    """Test HTML/CSS sanitization."""

    def test_remove_nested_html_tags(self):
        """Should remove <html> tags nested inside <body>."""
        html = """<html>
<body>
<html>
<h1>Test</h1>
</body>
</html>"""
        result = sanitize_html_output(html)
        # Count <html> tags - should have exactly 1
        html_count = result.count("<html")
        assert html_count == 1, f"Expected 1 <html> tag, got {html_count}"

    def test_close_unclosed_style_block(self):
        """Should close unclosed <style> tags."""
        html = """<html>
<head>
<style>
body { color: red; }
</head>
</html>"""
        result = sanitize_html_output(html)
        # Style should be closed
        assert "</style>" in result

    def test_fix_incomplete_css_rule(self):
        """Should fix incomplete CSS at end of style block."""
        html = """<html>
<head>
<style>
body { color: red; }
h1 { font-size: 24px; }
p { margin: 10px
</style>
</head>
</html>"""
        result = sanitize_html_output(html)
        # Should have properly closed all rules
        assert result.count("{") == result.count("}")

    def test_deduplicate_css_rules(self):
        """Should deduplicate exact duplicate CSS rule declarations."""
        html = """<html>
<head>
<style>
body { color: red; }
body { color: red; }
div { margin: 0; }
div { margin: 0; }
div { margin: 0; }
</style>
</head>
<body></body>
</html>"""
        result = sanitize_html_output(html)
        # Count "body {" - should appear only once
        body_count = result.count("body {")
        div_count = result.count("div {")
        assert body_count == 1, f"Expected 1 'body {{', got {body_count}"
        assert div_count == 1, f"Expected 1 'div {{', got {div_count}"

    def test_ensure_single_html_tag(self):
        """Should keep only one <html> opening tag."""
        html = """<html>
<html>
<body>
Content
</body>
</html>"""
        result = sanitize_html_output(html)
        html_count = result.count("<html")
        assert html_count == 1, f"Expected 1 <html> tag, got {html_count}"

    def test_ensure_single_body_tag(self):
        """Should keep only one <body> opening tag."""
        html = """<html>
<body>
<body>
Content
</body>
</html>"""
        result = sanitize_html_output(html)
        body_count = result.count("<body")
        assert body_count == 1, f"Expected 1 <body> tag, got {body_count}"

    def test_complete_malformed_html(self):
        """Should fix severely malformed HTML."""
        html = """<html>
<body>
<style>
.class1 { color: #fff; }
.class1 { color: #fff; }
.class2 { background: blue
<html>
<h1>Title</h1>
</body>
</html>"""
        result = sanitize_html_output(html)

        # Should have exactly 1 <html> and 1 <body>
        assert result.count("<html") == 1
        assert result.count("<body") == 1

        # Should have matching braces in CSS
        assert result.count("{") == result.count("}")

        # Should have closing </style>
        assert "</style>" in result


class TestIntegration:
    """Integration tests for extract + sanitize flow."""

    def test_extract_then_sanitize(self):
        """Should work correctly when chaining extract and sanitize."""
        raw_text = """Some preamble
<body>
<style>
div { color: red; }
div { color: red; }
h1 { font-weight: bold
<html>
<h1>Title</h1>
</body>
Trailing text"""

        # Extract
        extracted = extract_html_content(raw_text)

        # Sanitize
        sanitized = sanitize_html_output(extracted)

        # Verify result is valid
        assert "<html>" in sanitized
        assert "</html>" in sanitized
        assert "<body>" in sanitized
        assert "</body>" in sanitized
        assert sanitized.count("<html") == 1
        assert sanitized.count("<body") == 1
        assert sanitized.count("{") == sanitized.count("}")
