# OpenLovable — История изменений и доработок

**ОБЯЗАТЕЛЬНО:** Все доработки, баги, фиксы и новые функции ДОЛЖНЫ быть задокументированы в этом файле. Без документации в CHANGES.md коммит считается неполным.

---

## 📋 Структура документации

- **версия**: номер коммита или дата
- **тип**: fix, feature, refactor, docs, etc.
- **описание**: что было сделано и почему
- **файлы**: какие файлы были изменены
- **связанные баги/проблемы**: что было исправлено
- **инструкция для воспроизведения**: как проверить изменение

---

## 🚀 PHASE: Edit-Mode Full File Rewrites + Tailwind Diagnostic

### Версия: `2bf4648` (текущая)
**Дата:** 2025-12-21
**Статус:** ✅ Edit-пайплайн стабилизирован, Tailwind проблема диагностирована

---

## 📝 РАБОТЫ ТЕКУЩЕЙ ФАЗЫ (2025-12-21)

### Коммит 1: `6f87543` — Полное удаление Morph Fast Apply
**Тип:** refactor
**Описание:** Полностью удалены все ссылки на Morph Fast Apply для MVP-стабильности.

**Изменения:**
- Закомментирован импорт `parseMorphEdits` и `applyMorphEditToFile`
- Удалены все `morphEnabled` проверки
- Удалены блоки применения Morph edits (30+ строк кода)
- Удалены `morphUpdatedPaths` фильтрирование

**Файлы:**
- app/api/apply-ai-code-stream/route.ts
- app/api/apply-ai-code/route.ts
- app/api/generate-ai-code-stream/route.ts

**Результат:**
- ❌ Нет spawn/cat вызовов
- ❌ Нет ENOENT ошибок на Windows
- ✅ Edit-режим ВСЕГДА использует full file rewrites через fs.writeFileSync()

**Проверка:**
```bash
# Edit-запрос не должен вызывать spawn
grep -r "spawn.*cat\|applyMorphEditToFile" app/api/
# Результат: пусто (0 совпадений)
```

---

### Коммит 2: `98b7a0b` — Обновление LLM промпта для edit-режима
**Тип:** feat
**Описание:** Обновлены инструкции для LLM по генерации edit-блоков с полным контентом файла.

**Изменения в generate-ai-code-stream/route.ts:**
- Добавлена секция "EDIT MODE - FULL FILE REWRITE FORMAT (MVP)"
- Инструкции требуют формат: `<edit target_file="..."><update>[ПОЛНЫЙ КОД]</update></edit>`
- Добавлена валидационная чек-лист для edit-блоков (imports, functions, closing tags)
- Примеры CORRECT и WRONG поведения
- Запреты: ellipsis (...), diff-формат (+/-), partial code

**Результат:**
- LLM теперь знает, что edit-режим требует полный файл
- Нет diff/patch ответов
- Нет обрезанного контента

---

### Коммит 3: `e14d5a4` — Реализация parseEditResponse() и atomic writes
**Тип:** fix
**Описание:** Реализована функция для парсинга edit-блоков с атомарной записью файлов.

**Добавлено в apply-ai-code-stream/route.ts:**
- Функция `parseEditResponse()` (строки 269-324)
- Парсит `<edit target_file="..."><update>...</update></edit>` блоки
- Валидация:
  - Отклоняет path traversal (.., абсолютные пути)
  - Отклоняет diff-формат
  - Отклоняет обрезанный контент
- Edit-режим (строки 418-575):
  - `fs.mkdirSync()` + `fs.writeFileSync()` для каждого файла
  - Логирование bytesWritten
  - Verification phase с readFileSync()
  - Обновление file cache

**Результат:**
- ✅ fs.writeFileSync гарантирует атомарную запись
- ✅ Работает на Windows (только Node fs API)
- ✅ Verification фаза подтверждает факт записи на диск
- ✅ Нет uncaughtException

