import os
import logging
import re
import requests
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
from openai import OpenAI
from prompts import (
    PLAN_SYSTEM_PROMPT,
    EDIT_FULL_TEXT_SYSTEM_PROMPT,
    EDIT_FRAGMENT_SYSTEM_PROMPT,
    YOUTUBE_TRANSCRIPT_SYSTEM_PROMPT,
    ENHANCE_FRAGMENT_SYSTEM_PROMPT,
    ENHANCE_FULL_SYSTEM_PROMPT,
    ENHANCE_PLAN_SYSTEM_PROMPT,
    HUMANIZE_SYSTEM_PROMPT
)

# Настраиваем логирование
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Инициализируем OpenAI клиент
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    logger.error("OPENAI_API_KEY не установлен в .env файле")
    raise ValueError("OPENAI_API_KEY не установлен")

client = OpenAI(api_key=api_key)

# === ПАРАМЕТРЫ ИЗ ENV (с разумными дефолтами) ===
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
OPENAI_TEMPERATURE = float(os.getenv("OPENAI_TEMPERATURE", "0.3"))

# Лимиты токенов по режимам
PLAN_MAX_TOKENS = int(os.getenv("PLAN_MAX_TOKENS", "300"))
FRAGMENT_MAX_TOKENS = int(os.getenv("FRAGMENT_MAX_TOKENS", "1200"))
FULLTEXT_MAX_TOKENS = int(os.getenv("FULLTEXT_MAX_TOKENS", "2400"))

# Retry при truncation
RETRY_ON_TRUNCATION = int(os.getenv("RETRY_ON_TRUNCATION", "1"))
RETRY_TOKEN_MULTIPLIER = int(os.getenv("RETRY_TOKEN_MULTIPLIER", "2"))

# Chunking параметры
CHUNK_TARGET_CHARS = int(os.getenv("CHUNK_TARGET_CHARS", "1200"))
CHUNK_MAX_CHARS = int(os.getenv("CHUNK_MAX_CHARS", "2500"))
CONTEXT_WINDOW_CHARS = int(os.getenv("CONTEXT_WINDOW_CHARS", "400"))

DEBUG_CHUNKING = os.getenv("DEBUG_CHUNKING", "true").lower() == "true"

# === СТРУКТУРНАЯ ВАЛИДАЦИЯ (для режима edit-fragment) ===
# Количество retry'ей при неправильной структуре (например, не совпадает количество абзацев)
STRUCTURE_VALIDATION_RETRIES = int(os.getenv("STRUCTURE_VALIDATION_RETRIES", "1"))
# Включить пост-валидацию структуры (подсчёт абзацев) для режима fragment
ENABLE_STRUCTURE_VALIDATION = os.getenv("ENABLE_STRUCTURE_VALIDATION", "true").lower() == "true"
# Максимальное увеличение токенов при структурном retry (обычно меньше, чем truncation retry)
STRUCTURE_RETRY_TOKEN_MULTIPLIER = float(os.getenv("STRUCTURE_RETRY_TOKEN_MULTIPLIER", "1.3"))

# === ПАРАМЕТРЫ ДЛЯ РЕЖИМА УСИЛЕНИЯ (ENHANCE) ===
ENHANCE_TEMPERATURE = float(os.getenv("ENHANCE_TEMPERATURE", "0.7"))  # Выше чем стандартные 0.3 для большей креативности
ENHANCE_FRAGMENT_MAX_TOKENS = int(os.getenv("ENHANCE_FRAGMENT_MAX_TOKENS", "800"))
ENHANCE_FULL_MAX_TOKENS = int(os.getenv("ENHANCE_FULL_MAX_TOKENS", "2500"))
ENHANCE_PLAN_MAX_TOKENS = int(os.getenv("ENHANCE_PLAN_MAX_TOKENS", "500"))

logger.info(
    f"[LLM CONFIG] model={OPENAI_MODEL}, temp={OPENAI_TEMPERATURE}, "
    f"plan_tokens={PLAN_MAX_TOKENS}, fragment_tokens={FRAGMENT_MAX_TOKENS}, "
    f"fulltext_tokens={FULLTEXT_MAX_TOKENS}, retry={RETRY_ON_TRUNCATION}, "
    f"chunk_target={CHUNK_TARGET_CHARS}, chunk_max={CHUNK_MAX_CHARS}, "
    f"structure_validation={ENABLE_STRUCTURE_VALIDATION}, "
    f"structure_retries={STRUCTURE_VALIDATION_RETRIES}"
)


# === СТРУКТУРЫ ДАННЫХ ===

@dataclass
class LLMUsage:
    """Информация об использовании токенов"""
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int


@dataclass
class LLMResponse:
    """Структурированный ответ от LLM с метаданными"""
    text: str
    finish_reason: str  # "stop", "length", "function_call", "content_filter"
    usage: Optional[LLMUsage] = None
    truncated: bool = False  # True если finish_reason == "length"


@dataclass
class ChunkInfo:
    """Информация о разбиении на чанки"""
    chunks_count: int
    strategy: str  # "single", "paragraph", "sentence"
    total_chars: int
    processing_time_seconds: float = 0.0


# === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===

def _extract_usage(response) -> LLMUsage:
    """Извлечь информацию об использовании токенов из ответа OpenAI"""
    if hasattr(response, 'usage'):
        return LLMUsage(
            prompt_tokens=response.usage.prompt_tokens,
            completion_tokens=response.usage.completion_tokens,
            total_tokens=response.usage.total_tokens
        )
    return LLMUsage(prompt_tokens=0, completion_tokens=0, total_tokens=0)


def _call_openai(messages: List[Dict], max_tokens: int, mode: str = "generic") -> LLMResponse:
    """
    Вспомогательная функция для вызова OpenAI API.

    Возвращает LLMResponse с автоматической обработкой finish_reason.

    Args:
        messages: Список сообщений для API
        max_tokens: Максимум токенов в ответе
        mode: Режим (для логирования): "plan", "fragment", "fulltext", "chunk"

    Returns:
        LLMResponse с текстом, finish_reason и usage
    """
    try:
        logger.debug(f"[LLM CALL] mode={mode}, max_tokens={max_tokens}, messages_count={len(messages)}")

        response = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=messages,
            temperature=OPENAI_TEMPERATURE,
            max_tokens=max_tokens
        )

        text = response.choices[0].message.content or ""
        finish_reason = response.choices[0].finish_reason or "unknown"
        usage = _extract_usage(response)
        truncated = finish_reason == "length"

        logger.info(
            f"[LLM RESPONSE] mode={mode}, finish_reason={finish_reason}, "
            f"text_len={len(text)}, usage={usage.total_tokens}tokens, "
            f"truncated={truncated}"
        )

        if truncated:
            logger.warning(
                f"[LLM TRUNCATED] mode={mode} - ответ был обрезан! "
                f"completion_tokens={usage.completion_tokens}, max_tokens={max_tokens}"
            )

        return LLMResponse(
            text=text,
            finish_reason=finish_reason,
            usage=usage,
            truncated=truncated
        )

    except Exception as e:
        logger.error(f"[LLM ERROR] mode={mode}: {str(e)}", exc_info=True)
        raise


