# 🔍 АУДИТ UI ОТОБРАЖЕНИЯ DESCRIPTION MCP СЕРВЕРОВ

**Дата:** 13 марта 2026
**Версия:** v0.8.3-rc1
**Статус:** ✅ Аудит завершен — готово к доработке

---

## 📋 ШАГ 1: ХРАНЕНИЕ ПОЛЯ DESCRIPTION

### Где хранится description MCP сервера:

#### Backend (типы данных)
- **Файл:** `/packages/data-provider/src/mcp.ts`
- **Строка:** 12 в `BaseOptionsSchema`

```typescript
// Схема Zod для MCP Server configuration
const BaseOptionsSchema = z.object({
  title: z.string().regex(/^[a-zA-Z0-9 ]+$/, '...').optional(),
  description: z.string().optional(), // ← ЗДЕСЬ
  startup: z.boolean().optional(),
  // ... другие поля
});
```

#### Интерфейсы API
- **Файл:** `/packages/data-provider/src/types/mcpServers.ts`
- **Тип:** `MCPServerUserInput` включает `description` через расширение `BaseOptionsSchema`

#### Модель БД
- **Файл:** `/packages/data-schemas/src/models/mcpServer.ts`
- **Тип:** `MCPServerDocument` наследует `MCPServerDB` с полем `description`

### Структура данных:

```typescript
// Интерфейс API
interface MCPServerDB {
  serverName: string;
  config: MCPOptions;  // ← содержит description
  author?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

// В config.description хранится текст описания
// Пример: "Поиск в веб через Jina"
```

---

## 📊 ШАГ 2: КОМПОНЕНТЫ ОТОБРАЖЕНИЯ СПИСКА MCP

### Основные места рендеринга:

#### 1. **MCPSelect** (Меню выбора инструментов в чате)
- **Файл:** `/client/src/components/Chat/Input/MCPSelect.tsx`
- **Назначение:** Выбор MCP серверов в интерфейсе чата
- **Порты:** 3090 (dev), 3080 (prod)

```tsx
// Строки 103-128: Меню с MCP серверами
<Ariakit.Menu>
  {selectableServers.map((server) => (
    <MCPServerMenuItem
      server={server}
      isSelected={mcpValues?.includes(server.serverName) ?? false}
      // ...
    />
  ))}
</Ariakit.Menu>
```

#### 2. **MCPServerMenuItem** ⭐ ОСНОВНОЙ КОМПОНЕНТ
- **Файл:** `/client/src/components/MCP/MCPServerMenuItem.tsx`
- **Назначение:** Отдельный пункт в меню выбора MCP
- **Где используется:** MCPSelect, другие диалоги

```tsx
// Строки 83-90: РЕНДЕРИНГ DESCRIPTION
<div className="min-w-0 flex-1">
  <div className="flex items-center gap-1.5">
    <span className="truncate text-sm font-medium text-text-primary">
      {displayName}
    </span>
  </div>
  {server.config?.description && (
    <p className="truncate text-xs text-text-secondary">
      {server.config.description}  // ← ЗДЕСЬ!
    </p>
  )}
</div>
```

#### 3. **MCPToolSelectDialog** (Диалог добавления инструментов в агенты)
- **Файл:** `/client/src/components/Tools/MCPToolSelectDialog.tsx`
- **Назначение:** Выбор MCP серверов при создании агентов
- **Использует:** MCPToolItem для рендеринга

---

## 🎨 ШАГ 3: КАК СЕЙЧАС ОТОБРАЖАЕТСЯ DESCRIPTION

### Текущая реализация в MCPServerMenuItem.tsx:

```tsx
// Строка 88: <p className="truncate text-xs text-text-secondary">
{server.config.description}
</p>
```

### Проблемы:
1. ❌ **CSS класс `truncate`** — обрезает текст на одной строке (text-overflow: ellipsis)
2. ❌ **Длинное описание теряется** — видна только урезанная версия
3. ❌ **Нет всплывающего текста** — пользователь не может увидеть полное описание

### Пример (текущее состояние):
```
🔍 Exa
Поиск в веб через Jina, интегр...

🔦 Firecrawl
Скрейпинг контента и извлечен...
```

Полные описания не видны!

---

## 🎯 ШАГ 4: ПРОВЕРКА TOOLTIP КОМПОНЕНТА

### ✅ Компонент найден!

#### TooltipAnchor (рекомендуется)
- **Файл:** `/packages/client/src/components/Tooltip.tsx`
- **Статус:** Экспортируется в `/packages/client/src/components/index.ts` (строка 28)
- **Используется:** Повсеместно в проекте (MCPCardActions, PromptVersions и т.д.)

```typescript
interface TooltipAnchorProps extends Ariakit.TooltipAnchorProps {
  role?: string;
  className?: string;
  description: string;        // ← Это то что нам нужно!
  enableHTML?: boolean;
  side?: 'top' | 'bottom' | 'left' | 'right';
}
```

#### Альтернатива: HoverCard
- **Файл:** `/packages/client/src/components/HoverCard.tsx`
- **На основе:** Radix UI
- **Минус:** Более "тяжелая" для простого текста

### Выбор: **TooltipAnchor** — идеально подходит!

