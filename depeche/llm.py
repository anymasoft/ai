import os
import logging
from openai import OpenAI
from prompts import PLAN_SYSTEM_PROMPT, EDIT_FULL_TEXT_SYSTEM_PROMPT, EDIT_FRAGMENT_SYSTEM_PROMPT

# Настраиваем логирование
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Инициализируем OpenAI клиент
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    logger.error("OPENAI_API_KEY не установлен в .env файле")
    raise ValueError("OPENAI_API_KEY не установлен")

client = OpenAI(api_key=api_key)

# Параметры из переменных окружения
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
OPENAI_TEMPERATURE = float(os.getenv("OPENAI_TEMPERATURE", "0.3"))
OPENAI_MAX_TOKENS = int(os.getenv("OPENAI_MAX_TOKENS", "200"))

logger.info(f"LLM конфиг: модель={OPENAI_MODEL}, temperature={OPENAI_TEMPERATURE}, max_tokens={OPENAI_MAX_TOKENS}")


def generate_article_plan(topic: str) -> str:
    """
    Генерирует план статьи по заданной теме используя OpenAI API.

    Args:
        topic: Тема статьи

    Returns:
        Строка с планом статьи в виде нумерованного списка

    Raises:
        Exception: При ошибке API OpenAI
    """
    try:
        logger.info(f"Генерирую план для темы: {topic}")

        response = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": PLAN_SYSTEM_PROMPT
                },
                {
                    "role": "user",
                    "content": f"Тема статьи: {topic}"
                }
            ],
            temperature=OPENAI_TEMPERATURE,
            max_tokens=OPENAI_MAX_TOKENS
        )

        # Извлекаем контент из ответа
        plan = response.choices[0].message.content
        logger.info(f"План успешно сгенерирован для темы: {topic}")
        logger.info(f"План (первые 100 символов): {plan[:100]}...")

        return plan

    except Exception as e:
        logger.error(f"Ошибка при генерации плана для темы '{topic}': {str(e)}", exc_info=True)
        raise


def edit_full_text(text: str, instruction: str) -> str:
    """
    РЕЖИМ 2: Редактирование ВСЕГО текста статьи.

    Применяет инструкцию к полному тексту статьи.

    Args:
        text: Полный текст статьи
        instruction: Инструкция редактирования (например, "Сделай текст более научным")

    Returns:
        Полностью отредактированный текст статьи

    Raises:
        Exception: При ошибке API OpenAI
    """
    try:
        logger.info(f"[РЕЖИМ 2] Редактирование всего текста. Инструкция: {instruction[:50]}...")

        response = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": EDIT_FULL_TEXT_SYSTEM_PROMPT
                },
                {
                    "role": "user",
                    "content": f"Инструкция: {instruction}\n\nТекст для редактирования:\n{text}"
                }
            ],
            temperature=OPENAI_TEMPERATURE,
            max_tokens=OPENAI_MAX_TOKENS * 2  # Больше токенов для редактирования
        )

        edited_text = response.choices[0].message.content
        logger.info(f"[РЕЖИМ 2] Текст успешно отредактирован ({len(edited_text)} символов)")

        return edited_text

    except Exception as e:
        logger.error(f"[РЕЖИМ 2] Ошибка при редактировании текста: {str(e)}", exc_info=True)
        raise


def edit_fragment(before_context: str, fragment: str, after_context: str, instruction: str) -> str:
    """
    РЕЖИМ 3: Редактирование ВЫДЕЛЕННОГО ФРАГМЕНТА.

    Применяет инструкцию только к выделенному фрагменту, сохраняя контекст.

    Args:
        before_context: Абзац ДО фрагмента (для контекста)
        fragment: ВЫДЕЛЕННЫЙ фрагмент для редактирования
        after_context: Абзац ПОСЛЕ фрагмента (для контекста)
        instruction: Инструкция редактирования

    Returns:
        ТОЛЬКО отредактированный фрагмент (без контекста)

    Raises:
        Exception: При ошибке API OpenAI
    """
    try:
        logger.info(f"[РЕЖИМ 3] Редактирование фрагмента. Инструкция: {instruction[:50]}...")
        logger.info(f"[РЕЖИМ 3] Размер фрагмента: {len(fragment)} символов")

        full_text = f"""ПРЕДЫДУЩИЙ АБЗАЦ (контекст):
{before_context}

ФРАГМЕНТ ДЛЯ РЕДАКТИРОВАНИЯ:
[ФРАГМЕНТ_НАЧАЛО]
{fragment}
[ФРАГМЕНТ_КОНЕЦ]

СЛЕДУЮЩИЙ АБЗАЦ (контекст):
{after_context}"""

        response = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": EDIT_FRAGMENT_SYSTEM_PROMPT
                },
                {
                    "role": "user",
                    "content": f"Инструкция: {instruction}\n\n{full_text}"
                }
            ],
            temperature=OPENAI_TEMPERATURE,
            max_tokens=OPENAI_MAX_TOKENS
        )

        edited_fragment = response.choices[0].message.content
        logger.info(f"[РЕЖИМ 3] Фрагмент успешно отредактирован ({len(edited_fragment)} символов)")

        return edited_fragment

    except Exception as e:
        logger.error(f"[РЕЖИМ 3] Ошибка при редактировании фрагмента: {str(e)}", exc_info=True)
        raise

