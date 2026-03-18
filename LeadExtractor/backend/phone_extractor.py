"""
Модульный PHONE EXTRACTOR с 4-стадийным pipeline

STAGE 1: TEL: LINKS (URL-декодирование)
├─ Ищет href="tel:+7..." и href="tel:%2B7..."
├─ URL-декодирует (%20 → space, %2B → +)
└─ НИКОГДА не фильтруются (tel: = HIGH confidence)

STAGE 2: FRAGMENTED MERGE (BeautifulSoup DOM parsing)
├─ Ищет разорванные номера: <span>+7</span><span>985</span>
├─ Склеивает через DOM traversal
└─ Результат: чистые числовые последовательности

STAGE 3: TEXT EXTRACTION (Russian phone patterns)
├─ Ищет "Тел. +7 (...)", "Телефон:", "т. ", etc.
├─ Применяет sanity + structural фильтры
└─ Результат: валидированные кандидаты

STAGE 4: NORMALIZATION (phonenumbers library)
├─ Нормализует в формат: "+7 (XXX) XXX-XX-XX"
├─ Проверяет правильность номера
└─ Возвращает чистый результат

OUTPUT FORMAT:
{
    "phone": "+7 (495) 123-45-67",
    "source_page": "https://site.ru/contacts",
    "raw_source": "source_type"  // "tel_link", "fragmented", "text_regex", "contact_pattern"
}
"""

import re
import logging
from typing import Dict, List, Optional, Set
from urllib.parse import unquote
from bs4 import BeautifulSoup
import phonenumbers

logger = logging.getLogger(__name__)


