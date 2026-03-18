#!/usr/bin/env python3
"""
TEST: LLM Integration in crawl4ai_client.py

Проверяет что:
1. phone_final_validator импортируется и работает
2. URL-decode работает в _clean_phone_extension()
3. LLM валидация фильтрует мусор
"""

import asyncio
from phone_final_validator import PhoneFinalValidator


def test_url_decode():
    """Тест URL-декодирования в _clean_phone_extension()"""
    from crawl4ai_client import Crawl4AIClient

    client = Crawl4AIClient()

    # Примеры URL-encoded телефонов
    test_cases = [
        {
            "input": "%2B7%20(812)%20250-62-10%20",
            "expected": "+7 (812) 250-62-10",
            "description": "URL-encoded tel: link"
        },
        {
            "input": "+7 (812) 250-62-10, доб. 123",
            "expected": "+7 (812) 250-62-10",
            "description": "Tel с расширением"
        },
        {
            "input": "tel:%2B7%20(812)%20250-62-10%20",
            "expected": "+7 (812) 250-62-10",
            "description": "Tel: протокол с URL-encoding"
        },
    ]

    print("\n" + "=" * 70)
    print("TEST 1: URL-Decode в _clean_phone_extension()")
    print("=" * 70)

    for i, test in enumerate(test_cases, 1):
        result = client._clean_phone_extension(test["input"])
        status = "✅ PASS" if result == test["expected"] else "❌ FAIL"
        print(f"\n{i}. {test['description']}")
        print(f"   Input: {test['input']}")
        print(f"   Expected: {test['expected']}")
        print(f"   Got: {result}")
        print(f"   {status}")

    print("\n" + "=" * 70)


def test_phone_normalizer():
    """Тест phone_normalizer на нормализацию"""
    from phone_normalizer import PhoneNormalizer

    normalizer = PhoneNormalizer()

    test_cases = [
        {
            "input": "+7 (812) 250-62-10",
            "expected": "+7 (812) 250-62-10",
            "description": "Правильный номер"
        },
        {
            "input": "+7%20(812)%20250-62-10%20",
            "expected": "+7 (812) 250-62-10",
            "description": "URL-encoded номер"
        },
        {
            "input": "8 (812) 250-62-10",
            "expected": "+7 (812) 250-62-10",
            "description": "Домашний формат (8)"
        },
    ]

    print("\n" + "=" * 70)
    print("TEST 2: PhoneNormalizer")
    print("=" * 70)

    for i, test in enumerate(test_cases, 1):
        result = normalizer.normalize_phone(test["input"])
        status = "✅ PASS" if result == test["expected"] else "❌ FAIL"
        print(f"\n{i}. {test['description']}")
        print(f"   Input: {test['input']}")
        print(f"   Expected: {test['expected']}")
        print(f"   Got: {result}")
        print(f"   {status}")

    print("\n" + "=" * 70)


def test_llm_validator():
    """Тест LLM validator на фильтрацию мусора"""

    validator = PhoneFinalValidator(use_llm=False)  # Без LLM (только phonenumbers)

    # Примеры как они приходят из extraction
    raw_phones = [
        {"phone": "+7 (812) 250-62-10", "source_page": "https://is1c.ru"},
        {"phone": "+7%20(812)%20250-62-10%20", "source_page": "https://is1c.ru"},
        {"phone": "+7", "source_page": "https://is1c.ru"},
        {"phone": "1997-2026", "source_page": "https://is1c.ru"},
        {"phone": "01.01.2024", "source_page": "https://is1c.ru"},
        {"phone": "+7 (383) 209-21-27", "source_page": "https://is1c.ru/contact"},
        {"phone": "(812) 250-62-10", "source_page": "https://is1c.ru"},
        {"phone": "132232434", "source_page": "https://is1c.ru"},
    ]

    print("\n" + "=" * 70)
    print("TEST 3: PhoneFinalValidator (phonenumbers mode)")
    print("=" * 70)
    print(f"\nINPUT: {len(raw_phones)} телефонов (с мусором)")
    for p in raw_phones:
        print(f"  - {p['phone']}")

    result = validator.validate_phones(raw_phones, page_url="https://is1c.ru")

    print(f"\nOUTPUT: {len(result)} валидных телефонов")
    for p in result:
        print(f"  ✅ {p['phone']} ({p['method']})")

    print(f"\n📊 Статистика:")
    print(f"  Входных номеров: {len(raw_phones)}")
    print(f"  Валидных номеров: {len(result)}")
    print(f"  Отфильтровано: {len(raw_phones) - len(result)}")
    print(f"  Точность фильтрации: {(len(result) / len(raw_phones) * 100):.1f}%")

    print("\n" + "=" * 70)