**Проверка:**
```bash
# Логи должны содержать:
grep "\[EDIT_REWRITE\] File written:" server.log
# Вывод: filePath, fullPath, bytesWritten > 0
```

---

### Коммит 4: `2bf4648` — Fallback для <file> блоков и защита writer.close()
**Тип:** feat
**Описание:** Реализована устойчивость к обоим форматам ответов LLM и предотвращение double-close ошибок.

**Изменения в apply-ai-code-stream/route.ts:**
- Добавлен флаг `writerClosed` (строка 412)
- FALLBACK логика (строки 432-441):
  - Если нет `<edit>` блоков, но есть `<file>` блоки → используем их как полные файлы
  - Конвертируем `parsed.files` в `editList` формат
  - Логируем: "No <edit> blocks found, using <file> blocks as fallback"
- Защита от double-close (строки 571-574, 943-946):
  - `if (!writerClosed)` перед `await writer.close()`
  - Флаг `writerClosed = true` после закрытия

**Результат:**
- LLM может вернуть либо `<edit>`, либо `<file>` блоки
- Backend автоматически преобразует `<file>` в edit-режим
- ❌ Нет WritableStream is closed ошибок
- ✅ Оба формата работают

**Проверка:**
```bash
# Запрос на русском: "Переведи на русский"
# LLM может вернуть <file> вместо <edit>
# Backend не должен упасть
grep "WritableStream is closed" server.log
# Результат: пусто (0 совпадений)
```

---

## 🔍 ДИАГНОСТИКА: Tailwind CSS в LocalProvider Sandbox

**Дата:** 2025-12-21
**Статус:** ✅ Проблема диагностирована (см. TAILWIND_DIAGNOSTIC_REPORT.md)

### Проблема
Сайты генерируются с Tailwind-классами (text-gray-700, bg-white), но в iframe отображаются **БЕЗ СТИЛЕЙ**.

### Корневая причина
`LocalProvider.createSandboxScaffold()` (lib/sandbox/providers/local-provider.ts) **НЕ генерирует** три критических файла:
1. `tailwind.config.js` — конфигурация Tailwind
2. `postcss.config.js` — конфигурация PostCSS
3. `src/index.css` — CSS-файл с директивами `@tailwind base/components/utilities`

Плюс `src/main.jsx` **не импортирует** `./index.css`.

**Результат:**
- Vite не знает о PostCSS
- Tailwind не компилируется
- Classnames остаются как bare strings в DOM
- CSS не применяется

### Сравнение реализаций

| Компонент | Vercel Sandbox | Local Sandbox |
|-----------|---|---|
| tailwind.config.js | ✅ Генерируется | ❌ НЕ генерируется |
| postcss.config.js | ✅ Генерируется | ❌ НЕ генерируется |
| src/index.css | ✅ Генерируется | ❌ НЕ генерируется |
| CSS import в main.jsx | ✅ Присутствует | ❌ Отсутствует |
| Tailwind в devDependencies | ✅ Есть | ✅ Есть |

### Файлы для отслеживания
- `lib/sandbox/providers/local-provider.ts` (строки 281-393) — функция createSandboxScaffold()
- `app/api/create-ai-sandbox/route.ts` — эталонная реализация для Vercel (можно копировать логику)
- Отчет: `TAILWIND_DIAGNOSTIC_REPORT.md`

### Рекомендуемое исправление
Дополнить `createSandboxScaffold()` генерацией недостающих файлов (аналогично Vercel реализации).

---

## 🚀 PHASE: Local Sandbox MVP + AI Code Application Flow Fix

### Версия: `3c00dba` (стабильная основа для текущей фазы)
**Дата:** 2025-12-20
**Статус:** ✅ Базовая версия

---

## 🔴 ОСНОВНЫЕ ПРОБЛЕМЫ (ИСПРАВЛЕНЫ)

### Проблема #1: iframe показывает дефолтный React App вместо сгенерированного кода

