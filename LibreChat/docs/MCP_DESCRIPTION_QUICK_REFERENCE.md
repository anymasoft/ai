# ⚡ БЫСТРЫЙ СПРАВОЧНИК: MCP DESCRIPTION TOOLTIP

**Для нетерпеливых разработчиков** 📚

---

## 🎯 TL;DR (Слишком длинно; не читал)

**Задача:** Добавить tooltip для усеченного текста `description` MCP сервера

**Где:** `/client/src/components/MCP/MCPServerMenuItem.tsx`

**Что:** Обернуть `<p>` с description в `<TooltipAnchor>`

**Сложность:** 2/10 (буквально 4 строки кода)

---

## 📍 МЕСТОПОЛОЖЕНИЕ КОМПОНЕНТОВ

```
LibreChat/
├── packages/
│   └── data-provider/src/
│       └── mcp.ts               ← МОДЕЛЬ (description в BaseOptionsSchema, строка 12)
│
├── client/src/
│   ├── components/
│   │   ├── Chat/Input/
│   │   │   └── MCPSelect.tsx    ← МЕНЮ (использует MCPServerMenuItem)
│   │   │
│   │   └── MCP/
│   │       └── MCPServerMenuItem.tsx  ← ЦЕЛЕВОЙ ФАЙЛ!!! ⭐⭐⭐
│   │
│   └── data-provider/           ← РЕАКТИВНЫЕ ЗАПРОСЫ
│
└── Корень проекта
    ├── MCP_SERVER_DESCRIPTION_UI_AUDIT.md
    ├── MCP_SERVER_DESCRIPTION_TOOLTIP_PATCH.md
    └── MCP_DESCRIPTION_QUICK_REFERENCE.md
```

---

## 📊 ДАННЫЕ FLOW

```
Backend (MongoDB)
    ↓
MCPServerDB (with config: MCPOptions)
    ↓
server.config.description  ← Текст из БД
    ↓
MCPServerMenuItem           ← Компонент
    ├─ {displayName}        ← Заголовок (Exa, Jina и т.д.)
    └─ {description}        ← ЗДЕСЬ! (усеченный текст)
```

---

## 🔍 КОД: ДО И ПОСЛЕ

### СЕЙЧАС (СТРОКИ 87-89):
```tsx
{server.config?.description && (
  <p className="truncate text-xs text-text-secondary">{server.config.description}</p>
)}
```

### НАДО (СТРОКИ 87-95):
```tsx
{server.config?.description && (
  <TooltipAnchor
    description={server.config.description}
    side="right"
    className="block min-w-0 flex-1"
  >
    <p className="truncate text-xs text-text-secondary">{server.config.description}</p>
  </TooltipAnchor>
)}
```

### IMPORT (СТРОКА 3):
```diff
- import { MCPIcon } from '@librechat/client';
+ import { MCPIcon, TooltipAnchor } from '@librechat/client';
```

---

## 🖼️ ВИЗУАЛЬНО

```
СЕЙЧАС (Без tooltip):
┌────────────────────────────────┐
│ 🔍 Exa                         │
│    Поиск в веб через Jina, ⟵ ОБРЕЗАНО!
│    интегр...                   │
└────────────────────────────────┘

НАДО (С tooltip):
┌────────────────────────────────┐      ╔═══════════════════════════════╗
│ 🔍 Exa                         │ ───> ║ Поиск в веб через Jina,     ║
│    Поиск в веб через Jina, ☝️ HOVER   ║ интеграция с различными     ║
│    интегр...                   │      ║ поисковыми движками для     ║
└────────────────────────────────┘      ║ получения актуальной        ║
                                       ║ информации                  ║
                                       ╚═══════════════════════════════╝
```

---

## ✅ CHANGES SUMMARY

| Что | Где | Строки | Действие |
|-----|-----|--------|----------|
| Import | MCPServerMenuItem.tsx | 3 | Добавить `TooltipAnchor` |
| Wrapper | MCPServerMenuItem.tsx | 87-95 | Обернуть description в TooltipAnchor |
| **TOTAL** | | | **2 операции, 4 новые строки** |

---

## 🧪 ТЕСТИРОВАНИЕ (30 секунд)

```bash
# 1. Применить патч
# (обновить MCPServerMenuItem.tsx)

# 2. Запустить
npm run frontend:dev

# 3. Открыть http://localhost:3090

# 4. Нажать на иконку инструментов (MCP) в чате

# 5. Навести мышь на любой сервер с описанием

# ✅ Должно появиться всплывающее окно с полным текстом!
```

---

## 📦 DEPENDENCIES

Все нужные зависимости уже установлены:
- ✅ `@librechat/client` — содержит `TooltipAnchor`
- ✅ `@ariakit/react` — основа для tooltip
- ✅ `framer-motion` — анимация
- ✅ `dompurify` — безопасность

**Ничего не нужно устанавливать!**

---

## 🎯 KPI ИЗМЕНЕНИЙ

| Метрика | Значение |
|---------|----------|
| **Файлы изменены** | 1 |
| **Строк добавлено** | ~10 |
| **Строк удалено** | 0 |
| **Зависимостей добавлено** | 0 |
| **Breaking changes** | 0 |
| **Тесты нужны** | Нет (только UI) |

---

## 📚 ФАЙЛЫ ДОКУМЕНТАЦИИ

Три документа созданы для аудита:

1. **MCP_SERVER_DESCRIPTION_UI_AUDIT.md** (детальный)
   - Полный анализ
   - 6 шагов аудита
   - Структура данных
   - Рекомендации

2. **MCP_SERVER_DESCRIPTION_TOOLTIP_PATCH.md** (практический)
   - Готовый к применению патч
   - Diff коды
   - Чеклист
   - Commit message

3. **MCP_DESCRIPTION_QUICK_REFERENCE.md** (этот файл)
   - Краткий обзор
   - Быстрый запуск
   - Визуализация

---

## 🚀 ГОТОВО!

Аудит завершен. Все файлы готовы к просмотру:

```bash
cat MCP_SERVER_DESCRIPTION_UI_AUDIT.md          # Полный отчет
cat MCP_SERVER_DESCRIPTION_TOOLTIP_PATCH.md    # Готовый патч
cat MCP_DESCRIPTION_QUICK_REFERENCE.md         # Этот файл
```

---

## ❓ FAQ

**Q: Нужно ли менять backend?**
A: Нет! Только UI.

**Q: Нужны ли миграции БД?**
A: Нет! Поле description уже существует.

**Q: Сломается ли старый код?**
A: Нет! Это улучшение совместимости.

**Q: Как быстро это реализовать?**
A: 5-10 минут максимум.

**Q: Нужно ли тестирование?**
A: Визуальное, нет unit тестов.

---

**Документация готова к доставке! 🎉**
