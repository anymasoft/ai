# search_2gis.py — Парсер 2GIS для lead-generation

## Быстрый старт (5 минут)

### 1️⃣ Установка зависимостей

```bash
pip install pymorphy2 python-Levenshtein iuliia parser-2gis
```

### 2️⃣ Скачивание russia-cities.json

```bash
curl -o russia-cities.json https://raw.githubusercontent.com/arbaev/russia-cities/master/cities.json
```

Или вручную: https://github.com/arbaev/russia-cities/blob/master/cities.json → скачать → положить в папку со скриптом

### 3️⃣ Создание query.txt

```bash
echo "автомойки в иркутске" > query.txt
```

**Формат:** `niche в city` (минимум 2 слова)

**Примеры:**
```
кафе в москве
стоматологии в челябинске
салоны красоты в санкт-петербурге
парикмахерские в екатеринбурге
автомойки в братске
```

### 4️⃣ Запуск парсера

```bash
python search_2gis.py
```

### 5️⃣ Результаты

Файл `results.csv` с колонками:
- Название
- Адрес
- Телефон_1, Телефон_2, Телефон_3
- Сайт
- Email
- Время работы
- Рубрики

---

## Что делает скрипт

```
query.txt: "автомойки в иркутске"
    ↓
Парсинг: niche="автомойки", city="иркутске"
    ↓
Нормализация города через pymorphy2: "иркутске" → "иркутск"
    ↓
Поиск в russia-cities.json: "иркутск" → "irkutsk"
    ↓
Построение URL: https://2gis.ru/irkutsk/search/автомойки
    ↓
Запуск parser-2gis с задержкой 200 мс между кликами
    ↓
Результат в results.csv
```

---

## Примеры использования

### Поиск салонов красоты в Москве

```bash
echo "салоны красоты в москве" > query.txt
python search_2gis.py
```

**Вывод:**
```
[INFO] ================================================================================
[INFO] PARSER 2GIS — Поиск компаний по нише и городу
[INFO] ================================================================================
[INFO] [✓] Прочитан query.txt: 'салоны красоты в москве'
[INFO]     Ниша: 'салоны красоты'
[INFO]     Город (raw): 'москве'
[INFO] [*] Исходный город: 'москве'
[INFO] [*] После pymorphy2: 'москва'
[INFO] [*] Найдено в исключениях: 'moscow'
[INFO] [✓] City slug для 2GIS: 'moscow'
[INFO] [✓] Построен URL: https://2gis.ru/moscow/search/салоны красоты
[INFO] ================================================================================
[INFO] [*] Запуск парсера...
[INFO]     Команда: parser-2gis -i https://2gis.ru/moscow/search/салоны ... -f csv ...
[INFO] [✓] Парсер завершён успешно!
[INFO] [✓] Результаты сохранены в: results.csv
[INFO]     Размер файла: 125430 байт
[INFO] ================================================================================
[INFO] [✓] ВСЁ ГОТОВО!
[INFO]     Результаты в: results.csv
```

### Поиск стоматологий в Челябинске

```bash
echo "стоматологии в челябинске" > query.txt
python search_2gis.py
```

### Поиск в небольших городах

```bash
echo "автомойки в братске" > query.txt
python search_2gis.py
```

---

## Обработка ошибок

### Ошибка: ModuleNotFoundError: No module named 'pymorphy2'

**Решение:**
```bash
pip install pymorphy2 python-Levenshtein iuliia parser-2gis
```

### Ошибка: Файл query.txt не найден

**Решение:** Создайте файл
```bash
echo "ваш запрос здесь" > query.txt
```

### Ошибка: Файл russia-cities.json не найден

**Решение:** Скачайте файл
```bash
curl -o russia-cities.json https://raw.githubusercontent.com/arbaev/russia-cities/master/cities.json
```

### Ошибка: Команда parser-2gis не найдена

**Решение:**
```bash
pip install parser-2gis
```

### Ошибка: Неверный формат запроса

**Проблема:** В query.txt меньше 2 слов

**Решение:** Минимум 2 слова: `niche в city`
```bash
echo "ниша в город" > query.txt
```

---

## Структура результирующего CSV

### Пример содержимого results.csv

```csv
Название,Адрес,Телефон_1,Сайт,Email,Время работы,Рубрики
ООО "Автомойка №1",пр. Ленина 42,+7 (950) 123-45-67,https://avto-moyka.ru,info@avto-moyka.ru,09:00-21:00,Услуги; Автомойка
"Цен моющая",ул. Советская 15,+7 (951) 234-56-78,,9:00-22:00,Автомойка
```

---

## Продвинутые параметры парсера

Скрипт использует следующие параметры parser-2gis:

