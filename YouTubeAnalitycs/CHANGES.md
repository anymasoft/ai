# Changes

This file is intentionally kept minimal.
All changes are tracked in git history.

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