def _call_openai_with_temperature(messages: List[Dict], max_tokens: int, temperature: float, mode: str = "generic") -> LLMResponse:
    """
    Вспомогательная функция для вызова OpenAI API с произвольной температурой.

    Используется для режимов, где нужна повышенная креативность (например, усиление).

    Args:
        messages: Список сообщений для API
        max_tokens: Максимум токенов в ответе
        temperature: Температура (обычно 0.7 для усиления вместо стандартных 0.3)
        mode: Режим (для логирования)

    Returns:
        LLMResponse с текстом, finish_reason и usage
    """
    try:
        logger.debug(f"[LLM CALL] mode={mode}, max_tokens={max_tokens}, temperature={temperature}, messages_count={len(messages)}")

        response = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens
        )

        text = response.choices[0].message.content or ""
        finish_reason = response.choices[0].finish_reason or "unknown"
        usage = _extract_usage(response)
        truncated = finish_reason == "length"

        logger.info(
            f"[LLM RESPONSE] mode={mode}, finish_reason={finish_reason}, "
            f"text_len={len(text)}, usage={usage.total_tokens}tokens, "
            f"truncated={truncated}"
        )

        if truncated:
            logger.warning(
                f"[LLM TRUNCATED] mode={mode} - ответ был обрезан! "
                f"completion_tokens={usage.completion_tokens}, max_tokens={max_tokens}"
            )

        return LLMResponse(
            text=text,
            finish_reason=finish_reason,
            usage=usage,
            truncated=truncated
        )

    except Exception as e:
        logger.error(f"[LLM ERROR] mode={mode}: {str(e)}", exc_info=True)
        raise


def _split_into_chunks(text: str) -> List[str]:
    """
    Разбить текст на чанки по абзацам, соблюдая ограничения размера.

    Стратегия:
    1. Сначала дели по "\n\n" (абзацы)
    2. Собирай чанки до CHUNK_TARGET_CHARS
    3. Не превышай CHUNK_MAX_CHARS
    4. Если один абзац > CHUNK_MAX_CHARS, дели его по предложениям

    Returns:
        Список чанков (каждый - строка текста)
    """
    paragraphs = text.split("\n\n")
    chunks = []
    current_chunk = ""

    for paragraph in paragraphs:
        # Если один абзац слишком большой, разбить его по предложениям
        if len(paragraph) > CHUNK_MAX_CHARS:
            if current_chunk:
                chunks.append(current_chunk.strip())
                current_chunk = ""

            # Дели по предложениям (., !, ?)
            sentences = re.split(r'([.!?])', paragraph)
            sentence_buffer = ""

            for i, sentence in enumerate(sentences):
                if not sentence:
                    continue

                potential = sentence_buffer + sentence

                if len(potential) > CHUNK_MAX_CHARS:
                    if sentence_buffer:
                        chunks.append(sentence_buffer.strip())
                    sentence_buffer = sentence
                else:
                    sentence_buffer = potential

            if sentence_buffer:
                chunks.append(sentence_buffer.strip())

        else:
            # Абзац нормального размера - добавить в текущий чанк
            potential = current_chunk + "\n\n" + paragraph if current_chunk else paragraph

            if len(potential) > CHUNK_TARGET_CHARS and current_chunk:
                chunks.append(current_chunk.strip())
                current_chunk = paragraph
            else:
                current_chunk = potential

    if current_chunk:
        chunks.append(current_chunk.strip())

    return chunks


# === САНИТИЗАЦИЯ МАРКЕРОВ ФРАГМЕНТОВ ===

def sanitize_fragment(text: str) -> str:
    """
    Жесткая санитизация результата LLM для удаления маркеров [ФРАГМЕНТ_НАЧАЛО] и [ФРАГМЕНТ_КОНЕЦ].

    Алгоритм:
    1. Если текст содержит ОБА маркера - извлекает содержимое МЕЖДУ ними
    2. Удаляет все отдельные вхождения маркеров (с пробелами/переводами строк)
    3. Триммит только внешние переводы строк

    Args:
        text: Текст для санитизации

    Returns:
        Очищенный текст без маркеров
    """
    if not text:
        return text

    # Попытка 1: Если есть ОБА маркера - извлечь содержимое между ними
    # Используем неж модификатор для поиска между маркерами
    begin_marker = "[ФРАГМЕНТ_НАЧАЛО]"
    end_marker = "[ФРАГМЕНТ_КОНЕЦ]"

    if begin_marker in text and end_marker in text:
        # Найти позиции маркеров
        begin_pos = text.find(begin_marker)
        end_pos = text.find(end_marker)

        if begin_pos < end_pos:
            # Извлечь содержимое между маркерами
            content = text[begin_pos + len(begin_marker):end_pos]
            logger.debug(f"[SANITIZE] Найдены ОБА маркера. Извлекаю содержимое между ними.")
            text = content

    # Попытка 2: Удалить любые отдельные вхождения маркеров
    # Включаем пробелы и переводы строк вокруг маркеров
    text = re.sub(r'\s*\[ФРАГМЕНТ_НАЧАЛО\]\s*', '', text)
    text = re.sub(r'\s*\[ФРАГМЕНТ_КОНЕЦ\]\s*', '', text)

    # Триммить только внешние переводы строк (не внутренние!)
    text = text.strip('\n').strip()

    # Если результат пустой - вернуть оригинальный текст для дальнейшего анализа
    if not text.strip():
        logger.warning(f"[SANITIZE] После санитизации текст пустой! Возвращаю оригинальный.")
        return text

    return text


def _has_fragment_markers(text: str) -> Tuple[bool, Optional[str]]:
    """
    Проверить наличие маркеров фрагментов в тексте.

    Args:
        text: Текст для проверки

    Returns:
        Tuple[has_markers, marker_found] - True если маркеры найдены, имя первого маркера
    """
    begin_marker = "[ФРАГМЕНТ_НАЧАЛО]"
    end_marker = "[ФРАГМЕНТ_КОНЕЦ]"

    if begin_marker in text:
        return True, begin_marker
    if end_marker in text:
        return True, end_marker

    return False, None


def _test_sanitize_fragment():
    """
    Мини-тесты для функции sanitize_fragment.
    Проверяет различные сценарии удаления маркеров.
    """
    logger.info("[TEST] Запускаю мини-тесты для sanitize_fragment")

    test_cases = [
        # (input, expected_output, description)
        (
            "[ФРАГМЕНТ_НАЧАЛО]\nЭто текст\n[ФРАГМЕНТ_КОНЕЦ]",
            "Это текст",
            "Базовый случай: текст между маркерами"
        ),
        (
            "[ФРАГМЕНТ_НАЧАЛО]\nПервая строка\nВторая строка\n[ФРАГМЕНТ_КОНЕЦ]",
            "Первая строка\nВторая строка",
            "Многострочный текст между маркерами"
        ),
        (
            "[ФРАГМЕНТ_НАЧАЛО]\nТекст\n[ФРАГМЕНТ_КОНЕЦ]\n\nДополнительный текст",
            "Текст",
            "Маркеры с текстом после них"
        ),
        (
            "Текст\n[ФРАГМЕНТ_НАЧАЛО]\nФрагмент\n[ФРАГМЕНТ_КОНЕЦ]",
            "Фрагмент",
            "Маркеры с текстом до них"
        ),
        (
            "Просто текст без маркеров",
            "Просто текст без маркеров",
            "Текст без маркеров"
        ),
        (
            "[ФРАГМЕНТ_НАЧАЛО] Текст [ФРАГМЕНТ_КОНЕЦ]",
            "Текст",
            "Маркеры с пробелами вокруг"
        ),
        (
            "[ФРАГМЕНТ_НАЧАЛО]Текст без переводов[ФРАГМЕНТ_КОНЕЦ]",
            "Текст без переводов",
            "Маркеры без переводов строк"
        ),
        (
            "[ФРАГМЕНТ_НАЧАЛО]\n[ФРАГМЕНТ_КОНЕЦ]",
            "",
            "Пустое содержимое между маркерами"
        ),
    ]

    passed = 0
    failed = 0

    for input_text, expected, description in test_cases:
        result = sanitize_fragment(input_text)
        if result == expected:
            logger.debug(f"[TEST] ✓ PASS: {description}")
            passed += 1
        else:
            logger.warning(
                f"[TEST] ✗ FAIL: {description}\n"
                f"  Input: {repr(input_text)}\n"
                f"  Expected: {repr(expected)}\n"
                f"  Got: {repr(result)}"
            )
            failed += 1

    logger.info(f"[TEST] Результаты: {passed} passed, {failed} failed из {len(test_cases)} тестов")
    return passed, failed


