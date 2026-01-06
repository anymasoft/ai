#!/usr/bin/env python3
"""
Скрипт для проверки конфигурации YooKassa
"""

import os

# Попытка загрузить .env файл
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    # Если dotenv не установлена, прочитаем .env вручную
    if os.path.exists('.env'):
        with open('.env') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#'):
                    key, _, value = line.partition('=')
                    os.environ[key.strip()] = value.strip()

print("=" * 70)
print("YooKassa Configuration Check")
print("=" * 70)

YOOKASSA_SHOP_ID = os.environ.get("YOOKASSA_SHOP_ID", "")
YOOKASSA_API_KEY = os.environ.get("YOOKASSA_API_KEY", "")

print()
print("📋 СТАТУС КОНФИГУРАЦИИ:")
print()

if YOOKASSA_SHOP_ID:
    print(f"✓ YOOKASSA_SHOP_ID: {YOOKASSA_SHOP_ID[:10]}... (установлен)")
else:
    print("✗ YOOKASSA_SHOP_ID: НЕ УСТАНОВЛЕН")

if YOOKASSA_API_KEY:
    print(f"✓ YOOKASSA_API_KEY: {YOOKASSA_API_KEY[:10]}... (установлен)")
else:
    print("✗ YOOKASSA_API_KEY: НЕ УСТАНОВЛЕН")

print()

if YOOKASSA_SHOP_ID and YOOKASSA_API_KEY:
    print("✓ ВСЕ ПЕРЕМЕННЫЕ УСТАНОВЛЕНЫ - ГОТОВО К РАБОТЕ!")
    print()
    print("Проверка базовой валидности:")
    if len(YOOKASSA_SHOP_ID) >= 3:
        print(f"  ✓ SHOP_ID выглядит корректно (длина: {len(YOOKASSA_SHOP_ID)})")
    else:
        print(f"  ✗ SHOP_ID слишком короткий (длина: {len(YOOKASSA_SHOP_ID)})")

    if len(YOOKASSA_API_KEY) >= 10:
        print(f"  ✓ API_KEY выглядит корректно (длина: {len(YOOKASSA_API_KEY)})")
    else:
        print(f"  ✗ API_KEY слишком короткий (длина: {len(YOOKASSA_API_KEY)})")
else:
    print("✗ ОШИБКА: Отсутствуют переменные окружения")
    print()
    print("Что нужно сделать:")
    print("  1. Создайте файл .env в папке backend/")
    print("  2. Добавьте следующие строки:")
    print()
    print("     YOOKASSA_SHOP_ID=ваш_shop_id")
    print("     YOOKASSA_API_KEY=ваш_api_key")
    print()
    print("  3. Получить значения можно в YooKassa Dashboard:")
    print("     https://yookassa.ru/my")

print()
print("=" * 70)
