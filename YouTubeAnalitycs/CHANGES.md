# Changes

This file is intentionally kept minimal.
All changes are tracked in git history.

---

## 2025-12-12 - Консолидация кнопок управления анализом трендов (UI FIX)

### Проблема
На странице /trending компонент TrendingInsights.tsx имел дублирующиеся кнопки для одного действия:
- В CardHeader: кнопка "Сгенерировать анализ" (ВСЕГДА видна)
- В footer результатов: кнопка "Обновить анализ" (видна после генерации)

Обе кнопки вызывали один handler `generateInsights()` и создавали путанный UX.

### Решение
**Файл:** `/src/app/(dashboard)/trending/components/TrendingInsights.tsx`

- ✅ Оставлена ОДНА кнопка в CardHeader
- ✅ Кнопка условна по тексту:
  - При `insights === null` → "Сгенерировать анализ"
  - При `insights !== null` → "Обновить анализ"
- ✅ Удалена нижняя кнопка "Обновить анализ" из footer (вместе с separator border-t)
- ✅ Handler генерации остался без изменений
- ✅ Логика disabled не изменилась
- ✅ API /api/trending/insights работает как прежде

### Результат
- Одна явная точка управления анализом
- Предсказуемый UI (кнопка меняет текст по состоянию)
- Очищенный код (удалено 19 строк дублирования)

---

## 2025-12-12 - Унификация стилей кнопок Generate vs Update (UI POLISH)

### Проблема
На странице /trending кнопка "Сгенерировать анализ" (создание нового) визуально была неотличима от кнопки "Обновить анализ" (обновление существующего). Это создавало путанность в UX — пользователь не видел разницы между первоначальным созданием анализа и его обновлением.

### Решение
**Файл:** `/src/app/(dashboard)/trending/components/TrendingInsights.tsx`

Добавлена условная стилизация кнопки в CardHeader:
```tsx
variant={insights ? "outline" : "default"}
```

- ✅ При `insights === null` → `variant="default"` (чёрная кнопка, prominent)
  - Текст: "Сгенерировать анализ"
  - Семантика: PRIMARY ACTION (создание нового)
- ✅ При `insights !== null` → `variant="outline"` (спокойный стиль)
  - Текст: "Обновить анализ"
  - Семантика: SECONDARY ACTION (обновление существующего)

### Результат
- Визуальное различие делает UX яснее
- Пользователь сразу видит: создание впервые vs обновление
- Соответствует UI/UX best practices (primary vs secondary actions)
- Минимальный код (1 строка prop)

---

## 2025-12-12 - Реализация safe fallback логики для аналитических API (ПОЛНАЯ)

### Проблема
Аналитические API возвращали ошибки при недостаточности данных, что обрабатывалось фронтом как критические ошибки вместо пустых состояний. Различали по принципу "NO DATA ≠ ERROR".

### Решение - ПОЛНАЯ реализация safe fallbacks

#### ✅ Приоритет 1: Momentum API fallback hierarchy
**Файл:** `/api/channel/[id]/momentum/route.ts`

Реализована иерархия fallback:
1. High momentum видео (score > 0.5) - основной вариант
2. Rising видео (score > 0.1) - если нет high momentum
3. Normal видео (score > -0.3) - если нет rising
4. Top видео по views - если нет normal
5. Empty state `ok: true, data: null` - если нет видео вообще

**Гарантии:**
- ✅ НИКОГДА не выбрасывает "No high momentum videos found"
- ✅ Всегда использует доступные видео для анализа OpenAI
- ✅ Статистика отражает реальные категории (высокий momentum, rising и т.п.)
- ✅ `console.info()` для fallback логики, не `console.error()`

#### ✅ Приоритет 2: Dashboard Momentum empty state
**Файл:** `/api/dashboard/momentum-trend/route.ts`

Заменено:
- ❌ `throw new Error('No valid videos found...')`
- ✅ `return ok: true, trend: [], summary: {}`

Возвращает пустой тренд с нулевыми метриками при отсутствии видео.

#### ✅ Приоритет 3: Audience Analysis fallback
**Файл:** `/api/channel/[id]/audience/route.ts`

