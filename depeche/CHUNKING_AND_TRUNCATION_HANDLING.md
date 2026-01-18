# Chunking и Truncation Handling в Depeche

**Версия:** 1.0
**Дата:** 2026-01-18
**Автор:** Claude Code

---

## ОБЗОР

Система **Depeche** теперь полностью устойчива к длинным текстам (20–50k символов) и защищена от обрывов LLM ответов (`finish_reason=length`).

### Основные улучшения:

✅ **Автоматическое обнаружение truncation** — система проверяет `finish_reason` из OpenAI API
✅ **Retry с увеличенным лимитом** — при обрезании первый retry с 2x лимитом токенов
✅ **Intelligent chunking** — разбиение текста на логичные части по абзацам
✅ **Конфигурируемые параметры** — все лимиты через `.env` файл
✅ **Подробное логирование** — полная видимость где и почему произошел truncation
✅ **Минимальные изменения UI** — фронтенд просто обрабатывает 422 ошибку

---

## АРХИТЕКТУРА

### Трёхслойный процесс обработки:

```
┌─────────────────────────────────────────────────────────────────┐
│  ПОПЫТКА 1: Стандартный лимит токенов                           │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ LLM вызов с FRAGMENT_MAX_TOKENS или FULLTEXT_MAX_TOKENS     ││
│  └─────────────────────────────────────────────────────────────┘│
│                              ↓                                   │
│  Проверка: finish_reason == "length"?                          │
│                              ↓                                   │
│              ┌───────────────┴──────────────┐                    │
│              │ НЕТ                          │ ДА                 │
│              ↓                              ↓                    │
│        ✅ УСПЕХ (вернуть)            ПОПЫТКА 2: Retry            │
│                                   ┌─────────────────────────────┐│
│                                   │ LLM вызов с               ││
│                                   │ FRAGMENT_MAX_TOKENS * 2     ││
│                                   └─────────────────────────────┘│
│                                              ↓                   │
│                                    Проверка finish_reason         │
│                                              ↓                   │
│                          ┌───────────────────┴──────────────┐    │
│                          │ НЕТ                             │ ДА │
│                          ↓                                 ↓    │
│                    ✅ УСПЕХ             ПОПЫТКА 3: Chunking     │
│                                      ┌─────────────────────────┐│
│                                      │ Разбить на чанки      ││
│                                      │ Обработать по частям   ││
│                                      │ Собрать результат      ││
│                                      └─────────────────────────┘│
│                                              ↓                   │
│                                    Если какой-то чанк обрезан   │
│                                    → retry для этого чанка        │
│                                    → если снова обрезан → ERROR   │
│                                              ↓                   │
│                                    ✅ УСПЕХ или ❌ 422 ERROR    │
└─────────────────────────────────────────────────────────────────┘
```

---

## ПАРАМЕТРЫ (`.env`)

### Лимиты токенов по режимам:

```env
# РЕЖИМ 1: Генерация плана (5-7 пунктов списка)
PLAN_MAX_TOKENS=300

# РЕЖИМ 3: Редактирование фрагмента (один выделенный участок текста)
FRAGMENT_MAX_TOKENS=1200

# РЕЖИМ 2: Редактирование полного текста (весь текст статьи)
FULLTEXT_MAX_TOKENS=2400
```

### Retry при truncation:

```env
# Количество retry'ей при обнаружении truncation (0 = отключить retry)
RETRY_ON_TRUNCATION=1

# Множитель для увеличения лимита при retry
# Если обрезало → повтор с MAX_TOKENS * RETRY_TOKEN_MULTIPLIER
RETRY_TOKEN_MULTIPLIER=2
```

### Параметры chunking:

```env
# Целевой размер одного чанка в символах
# Система старается разбить текст примерно на такие куски
CHUNK_TARGET_CHARS=1200

# Максимальный размер одного чанка (жесткое ограничение)
# Если абзац больше → разбить по предложениям
CHUNK_MAX_CHARS=2500

# Размер контекстного окна вокруг чанка
# Используется при chunking в режимах 2 и 3 для лучшей связности
CONTEXT_WINDOW_CHARS=400

# Отладка chunking'а (дополнительные логи с информацией о чанках)
DEBUG_CHUNKING=true
```

### Пример полного `.env`:

```env
# OpenAI API
OPENAI_API_KEY=sk-proj-xxxxx
OPENAI_MODEL=gpt-4o-mini
OPENAI_TEMPERATURE=0.3

# Token limits by mode
PLAN_MAX_TOKENS=300
FRAGMENT_MAX_TOKENS=1200
FULLTEXT_MAX_TOKENS=2400

# Truncation handling
RETRY_ON_TRUNCATION=1
RETRY_TOKEN_MULTIPLIER=2

# Chunking
CHUNK_TARGET_CHARS=1200
CHUNK_MAX_CHARS=2500
CONTEXT_WINDOW_CHARS=400

# Debug
DEBUG_CHUNKING=true
```