# === СТРУКТУРНАЯ ВАЛИДАЦИЯ (для режима edit-fragment) ===

def _extract_expected_paragraph_count(instruction: str) -> Optional[int]:
    """
    Извлечь ожидаемое количество абзацев из инструкции.

    Ищет паттерны:
    - "на 5 абзацев", "на 3 абзаца", "в 5 абзацев"
    - "5 абзацев", "3 параграфа"
    - "раскрой на 5"

    Args:
        instruction: Инструкция редактирования

    Returns:
        Количество абзацев если найдено, иначе None
    """
    if not instruction:
        return None

    instruction_lower = instruction.lower()

    # Паттерны: "на 5 абзацев", "в 3 абзацах", "3 абзаца"
    patterns = [
        r'на\s+(\d+)\s+абзац',      # "на 5 абзацев"
        r'в\s+(\d+)\s+абзац',       # "в 5 абзацах"
        r'(\d+)\s+абзац',           # "5 абзацев"
        r'раскрой\s+на\s+(\d+)',    # "раскрой на 5"
        r'развернуть\s+на\s+(\d+)', # "развернуть на 5"
        r'(\d+)\s+параграф',        # "5 параграфов"
    ]

    for pattern in patterns:
        match = re.search(pattern, instruction_lower)
        if match:
            count = int(match.group(1))
            logger.debug(f"[STRUCTURE_VALIDATION] Найдено требование: {count} абзацев в инструкции")
            return count

    return None


def _count_paragraphs(text: str) -> int:
    """
    Подсчитать количество абзацев в тексте.

    Абзац = блок текста, отделённый одной или несколькими пустыми строками.

    Args:
        text: Текст для анализа

    Returns:
        Количество абзацев (минимум 1)
    """
    if not text or not text.strip():
        return 0

    # Разбей по одной или более пустым строкам
    # Пустая строка = строка, содержащая только whitespace
    paragraphs = re.split(r'\n\s*\n', text.strip())
    count = len([p for p in paragraphs if p.strip()])

    return count


def _is_structure_valid(text: str, expected_count: Optional[int]) -> Tuple[bool, int, Optional[str]]:
    """
    Проверить валидность структуры текста.

    Args:
        text: Текст для проверки
        expected_count: Ожидаемое количество абзацев (None = не проверять)

    Returns:
        Tuple[is_valid, actual_count, error_message]
        - is_valid: True если структура корректна
        - actual_count: Реальное количество абзацев
        - error_message: Описание ошибки если не валидна
    """
    if expected_count is None:
        # Нет требования к структуре
        return True, _count_paragraphs(text), None

    actual_count = _count_paragraphs(text)

    if actual_count == expected_count:
        return True, actual_count, None

    error_msg = f"Структурное несоответствие: ожидалось {expected_count} абзацев, получено {actual_count}"
    return False, actual_count, error_msg


# === ОСНОВНЫЕ РЕЖИМЫ РЕДАКТИРОВАНИЯ ===

def generate_article_plan(topic: str, format: str = "plain") -> Tuple[LLMResponse, Optional[ChunkInfo]]:
    """
    РЕЖИМ 1: Генерирует план статьи по заданной теме используя OpenAI API.

    Используется PLAN_MAX_TOKENS. При truncation - один retry с увеличенным лимитом.

    Args:
        topic: Тема статьи
        format: "plain" для обычного текста или "markdown" для Markdown-форматирования

    Returns:
        Tuple[LLMResponse, None] - ответ и None (чанкинг для плана не нужен)

    Raises:
        Exception: При ошибке API OpenAI или если ответ обрезан после всех retry
    """
    logger.info(f"[PLAN] Генерирую план для темы: {topic}, format: {format}")

    system_prompt = PLAN_SYSTEM_PROMPT

    # Добавляем инструкцию о Markdown если требуется
    if format == "markdown":
        system_prompt += "\n\nФОРМАТ ВЫВОДА:\nИспользуй Markdown для форматирования:\n- ## для заголовков\n- Списки (- или 1.)\n- ``` для код-блоков"
    else:
        system_prompt += "\n\nФОРМАТ ВЫВОДА:\nИспользуй только обычный текст. НЕ используй символы Markdown-форматирования."

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Тема статьи: {topic}"}
    ]

    # Первая попытка
    response = _call_openai(messages, PLAN_MAX_TOKENS, mode="plan")

    # Если обрезано - один retry с увеличенным лимитом
    if response.truncated and RETRY_ON_TRUNCATION:
        retry_tokens = PLAN_MAX_TOKENS * RETRY_TOKEN_MULTIPLIER
        logger.info(f"[PLAN RETRY] Повторяю с увеличенным лимитом: {retry_tokens} токенов")
        response = _call_openai(messages, retry_tokens, mode="plan_retry")

    # Если после retry всё ещё обрезано - ошибка
    if response.truncated:
        logger.error(f"[PLAN FAILED] Ответ остался обрезанным даже после retry!")
        raise Exception(
            f"TRUNCATED: План был обрезан даже с лимитом {PLAN_MAX_TOKENS * RETRY_TOKEN_MULTIPLIER} токенов. "
            f"Попробуйте сократить тему."
        )

    logger.info(f"[PLAN SUCCESS] План успешно сгенерирован ({len(response.text)} символов)")
    return response, None


