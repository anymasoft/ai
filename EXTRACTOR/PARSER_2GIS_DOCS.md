# Документация Parser-2GIS

## Установка

```bash
pip install parser-2gis
```

## Использование

```bash
parser-2gis [-i URL [URL ...]] [-o PATH] [-f {csv,json,xlsx}] [опции]
```

## Основные аргументы

### `-i URL [URL ...]`, `--url URL [URL ...]`
URL с выдачей 2GIS

**Примеры:**
```bash
parser-2gis -i "https://2gis.ru/moscow/search/тату-салоны"
parser-2gis -i "https://2gis.ru/bratsk/search/автомойки" "https://2gis.ru/spb/search/кафе"
```

### `-o PATH`, `--output-path PATH`
Путь до результирующего файла

**Примеры:**
```bash
parser-2gis -i "https://..." -o "results.csv"
parser-2gis -i "https://..." -o "/home/user/output/data.csv"
```

### `-f {csv,xlsx,json}`, `--format {csv,xlsx,json}`
Формат результирующего файла (по умолчанию: csv)

**Примеры:**
```bash
parser-2gis -i "https://..." -f csv
parser-2gis -i "https://..." -f json
parser-2gis -i "https://..." -f xlsx
```

---

## Аргументы браузера

### `--chrome.binary_path PATH`
Путь до исполняемого файла браузера (по умолчанию: автоопределение)

**Примеры:**
```bash
--chrome.binary_path /usr/bin/chromium-browser
--chrome.binary_path "C:\Program Files\Google\Chrome\chrome.exe"
```

### `--chrome.disable-images {yes,no}`
Отключить изображения в браузере (по умолчанию: yes)

### `--chrome.headless {yes,no}`
Скрыть браузер (по умолчанию: yes)

**Примеры:**
```bash
--chrome.headless yes    # скрытый браузер
--chrome.headless no     # видимый браузер (для отладки)
```

### `--chrome.silent-browser {yes,no}`
Отключить отладочную информацию браузера (по умолчанию: yes)

### `--chrome.start-maximized {yes,no}`
Запустить окно браузера развёрнутым (по умолчанию: no)

### `--chrome.memory-limit {4096,5120,...}`
Лимит оперативной памяти браузера в мегабайтах (по умолчанию: 11900)

**Примеры:**
```bash
--chrome.memory-limit 4096    # 4 ГБ
--chrome.memory-limit 8192    # 8 ГБ
```

---

## Аргументы CSV/XLSX

### `--writer.csv.add-rubrics {yes,no}`
Добавить колонку "Рубрики" (по умолчанию: yes)

### `--writer.csv.add-comments {yes,no}`
Добавлять комментарии к ячейкам Телефон, E-Mail и т.д. (по умолчанию: yes)

### `--writer.csv.columns-per-entity {1,2,3,...}`
Количество колонок для результата с несколькими значениями:
- Телефон_1, Телефон_2, и т.д. (по умолчанию: 3)

### `--writer.csv.remove-empty-columns {yes,no}`
Удалить пустые колонки по завершению (по умолчанию: yes)

### `--writer.csv.remove-duplicates {yes,no}`
Удалить повторяющиеся записи по завершению (по умолчанию: yes)

### `--writer.csv.join_char {; ,% ,...}`
Разделитель для комплексных значений (Рубрики, Часы работы) (по умолчанию: `;`)

---

## Аргументы парсера

### `--parser.use-gc {yes,no}`
Включить сборщик мусора (замедляет парсинг, снижает использование RAM)
(по умолчанию: no)

### `--parser.gc-pages-interval {5,10,...}`
Запуск сборщика мусора каждую N-ую страницу (если сборщик включен)
(по умолчанию: 10)

### `--parser.max-records {1000,2000,...}`
Максимальное количество спарсенных записей с одного URL (по умолчанию: 5900)

**Примеры:**
```bash
--parser.max-records 1000    # парсить максимум 1000 записей
--parser.max-records 5900    # максимально возможно (по умолчанию)
```

### `--parser.skip-404-response {yes,no}`
Пропускать ссылки с ошибкой "Точных совпадений нет / Не найдено"
(по умолчанию: yes)

### `--parser.delay_between_clicks {0,100,...}`
Задержка между кликами по записям (миллисекунды) (по умолчанию: 0)

**Примеры:**
```bash
--parser.delay_between_clicks 0      # без задержки
--parser.delay_between_clicks 100    # 100 мс между кликами
--parser.delay_between_clicks 200    # 200 мс между кликами
```

---