**Диагноз:**
- `/api/apply-ai-code-stream` писал файлы на диск корректно
- Но Vite не перезагружался и служил старый код из памяти
- iframe показывал "Welcome to your React App" (дефолт из template)

**Причины:**
1. `/api/apply-ai-code-stream` не вызывал `/api/restart-vite` после записи файлов
2. Vite продолжал служить старый JavaScript из памяти
3. UI не обновлял iframe при получении `type: 'complete'`

**Исправление:**
- Коммит `5ca0c9c`: добавлен вызов restart-vite в apply-ai-code-stream
- Коммит `4685ce4`: UI обновляет iframe при получении complete события

**Проверка:**
```bash
# Запустить клонирование любого сайта
# iframe должен показать сгенерированный код, а не дефолт
```

---

### Проблема #2: sandbox loss между create и apply

**Диагноз:**
- `/api/create-ai-sandbox-v2` создавал sandbox и возвращал sandboxId
- UI теряла sandboxId между create и apply
- `/api/apply-ai-code-stream` вызывалась с `sandboxId: undefined`
- Backend автоматически создавал НОВЫЙ sandbox
- Vite работал в новой папке, но iframe смотрел в старую

**Причины:**
1. UI не сохраняла sandboxId в состояние
2. Backend позволял apply без sandboxId (создавал новый)
3. Не было валидации sandboxId при edit

**Исправление:**
- Коммит `3c00dba`: enforcement sandboxId contract
  - Backend: reject edit без sandboxId (400 Bad Request)
  - UI: validate sandboxId перед edit
  - Запрет auto-creation sandbox при edit

**Проверка:**
```bash
# Запустить apply без sandboxId (edit=true)
# Должна быть ошибка 400: "sandboxId is required for edits"
```

---

### Проблема #3: spawn mkdir ENOENT на Windows

**Диагноз:**
- `apply-ai-code-stream` использовал `spawn('mkdir')` для создания директорий
- На Windows mkdir не существует как отдельный бинарник
- Ошибка: "spawn mkdir ENOENT"

**Исправление:**
- Коммит `b6ad838`: удален вызов spawn mkdir
- LocalProvider.writeFile() уже создаёт директории через fs.mkdir()

---

### Проблема #4: spawn npm ENOENT на Windows

**Диагноз:**
- `spawn('npm')` не работает на Windows
- На Windows npm это `npm.cmd`

**Исправление:**
- Коммит `1287ccd`: добавлена поддержка Windows
  - `os.platform() === 'win32' ? 'npm.cmd' : 'npm'`
  - Применено в startViteServer и runInstall

---

### Проблема #5: неверный путь к template

**Диагноз:**
- LocalProvider использовал путь: `'open-lovable/templates/vite-react'`
- Правильный путь: `'templates/vite-react'`
- Ошибка: "ENOENT: no such file or directory"

**Исправление:**
- Коммит `3418c14`: исправлен путь к template
- Добавлена проверка existsSync перед копированием

---

## ✅ РЕАЛИЗОВАННЫЕ FEATURES

### Feature #1: Local Sandbox MVP

**Коммит:** `b68bcb6` + `dd716c2` + `3418c14` + `1287ccd`

**Файлы:**
- `lib/sandbox/local-sandbox-manager.ts` (150 строк)
  - Singleton для управления жизненным циклом песочниц
  - Отслеживание: sandboxId → {dir, port, process, logsBuffer}
  - Выделение портов начиная с 5173
  - Буферизация логов (последние 200 строк)

- `lib/sandbox/providers/local-provider.ts` (320 строк)
  - Полная реализация SandboxProvider для локальных sandbox
  - createSandbox(): копирует template, npm install, запускает Vite
  - writeFile(), readFile(), listFiles()
  - restartViteServer(): kill процесса + spawn новый
  - reconnect(sandboxId): переподключение к существующему sandbox
  - Windows поддержка: npm vs npm.cmd