def edit_full_text(text: str, instruction: str, format: str = "plain") -> Tuple[LLMResponse, Optional[ChunkInfo]]:
    """
    РЕЖИМ 2: Редактирование ВСЕГО текста статьи с поддержкой chunking.

    Если текст короткий - обрабатывается одним запросом.
    Если текст длинный - разбивается на чанки, каждый обрабатывается отдельно.

    Args:
        text: Полный текст статьи
        instruction: Инструкция редактирования
        format: "plain" для обычного текста или "markdown" для Markdown-форматирования

    Returns:
        Tuple[LLMResponse, ChunkInfo] - отредактированный текст и инфо о чанкинге

    Raises:
        Exception: При критическом truncation или ошибке обработки чанков
    """
    logger.info(
        f"[FULLTEXT] Начинаю редактирование всего текста. "
        f"Размер: {len(text)} символов, инструкция: {instruction[:50]}..., format: {format}"
    )

    text_len = len(text)
    chunk_info = ChunkInfo(chunks_count=1, strategy="single", total_chars=text_len)

    # Подготавливаем системный промпт с учётом формата
    system_prompt = EDIT_FULL_TEXT_SYSTEM_PROMPT
    if format == "markdown":
        system_prompt += "\n\nФОРМАТ ВЫВОДА:\nИспользуй Markdown для форматирования результата:\n- ## для заголовков\n- Списки (- или 1.)\n- ``` для код-блоков"
    else:
        system_prompt += "\n\nФОРМАТ ВЫВОДА:\nИспользуй только обычный текст. НЕ используй символы Markdown-форматирования."

    # Если текст достаточно короткий - обработать одним запросом
    if text_len <= CHUNK_MAX_CHARS:
        logger.debug(f"[FULLTEXT] Текст достаточно короткий ({text_len} символов), обработка одним запросом")

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Инструкция: {instruction}\n\nТекст для редактирования:\n{text}"}
        ]

        response = _call_openai(messages, FULLTEXT_MAX_TOKENS, mode="fulltext")

        # Retry если обрезано
        if response.truncated and RETRY_ON_TRUNCATION:
            retry_tokens = FULLTEXT_MAX_TOKENS * RETRY_TOKEN_MULTIPLIER
            logger.info(f"[FULLTEXT RETRY] Повторяю с увеличенным лимитом: {retry_tokens} токенов")
            response = _call_openai(messages, retry_tokens, mode="fulltext_retry")

        if response.truncated:
            logger.warning(f"[FULLTEXT TRUNCATED] Текст остался обрезанным, включаю chunking...")
            # Переходим к chunking ниже
        else:
            logger.info(f"[FULLTEXT SUCCESS] Текст успешно отредактирован ({len(response.text)} символов)")
            return response, chunk_info

    # Длинный текст или обрезано при попытке одним запросом -> chunking
    logger.info(f"[FULLTEXT CHUNKING] Разбиваю текст на чанки для обработки")

    chunks = _split_into_chunks(text)
    chunk_info.chunks_count = len(chunks)
    chunk_info.strategy = "paragraph" if len(chunks) > 1 else "single"

    logger.info(
        f"[FULLTEXT CHUNKING] Разбито на {len(chunks)} чанков. "
        f"Средний размер: {text_len // len(chunks) if chunks else 0} символов"
    )

    if DEBUG_CHUNKING:
        for i, chunk in enumerate(chunks):
            logger.debug(f"  Чанк {i+1}/{len(chunks)}: {len(chunk)} символов, начало: {chunk[:50]}...")

    # Обработать каждый чанк
    edited_chunks = []
    for i, chunk in enumerate(chunks):
        logger.debug(f"[FULLTEXT CHUNKING] Обрабатываю чанк {i+1}/{len(chunks)} ({len(chunk)} символов)")

        chunk_messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Инструкция: {instruction}\n\nТекст для редактирования:\n{chunk}"}
        ]

        chunk_response = _call_openai(chunk_messages, FULLTEXT_MAX_TOKENS, mode=f"fulltext_chunk_{i+1}")

        # Если даже чанк обрезан - retry
        if chunk_response.truncated and RETRY_ON_TRUNCATION:
            retry_tokens = FULLTEXT_MAX_TOKENS * RETRY_TOKEN_MULTIPLIER
            logger.info(f"[FULLTEXT CHUNK RETRY] Чанк {i+1} обрезан, повтор с {retry_tokens} токенов")
            chunk_response = _call_openai(chunk_messages, retry_tokens, mode=f"fulltext_chunk_{i+1}_retry")

        # Если после retry всё ещё обрезано - критическая ошибка
        if chunk_response.truncated:
            logger.error(f"[FULLTEXT CHUNK FAILED] Чанк {i+1} остался обрезанным!")
            raise Exception(
                f"TRUNCATED: Чанк {i+1} текста был обрезан даже с максимальным лимитом токенов. "
                f"Попробуйте сократить запрос или разбить текст на части."
            )

        edited_chunks.append(chunk_response.text)
        logger.debug(f"[FULLTEXT CHUNKING] Чанк {i+1} успешно обработан ({len(chunk_response.text)} символов)")

    # Собрать отредактированный текст из чанков
    edited_text = "\n\n".join(edited_chunks)
    logger.info(
        f"[FULLTEXT SUCCESS] Весь текст успешно отредактирован через {len(chunks)} чанков. "
        f"Итоговый размер: {len(edited_text)} символов"
    )

    response = LLMResponse(
        text=edited_text,
        finish_reason="stop",
        usage=None,  # Агрегированная информация от нескольких запросов
        truncated=False
    )

    return response, chunk_info


