# LeadExtractor Backend - Архитектура v2.0

## 🎯 Обзор

LeadExtractor - это BFS краулер для извлечения контактов (email, телефоны) с веб-сайтов.

**Технологии:**
- Crawl4AI 0.8.x - браузер-краулер
- FastAPI - REST API
- AsyncIO - асинхронная обработка

**Входные данные:** URL домена
**Выходные данные:** Список email и телефонов с привязкой к страницам источников

---

## 🔴 История Проблемы (v1.0)

### Обнаруженные Ошибки

#### Ошибка 1: `result.cleaned_text` не существует
```python
# ❌ Неправильно (строка 90 в старом коде)
text = result.cleaned_text or ""
# AttributeError: 'CrawlResult' object has no attribute 'cleaned_text'
```

**Почему:** CrawlResult имеет поля:
- ✅ `html: str` - сырой HTML
- ✅ `cleaned_html: Optional[str]` - очищенный HTML
- ✅ `extracted_content: Optional[str]` - извлеченный контент
- ❌ `cleaned_text` - **НЕ существует**

#### Ошибка 2: `link.split()` на Dict вызывает AttributeError
```python
# ❌ Неправильно (строка 128-129 в старом коде)
links = result.links.get("internal", [])  # Получаем List[Dict]
for link in links:
    clean_link = link.split('#')[0]       # link это Dict, не str!
    # AttributeError: 'dict' object has no attribute 'split'
```

**Почему:** `result.links` имеет структуру:
```python
{
    "internal": [
        {"href": "https://...", "text": "...", "title": "..."},
        {"href": "https://...", "text": "..."},
        ...
    ]
}
```

### Результат Ошибок

```
Итерация 1:
├─ Fetch page 1 ✅
├─ Extract contacts ❌ (cleaned_text AttributeError)
│  └─ except → continue
├─ Traversal не выполняется (очередь остается пустой)
└─ Queue пуста

Итерация 2:
└─ while queue → False, выход

ИТОГ: 1 страница, 0 контактов ❌
```

---

## ✅ Решение: Архитектура v2.0 (3 Независимых Слоя)

### Принцип Разделения

```
LAYER 1: FETCH (Получение)
├─ await crawler.arun(url)
├─ Если error → skip URL
└─ Возвращает CrawlResult или None

        ↓

LAYER 2: EXTRACTION (Независимо)
├─ Источник: result.html
├─ Fallback: result.cleaned_html
├─ Regex: email, phone
├─ Если error → empty lists (НЕ ломает traversal!)
└─ Возвращает emails[], phones[]

        ↓

LAYER 3: TRAVERSAL (Независимо)
├─ Источник: result.links["internal"]
├─ Парсим: link.get("href")
├─ Фильтруем: домен, visited, приор
├─ Если error → skip link (НЕ ломает extraction!)
└─ Добавляем в queue
```

### Ключевое Отличие

**v1.0 (Старая):**
```python
try:
    # Fetch
    result = await crawler.arun()

    # Extraction (если падает → весь блок падает)
    text = result.cleaned_text  # ❌ Error!

    # Traversal (никогда не выполняется)
    links = result.links.get("internal")
    for link in links:
        url = link.split()  # ❌ Error!

except Exception as e:
    continue  # Пропускаем страницу, queue остается пустой
```

**v2.0 (Новая):**
```python
# FETCH (попытка)
result = await self._fetch_page(crawler, url)
if result is None:
    continue

# EXTRACTION (независимо)
emails, phones = self._extract_contacts(result, url, all_emails, all_phones)
# Даже если ошибка → продолжаем

# TRAVERSAL (независимо)
self._traverse_links(result, url, domain, depth, visited, queue)
# Даже если extraction упал → traversal работает
```

---

## 🔧 Реализация (v2.0)

### LAYER 1: FETCH - Получение страницы

**Файл:** `backend/crawl4ai_client.py`, метод `_fetch_page()`

Гарантии:
- Никогда не выбрасывает exception выше
- Всегда возвращает `CrawlResult` или `None`
- Если failed → next page, не ломает BFS

### LAYER 2: EXTRACTION - Извлечение Контактов

**Файл:** `backend/crawl4ai_client.py`, метод `_extract_contacts()`