- `templates/vite-react/` (8 файлов)
  - React 18.2, Vite 4.4, Tailwind 3.3
  - PostCSS + Autoprefixer
  - Полностью настроен для development

- `lib/sandbox/factory.ts` (+5 строк)
  - Поддержка 'local' provider
  - isProviderAvailable('local') = true (всегда доступен)

- `lib/sandbox/sandbox-manager.ts` (+15 строк)
  - Поддержка reconnect для LocalProvider

**Проверка:**
```bash
# Создать новый sandbox
POST /api/create-ai-sandbox-v2
# Response: { sandboxId, url: 'http://localhost:5173', ... }

# Проверить директорию
ls ./sandboxes/{sandboxId}/
# Должны быть src/, public/, package.json, vite.config.js, etc.

# Открыть в браузере
http://localhost:5173
# Должно открыться React приложение
```

---

### Feature #2: Автоматический Vite restart после apply

**Коммит:** `5ca0c9c`

**Файл:** `app/api/apply-ai-code-stream/route.ts` (+32 строки)

**Логика:**
1. Запись файлов на диск (через provider.writeFile)
2. КЛЮЧЕВОЙ ШАГ: вызов POST /api/restart-vite
3. Ожидание HTTP 200 (Vite готов)
4. Отправка type: 'complete' в UI

**Проверка:**
```bash
# Применить код
POST /api/apply-ai-code-stream
# Смотреть логи:
# [TRACE] files written, before restart-vite
# [TRACE] calling restart-vite
# [TRACE] restart-vite: READY (200 OK)
# [TRACE] before sendProgress complete
```

---

### Feature #3: UI обновляет iframe при type: 'complete'

**Коммит:** `4685ce4`

**Файл:** `app/generation/page.tsx` (+18 строк)

**Логика:**
```ts
case 'complete':
  if (effectiveSandboxData?.url) {
    setTimeout(() => {
      if (iframeRef.current) {
        const urlWithTimestamp = `${url}?t=${Date.now()}&applied=true`
        iframeRef.current.src = urlWithTimestamp
      }
    }, 500)
  }
  setLoading(false)
```

**Результат:** iframe перезагружается с новым timestamp, браузер видит обновленный код

---

### Feature #4: Enforcement sandboxId contract

**Коммит:** `3c00dba`

**Файлы:**
- `app/api/apply-ai-code-stream/route.ts` (+23 строки)
- `app/generation/page.tsx` (+12 строк)

**Логика Backend:**
```ts
// Reject edit без sandboxId
if (isEdit && !sandboxId) {
  return 400: 'sandboxId is required for edits'
}

// Запретить auto-create при edit
if (isEdit && !provider) {
  return 400: 'Sandbox not found or expired'
}
```

**Логика UI:**
```ts
// Validate перед edit
if (isEdit && !effectiveSandboxData?.sandboxId) {
  throw Error('Sandbox not initialized')
}

// Логирование
console.log('[applyGeneratedCode] sandboxId:', sandboxId)
console.log('[applyGeneratedCode] isEdit:', isEdit)
```

**Результат:** Четкое разделение сценариев:
- Новый клон (isEdit=false, no sandboxId) → create new
- Правка (isEdit=true, with sandboxId) → use existing
- Правка без sandboxId → error 400

---

## 🐛 ДИАГНОСТИЧЕСКИЕ ЛОГИ

**Коммит:** `5cc59f7`

Добавлены TRACE логи для отладки execution flow:

**apply-ai-code-stream:**
```
[TRACE] apply start
[TRACE] files written, before restart-vite
[TRACE] calling restart-vite
[TRACE] restart-vite response received
[TRACE] before sendProgress complete
[TRACE] after sendProgress complete
```

**restart-vite:**
```
[TRACE] restart-vite: start
[TRACE] restart-vite: killing process
[TRACE] restart-vite: starting new Vite
[TRACE] restart-vite: waiting for readiness
[TRACE] restart-vite: READY (200 OK)
[TRACE] restart-vite: returning response
```