def edit_fragment(
    before_context: str,
    fragment: str,
    after_context: str,
    instruction: str,
    format: str = "plain"
) -> Tuple[LLMResponse, Optional[ChunkInfo]]:
    """
    РЕЖИМ 3: Редактирование ВЫДЕЛЕННОГО ФРАГМЕНТА с поддержкой retry, chunking и структурной валидации.

    Алгоритм:
    1. Парсить инструкцию для извлечения ожидаемого количества абзацев (если есть)
    2. Попытка один раз с FRAGMENT_MAX_TOKENS
    3. Если обрезано - retry с увеличенным лимитом
    4. Если снова обрезано - chunking фрагмента
    5. Если ожидаемое количество абзацев задано:
       - Валидировать структуру полученного ответа
       - Если не совпадает - retry с явной коррекцией
       - Если после retry всё ещё не совпадает - Exception

    Args:
        before_context: Контекст до фрагмента
        fragment: Выделенный фрагмент для редактирования
        after_context: Контекст после фрагмента
        instruction: Инструкция редактирования

    Returns:
        Tuple[LLMResponse, ChunkInfo] - отредактированный фрагмент и инфо о чанкинге

    Raises:
        Exception: При критическом truncation или структурном несоответствии после всех попыток
    """
    logger.info(
        f"[FRAGMENT] Начинаю редактирование фрагмента. "
        f"Размер фрагмента: {len(fragment)} символов, инструкция: {instruction[:50]}..., format: {format}"
    )
    logger.debug(
        f"[FRAGMENT] Контекст: до={len(before_context)}, после={len(after_context)}"
    )

    # Подготавливаем системный промпт с учётом формата
    system_prompt = EDIT_FRAGMENT_SYSTEM_PROMPT
    if format == "markdown":
        system_prompt += "\n\nФОРМАТ ВЫВОДА:\nИспользуй Markdown для форматирования результата:\n- ## для заголовков\n- Списки (- или 1.)\n- ``` для код-блоков"
    else:
        system_prompt += "\n\nФОРМАТ ВЫВОДА:\nИспользуй только обычный текст. НЕ используй символы Markdown-форматирования."

    # === ПАРСИНГ ОЖИДАЕМОЙ СТРУКТУРЫ ===
    expected_paragraphs = None
    if ENABLE_STRUCTURE_VALIDATION:
        expected_paragraphs = _extract_expected_paragraph_count(instruction)
        if expected_paragraphs:
            logger.info(f"[FRAGMENT] Структурное требование: {expected_paragraphs} абзацев")

    chunk_info = ChunkInfo(chunks_count=1, strategy="single", total_chars=len(fragment))

    # === ПОПЫТКА 1: Один запрос с стандартным лимитом ===
    logger.debug(f"[FRAGMENT] Попытка 1: один запрос с лимитом {FRAGMENT_MAX_TOKENS}")

    full_text = f"""ПРЕДЫДУЩИЙ АБЗАЦ (контекст):
{before_context}

ФРАГМЕНТ ДЛЯ РЕДАКТИРОВАНИЯ:
[ФРАГМЕНТ_НАЧАЛО]
{fragment}
[ФРАГМЕНТ_КОНЕЦ]

СЛЕДУЮЩИЙ АБЗАЦ (контекст):
{after_context}"""

    # Добавить структурное требование если есть
    user_message = f"Инструкция: {instruction}\n\n{full_text}"
    if expected_paragraphs:
        user_message += f"\n\nСТРУКТУРНОЕ ТРЕБОВАНИЕ: Ответ должен содержать РОВНО {expected_paragraphs} абзацев."

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_message}
    ]

    response = _call_openai(messages, FRAGMENT_MAX_TOKENS, mode="fragment")

    # === САНИТИЗАЦИЯ ОТВЕТА 1 ===
    logger.debug(f"[FRAGMENT] До санитизации (попытка 1): {len(response.text)} символов")
    has_markers_before, marker_name = _has_fragment_markers(response.text)
    if has_markers_before:
        logger.warning(f"[FRAGMENT] Обнаружены маркеры {marker_name} в ответе попытки 1!")

    response.text = sanitize_fragment(response.text)
    has_markers_after, _ = _has_fragment_markers(response.text)
    if has_markers_after:
        logger.error(f"[FRAGMENT] МАРКЕРЫ ВСЕ ЕЩЕ ПРИСУТСТВУЮТ ПОСЛЕ САНИТИЗАЦИИ (попытка 1)!")
    else:
        logger.debug(f"[FRAGMENT] После санитизации (попытка 1): {len(response.text)} символов, маркеры удалены")

    # Инициализировать переменные валидации
    is_valid = True
    actual_count = None
    error_msg = None

    if not response.truncated:
        # Валидировать структуру если требуется
        if expected_paragraphs:
            is_valid, actual_count, error_msg = _is_structure_valid(response.text, expected_paragraphs)
            logger.info(f"[FRAGMENT VALIDATION] Попытка 1: ожидалось {expected_paragraphs}, получено {actual_count} абзацев")

            if is_valid:
                logger.info(f"[FRAGMENT SUCCESS] Фрагмент успешно отредактирован с правильной структурой ({len(response.text)} символов, {actual_count} абзацев)")
                return response, chunk_info
            else:
                logger.warning(f"[FRAGMENT VALIDATION FAILED] {error_msg}")
                # Продолжить к retry структурной коррекции ниже
        else:
            logger.info(f"[FRAGMENT SUCCESS] Фрагмент успешно отредактирован ({len(response.text)} символов)")
            return response, chunk_info

    # === ПОПЫТКА 2: Структурный retry при неправильном количестве абзацев ===
    structure_retry_needed = expected_paragraphs and not response.truncated and not is_valid
    if structure_retry_needed and STRUCTURE_VALIDATION_RETRIES > 0:
        _, actual_count, _ = _is_structure_valid(response.text, expected_paragraphs)
        structure_retry_tokens = max(FRAGMENT_MAX_TOKENS, int(FRAGMENT_MAX_TOKENS * STRUCTURE_RETRY_TOKEN_MULTIPLIER))
        logger.info(
            f"[FRAGMENT STRUCTURE RETRY] Попытка 2: коррекция структуры. "
            f"Ожидалось {expected_paragraphs}, получено {actual_count} абзацев. "
            f"Retry с {structure_retry_tokens} токенов"
        )

        # Явная инструкция по исправлению структуры
        structure_correction_message = (
            f"Инструкция: {instruction}\n\n{full_text}\n\n"
            f"СТРУКТУРНОЕ ТРЕБОВАНИЕ: Ответ ДОЛЖЕН содержать РОВНО {expected_paragraphs} абзацев.\n\n"
            f"⚠️ ВАЖНО: В предыдущем ответе ты вернул {actual_count} абзацев вместо {expected_paragraphs}.\n"
            f"ИСПРАВЬ это. Верни РОВНО {expected_paragraphs} абзацев, разделённых пустыми строками.\n"
            f"Сохрани смысл и содержание, но соблюди структуру."
        )

        structure_messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": structure_correction_message}
        ]

        response = _call_openai(structure_messages, structure_retry_tokens, mode="fragment_structure_retry")

        # === САНИТИЗАЦИЯ ОТВЕТА 2 (структурный retry) ===
        logger.debug(f"[FRAGMENT] До санитизации (структурный retry): {len(response.text)} символов")
        has_markers_before, marker_name = _has_fragment_markers(response.text)
        if has_markers_before:
            logger.warning(f"[FRAGMENT] Обнаружены маркеры {marker_name} в ответе структурного retry!")

        response.text = sanitize_fragment(response.text)
        has_markers_after, _ = _has_fragment_markers(response.text)
        if has_markers_after:
            logger.error(f"[FRAGMENT] МАРКЕРЫ ВСЕ ЕЩЕ ПРИСУТСТВУЮТ ПОСЛЕ САНИТИЗАЦИИ (структурный retry)!")
        else:
            logger.debug(f"[FRAGMENT] После санитизации (структурный retry): {len(response.text)} символов, маркеры удалены")

        if not response.truncated:
            # Ещё раз валидировать структуру
            is_valid, actual_count, error_msg = _is_structure_valid(response.text, expected_paragraphs)
            logger.info(f"[FRAGMENT STRUCTURE RETRY] Результат: ожидалось {expected_paragraphs}, получено {actual_count} абзацев")

            if is_valid:
                logger.info(f"[FRAGMENT SUCCESS] Структура исправлена! ({len(response.text)} символов, {actual_count} абзацев)")
                return response, chunk_info
            else:
                logger.error(f"[FRAGMENT STRUCTURE RETRY FAILED] {error_msg}")
                # Продолжить к truncation retry ниже
        # Если всё ещё truncated или структура не совпадает, продолжить обработку

    # === ПОПЫТКА 3: Retry с увеличенным лимитом (truncation) ===
    if RETRY_ON_TRUNCATION and response.truncated:
        retry_tokens = FRAGMENT_MAX_TOKENS * RETRY_TOKEN_MULTIPLIER
        logger.info(f"[FRAGMENT RETRY] Попытка 3: retry (truncation) с увеличенным лимитом {retry_tokens}")

        response = _call_openai(messages, retry_tokens, mode="fragment_retry")

        # === САНИТИЗАЦИЯ ОТВЕТА 3 (truncation retry) ===
        logger.debug(f"[FRAGMENT] До санитизации (truncation retry): {len(response.text)} символов")
        has_markers_before, marker_name = _has_fragment_markers(response.text)
        if has_markers_before:
            logger.warning(f"[FRAGMENT] Обнаружены маркеры {marker_name} в ответе truncation retry!")

        response.text = sanitize_fragment(response.text)
        has_markers_after, _ = _has_fragment_markers(response.text)
        if has_markers_after:
            logger.error(f"[FRAGMENT] МАРКЕРЫ ВСЕ ЕЩЕ ПРИСУТСТВУЮТ ПОСЛЕ САНИТИЗАЦИИ (truncation retry)!")
        else:
            logger.debug(f"[FRAGMENT] После санитизации (truncation retry): {len(response.text)} символов, маркеры удалены")

        if not response.truncated:
            # Валидировать структуру если требуется
            if expected_paragraphs:
                is_valid, actual_count, error_msg = _is_structure_valid(response.text, expected_paragraphs)
                logger.info(f"[FRAGMENT VALIDATION] Retry (truncation): ожидалось {expected_paragraphs}, получено {actual_count} абзацев")

                if is_valid:
                    logger.info(f"[FRAGMENT SUCCESS] Фрагмент отредактирован после retry с правильной структурой ({len(response.text)} символов)")
                    return response, chunk_info
                else:
                    logger.warning(f"[FRAGMENT VALIDATION FAILED] {error_msg}")
                    # Структура всё ещё неверна даже после retry
                    raise Exception(
                        f"STRUCTURE_MISMATCH: После retry фрагмент содержит {actual_count} абзацев вместо требуемых {expected_paragraphs}."
                    )
            else:
                logger.info(f"[FRAGMENT SUCCESS] Фрагмент успешно отредактирован после retry ({len(response.text)} символов)")
                return response, chunk_info

    # === ПОПЫТКА 4: Chunking для фрагмента ===
    logger.info(f"[FRAGMENT CHUNKING] Попытка 4: включаю chunking для фрагмента")

    fragment_chunks = _split_into_chunks(fragment)
    chunk_info.chunks_count = len(fragment_chunks)
    chunk_info.strategy = "paragraph" if len(fragment_chunks) > 1 else "single"

    logger.info(
        f"[FRAGMENT CHUNKING] Фрагмент разбит на {len(fragment_chunks)} чанков. "
        f"Средний размер: {len(fragment) // len(fragment_chunks) if fragment_chunks else 0} символов"
    )

    if DEBUG_CHUNKING:
        for i, chunk in enumerate(fragment_chunks):
            logger.debug(f"  Чанк {i+1}/{len(fragment_chunks)}: {len(chunk)} символов")

    # Обработать каждый чанк с контекстом
    edited_chunks = []

    for i, chunk in enumerate(fragment_chunks):
        logger.debug(f"[FRAGMENT CHUNKING] Обрабатываю чанк {i+1}/{len(fragment_chunks)} ({len(chunk)} символов)")

        # Контекст вокруг чанка
        chunk_before = before_context[-CONTEXT_WINDOW_CHARS:] if i == 0 else ""
        chunk_after = after_context[:CONTEXT_WINDOW_CHARS] if i == len(fragment_chunks) - 1 else ""

        if i > 0:
            chunk_before = edited_chunks[i-1][-CONTEXT_WINDOW_CHARS:] if len(edited_chunks[i-1]) > CONTEXT_WINDOW_CHARS else edited_chunks[i-1]

        if i < len(fragment_chunks) - 1:
            chunk_after = fragment_chunks[i+1][:CONTEXT_WINDOW_CHARS]

        chunk_full_text = f"""КОНТЕКСТ ДО:
{chunk_before}

ФРАГМЕНТ ДЛЯ РЕДАКТИРОВАНИЯ:
[ФРАГМЕНТ_НАЧАЛО]
{chunk}
[ФРАГМЕНТ_КОНЕЦ]

КОНТЕКСТ ПОСЛЕ:
{chunk_after}"""

        chunk_messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Инструкция: {instruction}\n\n{chunk_full_text}"}
        ]

        chunk_response = _call_openai(chunk_messages, FRAGMENT_MAX_TOKENS, mode=f"fragment_chunk_{i+1}")

        # === САНИТИЗАЦИЯ ОТВЕТА ЧАНКА 1 ===
        logger.debug(f"[FRAGMENT CHUNKING] До санитизации (чанк {i+1}): {len(chunk_response.text)} символов")
        has_markers_before, marker_name = _has_fragment_markers(chunk_response.text)
        if has_markers_before:
            logger.warning(f"[FRAGMENT CHUNKING] Обнаружены маркеры {marker_name} в ответе чанка {i+1}!")

        chunk_response.text = sanitize_fragment(chunk_response.text)
        has_markers_after, _ = _has_fragment_markers(chunk_response.text)
        if has_markers_after:
            logger.error(f"[FRAGMENT CHUNKING] МАРКЕРЫ ВСЕ ЕЩЕ ПРИСУТСТВУЮТ ПОСЛЕ САНИТИЗАЦИИ (чанк {i+1})!")
        else:
            logger.debug(f"[FRAGMENT CHUNKING] После санитизации (чанк {i+1}): {len(chunk_response.text)} символов, маркеры удалены")

        # Retry для чанка если обрезано
        if chunk_response.truncated and RETRY_ON_TRUNCATION:
            retry_tokens = FRAGMENT_MAX_TOKENS * RETRY_TOKEN_MULTIPLIER
            logger.info(f"[FRAGMENT CHUNK RETRY] Чанк {i+1} обрезан, retry с {retry_tokens} токенов")
            chunk_response = _call_openai(chunk_messages, retry_tokens, mode=f"fragment_chunk_{i+1}_retry")

            # === САНИТИЗАЦИЯ ОТВЕТА CHUNK RETRY ===
            logger.debug(f"[FRAGMENT CHUNKING] До санитизации (чанк {i+1} retry): {len(chunk_response.text)} символов")
            has_markers_before, marker_name = _has_fragment_markers(chunk_response.text)
            if has_markers_before:
                logger.warning(f"[FRAGMENT CHUNKING] Обнаружены маркеры {marker_name} в ответе retry чанка {i+1}!")

            chunk_response.text = sanitize_fragment(chunk_response.text)
            has_markers_after, _ = _has_fragment_markers(chunk_response.text)
            if has_markers_after:
                logger.error(f"[FRAGMENT CHUNKING] МАРКЕРЫ ВСЕ ЕЩЕ ПРИСУТСТВУЮТ ПОСЛЕ САНИТИЗАЦИИ (чанк {i+1} retry)!")
            else:
                logger.debug(f"[FRAGMENT CHUNKING] После санитизации (чанк {i+1} retry): {len(chunk_response.text)} символов, маркеры удалены")

        # Если чанк все ещё обрезан - критическая ошибка
        if chunk_response.truncated:
            logger.error(f"[FRAGMENT CHUNK FAILED] Чанк {i+1} остался обрезанным!")
            raise Exception(
                f"TRUNCATED: Чанк {i+1} фрагмента был обрезан даже с максимальным лимитом. "
                f"Выделите меньший фрагмент и попробуйте снова."
            )

        edited_chunks.append(chunk_response.text)
        logger.debug(f"[FRAGMENT CHUNKING] Чанк {i+1} успешно обработан ({len(chunk_response.text)} символов)")

    # Собрать отредактированный фрагмент из чанков
    edited_fragment = "\n\n".join(edited_chunks)
    logger.info(
        f"[FRAGMENT SUCCESS] Фрагмент успешно отредактирован через {len(fragment_chunks)} чанков. "
        f"Итоговый размер: {len(edited_fragment)} символов"
    )

    # Валидировать структуру результата после chunking
    if expected_paragraphs:
        is_valid_final, final_count, error_msg_final = _is_structure_valid(edited_fragment, expected_paragraphs)
        logger.info(f"[FRAGMENT CHUNKING VALIDATION] После chunking: ожидалось {expected_paragraphs}, получено {final_count} абзацев")

        if not is_valid_final:
            logger.error(f"[FRAGMENT CHUNKING VALIDATION FAILED] {error_msg_final}")
            raise Exception(
                f"STRUCTURE_MISMATCH: После chunking фрагмент содержит {final_count} абзацев вместо требуемых {expected_paragraphs}."
            )

    response = LLMResponse(
        text=edited_fragment,
        finish_reason="stop",
        usage=None,
        truncated=False
    )

    return response, chunk_info


