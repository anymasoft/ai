# 🔧 ПРАКТИЧЕСКИЙ ПАТЧ: TOOLTIP ДЛЯ DESCRIPTION MCP СЕРВЕРОВ

**Файл для изменения:** `/client/src/components/MCP/MCPServerMenuItem.tsx`

---

## 📋 ТЕКУЩИЙ КОД (ДО ПАТЧА)

```typescript
// Строки 1-14
import * as Ariakit from '@ariakit/react';
import { Check } from 'lucide-react';
import { MCPIcon } from '@librechat/client';
import type { MCPServerDefinition } from '~/hooks/MCP/useMCPServerManager';
import type { MCPServerStatusIconProps } from './MCPServerStatusIcon';
import MCPServerStatusIcon from './MCPServerStatusIcon';
import {
  getStatusColor,
  getStatusTextKey,
  shouldShowActionButton,
  type ConnectionStatusMap,
} from './mcpServerUtils';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';
```

---

## ✅ ОБНОВЛЕННЫЙ КОД (ПОСЛЕ ПАТЧА)

### Шаг 1: Добавить импорт (строка 3)

```typescript
// Строки 1-14 (ОБНОВЛЕНО)
import * as Ariakit from '@ariakit/react';
import { Check } from 'lucide-react';
import { MCPIcon, TooltipAnchor } from '@librechat/client';  // ← ДОБАВЛЕНО: TooltipAnchor
import type { MCPServerDefinition } from '~/hooks/MCP/useMCPServerManager';
import type { MCPServerStatusIconProps } from './MCPServerStatusIcon';
import MCPServerStatusIcon from './MCPServerStatusIcon';
import {
  getStatusColor,
  getStatusTextKey,
  shouldShowActionButton,
  type ConnectionStatusMap,
} from './mcpServerUtils';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';
```

### Шаг 2: Обновить рендеринг (строки 82-90)

**БЫЛО:**
```typescript
// Строки 82-90
{/* Server Info */}
<div className="min-w-0 flex-1">
  <div className="flex items-center gap-1.5">
    <span className="truncate text-sm font-medium text-text-primary">{displayName}</span>
  </div>
  {server.config?.description && (
    <p className="truncate text-xs text-text-secondary">{server.config.description}</p>
  )}
</div>
```

**СТАЛО:**
```typescript
// Строки 82-97 (ОБНОВЛЕНО)
{/* Server Info */}
<div className="min-w-0 flex-1">
  <div className="flex items-center gap-1.5">
    <span className="truncate text-sm font-medium text-text-primary">{displayName}</span>
  </div>
  {server.config?.description && (
    <TooltipAnchor
      description={server.config.description}
      side="right"
      className="block min-w-0 flex-1"
    >
      <p className="truncate text-xs text-text-secondary">
        {server.config.description}
      </p>
    </TooltipAnchor>
  )}
</div>
```

---

## 📝 ПОЛНЫЙ ОБНОВЛЕННЫЙ ФАЙЛ (КЛЮЧЕВЫЕ СЕКЦИИ)

```typescript
import * as Ariakit from '@ariakit/react';
import { Check } from 'lucide-react';
import { MCPIcon, TooltipAnchor } from '@librechat/client';  // ← ОБНОВЛЕНО
import type { MCPServerDefinition } from '~/hooks/MCP/useMCPServerManager';
import type { MCPServerStatusIconProps } from './MCPServerStatusIcon';
import MCPServerStatusIcon from './MCPServerStatusIcon';
import {
  getStatusColor,
  getStatusTextKey,
  shouldShowActionButton,
  type ConnectionStatusMap,
} from './mcpServerUtils';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

interface MCPServerMenuItemProps {
  server: MCPServerDefinition;
  isSelected: boolean;
  connectionStatus?: ConnectionStatusMap;
  isInitializing?: (serverName: string) => boolean;
  statusIconProps?: MCPServerStatusIconProps | null;
  onToggle: (serverName: string) => void;
}

export default function MCPServerMenuItem({
  server,
  isSelected,
  connectionStatus,
  isInitializing,
  statusIconProps,
  onToggle,
}: MCPServerMenuItemProps) {
  const localize = useLocalize();
  const displayName = server.config?.title || server.serverName;
  const statusColor = getStatusColor(server.serverName, connectionStatus, isInitializing);
  const statusTextKey = getStatusTextKey(server.serverName, connectionStatus, isInitializing);
  const statusText = localize(statusTextKey as Parameters<typeof localize>[0]);
  const showActionButton = shouldShowActionButton(statusIconProps);

  // Include status in aria-label so screen readers announce it
  const accessibleLabel = `${displayName}, ${statusText}`;

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
        'outline-none transition-all duration-150',
        'hover:bg-surface-hover data-[active-item]:bg-surface-hover',
        isSelected && 'bg-surface-active-alt',
      )}
    >
      {/* Server Icon with Status Dot */}
      <div className="relative flex-shrink-0">
        {server.config?.iconPath ? (
          <img
            src={server.config.iconPath}
            className="h-8 w-8 rounded-lg object-cover"
            alt={displayName}
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-tertiary">
            <MCPIcon className="h-5 w-5 text-text-secondary" />
          </div>
        )}
        {/* Status dot - decorative, status is announced via aria-label on MenuItem */}
        <div
          aria-hidden="true"
          className={cn(
            'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface-secondary',
            statusColor,
          )}
        />
      </div>

      {/* Server Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-text-primary">{displayName}</span>
        </div>
        {server.config?.description && (
          <TooltipAnchor
            description={server.config.description}
            side="right"
            className="block min-w-0 flex-1"
          >
            <p className="truncate text-xs text-text-secondary">
              {server.config.description}
            </p>
          </TooltipAnchor>
        )}
      </div>

      {/* Action Button - only show when actionable */}
      {showActionButton && statusIconProps && (
        <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <MCPServerStatusIcon {...statusIconProps} />
        </div>
      )}

      {/* Selection Indicator - purely visual, state conveyed by aria-checked on MenuItem */}
      <span
        aria-hidden="true"
        className={cn(
          'flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-sm border',
          isSelected
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-border-xheavy bg-transparent',
        )}
      >
        {isSelected && <Check className="h-4 w-4" />}
      </span>
    </Ariakit.MenuItemCheckbox>
  );
}
```

