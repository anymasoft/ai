# Диагностический отчёт: Tailwind CSS в LocalProvider Sandbox

## Дата отчёта
2025-12-21

## Проблема
Сайты генерируются с Tailwind-классами (text-gray-700, bg-white и т.д.), но в iframe они отображаются **БЕЗ СТИЛЕЙ**.

## Диагностический результат

### 1. Состояние Tailwind в scaffold

| Компонент | Статус | Деталь |
|-----------|--------|--------|
| Tailwind packages | ✅ YES | tailwindcss, postcss, autoprefixer в devDependencies |
| tailwind.config.js | ❌ NO | НЕ генерируется в createSandboxScaffold() |
| postcss.config.js | ❌ NO | НЕ генерируется в createSandboxScaffold() |
| src/index.css | ❌ NO | НЕ генерируется в createSandboxScaffold() |
| CSS import в main.jsx | ❌ NO | Нет `import './index.css'` |
| PostCSS pipeline активен | ❌ NO | Нет конфигурации |

### 2. Место проблемы

**Файл:** `lib/sandbox/providers/local-provider.ts`
**Функция:** `createSandboxScaffold()` (строки 281-393)

Эта функция создаёт базовый scaffold для нового sandbox'а, но **пропускает создание файлов, необходимых для работы Tailwind**.

### 3. Сравнение: Vercel vs Local

**Vercel Sandbox** (`app/api/create-ai-sandbox/route.ts`):
- ✅ Создаёт tailwind.config.js (строки 183-194)
- ✅ Создаёт postcss.config.js (строки 197-203)
- ✅ Создаёт src/index.css с `@tailwind` директивами (строки 253-278)
- ✅ src/main.jsx содержит `import './index.css'`

**Local Sandbox** (`lib/sandbox/providers/local-provider.ts`):
- ❌ Не создаёт tailwind.config.js
- ❌ Не создаёт postcss.config.js
- ❌ Не создаёт src/index.css
- ❌ src/main.jsx без импорта CSS

### 4. Почему стили не применяются

1. **Отсутствие файлов конфигурации** → Vite не знает, что нужно запустить PostCSS
2. **Отсутствие src/index.css** → Нечего компилировать (нет `@tailwind base/components/utilities`)
3. **Отсутствие CSS import в main.jsx** → Даже если бы файл существовал, он не будет загружен
4. **PostCSS не запускается** → Tailwind классы остаются "мёртвыми строками"
5. **Результат:** Bare `className="bg-white"` отображается без CSS

### 5. Ожидания LLM

В `app/api/generate-ai-code-stream/route.ts` (строки 640-642):

```
CONSTRAINT: Do NOT edit tailwind.config.js, postcss.config.js
or package.json - they already exist in the template!
```

**Проблема:** Для LocalProvider эти файлы НЕ существуют, но LLM считает, что они есть.

## Корневая причина

LocalProvider.createSandboxScaffold() недоген​ерирует три КРИТИЧЕСКИХ файла:
- `tailwind.config.js`
- `postcss.config.js`
- `src/index.css` с `@tailwind` директивами

Плюс `src/main.jsx` не импортирует CSS.

**Вследствие:** Vite не активирует PostCSS → Tailwind не компилируется → стилей нет в DOM.

## Рекомендуемое исправление

Добавить в `LocalProvider.createSandboxScaffold()`:

1. Создание файла `tailwind.config.js` с конфигурацией
2. Создание файла `postcss.config.js` с плагинами tailwindcss и autoprefixer
3. Создание файла `src/index.css` с директивами `@tailwind base/components/utilities`
4. Добавление `import './index.css'` в начало `src/main.jsx`

После этого PostCSS → Tailwind pipeline будет активирован и классы скомпилируются в CSS.

## Файлы для отслеживания

- `lib/sandbox/providers/local-provider.ts` — основной файл для исправления
- `app/api/create-ai-sandbox/route.ts` — эталонная реализация для Vercel (можно скопировать логику)
- `app/api/generate-ai-code-stream/route.ts` — актуальные ограничения LLM для config-файлов

---

**Статус диагностики:** ✅ ЗАВЕРШЕНО — корневая причина определена точно.