---

## API КОНТРАКТ

### Ответы содержат метаинформацию:

#### `POST /api/articles/{id}/edit-fragment` — успешный ответ:

```json
{
  "id": 1,
  "title": "Статья про обезьян",
  "content": "...весь текст с отредактированным фрагментом...",
  "fragment": "...только отредактированный фрагмент...",
  "truncated": false,
  "finish_reason": "stop",
  "usage": {
    "prompt_tokens": 150,
    "completion_tokens": 80,
    "total_tokens": 230
  },
  "chunk_info": {
    "chunks_count": 1,
    "strategy": "single",
    "total_chars": 450
  }
}
```

#### `POST /api/articles/{id}/edit-fragment` — ошибка TRUNCATED:

```json
HTTP 422

{
  "detail": "Ошибка: фрагмент был обрезан. Выделите меньший фрагмент и попробуйте снова."
}
```

#### `POST /api/articles/{id}/edit-full` — при chunking:

```json
{
  "id": 2,
  "title": "Большая статья",
  "content": "...весь отредактированный текст...",
  "truncated": false,
  "finish_reason": "stop",
  "usage": null,  // Агрегирована от нескольких чанков
  "chunk_info": {
    "chunks_count": 5,
    "strategy": "paragraph",
    "total_chars": 25000
  }
}
```

---

## ЛОГИРОВАНИЕ

### Ключевые метки в логах:

```
[LLM CONFIG]           — Инициализация параметров
[LLM CALL]             — Начало вызова OpenAI
[LLM RESPONSE]         — Ответ получен (finish_reason, использованные токены)
[LLM TRUNCATED]        — ВНИМАНИЕ: finish_reason="length"
[PLAN]                 — Режим 1 (Генерация плана)
[PLAN RETRY]           — Retry для плана
[PLAN SUCCESS]         — План успешно сгенерирован
[PLAN FAILED]          — План остался обрезанным

[FULLTEXT]             — Режим 2 (Редактирование полного текста)
[FULLTEXT CHUNKING]    — Включен chunking (текст разбит на N чанков)
[FULLTEXT CHUNK]       — Обработка конкретного чанка
[FULLTEXT SUCCESS]     — Успешное редактирование всего текста

[FRAGMENT]             — Режим 3 (Редактирование фрагмента)
[FRAGMENT RETRY]       — Retry для фрагмента
[FRAGMENT CHUNKING]    — Включен chunking для фрагмента
[FRAGMENT SUCCESS]     — Успешное редактирование фрагмента

[EDIT_FULL]            — Endpoint redактирования полного текста
[EDIT_FRAGMENT]        — Endpoint редактирования фрагмента
```

### Пример логов при chunking:

```
2026-01-18 10:15:42 - INFO - [FULLTEXT] Начинаю редактирование всего текста. Размер: 28000 символов
2026-01-18 10:15:45 - WARNING - [LLM TRUNCATED] mode=fulltext - ответ был обрезан! completion_tokens=2400, max_tokens=2400
2026-01-18 10:15:47 - INFO - [FULLTEXT CHUNKING] Разбиваю текст на чанки для обработки
2026-01-18 10:15:47 - INFO - [FULLTEXT CHUNKING] Разбито на 12 чанков. Средний размер: 2333 символов
2026-01-18 10:15:49 - DEBUG - [FULLTEXT CHUNKING] Обрабатываю чанк 1/12 (2350 символов)
2026-01-18 10:15:51 - INFO - [LLM RESPONSE] mode=fulltext_chunk_1, finish_reason=stop, text_len=2100
2026-01-18 10:15:52 - DEBUG - [FULLTEXT CHUNKING] Чанк 1 успешно обработан (2100 символов)
... (чанки 2-12) ...
2026-01-18 10:16:25 - INFO - [FULLTEXT SUCCESS] Весь текст успешно отредактирован через 12 чанков. Итоговый размер: 27500 символов
```

---

## СЦЕНАРИИ ИСПОЛЬЗОВАНИЯ

### Сценарий 1: Маленький фрагмент (300 символов)

```
Вход: фрагмент "Обезьяны" (300 символов), инструкция "Раскрой на 3 абзаца"

[FRAGMENT] Попытка 1: один запрос с 1200 токенов
↓
finish_reason = "stop" ✅
↓
Возврат отредактированного фрагмента (800 символов) + metadata
```

