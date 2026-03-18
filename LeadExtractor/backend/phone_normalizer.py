"""
PHONE NORMALIZER — Модуль для очистки и нормализации телефонных номеров

Решает проблемы:
  ❌ +7%20(812)%20250-62-10%20  → ✅ +7 (812) 250-62-10
  ❌ 237153142)                 → ✅ (удалено - мусор)
  ❌ +7                         → ✅ (удалено - слишком короткий)
  ❌ -03022026.                 → ✅ (удалено - дата)
  ❌ (55036117                  → ✅ (удалено - неполный номер)

АРХИТЕКТУРА:
  1. URL-декодирование (urllib.parse.unquote)
  2. Санити-проверка (минимальное количество цифр, не дата, не мусор)
  3. Нормализация phonenumbers library
  4. Fallback regex для русских номеров
  5. Финальная проверка качества

OUTPUT FORMAT:
  {
    "phone": "+7 (812) 250-62-10",
    "source_page": "https://is1c.ru/contacts",
    "raw": "+7%20(812)%20250-62-10%20"
  }
"""

import re
import logging
from typing import Optional, List, Dict
from urllib.parse import unquote
from bs4 import BeautifulSoup
import phonenumbers

logger = logging.getLogger(__name__)


class PhoneNormalizer:
    """
    Нормализатор телефонных номеров с поддержкой русских форматов.

    Используется для:
    1. Очистки URL-кодированных номеров (%20, %2B, и т.д.)
    2. Нормализации разных форматов в единый стандарт
    3. Удаления мусора и неполных номеров
    4. Дедубликации по нормализованному номеру
    """

    def __init__(self, region: str = "RU"):
        """
        Инициализация нормализатора.

        Args:
            region: ISO код страны (по умолчанию RU для России)
        """
        self.region = region
        self.logger = logging.getLogger(__name__)

    # ============================================================================
    # ГЛАВНАЯ ФУНКЦИЯ: НОРМАЛИЗАЦИЯ
    # ============================================================================

    def normalize_phone(self, raw: str) -> Optional[str]:
        """
        Нормализовать сырой телефонный номер в стандартный формат.

        Pipeline:
        1. URL-декодирование (urllib.parse.unquote)
        2. Базовая очистка (whitespace, лишние символы)
        3. Санити-проверка (не дата, не ID, не мусор)
        4. Нормализация через phonenumbers
        5. Fallback на русский regex если phonenumbers не сработал
        6. Финальная проверка качества

        Args:
            raw: Сырой номер, например:
                 - "+7%20(812)%20250-62-10"
                 - "+7-495-123-45-67"
                 - "8 (383) 262-16-42"
                 - "tel:+7(812)250-62-10"

        Returns:
            Нормализованный номер "+7 (812) 250-62-10" или None если невалидный

        Examples:
            >>> normalizer = PhoneNormalizer()
            >>> normalizer.normalize_phone("+7%20(812)%20250-62-10%20")
            '+7 (812) 250-62-10'
            >>> normalizer.normalize_phone("237153142)")  # Мусор
            None
            >>> normalizer.normalize_phone("+7")  # Слишком короткий
            None
        """
        if not raw or not isinstance(raw, str):
            return None

        try:
            # ШАГ 1: URL-декодирование
            # Пример: "%2B7%20(812)%20250-62-10" → "+7 (812) 250-62-10"
            decoded = unquote(raw)

            # ШАГ 2: Базовая очистка
            cleaned = self._basic_cleanup(decoded)
            if not cleaned:
                return None

            # ШАГ 3: Санити-проверка (не дата, не ID, не мусор)
            if not self._is_sane_candidate(cleaned):
                self.logger.debug(f"[NORMALIZE] Sanity check failed: {raw}")
                return None

            # ШАГ 4: Пытаемся нормализовать через phonenumbers
            normalized = self._normalize_via_phonenumbers(cleaned)
            if normalized:
                return normalized

            # ШАГ 5: Fallback на русский regex для особых случаев
            normalized = self._normalize_via_regex(cleaned)
            if normalized:
                return normalized

            return None

        except Exception as e:
            self.logger.debug(f"[NORMALIZE ERROR] {raw}: {e}")
            return None

    # ============================================================================
    # ШАГИ НОРМАЛИЗАЦИИ
    # ============================================================================

    def _basic_cleanup(self, raw: str) -> Optional[str]:
        """
        Базовая очистка номера от явного мусора.

        Удаляет:
        - Whitespace в начале/конце
        - "tel:" префикс
        - "ext" расширения
        - Комментарии в скобках

        Args:
            raw: Сырой номер

        Returns:
            Очищенный номер или None если совсем ничего нет
        """
        if not raw:
            return None

        phone = raw.strip()

        # Убрать "tel:" префикс
        if phone.lower().startswith("tel:"):
            phone = phone[4:]

        # Убрать "ext" расширения (вроде "ext. 123", "ext 456")
        phone = re.sub(r'\s*ext\.?\s*\d+', '', phone, flags=re.IGNORECASE)
        phone = re.sub(r'\s*доб\.?\s*\d+', '', phone, flags=re.IGNORECASE)

        # Убрать комментарии в конце (вроде "please call in business hours")
        phone = re.sub(r'\s*\([^)]*please[^)]*\)', '', phone, flags=re.IGNORECASE)

        phone = phone.strip()

        # Проверить что есть хотя бы какие-то цифры
        if not re.search(r'\d', phone):
            return None

        return phone

    def _is_sane_candidate(self, candidate: str) -> bool:
        """
        Санити-проверка: отфильтровать очевидный мусор.

        Отклоняет:
        - Слишком короткие (<7 цифр)
        - Слишком длинные (>15 цифр)
        - Даты (01.01.2024, 2024-01-01)
        - Float числа (3.14)
        - IP адреса (2+ точек)
        - ID-подобные (много цифр без разделителей)
        - Год (1997-2026 формат)

        Args:
            candidate: Кандидат на номер

        Returns:
            True если выглядит как телефон, False если явный мусор
        """
        if not candidate:
            return False

        # Подсчитать цифры
        digits = re.sub(r'\D', '', candidate)
        digit_count = len(digits)

        # Проверка 1: Слишком короткий номер (< 7 цифр)
        if digit_count < 7:
            self.logger.debug(f"[SANITY] Too short ({digit_count} digits): {candidate}")
            return False

        # Проверка 2: Слишком длинный (> 15 цифр по E.164 стандарту)
        if digit_count > 15:
            self.logger.debug(f"[SANITY] Too long ({digit_count} digits): {candidate}")
            return False

        # Проверка 3: Float/decimal числа (вроде 3.14, 1.5)
        # Пример: "237153142.5" → это явно не телефон
        if re.search(r'\d+\.\d+', candidate):
            self.logger.debug(f"[SANITY] Float detected: {candidate}")
            return False

        # Проверка 4: Дата (только если это ИСКЛЮЧИТЕЛЬНО дата)
        # Дата: "01.01.2024" или "2024-01-01" (без других символов)
        # НЕ ловим "250-62-10" (это часть номера!)
        candidate_clean = candidate.strip()
        if re.fullmatch(r'\d{1,2}[./-]\d{1,2}[./-]\d{4}', candidate_clean) or \
           re.fullmatch(r'\d{4}[./-]\d{1,2}[./-]\d{1,2}', candidate_clean):
            self.logger.debug(f"[SANITY] Date detected: {candidate}")
            return False

        # Проверка 5: IP адрес (2+ точек)
        # Пример: "192.168.1.1" → явно IP
        if candidate.count('.') >= 2:
            self.logger.debug(f"[SANITY] IP detected: {candidate}")
            return False

        # Проверка 6: Год в формате "1997-2026"
        if re.fullmatch(r'\d{4}-\d{4}', candidate.strip()):
            self.logger.debug(f"[SANITY] Year range detected: {candidate}")
            return False

        # Проверка 7: Много одиночных цифр через пробелы (1 2 3 4 5)
        # Это признак мусора или опечатки
        if re.search(r'(?:\d\s){4,}', candidate):
            self.logger.debug(f"[SANITY] Single digits: {candidate}")
            return False

        return True

    def _normalize_via_phonenumbers(self, candidate: str) -> Optional[str]:
        """
        Нормализовать через phonenumbers library.

        Эта функция ОСНОВНОЙ способ нормализации.
        Она парсит номер, проверяет валидность, и форматирует в INTERNATIONAL формат.

        Args:
            candidate: Кандидат на номер

        Returns:
            Нормализованный номер "+7 (812) 250-62-10" или None если невалидный
        """
        try:
            # Парсинг с указанием региона (RU для России)
            # phonenumbers требует регион для номеров без +
            parsed = phonenumbers.parse(candidate, region=self.region)

            # Проверка валидности
            if not phonenumbers.is_valid_number(parsed):
                self.logger.debug(f"[PHONENUMBERS] Invalid: {candidate}")
                return None

            # Форматирование в INTERNATIONAL формат
            # Результат: "+7 495 123 45 67"
            formatted = phonenumbers.format_number(
                parsed,
                phonenumbers.PhoneNumberFormat.INTERNATIONAL
            )

            # Преобразование "+7 495 123 45 67" → "+7 (495) 123-45-67"
            normalized = self._reformat_international_to_russian(formatted)

            self.logger.debug(f"[PHONENUMBERS] {candidate} → {normalized}")
            return normalized

        except phonenumbers.NumberParseException:
            self.logger.debug(f"[PHONENUMBERS] Parse error: {candidate}")
            return None
        except Exception as e:
            self.logger.debug(f"[PHONENUMBERS ERROR] {candidate}: {e}")
            return None

    def _reformat_international_to_russian(self, formatted: str) -> str:
        """
        Переформатировать INTERNATIONAL формат в Russian формат.

        Преобразование:
        "+7 495 123 45 67" → "+7 (495) 123-45-67"

        Args:
            formatted: INTERNATIONAL формат вроде "+7 495 123 45 67"

        Returns:
            Russian format "+7 (495) 123-45-67"
        """
        try:
            # Получить только цифры
            # "+7 495 123 45 67" → "74951234567"
            digits = re.sub(r'\D', '', formatted)

            # Проверить что это номер для Russia (+7)
            if digits.startswith("7") and len(digits) >= 11:
                # Формат: +7 (XXX) XXX-XX-XX
                # Где:
                #   7 = страна Russia
                #   XXX = area code (3 цифры)
                #   XXX = первые 3 цифры номера
                #   XX = средние 2 цифры
                #   XX = последние 2 цифры
                area_code = digits[1:4]      # digits[1:4] = "495" из "74951234567"
                number_1 = digits[4:7]       # "123"
                number_2 = digits[7:9]       # "45"
                number_3 = digits[9:11]      # "67"

                return f"+7 ({area_code}) {number_1}-{number_2}-{number_3}"

            # Fallback: вернуть как есть
            return formatted

        except Exception as e:
            self.logger.debug(f"[REFORMAT ERROR] {e}")
            return formatted

    def _normalize_via_regex(self, candidate: str) -> Optional[str]:
        """
        Fallback нормализация через русский regex.

        Используется если phonenumbers не смог распарсить номер.
        Ищет паттерны:
        - +7 (XXX) XXX-XX-XX
        - 8 (XXX) XXX-XX-XX (заменяет на +7)
        - +7XXXXXXXXXX (без разделителей)

        Args:
            candidate: Кандидат на номер

        Returns:
            Нормализованный номер или None
        """
        # Получить только цифры для анализа
        digits_only = re.sub(r'\D', '', candidate)

        # Проверка: есть ли хотя бы +7 или 8 в начале
        # Иначе это явно не русский номер
        has_prefix = re.match(r'[+8]', candidate.lstrip())
        if not has_prefix and not digits_only.startswith('7') and not digits_only.startswith('8'):
            return None

        try:
            # Заменить 8 на 7 если это русский номер (8XXXXXXXXXX → 7XXXXXXXXXX)
            if digits_only.startswith('8'):
                digits_only = '7' + digits_only[1:]

            # Если номер имеет 11 цифр и начинается с 7, это русский номер
            if len(digits_only) == 11 and digits_only.startswith('7'):
                # Форматировать: 7 → +7, ABCD → (ABC) D...
                area_code = digits_only[1:4]      # "812"
                number_1 = digits_only[4:7]       # "250"
                number_2 = digits_only[7:9]       # "62"
                number_3 = digits_only[9:11]      # "10"

                normalized = f"+7 ({area_code}) {number_1}-{number_2}-{number_3}"
                self.logger.debug(f"[REGEX] {candidate} → {normalized}")
                return normalized

            # Если номер имеет 10 цифр, добавить 7 в начало
            if len(digits_only) == 10 and not digits_only.startswith('7'):
                digits_only = '7' + digits_only

            # Повторить форматирование
            if len(digits_only) == 11 and digits_only.startswith('7'):
                area_code = digits_only[1:4]
                number_1 = digits_only[4:7]
                number_2 = digits_only[7:9]
                number_3 = digits_only[9:11]

                normalized = f"+7 ({area_code}) {number_1}-{number_2}-{number_3}"
                self.logger.debug(f"[REGEX] {candidate} → {normalized}")
                return normalized

        except Exception as e:
            self.logger.debug(f"[REGEX ERROR] {candidate}: {e}")

        return None

    # ============================================================================
    # ФУНКЦИЯ 2: MERGE FRAGMENTED PHONES
    # ============================================================================

    def merge_fragmented_phones(self, soup: BeautifulSoup) -> List[str]:
        """
        Склеивание номеров, разбитых по HTML-тегам.

        Проблема:
        <span>+7</span><span>985</span><span>587</span>
        <div>+7</div>(383)
        <strong>+7</strong> <strong>985</strong>

        Решение: DOM traversal для нахождения рядом стоящих числовых последовательностей

        Args:
            soup: BeautifulSoup объект HTML страницы

        Returns:
            List[str] с найденными и склеенными номерами

        Examples:
            >>> from bs4 import BeautifulSoup
            >>> html = '<span>+7</span><span>985</span><span>587</span>'
            >>> soup = BeautifulSoup(html, 'html.parser')
            >>> normalizer = PhoneNormalizer()
            >>> normalizer.merge_fragmented_phones(soup)
            ['+7985587...']
        """
        if not soup:
            return []

        merged_phones = []
        found_candidates = set()  # Для дедубликации

        try:
            # Ищем все элементы содержащие цифры
            for element in soup.find_all(['span', 'div', 'p', 'td', 'li', 'strong', 'b']):
                text = element.get_text(strip=True)

                # Если элемент содержит цифры, это потенциальный фрагмент номера
                if re.search(r'\d', text):
                    # Получить контекст вокруг элемента (соседние элементы)
                    context = self._get_element_context(element)

                    # Из контекста извлечь номеры
                    phones = self._extract_phones_from_context(context)

                    for phone in phones:
                        # Нормализовать
                        normalized = self.normalize_phone(phone)
                        if normalized and normalized not in found_candidates:
                            found_candidates.add(normalized)
                            merged_phones.append(normalized)
                            self.logger.debug(f"[FRAGMENTED] Merged: {normalized}")

        except Exception as e:
            self.logger.error(f"[FRAGMENTED ERROR] {e}")

        return merged_phones

    def _get_element_context(self, element) -> str:
        """
        Получить контекст вокруг элемента (текущий + соседние элементы).

        Помогает склеить номера разорванные по тегам.

        Args:
            element: BeautifulSoup элемент

        Returns:
            Строка с контекстом (до 100 символов в каждую сторону)
        """
        context_parts = []

        # Предыдущий сосед
        if element.previous_sibling:
            prev_text = str(element.previous_sibling).strip()
            if prev_text and len(prev_text) < 100:
                context_parts.append(prev_text)

        # Текущий элемент
        current_text = element.get_text(strip=True)
        if current_text:
            context_parts.append(current_text)

        # Следующий сосед
        if element.next_sibling:
            next_text = str(element.next_sibling).strip()
            if next_text and len(next_text) < 100:
                context_parts.append(next_text)

        return " ".join(context_parts)

    def _extract_phones_from_context(self, context: str) -> List[str]:
        """
        Извлечь номера из контекста разорванного элемента.

        Ищет паттерны:
        - Длинные числовые последовательности
        - Скобки с номерами
        - Номера с разделителями

        Args:
            context: Текст контекста

        Returns:
            List[str] с найденными сырыми номерами
        """
        candidates = []

        # Regex паттерны для поиска номеров
        patterns = [
            r'\+7\s*\(?\d{3}\)?\s*[\d\s\-]{5,}',   # +7 (...) xxx...
            r'8\s*\(?\d{3}\)?\s*[\d\s\-]{5,}',      # 8 (...) xxx...
            r'\(\d{3}\)\s*[\d\s\-]{4,}',            # (XXX) xxx...
            r'\d[\d\s\-]{6,}\d',                     # Общий паттерн
        ]

        for pattern in patterns:
            for match in re.finditer(pattern, context, re.IGNORECASE):
                candidates.append(match.group())

        return candidates

    # ============================================================================
    # ФУНКЦИЯ 3: EXTRACT FROM CRAWLRESULT
    # ============================================================================

    def extract_phones_from_result(self, result) -> List[Dict[str, str]]:
        """
        Главная функция: извлечение всех номеров из CrawlResult объекта.

        Pipeline:
        1. Tel: ссылки (приоритет - самые надежные)
        2. Fragmented merge (разорванные номера)
        3. Текст из markdown + cleaned_html + html
        4. Дедубликация и фильтрация

        Args:
            result: CrawlResult объект от Crawl4AI с полями:
                    - html: str
                    - cleaned_html: str
                    - markdown: str
                    - url: str

        Returns:
            List[Dict] с элементами:
            {
                "phone": "+7 (812) 250-62-10",
                "source_page": "https://is1c.ru",
                "raw": "+7%20(812)%20250-62-10%20"
            }

        Examples:
            >>> normalizer = PhoneNormalizer()
            >>> phones = normalizer.extract_phones_from_result(result)
            >>> for p in phones:
            ...     print(f"{p['phone']} from {p['source_page']}")
        """
        all_phones = []
        page_url = getattr(result, 'url', 'unknown')

        # Получить HTML и текст
        html = getattr(result, 'html', '') or ''
        cleaned_html = getattr(result, 'cleaned_html', '') or ''
        markdown = getattr(result, 'markdown', '') or ''

        try:
            # ИСТОЧНИК 1: Tel: ссылки (приоритет!)
            tel_phones = self._extract_tel_links(html, page_url)
            all_phones.extend(tel_phones)
            self.logger.debug(f"[SOURCE 1] Found {len(tel_phones)} tel: links")

            # ИСТОЧНИК 2: Fragmented merge (разорванные номера)
            try:
                soup = BeautifulSoup(html, 'html.parser')
                fragmented_phones = self.merge_fragmented_phones(soup)

                for phone in fragmented_phones:
                    all_phones.append({
                        "phone": phone,
                        "source_page": page_url,
                        "raw": phone  # Для fragmented это тот же формат
                    })
                self.logger.debug(f"[SOURCE 2] Found {len(fragmented_phones)} fragmented")

            except Exception as e:
                self.logger.debug(f"[SOURCE 2 ERROR] {e}")

            # ИСТОЧНИК 3: Текст (markdown + cleaned_html + html)
            combined_text = f"{markdown}\n{cleaned_html}\n{html}"
            text_phones = self._extract_from_text(combined_text, page_url)
            all_phones.extend(text_phones)
            self.logger.debug(f"[SOURCE 3] Found {len(text_phones)} from text")

            # Дедубликация по нормализованному номеру
            deduplicated = self._deduplicate(all_phones)

            self.logger.info(
                f"[EXTRACT SUMMARY] {page_url}\n"
                f"  Tel links: {len(tel_phones)}\n"
                f"  Fragmented: {len(fragmented_phones) if 'fragmented_phones' in locals() else 0}\n"
                f"  Text: {len(text_phones)}\n"
                f"  TOTAL: {len(deduplicated)}"
            )

            return deduplicated

        except Exception as e:
            self.logger.error(f"[EXTRACT ERROR] {page_url}: {e}", exc_info=True)
            return []

    def _extract_tel_links(self, html: str, page_url: str) -> List[Dict[str, str]]:
        """
        Извлечь номера из tel: ссылок.

        Примеры:
        href="tel:+7 (495) 123-45-67"
        href="tel:%2B7%20(495)%20123-45-67"

        Args:
            html: HTML содержимое
            page_url: URL страницы

        Returns:
            List[Dict] с нормализованными номерами
        """
        results = []

        if not html:
            return results

        try:
            # Regex для поиска tel: ссылок
            tel_pattern = r'href\s*=\s*["\']tel:([^"\']+)["\']'

            for match in re.finditer(tel_pattern, html, re.IGNORECASE):
                raw_phone = match.group(1)

                # Нормализовать (включает URL-декодирование)
                normalized = self.normalize_phone(raw_phone)

                if normalized:
                    results.append({
                        "phone": normalized,
                        "source_page": page_url,
                        "raw": raw_phone
                    })
                    self.logger.debug(f"[TEL LINK] {normalized} from {raw_phone}")

        except Exception as e:
            self.logger.error(f"[TEL LINKS ERROR] {e}")

        return results

    def _extract_from_text(self, text: str, page_url: str) -> List[Dict[str, str]]:
        """
        Извлечь номера из текста по regex паттернам.

        Ищет:
        - "Тел. +7 (812) 250-62-10"
        - "Телефон: +7-495-123-45-67"
        - "Phone: +7 (383) 262-16-42"
        - Просто номера вроде "+7 (495) 123-45-67"

        Args:
            text: Текст страницы
            page_url: URL страницы

        Returns:
            List[Dict] с нормализованными номерами
        """
        results = []

        if not text:
            return results

        try:
            found_candidates = set()  # Дедубликация

            # Regex паттерны для поиска номеров в тексте
            patterns = [
                # Russian keywords
                r'(?:тел|телефон|т\.)\s*[:.]?\s*([+\d][\d\s\-\(\)\.]{6,}\d)',
                r'(?:звоните|позвоните)\s*[:.]?\s*([+\d][\d\s\-\(\)\.]{6,}\d)',

                # English keywords
                r'(?:phone|tel|call|contact)\s*[:.]?\s*([+\d][\d\s\-\(\)\.]{6,}\d)',

                # Просто номера в скобках или с разделителями
                r'(\+7\s*\(?\d{3}\)?\s*[\d\s\-]{6,})',
                r'(8\s*\(?\d{3}\)?\s*[\d\s\-]{6,})',
                r'(\+\d[\d\s\-\(\)\.]{6,}\d)',
            ]

            for pattern in patterns:
                for match in re.finditer(pattern, text, re.IGNORECASE):
                    raw_phone = match.group(1) if match.lastindex and match.lastindex > 0 else match.group(0)

                    # Нормализовать
                    normalized = self.normalize_phone(raw_phone)

                    if normalized and normalized not in found_candidates:
                        found_candidates.add(normalized)
                        results.append({
                            "phone": normalized,
                            "source_page": page_url,
                            "raw": raw_phone
                        })
                        self.logger.debug(f"[TEXT] {normalized} from {raw_phone}")

        except Exception as e:
            self.logger.error(f"[TEXT EXTRACT ERROR] {e}")

        return results

    def _deduplicate(self, phones: List[Dict[str, str]]) -> List[Dict[str, str]]:
        """
        Дедубликировать номера по нормализованному значению.

        Если один номер найден несколько раз, оставляем только один экземпляр.

        Args:
            phones: List[Dict] с номерами

        Returns:
            Дедубликированный list
        """
        seen = {}  # {normalized: Dict}

        for item in phones:
            phone = item.get("phone", "")

            if phone not in seen:
                seen[phone] = item

        return list(seen.values())


