# Парсер 2GIS — Отдельное окружение

## 🎯 Почему отдельная папка?

В этой папке находится `search_2gis.py` с отдельным виртуальным окружением `parser_env/` из-за конфликтов зависимостей с основным проектом.

---

## 🚀 Первая установка (3 минуты)

### 1. Перейти в папку PARSER

```bash
cd PARSER
```

### 2. Создать виртуальное окружение

**Linux/macOS:**
```bash
python3 -m venv parser_env
source parser_env/bin/activate
```

**Windows:**
```bash
python -m venv parser_env
parser_env\Scripts\activate
```

### 3. Установить зависимости

```bash
pip install pymorphy2 python-Levenshtein iuliia parser-2gis requests python-dotenv
```

### 4. Скачать базу городов

```bash
curl -o russia-cities.json https://raw.githubusercontent.com/arbaev/russia-cities/master/cities.json
```

Или скачайте вручную: https://raw.githubusercontent.com/arbaev/russia-cities/master/cities.json

### 5. Создать файл конфигурации .env

Скопируйте `.env.example` в `.env` и добавьте свой OpenAI API ключ:

```bash
cp .env.example .env
nano .env  # или используйте ваш редактор

# Содержимое .env:
OPENAI_API_KEY=sk-your-actual-api-key-here
OPENAI_MODEL=gpt-4o-mini
```

**Важно:** Не коммитьте `.env` файл в git! Используйте только `.env.example` как шаблон.

---

## ✅ Проверка установки

```bash
python search_2gis.py --help
# или
python search_2gis.py

# Должно вывести ошибку: "Файл query.txt не найден!"
# (это нормально - требуется создать query.txt)
```

---

## 🔄 Использование

### Каждый раз перед использованием:

```bash
# Активировать окружение
source parser_env/bin/activate  # Linux/macOS
# или
parser_env\Scripts\activate     # Windows

# Использовать скрипт
echo "автомойки в иркутске" > query.txt
python search_2gis.py

# Дезактивировать окружение (опционально)
deactivate
```

---

## 📁 Структура папки

```
PARSER/
├── parser_env/                 ← Виртуальное окружение (не в git)
├── .env                        ← Переменные окружения (создайте, не в git)
├── .env.example                ← Шаблон .env
├── search_2gis.py              ← Основной скрипт
├── README_2GIS.md              ← Гайд для быстрого старта
├── PARSER_2GIS_DOCS.md         ← Полная документация parser-2gis
├── EXAMPLES.sh                 ← Примеры использования
├── SETUP.md                    ← Этот файл
├── query.txt                   ← Ваш запрос (создавайте перед запуском)
├── russia-cities.json          ← База городов (скачайте)
└── results.csv                 ← Результаты парсинга
```

---

## ⚙️ Git

Папка `parser_env/` добавлена в `.gitignore` (на уровне EXTRACTOR) и **не коммитится** на GitHub.

Это сделано специально чтобы:
- Экономить место в репозитории
- Избежать конфликтов версий
- Позволить каждому установить нужные версии для своей ОС

---

## 🐛 Решение проблем

### Ошибка: "python: command not found"

Используйте `python3`:
```bash
python3 -m venv parser_env
python3 -m pip install pymorphy2 python-Levenshtein iuliia parser-2gis requests python-dotenv
```

### Ошибка: "No module named 'pymorphy2'"

Убедитесь что окружение активировано:
```bash
source parser_env/bin/activate  # или в Windows: parser_env\Scripts\activate
pip install pymorphy2 python-Levenshtein iuliia parser-2gis requests python-dotenv
```

### Ошибка: "parser-2gis: command not found"

```bash
# Переактивируйте окружение
deactivate
source parser_env/bin/activate

# Переустановите
pip install parser-2gis
```

### Ошибка: "Chrome/Chromium не найден"

Установите браузер:

**Ubuntu/Debian:**
```bash
sudo apt-get install chromium-browser
```

**macOS:**
```bash
brew install chromium
```

**Windows:**
Установите Chrome: https://www.google.com/chrome/

---

## 📚 Документация

- **README_2GIS.md** — Быстрый старт (5 минут)
- **PARSER_2GIS_DOCS.md** — Полная документация parser-2gis
- **EXAMPLES.sh** — Примеры использования
- **SETUP.md** — Этот файл (установка окружения)

---

## 💡 Советы

### Batch обработка нескольких городов

```bash
#!/bin/bash
source parser_env/bin/activate

for city in "москве" "спб" "новосибирске"; do
  echo "кафе в $city" > query.txt
  python search_2gis.py
  mv results.csv "results_${city}.csv"
done

deactivate
```

### Использование с другими скриптами

```bash
# Из родительской папки (EXTRACTOR)
cd ..
python search_duckduckgo.py "стоматологии в москве"

# Затем вернуться в PARSER и использовать 2GIS
cd PARSER
source parser_env/bin/activate
python search_2gis.py
```

---

**Версия:** 1.0
**Дата:** 2025-03-21
**Статус:** Production-ready ✅
