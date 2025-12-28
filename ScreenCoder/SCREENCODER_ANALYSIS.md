# Анализ проекта ScreenCoder - ПОЛНЫЙ ОТЧЁТ

## 1. СТРУКТУРА ПРОЕКТА

```
ScreenCoder/
├── main.py                  # ТОЧКА ВХОДА - запускает весь workflow
├── block_parsor.py          # Парсинг блоков UI элементов (требует API)
├── html_generator.py        # Генерация HTML кода (требует API)
├── image_box_detection.py   # Обнаружение заполнители изображений
├── image_replacer.py        # Замена плейсхолдеров на реальные изображения
├── mapping.py               # Маппинг между плейсхолдерами и элементами UI
├── utils.py                 # Классы для работы с LLM API (Doubao, Qwen, GPT, Gemini)
├── block_parsor.py          # Парсинг структурных блоков
├── UIED/                    # Подпроект для обнаружения элементов UI
│   └── run_single.py        # Запуск детектирования на одном изображении
├── data/
│   ├── input/               # ВХОДНЫЕ ФАЙЛЫ: скриншоты сайтов (test1.png, test2.png, test3.png)
│   └── output/              # ВЫХОДНЫЕ ФАЙЛЫ: сгенерированный HTML
└── requirements.txt         # Зависимости Python
```

## 2. ТОЧКА ВХОДА И WORKFLOW

**Основной скрипт: `main.py`**

Выполняет следующее:
1. **Часть 1: Генерация с плейсхолдерами**
   - `python block_parsor.py` - Обнаруживает основные структурные блоки (header, sidebar, main content, navigation)
   - `python html_generator.py` - Генерирует HTML/CSS для каждого блока с серыми плейсхолдерами вместо изображений

2. **Часть 2: Финализация с реальными изображениями**
   - `python image_box_detection.py` - Находит плейсхолдеры в сгенерированном HTML
   - `python UIED/run_single.py` - Запускает UIED для детектирования UI элементов
   - `python mapping.py` - Маппит плейсхолдеры на реальные изображения
   - `python image_replacer.py` - Заменяет плейсхолдеры на кропированные изображения из оригинала

## 3. КРИТИЧНЫЕ ЗАВИСИМОСТИ И ФАЙЛЫ

### Обязательные файлы:
- ✅ `data/input/test1.png` (и test2.png, test3.png) - ЕСТЬ в репозитории
- ⚠️ **API ключи** - ОТСУТСТВУЮТ и ОБЯЗАТЕЛЬНЫ:
  - `doubao_api.txt` - для Doubao (по умолчанию)
  - `qwen_api.txt` - для Qwen
  - `gpt_api.txt` - для GPT-4o
  - `gemini_api.txt` - для Google Gemini

### Критичные Python пакеты:
```
Pillow>=10.0.0
beautifulsoup4>=4.12.0
volcengine-python-sdk[ark]>=1.0.0  # Для Doubao API
requests>=2.31.0
opencv-python>=4.8.0                # cv2
google-generativeai>=0.3.0          # Для Gemini ❌ ПРОБЛЕМА!
numpy>=1.24.0
openai>=1.0.0                       # Для GPT
paddlepaddle>=2.5.0                 # Для OCR
paddleocr>=2.7.0                    # Для OCR в UIED
scipy>=1.11.0
tqdm>=4.65.0
```

## 4. ПОЧЕМУ ПРОЕКТ НЕ ЗАПУСКАЕТСЯ "КАК В README"

### Проблема 1: Импорт google-generativeai крашит окружение ❌
**Симптом:**
```
pyo3_runtime.PanicException: Python API call failed
ModuleNotFoundError: No module named '_cffi_backend'
```

**Причина:**
- Конфликт между `google-generativeai` и системной версией `cryptography`
- В Python 3.11 есть несовместимость между пакетами

**Виновник в коде:**
- `utils.py` строка 4: `import google.generativeai as genai`
- Это импортируется всегда, даже если не используется Gemini!

### Проблема 2: API ключи отсутствуют ❌
**Симптом:**
- Файлы `*_api.txt` не создаются автоматически
- Скрипты упадут с ошибкой при попытке использовать API

**Виновник:**
- README не объясняет как получить ключи для каждого API
- Нет fallback логики, если ключа нет

### Проблема 3: TensorFlow/Keras несовместимы ❌
**Симптом:**
- Установка `requirements.txt` полностью падает из-за конфликтов зависимостей
- TensorFlow требует очень специфичные версии других пакетов

**Виновник:**
- TensorFlow и Keras в requirements.txt создают цепочку несовместимостей
- На самом деле они нужны только для UIED, не для основного workflow

## 5. РЕШЕНИЕ

### ШАГ 1: Использовать только что установленные пакеты

Пакеты которые РЕАЛЬНО установились успешно:
- ✅ opencv-python (cv2)
- ✅ Pillow
- ✅ beautifulsoup4
- ✅ requests
- ✅ numpy
- ✅ scipy
- ✅ paddlepaddle
- ✅ paddleocr
- ✅ openai
- ✅ volcengine-python-sdk[ark]

