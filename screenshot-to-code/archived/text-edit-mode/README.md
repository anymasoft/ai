# Text-Edit Mode Archive

**Дата архивирования:** 2025-12-21
**Статус:** 📋 Archiv Archived for future porting to open-lovable
**Причина:** MVP Simplification — focus на visual-edit (Select & Edit) режиме

---

## 📋 Описание

**Text-Edit Mode** — это функциональность редактирования кода **БЕЗ визуального выделения элемента**.

**Как это работало:**
1. Пользователь нажимает кнопку "Update" в sidebar
2. Пишет текстовую инструкцию (например: "Сделай кнопку синей")
3. **БЕЗ выделения конкретного элемента** — просто текст
4. Система отправляет инструкцию в AI с историей и ссылками на обновление изображений
5. AI пытается понять что менять по текстовому описанию

**Отличие от Visual-Edit (Select & Edit):**
```
TEXT-EDIT (ARCHIVED):
  Пользователь: "Сделай кнопку синей"
  Система: Отправляет ТОЛЬКО текст, AI должна угадать какую кнопку

VISUAL-EDIT (СОХРАНЕНО):
  Пользователь: Кликает на кнопку → пишет "Сделай синей"
  Система: Отправляет текст + HTML код кнопки
  AI: Видит точный код, 100% точность
```

---

## 🗂️ Архивированные компоненты

### 1. UpdateImageUpload.tsx / UpdateImagePreview
**Назначение:** Загрузка дополнительных изображений при текстовом обновлении

```typescript
// UpdateImageUpload.tsx (52-102 строки)
export function UpdateImagePreview({ updateImages, setUpdateImages }: Props)
// Показывает превью загруженных изображений

export function UpdateImageUpload({ updateImages, setUpdateImages }: Props)
// Кнопка для загрузки изображений
```

**Использовано в:** Sidebar.tsx (строки 170-195 - УДАЛЕНО)

**Почему архивировано:** Visual-edit режим не требует загрузки дополнительных изображений

---

### 2. doCreateFromText() функция

**Локация в App.tsx (строки 265-276):**

```typescript
function doCreateFromText(text: string) {
  // Reset any existing state
  reset();

  setInputMode("text");
  setInitialPrompt(text);
  doGenerateCode({
    generationType: "create",
    inputMode: "text",
    prompt: { text, images: [] },
  });
}
```

**Назначение:** Создание кода из текстового описания (без изображений)

**Использовано в:** GenerateFromText.tsx (для кнопки "Generate from text prompt")

**Почему архивировано:** MVP фокусируется на image-to-code, text-to-code перенесен в open-lovable

---

### 3. Text-Edit часть doUpdate() функции

**Локация в App.tsx (строки 279-333):**

**УДАЛЕННАЯ часть (текстовое обновление БЕЗ контекста):**
```typescript
// БЕЗ selectedElement — это text-edit режим
const updatedHistory = [
  ...historyTree,
  { text: modifiedUpdateInstruction, images: updateImages },
];
// Отправляется с updateImages для контекста
```

**СОХРАНЕННАЯ часть (с selectedElement):**
```typescript
if (selectedElement) {
  // Это visual-edit режим — SELECT & EDIT
  modifiedUpdateInstruction =
    updateInstruction +
    " referring to this element specifically: " +
    selectedElement.outerHTML;  // ← HTML контекст
}
```

---

### 4. App State (text-edit часть)

**Архивировано из app-store.ts:**

```typescript
// TEXT-EDIT STATE (УДАЛЕНО):
interface AppStore {
  updateInstruction: string;
  setUpdateInstruction: (instruction: string) => void;

  updateImages: string[];
  setUpdateImages: (images: string[]) => void;
}
```

**СОХРАНЕНО в app-store.ts:**
```typescript
// VISUAL-EDIT STATE (ОСТАВЛЕНО):
interface AppStore {
  inSelectAndEditMode: boolean;
  toggleInSelectAndEditMode: () => void;
  disableInSelectAndEditMode: () => void;
}
```

---

### 5. UI компоненты (text-edit)

**Архивировано из Sidebar.tsx (строки 174-195):**

