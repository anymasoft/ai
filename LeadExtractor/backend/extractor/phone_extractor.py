import re
import phonenumbers

PHONE_REGEX = re.compile(
    r'(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{3,4}',
    re.VERBOSE
)

def extract_phones(text: str) -> list[str]:
    phones = []
    for match in PHONE_REGEX.finditer(text):
        try:
            raw_phone = match.group().strip()
            parsed = phonenumbers.parse(raw_phone, None)
            if phonenumbers.is_valid_number(parsed):
                formatted = phonenumbers.format_number(
                    parsed, phonenumbers.PhoneNumberFormat.E164
                )
                if formatted not in phones:
                    phones.append(formatted)
        except (phonenumbers.NumberParseException, ValueError):
            continue
    return phones
