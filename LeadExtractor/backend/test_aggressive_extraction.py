#!/usr/bin/env python3
"""
TEST: Aggressive Phone Extraction (v3.0)

Проверяет что:
1. Russian pattern находит номера без явного +7
2. Digit-only pattern находит номера из 10-11 цифр
3. Wide regex собирает все кандидаты
"""

import re


def test_russian_pattern():
    """Тест специализированного regex для русских номеров"""

    pattern = r'(?:\+7|8)?[\s\-\(\)]*\d{3}[\s\-\(\)]*\d{3}[\s\-\(\)]*\d{2}[\s\-\(\)]*\d{2}'

    test_cases = [
        {
            "text": "Звоните: 812 250-62-10",
            "should_find": True,
            "description": "Номер с пробелами без +7"
        },
        {
            "text": "Телефон: 8 (812) 250-62-10",
            "should_find": True,
            "description": "Номер с скобками и пробелами"
        },
        {
            "text": "Call +7812250-6210",
            "should_find": True,
            "description": "Номер с +7 и дефисами"
        },
        {
            "text": "8122506210",
            "should_find": True,
            "description": "Номер без разделителей (10 цифр)"
        },
        {
            "text": "Стоимость: 1 710 000 рублей",
            "should_find": True,  # WILL find, but LLM will filter
            "description": "Цена (false positive - но LLM отфильтрует)"
        },
    ]

    print("\n" + "=" * 70)
    print("TEST 1: Russian Phone Pattern")
    print("=" * 70)

    for i, test in enumerate(test_cases, 1):
        matches = re.findall(pattern, test["text"])
        found = len(matches) > 0
        status = "✅ PASS" if found == test["should_find"] else "❌ FAIL"

        print(f"\n{i}. {test['description']}")
        print(f"   Text: {test['text']}")
        print(f"   Expected: {test['should_find']}, Got: {found}")
        if matches:
            print(f"   Matches: {matches}")
        print(f"   {status}")

    print("\n" + "=" * 70)


def test_digit_pattern():
    """Тест digit-only detection (10-11 цифр подряд)"""

    pattern = r'\b\d{10,11}\b'

    test_cases = [
        {
            "text": "Позвоните: 7812250621 для справок",
            "should_find": True,
            "description": "11-digit число ( 7812250621)"
        },
        {
            "text": "ID: 79123456789 не номер",
            "should_find": True,  # WILL find, but LLM will filter
            "description": "11-digit с 79 (может быть номер)"
        },
        {
            "text": "Счет 1234567890 оплачен",
            "should_find": True,  # WILL find, LLM фильтрует
            "description": "10-digit число (может быть ID)"
        },
        {
            "text": "123 456 7890",
            "should_find": False,
            "description": "Числа с пробелами (не граница слова)"
        },
    ]

    print("\n" + "=" * 70)
    print("TEST 2: Digit-Only Pattern (10-11 digits)")
    print("=" * 70)

    for i, test in enumerate(test_cases, 1):
        matches = re.findall(pattern, test["text"])
        found = len(matches) > 0
        status = "✅ PASS" if found == test["should_find"] else "❌ FAIL"

        print(f"\n{i}. {test['description']}")
        print(f"   Text: {test['text']}")
        print(f"   Expected: {test['should_find']}, Got: {found}")
        if matches:
            print(f"   Matches: {matches}")
        print(f"   {status}")

    print("\n" + "=" * 70)


def test_wide_regex():
    """Тест wide regex (текущий)"""

    pattern = r'[\+]?[\d\(\)\s\-\.]{7,}'

    test_cases = [
        {
            "text": "+7 (812) 250-62-10",
            "description": "Standard format"
        },
        {
            "text": "812250-6210",
            "description": "Without prefix"
        },
        {
            "text": "(812) 250 62 10",
            "description": "Only parentheses"
        },
        {
            "text": "1 710 000",
            "description": "Price (false positive)"
        },
    ]

    print("\n" + "=" * 70)
    print("TEST 3: Wide Regex (Current)")
    print("=" * 70)

    for i, test in enumerate(test_cases, 1):
        matches = re.findall(pattern, test["text"])
        print(f"\n{i}. {test['description']}")
        print(f"   Text: {test['text']}")
        print(f"   Matches: {matches if matches else 'NONE'}")

    print("\n" + "=" * 70)


def test_combined_extraction():
    """Full extraction simulation"""

    text = """
    Компания ООО "Test"
    Адрес: Москва, ул. Примерная 123
    Телефоны:
    - Основной: 8 (812) 250-62-10
    - Факс: 7812 2505555
    - Мобильный: 79123456789
    - Чистые цифры: 8122506210
    Email: info@test.com
    Стоимость: 1 710 000 рублей
    Реквизиты: 123456789012
    """

    russian_pattern = r'(?:\+7|8)?[\s\-\(\)]*\d{3}[\s\-\(\)]*\d{3}[\s\-\(\)]*\d{2}[\s\-\(\)]*\d{2}'
    digit_pattern = r'\b\d{10,11}\b'
    wide_pattern = r'[\+]?[\d\(\)\s\-\.]{7,}'

    print("\n" + "=" * 70)
    print("TEST 4: Combined Extraction (Simulated)")
    print("=" * 70)

    print(f"\nText:\n{text}\n")

    print("Russian Pattern Matches:")
    russian_matches = re.findall(russian_pattern, text)
    for m in russian_matches:
        print(f"  ✓ {m}")

    print(f"\nDigit Pattern Matches:")
    digit_matches = re.findall(digit_pattern, text)
    for m in digit_matches:
        print(f"  ✓ {m}")

    print(f"\nWide Pattern Matches:")
    wide_matches = re.findall(wide_pattern, text)
    for m in wide_matches[:10]:  # Limit output
        print(f"  ✓ {m}")
    if len(wide_matches) > 10:
        print(f"  ... and {len(wide_matches) - 10} more")

    all_candidates = set()
    all_candidates.update(russian_matches)
    all_candidates.update(digit_matches)
    all_candidates.update(wide_matches)

    print(f"\n📊 Total Unique Candidates: {len(all_candidates)}")
    print("   (Note: Some are false positives - LLM will filter)")

    print("\n" + "=" * 70)


if __name__ == "__main__":
    try:
        print("\n🚀 TESTING AGGRESSIVE PHONE EXTRACTION (v3.0)")
        print("=" * 70)

        test_russian_pattern()
        test_digit_pattern()
        test_wide_regex()
        test_combined_extraction()

        print("\n✅ ALL TESTS COMPLETED")
        print("=" * 70)

    except Exception as e:
        print(f"\n❌ TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