# === РЕЖИМ 5: УСИЛЕНИЕ (ENHANCE) ===

def enhance_fragment(fragment: str, before_context: str = "", after_context: str = "") -> LLMResponse:
    """
    Усилить фрагмент текста

    Args:
        fragment: Текст фрагмента для усиления
        before_context: Контекст перед фрагментом (опционально)
        after_context: Контекст после фрагмента (опционально)

    Returns:
        LLMResponse с усиленным текстом фрагмента
    """
    logger.info(f"[ENHANCE] Усиливаю фрагмент ({len(fragment)} символов)")

    # Формируем промпт с контекстом для лучшего результата
    user_content = fragment
    if before_context:
        user_content = f"КОНТЕКСТ ПЕРЕД:\n{before_context}\n\nФРАГМЕНТ ДЛЯ УСИЛЕНИЯ:\n{user_content}"
    if after_context:
        user_content = f"{user_content}\n\nКОНТЕКСТ ПОСЛЕ:\n{after_context}"

    messages = [
        {
            "role": "system",
            "content": ENHANCE_FRAGMENT_SYSTEM_PROMPT
        },
        {
            "role": "user",
            "content": user_content
        }
    ]

    # Вызываем LLM с повышенной температурой для креативности
    response = _call_openai_with_temperature(messages, ENHANCE_FRAGMENT_MAX_TOKENS, ENHANCE_TEMPERATURE, mode="enhance_fragment")

    logger.info(f"[ENHANCE] Фрагмент усилен ({len(response.text)} символов)")

    return response


