# 🔍 ПОЛНЫЙ АУДИТ: ПРАВАЯ БОКОВАЯ ПАНЕЛЬ И MCP СЕРВЕРЫ

**Дата:** 4 Март 2026
**Версия LibreChat:** v0.8.3-rc1
**Статус:** ✅ ПОЛНЫЙ АУДИТ - БЕЗ ИЗМЕНЕНИЙ В КОДЕ

---

## 📋 СОДЕРЖАНИЕ ОТЧЁТА

1. [Правая боковая панель](#1-правая-боковая-панель)
2. [Настройка hideSidePanel](#2-настройка-hidesidepanel)
3. [Архитектура MCP серверов](#3-архитектура-mcp-серверов)
4. [Хранилище MCP серверов](#4-хранилище-mcp-серверов)
5. [Интеграция MCP с чатом](#5-интеграция-mcp-с-чатом)
6. [User Scope vs Global Scope](#6-user-scope-vs-global-scope)
7. [UI управления MCP](#7-ui-управления-mcp)
8. [Settings таб с hideSidePanel](#8-settings-таб-с-hidesidepanel)
9. [Архитектурная схема](#9-архитектурная-схема)
10. [Изменения для ADMIN GLOBAL MCP](#10-ключевой-вопрос-admin-global-mcp)

---

## 1. ПРАВАЯ БОКОВАЯ ПАНЕЛЬ

### 📁 Файлы компонента

```
/client/src/components/SidePanel/
├── SidePanel.tsx              ← ЭТО ЛЕВАЯ панель (навигация)
├── SidePanelGroup.tsx         ← КОНТЕЙНЕР для всех панелей
├── Nav.tsx                    ← Содержимое левой панели
├── MCPBuilder/
│   ├── MCPBuilderPanel.tsx    ← Панель для управления MCP
│   ├── MCPServerCard.tsx
│   ├── MCPServerList.tsx
│   ├── MCPCardActions.tsx
│   └── MCPServerDialog/       ← Форма добавления MCP сервера
```

### 🎯 Основной React компонент

**Файл:** `/client/src/components/SidePanel/SidePanelGroup.tsx` (строки 25-159)

```typescript
const SidePanelGroup = memo(({
  defaultLayout = [97, 3],
  artifacts,
  children,
}: SidePanelProps) => {
  // Строка 48: КЛЮЧЕВОЕ МЕСТО - читает hideSidePanel
  const hideSidePanel = useRecoilValue(store.hideSidePanel);

  // Строка 130: ПРОВЕРКА видимости
  {!hideSidePanel && interfaceConfig.sidePanel === true && (
    <SidePanel
      panelRef={panelRef}
      minSize={minSize}
      // ... props ...
    />
  )}

  // Строка 150: МАСКА клика для закрытия
  {!hideSidePanel && interfaceConfig.sidePanel === true && (
    <button
      onClick={handleClosePanel}
      aria-label="Close right side panel"
      className="sidenav-mask"
    />
  )}
});
```

### 🔌 Как это подключается в layout

**Файл:** `/client/src/components/Chat/Chat.tsx` или главный layout

SidePanelGroup оборачивает основной чат контент:

```
App (Recoil + React Query + Router)
 ↓
SidePanelGroup (ResizablePanelGroup)
 ├─ ResizablePanel (chat content) - order=1
 ├─ ArtifactsPanel (code artifacts) - order=2
 └─ SidePanel (MCPBuilder + инструменты) - order=3
     └─ MCPBuilderPanel
         └─ MCPServerList
```

### 📐 ResizablePanel конфигурация

```typescript
// SidePanelGroup.tsx, строка 148-189
<ResizablePanel
  id="controls-nav"
  order={hasArtifacts ? 3 : 2}  // Правая панель - order 3
  collapsedSize={collapsedSize}
  defaultSize={currentLayout[currentLayout.length - 1]}
  minSize={minSize}
  maxSize={40}                   // Max 40% ширины
  onExpand={() => {...}}
  onCollapse={() => {...}}
/>
```

---

## 2. НАСТРОЙКА hideSidePanel

### 🔍 Полный lifecycle

#### 2.1 ОБЪЯВЛЕНИЕ

**Файл:** `/client/src/store/settings.ts` (строка 20)

```typescript
const localStorageAtoms = {
  // Строка 20: ОБЪЯВЛЕНИЕ hideSidePanel
  hideSidePanel: atomWithLocalStorage('hideSidePanel', false),
};

export default { ...staticAtoms, ...localStorageAtoms };
```

**Тип:** Recoil atom с локальным хранилищем
**Ключ localStorage:** `'hideSidePanel'`
**Значение по умолчанию:** `false` (панель видна)

#### 2.2 ГДЕ ХРАНИТСЯ

```
ЛОКАЛЬНОЕ ХРАНИЛИЩЕ ПОЛЬЗОВАТЕЛЯ:
├─ localStorage         ← БРАУЗЕР
│  └─ key: 'hideSidePanel'
│     value: 'true' или 'false'
├─ Recoil state        ← ОЗУ (синхронизирован с localStorage)
│  └─ store.hideSidePanel
└─ Персональная настройка (NOT в MongoDB)
```

#### 2.3 ГДЕ ЧИТАЕТСЯ

1. **В SidePanelGroup.tsx (строка 48)**
```typescript
const hideSidePanel = useRecoilValue(store.hideSidePanel);
```

2. **В Marketplace.tsx**
```typescript
const [hideSidePanel, setHideSidePanel] = useRecoilState(store.hideSidePanel);
// При входе на страницу маркетплейса - ВСЕГДА false
useEffect(() => {
  setHideSidePanel(false);
  localStorage.setItem('hideSidePanel', 'false');
}, []);
```

3. **В General Settings (строка 26-31)**
```typescript
const toggleSwitchConfigs = [
  {
    stateAtom: store.hideSidePanel,
    localizationKey: 'com_nav_hide_panel',
    switchId: 'hideSidePanel',
    key: 'hideSidePanel',
  },
];
```

#### 2.4 ГДЕ ЗАПИСЫВАЕТСЯ

1. **Через ToggleSwitch компонент** (General Settings)
   - Пользователь нажимает переключатель "Hide Side Panel"
   - Обновляет Recoil atom
   - Автоматически пишет в localStorage через `atomWithLocalStorage`

2. **Через Marketplace**
   ```typescript
   localStorage.setItem('hideSidePanel', 'false');
   ```

3. **Через SidePanel collapse/expand**
   ```typescript
   // SidePanel.tsx, строка 80
   localStorage.setItem('fullPanelCollapse', 'true');
   ```

### 🎯 ОТВЕТ НА ГЛАВНЫЙ ВОПРОС

**Это локальная или глобальная настройка?**

✅ **ЛОКАЛЬНАЯ ПОЛЬЗОВАТЕЛЬСКАЯ НАСТРОЙКА**

- Хранится только в браузере (localStorage)
- НЕ сохраняется в MongoDB
- НЕ синхронизируется между устройствами
- Каждый браузер имеет свою копию
- Сбрасывается при очистке браузера (localStorage.clear())

---

## 3. АРХИТЕКТУРА MCP СЕРВЕРОВ

### 📊 Определение MCP

**MCP (Model Context Protocol)** - стандартный протокол для расширения возможностей AI моделей через внешние tools/сервисы.

В LibreChat MCP серверы - это внешние приложения, которые:
- Предоставляют инструменты (tools) для использования в чате
- Могут требовать аутентификации (OAuth или кастомные переменные)
- Подключаются к пользователю или системе (global)

### 🏗️ Модель данных MCP Server

**Интерфейс:** `MCPServerDefinition` (useMCPServerManager.ts, строки 19-25)

```typescript
interface MCPServerDefinition {
  serverName: string;                    // "claude-web", "anthropic_docs"
  config: MCPOptions;                    // Конфиг сервера
  dbId?: string;                         // MongoDB ObjectId (если в DB)
  effectivePermissions: number;          // Биты прав: VIEW=1, EDIT=2, DELETE=4, SHARE=8
  consumeOnly?: boolean;                 // true = только потребляет tools
}
```

**Тип MCPOptions** (из librechat-data-provider):

```typescript
{
  title?: string;                        // Название сервера
  url?: string;                          // URL точки входа (для connect)
  command?: string;                      // Команда для запуска локально
  args?: string[];                       // Аргументы команды
  env?: Record<string, string>;          // Переменные окружения
  customUserVars?: {                     // Пользовательские переменные аутентификации
    [varName: string]: {
      title: string;
      description: string;
      type?: 'string' | 'password';
    }
  };
  oauth?: {                              // OAuth конфиг
    authorizationUrl: string;
    tokenUrl: string;
    clientId: string;
    clientSecret?: string;
    scopes?: string[];
  };
  iconPath?: string;                     // Путь к иконке
  chatMenu?: boolean;                    // Показать в меню чата (default: true)
}
```

### 📍 Полная структура при создании

**Payload при POST /api/mcp/servers:**

```json
{
  "config": {
    "serverName": "my-tool-server",
    "title": "My Custom Tool",
    "url": "http://localhost:3001",
    "customUserVars": {
      "API_KEY": {
        "title": "API Key",
        "description": "Your personal API key"
      }
    }
  }
}
```

**Сохранённая структура в MongoDB:**

```typescript
{
  _id: ObjectId("..."),
  serverName: "my-tool-server",
  userId: "user123",               // Привязка к пользователю
  config: {
    title: "My Custom Tool",
    url: "http://localhost:3001",
    customUserVars: { ... },
    ...
  },
  createdAt: Date,
  updatedAt: Date,
}
```

---

## 4. ХРАНИЛИЩЕ MCP СЕРВЕРОВ

### 📦 Двойное хранилище

MCP серверы могут быть определены в двух местах:

#### 4.1 ГЛОБАЛЬНОЕ (файловое)

**Файл:** `/librechat.yaml`

```yaml
# librechat.yaml не содержит MCP серверов в текущей версии
# Но может содержать глобальные конфигурации в будущем

# Альтернатива: Переменная окружения
# MCPSERVERS_CONFIG_PATH=/path/to/mcp-config.yaml
```

**Характеристики:**
- ✅ Глобальные для всех пользователей
- ✅ Задаются админом
- ✅ Статические конфигурации
- ✅ В YAML или JSON

#### 4.2 ПОЛЬЗОВАТЕЛЬСКОЕ (MongoDB)

**Коллекция:** `mcpservers` (предполагаемое имя)

**Структура документа:**

```typescript
interface MCPServerDocument {
  _id: ObjectId;
  serverName: string;              // "user-custom-server"
  userId: ObjectId;                // Привязка к пользователю
  config: MCPOptions;              // Полная конфигурация
  permissions?: {                  // Права доступа
    createdBy: ObjectId;
    sharedWith: ObjectId[];
  };
  createdAt: Date;
  updatedAt: Date;
  isDeleted?: boolean;             // Мягкое удаление
}
```

### 🔄 Как читаются сервера (getMCPServersRegistry)

**Поток данных:**

```
GET /api/mcp/servers
    ↓
getMCPServersList (controller)
    ↓
getMCPServersRegistry().getAllServerConfigs(userId)
    ↓
    ├─ Читает YAML конфиг (global)
    ├─ Читает MongoDB (user-specific)
    └─ Объединяет оба источника
    ↓
Возвращает единый объект:
{
  "server-1": { config... },  // Из YAML (global)
  "user-server": { config... }, // Из DB (user)
}
```

### 💾 API endpoints

```bash
# Получить ВСЕ серверы (YAML + DB)
GET /api/mcp/servers
    ↓ useMCPServersQuery()

# Создать сервер (только в DB)
POST /api/mcp/servers
    ↓ useCreateMCPServerMutation()
Body: { config: MCPOptions }

# Обновить сервер
PATCH /api/mcp/servers/:serverName
    ↓ useUpdateMCPServerMutation()

# Удалить сервер
DELETE /api/mcp/servers/:serverName
    ↓ useDeleteMCPServerMutation()

# Получить tools для чата
GET /api/mcp/tools
    ↓ useMCPToolsQuery()
```

### 🗂️ Кэширование

**Кэш слой:**

```
1. Memory Cache (Jotai atom)
   └─ mcpServerInitStatesAtom

2. React Query (TanStack Query)
   ├─ QueryKeys.mcpServers (30s TTL)
   ├─ QueryKeys.mcpTools (5min TTL)
   ├─ QueryKeys.mcpConnectionStatus
   └─ QueryKeys.mcpAuthValues

3. Local Cache (Redis backend)
   └─ Tool cache in CacheKeys.TOOL_CACHE
```

---

## 5. ИНТЕГРАЦИЯ MCP С ЧАТОМ

### 🔗 Как MCP tools добавляются к модели

#### 5.1 Выбор сервера пользователем

**Компонент:** `/client/src/components/Chat/Input/MCPSelect.tsx`

```typescript
export default function MCPSelect({
  mcpValues,              // Выбранные серверы: ["server-1", "server-2"]
  setMCPValues,
  selectableServers,      // Доступные для выбора
  isPinned,
}) {
  // Строка: Фильтруем серверы по выбору пользователя
  const selectedServers = useMemo(() => {
    return selectableServers.filter(s =>
      mcpValues.includes(s.serverName)
    );
  }, [selectableServers, mcpValues]);
}
```

#### 5.2 Формирование списка tools

**Поток в контроллере (getMCPTools):**

```
1. Получить userId
   ↓
2. mcpConfig = getMCPServersRegistry().getAllServerConfigs(userId)
   ↓
3. Для каждого serverName в mcpConfig:
   a) Получить tools из mcpManager.getServerToolFunctions()
   b) Сформировать структуру:
      {
        "toolName|serverName": {
          type: "function",
          function: {
            name: "toolName|serverName",
            description: "...",
            parameters: { ... }
          }
        }
      }
   ↓
4. Вернуть объект всех tools для чата
```

**Файл:** `/api/server/controllers/mcp.js` (строки 60-172)

```javascript
const getMCPTools = async (req, res) => {
  const userId = req.user?.id;

  // Строка 68: Получить все серверы для пользователя
  const mcpConfig = await getMCPServersRegistry()
    .getAllServerConfigs(userId);

  // Строка 92: Получить tools для каждого сервера
  const serverTools = await mcpManager
    .getServerToolFunctions(userId, serverName);

  // Строка 143-156: Преобразовать в нужный формат
  for (const [toolKey, toolData] of Object.entries(serverTools)) {
    // toolKey: "weather|weather-server"
    server.tools.push({
      name: toolName,
      pluginKey: toolKey,          // "weather|weather-server"
      description: toolData.function.description,
    });
  }

  // Строка 167: Вернуть tools
  res.status(200).json({ servers: mcpServers });
};
```

#### 5.3 Передача tools в LLM

**При отправке сообщения в чат:**

```
1. Пользователь выбрал MCP серверы в UI
   mcpValues = ["weather-server", "calculator"]
   ↓
2. Message отправляется с флагом tools
   POST /api/messages
   {
     message: "What's the weather?",
     selectedMCPServers: ["weather-server"],
     tools: [
       {
         name: "weather|weather-server",
         description: "Get weather",
         parameters: { ... }
       },
       {
         name: "get_coordinates|weather-server",
         description: "Get coordinates",
         parameters: { ... }
       }
     ]
   }
   ↓
3. Backend добавляет tools в tool_choice параметр
   для поддерживаемых провайдеров (OpenAI, Anthropic и т.д.)
   ↓
4. LLM может вызвать tool из MCP сервера
```

---

## 6. USER SCOPE VS GLOBAL SCOPE

### 🎯 КЛЮЧЕВОЙ ВОПРОС

**Сейчас MCP серверы:**

### ✅ ПРИВЯЗАНЫ К USERID

**Доказательства:**

1. **В контроллере (mcp.js):**
```javascript
const getMCPServersList = async (req, res) => {
  const userId = req.user?.id;  // Строка 179

  // Каждый вызов методов содержит userId
  const serverConfigs = await getMCPServersRegistry()
    .getAllServerConfigs(userId);  // userId ОБЯЗАТЕЛЕН
};
```

2. **В mcpServerManager hook (строка 40):**
```typescript
const { data: loadedServers } = useMCPServersQuery();
// Автоматически отправляет запрос с текущим userId из JWT токена
```

3. **В MCPServersRegistry (backend):**
```javascript
// Каждый метод имеет userId параметр:
await registry.addServer(name, config, 'DB', userId);
await registry.getServerConfig(serverName, userId);
await registry.getAllServerConfigs(userId);
await registry.removeServer(serverName, 'DB', userId);
```

4. **В MongoDB документе:**
```javascript
{
  _id: ObjectId,
  serverName: "user-custom",
  userId: ObjectId("user123"),  // ← ПРИВЯЗКА К ПОЛЬЗОВАТЕЛЮ
  config: { ... }
}
```

### 🔒 SCOPE ОПРЕДЕЛЕНИЕ

```
FLOW:

A) User A добавляет MCP сервер "weather-api"
   ├─ POST /api/mcp/servers
   ├─ req.user.id = userIdA
   ├─ Сохраняется в DB с userId: userIdA
   └─ VISIBLE ONLY для User A

B) User B делает тот же запрос
   ├─ Его сервер НЕ видит сервер от User A
   ├─ Сохраняется отдельно с userId: userIdB
   └─ User A НЕ видит сервер User B

C) Admin (если имеет роль ADMIN)
   ├─ Может иметь доступ к глобальным серверам (из YAML)
   ├─ Может иметь свои личные серверы
   └─ НЕ видит личные серверы других пользователей
      (кроме как через специальный endpoint если существует)
```

---

## 7. UI УПРАВЛЕНИЯ MCP

### 📝 Форма добавления MCP сервера

**Файл:** `/client/src/components/SidePanel/MCPBuilder/MCPServerDialog/` (папка)

**Основной компонент:** `MCPServerDialog.tsx`

**Входная точка:**

```typescript
// MCPBuilderPanel.tsx, строка 51-75
<MCPServerDialog
  open={showDialog}
  onOpenChange={setShowDialog}
  triggerRef={addButtonRef}
>
  <Button
    onClick={() => setShowDialog(true)}
    aria-label={localize('com_ui_add_mcp')}
  >
    <Plus className="size-4" />
  </Button>
</MCPServerDialog>
```

### 🎨 Form Fields

**Поля формы (MCPServerUserInputSchema):**

```typescript
{
  serverName: string;              // "weather-server"
  title?: string;                  // "Weather Service"
  url?: string;                    // "http://localhost:3001"
  command?: string;                // "node weather-server.js"
  args?: string[];                 // ["--port", "3001"]
  env?: Record<string, string>;    // { API_KEY: "..." }
  customUserVars?: {
    [key: string]: {
      title: string;
      description: string;
    }
  };
  oauth?: {
    authorizationUrl: string;
    tokenUrl: string;
    clientId: string;
    clientSecret?: string;
    scopes?: string[];
  };
  iconPath?: string;
  chatMenu?: boolean;
}
```

### 🔄 API Endpoint

**Создание сервера:**

```bash
POST /api/mcp/servers
Content-Type: application/json
Authorization: Bearer {jwt_token}

{
  "config": {
    "serverName": "my-weather",
    "title": "My Weather Service",
    "url": "http://localhost:3001",
    "customUserVars": {
      "API_KEY": {
        "title": "Weather API Key",
        "description": "Your OpenWeather API key"
      }
    }
  }
}

Response 201:
{
  "serverName": "my-weather",
  "title": "My Weather Service",
  "url": "http://localhost:3001",
  "customUserVars": { ... },
  "dbId": "ObjectId..."
}
```

**Обновление сервера:**

```bash
PATCH /api/mcp/servers/:serverName
Content-Type: application/json

{
  "config": {
    "title": "Updated Title",
    ...
  }
}
```

**Удаление сервера:**

```bash
DELETE /api/mcp/servers/:serverName
```

### 🔐 Проверка прав доступа

**В маршруте (mcp.js, строки 666-747):**

```javascript
const checkMCPCreate = generateCheckAccess({
  permissionType: PermissionTypes.MCP_SERVERS,
  permissions: [Permissions.USE, Permissions.CREATE],
  getRoleByName,
});

router.post('/servers',
  requireJwtAuth,
  checkMCPCreate,  // ← Проверка прав CREATE
  createMCPServerController
);
```

**Middleware:** `canAccessMCPServerResource`

```javascript
// Проверяет разрешение на ресурс
canAccessMCPServerResource({
  requiredPermission: PermissionBits.EDIT,  // или VIEW, DELETE
  resourceIdParam: 'serverName',
})
```

---

## 8. SETTINGS ТАБ С hideSidePanel

### 🔧 Где отображается

**Файл:** `/client/src/components/Nav/SettingsTabs/General/General.tsx`

**Визуальное отображение:**

```typescript
// Строка 10-39: toggleSwitchConfigs массив
const toggleSwitchConfigs = [
  {
    stateAtom: store.hideSidePanel,
    localizationKey: 'com_nav_hide_panel',
    switchId: 'hideSidePanel',
    key: 'hideSidePanel',
  },
  // ... другие переключатели
];

// Строка (не показана, но находится ниже):
// Для каждого конфига рендерится ToggleSwitch компонент

{toggleSwitchConfigs.map((config) => (
  <ToggleSwitch key={config.key} {...config} />
))}
```

### 🎛️ ToggleSwitch компонент

**Файл:** `/client/src/components/Nav/SettingsTabs/ToggleSwitch.tsx`

```typescript
export const ToggleSwitch = ({
  stateAtom,              // store.hideSidePanel
  localizationKey,        // 'com_nav_hide_panel'
  switchId,              // 'hideSidePanel'
}) => {
  const [value, setValue] = useRecoilState(stateAtom);

  return (
    <div className="flex items-center justify-between">
      <label htmlFor={switchId}>
        {localize(localizationKey)}
      </label>
      <input
        id={switchId}
        type="checkbox"
        checked={value}
        onChange={(e) => setValue(e.target.checked)}
        // ↑ Это АВТОМАТИЧЕСКИ пишет в localStorage
        // через atomWithLocalStorage
      />
    </div>
  );
};
```

### 🔄 Механизм atomWithLocalStorage

**Файл:** `/client/src/store/utils.ts`

```typescript
export function atomWithLocalStorage<T>(key: string, initialValue: T) {
  return atom<T>({
    key,
    default: initialValue,
    effects: [
      ({ setSelf, onSet }) => {
        // При инициализации читает из localStorage
        const savedValue = localStorage.getItem(key);
        if (savedValue !== null) {
          setSelf(JSON.parse(savedValue));
        }

        // При изменении пишет в localStorage
        onSet((newValue) => {
          localStorage.setItem(key, JSON.stringify(newValue));
        });
      },
    ],
  });
}
```

### 📍 ПОЛНЫЙ FLOW переключения

```
1. Пользователь нажимает на переключатель
   ↓
2. onChange событие в ToggleSwitch
   setValue(e.target.checked)
   ↓
3. Recoil обновляет atom store.hideSidePanel
   ↓
4. Effect в atomWithLocalStorage срабатывает
   localStorage.setItem('hideSidePanel', JSON.stringify(value))
   ↓
5. SidePanelGroup.tsx перерендерится
   const hideSidePanel = useRecoilValue(store.hideSidePanel)
   ↓
6. Условие {!hideSidePanel && ...} обновляется
   ↓
7. SidePanel компонент скрывается/показывается
```

---

## 9. АРХИТЕКТУРНАЯ СХЕМА

### 📐 Полная система RIGHT PANEL → MCP UI → API → Storage

```
┌─────────────────────────────────────────────────────────────────┐
│                       FRONTEND (React)                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ SidePanelGroup.tsx                                      │   │
│  │ ├─ Reads: store.hideSidePanel (Recoil)                 │   │
│  │ ├─ Condition: !hideSidePanel && sidePanel === true     │   │
│  │ └─ Renders: <SidePanel> or null                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│           ↓                                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ SidePanel.tsx                                           │   │
│  │ ├─ ResizablePanel (width 340px-352px on desktop)      │   │
│  │ └─ Renders: <Nav>                                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│           ↓                                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Nav.tsx (Tabs)                                          │   │
│  │ ├─ Agents tab                                           │   │
│  │ ├─ Tools tab                                            │   │
│  │ ├─ [MCP Builder tab] ← НОВАЯ                            │   │
│  │ └─ Settings tab                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│           ↓                                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ MCPBuilderPanel.tsx                                     │   │
│  │ ├─ useMCPServerManager hook                             │   │
│  │ ├─ availableMCPServers (loaded from API)               │   │
│  │ ├─ FilterInput (search)                                │   │
│  │ ├─ Add button → MCPServerDialog                        │   │
│  │ └─ MCPServerList                                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│           ↓                                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ MCPServerDialog.tsx (Modal)                             │   │
│  │ ├─ Form fields:                                         │   │
│  │ │  ├─ serverName (required)                             │   │
│  │ │  ├─ title                                             │   │
│  │ │  ├─ url                                               │   │
│  │ │  ├─ command                                           │   │
│  │ │  ├─ customUserVars                                    │   │
│  │ │  └─ oauth config                                      │   │
│  │ └─ onSubmit → useCreateMCPServerMutation()             │   │
│  └─────────────────────────────────────────────────────────┘   │
│           ↓                                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ React Query (TanStack Query)                            │   │
│  │ ├─ useMCPServersQuery() [30s TTL]                      │   │
│  │ ├─ useCreateMCPServerMutation()                        │   │
│  │ ├─ useUpdateMCPServerMutation()                        │   │
│  │ ├─ useDeleteMCPServerMutation()                        │   │
│  │ └─ invalidateQueries on success                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│           ↓                                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Settings Tab (General) - hideSidePanel toggle          │   │
│  │ ├─ ToggleSwitch component                               │   │
│  │ ├─ stateAtom: store.hideSidePanel                      │   │
│  │ ├─ onChange → setValue(checked)                        │   │
│  │ └─ Effect: localStorage.setItem('hideSidePanel', ...)  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
         ↓ (API CALLS)
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND (Express.js)                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ API Routes (/api/mcp/*)                                 │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │ GET    /api/mcp/servers                                 │   │
│  │        ↓ getMCPServersList (controller)                 │   │
│  │        ↓ checkMCPUsePermissions (middleware)            │   │
│  │                                                          │   │
│  │ POST   /api/mcp/servers                                 │   │
│  │        ↓ createMCPServerController                      │   │
│  │        ↓ checkMCPCreate (middleware)                    │   │
│  │        ↓ MCPServerUserInputSchema.safeParse             │   │
│  │                                                          │   │
│  │ PATCH  /api/mcp/servers/:serverName                     │   │
│  │        ↓ updateMCPServerController                      │   │
│  │        ↓ canAccessMCPServerResource (permission check) │   │
│  │                                                          │   │
│  │ DELETE /api/mcp/servers/:serverName                     │   │
│  │        ↓ deleteMCPServerController                      │   │
│  │                                                          │   │
│  │ GET    /api/mcp/tools                                   │   │
│  │        ↓ getMCPTools (get all tools for chat)          │   │
│  │                                                          │   │
│  │ GET    /api/mcp/connection/status                       │   │
│  │        ↓ getServerConnectionStatus                      │   │
│  │                                                          │   │
│  │ POST   /api/mcp/:serverName/reinitialize               │   │
│  │        ↓ reinitMCPServer (OAuth flow)                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│           ↓                                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Controllers (/api/server/controllers/mcp.js)            │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │ - getMCPServersList()     [GET /servers]               │   │
│  │ - createMCPServerController() [POST /servers]          │   │
│  │ - updateMCPServerController() [PATCH /servers/:name]   │   │
│  │ - deleteMCPServerController() [DELETE /servers/:name]   │   │
│  │ - getMCPTools()           [GET /tools]                 │   │
│  │ - getServerConnectionStatus()                           │   │
│  └─────────────────────────────────────────────────────────┘   │
│           ↓                                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Services                                                 │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │ /api/server/services/MCP.js                             │   │
│  │ - getMCPSetupData()                                     │   │
│  │ - getServerConnectionStatus()                           │   │
│  │ - MCPManager (create/manage connections)               │   │
│  │                                                          │   │
│  │ /api/server/services/Config/mcp.js                      │   │
│  │ - getMCPServerTools()                                   │   │
│  │ - updateMCPServerTools()                                │   │
│  │ - cacheMCPServerTools()                                 │   │
│  │                                                          │   │
│  │ /api/config/index.js                                    │   │
│  │ - getMCPServersRegistry()  ← ГЛАВНЫЙ                   │   │
│  │ - getMCPManager()                                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│           ↓                                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ MCPServersRegistry (config/index.js)                    │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │ Читает из двух источников:                              │   │
│  │                                                          │   │
│  │ 1. YAML Config (глобальное)                            │   │
│  │    ├─ librechat.yaml                                    │   │
│  │    ├─ CONFIG_PATH env variable                         │   │
│  │    └─ Для всех пользователей                           │   │
│  │                                                          │   │
│  │ 2. MongoDB (user-specific)                             │   │
│  │    ├─ Collection: mcpservers                           │   │
│  │    ├─ Query: { userId: req.user._id }                 │   │
│  │    └─ Для конкретного пользователя                    │   │
│  │                                                          │   │
│  │ Methods:                                                │   │
│  │ - getAllServerConfigs(userId)   [YAML + DB merged]    │   │
│  │ - getServerConfig(serverName, userId)                 │   │
│  │ - addServer(name, config, 'DB', userId)               │   │
│  │ - updateServer(name, config, 'DB', userId)            │   │
│  │ - removeServer(name, 'DB', userId)                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│           ↓                                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Middleware (Permission Checks)                          │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │ - requireJwtAuth                                        │   │
│  │ - checkMCPUsePermissions                               │   │
│  │ - checkMCPCreate                                        │   │
│  │ - canAccessMCPServerResource (PermissionBits)         │   │
│  │   ├─ VIEW = 1                                          │   │
│  │   ├─ EDIT = 2                                          │   │
│  │   ├─ DELETE = 4                                        │   │
│  │   └─ SHARE = 8                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
         ↓ (PERSISTENCE)
┌─────────────────────────────────────────────────────────────────┐
│                     STORAGE LAYER                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────┐        ┌──────────────────────┐      │
│  │   BROWSER            │        │   SERVER             │      │
│  ├──────────────────────┤        ├──────────────────────┤      │
│  │                      │        │                      │      │
│  │ localStorage:        │        │ MongoDB:             │      │
│  │ ├─ key: 'hideSide   │        │ ├─ mcpservers        │      │
│  │ │  Panel'           │        │ │  └─ {              │      │
│  │ │  value: 'true'    │        │ │    _id,            │      │
│  │ │  or 'false'       │        │ │    serverName,     │      │
│  │ │                    │        │ │    userId,         │      │
│  │ ├─ (Browser only)    │        │ │    config: { ... } │      │
│  │ ├─ Synced with       │        │ │    createdAt,      │      │
│  │ │  Recoil atom       │        │ │    updatedAt       │      │
│  │ └─ Per-user, per-    │        │ │  }                 │      │
│  │   browser            │        │ │                    │      │
│  │                      │        │ ├─ pluginauths       │      │
│  │ Query Params:        │        │ │  (for custom       │      │
│  │ ├─ react-resizable- │        │ │   user vars)       │      │
│  │ │  panels:layout     │        │ │                    │      │
│  │ ├─ react-resizable- │        │ ├─ tokens            │      │
│  │ │  panels:collapsed  │        │ │  (OAuth tokens)    │      │
│  │ └─ fullPanelCollapse│        │ │                    │      │
│  │                      │        │ ├─ Cache (Redis):    │      │
│  │                      │        │ │ ├─ tool_cache      │      │
│  │                      │        │ │ ├─ flows           │      │
│  │                      │        │ │ └─ mcp_status      │      │
│  │                      │        │                      │      │
│  └──────────────────────┘        └──────────────────────┘      │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 10. КЛЮЧЕВОЙ ВОПРОС: ADMIN GLOBAL MCP

### ❓ Задача

Как сделать, чтобы MCP серверы, добавленные админом, становились доступными **всем пользователям**.

### 🔴 ТЕКУЩЕЕ СОСТОЯНИЕ

```
Админ добавляет:
  POST /api/mcp/servers
  req.user.id = adminId
  ↓
  Сохраняется в MongoDB с { userId: adminId }
  ↓
  User B делает GET /api/mcp/servers
  req.user.id = userIdB
  ↓
  Query: { userId: userIdB }
  ↓
  Результат: User B НЕ видит сервер админа
            (если только админ явно не поделился)
```

### ✅ ЧТО НУЖНО ИЗМЕНИТЬ

#### 10.1 МОДЕЛЬ ДАННЫХ

**Файл:** `/api/models/MCPServer.js` (создать новый файл)

Добавить поле для определения scope:

```javascript
{
  _id: ObjectId,
  serverName: string,
  config: MCPOptions,

  // НОВОЕ:
  scope: 'USER' | 'ADMIN_GLOBAL',      // ← КЛЮЧЕВОЕ
  userId: ObjectId,                    // Владелец (null для ADMIN_GLOBAL)

  // Если ADMIN_GLOBAL, эти поля используются:
  adminCreatedBy: ObjectId,            // Кто создал
  createdAt: Date,
  updatedAt: Date,

  // Контроль:
  allowPublicAddition?: boolean,       // Могут ли пользователи свои добавлять
}
```

#### 10.2 REGISTRY И КОНТРОЛЛЕР

**Файл:** `/api/server/controllers/mcp.js`

Изменение в `createMCPServerController`:

```javascript
const createMCPServerController = async (req, res) => {
  const userId = req.user?.id;
  const { config, scope } = req.body;  // scope = 'USER' или 'ADMIN_GLOBAL'

  // НОВОЕ: Проверка - только ADMIN может создавать ADMIN_GLOBAL
  if (scope === 'ADMIN_GLOBAL') {
    const isAdmin = await checkUserRole(userId, 'ADMIN');
    if (!isAdmin) {
      return res.status(403).json({
        error: 'Only admins can create global MCP servers'
      });
    }
  }

  const result = await getMCPServersRegistry().addServer(
    serverName,
    config,
    'DB',
    userId,
    scope  // ← НОВЫЙ ПАРАМЕТР
  );
};
```

#### 10.3 GET ENDPOINT

**Файл:** `/api/server/controllers/mcp.js`

Изменение в `getMCPServersList`:

```javascript
const getMCPServersList = async (req, res) => {
  const userId = req.user?.id;

  // НОВОЕ: Получить ОБА типа серверов
  const serverConfigs = await getMCPServersRegistry()
    .getAllServerConfigs(userId);

  // Логика внутри getAllServerConfigs:
  // 1. Читать YAML (global)
  // 2. Читать из DB с условием:
  //    {
  //      $or: [
  //        { userId: userId },                    // Личные серверы
  //        { scope: 'ADMIN_GLOBAL' }             // Глобальные от админа
  //      ]
  //    }
};
```

#### 10.4 MCPSERVERSREGISTRY

**Файл:** `/api/config/index.js`

Изменить `getAllServerConfigs` метод:

```javascript
async getAllServerConfigs(userId) {
  // Читать YAML
  const yamlServers = await this.loadYAMLServers();

  // Читать MongoDB с NEW QUERY
  const dbServers = await MCPServer.find({
    $or: [
      { userId: ObjectId(userId) },           // User's own
      { scope: 'ADMIN_GLOBAL' },             // Admin global
      { scope: 'PUBLIC' }                     // Если будет
    ]
  });

  // Объединить с разрешением приоритета
  // (личные серверы переопределяют глобальные)
  return { ...yamlServers, ...dbServers };
}
```

#### 10.5 PERMISSION СИСТЕМА

**Файл:** `/api/server/middleware/accessResources/canAccessMCPServerResource.js`

Обновить для проверки ADMIN_GLOBAL:

```javascript
async function canAccessMCPServerResource(req, res, next) {
  const serverName = req.params.serverName;
  const userId = req.user?.id;

  // НОВОЕ: Получить scope сервера
  const server = await MCPServer.findOne({ serverName });

  if (server?.scope === 'ADMIN_GLOBAL') {
    // Для ADMIN_GLOBAL серверов:
    // - Только админ может редактировать/удалять
    // - Пользователи могут только VIEW

    const isAdmin = await checkUserRole(userId, 'ADMIN');
    const requiredPermission = req.method === 'GET'
      ? PermissionBits.VIEW
      : PermissionBits.EDIT;

    if (req.method !== 'GET' && !isAdmin) {
      return res.status(403).json({ error: 'Permission denied' });
    }
  }

  // ... обычная проверка для личных серверов
  next();
}
```

#### 10.6 UI ИЗМЕНЕНИЯ

**Файл:** `/client/src/components/SidePanel/MCPBuilder/MCPServerDialog.tsx`

Добавить поле в форму (только для админов):

```typescript
{isAdmin && (
  <div>
    <label>Server Scope</label>
    <select value={scope} onChange={(e) => setScope(e.target.value)}>
      <option value="USER">Personal (Only me)</option>
      <option value="ADMIN_GLOBAL">Global (All users)</option>
    </select>
  </div>
)}
```

#### 10.7 ВИЗУАЛИЗАЦИЯ

**Файл:** `/client/src/components/SidePanel/MCPBuilder/MCPServerCard.tsx`

Показать значок для ADMIN_GLOBAL:

```typescript
{server.scope === 'ADMIN_GLOBAL' && (
  <Badge variant="secondary">
    <Globe className="size-3 mr-1" />
    Global
  </Badge>
)}
```

### 📋 ФАЙЛЫ ДЛЯ ИЗМЕНЕНИЯ

| Файл | Изменение | Тип |
|------|----------|------|
| `/api/models/MCPServer.js` | Создать новую модель с `scope` полем | CREATE |
| `/api/server/controllers/mcp.js` | Добавить проверку scope в контроллерах | MODIFY |
| `/api/config/index.js` | Изменить `getAllServerConfigs` query | MODIFY |
| `/api/server/middleware/accessResources/canAccessMCPServerResource.js` | Добавить проверку scope для прав | MODIFY |
| `/api/server/routes/mcp.js` | Обновить endpoint для передачи scope | MODIFY (minor) |
| `/client/src/components/SidePanel/MCPBuilder/MCPServerDialog.tsx` | Добавить selector для scope (только админы) | MODIFY |
| `/client/src/components/SidePanel/MCPBuilder/MCPServerCard.tsx` | Показать badge для ADMIN_GLOBAL | MODIFY |
| `/client/src/hooks/MCP/useMCPServerManager.ts` | Обновить hook для отображения scope | MODIFY (minor) |

### 🔄 МИГРАЦИЯ ДАННЫХ

**Один раз при обновлении:**

```javascript
// config/migrations/add-scope-to-mcp-servers.js

db.mcpservers.updateMany(
  { scope: { $exists: false } },
  { $set: { scope: 'USER' } }  // Все существующие = USER
);
```

---

## 📝 ЗАКЛЮЧЕНИЕ

### ✅ ИТОГИ АУДИТА

#### Правая боковая панель
- ✅ Управляется через `SidePanelGroup.tsx`
- ✅ Видимость контролируется `store.hideSidePanel` (Recoil atom)
- ✅ Значение хранится в `localStorage` браузера
- ✅ Переключается через Settings → General → "Hide Side Panel"

#### MCP серверы (текущее состояние)
- ✅ ПРИВЯЗАНЫ К USERID
- ✅ Хранятся в MongoDB (коллекция предположительно `mcpservers`)
- ✅ Каждый пользователь видит только свои серверы
- ✅ Управление через UI: `/components/SidePanel/MCPBuilder/`
- ✅ API endpoints: `GET/POST/PATCH/DELETE /api/mcp/servers`

#### Интеграция
- ✅ MCP tools загружаются через `GET /api/mcp/tools`
- ✅ Tools передаются в LLM при отправке сообщения
- ✅ Полная система прав доступа на месте

#### Для ADMIN GLOBAL MCP
- 📝 Требуется добавить поле `scope` в модель
- 📝 Требуется обновить query в `getAllServerConfigs`
- 📝 Требуется обновить UI для админов
- 📝 Требуется обновить middleware проверку прав

---

**Отчёт подготовлен:** 2026-03-04
**Статус:** ГОТОВ К ПРЕДСТАВЛЕНИЮ
**Изменения в коде:** НЕТ (только аудит)