# ============================================================================
# CONVENIENCE FUNCTION
# ============================================================================

def normalize_phone(raw: str, region: str = "RU") -> Optional[str]:
    """
    Convenience функция для быстрого использования.

    Usage:
        from phone_normalizer import normalize_phone

        result = normalize_phone("+7%20(812)%20250-62-10")
        print(result)  # "+7 (812) 250-62-10"
    """
    normalizer = PhoneNormalizer(region=region)
    return normalizer.normalize_phone(raw)


def extract_phones_from_result(result):
    """
    Convenience функция для extraction из CrawlResult.

    Usage:
        from phone_normalizer import extract_phones_from_result

        phones = extract_phones_from_result(result)
        for p in phones:
            print(p["phone"])
    """
    normalizer = PhoneNormalizer()
    return normalizer.extract_phones_from_result(result)


# ============================================================================
# ПРИМЕР ИСПОЛЬЗОВАНИЯ
# ============================================================================

if __name__ == "__main__":
    # Настройка логирования для примера
    logging.basicConfig(
        level=logging.DEBUG,
        format='%(levelname)s - %(name)s - %(message)s'
    )

    normalizer = PhoneNormalizer()

    # Примеры проблемных номеров
    test_cases = [
        # Нормальные номера
        ("+7 (812) 250-62-10", "✅ Уже нормальный"),
        ("+7-495-123-45-67", "✅ Дефисы вместо скобок"),
        ("8 (383) 262-16-42", "✅ Начинается с 8"),

        # URL-кодированные номера
        ("+7%20(812)%20250-62-10%20", "✅ URL-кодированный с пробелом в конце"),
        ("tel:%2B7%20(495)%20123-45-67", "✅ Tel ссылка URL-кодированная"),

        # Мусор
        ("237153142)", "❌ Мусор - скобка в конце"),
        ("+7", "❌ Слишком короткий"),
        ("-03022026.", "❌ Дата или мусор"),
        ("(55036117", "❌ Неполный номер"),
        ("192.168.1.1", "❌ IP адрес"),
        ("2024-01-01", "❌ Дата"),
    ]

    print("=" * 70)
    print("ПРИМЕРЫ НОРМАЛИЗАЦИИ")
    print("=" * 70)

    for raw, description in test_cases:
        result = normalizer.normalize_phone(raw)
        status = "✅" if result else "❌"
        print(f"{status} {description}")
        print(f"   Input:  {raw}")
        print(f"   Output: {result}")
        print()

    # Пример с BeautifulSoup
    print("=" * 70)
    print("ПРИМЕР MERGE FRAGMENTED PHONES")
    print("=" * 70)

    html_example = """
    <html>
        <body>
            <span>+7</span><span>985</span><span>587</span>
            <div>Позвоните: +7-812-250-62-10</div>
            <p>Тел. (383) 262-16-42</p>
        </body>
    </html>
    """

    soup = BeautifulSoup(html_example, 'html.parser')
    fragmented = normalizer.merge_fragmented_phones(soup)

    print(f"Found {len(fragmented)} fragmented phones:")
    for phone in fragmented:
        print(f"  ✅ {phone}")