def enhance_full_text(text: str) -> LLMResponse:
    """
    Усилить полный текст статьи

    Args:
        text: Полный текст статьи

    Returns:
        LLMResponse с усиленным текстом
    """
    logger.info(f"[ENHANCE] Усиливаю полный текст ({len(text)} символов)")

    messages = [
        {
            "role": "system",
            "content": ENHANCE_FULL_SYSTEM_PROMPT
        },
        {
            "role": "user",
            "content": text
        }
    ]

    # Вызываем LLM с повышенной температурой
    response = _call_openai_with_temperature(messages, ENHANCE_FULL_MAX_TOKENS, ENHANCE_TEMPERATURE, mode="enhance_full")

    logger.info(f"[ENHANCE] Текст усилен ({len(response.text)} символов)")

    return response


def enhance_plan(topic: str) -> LLMResponse:
    """
    Усилить план статьи по теме

    Args:
        topic: Тема или заготовка плана

    Returns:
        LLMResponse с усиленным планом
    """
    logger.info(f"[ENHANCE] Создаю усиленный план по теме: {topic}")

    messages = [
        {
            "role": "system",
            "content": ENHANCE_PLAN_SYSTEM_PROMPT
        },
        {
            "role": "user",
            "content": f"Сделай захватывающий план статьи по теме: {topic}"
        }
    ]

    # Вызываем LLM с повышенной температурой
    response = _call_openai_with_temperature(messages, ENHANCE_PLAN_MAX_TOKENS, ENHANCE_TEMPERATURE, mode="enhance_plan")

    logger.info(f"[ENHANCE] План создан ({len(response.text)} символов)")

    return response


# === РЕЖИМ 4: YOUTUBE IMPORT ===

def fetch_youtube_transcript(youtube_url: str) -> str:
    """
    Получить транскрипт с YouTube через ScrapeCreators API

    Args:
        youtube_url: URL YouTube видео

    Returns:
        Текст транскрипта

    Raises:
        Exception: Если транскрипт не найден или API ошибка
    """
    logger.info(f"[YOUTUBE] Получаю транскрипт для {youtube_url}")

    api_key = os.getenv("SCRAPECREATORS_API_KEY")
    if not api_key:
        logger.error("[YOUTUBE] SCRAPECREATORS_API_KEY не установлен")
        raise ValueError("SCRAPECREATORS_API_KEY не установлен в .env файле")

    try:
        # Prepare API request
        # ВАЖНО: используем endpoint /transcript, не /video!
        api_url = "https://api.scrapecreators.com/v1/youtube/video/transcript"
        headers = {
            "x-api-key": api_key,
            "Content-Type": "application/json"
        }
        params = {
            "url": youtube_url
        }

        logger.debug(f"[YOUTUBE] Отправляю запрос к API: {api_url}")
        logger.debug(f"[YOUTUBE] Параметры: url={youtube_url}")
        response = requests.get(api_url, headers=headers, params=params, timeout=30)

        logger.debug(f"[YOUTUBE] Статус ответа: {response.status_code}")

        if response.status_code == 404:
            logger.error(f"[YOUTUBE] Видео не найдено")
            raise Exception("Видео не найдено. Проверьте YouTube URL.")
        elif response.status_code == 401:
            logger.error(f"[YOUTUBE] Ошибка аутентификации API")
            raise Exception("Ошибка аутентификации API (проверьте SCRAPECREATORS_API_KEY).")
        elif response.status_code == 429:
            logger.error(f"[YOUTUBE] Превышен лимит API запросов")
            raise Exception("Превышен лимит запросов. Попробуйте позже.")
        elif response.status_code >= 500:
            logger.error(f"[YOUTUBE] Ошибка сервера API")
            raise Exception("Ошибка сервера ScrapeCreators. Попробуйте позже.")

        if not response.ok:
            logger.error(f"[YOUTUBE] API ошибка: {response.text}")
            raise Exception(f"API ошибка: {response.status_code}")

        data = response.json()

        # Extract transcript - по документации это поле называется transcript_only_text
        transcript = data.get("transcript_only_text")
        if not transcript:
            # Дополнительный логирующий вывод для отладки
            logger.debug(f"[YOUTUBE] Ответ API содержит: {list(data.keys())}")
            logger.error("[YOUTUBE] Транскрипт отсутствует в ответе API")
            raise Exception("Транскрипт недоступен для этого видео.")

        logger.info(f"[YOUTUBE] Получен транскрипт ({len(transcript)} символов)")
        return transcript

    except requests.exceptions.Timeout:
        logger.error("[YOUTUBE] Timeout при запросе к API")
        raise Exception("Timeout при загрузке транскрипта. Попробуйте позже.")
    except requests.exceptions.ConnectionError:
        logger.error("[YOUTUBE] Ошибка соединения с API")
        raise Exception("Ошибка соединения с API. Проверьте интернет.")
    except Exception as e:
        logger.error(f"[YOUTUBE] Ошибка при получении транскрипта: {str(e)}")
        raise