## Прочие аргументы

### `--writer.verbose {yes,no}`
Отображать наименования позиций во время парсинга (по умолчанию: yes)

### `--writer.encoding {utf8,1251,...}`
Кодировка результирующего файла (по умолчанию: utf-8-sig)

**Примеры:**
```bash
--writer.encoding utf-8-sig    # UTF-8 с BOM (для Excel)
--writer.encoding utf-8        # UTF-8 без BOM
--writer.encoding 1251         # Windows-1251 (для старого Excel)
```

### `-v`, `--version`
Показать версию программы

### `-h`, `--help`
Показать справку

---

## Примеры использования

### Базовый пример
```bash
parser-2gis -i "https://2gis.ru/moscow/search/тату-салоны" -o "results.csv" -f csv
```

### С несколькими URL
```bash
parser-2gis \
  -i "https://2gis.ru/moscow/search/тату-салоны" "https://2gis.ru/moscow/search/пирсинг" \
  -o "results.csv" \
  -f csv
```

### С задержкой между кликами
```bash
parser-2gis \
  -i "https://2gis.ru/bratsk/search/тату-салоны" \
  -o "results.csv" \
  -f csv \
  --parser.delay_between_clicks 200
```

### С пользовательским браузером и памятью
```bash
parser-2gis \
  -i "https://2gis.ru/moscow/search/кафе" \
  -o "results.csv" \
  -f csv \
  --chrome.binary_path /usr/bin/chromium-browser \
  --chrome.headless yes \
  --chrome.memory-limit 8192
```

### С максимальными записями и без дублей
```bash
parser-2gis \
  -i "https://2gis.ru/novosibirsk/search/ресторан" \
  -o "results.csv" \
  -f csv \
  --parser.max-records 5900 \
  --writer.csv.remove-duplicates yes \
  --writer.csv.remove-empty-columns yes
```

### JSON формат
```bash
parser-2gis \
  -i "https://2gis.ru/spb/search/клиника" \
  -o "results.json" \
  -f json
```

### XLSX (Excel) формат
```bash
parser-2gis \
  -i "https://2gis.ru/ekaterinburg/search/салон красоты" \
  -o "results.xlsx" \
  -f xlsx \
  --writer.encoding utf-8-sig
```

---

## Структура результатов (CSV)

Стандартные колонки в результирующем файле:

| Колонка | Описание |
|---------|----------|
| Название | Название организации |
| Адрес | Полный адрес |
| Телефон_1 | Основной телефон |
| Телефон_2 | Второй телефон (если есть) |
| Телефон_3 | Третий телефон (если есть) |
| Сайт | URL официального сайта |
| Email | Email адрес |
| Время работы | График работы |
| Рубрики | Категории (если add-rubrics=yes) |

---

## Режимы отладки

### Видимый браузер (для отладки)
```bash
parser-2gis \
  -i "https://2gis.ru/moscow/search/кафе" \
  -o "results.csv" \
  -f csv \
  --chrome.headless no \
  --chrome.start-maximized yes
```

### С подробным выводом
```bash
parser-2gis \
  -i "https://2gis.ru/moscow/search/кафе" \
  -o "results.csv" \
  -f csv \
  --writer.verbose yes
```

---

## Рекомендации

1. **Для быстрого парсинга:** Используйте `--parser.delay_between_clicks 0` (рискованно для 2GIS)
2. **Для стабильного парсинга:** Используйте `--parser.delay_between_clicks 100-200` мс
3. **Для большого количества данных:** Включите `--parser.use-gc yes`
4. **Для Excel:** Используйте формат `xlsx` с `--writer.encoding utf-8-sig`
5. **Для программной обработки:** Используйте формат `json`
6. **Для больших объёмов:** Разбейте на несколько URL и запустите параллельно

---

## Частые ошибки

| Ошибка | Решение |
|--------|---------|
| "команда не найдена" | Установите: `pip install parser-2gis` |
| "Chrome/Chromium не найден" | Укажите путь: `--chrome.binary_path /path/to/chrome` |
| "Таймаут" | Увеличьте задержку: `--parser.delay_between_clicks 500` |
| "Out of memory" | Включите GC: `--parser.use-gc yes` или снизьте лимит памяти |
| "Файл не создан" | Проверьте путь в `-o` и права доступа |
| "Нет результатов" | Проверьте URL, попробуйте открыть вручную в браузере |

---

## Версия документации

- **Дата:** 2025-03-21
- **Версия parser-2gis:** актуальная
- **Обновлено:** для Python 3.7+
