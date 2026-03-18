"""
PHONE FINAL VALIDATOR — финальная валидация с LLM (GPT-4o-mini)

Pipeline:
  1. URL-декодирование (urllib.parse.unquote)
  2. phonenumbers валидация (если успешно → confidence=high)
  3. Если phonenumbers не справился → LLM валидация (GPT-4o-mini)
  4. Кэширование LLM ответов (чтобы не тратить токены)
  5. Дедубликация и confidence scoring

РЕЗУЛЬТАТ: только реальные русские номера в формате +7 (XXX) XXX-XX-XX
"""

import os
import re
import json
import logging
from typing import Optional, List, Dict
from urllib.parse import unquote
from hashlib import md5

import phonenumbers
from openai import OpenAI
from dotenv import load_dotenv

# ⭐ КРИТИЧНО: Загрузить .env переменные
load_dotenv()

logger = logging.getLogger(__name__)

# Инициализировать OpenAI клиент
try:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError(
            "❌ OPENAI_API_KEY не найден в .env\n"
            "Добавьте в .env: OPENAI_API_KEY=sk-..."
        )
    client = OpenAI(api_key=api_key)
except Exception as e:
    logger.warning(f"[LLM] Инициализация OpenAI failed: {e}")
    client = None


class PhoneFinalValidator:
    """
    Финальный валидатор телефонных номеров с LLM поддержкой.

    Использует гибридный подход:
    1. Быстрая валидация через phonenumbers (95% случаев)
    2. LLM валидация для сомнительных случаев (5%)
    3. Кэширование LLM ответов
    """

    def __init__(self, region: str = "RU", use_llm: bool = True):
        """
        Инициализация валидатора.

        Args:
            region: ISO код страны (default: RU)
            use_llm: Использовать LLM для сомнительных случаев (default: True)
        """
        self.region = region
        self.use_llm = use_llm and client is not None  # Только если OpenAI доступен
        self.logger = logging.getLogger(__name__)

        # Кэш для LLM ответов
        # Ключ: хэш кандидатов, Значение: результаты валидации
        self.llm_cache = {}

        if self.use_llm:
            self.logger.info("[LLM] GPT-4o-mini валидация ВКЛЮЧЕНА")
        else:
            self.logger.warning("[LLM] GPT-4o-mini валидация ОТКЛЮЧЕНА")

    # ========================================================================
    # ГЛАВНАЯ ФУНКЦИЯ: VALIDATE PHONES
    # ========================================================================

    def validate_phones(
        self,
        phones_list: List[Dict],
        page_url: str = "unknown",
        page_text: str = ""
    ) -> List[Dict]:
        """
        Главная функция: финальная валидация списка телефонов.

        Pipeline:
        1. URL-декодирование каждого номера
        2. phonenumbers валидация (если ок → confidence=high)
        3. Если phonenumbers не справился → LLM валидация (если enabled)
        4. Дедубликация
        5. Возврат только реальных номеров с confidence

        Args:
            phones_list: List[Dict] с ключами: phone, source_page, raw
                       Пример: [{"phone": "+7 (812)...", "source_page": "...", "raw": "..."}]
            page_url: URL страницы (для контекста LLM)
            page_text: Текст страницы (первые 500 символов используются для контекста)

        Returns:
            List[Dict] с нормализованными номерами:
            {
                "phone": "+7 (812) 250-62-10",
                "source_page": "https://is1c.ru/contacts",
                "confidence": "high|medium|low",
                "method": "phonenumbers|llm"
            }

        Examples:
            >>> validator = PhoneFinalValidator()
            >>> raw_phones = [
            ...     {"phone": "+7 (812) 250-62-10", "source_page": "https://..."},
            ...     {"phone": "+7%20(812)%20250-62-10%20", "source_page": "https://..."},
            ...     {"phone": "237153142)", "source_page": "https://..."},
            ... ]
            >>> validated = validator.validate_phones(raw_phones, page_url="https://...")
            >>> for p in validated:
            ...     print(f"{p['phone']} ({p['confidence']})")
        """
        if not phones_list:
            self.logger.info("[VALIDATION] Empty list, returning []")
            return []

        validated = []
        candidates_for_llm = []  # Номера которые не прошли phonenumbers

        self.logger.info(
            f"[VALIDATION START] {len(phones_list)} phones from {page_url}"
        )

        # ============================================================================
        # ШАГ 1: phonenumbers валидация для каждого номера
        # ============================================================================
        for phone_info in phones_list:
            raw_phone = phone_info.get("phone", "")
            source_page = phone_info.get("source_page", page_url)

            # URL-декодирование
            decoded = unquote(raw_phone)

            # Пытаемся валидировать через phonenumbers
            normalized = self._validate_via_phonenumbers(decoded)

            if normalized:
                # ✅ Успешно прошёл phonenumbers
                validated.append({
                    "phone": normalized,
                    "source_page": source_page,
                    "confidence": "high",  # phonenumbers = HIGH confidence
                    "method": "phonenumbers"
                })
                self.logger.debug(f"[PHONENUMBERS ✅] {decoded} → {normalized}")

            else:
                # ❌ Не прошёл phonenumbers → в список для LLM
                candidates_for_llm.append({
                    "raw": decoded,
                    "source_page": source_page,
                    "original": raw_phone
                })
                self.logger.debug(f"[PHONENUMBERS ❌] {decoded} → в LLM очередь")

        self.logger.info(
            f"[PHONENUMBERS RESULT] ✅ {len(validated)} passed, "
            f"❌ {len(candidates_for_llm)} failed"
        )

        # ============================================================================
        # ШАГ 2: LLM валидация для оставшихся кандидатов
        # ============================================================================
        if candidates_for_llm and self.use_llm:
            self.logger.info(
                f"[LLM VALIDATION] Starting for {len(candidates_for_llm)} candidates"
            )
            llm_results = self._validate_via_llm(
                candidates_for_llm,
                page_url,
                page_text
            )
            validated.extend(llm_results)

        # ============================================================================
        # ШАГ 3: Дедубликация и финальный вывод
        # ============================================================================
        deduplicated = self._deduplicate(validated)

        self.logger.info(
            f"[VALIDATION SUMMARY] {page_url}\n"
            f"  ✅ phonenumbers: {len([p for p in deduplicated if p['method'] == 'phonenumbers'])}\n"
            f"  ✅ LLM: {len([p for p in deduplicated if p['method'] == 'llm'])}\n"
            f"  📊 ИТОГО: {len(deduplicated)} номеров"
        )

        return deduplicated

    # ========================================================================
    # ЭТАП 1: PHONENUMBERS ВАЛИДАЦИЯ
    # ========================================================================

    def _validate_via_phonenumbers(self, candidate: str) -> Optional[str]:
        """
        Валидировать номер через phonenumbers library.

        Это быстрое и надёжное решение для большинства номеров.

        Args:
            candidate: Кандидат на номер (вроде "+7 (812) 250-62-10")

        Returns:
            Нормализованный номер "+7 (XXX) XXX-XX-XX" или None
        """
        try:
            # Парсинг с указанием региона
            parsed = phonenumbers.parse(candidate, region=self.region)

            # Проверка валидности через официальную БД
            if not phonenumbers.is_valid_number(parsed):
                self.logger.debug(f"[PHONENUMBERS] Invalid: {candidate}")
                return None

            # Форматирование в INTERNATIONAL
            formatted = phonenumbers.format_number(
                parsed,
                phonenumbers.PhoneNumberFormat.INTERNATIONAL
            )

            # Переформатирование в Russian format
            normalized = self._reformat_to_russian(formatted)
            return normalized

        except phonenumbers.NumberParseException:
            self.logger.debug(f"[PHONENUMBERS] Parse error: {candidate}")
            return None
        except Exception as e:
            self.logger.debug(f"[PHONENUMBERS] Error: {candidate}: {e}")
            return None

    def _reformat_to_russian(self, formatted: str) -> str:
        """
        Переформатировать "+7 495 123 45 67" → "+7 (495) 123-45-67"

        Args:
            formatted: INTERNATIONAL формат от phonenumbers

        Returns:
            Russian format "+7 (XXX) XXX-XX-XX"
        """
        try:
            # Извлечь только цифры
            digits = re.sub(r'\D', '', formatted)

            # Проверить что это Russian номер (начинается с 7) и достаточно длинный
            if digits.startswith("7") and len(digits) >= 11:
                # Разбить: 7 + (ABC) + DEF-GH-IJ
                area_code = digits[1:4]      # "495"
                number_1 = digits[4:7]       # "123"
                number_2 = digits[7:9]       # "45"
                number_3 = digits[9:11]      # "67"

                return f"+7 ({area_code}) {number_1}-{number_2}-{number_3}"

            # Fallback: вернуть как есть
            return formatted

        except Exception as e:
            self.logger.debug(f"[REFORMAT] Error: {e}")
            return formatted

    # ========================================================================
    # ЭТАП 2: LLM ВАЛИДАЦИЯ (GPT-4o-mini)
    # ========================================================================

    def _validate_via_llm(
        self,
        candidates: List[Dict],
        page_url: str,
        page_text: str
    ) -> List[Dict]:
        """
        Валидировать сомнительные номера через GPT-4o-mini.

        Это медленнее но мощнее, используется только для номеров которые
        phonenumbers не смог распарсить.

        Args:
            candidates: Список кандидатов вроде [{"raw": "237153142)", ...}]
            page_url: URL страницы
            page_text: Текст страницы для контекста

        Returns:
            List[Dict] с валидированными номерами (если LLM их одобрил)
        """
        if not candidates or not client:
            return []

        # ====== Проверить кэш ======
        cache_key = self._get_cache_key(candidates, page_url)

        if cache_key in self.llm_cache:
            self.logger.info(f"[LLM CACHE HIT] {len(candidates)} candidates from cache")
            return self.llm_cache[cache_key]

        self.logger.info(
            f"[LLM API CALL] Sending {len(candidates)} candidates to GPT-4o-mini"
        )

        try:
            # ====== Подготовить данные для LLM ======
            candidates_text = "\n".join([
                f"- {c['raw']}"
                for c in candidates
            ])

            # Контекст страницы (первые 500 символов)
            page_context = page_text[:500] if page_text else "(нет контекста)"

            # ====== Создать промпт ======
            prompt = f"""Ты эксперт по очистке контактных данных. Твоя задача:

Вот список кандидатов телефонов с сайта {page_url}

Контекст страницы:
{page_context}

Кандидаты телефонов:
{candidates_text}

Требования:
1. Оставить ТОЛЬКО реальные российские номера
2. Номер должен быть +7 или 8 в начале
3. Привести в формат: +7 (XXX) XXX-XX-XX
4. Удалить:
   - Мусор (237153142), +7, обрезанные номера)
   - Даты (01.01.2024, 2024-01-01, -03022026.)
   - Обрезанные номера ((55036117, без полной последовательности)
   - Очень короткие (+7, 8)
   - Неполные (без нужного количества цифр)
   - IP адреса (192.168.1.1)

Вернуть JSON (только JSON, без дополнительного текста):
{{"phones": ["+7 (812) 250-62-10", "+7 (383) 209-21-27"]}}

Если нет валидных номеров, вернуть:
{{"phones": []}}
"""

            # ====== Отправить запрос к GPT-4o-mini ======
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "Ты эксперт по очистке контактных данных. "
                            "Ты ДОЛЖЕН возвращать ТОЛЬКО JSON в формате "
                            '{{"phones": [...]}}, без дополнительного текста.'
                        )
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0,      # Детерминированный ответ
                max_tokens=500,     # Достаточно для списка номеров
                top_p=1
            )

            # ====== Парсить ответ ======
            response_text = response.choices[0].message.content.strip()

            self.logger.debug(f"[LLM RESPONSE] {response_text[:200]}")

            # Попытаться парсить JSON
            try:
                result = json.loads(response_text)
                validated_phones = result.get("phones", [])

                if not isinstance(validated_phones, list):
                    validated_phones = []

            except json.JSONDecodeError:
                # Fallback: попытаться извлечь номера регексом
                self.logger.warning(
                    f"[LLM JSON ERROR] Could not parse JSON. "
                    f"Response: {response_text[:100]}"
                )
                validated_phones = re.findall(
                    r'\+7\s*\(\d{3}\)\s*\d{3}-\d{2}-\d{2}',
                    response_text
                )

            # ====== Составить результат ======
            results = []
            for phone in validated_phones:
                results.append({
                    "phone": phone,
                    "source_page": page_url,
                    "confidence": "medium",  # LLM = MEDIUM confidence
                    "method": "llm"
                })

            self.logger.info(
                f"[LLM RESULT] ✅ Approved {len(results)} phones, "
                f"❌ Rejected {len(candidates) - len(results)}"
            )

            # ====== Сохранить в кэш ======
            self.llm_cache[cache_key] = results

            return results

        except Exception as e:
            self.logger.error(f"[LLM ERROR] {e}", exc_info=True)
            return []

    def _get_cache_key(self, candidates: List[Dict], page_url: str) -> str:
        """
        Создать ключ кэша из кандидатов.

        Нужен чтобы не отправлять одни и те же номера в LLM дважды.

        Args:
            candidates: Список кандидатов
            page_url: URL страницы

        Returns:
            Строка ключа кэша
        """
        candidate_str = "|".join([c['raw'] for c in candidates])
        hash_val = md5(candidate_str.encode()).hexdigest()
        return f"{page_url}:{hash_val}"

    # ========================================================================
    # HELPER: ДЕДУБЛИКАЦИЯ
    # ========================================================================

    def _deduplicate(self, phones: List[Dict]) -> List[Dict]:
        """
        Дедубликировать по нормализованному номеру.

        Если один номер найден из разных источников, оставляем только один.

        Args:
            phones: Список телефонов

        Returns:
            Дедубликированный список
        """
        seen = {}
        for p in phones:
            phone = p.get("phone", "")
            if phone not in seen:
                seen[phone] = p

        return list(seen.values())