def process_youtube_transcript(transcript: str) -> LLMResponse:
    """
    Обработать YouTube транскрипт через LLM

    Преобразует устную речь в письменный текст:
    - Удаляет таймкоды
    - Удаляет слова-паразиты
    - Исправляет опечатки
    - Приводит к письменной форме
    - Структурирует по абзацам

    Args:
        transcript: Исходный транскрипт

    Returns:
        LLMResponse с обработанным текстом
    """
    logger.info(f"[YOUTUBE_PROCESSING] Начинаю обработку транскрипта ({len(transcript)} символов)")

    # Prepare messages
    messages = [
        {
            "role": "system",
            "content": YOUTUBE_TRANSCRIPT_SYSTEM_PROMPT
        },
        {
            "role": "user",
            "content": transcript
        }
    ]

    # Use higher token limit for transcript processing (since we're converting, not just editing)
    max_tokens = int(os.getenv("YOUTUBE_MAX_TOKENS", "3000"))

    logger.debug(f"[YOUTUBE_PROCESSING] Вызываю LLM с max_tokens={max_tokens}")

    # Call LLM
    response = _call_openai(messages, max_tokens, mode="youtube")

    logger.info(
        f"[YOUTUBE_PROCESSING] Транскрипт обработан "
        f"(результат: {len(response.text)} символов, finish_reason={response.finish_reason})"
    )

    # If truncated, retry with higher limit
    if response.truncated and RETRY_ON_TRUNCATION > 0:
        logger.warning(f"[YOUTUBE_PROCESSING] Ответ был обрезан, пробую retry")
        new_max_tokens = int(max_tokens * RETRY_TOKEN_MULTIPLIER)
        logger.debug(f"[YOUTUBE_PROCESSING] Retry с max_tokens={new_max_tokens}")

        response = _call_openai(messages, new_max_tokens, mode="youtube")
        logger.info(f"[YOUTUBE_PROCESSING] Retry завершен (finish_reason={response.finish_reason})")

    if response.truncated:
        logger.error("[YOUTUBE_PROCESSING] Даже после retry ответ остается обрезанным")
        raise Exception(
            "TRUNCATED: Обработанный текст слишком большой даже при увеличенном лимите токенов."
        )

    return response


def import_youtube_video(youtube_url: str) -> str:
    """
    Полный pipeline импорта статьи из YouTube

    1. Получает транскрипт через ScrapeCreators API
    2. Обрабатывает его через LLM
    3. Возвращает готовый текст статьи

    Args:
        youtube_url: URL YouTube видео

    Returns:
        Готовый текст статьи для публикации
    """
    logger.info(f"[IMPORT_YOUTUBE] Начинаю импорт из YouTube: {youtube_url}")

    # Step 1: Get transcript
    try:
        transcript = fetch_youtube_transcript(youtube_url)
    except Exception as e:
        logger.error(f"[IMPORT_YOUTUBE] Ошибка при получении транскрипта: {str(e)}")
        raise

    # Step 2: Process transcript
    try:
        response = process_youtube_transcript(transcript)
        processed_text = response.text
    except Exception as e:
        logger.error(f"[IMPORT_YOUTUBE] Ошибка при обработке транскрипта: {str(e)}")
        raise

    logger.info(f"[IMPORT_YOUTUBE] Импорт завершен успешно ({len(processed_text)} символов)")

    return processed_text


def humanize_text(text: str) -> Tuple[LLMResponse, Optional[ChunkInfo]]:
    """
    РЕЖИМ 6: Сделать текст более естественным (убрать AI-паттерны, канцелярит).

    Работает с полным текстом или фрагментом.
    При truncation — retry с увеличенным лимитом.
    При необходимости — chunking для длинных текстов.

    Args:
        text: Текст для гуманизации

    Returns:
        Tuple[LLMResponse, ChunkInfo] - гуманизированный текст и инфо о чанкинге
    """
    logger.info(f"[HUMANIZE] Начинаю гуманизацию текста. Размер: {len(text)} символов")

    text_len = len(text)
    chunk_info = ChunkInfo(chunks_count=1, strategy="single", total_chars=text_len)

    system_prompt = HUMANIZE_SYSTEM_PROMPT

    # Если текст достаточно короткий - обработать одним запросом
    if text_len <= CHUNK_MAX_CHARS:
        logger.debug(f"[HUMANIZE] Текст достаточно короткий ({text_len} символов), обработка одним запросом")

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": text}
        ]

        response = _call_openai(messages, FULLTEXT_MAX_TOKENS, mode="humanize")

        # Retry если обрезано
        if response.truncated and RETRY_ON_TRUNCATION:
            retry_tokens = FULLTEXT_MAX_TOKENS * RETRY_TOKEN_MULTIPLIER
            logger.info(f"[HUMANIZE RETRY] Повторяю с увеличенным лимитом: {retry_tokens} токенов")
            response = _call_openai(messages, retry_tokens, mode="humanize_retry")

        if response.truncated:
            logger.warning(f"[HUMANIZE TRUNCATED] Текст остался обрезанным, включаю chunking...")
        else:
            logger.info(f"[HUMANIZE SUCCESS] Текст успешно гуманизирован ({len(response.text)} символов)")
            return response, chunk_info

    # Длинный текст или обрезано при попытке одним запросом -> chunking
    logger.info(f"[HUMANIZE CHUNKING] Разбиваю текст на чанки для обработки")

    chunks = _split_into_chunks(text)
    chunk_info.chunks_count = len(chunks)
    chunk_info.strategy = "paragraph" if len(chunks) > 1 else "single"

    logger.info(
        f"[HUMANIZE CHUNKING] Разбито на {len(chunks)} чанков. "
        f"Средний размер: {text_len // len(chunks) if chunks else 0} символов"
    )

    # Обработать каждый чанк
    humanized_chunks = []
    for i, chunk in enumerate(chunks):
        logger.debug(f"[HUMANIZE CHUNKING] Обрабатываю чанк {i+1}/{len(chunks)} ({len(chunk)} символов)")

        chunk_messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": chunk}
        ]

        chunk_response = _call_openai(chunk_messages, FULLTEXT_MAX_TOKENS, mode=f"humanize_chunk_{i+1}")

        # Если даже чанк обрезан - retry
        if chunk_response.truncated and RETRY_ON_TRUNCATION:
            retry_tokens = FULLTEXT_MAX_TOKENS * RETRY_TOKEN_MULTIPLIER
            logger.info(f"[HUMANIZE CHUNK RETRY] Чанк {i+1} обрезан, повтор с {retry_tokens} токенов")
            chunk_response = _call_openai(chunk_messages, retry_tokens, mode=f"humanize_chunk_{i+1}_retry")

        # Если после retry всё ещё обрезано - критическая ошибка
        if chunk_response.truncated:
            logger.error(f"[HUMANIZE CHUNK FAILED] Чанк {i+1} остался обрезанным!")
            raise Exception(
                f"TRUNCATED: Чанк {i+1} текста был обрезан даже с максимальным лимитом токенов. "
                f"Попробуйте сократить текст или разбить на части."
            )

        humanized_chunks.append(chunk_response.text)
        logger.debug(f"[HUMANIZE CHUNKING] Чанк {i+1} успешно обработан ({len(chunk_response.text)} символов)")

    # Собрать гуманизированный текст из чанков
    humanized_text = "\n\n".join(humanized_chunks)
    logger.info(
        f"[HUMANIZE SUCCESS] Весь текст успешно гуманизирован через {len(chunks)} чанков. "
        f"Итоговый размер: {len(humanized_text)} символов"
    )

    response = LLMResponse(
        text=humanized_text,
        finish_reason="stop",
        usage=None,
        truncated=False
    )

    return response, chunk_info