**Использование:**
```bash
# Запустить apply, смотреть backend логи
# Каждый TRACE должен появиться в правильном порядке
# Если какой-то TRACE отсутствует = зависание в этом месте
```

---

## 📊 GIT КОММИТЫ (ХРОНОЛОГИЧЕСКИЙ ПОРЯДОК)

```
3c00dba - fix: enforce sandboxId contract - prevent sandbox loss
4685ce4 - fix: handle apply-ai-code-stream complete event
5cc59f7 - debug: add diagnostic trace logs
c8e7c39 - chore: add sandboxes directory to .gitignore
5ca0c9c - fix: add automatic Vite restart to apply-ai-code-stream
b6ad838 - fix: remove spawn mkdir from apply-ai-code-stream
1287ccd - fix: support npm on Windows in LocalProvider
3418c14 - fix: correct Vite template path in LocalProvider
dd716c2 - fix: add npm install to LocalProvider
b68bcb6 - feat: implement Local Sandbox MVP - Phase 1 & 2
```

---

## 🔧 АРХИТЕКТУРА (ИТОГОВАЯ)

### Создание sandbox

```
UI: "Create sandbox"
  ↓
POST /api/create-ai-sandbox-v2
  ↓
LocalProvider.createSandbox()
  - Generate sandboxId
  - Copy template to ./sandboxes/{sandboxId}/
  - npm install (npm vs npm.cmd на Windows)
  - spawn Vite на localhost:{port}
  ↓
waitForSandboxReady() — HTTP polling
  - Ждёт HTTP 200 от Vite
  ↓
Response: { sandboxId, url: 'http://localhost:{port}' }
  ↓
UI: setSandboxData(response)
```

### Применение кода

```
UI: applyGeneratedCode(code, isEdit=true, sandboxId)
  - Validate: sandboxId обязателен
  - Log: [applyGeneratedCode] sandboxId, isEdit
  ↓
POST /api/apply-ai-code-stream { response, isEdit, sandboxId }
  - Validate: if isEdit && !sandboxId → 400
  - Log: [apply] sandboxId, isEdit
  ↓
WriteFile loop:
  - provider.writeFile() → fs.writeFile (создаёт директории)
  ↓
КЛЮЧЕВОЙ ШАГ: Restart Vite
  POST /api/restart-vite
    - provider.restartViteServer()
    - waitForViteReady() — HTTP polling до 200 OK
  ↓
SendProgress({ type: 'complete' })
  ↓
UI: type === 'complete'
  - Stop loading
  - Update iframe: iframeRef.src = url + ?t={Date.now()}
  - setLoading(false)
  ↓
iframe перезагружается с новым timestamp
  - Vite отправляет ОБНОВЛЕННЫЙ код
  - Пользователь видит сгенерированный дизайн
```

---

## ⚙️ ОКРУЖЕНИЕ И ЗАВИСИМОСТИ

**Node.js:** 18+ (для spawn, fs.promises)
**npm:** 8+ (для npm install)
**OS:** Windows, Linux, macOS (кросс-платформенный)

**Ключевые пакеты:**
- `@vitejs/plugin-react`: React plugin для Vite
- `tailwindcss`: CSS framework (обязателен в template)
- `postcss`: CSS processing
- `autoprefixer`: CSS vendor prefixes

---

## 🧪 КАК ПРОВЕРИТЬ ВСЁ

### 1. Базовая проверка Local Sandbox

```bash
# Создать sandbox
POST http://localhost:3000/api/create-ai-sandbox-v2

# Проверить директорию
ls ./sandboxes/sbx_*/src/

# Открыть в браузере (сказать URL из response)
# Должен загрузиться React App с "Welcome to your React App"
```

### 2. Проверить apply без restart