**Результат:** Успешно, без retry и chunking.

---

### Сценарий 2: Большой фрагмент (5000 символов)

```
Вход: фрагмент (5000 символов), инструкция "Сделай компактнее"

[FRAGMENT] Попытка 1: один запрос с 1200 токенов
↓
finish_reason = "length" ❌ (обрезано)
↓
[FRAGMENT RETRY] Попытка 2: retry с 2400 токенов
↓
finish_reason = "length" ❌ (всё ещё обрезано)
↓
[FRAGMENT CHUNKING] Попытка 3: разбить фрагмент на 3 чанка
  - Чанк 1 (1500 символов) → обработка с контекстом → результат (1200)
  - Чанк 2 (1800 символов) → обработка с контекстом → результат (1400)
  - Чанк 3 (1700 символов) → обработка с контекстом → результат (1300)
↓
Собрать: 1200 + 1400 + 1300 = 3900 символов ✅
```

**Результат:** Успешно после chunking, metadata содержит `chunk_info: {chunks_count: 3, strategy: "paragraph"}`.

---

### Сценарий 3: Полная статья (35000 символов)

```
Вход: текст статьи (35000 символов), инструкция "Переформулируй более кратко"

[FULLTEXT] Текст > CHUNK_MAX_CHARS → сразу же включить chunking

[FULLTEXT CHUNKING] Разбить на 15 чанков (средний размер ~2300 символов)

Обработать каждый чанк:
  - Чанк 1-15: обработка по отдельности с inструкцией

Собрать результат (примерно 33000 символов) ✅
```

**Результат:** Успешно, `chunk_info: {chunks_count: 15, strategy: "paragraph", total_chars: 35000}`.

---

### Сценарий 4: Ошибка — очень маленький лимит токенов

```env
# Специально ставим очень маленький лимит для тестирования
FRAGMENT_MAX_TOKENS=50
RETRY_TOKEN_MULTIPLIER=2
```

```
Вход: фрагмент (500 символов)

[FRAGMENT] Попытка 1: 50 токенов
finish_reason = "length" ❌

[FRAGMENT RETRY] Попытка 2: 100 токенов
finish_reason = "length" ❌

[FRAGMENT CHUNKING] Попытка 3: разбить на 2 чанка
  - Чанк 1: finish_reason = "length" ❌ (даже 100 токенов недостаточно!)

Возврат HTTP 422 ❌
```

**Результат:** Ошибка 422 TRUNCATED, пользователь получает сообщение "Выделите меньший фрагмент".

---

## ТЕСТИРОВАНИЕ

### Тест 1: Маленький фрагмент без chunking

```bash
curl -X POST http://localhost:8000/api/articles/1/edit-fragment \
  -H "Content-Type: application/json" \
  -d '{
    "before_context": "Это был день.",
    "fragment": "Солнце светило ярко.",
    "after_context": "Воздух был теплый.",
    "instruction": "Раскрой на 2 предложения"
  }'
```

**Ожидаемый результат:**
- Status: 200
- `chunk_info.chunks_count: 1`
- `truncated: false`
- `finish_reason: "stop"`

---

### Тест 2: Большой фрагмент с chunking

Создайте большой текст (~5000 символов) в фрагменте:

```bash
curl -X POST http://localhost:8000/api/articles/1/edit-fragment \
  -H "Content-Type: application/json" \
  -d '{
    "before_context": "...",
    "fragment": "...[5000 символов]...",
    "after_context": "...",
    "instruction": "Сократи текст на 30%"
  }'
```

**Ожидаемый результат:**
- Status: 200
- `chunk_info.chunks_count >= 2` (был использован chunking)
- `chunk_info.strategy: "paragraph"` или `"sentence"`
- `truncated: false`

---

### Тест 3: Полная статья (~25000 символов)

```bash
curl -X POST http://localhost:8000/api/articles/1/edit-full \
  -H "Content-Type: application/json" \
  -d '{
    "instruction": "Переформулируй на более простом языке"
  }'
```

**Ожидаемый результат:**
- Status: 200
- `chunk_info.chunks_count >= 10` (текст разбит на 10+ чанков)
- `chunk_info.total_chars: ~25000`
- Вся статья в `content` (целиком, не усечено!)

---

### Тест 4: Принудительная ошибка TRUNCATED

Установите в `.env`:

```env
FRAGMENT_MAX_TOKENS=50
RETRY_TOKEN_MULTIPLIER=1  # Не увеличивать при retry
CHUNK_MAX_CHARS=40  # Очень маленький лимит на чанк
```

Затем попробуйте отредактировать даже маленький фрагмент (100+ символов):