Заменено:
- ❌ `return error: "No videos with valid publication dates"`
- ✅ `return ok: true, data: null, reason: "insufficient_valid_dates"`

Сохранён существующий fallback: если нет High Engagement видео, использует top 30 по engagement score.

#### ✅ Приоритет 4: Content Intelligence empty state
**Файл:** `/api/channel/[id]/content-intelligence/route.ts`

Заменено:
- ❌ `return error: "Sync Top Videos first"`
- ✅ `return ok: true, data: null, reason: "insufficient_videos"`

#### ✅ Приоритет 5: Comments Analysis ТОЛЬКО empty state (БЕЗ generic insights)
**Файлы:**
- `/api/channel/[id]/comments/insights/route.ts`
- `/api/channel/[id]/comments/ai/route.ts`

Заменено (3 точки в каждом файле):
- ❌ `return error: "Sync Top Videos first"` → ✅ `return ok: true, data: null, reason: "insufficient_videos"`
- ❌ `return error: "No comments found..."` → ✅ `return ok: true, data: null, reason: "insufficient_comments"`
- ❌ `return error: "No valid comments..."` → ✅ `return ok: true, data: null, reason: "insufficient_valid_comments"`

**КРИТИЧЕСКОЕ ТРЕБОВАНИЕ ВЫПОЛНЕНО:**
- ✅ Комментарии НЕ имеют generic insights fallback
- ✅ ТОЛЬКО empty state возвращается
- ✅ Комментарии = первичный источник данных, без них анализ невозможен

### Новая архитектура ответов

**Success (есть данные):**
```json
{
  "ok": true,
  "data": { ... },
  "generatedAt": timestamp
}
```

**Empty state (нет данных, это НОРМАЛЬНО):**
```json
{
  "ok": true,
  "data": null,
  "reason": "insufficient_videos|insufficient_comments|insufficient_valid_comments|...",
  "status": 200
}
```

**Error (реальная ошибка):**
```json
{
  "ok": false,
  "error": "Meaningful error message",
  "status": 500
}
```

### Гарантии архитектуры
- ✅ **Определённость**: Каждый API имеет явный path для empty state
- ✅ **Детерминизм**: No data всегда = `ok: true, status: 200`, не ошибка
- ✅ **Масштабируемость**: Fallback hierarchy extensible (можно добавить ещё уровни)
- ✅ **Comments safety**: Абсолютно НИКАКИХ generic insights
- ✅ **Logging clarity**: `console.info()` для empty states, `console.error()` только для real errors
- ✅ **Frontend compatibility**: Фронт ожидает именно этот формат (`ok: true/false`)

---

## 2025-12-12 - Обработка empty-state для Momentum без ошибок JSON

### Проблема
Когда канал не имеет видео с high momentum, API возвращает ошибку "No high momentum videos found", которая фронт обрабатывает как критическую ошибку вместо нормального empty-state.

Результат:
- FINAL ERROR в console: `No high momentum videos found`
- UI показывает красную ошибку вместо информативного empty-state
- JSON-stringified ошибки в логах

### Решение

#### ✅ Добавлена функция readApiError()
```typescript
async function readApiError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (data?.error) return String(data.error);
    if (data?.message) return String(data.message);
    return `API error with status ${res.status}`;
  } catch {
    try {
      const text = await res.text();
      return text || `API error with status ${res.status}`;
    } catch {
      return `API error with status ${res.status}`;
    }
  }
}
```

#### ✅ Распознавание empty-state кейсов
```typescript
if (errorMsg.includes("No high momentum videos found") ||
    errorMsg.includes("No videos with valid publication dates") ||
    errorMsg.includes("Sync Top Videos first")) {
  console.info(`Empty state: ${errorMsg}`);
  setEmptyReason(errorMsg);
  return;  // Не throw - это нормальное состояние
}
```

#### ✅ Отдельный empty-state UI
- Выводит пользователю: "На этом канале нет видео с высоким momentum"
- Кнопка "Повторить" вместо красной ошибки
- Не заполняет error state

#### ✅ Чистые логи
- `console.info()` для empty-state
- `console.error()` только для реальных ошибок
- Никогда не stringify Error.message