Гарантии:
- Использует ✅ `result.html` (основной источник)
- Никогда не обращается к `cleaned_text` ❌
- Все ошибки ловятся локально
- Если regex падает → empty sets, traversal не ломается

### LAYER 3: TRAVERSAL - Обход Ссылок

**Файл:** `backend/crawl4ai_client.py`, метод `_traverse_links()`

Гарантии:
- Использует ✅ `link.get("href")` (правильный доступ к Dict)
- Никогда не вызывает `split()` на Dict
- Все ошибки ловятся локально
- Даже если extraction упал → links все равно добавляются в queue

---

## 📊 BFS Логика

```
queue = deque([(domain_url, 0)])  # (url, depth)
visited = set()

while queue and len(visited) < self.max_pages:
    current_url, depth = queue.popleft()

    if current_url in visited or depth > self.max_depth:
        continue

    visited.add(current_url)

    result = await self._fetch_page(crawler, current_url)
    if result:
        self._extract_contacts(result, current_url, all_emails, all_phones)
        self._traverse_links(result, current_url, domain, depth, visited, queue)
```

**Параметры (по умолчанию):**
- `max_pages = 5` - максимум страниц для обхода
- `max_depth = 2` - максимальная глубина BFS
- `timeout = 30` - таймаут на страницу

---

## 🎯 Использование

### Python (Async)

```python
from backend.crawl4ai_client import Crawl4AIClient

client = Crawl4AIClient(timeout=30, max_pages=5)
result = await client.extract("1cca.ru")
```

### REST API

```bash
curl -X POST http://localhost:8000/api/extract \
  -H "Content-Type: application/json" \
  -d '{"urls": ["1cca.ru"]}'
```

---

## 🔒 Защита от Ошибок

| Слой | Ошибка | Действие | Результат |
|------|--------|----------|-----------|
| FETCH | Timeout | return None | Skip URL, continue BFS |
| EXTRACTION | Regex error | return empty sets | Continue traversal |
| TRAVERSAL | Invalid link | continue loop | Skip link, check next |
| BFS | max_pages | stop loop | Finish with N pages |

**Основной принцип:** Никогда не выбрасываем exception выше уровня слоя.

---

## 📈 Логирование

```
============================================================
Starting BFS traversal: https://1cca.ru
Max pages: 5, Max depth: 2
============================================================

[Page 1/5] Depth 0 → https://1cca.ru
  ✓ Success
  📧 2 emails, 📞 1 phone
  Found 15 links
  + Added 3 URLs to queue (priority=1, other=2)

...

============================================================
✓ Crawled 5 pages
✓ Found 8 emails, 3 phones
============================================================
```

---

## 🧪 Критерии Успеха (v2.0)

На сайте https://1cca.ru crawler должен:

✅ Пройти минимум 3 страницы
✅ Найти и обработать внутренние ссылки
✅ Извлечь контакты не только с homepage
✅ НЕ ломаться при ошибках на одной странице
✅ Обработать 5–10 страниц без зависания

---

## 📝 История Версий

### v1.0 (Broken)
- ❌ Использует `result.cleaned_text` (не существует)
- ❌ Неправильная обработка `links` как строк
- ❌ Смешанная логика слоёв
- 📊 Результат: 1 страница, 0 контактов

### v2.0 (Current - Fixed)
- ✅ Разделение на 3 независимых слоя
- ✅ Правильное использование `result.html` и `link.get("href")`
- ✅ Защита от ошибок на каждом уровне
- ✅ Стабильный BFS обход 5–10 страниц
- 📊 Результат: 5–10 страниц, 5–20 контактов

---

## 🎨 Frontend (React) - Исправления

### Проблема (v1.0)

Backend теперь возвращает объекты с полями `email`/`phone` и `source_page`:
```json
{
  "emails": [
    { "email": "info@1cca.ru", "source_page": "https://1cca.ru" }
  ],
  "phones": [
    { "phone": "+7 (495) 123-45-67", "source_page": "https://1cca.ru/contacts" }
  ]
}
```

React попытался рендерить эти объекты как строки:
```jsx
<td>{result.emails[i]}</td>
// ❌ Objects are not valid as a React child (found: object with keys {email, source_page})
```

### Решение (v2.0)

