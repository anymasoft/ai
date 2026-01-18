import os
import logging
from openai import OpenAI
from prompts import PLAN_SYSTEM_PROMPT

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

        message = client.messages.create(
            model=OPENAI_MODEL,
            max_tokens=OPENAI_MAX_TOKENS,
            temperature=OPENAI_TEMPERATURE,
            system=PLAN_SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": f"Тема статьи: {topic}"
                }
            ]
        )

        # Извлекаем контент из ответа
        plan = message.content[0].text
        logger.info(f"План успешно сгенерирован для темы: {topic}")

        return plan

    except Exception as e:
        logger.error(f"Ошибка при генерации плана для темы '{topic}': {str(e)}", exc_info=True)
        raise

