import re


def extract_html_content(text: str):
    # Use regex to find content within <html> tags and include the tags themselves
    match = re.search(r"(<html.*?>.*?</html>)", text, re.DOTALL)
    if match:
        return match.group(1)
    else:
        # Otherwise, we just send the previous HTML over
        print(
            "[HTML Extraction] No <html> tags found in the generated content: " + text
        )
        return text


def validate_react_output(html: str) -> bool:
    """
    Validate that React output contains required markers for a real React app.

    Required:
    - "function App" OR "const App"
    - "ReactDOM.createRoot"
    - ".render(<App" OR ".render( <App"

    Returns True if all requirements are met, False otherwise.
    """
    has_app_component = ("function App" in html) or ("const App" in html)
    has_create_root = "ReactDOM.createRoot" in html
    has_render = (".render(<App" in html) or (".render( <App" in html)

    is_valid = has_app_component and has_create_root and has_render

    if not is_valid:
        print(f"[REACT VALIDATION] Failed - has_app_component: {has_app_component}, has_create_root: {has_create_root}, has_render: {has_render}")
    else:
        print("[REACT VALIDATION] Passed")

    return is_valid


def validate_vue_output(html: str) -> bool:
    """
    Validate that Vue output contains required markers for a real Vue 3 app.

    Required:
    - "createApp(" AND ".mount('#app')" (or '.mount("#app")' or ".mount('#app')")
    - "data()" OR "setup()"
    - At least one Vue binding: "{{" or "v-" or ":class" or "@click"

    Returns True if all requirements are met, False otherwise.
    """
    has_create_app = "createApp(" in html
    has_mount = (".mount('#app')" in html) or ('.mount("#app")' in html) or (".mount('#app')" in html)
    has_state = ("data()" in html) or ("setup()" in html)
    has_binding = ("{{" in html) or ("v-" in html) or (":class" in html) or ("@click" in html)

    is_valid = has_create_app and has_mount and has_state and has_binding

    if not is_valid:
        print(f"[VUE VALIDATION] Failed - has_create_app: {has_create_app}, has_mount: {has_mount}, has_state: {has_state}, has_binding: {has_binding}")
    else:
        print("[VUE VALIDATION] Passed")

    return is_valid