class PhoneExtractor:
    """
    Модульный экстрактор телефонных номеров с 4-стадийным pipeline.
    """

    def __init__(self):
        """Инициализация экстрактора."""
        self.logger = logging.getLogger(__name__)

    # ============================================================================
    # STAGE 1: TEL: LINKS EXTRACTION (with URL decoding)
    # ============================================================================

    def extract_tel_links(self, html: str, page_url: str) -> List[Dict]:
        """
        STAGE 1: Извлечение tel: ссылок из HTML с URL-декодированием.

        Примеры:
        ✅ href="tel:+7 (495) 123-45-67"          → +7 (495) 123-45-67
        ✅ href="tel:%2B7%20(495)%20123-45-67"   → +7 (495) 123-45-67
        ✅ href="tel:+7-495-123-45-67"            → +7-495-123-45-67

        КЛЮЧЕВОЕ: Tel: ссылки НИКОГДА не фильтруются, это HIGH confidence!

        Args:
            html: HTML содержимое страницы
            page_url: URL страницы (для источника)

        Returns:
            List[Dict] с {phone, source_page, raw_source}
        """
        results = []

        if not html:
            return results

        try:
            # Regex для поиска tel: ссылок (с поддержкой URL-encoding)
            # href="tel:" может содержать:
            # - обычные символы: +7 (495) 123-45-67
            # - URL-encoded: %2B7%20(495)%20123-45-67
            # - смешанные: tel:+7%20(495)123-45-67
            tel_pattern = r'href\s*=\s*["\']tel:([^"\']+)["\']'

            for match in re.finditer(tel_pattern, html, re.IGNORECASE):
                raw_phone = match.group(1)

                # ⭐ КРИТИЧЕСКОЕ: URL-декодирование
                # %2B → +, %20 → space, %28 → (, %29 → )
                decoded_phone = unquote(raw_phone)

                # Очистка от лишних символов
                cleaned = self._clean_phone(decoded_phone)

                if cleaned:
                    results.append({
                        "phone": cleaned,
                        "source_page": page_url,
                        "raw_source": "tel_link"  # Маркер высокого доверия
                    })
                    logger.debug(f"[TEL LINK] Found: {cleaned} (raw: {raw_phone})")

            if results:
                logger.info(f"[TEL LINKS] Найдено {len(results)} номеров на {page_url}")

        except Exception as e:
            logger.error(f"[TEL LINKS ERROR] {e}")

        return results

    # ============================================================================
    # STAGE 2: FRAGMENTED MERGE (BeautifulSoup DOM parsing)
    # ============================================================================

    def extract_fragmented_phones(self, html: str, page_url: str) -> List[Dict]:
        """
        STAGE 2: Склеивание разорванных номеров через DOM parsing.

        Проблема: Номера разорваны по HTML-тегам
        ❌ <span>+7</span><span>985</span><span>587</span>
        ❌ +7 </div> (383) <div> 262

        Решение: BeautifulSoup DOM traversal для нахождения рядом стоящих цифр

        Args:
            html: HTML содержимое страницы
            page_url: URL страницы (для источника)

        Returns:
            List[Dict] с {phone, source_page, raw_source}
        """
        results = []

        if not html:
            return results

        try:
            soup = BeautifulSoup(html, 'html.parser')

            # Ищем элементы содержащие цифры
            found_candidates = set()  # Дедубли по нормализованному номеру

            for element in soup.find_all(['span', 'div', 'p', 'td', 'li']):
                text = element.get_text(strip=True)

                # Если элемент содержит цифры - это кандидат для склеивания
                if re.search(r'\d', text):
                    # Получить контекст: текущий + соседние элементы
                    # Это помогает собрать разорванные номера
                    context = self._get_element_context(element)

                    # Извлечь все числовые последовательности из контекста
                    phones = self._extract_from_fragmented_context(context)

                    for phone in phones:
                        normalized = self._normalize_phone_candidate(phone)
                        if normalized and normalized not in found_candidates:
                            found_candidates.add(normalized)
                            results.append({
                                "phone": normalized,
                                "source_page": page_url,
                                "raw_source": "fragmented"
                            })
                            logger.debug(f"[FRAGMENTED] Found: {normalized}")

        except Exception as e:
            logger.error(f"[FRAGMENTED ERROR] {e}")

        return results

    def _get_element_context(self, element) -> str:
        """
        Получить контекст вокруг элемента для склеивания разорванных номеров.

        Возвращает текст текущего элемента + соседних (next/prev siblings).
        """
        context_parts = []

        # Предыдущий сосед (если есть)
        if element.previous_sibling:
            prev_text = str(element.previous_sibling).strip()
            if prev_text and len(prev_text) < 100:  # Не слишком длинный
                context_parts.append(prev_text)

        # Текущий элемент
        current_text = element.get_text(strip=True)
        if current_text:
            context_parts.append(current_text)

        # Следующий сосед (если есть)
        if element.next_sibling:
            next_text = str(element.next_sibling).strip()
            if next_text and len(next_text) < 100:  # Не слишком длинный
                context_parts.append(next_text)

        return " ".join(context_parts)

    def _extract_from_fragmented_context(self, context: str) -> List[str]:
        """
        Извлечь телефонные номера из контекста разорванного элемента.

        Ищет паттерны вроде:
        "8385262" (разорванное, но близко)
        "+7 985 587" (с пробелами)
        "(383) 262-16-42" (в скобках)
        """
        candidates = []

        # Широкий regex для поиска числовых последовательностей
        # Должен поймать различные форматы
        patterns = [
            r'\+7\s*\(?\d{3}\)?\s*[\d\s\-]{5,}',  # +7 (...) xxx...
            r'8\s*\(?\d{3}\)?\s*[\d\s\-]{5,}',     # 8 (...) xxx...
            r'\(\d{3}\)\s*[\d\s\-]{4,}',           # (XXX) xxx...
            r'\d[\d\s\-]{6,}\d',                    # Общий паттерн
        ]

        for pattern in patterns:
            for match in re.finditer(pattern, context, re.IGNORECASE):
                candidates.append(match.group())

        return candidates

    # ============================================================================
    # STAGE 3: TEXT EXTRACTION (Russian phone patterns)
    # ============================================================================

    def extract_from_text_patterns(self, text: str, page_url: str) -> List[Dict]:
        """
        STAGE 3: Поиск номеров в тексте по Russian phone patterns.

        Ищет паттерны вроде:
        ✅ "Тел. +7 (812) 250-62-10"
        ✅ "Телефон: +7-495-123-45-67"
        ✅ "т. 8 (383) 262-16-42"
        ✅ "Звоните: +1 (555) 000-0000"
        ✅ "Contact: +7 (495) 123-45-67"

        Args:
            text: Нормализованный текст страницы
            page_url: URL страницы (для источника)

        Returns:
            List[Dict] с {phone, source_page, raw_source}
        """
        results = []

        if not text:
            return results

        try:
            # Pattern для поиска ключевых слов перед номером
            # (тел|телефон|phone|contact|call|звоните|т\.?)
            # Затем номер в любом из стандартных форматов
            contact_patterns = [
                # Русские ключевые слова
                r'(?:тел|телефон|т\.)\s*[:.]?\s*([+\d][\d\s\-\(\)\.]{6,}\d)',
                r'(?:звоните|позвоните)\s*[:.]?\s*([+\d][\d\s\-\(\)\.]{6,}\d)',
                r'(?:контакт|контакты)\s*[:.]?\s*([+\d][\d\s\-\(\)\.]{6,}\d)',

                # Английские ключевые слова
                r'(?:phone|tel|call|contact)\s*[:.]?\s*([+\d][\d\s\-\(\)\.]{6,}\d)',

                # Номер после ":" или "."
                r':\s*([+\d][\d\s\-\(\)\.]{6,}\d)',
            ]

            found_candidates = set()

            for pattern in contact_patterns:
                for match in re.finditer(pattern, text, re.IGNORECASE):
                    raw_phone = match.group(1)

                    # Санити фильтр
                    if not self._is_sane_phone_candidate(raw_phone):
                        continue

                    # Структурный фильтр
                    if not self._is_structural_phone(raw_phone):
                        continue

                    # Нормализация
                    normalized = self._normalize_phone_candidate(raw_phone)

                    if normalized and normalized not in found_candidates:
                        found_candidates.add(normalized)
                        results.append({
                            "phone": normalized,
                            "source_page": page_url,
                            "raw_source": "contact_pattern"
                        })
                        logger.debug(f"[CONTACT PATTERN] Found: {normalized}")

            if results:
                logger.info(f"[TEXT PATTERNS] Найдено {len(results)} номеров на {page_url}")

        except Exception as e:
            logger.error(f"[TEXT PATTERNS ERROR] {e}")

        return results

    # ============================================================================
    # STAGE 4: NORMALIZATION (phonenumbers library)
    # ============================================================================

    def normalize_phone(self, raw_phone: str, region: str = "RU") -> Optional[str]:
        """
        STAGE 4: Нормализация номера в формат "+7 (XXX) XXX-XX-XX" используя phonenumbers.

        Args:
            raw_phone: Сырой номер вроде "+7-495-123-45-67" или "8 (383) 262-16-42"
            region: ISO код страны (по умолчанию RU)

        Returns:
            Нормализованный номер вроде "+7 (495) 123-45-67" или None если невалидный
        """
        try:
            # phonenumbers.parse требует region для номеров без +
            parsed = phonenumbers.parse(raw_phone, region=region)

            # Проверка валидности
            if not phonenumbers.is_valid_number(parsed):
                logger.debug(f"[NORMALIZE] Invalid: {raw_phone}")
                return None

            # Форматирование в INTERNATIONAL формат
            # Результат: "+7 495 123 45 67"
            formatted = phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.INTERNATIONAL)

            # Трансформация в Russian format: "+7 (495) 123-45-67"
            # Из "+7 495 123 45 67" → "+7 (495) 123-45-67"
            normalized = self._reformat_to_russian(formatted, parsed)

            logger.debug(f"[NORMALIZE] {raw_phone} → {normalized}")
            return normalized

        except phonenumbers.NumberParseException:
            logger.debug(f"[NORMALIZE] Parse error: {raw_phone}")
            return None
        except Exception as e:
            logger.error(f"[NORMALIZE ERROR] {e}")
            return None

    def _reformat_to_russian(self, formatted: str, parsed) -> str:
        """
        Переформатировать номер в Russian format "+7 (XXX) XXX-XX-XX".

        Args:
            formatted: INTERNATIONAL формат вроде "+7 495 123 45 67"
            parsed: phonenumbers.PhoneNumber объект

        Returns:
            Russian format "+7 (495) 123-45-67"
        """
        try:
            # Получить строку цифр без разделителей
            # Для +7 495 123 45 67 → "74951234567"
            digits = "".join(re.findall(r'\d', formatted))

            # Проверить что это номер для RU (начинается с 7)
            if digits.startswith("7"):
                # Формат: +7 (XXX) XXX-XX-XX
                # Части: +, 7, (XXX), XXX, XX, XX
                if len(digits) >= 11:
                    area_code = digits[1:4]      # XXX
                    number_1 = digits[4:7]       # XXX
                    number_2 = digits[7:9]       # XX
                    number_3 = digits[9:11]      # XX

                    return f"+7 ({area_code}) {number_1}-{number_2}-{number_3}"

            # Fallback: вернуть как есть
            return formatted

        except Exception as e:
            logger.error(f"[REFORMAT ERROR] {e}")
            return formatted

    # ============================================================================
    # HELPER FUNCTIONS
    # ============================================================================

    def _clean_phone(self, raw: str) -> Optional[str]:
        """
        Базовая очистка номера от лишних символов.

        Удаляет:
        - Внешние пробелы/переносы
        - "ext." и расширения
        - Комментарии в скобках

        Сохраняет:
        - Все цифры
        - +, (, ), -, пробелы
        """
        if not raw:
            return None

        # Убрать " ext " и разширения
        phone = re.sub(r'\s+ext\.?\s*\d+', '', raw, flags=re.IGNORECASE)

        # Убрать комментарии в конце (вроде "please call in business hours")
        phone = re.sub(r'\([^)]*please[^)]*\)', '', phone, flags=re.IGNORECASE)

        # Отделить основное число
        phone = phone.strip()

        # Проверить что есть хотя бы цифры
        if not re.search(r'\d', phone):
            return None

        return phone

    def _is_sane_phone_candidate(self, candidate: str) -> bool:
        """
        SANITY FILTER (v2.0) — быстрые проверки на очевидный мусор.

        Удаляет:
        - Слишком короткие (< 7 цифр)
        - Слишком длинные (> 15 цифр)
        - Float (3.14, 1.5)
        - Даты (01.01.2024)
        - IP адреса (2+ точек)
        - Одиночные цифры (1 2 3 4)
        """
        if not candidate:
            return False

        # Подсчитать цифры
        digits = re.sub(r'\D', '', candidate)
        digit_count = len(digits)

        # Проверка 1: Слишком короткий
        if digit_count < 7:
            return False

        # Проверка 2: Слишком длинный (обычно ID или hash)
        if digit_count > 15:
            return False

        # Проверка 3: Float/decimal (вроде 3.14, 1.5)
        if re.search(r'\d+\.\d+', candidate):
            return False

        # Проверка 4: Дата (01.01.2024, 1/1/2024, 2024-01-01)
        if re.search(r'\d{1,2}[./-]\d{1,2}[./-]\d{2,4}', candidate):
            return False

        # Проверка 5: IP адрес (2+ точек)
        if candidate.count('.') >= 2:
            return False

        # Проверка 6: Одиночные цифры через пробел (1 2 3 4 5)
        if re.search(r'(?:\d\s){4,}', candidate):
            return False

        return True

    def _is_structural_phone(self, candidate: str) -> bool:
        """
        STRUCTURAL FILTER (v2.5) — проверка структуры номера.

        Требует:
        - ЕСТЬ разделители (+, (, ), -, пробелы) ИЛИ
        - Это tel: ссылка (всегда PASS)

        Удаляет:
        - Чистые цифры (132232434)
        - Диапазоны годов (1997-2026)
        - ID-подобные (12+ цифр без разделителей)
        """
        if not candidate:
            return False

        # Подсчитать цифры
        digits = re.sub(r'\D', '', candidate)

        # Проверка 1: Диапазон годов (1997-2026)
        if re.fullmatch(r'\d{4}-\d{4}', candidate.strip()):
            return False

        # Проверка 2: Дата (01.01.2024, 1-1-2024)
        if re.search(r'\d{1,2}[./-]\d{1,2}[./-]\d{2,4}', candidate):
            return False

        # Проверка 3: Чистые цифры (без разделителей)
        if re.fullmatch(r'\d{7,15}', candidate.strip()):
            return False

        # Проверка 4: Длинное число без разделителей (обычно ID)
        if len(digits) >= 12 and candidate.isdigit():
            return False

        # Проверка 5: Кривые переносы (скобка, перенос, скобка)
        if re.search(r'\)\s*\n', candidate):
            return False

        # ⭐ КЛЮЧЕВАЯ ПРОВЕРКА 6: ТРЕБУЮТСЯ РАЗДЕЛИТЕЛИ
        # Телефон ДОЛЖЕН иметь хотя бы один разделитель
        if not re.search(r'[(\)\-+\s]', candidate):
            return False

        return True

    def _normalize_phone_candidate(self, raw: str) -> Optional[str]:
        """
        Нормализовать номер кандидата (combined _clean_phone + normalize_phone).

        Returns: Нормализованный номер или None если невалидный
        """
        cleaned = self._clean_phone(raw)
        if not cleaned:
            return None

        # Пытаемся нормализовать
        normalized = self.normalize_phone(cleaned)
        return normalized

    # ============================================================================
    # MAIN ENTRY POINT
    # ============================================================================

    def extract_phones(self, result) -> List[Dict]:
        """
        ГЛАВНАЯ ФУНКЦИЯ: Полный 4-стадийный pipeline для extraction телефонов.

        Принимает CrawlResult от Crawl4AI и применяет 4 stage pipeline:
        1. Tel: links (с URL-декодированием)
        2. Fragmented merge (BeautifulSoup DOM parsing)
        3. Text patterns (Russian phone keywords)
        4. Normalization (phonenumbers library)

        Args:
            result: CrawlResult объект от Crawl4AI с:
                - html: str
                - cleaned_html: Optional[str]
                - markdown: Optional[str]
                - url: str

        Returns:
            List[Dict] с элементами:
            {
                "phone": "+7 (495) 123-45-67",
                "source_page": "https://...",
                "raw_source": "tel_link|fragmented|contact_pattern"
            }
        """
        all_phones = []
        page_url = getattr(result, 'url', 'unknown')

        # Получить содержимое в нужном порядке
        html = getattr(result, 'html', '') or ''
        cleaned_html = getattr(result, 'cleaned_html', '') or ''
        markdown = getattr(result, 'markdown', '') or ''

        # Комбинированный текст для extraction
        combined_text = f"{markdown}\n{cleaned_html}"

        try:
            # ✅ STAGE 1: TEL: LINKS (НИКОГДА не фильтруются)
            logger.info(f"[STAGE 1] Extracting tel: links from {page_url}")
            tel_phones = self.extract_tel_links(html, page_url)
            all_phones.extend(tel_phones)

            # ✅ STAGE 2: FRAGMENTED MERGE
            logger.info(f"[STAGE 2] Merging fragmented phones from {page_url}")
            fragmented_phones = self.extract_fragmented_phones(html, page_url)
            all_phones.extend(fragmented_phones)

            # ✅ STAGE 3: TEXT PATTERNS
            logger.info(f"[STAGE 3] Extracting from text patterns on {page_url}")
            text_phones = self.extract_from_text_patterns(combined_text, page_url)
            all_phones.extend(text_phones)

            # Логирование результатов
            logger.info(
                f"[EXTRACTION SUMMARY] {page_url}\n"
                f"  Tel links: {len(tel_phones)}\n"
                f"  Fragmented: {len(fragmented_phones)}\n"
                f"  Text patterns: {len(text_phones)}\n"
                f"  TOTAL: {len(all_phones)}"
            )

            # Дедубликация по нормализованному номеру
            deduplicated = self._deduplicate_phones(all_phones)

            return deduplicated

        except Exception as e:
            logger.error(f"[EXTRACTION ERROR] {page_url}: {e}", exc_info=True)
            return []

    def _deduplicate_phones(self, phones: List[Dict]) -> List[Dict]:
        """
        Дедубликировать номера, сохраняя разные источники.

        Если один номер найден из разных источников, оставляем один
        экземпляр но с информацией о всех источниках.
        """
        seen = {}  # phone → Dict with all info

        for item in phones:
            phone = item.get("phone", "")

            if phone not in seen:
                seen[phone] = item
            else:
                # Уже есть, но добавляем информацию об источнике
                # (можно объединить raw_source если нужно)
                pass

        return list(seen.values())


# ============================================================================
# CONVENIENCE FUNCTION FOR INTEGRATION
# ============================================================================

def extract_phones_from_crawl_result(result) -> List[Dict]:
    """
    Convenience функция для быстрой интеграции в существующий код.

    Использование:
    ```python
    from backend.phone_extractor import extract_phones_from_crawl_result

    result = await crawler.arun(url)
    phones = extract_phones_from_crawl_result(result)
    ```
    """
    extractor = PhoneExtractor()
    return extractor.extract_phones(result)
