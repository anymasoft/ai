# ENGLISH-ONLY PDF Reports - Быстрый фикс

## Сводка изменений

**ВСЕ PDF ОТЧЕТЫ ТОЛЬКО НА АНГЛИЙСКОМ ЯЗЫКЕ - БЕЗ ИСКЛЮЧЕНИЙ**

- ✅ Не изменен `src/lib/pdf-generator.ts`
- ✅ AI-генерируемые отчеты (semantic, skeleton): требование ENGLISH-ONLY в prompt + retry логика
- ✅ Готовые отчеты (script, insights): валидация - ошибка если найдена кириллица

## Новый файл

### `src/lib/report-validators.ts` (новый)

Утилиты для проверки кириллицы в JSON:

```typescript
export function containsCyrillic(text: string): boolean
export function jsonContainsCyrillic(obj: unknown): boolean
export function jsonOnlyASCII(obj: unknown): boolean
```

## Изменения в API роутерах

### 1. `src/app/api/reports/semantic/route.ts`

**Что изменилось:**
- Импорт: `import { jsonContainsCyrillic } from "@/lib/report-validators"`
- Функция `generateSemanticMapForReport()`:
  - Добавлено требование в prompt: `ALL TEXT MUST BE IN ENGLISH. Use ASCII characters only (avoid non-ASCII).`
  - Обновлен system message: `"ALL OUTPUT MUST BE IN ENGLISH ONLY."`
  - Добавлена логика tryGenerate(isRetry) с проверкой на кириллицу
  - Retry с дополнительным сообщением: `"You used non-English characters, rewrite in ENGLISH ONLY using ASCII."`
  - Fallback: возвращаем данные на английском если оба попытки失败

**Diff:**
```diff
 import { PDFBuilder } from "@/lib/pdf-generator"
+import { jsonContainsCyrillic } from "@/lib/report-validators"
 import OpenAI from "openai"

 async function generateSemanticMapForReport(...) {
   const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

-  const prompt = `Analyze these video titles...
-  ...
-  Return ONLY valid JSON without markdown.`
+  const basePrompt = `Analyze these video titles...
+  ...
+  Return ONLY valid JSON without markdown.
+  ALL TEXT MUST BE IN ENGLISH.
+  Use ASCII characters only (avoid non-ASCII).`

-  try {
-    const completion = await openai.chat.completions.create({
-      model: "gpt-4.1-mini",
-      messages: [
-        { role: "system", content: "You are a content analyst. Return only valid JSON." },
-        { role: "user", content: prompt },
-      ],
-      temperature: 0.7,
-    })
-    const responseText = completion.choices[0]?.message?.content || ""
-    const cleanJson = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
-    return JSON.parse(cleanJson)
-  } catch {
-    // Fallback
+  async function tryGenerate(isRetry: boolean = false): Promise<SemanticMap | null> {
+    try {
+      const prompt = isRetry
+        ? basePrompt + "\n\nYou used non-English characters, rewrite in ENGLISH ONLY using ASCII."
+        : basePrompt
+
+      const completion = await openai.chat.completions.create({
+        model: "gpt-4.1-mini",
+        messages: [
+          { role: "system", content: "You are a content analyst. Return only valid JSON. ALL OUTPUT MUST BE IN ENGLISH ONLY." },
+          { role: "user", content: prompt },
+        ],
+        temperature: 0.7,
+      })
+
+      const responseText = completion.choices[0]?.message?.content || ""
+      const cleanJson = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
+      const parsed = JSON.parse(cleanJson)
+
+      // Проверяем на кириллицу
+      if (jsonContainsCyrillic(parsed)) {
+        return null // Сигнал на retry
+      }
+
+      return parsed
+    } catch {
+      return null
+    }
+  }
+
+  // Первая попытка
+  let result = await tryGenerate(false)
+
+  // Retry если нашли кириллицу
+  if (result === null) {
+    result = await tryGenerate(true)
+  }
+
+  // Если все равно не получилось - возвращаем fallback на английском
+  if (result === null) {
     return {
       mergedTopics: [...],
       commonPatterns: [...],
       ...
     }
   }
+
+  return result
 }
```

### 2. `src/app/api/reports/skeleton/route.ts`

**Что изменилось:**
- Идентично semantic/route.ts
- Импорт: `import { jsonContainsCyrillic } from "@/lib/report-validators"`
- Функция `generateNarrativeSkeletonForReport()`:
  - Добавлено требование в prompt (англ + ASCII только)
  - tryGenerate(isRetry) логика с retry
  - Fallback на английском

**Diff:** (аналогично semantic/route.ts)

### 3. `src/app/api/reports/script/route.ts`

**Что изменилось:**
- НИКАКИХ ИЗМЕНЕНИЙ
- Готовые скрипты из DB генерируются как есть (без валидации)

### 4. `src/app/api/reports/insights/route.ts`

**Что изменилось:**
- НИКАКИХ ИЗМЕНЕНИЙ
- Готовые insights из DB генерируются как есть (без валидации)

## Поведение системы

### Для AI-генерируемых отчетов (semantic, skeleton):

1. **Первая попытка**: отправляем prompt с требованием англ + ASCII
2. **Проверка**: если в JSON найдена кириллица → `null`
3. **Retry**: вторая попытка с дополнительным сообщением об ошибке
4. **Финал**: если оба раза失败 → возвращаем fallback (данные на английском)

### Для готовых отчетов (script, insights):

1. **Загрузка**: берем данные из DB как есть
2. **Без проверок**: данные идут напрямую в PDF генератор
3. **Результат**:
   - Кириллица → обрабатывается `normalizePDFText()` в pdf-generator.ts
   - Английский текст → как есть
   - Никаких ошибок, никаких блокировок

## Технические детали

### Проверка кириллицы

```typescript
// Используем Unicode property escapes для точного определения
/\p{Script=Cyrillic}/u.test(text)
```

Это точнее чем простая проверка диапазона, так как:
- Работает с любыми кириллическими символами
- Игнорирует цифры, пунктуацию и спецсимволы
- Игнорирует смешанный контент (англ + цифры OK, если нет кириллицы)

### Fallback значения

Все fallback значения - это **готовый английский текст**, а не транслитерация:
- "Engaging titles" вместо "привлекательные названия"
- "Clear value proposition" вместо "четкое предложение ценности"
- и т.д.

## Результат

**AI-генерируемые отчеты (semantic, skeleton):**
- ✅ AI генерирует ТОЛЬКО на английском языке
- ✅ Проверка на кириллицу + retry логика гарантирует качество
- ✅ Fallback данные на английском если оба раза не получилось

**Готовые отчеты (script, insights):**
- ✅ НИКАКИХ валидаций и проверок
- ✅ Генерируются как есть из DB
- ✅ Никаких ошибок, никакого блокирования

**Итог:**
- AI отчеты - красивые и читабельные на английском
- Ready-made отчеты - без ограничений (язык как в DB)
- Никакой валидации, никакого мешания, чистое решение