def test_full_pipeline():
    """Интеграционный тест: от raw phones к валидным"""

    print("\n" + "=" * 70)
    print("TEST 4: Full Pipeline (extract → normalize → validate)")
    print("=" * 70)

    from crawl4ai_client import Crawl4AIClient
    from phone_normalizer import PhoneNormalizer
    from phone_final_validator import PhoneFinalValidator

    client = Crawl4AIClient()
    normalizer = PhoneNormalizer()
    validator = PhoneFinalValidator(use_llm=False)

    # Примеры как они приходят из HTML
    raw_html_phones = [
        "+7 (812) 250-62-10",
        "%2B7%20(812)%20250-62-10%20",  # URL-encoded
        "+7",  # Слишком короткий
        "+7 (383) 209-21-27",
        "1997-2026",  # Дата
        "132232434",  # Без разделителей
    ]

    print(f"\nSHAP 1: Raw extraction")
    print(f"  Found {len(raw_html_phones)} candidates")
    for p in raw_html_phones:
        print(f"  - {p}")

    # STEP 2: Clean extensions
    print(f"\nSTEP 2: Clean extensions (_clean_phone_extension)")
    cleaned = []
    for phone in raw_html_phones:
        cleaned_phone = client._clean_phone_extension(phone)
        if cleaned_phone:
            cleaned.append(cleaned_phone)
            print(f"  ✅ {phone[:30]:<30} → {cleaned_phone}")

    print(f"  Result: {len(cleaned)} phones after cleaning")

    # STEP 3: Normalize
    print(f"\nSTEP 3: Normalize (PhoneNormalizer)")
    normalized = []
    for phone in cleaned:
        norm = normalizer.normalize_phone(phone)
        if norm:
            normalized.append({"phone": norm, "source_page": "https://is1c.ru"})
            print(f"  ✅ {phone:<30} → {norm}")

    print(f"  Result: {len(normalized)} phones after normalization")

    # STEP 4: Final LLM validation
    print(f"\nSTEP 4: Final LLM Validation (PhoneFinalValidator)")
    validated = validator.validate_phones(
        [{"phone": p["phone"], "source_page": p["source_page"]} for p in normalized],
        page_url="https://is1c.ru"
    )

    print(f"  Result: {len(validated)} phones after validation")
    for p in validated:
        print(f"  ✅ {p['phone']} ({p['method']})")

    print(f"\n📊 Pipeline Summary:")
    print(f"  Raw phones: {len(raw_html_phones)}")
    print(f"  After cleaning: {len(cleaned)}")
    print(f"  After normalization: {len(normalized)}")
    print(f"  After LLM validation: {len(validated)}")
    print(f"  Final success rate: {(len(validated) / len(raw_html_phones) * 100):.1f}%")

    print("\n" + "=" * 70)


if __name__ == "__main__":
    try:
        print("\n🚀 TESTING LLM INTEGRATION IN CRAWL4AI_CLIENT")
        print("=" * 70)

        test_url_decode()
        test_phone_normalizer()
        test_llm_validator()
        test_full_pipeline()

        print("\n✅ ALL TESTS COMPLETED")
        print("=" * 70)

    except Exception as e:
        print(f"\n❌ TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
