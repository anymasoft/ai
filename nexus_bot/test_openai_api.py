#!/usr/bin/env python3
"""
Тестирование обновлённого OpenAI API в nexus_bot
Проверяет что оба компонента работают правильно
"""

import os
import asyncio
import sys

# Добавляем корневую папку в path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core.prompts import prompt_enhancer
from core.director import camera_director


async def test_prompt_enhancer():
    """Тестируем Smart Prompt Enhancer"""
    print("\n" + "="*60)
    print("🧪 ТЕСТ 1: Smart Prompt Enhancer")
    print("="*60)

    # Тестовый промпт на русском
    test_prompt = """Красивый закат над горами с полусогнутыми облаками.
    Камера медленно движется влево, открывая долину внизу.
    Цвета становятся более насыщенными к концу."""

    print(f"\n📝 Input (русский):\n{test_prompt}\n")

    try:
        enhanced = await prompt_enhancer.enhance_prompt(test_prompt, mode="prompt")
        print(f"✅ Output (enhanced):\n{enhanced}\n")
        return True
    except Exception as e:
        print(f"❌ ERROR: {str(e)}\n")
        return False


async def test_camera_director():
    """Тестируем Camera Director"""
    print("\n" + "="*60)
    print("🧪 ТЕСТ 2: Camera Director")
    print("="*60)

    # Тестовый улучшенный промпт (с camera directions)
    test_prompt = """Beautiful sunset over mountains with half-bent clouds in cinematic 4K quality.
    Camera slowly moves left, revealing the valley below.
    Colors become more saturated towards the end.

    [Pan left]
    [Push in]"""

    print(f"\n📝 Input (cinematic prompt with camera):\n{test_prompt}\n")

    try:
        compiled = await camera_director.compile(test_prompt)
        print(f"✅ Output (compiled):\n{compiled}\n")
        return True
    except Exception as e:
        print(f"❌ ERROR: {str(e)}\n")
        return False


async def test_with_preserve():
    """Тестируем с PRESERVE constraints"""
    print("\n" + "="*60)
    print("🧪 ТЕСТ 3: Smart Prompt Enhancer с PRESERVE")
    print("="*60)

    # Промпт с PRESERVE (e-commerce сценарий)
    test_prompt = """Рубашка должна оставаться неподвижной в центре.
    Свет меняется - от тёплого к холодному.
    PRESERVE: product, background, price"""

    print(f"\n📝 Input (с PRESERVE):\n{test_prompt}\n")

    try:
        enhanced = await prompt_enhancer.enhance_prompt(test_prompt, mode="prompt")
        print(f"✅ Output (enhanced with PRESERVE):\n{enhanced}\n")

        # Теперь тестируем camera director с PRESERVE
        compiled = await camera_director.compile(enhanced)
        print(f"\n✅ After Camera Director (должен быть ТОЛЬКО [Static shot]):\n{compiled}\n")
        return True
    except Exception as e:
        print(f"❌ ERROR: {str(e)}\n")
        return False


async def main():
    """Главная функция тестирования"""
    print("\n🚀 BEEM VIDEO ENGINE - OPENAI API TEST")
    print("Проверка обновленного API (openai>=1.0.0)")

    # Проверяем что есть API ключ
    if not os.getenv("OPENAI_API_KEY"):
        print("\n❌ ОШИБКА: OPENAI_API_KEY не установлен!")
        print("   Добавьте в .env: OPENAI_API_KEY=sk-...")
        return False

    print("✅ OPENAI_API_KEY найден\n")

    # Запускаем тесты
    results = []

    try:
        results.append(("Prompt Enhancer", await test_prompt_enhancer()))
    except Exception as e:
        print(f"❌ ОШИБКА в test_prompt_enhancer: {str(e)}")
        results.append(("Prompt Enhancer", False))

    try:
        results.append(("Camera Director", await test_camera_director()))
    except Exception as e:
        print(f"❌ ОШИБКА в test_camera_director: {str(e)}")
        results.append(("Camera Director", False))

    try:
        results.append(("PRESERVE Constraints", await test_with_preserve()))
    except Exception as e:
        print(f"❌ ОШИБКА в test_with_preserve: {str(e)}")
        results.append(("PRESERVE Constraints", False))

    # Результаты
    print("\n" + "="*60)
    print("📊 РЕЗУЛЬТАТЫ ТЕСТОВ")
    print("="*60)

    for test_name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} - {test_name}")

    all_passed = all(passed for _, passed in results)

    print("="*60)
    if all_passed:
        print("✅ ВСЕ ТЕСТЫ ПРОЙДЕНЫ! OpenAI API работает правильно.")
    else:
        print("❌ НЕКОТОРЫЕ ТЕСТЫ ПРОВАЛЕНЫ. Проверьте логи выше.")

    return all_passed


if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)