---

## 🧪 ТЕСТИРОВАНИЕ ПАТЧА

### Локальная проверка:

```bash
# 1. Убедиться что изменения внесены
git diff client/src/components/MCP/MCPServerMenuItem.tsx

# 2. Запустить frontend dev сервер
npm run frontend:dev

# 3. Перейти в интерфейс чата
# Открыть http://localhost:3090

# 4. Проверить:
# - Нажать на меню MCP серверов (иконка инструментов)
# - Навести курсор на название сервера или описание
# - Должно появиться всплывающее окно с полным текстом

# 5. Проверить TypeScript
npm run lint --fix

# 6. Запустить тесты (если есть)
npm run test:client
```

---

## 📊 РАЗЛИЧИЯ (DIFF)

```diff
--- a/client/src/components/MCP/MCPServerMenuItem.tsx
+++ b/client/src/components/MCP/MCPServerMenuItem.tsx
@@ -1,6 +1,6 @@
 import * as Ariakit from '@ariakit/react';
 import { Check } from 'lucide-react';
-import { MCPIcon } from '@librechat/client';
+import { MCPIcon, TooltipAnchor } from '@librechat/client';
 import type { MCPServerDefinition } from '~/hooks/MCP/useMCPServerManager';
 import type { MCPServerStatusIconProps } from './MCPServerStatusIcon';
 import MCPServerStatusIcon from './MCPServerStatusIcon';
@@ -85,7 +85,13 @@ export default function MCPServerMenuItem({
           <span className="truncate text-sm font-medium text-text-primary">{displayName}</span>
         </div>
         {server.config?.description && (
-          <p className="truncate text-xs text-text-secondary">{server.config.description}</p>
+          <TooltipAnchor
+            description={server.config.description}
+            side="right"
+            className="block min-w-0 flex-1"
+          >
+            <p className="truncate text-xs text-text-secondary">{server.config.description}</p>
+          </TooltipAnchor>
         )}
       </div>
```

---

## 🎯 ПАРАМЕТРЫ TOOLTIPANCHOR

| Параметр | Значение | Описание |
|----------|----------|----------|
| `description` | `server.config.description` | Текст tooltip |
| `side` | `"right"` | Tooltip появляется справа (не перекрывает иконку) |
| `className` | `"block min-w-0 flex-1"` | Занимает всю доступную ширину (flex: 1) |

---

## ✨ РЕЗУЛЬТАТ

### Поведение ДО:
```
Пользователь видит только: "Поиск в веб через Jina, интегр..."
Полный текст скрыт.
```

### Поведение ПОСЛЕ:
```
Пользователь видит: "Поиск в веб через Jina, интегр..."

При наведении курсора на текст:
┌──────────────────────────────────────────┐
│  Поиск в веб через Jina, интеграция     │
│  с различными поисковыми движками для   │
│  получения актуальной информации        │
└──────────────────────────────────────────┘
```

---

## ✅ ЧЕКЛИСТ ПЕРЕД КОММИТОМ

- [ ] Импорт `TooltipAnchor` добавлен в строку 3
- [ ] `<TooltipAnchor>` обертка добавлена вокруг description
- [ ] `side="right"` установлен для правильного позиционирования
- [ ] `className="block min-w-0 flex-1"` добавлен для правильного лейаута
- [ ] Файл сохранен
- [ ] ESLint ошибок нет: `npm run lint`
- [ ] TypeScript ошибок нет: `npm run build`
- [ ] Frontend dev сервер запущен: `npm run frontend:dev`
- [ ] Tooltip работает при hover
- [ ] Tooltip показывает полный текст
- [ ] Разные длины описаний работают корректно

---

## 📝 COMMIT MESSAGE

```
feat(mcp): add tooltip for server descriptions in MCPServerMenuItem

- Wrap server.config.description in TooltipAnchor component
- Display full description text on hover
- Improves UX for long server descriptions that were previously truncated
- No backend changes, UI improvement only

Related to MCP server UI enhancements
```

---

## 🚀 READY TO APPLY!

Этот патч готов к применению. Требуется:
- 1 импорт (TooltipAnchor)
- 1 обертка компонента (4 строки кода)

**Сложность:** ⭐ Минимальная
**Риск:** ⭐ Очень низкий (только UI, нет логики)
**Время:** 5 минут