#### ResultsTable.jsx
- ✅ Извлекаем `.email` и `.phone` из объектов
- ✅ Добавляем `.source_page` под каждым контактом
- ✅ Защита от `undefined` с оператором `?.`
- ✅ Показываем pathname источника

```jsx
<td>
  {email ? (
    <>
      {email.email}
      {email.source_page && (
        <div className="text-xs text-gray-500 mt-1">
          {new URL(email.source_page).pathname}
        </div>
      )}
    </>
  ) : (
    '-'
  )}
</td>
```

#### App.jsx (handleExportCSV)
- ✅ Экспортируем `email.email` вместо `result.emails[i]`
- ✅ Добавляем две новые колонки: "Email Source" и "Phone Source"
- ✅ Используем optional chaining `?.email`

### Файлы Изменены
- `frontend/src/components/ResultsTable.jsx` - рендеринг контактов
- `frontend/src/App.jsx` - экспорт в CSV

### Результат
✅ UI не падает
✅ Emails отображаются с source_page
✅ Phones отображаются с source_page
✅ CSV экспорт включает источники контактов
✅ Красивый вывод с pathnames источников

---

## 🎨 Frontend UI/UX Улучшения

### Проблемы (v2.1)

1. **Пустые строки в таблице**
   - `maxLen` всегда минимум 1, даже для пустых результатов
   - Появляются строки с "-" везде

2. **Длинные URL ломают верстку**
   - `source_page` pathname может быть > 100 символов
   - Таблица растягивается горизонтально
   - Появляется скролл

3. **Контакты не интерактивные**
   - Email и phone просто текст
   - Нельзя кликнуть и сразу отправить письмо/звонок

### Решения (v2.2)

#### 1. Фильтрация пустых результатов
```jsx
const filteredResults = results.filter(
  result => (result.emails && result.emails.length > 0) || (result.phones && result.phones.length > 0)
)
```
✅ Только результаты с контактами отображаются

#### 2. Обрезка и форматирование URL
```jsx
const formatUrl = (urlString) => {
  const url = new URL(urlString)
  let path = url.pathname
  if (path.length > 40) {
    path = path.substring(0, 40) + '...'
  }
  return path
}
```
✅ URLs максимум 40 символов
✅ Добавляется "..." если обрезано
✅ Полный URL в title при hover

#### 3. Кликабельные контакты
```jsx
<a href={`mailto:${email.email}`} ... >
  {email.email}
</a>

<a href={`tel:${phone.phone.replace(/\s/g, '')}`} ... >
  {phone.phone}
</a>
```
✅ Кликнуть на email → открывается почтовый клиент
✅ Кликнуть на phone → открывается звонок
✅ Пробелы убираются из номера для tel:

#### 4. CSS улучшения
```css
td {
  max-width: 250px;
  word-break: break-word;
  overflow-wrap: break-word;
  white-space: normal;
}

td a {
  word-break: break-all;
}

.container {
  max-width: 1200px;
  overflow-x: auto;
}
```
✅ Text разбивается на слова, не перекрывает таблицу
✅ Container шире для больше стол
✅ Мягкий скролл если нужен

#### 5. UX детали
- Font-weight для domain в первой колонке
- Title атрибуты для полных URL/email
- Text-gray для пунктирных источников
- Сообщение "No contacts found" если нет результатов

### Файлы Изменены
- `frontend/src/components/ResultsTable.jsx` - полный рефактор компонента
- `frontend/src/index.css` - стили для таблицы

### Результат

**Вид таблицы ПОСЛЕ:**
```
Website    | Email              | Phone           | Source
-----------|--------------------|-----------------|---------
1cca.ru    | info@1cca.ru       | +7 (495) 123... | /
           | /about             | /contacts       |
           |                    |                 |
company.io | contact@company.io | +1 (555) 000... | /
           | /team              | /contact        |
```

✅ Нет пустых строк
✅ No горизонтального скролла
✅ Все контакты кликабельные
✅ URLs аккуратно отображаются
✅ Продакшн качество UI

### Функции ResultsTable v2.2

1. **formatUrl()** - обрезает и форматирует длинные URL
2. **filteredResults** - только результаты с контактами
3. **mailto: и tel: ссылки** - интерактивные контакты
4. **Graceful fallback** - "-" если контактов нет
5. **"No contacts found"** - сообщение когда пусто
