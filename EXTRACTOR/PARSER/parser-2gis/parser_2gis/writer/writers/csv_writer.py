from __future__ import annotations

import csv
import os
import re
import shutil
from typing import Any, Callable

from pydantic import ValidationError

from ...common import report_from_validation_error
from ...logger import logger
from ..models import CatalogItem
from .file_writer import FileWriter


def _clean_csv_content(content: str) -> str:
    """Очистить CSV контент от NUL символов и других проблемных символов.

    Args:
        content: Исходный контент CSV файла

    Returns:
        Очищенный контент без NUL символов
    """
    # Удалить NUL символы (\x00)
    content = content.replace('\x00', '')
    return content


class CSVWriter(FileWriter):
    """Writer to CSV table."""
    @property
    def _type_names(self) -> dict[str, str]:
        return {
            'parking': 'Парковка',
            'street': 'Улица',
            'road': 'Дорога',
            'crossroad': 'Перекрёсток',
            'station': 'Остановка',
        }

    @property
    def _complex_mapping(self) -> dict[str, Any]:
        # Complex mapping means its content could contain several entities bound by user settings.
        # For example: phone -> phone_1, phone_2, ..., phone_n
        return {
            'phone': 'Телефон', 'email': 'E-mail', 'website': 'Веб-сайт', 'instagram': 'Instagram',
            'twitter': 'Twitter', 'facebook': 'Facebook', 'vkontakte': 'ВКонтакте', 'whatsapp': 'WhatsApp',
            'viber': 'Viber', 'telegram': 'Telegram', 'youtube': 'YouTube', 'skype': 'Skype'
        }

    @property
    def _data_mapping(self) -> dict[str, Any]:
        data_mapping = {
            'name': 'Наименование', 'description': 'Описание', 'rubrics': 'Рубрики',
            'address': 'Адрес', 'address_comment': 'Комментарий к адресу',
            'postcode': 'Почтовый индекс', 'living_area': 'Микрорайон', 'district': 'Район', 'city': 'Город',
            'district_area': 'Округ', 'region': 'Регион', 'country': 'Страна', 'schedule': 'Часы работы',
            'timezone': 'Часовой пояс', 'general_rating': 'Рейтинг', 'general_review_count': 'Количество отзывов'
        }

        # Expand complex mapping
        for k, v in self._complex_mapping.items():
            for n in range(1, self._options.csv.columns_per_entity + 1):
                data_mapping[f'{k}_{n}'] = f'{v} {n}'

        if not self._options.csv.add_rubrics:
            data_mapping.pop('rubrics', None)

        return {
            **data_mapping,
            **{
                'point_lat': 'Широта',
                'point_lon': 'Долгота',
                'url': '2GIS URL',
                'type': 'Тип',
            }
        }

    def _writerow(self, row: dict[str, Any]) -> None:
        """Write a `row` into CSV.

        Gracefully handles write errors - логирует но не выбрасывает исключение,
        позволяя парсеру продолжить работу при ошибках записи.
        """
        if self._options.verbose:
            logger.info('Парсинг [%d] > %s', self._wrote_count + 1, row.get('name', 'N/A'))

        try:
            self._writer.writerow(row)
        except UnicodeEncodeError as e:
            logger.warning('Ошибка кодировки при записи строки: %s. Строка пропущена.', e)
        except csv.Error as e:
            logger.warning('Ошибка CSV при записи строки: %s. Строка пропущена.', e)
        except Exception as e:
            logger.warning('Неизвестная ошибка во время записи строки: %s. Строка пропущена.', e)

    def __enter__(self) -> CSVWriter:
        # Используем режим append если файл уже существует
        file_exists = os.path.exists(self._file_path)

        if file_exists:
            logger.info(f"CSV файл {self._file_path} уже существует. Будет использован режим дописывания.")
            # Закрыть файл что был открыт в super().__enter__() в режиме 'w'
            if hasattr(self, '_file') and self._file:
                self._file.close()
            # Открыть в режиме append
            self._file = self._open_file(self._file_path, 'a')
            self._wrote_count = self._count_existing_rows()
        else:
            super().__enter__()
            self._writer = csv.DictWriter(self._file, self._data_mapping.keys())
            self._writer.writerow(self._data_mapping)  # Write header
            self._wrote_count = 0

        if not hasattr(self, '_writer'):
            self._writer = csv.DictWriter(self._file, self._data_mapping.keys())

        return self

    def _count_existing_rows(self) -> int:
        """Подсчитать существующие строки CSV файла (исключая заголовок).

        Returns:
            Количество строк данных в файле (0 если файл пуст или содержит ошибки)
        """
        try:
            with self._open_file(self._file_path, 'r') as f:
                content = f.read()
                content = _clean_csv_content(content)

            row_count = 0
            for i, line in enumerate(content.split('\n')):
                # Пропустить первую строку (заголовок) и пустые строки
                if i == 0 or not line.strip():
                    continue
                row_count += 1

            logger.info(f"В CSV файле найдено {row_count} строк данных.")
            return row_count
        except Exception as e:
            logger.warning(f"Ошибка при подсчёте существующих строк: {e}. Начинаем с 0.")
            return 0

    def __exit__(self, *exc_info) -> None:
        # Безопасно закрыть файл
        try:
            if hasattr(self, '_file') and self._file and not self._file.closed:
                self._file.flush()  # Убедиться что все данные записаны
                self._file.close()
        except Exception as e:
            logger.warning(f"Ошибка при закрытии файла: {e}")

        # Пост-обработка CSV (graceful degradation при ошибках)
        try:
            if self._options.csv.remove_empty_columns:
                logger.info('Удаление пустых колонок CSV.')
                self._remove_empty_columns()
        except Exception as e:
            logger.warning(f"Ошибка при удалении пустых колонок: {e}. Продолжение работы.")

        try:
            if self._options.csv.remove_duplicates:
                logger.info('Удаление повторяющихся записей CSV.')
                self._remove_duplicates()
        except Exception as e:
            logger.warning(f"Ошибка при удалении дубликатов: {e}. Продолжение работы.")

    def _remove_empty_columns(self) -> None:
        """Post-process: Remove empty columns."""
        complex_columns = self._complex_mapping.keys()
        complex_columns_count = {c: 0 for c in self._data_mapping.keys() if
                                 re.match('|'.join(fr'^{x}_\d+$' for x in complex_columns), c)}

        # Looking for empty columns (с обработкой ошибок CSV)
        try:
            with self._open_file(self._file_path, 'r') as f_csv:
                # Очистить контент от NUL символов перед парсингом
                content = f_csv.read()
                content = _clean_csv_content(content)

            # Перепроверить на очищенном контенте
            import io
            f_clean = io.StringIO(content)
            try:
                csv_reader = csv.DictReader(f_clean, self._data_mapping.keys())  # type: ignore
                next(csv_reader, None)  # Skip header
                for row in csv_reader:
                    for column_name in complex_columns_count.keys():
                        if row and column_name in row and row[column_name] != '':
                            complex_columns_count[column_name] += 1
            except csv.Error as e:
                logger.warning(f"Ошибка чтения CSV при подсчёте пустых колонок: {e}. Пропуск пост-обработки.")
                return
            finally:
                f_clean.close()
        except Exception as e:
            logger.warning(f"Ошибка при открытии CSV для подсчёта пустых колонок: {e}. Пропуск пост-обработки.")
            return

        # Generate new data mapping
        new_data_mapping: dict[str, Any] = {}
        for k, v in self._data_mapping.items():
            if k in complex_columns_count:
                if complex_columns_count[k] > 0:
                    new_data_mapping[k] = v
            else:
                new_data_mapping[k] = v

        # Rename single complex column - remove postfix numbers
        for column in complex_columns:
            if f'{column}_1' in new_data_mapping and f'{column}_2' not in new_data_mapping:
                new_data_mapping[f'{column}_1'] = re.sub(r'\s+\d+$', '', new_data_mapping[f'{column}_1'])

        # Populate new csv (с обработкой ошибок и graceful degradation)
        tmp_csv_name = os.path.splitext(self._file_path)[0] + '.removed-columns.csv'

        try:
            with self._open_file(tmp_csv_name, 'w') as f_tmp_csv, \
                    self._open_file(self._file_path, 'r') as f_csv:
                # Очистить контент от NUL символов
                content = f_csv.read()
                content = _clean_csv_content(content)

                import io
                f_clean = io.StringIO(content)
                csv_writer = csv.DictWriter(f_tmp_csv, new_data_mapping.keys())  # type: ignore
                csv_reader = csv.DictReader(f_clean, self._data_mapping.keys())  # type: ignore
                csv_writer.writerow(new_data_mapping)  # Write new header
                next(csv_reader, None)  # Skip header

                row_count = 0
                error_count = 0
                for row in csv_reader:
                    try:
                        if row:  # Пропустить пустые строки
                            new_row = {k: v for k, v in row.items() if k in new_data_mapping}
                            csv_writer.writerow(new_row)
                            row_count += 1
                    except Exception as e:
                        error_count += 1
                        logger.warning(f"Ошибка при обработке строки: {e}. Пропуск строки.")
                        continue

                if error_count > 0:
                    logger.info(f"Обработка CSV завершена: {row_count} строк успешно, {error_count} строк пропущено.")

                f_clean.close()

            # Replace original table with new one
            shutil.move(tmp_csv_name, self._file_path)
        except Exception as e:
            logger.error(f"Критическая ошибка при удалении пустых колонок: {e}. CSV файл остался без изменений.")
            if os.path.exists(tmp_csv_name):
                try:
                    os.remove(tmp_csv_name)
                except:
                    pass

    def _remove_duplicates(self) -> None:
        """Post-process: Remove duplicates."""
        tmp_csv_name = os.path.splitext(self._file_path)[0] + '.deduplicated.csv'

        try:
            with self._open_file(self._file_path, 'r') as f_csv:
                # Очистить контент от NUL символов перед обработкой
                content = f_csv.read()
                content = _clean_csv_content(content)

            with self._open_file(tmp_csv_name, 'w') as f_tmp_csv:
                seen_records = set()
                lines_written = 0
                lines_skipped = 0

                try:
                    for i, line in enumerate(content.split('\n')):
                        # Пропустить пустые строки
                        if not line.strip():
                            continue

                        try:
                            if line in seen_records:
                                lines_skipped += 1
                                continue

                            seen_records.add(line)
                            f_tmp_csv.write(line + '\n')
                            lines_written += 1
                        except Exception as e:
                            logger.warning(f"Ошибка при обработке строки {i}: {e}. Пропуск строки.")
                            lines_skipped += 1
                            continue
                except Exception as e:
                    logger.error(f"Критическая ошибка при удалении дубликатов: {e}")
                    raise

                if lines_skipped > 0:
                    logger.info(f"Удаление дубликатов завершено: {lines_written} строк написано, {lines_skipped} дубликатов/ошибок пропущено.")

            # Replace original table with new one
            shutil.move(tmp_csv_name, self._file_path)
        except Exception as e:
            logger.error(f"Критическая ошибка при удалении дубликатов: {e}. CSV файл остался без изменений.")
            if os.path.exists(tmp_csv_name):
                try:
                    os.remove(tmp_csv_name)
                except:
                    pass

    def write(self, catalog_doc: Any) -> None:
        """Write Catalog Item API JSON document down to CSV table.

        Args:
            catalog_doc: Catalog Item API JSON document.
        """
        if not self._check_catalog_doc(catalog_doc):
            return

        row = self._extract_raw(catalog_doc)
        if row:
            self._writerow(row)
            self._wrote_count += 1

    def _extract_raw(self, catalog_doc: Any) -> dict[str, Any]:
        """Extract data from Catalog Item API JSON document.

        Args:
            catalog_doc: Catalog Item API JSON document.

        Returns:
            Dictionary for CSV row.
        """
        data: dict[str, Any] = {k: None for k in self._data_mapping.keys()}

        item = catalog_doc['result']['items'][0]

        try:
            catalog_item = CatalogItem(**item)
        except ValidationError as e:
            errors = []
            errors_report = report_from_validation_error(e, item)
            for path, description in errors_report.items():
                arg = description['invalid_value']
                error_msg = description['error_message']
                errors.append(f'[*] Поле: {path}, значение: {arg}, ошибка: {error_msg}')

            error_str = 'Ошибка парсинга:\n' + '\n'.join(errors)
            error_str += '\nДокумент каталога: ' + str(catalog_doc)
            logger.error(error_str)

            return {}

        # Name, description
        if catalog_item.name_ex:
            data['name'] = catalog_item.name_ex.primary
            data['description'] = catalog_item.name_ex.extension
        elif catalog_item.name:
            data['name'] = catalog_item.name
        elif catalog_item.type in self._type_names:
            data['name'] = self._type_names[catalog_item.type]

        # Type
        data['type'] = catalog_item.type

        # Address
        data['address'] = catalog_item.address_name

        # Reviews
        if catalog_item.reviews:
            data['general_rating'] = catalog_item.reviews.general_rating
            data['general_review_count'] = catalog_item.reviews.general_review_count

        # Point location
        if catalog_item.point:
            data['point_lat'] = catalog_item.point.lat  # Latitude (широта)
            data['point_lon'] = catalog_item.point.lon  # Longitude (долгота)

        # Address comment
        data['address_comment'] = catalog_item.address_comment

        # Post code
        if catalog_item.address:
            data['postcode'] = catalog_item.address.postcode

        # Timezone
        if catalog_item.timezone is not None:
            data['timezone'] = catalog_item.timezone

        # Administrative location details
        for div in catalog_item.adm_div:
            for t in ('country', 'region', 'district_area', 'city', 'district', 'living_area'):
                if div.type == t:
                    data[t] = div.name

        # Item URL
        data['url'] = catalog_item.url

        # Contacts
        for contact_group in catalog_item.contact_groups:
            def append_contact(contact_type: str, priority_fields: list[str],
                               formatter: Callable[[str], str] | None = None) -> None:
                """Add contact to `data`.

                Args:
                    contact_type: Contact type (see `Contact` in `catalog_item.py`)
                    priority_fields: Field of contact to be added, sorted by priority
                    formatter: Field value formatter
                """
                contacts = [x for x in contact_group.contacts if x.type == contact_type]
                for i, contact in enumerate(contacts, 1):
                    contact_value = None

                    for field in priority_fields:
                        if hasattr(contact, field):
                            contact_value = getattr(contact, field)
                            break

                    # Empty contact value, bail
                    if not contact_value:
                        return

                    data_name = f'{contact_type}_{i}'
                    if data_name in data:
                        data[data_name] = formatter(contact_value) if formatter else contact_value

                        # Add comment on demand
                        if self._options.csv.add_comments and contact.comment:
                            data[data_name] += ' (%s)' % contact.comment

            # URLs
            for t in ['website', 'vkontakte', 'whatsapp', 'viber', 'telegram',
                      'instagram', 'facebook', 'twitter', 'youtube', 'skype']:
                append_contact(t, ['url'])

            # Remove arguments from WhatsApp URL
            for field in data:
                if field.startswith('whatsapp') and data[field]:
                    data[field] = data[field].split('?')[0]

            # Values
            for t in ['email', 'skype']:
                append_contact(t, ['value'])

            # Phone (`value` sometimes has strange crap inside, so we better parse `text`.
            # If no `text` field in contact - use `value` attribute)
            append_contact('phone', ['text', 'value'],
                           formatter=lambda x: re.sub(r'^\+7', '8', re.sub(r'[^0-9+]', '', x)))

        # Schedule
        if catalog_item.schedule:
            data['schedule'] = catalog_item.schedule.to_str(self._options.csv.join_char,
                                                            self._options.csv.add_comments)

        # Rubrics
        if self._options.csv.add_rubrics:
            data['rubrics'] = self._options.csv.join_char.join(x.name for x in catalog_item.rubrics)

        return data