### ШАГ 2: Исправить utils.py

**Проблема:** Импорт google.generativeai вызывает крах

**Решение:** Переместить импорт в класс Gemini, а не на уровне модуля

### ШАГ 3: Выбрать LLM модель (GPT или Doubao)

Так как Gemini невозможно использовать в текущем окружении, нужно выбрать:
- **GPT-4o** (через OpenAI API) - рекомендуется
- **Doubao** (через Volcengine API) - более дешево
- **Qwen** - альтернатива

## 6. ЧЕТКАЯ ИНСТРУКЦИЯ ДЛЯ ЗАПУСКА

### Версия Python
```
Python 3.11.14 (подходит)
```

### Шаг 1: Клонировать и перейти в папку
```bash
cd /path/to/ScreenCoder
```

### Шаг 2: Создать и активировать виртуальную среду (РЕКОМЕНДУЕТСЯ)
```bash
python3 -m venv venv
source venv/bin/activate  # На Linux/Mac
# или
venv\Scripts\activate     # На Windows
```

### Шаг 3: Установить зависимости (исправленный requirements)
```bash
pip install -r requirements_minimal.txt
```

### Шаг 4: Получить API ключ

#### Вариант A: GPT-4o (OpenAI) - РЕКОМЕНДУЕТСЯ
1. Перейти на https://platform.openai.com/api/keys
2. Создать новый API ключ
3. Сохранить в файл:
```bash
echo "sk-ваш-ключ-здесь" > gpt_api.txt
```

#### Вариант B: Doubao (Volcengine)
1. Зарегистрироваться на https://console.volcengine.com
2. Создать API ключ в разделе "Doubao"
3. Сохранить:
```bash
echo "ваш-ключ-здесь" > doubao_api.txt
```

### Шаг 5: Исправить код (ОБЯЗАТЕЛЬНО!)

Отредактировать `block_parsor.py` строки 75-80:
```python
# БЫЛО:
client = Doubao(api_path)

# СТАЛО (для GPT):
from utils import GPT
client = GPT("gpt_api.txt")
```

И также отредактировать `html_generator.py` первый импорт API клиента.

### Шаг 6: Запустить
```bash
python main.py
```

## 7. ДАННЫЕ О КОНКРЕТНЫХ ПРОБЛЕМАХ ЗАПУСКА

### Проблема конфликта криптографии
```
File "/usr/lib/python3/dist-packages/cryptography/exceptions.py"
pyo3_runtime.PanicException: Python API call failed
```

**Причина:** Системная версия `cryptography` несовместима с `google-generativeai`

**Решение:** НЕ использовать Gemini или использовать Docker с чистым Python окружением

### Проблема с requirements.txt
```
ERROR: Cannot uninstall PyYAML 6.0.1, RECORD file not found
```

**Причина:** PyYAML установлена системным пакет-менеджером

**Решение:** Использовать `--break-system-packages` флаг (небезопасно) или виртуальную среду

## 8. МИНИМАЛЬНЫЙ РАБОЧИЙ SETUP

**Самый быстрый путь к запуску:**

1. Использовать только GPT или Qwen (не Gemini/Doubao)
2. Модифицировать utils.py убрать импорт google.generativeai
3. Создать API ключ GPT
4. Исправить block_parsor.py и html_generator.py использовать GPT вместо Doubao

## 9. ЧТО НУЖНО ИЗМЕНИТЬ В КОДЕ

### utils.py (КРИТИЧНОЕ)
Строка 4:
```python
# БЫЛО:
import google.generativeai as genai

# СТАЛО:
try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False
```

И в классе `Gemini`:
```python
def ask(self, question, image_encoding=None, verbose=False):
    if not GEMINI_AVAILABLE:
        raise RuntimeError("google-generativeai not available")
    # ... rest of code
```

### block_parsor.py (КРИТИЧНОЕ)
Строка 75-80:
```python
# БЫЛО:
client = Doubao(api_path)

# СТАЛО (выбрать один):
# Для GPT:
client = GPT(api_path)
# Или:
client = Qwen(api_path)
```

### html_generator.py (КРИТИЧНОЕ)
Строка 1 и применение модели - то же самое

## 10. ИТОГОВЫЙ ВЫВОД

**ПРОЕКТ НЕ ЗАПУСКАЕТСЯ "КАК В README" ПОТОМУ ЧТО:**

1. ❌ README не объясняет как получить API ключи
2. ❌ Импорт google.generativeai вызывает крах окружения
3. ❌ TensorFlow/Keras в requirements.txt создают конфликты
4. ❌ Код жестко зависит от Doubao по умолчанию, но Doubao ключ не предоставлен
5. ❌ Нет fallback логики если API недоступен

**РЕШЕНИЕ:**
- Использовать исправленный `requirements_minimal.txt`
- Исправить импорт в `utils.py`
- Выбрать GPT или Qwen (более надежные)
- Следовать инструкции выше

**БЕЗ ЭТИХ ДОРАБОТОК ПРОЕКТ НЕВОЗМОЖНО ЗАПУСТИТЬ.**