```bash
curl -X POST http://localhost:8000/api/articles/1/edit-fragment \
  -H "Content-Type: application/json" \
  -d '{
    "before_context": "A",
    "fragment": "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    "after_context": "B",
    "instruction": "Expand"
  }'
```

**Ожидаемый результат:**
- Status: 422
- `detail: "Ошибка: фрагмент был обрезан..."`

---

## ФРОНТЕНД ИНТЕГРАЦИЯ

Минимальные изменения в `index.html`:

### В функции `editFragmentViaAPI`:

```javascript
// ... существующий код ...

.then(response => {
  if (!response.ok) {
    // НОВОЕ: обработка 422 TRUNCATED
    if (response.status === 422) {
      showNotification("Ответ был обрезан. Выделите меньший фрагмент и попробуйте снова.", "error");
      return;  // НЕ применяем partial результат!
    }

    throw new Error(`HTTP Error: ${response.status}`);
  }

  // ... существующая обработка успешного ответа ...
  // Используем updatedArticle.fragment как раньше
});
```

**Важно:** При 422 ошибке НИ ЧТО не применяется к UI, пользователь видит сообщение об ошибке.

---

## МИГРАЦИЯ СТАРЫХ ЗАПРОСОВ

Если у вас есть старый код, вызывающий `/api/articles/{id}/edit-fragment`:

**Было:**
```python
response = requests.post(..., json={...})
data = response.json()
fragment = data["fragment"]  # Может быть усечено!
```

**Теперь:**
```python
response = requests.post(..., json={...})

if response.status_code == 422:
    # Обработка truncation ошибки
    print("Фрагмент был обрезан")
    # Просим пользователя выделить меньший фрагмент
elif response.status_code == 200:
    data = response.json()
    fragment = data["fragment"]  # Гарантированно полный!
    chunk_info = data.get("chunk_info")  # Опционально для отладки
    print(f"Обработано через {chunk_info['chunks_count']} чанков")
```

---

## РЕКОМЕНДАЦИИ

### Для оптимальной производительности:

1. **Оставьте дефолтные параметры** для общего случая:
   - `PLAN_MAX_TOKENS=300`
   - `FRAGMENT_MAX_TOKENS=1200`
   - `FULLTEXT_MAX_TOKENS=2400`

2. **При работе с очень большими текстами (>50k):**
   - Увеличьте `FULLTEXT_MAX_TOKENS` до 3000-4000
   - Уменьшите `CHUNK_TARGET_CHARS` до 800-1000

3. **При работе с низкими лимитами OpenAI API:**
   - Отключите retry: `RETRY_ON_TRUNCATION=0`
   - Уменьшите максимумы токенов на 20-30%

4. **Для отладки:**
   - Включите `DEBUG_CHUNKING=true`
   - Смотрите логи с префиксом `[LLM TRUNCATED]` и `[CHUNKING]`
   - Проверяйте `chunk_info` в ответах API

---

## ЧАСТО ЗАДАВАЕМЫЕ ВОПРОСЫ

**Q: Что если все ещё возвращается 422 TRUNCATED?**
A: Это означает, что даже при максимальных попытках (retry + chunking) LLM не может обработать текст. Причины:
- Фрагмент/текст слишком большой
- Инструкция очень сложная (требует много контекста)
- Лимиты токенов слишком маленькие

Решение: выделите меньший фрагмент или увеличьте `*_MAX_TOKENS`.

**Q: Почему текст разбивается на чанки?**
A: Это нормально! Chunking используется, когда текст больше `CHUNK_MAX_CHARS` или когда один запрос обрезал ответ. Результат всё равно целый, просто обработан частями.

**Q: Может ли быть потеря информации при chunking?**
A: Нет. Система сохраняет контекст между чанками (`CONTEXT_WINDOW_CHARS`) и собирает результат последовательно.

**Q: Как отключить retry?**
A: Установите `RETRY_ON_TRUNCATION=0` в `.env`.

**Q: Можно ли использовать другую модель (не GPT-4o-mini)?**
A: Да, установите `OPENAI_MODEL=gpt-4-turbo` или `gpt-3.5-turbo`. Параметры tokenization остаются универсальны.

---

## ПОДДЕРЖИВАЕМЫЕ ВЕРСИИ

- **Python:** 3.8+
- **OpenAI SDK:** 1.0+
- **FastAPI:** 0.95+

---

## ВЕРСИЯ ИСТОРИИ

| Версия | Дата | Описание |
|--------|------|---------|
| 1.0 | 2026-01-18 | Первый релиз с полной поддержкой chunking и truncation handling |

---

**Конец документации**