# ============================================================================
# CONVENIENCE FUNCTIONS
# ============================================================================

def validate_phones(
    phones_list: List[Dict],
    page_url: str = "unknown",
    page_text: str = "",
    use_llm: bool = True
) -> List[Dict]:
    """
    Convenience функция для быстрого использования.

    Usage:
        from phone_final_validator import validate_phones

        validated = validate_phones(
            raw_phones,
            page_url="https://is1c.ru",
            page_text=markdown_content
        )
    """
    validator = PhoneFinalValidator(use_llm=use_llm)
    return validator.validate_phones(phones_list, page_url, page_text)


# ============================================================================
# ТЕСТИРОВАНИЕ
# ============================================================================

if __name__ == "__main__":
    logging.basicConfig(
        level=logging.DEBUG,
        format='%(levelname)s - %(name)s - %(message)s'
    )

    validator = PhoneFinalValidator(use_llm=True)

    # Примеры проблемных номеров
    test_phones = [
        {
            "phone": "+7 (812) 250-62-10",
            "source_page": "https://is1c.ru",
            "raw": "+7 (812) 250-62-10"
        },
        {
            "phone": "+7%20(812)%20250-62-10%20",
            "source_page": "https://is1c.ru",
            "raw": "+7%20(812)%20250-62-10%20"
        },
        {
            "phone": "237153142)",
            "source_page": "https://is1c.ru",
            "raw": "237153142)"
        },
        {
            "phone": "+7",
            "source_page": "https://is1c.ru",
            "raw": "+7"
        },
        {
            "phone": "-03022026.",
            "source_page": "https://is1c.ru",
            "raw": "-03022026."
        },
    ]

    print("=" * 70)
    print("PHONE FINAL VALIDATOR — TEST")
    print("=" * 70)

    validated = validator.validate_phones(
        test_phones,
        page_url="https://is1c.ru",
        page_text="Контакты компании. Позвоните нам по тел. (812) 250-62-10"
    )

    print(f"\nРезультат: {len(validated)} валидных номеров\n")
    for phone_info in validated:
        print(f"✅ {phone_info['phone']}")
        print(f"   Confidence: {phone_info['confidence']}")
        print(f"   Method: {phone_info['method']}")
        print()