### Гарантии
- ✅ Empty-state не показывается как ошибка
- ✅ Нет "FINAL ERROR" для нормальных пустых данных
- ✅ API ошибки ("No high momentum…") трактуются как пустые данные
- ✅ Реальные ошибки (500, сетевые) показываются правильно
- ✅ Никогда не JSON-stringified errors в Error.message

---

## 2025-12-12 - Исправление frontend обработки Momentum ошибок (ИСТИННО ФИНАЛЬНОЕ)

### Истинная причина `{}` (ROOT CAUSE)
**НИКОГДА не бросать объекты вместо Error**.

Старый код:
```ts
const syncError = await syncRes.json()
throw syncError  // ← ❌ КРИТИЧЕСКАЯ ОШИБКА
```

Результат:
- `throw {}` → `instanceof Error === false`
- `message === undefined`
- console.error показывает `{}`

### Решение (ПРАВИЛЬНОЕ)

#### ✅ Функция нормализации ошибок
```typescript
function normalizeError(e: unknown): Error {
  if (e instanceof Error) return e;
  if (typeof e === "string") return new Error(e);
  if (e && typeof e === "object") {
    try {
      return new Error(`Momentum error: ${JSON.stringify(e)}`);
    } catch {
      return new Error(`Momentum error: [non-serializable]`);
    }
  }
  return new Error("Unknown momentum error");
}
```

#### ✅ Никогда не парсим JSON в error path
```typescript
if (!syncRes.ok) {
  const syncText = await syncRes.text().catch(() => "");
  throw new Error(
    syncText || `Momentum sync failed with status ${syncRes.status}`
  );
}
```

#### ✅ Простой и надёжный catch блок
```typescript
catch (err) {
  const error = normalizeError(err);  // ← Гарантирует Error
  console.error(
    "[MomentumInsightsSection] FINAL ERROR:",
    error.message
  );
  setError(error.message);  // ← Всегда string, никогда не {}
}
```

### Гарантии (100%)
- ✅ `{}` **ФИЗИЧЕСКИ НЕВОЗМОЖЕН** - normalizeError гарантирует Error
- ✅ `message` **ВСЕГДА ЕСТЬ** - все пути ведут к Error с message
- ✅ `setError()` **ВСЕГДА STRING** - никогда не object
- ✅ console.error **ВСЕГДА ЧИТАЕМО** - Error.message всегда валиден
- ✅ Нет JSON.parse в error path - упрощение без потерь

---

## 2025-12-12 - Исправление обработки ошибок в Dashboard Momentum API

### Проблема
Dashboard `/api/dashboard/momentum-trend` возвращал пустые ошибки `{}` при неправильных расчётах, что скрывало реальные причины сбоев.

### Найденные проблемы
1. **Линия 95-96**: Silent try/catch при парсинге дат - ошибка скрывается без логирования
2. **Линия 112-124**: Нет проверки на NaN/Infinity в вычисляемых значениях
3. **Линия 151-157**: Нет валидации momentumScore после расчёта
4. **Линия 235-256**: Неполное логирование ошибок и неинформативный error response

### Решение
1. ✅ Логирование ошибок парсинга дат с контекстом (значение даты)
2. ✅ Валидация daysSincePublish на финитность и положительность
3. ✅ Валидация viewCount и viewsPerDay на финитность
4. ✅ Проверка medianViewsPerDay перед использованием
5. ✅ Проверка momentumScore на валидность после расчёта
6. ✅ Явная ошибка если нет валидных видео для расчётов
7. ✅ Логирование полного стека ошибок
8. ✅ Возврат stack trace в development mode

### Гарантии
- ✅ Все вычисления проверены на NaN/Infinity
- ✅ Все ошибки парсинга логируются с контекстом
- ✅ Невозможно вернуть `{}` - все ошибки имеют message
- ✅ Development mode возвращает stack для отладки

---

## 2025-12-12 - Исправление обработки ошибок в Momentum API (ПОЛНОЕ)

### Проблема (ROOT CAUSE)
Ошибки momentum API возвращали пустой объект `{}` вместо понятного сообщения, что делало отладку невозможной.

