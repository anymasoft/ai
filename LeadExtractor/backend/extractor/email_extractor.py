import re

EMAIL_REGEX = re.compile(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}')
EXCLUDE_PATTERNS = ['noreply', 'example', 'test', 'no-reply']

def extract_emails(text: str) -> list[str]:
    emails = EMAIL_REGEX.findall(text)
    filtered = []
    for email in emails:
        email_lower = email.lower()
        if any(pattern in email_lower for pattern in EXCLUDE_PATTERNS):
            continue
        if email_lower not in filtered:
            filtered.append(email_lower)
    return filtered