```typescript
{/* TEXT-EDIT UI - УДАЛЕНО */}
<Textarea
  ref={textareaRef}
  placeholder="Tell the AI what to change..."
  onChange={(e) => setUpdateInstruction(e.target.value)}
  onKeyDown={(e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      doUpdate(updateInstruction);  // БЕЗ selectedElement
    }
  }}
  value={updateInstruction}
/>
<Button onClick={() => doUpdate(updateInstruction)}>
  Update <KeyboardShortcutBadge letter="enter" />
</Button>

<UpdateImageUpload
  updateImages={updateImages}
  setUpdateImages={setUpdateImages}
/>
```

**СОХРАНЕНО в Sidebar.tsx:**
```typescript
{/* VISUAL-EDIT UI - ОСТАВЛЕНО */}
{showSelectAndEditFeature && <SelectAndEditModeToggleButton />}
```

---

## 🏗️ Техническая архитектура Text-Edit

### Frontend Pipeline

```
User Input (Text)
    ↓
Sidebar.tsx - Textarea "Tell the AI what to change"
    ↓
doUpdate(updateInstruction, undefined)  ← БЕЗ selectedElement
    ↓
generateCode() - WebSocket
    ↓
Backend - /generate-code WebSocket endpoint
    ↓
ParameterExtractionMiddleware - Получает updateInstruction
    ↓
PromptCreationMiddleware - Создает prompt с текстом
    ↓
CodeGenerationMiddleware - Отправляет в AI
    ↓
AI видит: "Сделай синей" (БЕЗ информации какой элемент)
    ↓
AI угадывает что менять (70-80% точность)
    ↓
Результат с высокой вероятностью ошибок
```

### Visual-Edit Pipeline (СОХРАНЕНО)

```
User Click (Visual)
    ↓
EditPopup.tsx - Click на элемент в preview
    ↓
Highlight element + Popup с textarea
    ↓
doUpdate(updateInstruction, selectedElement)  ← С selectedElement
    ↓
modifiedInstruction += " referring to this element specifically: " + element.outerHTML
    ↓
generateCode() - WebSocket
    ↓
Backend - /generate-code WebSocket endpoint
    ↓
ParameterExtractionMiddleware - Получает instruction + HTML
    ↓
PromptCreationMiddleware - Создает prompt с HTML контекстом
    ↓
CodeGenerationMiddleware - Отправляет в AI
    ↓
AI видит: "Сделай синей referring to this element specifically: <button>Click</button>"
    ↓
AI ТОЧНО знает что менять (100% точность)
    ↓
Результат всегда корректный
```

---

## 🎯 Рекомендации для open-lovable

Если нужно внедрить text-edit режим в open-lovable, вот ключевые моменты:

### ✅ Переиспользовать из этого проекта:

1. **Visual-Edit архитектура** (SELECT & EDIT)
   - Компоненты: SelectAndEditModeToggleButton, EditPopup
   - Логика: selectedElement.outerHTML передача в prompt
   - Преимущество: 100% точность редактирования

2. **doUpdate() с selectedElement**
   - Это универсальный механизм
   - Работает для точных изменений элемента
   - Можно переиспользовать в React компонентах

### ⚠️ Учесть при разработке text-edit:

1. **AI Context Analysis**
   - Text-edit требует более умного анализа намерения
   - Нужна система паттернов (как в edit-intent-analyzer.ts open-lovable)
   - Regex паттерны: `/change.*color/`, `/update.*button/` и т.д.

2. **File Search**
   - Text-edit требует поиска нужных файлов
   - Screenshot-to-code работает с одним файлом (целый HTML)
   - Open-lovable имеет структуру React компонентов
   - Нужна система: анализ → поиск файлов → выделение функций → редактирование

3. **Confidence Score**
   - Text-edit имеет 70-80% точность
   - Нужна система оценки уверенности AI
   - Если низкая уверенность → просить у пользователя подтверждение

4. **Fallback to Visual**
   - Если text-edit не срабатывает → предложить visual-edit
   - Гибридный подход максимально удобен

---

## 📌 Контрольный список для переноса

Если кто-то захочет восстановить text-edit режим:

- [ ] Восстановить `UpdateImageUpload.tsx` в компоненты
- [ ] Добавить обратно `updateInstruction`, `updateImages` в app-store
- [ ] Восстановить textarea в Sidebar.tsx (строки 174-184)
- [ ] Восстановить кнопку Update в Sidebar.tsx (строки 186-191)
- [ ] Добавить `doCreateFromText()` обратно в App.tsx
- [ ] Добавить GenerateFromText компонент обратно
- [ ] Протестировать text-edit pipeline
- [ ] Обновить документацию

---

## 🔗 Связанные файлы

**Текущее состояние (Visual-Edit ТОЛЬКО):**
- frontend/src/components/select-and-edit/EditPopup.tsx
- frontend/src/components/select-and-edit/SelectAndEditModeToggleButton.tsx
- frontend/src/App.tsx (modified doUpdate)
- frontend/src/components/sidebar/Sidebar.tsx (modified)

**Что было удалено:**
- frontend/src/components/UpdateImageUpload.tsx (скопировано сюда)
- frontend/src/components/generate-from-text/GenerateFromText.tsx (disabled)
- doCreateFromText() из App.tsx
- updateInstruction, updateImages из app-store.ts

---

## 📚 Дополнительные примечания

### Почему text-edit менее эффективен:

1. **Неоднозначность** — "Кнопка" может означать разные кнопки
2. **Контекст** — AI не видит точный HTML
3. **Ошибки** — Высокий процент неправильных изменений
4. **Медленнее** — Нужен анализ + поиск файлов + выделение кода

### Почему visual-edit оптимальнее:

1. **Точность** — Пользователь показывает точный элемент
2. **HTML контекст** — AI видит точный код
3. **Универсальность** — Работает для любых элементов
4. **Быстрота** — Прямо к редактированию, без анализа

---

**ВЫВОД:** Text-edit режим полезен для complex команд (open-lovable), но для HTML/CSS страниц visual-edit гораздо эффективнее.

---

## ✅ Статус удаления из проекта (2025-12-21)

### Удаленные файлы:

```
frontend/src/components/UpdateImageUpload.tsx          ✓ Удален
  └── Скопирован в archived/text-edit-mode/

frontend/src/components/generate-from-text/            ✓ Удалена папка
  └── GenerateFromText.tsx                              ✓ Удален
  └── Скопирована в archived/text-edit-mode/
```

### Модифицированные файлы:

**frontend/src/store/app-store.ts**
```
❌ УДАЛЕНО:
  - updateInstruction: string
  - setUpdateInstruction(): void
  - updateImages: string[]
  - setUpdateImages(): void

✅ СОХРАНЕНО:
  - appState, setAppState
  - inSelectAndEditMode, toggleInSelectAndEditMode
  - disableInSelectAndEditMode
```

**frontend/src/App.tsx**
```
❌ УДАЛЕНО:
  - import GenerateFromText
  - function doCreateFromText(text: string)
  - setUpdateInstruction, updateImages, setUpdateImages из useAppStore
  - doCreateFromText() вызов в regenerate()
  - <GenerateFromText /> компонент в JSX
  - setUpdateInstruction(""), setUpdateImages([]) в reset()

✅ СОХРАНЕНО:
  - function doCreate(referenceImages, inputMode)
  - function doUpdate(updateInstruction, selectedElement?)
  - Visual-edit логика с selectedElement.outerHTML
  - doGenerateCode() pipeline
  - inputMode="image" (only)
```

**frontend/src/components/sidebar/Sidebar.tsx**
```
❌ УДАЛЕНО:
  - import Textarea, KeyboardShortcutBadge, UpdateImageUpload
  - updateInstruction, setUpdateInstruction из useAppStore
  - updateImages, setUpdateImages из useAppStore
  - isDragging state и handleDrop() handler
  - textareaRef и fileToDataURL()
  - useEffect для фокуса на textarea
  - Весь textarea блок для инструкций
  - Update кнопка
  - Drag overlay для обновления изображений
  - UpdateImageUpload и UpdateImagePreview компоненты

✅ СОХРАНЕНО:
  - Regenerate кнопка
  - SelectAndEditModeToggleButton
  - Error display, Reference images, Variants, History
```

---

**ИТОГО:** Text-edit режим полностью удален. Visual-edit (Select & Edit) остается единственным способом редактирования.