```bash
# ВРЕМЕННО закомментировать restart блок в apply-ai-code-stream
# Применить код к sandbox
# iframe покажет "Welcome to your React App" (старый код)
# ✗ Это ошибка

# Раскомментировать restart
# Применить код снова
# iframe покажет сгенерированный дизайн
# ✓ Исправлено
```

### 3. Проверить sandboxId contract

```bash
# Попытаться применить код БЕЗ sandboxId (isEdit=true)
curl -X POST http://localhost:3000/api/apply-ai-code-stream \
  -H "Content-Type: application/json" \
  -d '{
    "response": "...",
    "isEdit": true,
    "sandboxId": null
  }'

# Должен вернуть 400: "sandboxId is required for edits"
# ✓ Контракт зафиксирован
```

### 4. Проверить Windows совместимость

```bash
# На Windows: npm должен быть npm.cmd
# Логи должны показать:
# [LocalProvider] Starting Vite on port 5173
# ✓ Если npm.cmd сработал
```

---

## 📝 ИНСТРУКЦИЯ ДЛЯ РАЗРАБОТЧИКОВ

### ОБЯЗАТЕЛЬНО ДОПИСЫВАТЬ В CHANGES.md КОГДА:

1. **Добавляется новый фиксбаг:**
   ```markdown
   ### Проблема #N: Название проблемы

   **Диагноз:** Что произошло
   **Причины:** Почему это произошло
   **Исправление:** Коммит XXX
   **Файлы:** Какие файлы изменены
   **Проверка:** Как проверить фикс
   ```

2. **Добавляется новая фиче:**
   ```markdown
   ### Feature #N: Название фичи

   **Коммит:** XXX
   **Файлы:** Список файлов
   **Логика:** Как это работает
   **Проверка:** Как проверить
   ```

3. **Изменяется API или архитектура:**
   - Обновить раздел "АРХИТЕКТУРА (ИТОГОВАЯ)"
   - Добавить диаграмму если нужно

4. **Добавляется новый диагностический лог:**
   ```markdown
   ### Диагностический лог: Название

   **Коммит:** XXX
   **Использование:** Как читать логи
   ```

### ФОРМАТ КОММИТА:

```
fix: краткое описание - полное объяснение проблемы и решения

- Что было сделано
- Какие файлы изменены
- Почему это важно

Связанный багре: #XXX (если есть)
```

### ПЕРЕД COMMIT:

```bash
# 1. Убедиться, что изменения работают
# 2. Добавить запись в CHANGES.md
# 3. git add CHANGES.md + остальные файлы
# 4. git commit -m "..."
# 5. git push
```

---

## 🎯 ТЕКУЩИЙ СТАТУС

**Версия:** `3c00dba`
**Статус:** ✅ **Полностью рабочая**

**Что работает:**
- ✅ Local Sandbox создание и запуск
- ✅ Vite dev server на localhost
- ✅ Применение AI-кода с автоматическим restart Vite
- ✅ iframe обновляется при новом коде
- ✅ Кросс-платформенность (Windows, Linux, macOS)
- ✅ sandboxId контракт между UI и backend
- ✅ Диагностические логи для отладки

**Известные ограничения (MVP):**
- Нет персистентности sandbox данных (очищается на перезапуск)
- Нет cleanup процесса (sandbox остаётся в памяти)
- Нет мониторинга процессов (no watchdog)
- Нет лимитов на занимаемое место (может расти бесконечно)

**Эти ограничения планируются для Phase 2** (если потребуется)

---

## 📞 КОНТАКТ ДЛЯ ВОПРОСОВ

- Все логи в backend консоли помечены [TAG] для быстрого поиска
- TRACE логи помечены [TRACE] для execution flow диагностики
- Диагностический эксперимент: manual edit файла + refresh iframe

---

**Последнее обновление:** 2025-12-20 (коммит 3c00dba)
**Ответственный:** Claude Code (AI-ассистент)
**Язык документации:** Русский