**Корень проблемы:**
- ❌ `JSON.parse()` без явной обработки ошибок парсинга
- ❌ Отсутствие валидации структуры OpenAI ответа
- ❌ Неполные сообщения об ошибках в catch блоках
- ❌ Frontend компонент не извлекал ошибку из ответа

### Решение - Двухуровневое исправление

#### Уровень 1: Frontend компонент `MomentumInsightsSection`
- ✅ Добавлено состояние `error` для хранения сообщения об ошибке
- ✅ Извлечение ошибки из API ответа: `syncError?.error || "fallback"`
- ✅ Отображение ошибки в интерфейсе с красным стилем (`destructive`)
- ✅ Собственные сообщения об ошибках для операций sync и show
- ✅ Контекстное логирование: `[MomentumInsightsSection]` prefix

#### Уровень 2: Backend API `/api/channel/[id]/momentum/route.ts`

**Проблема 1 - Небезопасный JSON.parse:**
- ✅ Обёрнут в explicit try/catch с контекстом (+ preview первых 200 символов)
- ✅ Линия 261: OpenAI response парсинг
- ✅ Линия 396: Stored momentum data парсинг

**Проблема 2 - Отсутствие валидации:**
- ✅ Добавлена валидация структуры OpenAI ответа
- ✅ Проверка наличия полей: `hotThemes`, `hotFormats`, `hotIdeas`, `explanation`
- ✅ Явные ошибки если структура невалидна

**Проблема 3 - Неполное логирование ошибок:**
- ✅ Логирование полного стека (`error.stack`) в серверные логи
- ✅ Возврат stack trace в development mode
- ✅ Оба методы (POST и GET) имеют одинаковую обработку

### Защита от каждого типа ошибки

| Сценарий | Было | Стало |
|----------|------|-------|
| Невалидный JSON от OpenAI | `{}` | `Failed to parse OpenAI response as JSON: ...` |
| Неполный объект от OpenAI | `{}` | `Missing or invalid hotThemes in OpenAI response` |
| Stored data парсится неверно | `{}` | `Failed to parse stored momentum data as JSON: ...` |
| Другая ошибка | `{}` | `[Momentum] [specific error + stack in dev]` |

### Гарантии архитектуры
- ✅ **Невозможно `{}`** - все исключения имеют явные сообщения
- ✅ **JSON.parse обёрнуты** в try/catch с контекстом
- ✅ **Валидация данных** перед использованием
- ✅ **Логирование стека** в catch блоках
- ✅ **Development stack traces** для отладки
- ✅ **Frontend отображает** ошибку пользователю
- ✅ **Оба HTTP методы** имеют одинаковую обработку

---

## 2025-12-12 - Глобальное хранилище состояния генерации аналитики (Generation Status Store)

### Проблема
Состояние кнопок генерации аналитики теряется при collapse/unmount компонентов, что приводит к:
- Потере статуса загрузки при сворачивании секции
- Возможности повторного запуска генерации, уже находящейся в процессе
- Дублированию задач на бэкенде

### Решение
Создан глобальный Zustand store для надежного хранения состояния генерации:
- **Новый файл:** `src/store/generationStatusStore.ts` - глобальное хранилище состояния
- **Тип:** `GenerationStatus = "idle" | "loading" | "success" | "error"`
- **Ключ состояния:** `${competitorId}:${sectionType}` - уникален на связку компонента и компетитора

### Обновленные компоненты
1. **ContentIntelligenceBlock.tsx** - теперь использует store для состояния загрузки
2. **MomentumInsights.tsx** - переведён на глобальное состояние
3. **DeepCommentAnalysis.tsx** - состояние синхронизировано через store
4. **AudienceInsights.tsx** - обновлён для использования глобального store
5. **DeepAudienceAnalysis.tsx** - состояние генерации в глобальном хранилище
6. **CommentInsights.tsx** - заменён на useGenerationStatusStore

### Гарантии архитектуры
- ✅ Состояние НЕ теряется при collapse/unmount
- ✅ Невозможно запустить дублирующиеся задачи
- ✅ Состояние уникально для каждого компонента и компетитора
- ✅ Полная совместимость с существующими API endpoints
- ✅ Не требуются изменения в backend
- ✅ Масштабируется на новые типы анализа