---

## 💡 ШАГ 5: МИНИМАЛЬНЫЙ ПАТЧ

### Текущий код (MCPServerMenuItem.tsx, строки 43-90):

```tsx
return (
  <Ariakit.MenuItemCheckbox
    hideOnClick={false}
    name="mcp-servers"
    value={server.serverName}
    checked={isSelected}
    setValueOnChange={false}
    onChange={() => onToggle(server.serverName)}
    aria-label={accessibleLabel}
    className={cn(
      'group flex w-full cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2',
      // ...
    )}
  >
    {/* Иконка */}
    {/* Информация о сервере */}
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-1.5">
        <span className="truncate text-sm font-medium text-text-primary">
          {displayName}
        </span>
      </div>
      {server.config?.description && (
        <p className="truncate text-xs text-text-secondary">
          {server.config.description}
        </p>
      )}
    </div>
    {/* ... */}
  </Ariakit.MenuItemCheckbox>
);
```

### 📝 ПРЕДЛОЖЕННЫЙ ПАТЧ:

#### Импорт
Добавить в строку 3 (import section):
```tsx
import { TooltipAnchor } from '@librechat/client';
```

#### Замена кода (строки 87-89):

**ДО:**
```tsx
{server.config?.description && (
  <p className="truncate text-xs text-text-secondary">{server.config.description}</p>
)}
```

**ПОСЛЕ:**
```tsx
{server.config?.description && (
  <TooltipAnchor
    description={server.config.description}
    side="right"
    className="min-w-0 flex-1"
  >
    <p className="truncate text-xs text-text-secondary">
      {server.config.description}
    </p>
  </TooltipAnchor>
)}
```

---

## 🔄 ШАГ 6: ПРОВЕРОЧНЫЙ СПИСОК

### ✅ Не менять:
- ✓ Backend логика
- ✓ Структура MCP сервера
- ✓ Сохранение description в БД
- ✓ Тип данных MCPServerDB
- ✓ Валидация Zod схемы

### ✅ Изменения только:
- ✓ UI компонент MCPServerMenuItem.tsx
- ✓ Добавить TooltipAnchor обертку
- ✓ Показывать полный текст при hover

---

## 📂 ФАЙЛЫ ДЛЯ ИЗМЕНЕНИЯ

| Файл | Строки | Действие |
|------|--------|----------|
| `/client/src/components/MCP/MCPServerMenuItem.tsx` | 3 (import) | Добавить `TooltipAnchor` |
| `/client/src/components/MCP/MCPServerMenuItem.tsx` | 87-89 | Обернуть description в TooltipAnchor |

---

## 🎯 ДОПОЛНИТЕЛЬНЫЕ ПАРАМЕТРЫ TOOLTIP (опционально)

```typescript
// Параметры TooltipAnchor
interface TooltipAnchorProps {
  description: string;          // Текст tooltip
  side?: 'top' | 'bottom' | 'left' | 'right';  // Сторона появления
  className?: string;           // CSS классы
  role?: string;               // ARIA роль (default: 'button')
  enableHTML?: boolean;        // HTML в описании (default: false)
  disabled?: boolean;          // Отключить tooltip
}
```

### Рекомендуемые параметры для description:
```tsx
<TooltipAnchor
  description={server.config.description}
  side="right"  // Справа, чтобы не перекрывать иконку
  className="min-w-0 flex-1"
  disabled={!server.config.description}  // Если описания нет
>
  {/* содержимое */}
</TooltipAnchor>
```

---

## 📸 ПРИМЕРЫ ОТОБРАЖЕНИЯ (ПОСЛЕ ПАТЧА)

### Текущее состояние:
```
┌─────────────────────────────────┐
│ 🔍 Exa                          │
│   Поиск в веб через Jina, интег │
└─────────────────────────────────┘
```

### После патча (с hover):
```
┌─────────────────────────────────────────┐
│ 🔍 Exa                                  │
│   Поиск в веб через Jina, интегр...     │ → Tooltip при hover:
│                                         │   "Поиск в веб через Jina,
│                                         │    интеграция с различными
│                                         │    поисковыми движками"
└─────────────────────────────────────────┘
```

---

## ✅ ИТОГОВЫЕ ВЫВОДЫ

| Пункт | Результат |
|-------|-----------|
| **Поле Description** | ✅ Найдено в `/packages/data-provider/src/mcp.ts` |
| **Frontend компонент** | ✅ `MCPServerMenuItem.tsx` — основной рендеринг |
| **Текущий способ отображения** | ✅ CSS `truncate` + p tag |
| **Наличие Tooltip** | ✅ `TooltipAnchor` готов к использованию |
| **Решение** | ✅ Обернуть в TooltipAnchor (2 строки кода) |
| **Риск изменений** | ✅ Минимальный (только UI, no backend changes) |

---

## 📄 РЕКОМЕНДАЦИЯ

**Статус:** 🟢 Готово к реализации

**Сложность:** Минимальная (простое обертывание компонента)

**Время реализации:** 5-10 минут

**Тестирование:**
- Проверить hover над description
- Проверить разные длины текста
- Проверить responsiveness на мобильных

---

**Документация подготовлена для аудита UI отображения MCP серверов.**
