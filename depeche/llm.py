import os
from openai import OpenAI

# Инициализируем OpenAI клиент
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Параметры из переменных окружения
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
OPENAI_TEMPERATURE = float(os.getenv("OPENAI_TEMPERATURE", "0.3"))
OPENAI_MAX_TOKENS = int(os.getenv("OPENAI_MAX_TOKENS", "200"))

# Системный промпт для генерации плана
SYSTEM_PROMPT = """Ты помогаешь составлять план статьи.

Задача:
Составь логичный, структурированный план статьи по заданной теме.

Требования:
- Только план, без абзацев
- Каждый пункт — отдельный раздел статьи
- 5–7 пунктов
- Без вводного текста
- Без пояснений
- Без подзаголовков внутри пунктов
- Формат: нумерованный список

НЕ пиши саму статью.
НЕ добавляй выводы.
НЕ добавляй примеры.

Ответь ТОЛЬКО планом."""


def generate_article_plan(topic: str) -> str:
    """
    Генерирует план статьи по заданной теме используя OpenAI API.

    Args:
        topic: Тема статьи

    Returns:
        Строка с планом статьи в виде нумерованного списка
    """
    try:
        message = client.messages.create(
            model=OPENAI_MODEL,
            max_tokens=OPENAI_MAX_TOKENS,
            temperature=OPENAI_TEMPERATURE,
            system=SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": f"Тема статьи: {topic}"
                }
            ]
        )

        # Extractразы контент из ответа
        plan = message.content[0].text

        return plan

    except Exception as e:
        # Если ошибка с API - возвращаем заглушку
        print(f"Ошибка при генерации плана: {e}")
        return f"Ошибка генерации плана для темы: {topic}"