```bash
parser-2gis \
  -i "https://2gis.ru/{city_slug}/search/{niche}" \
  -o "results.csv" \
  -f csv \
  --parser.delay_between_clicks 200         # задержка 200 мс между кликами
  # остальные флаги используют значения по умолчанию
```

### Для кастомизации

Отредактируйте функцию `run_parser()` в `search_2gis.py`:

```python
def run_parser(url: str, output_file: Path) -> bool:
    cmd = [
        "parser-2gis",
        "-i", url,
        "-o", str(output_file),
        "-f", "csv",
        "--parser.delay_between_clicks", "200",  # ← здесь можно менять
        # Добавьте другие флаги по необходимости:
        # "--parser.max-records", "5000",
        # "--writer.csv.remove-duplicates", "yes",
    ]
```

**Полная документация:** `PARSER_2GIS_DOCS.md`

---

## Поддерживаемые города

Скрипт поддерживает любые города России благодаря `russia-cities.json`.

### Примеры автоматических преобразований

| Исходный | pymorphy2 | russia-cities.json | Результат |
|----------|-----------|-------------------|-----------|
| в москве | москва | moscow | ✓ moscow |
| в санкт-петербурге | санкт-петербург | (исключение) | ✓ spb |
| в челябинске | челябинск | chelyabinsk | ✓ chelyabinsk |
| в иркутске | иркутск | irkutsk | ✓ irkutsk |
| в братске | братск | bratsk | ✓ bratsk |

---

## Производительность

| Параметр | Значение |
|----------|----------|
| Скорость парсинга | 1-3 записи/сек (в зависимости от delay) |
| Время на 100 компаний | 30-60 сек |
| Память браузера | ~1.2 ГБ (по умолчанию) |
| Записей с одного URL | до 5900 (по умолчанию) |

### Оптимизация для больших объёмов

```python
# В функции run_parser(), добавьте:
"--parser.max-records", "5900",        # максимум записей
"--parser.delay_between_clicks", "100", # меньше задержка = быстрее
"--parser.use-gc", "yes",              # включить сборщик мусора
```

---

## Интеграция с другими скриптами

### Комбинированный поиск (DuckDuckGo + 2GIS)

```bash
# Этап 1: Поиск сайтов через DuckDuckGo
echo "кафе в москве" > query.txt
python search_duckduckgo.py
# → получаем список сайтов

# Этап 2: Поиск контактов в 2GIS
python search_2gis.py
# → results.csv с названиями, телефонами, адресами
```

---

## Техническая информация

### Используемые библиотеки

| Библиотека | Версия | Назначение |
|------------|--------|-----------|
| pymorphy2 | ≥0.9 | Морфологический анализ русского текста |
| iuliia | ≥0.13 | Транслитерация (fallback) |
| python-Levenshtein | ≥0.13 | Для pymorphy2 |
| parser-2gis | ≥1.0 | Основной парсер 2GIS |

### Совместимость

- **ОС:** Linux, macOS, Windows
- **Python:** 3.7+ (рекомендуемо 3.9+)
- **Браузер:** Chromium/Chrome (автоматически определяется)

### Кодировка

Все файлы используют UTF-8 кодировку.

---

## Частые вопросы (FAQ)

### Q: Почему парсер медленный?
**A:** Задержка `--parser.delay_between_clicks 200` мс сделана умышленно для стабильности. Уменьшите если нужно скорость, увеличьте если 2GIS блокирует.

### Q: Как получить больше данных из одного города?
**A:** Создайте несколько запросов:
```bash
echo "кафе в москве" > query.txt
python search_2gis.py
mv results.csv cafes.csv

echo "рестораны в москве" > query.txt
python search_2gis.py
mv results.csv restaurants.csv
```

### Q: Можно ли искать по всей России?
**A:** Нет, 2GIS требует указания города. Создайте цикл для каждого города.

### Q: Как объединить результаты из нескольких городов?
**A:** Используйте pandas:
```python
import pandas as pd
import glob

files = glob.glob("*.csv")
dfs = [pd.read_csv(f) for f in files]
result = pd.concat(dfs, ignore_index=True)
result.to_csv("all_results.csv", index=False)
```

### Q: Парсер зависает, что делать?
**A:** Включите сборщик мусора:
```python
"--parser.use-gc", "yes",
"--parser.gc-pages-interval", "5",
```

---

## Дополнительные ресурсы

- **Документация parser-2gis:** `PARSER_2GIS_DOCS.md`
- **Полная информация о проекте:** `CLAUDE.md`
- **Исследование подходов:** `../RESEARCH.md` (в разработке)

---

## Лицензия

MIT License — используйте как угодно, в том числе в коммерческих проектах.

---

**Версия:** 1.0
**Дата обновления:** 2025-03-21
**Статус:** Production-ready ✅
