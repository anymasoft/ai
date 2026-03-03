# 🔍 ДИАГНОСТИКА СТРУКТУРЫ СЕЛЕКТОРА МОДЕЛЕЙ

**Дата:** 2026-03-03
**Цель:** Выявить из каких данных строится UI селектора и как происходит группировка

---

## ✅ ДОБАВЛЕННЫЕ ЛОГИ

### 1. ModelSelectorContent (ModelSelector.tsx)
**Что:** Логирует все основные данные селектора
**Когда:** При каждом рендере компонента
**Логирует:**
- agentsMap - список агентов
- modelSpecs - все спецификации моделей
- mappedEndpoints - все эндпоинты с информацией
- endpointsConfig - конфигурация эндпоинтов
- searchResults - результаты поиска
- selectedValues - выбранные значения

**Пример лога:**
```javascript
[SELECTOR_STRUCTURE] ModelSelectorContent props: {
  agentsMap: [...],
  modelSpecs: [
    { name: 'gpt-4', label: 'GPT-4', group: 'openAI', preset: {...} },
    { name: 'claude-3', label: 'Claude 3', group: undefined, ... }
  ],
  mappedEndpoints: [
    { value: 'openAI', label: 'OpenAI', hasModels: true, modelsCount: 5 },
    { value: 'agents', label: 'Agents', hasModels: true, modelsCount: 3 }
  ],
  ...
}
```

---

### 2. EndpointItem (components/EndpointItem.tsx)
**Что:** Логирует данные каждого эндпоинта
**Когда:** При рендере каждого EndpointItem
**Логирует:**
- Значение эндпоинта (openAI, anthropic, agents и т.д.)
- Лейбл эндпоинта
- Наличие моделей (hasModels)
- Список моделей с их properties
- Выбран ли этот эндпоинт

**Пример лога:**
```javascript
[ENDPOINT_DATA] endpoint[0]: {
  value: 'openAI',
  label: 'OpenAI',
  hasModels: true,
  models: [
    { name: 'gpt-4o', label: 'GPT-4 Omni', context_length: 128000 },
    { name: 'gpt-4o-mini', label: 'GPT-4 Mini', context_length: 128000 }
  ],
  isSelected: true
}
```

---

### 3. Ungrouped ModelSpecs (ModelSpecItem.tsx - renderModelSpecs)
**Что:** Логирует спецификации моделей БЕЗ группы
**Когда:** При рендере ungrouped specs (не привязаны к endpoint)
**Логирует:**
- Количество ungrouped specs
- Их названия и лейблы
- Выбранный spec

**Пример лога:**
```javascript
[UNGROUPED_MODELSPECS]: {
  count: 2,
  specs: [
    { name: 'custom-model-1', label: 'My Custom Model', group: undefined },
    { name: 'custom-model-2', label: 'Another Model', group: undefined }
  ],
  selectedSpec: 'custom-model-1'
}
```

---

### 4. Custom Groups (CustomGroup.tsx - renderCustomGroups)
**Что:** Логирует процесс группировки спецификаций
**Когда:** При построении custom groups (группы которые не совпадают с endpoint names)
**Логирует:**
- Все endpoint values (для исключения из custom groups)
- Каждую custom группу с её спецификациями
- Иконки групп

**Пример лога:**
```javascript
[CUSTOM_GROUPS_STRUCTURE]: {
  totalSpecs: 10,
  endpointValues: ['openAI', 'anthropic', 'agents'],
  customGroups: [
    {
      groupName: 'My Custom Group',
      specCount: 2,
      specs: [
        { name: 'spec-1', label: 'Spec 1', group: 'My Custom Group' },
        { name: 'spec-2', label: 'Spec 2', group: 'My Custom Group' }
      ],
      groupIcon: 'present'
    }
  ]
}
```

---

### 5. Endpoint Models (EndpointModelItem.tsx - renderEndpointModels)
**Что:** Логирует модели которые рендерятся в каждом эндпоинте
**Когда:** При рендере списка моделей эндпоинта
**Логирует:**
- Список всех доступных моделей эндпоинта
- Отфильтрованные ли модели (поиск)
- Выбранная модель
- Информацию о каждой модели

**Пример лога:**
```javascript
[ENDPOINT_MODELS] openAI: {
  endpointLabel: 'OpenAI',
  totalModels: 5,
  modelsToRender: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', ...],
  isFiltered: false,
  selectedModel: 'gpt-4o',
  models: [
    { name: 'gpt-4o', isGlobal: false },
    { name: 'gpt-4o-mini', isGlobal: false }
  ]
}
```

---

### 6. ModelSpec Items (ModelSpecItem.tsx)
**Что:** Логирует каждый spec item
**Когда:** При рендере каждого ModelSpecItem
**Логирует:**
- Название и лейбл спека
- Его группа
- Настройки отображения
- Выбран ли он

**Пример лога:**
```javascript
[MODEL_SPEC] gpt-4: {
  name: 'gpt-4',
  label: 'GPT-4',
  group: 'openAI',
  preset: { endpoint: 'openAI', model: 'gpt-4' },
  description: 'Most capable model',
  groupIcon: undefined,
  showIconInMenu: true,
  isSelected: false
}
```

---

## 🎯 КАК ПРОСМОТРЕТЬ ЛОГИ

### Шаг 1: Пересобрать фронтенд
```bash
npm run build
```

### Шаг 2: Запустить dev server
```bash
cd client && npm run dev
# ИЛИ
npm run frontend:dev
```

### Шаг 3: Открыть браузер
```
http://localhost:3090  (или 3080 если backend запущен)
```

### Шаг 4: Открыть DevTools Console
```
F12 → Console tab
```

### Шаг 5: Фильтровать по префиксу структуры
```
Фильтр: [SELECTOR_STRUCTURE]
или
Фильтр: [ENDPOINT_DATA]
или
Фильтр: [CUSTOM_GROUPS]
или
Фильтр: [MODEL_SPEC]
или
Фильтр: [ENDPOINT_MODELS]
```

### Шаг 6: Открыть селектор моделей
```
Нажать "Select Model" в чате → Видны все логи структуры
```

---

## 📊 СТРУКТУРА ДАННЫХ КОТОРУЮ МЫ ВИДИМ

### Полная иерархия:

```typescript
{
  // Основные компоненты селектора
  modelSpecs: TModelSpec[] = [
    {
      name: string,                    // Уникальный ID
      label: string,                   // Отображаемое имя
      group?: string,                  // Группа (может быть имя endpoint'а или custom group)
      preset: {
        endpoint: string,              // Какой endpoint использует
        model: string,                 // Какой model ID
      },
      description?: string,            // Описание
      groupIcon?: string,              // URL иконки группы
      showIconInMenu?: boolean,        // Показывать ли иконку
    }
  ],

  mappedEndpoints: Endpoint[] = [
    {
      value: string,                   // Ключ endpoint'а (openAI, anthropic, etc)
      label: string,                   // Отображаемое имя
      icon?: React.ReactNode,          // Иконка endpoint'а
      hasModels: boolean,              // Есть ли модели
      models: Array<{                  // Список доступных моделей
        name: string,                  // ID модели
        label: string,                 // Отображаемое имя
        context_length?: number,       // Контекстное окно
        isGlobal?: boolean,            // Глобальный ли (для agents)
      }>,
      modelIcons?: Record<string, string>,    // Иконки для моделей
      agentNames?: Record<string, string>,    // Имена агентов
      assistantNames?: Record<string, string> // Имена assistants
    }
  ],

  agentsMap: Record<string, any> = {
    [agentId]: {
      name: string,
      // ... other agent properties
    }
  }
}
```

---

## 🔍 ЧТО МЫВИДИМ В ЛОГАХ

### Вопросы которые логи отвечают:

**1. Из каких данных строится селектор?**
- ✅ Видно в [SELECTOR_STRUCTURE] - что есть в modelSpecs и mappedEndpoints

**2. Как происходит группировка?**
- ✅ Видно в [CUSTOM_GROUPS_STRUCTURE] - какие группы созданы, как спеки распределены

**3. Какие пропсы передаются в компоненты?**
- ✅ Видно в каждом [ENDPOINT_DATA], [MODEL_SPEC] и т.д. - что получает каждый компонент

**4. Какие модели показываются в каждом endpoint?**
- ✅ Видно в [ENDPOINT_MODELS] - список моделей для каждого endpoint'а

**5. Какая группировка применяется?**
- ✅ Видно через `group` field в каждом spec:
  - `group: 'openAI'` → показывается в OpenAI group
  - `group: 'custom-group'` → показывается в Custom Group (если нет endpoint с таким value)
  - `group: undefined` → показывается в ungrouped section (первым)

---

## 📋 КЛЮЧЕВЫЕ МЕТРИКИ

**Считайте в логах:**

1. **Сколько ungrouped specs?**
   - Посмотреть [UNGROUPED_MODELSPECS] count

2. **Сколько endpoints?**
   - Посмотреть [SELECTOR_STRUCTURE] → mappedEndpoints length

3. **Сколько custom groups?**
   - Посмотреть [CUSTOM_GROUPS_STRUCTURE] → customGroups length

4. **Сколько всего specs?**
   - Сложить: ungrouped + custom groups + endpoint groups

5. **Почему селектор показывает N моделей?**
   - Сложить все модели из всех [ENDPOINT_MODELS]

---

## 🎯 ОТВЕЧ НА ИСХОДНЫЕ ВОПРОСЫ

### 1. Из каких именно данных строится UI селектора?

**Ответ видно в логах:**
- endpoints из `mappedEndpoints` (массив Endpoint)
- modelSpecs из `modelSpecs` (массив TModelSpec)
- agents из `agentsMap` (Record)
- assistants из `assistantsMap` (Record)

### 2. Где именно происходит группировка по категориям?

**Ответ видно в логах:**
- Ungrouped specs → рендерятся первыми (нет group field)
- Endpoint группы → specs с `group === endpoint.value`
- Custom группы → specs с `group !== endpoint.value` (в renderCustomGroups)

### 3. Какие пропсы передаются в компонент ModelSelector?

**Ответ видно в логах:**
- [SELECTOR_STRUCTURE] показывает что получает ModelSelectorContent
- [ENDPOINT_DATA] показывает что получает EndpointItem
- [MODEL_SPEC] показывает что получает ModelSpecItem

### 4. Полный путь рендерления

```
App/Chat
  ↓
  ModelSelector (ModelSelector.tsx)
  ├─ props: startupConfig
  ├─ ↓ Provider wraps content
  ├─ ModelSelectorContent
  │  ├─ [SELECTOR_STRUCTURE] логирует все props
  │  ├─ renderModelSpecs → [UNGROUPED_MODELSPECS]
  │  ├─ renderEndpoints → для каждого:
  │  │  ├─ EndpointItem → [ENDPOINT_DATA]
  │  │  ├─ EndpointMenuContent
  │  │  └─ renderEndpointModels → [ENDPOINT_MODELS]
  │  │     └─ EndpointModelItem (для каждой модели)
  │  └─ renderCustomGroups → [CUSTOM_GROUPS_STRUCTURE]
  │     └─ CustomGroup
  │        └─ ModelSpecItem → [MODEL_SPEC]
```

---

## 📝 ОЖИДАЕМЫЙ JSON СТРУКТУРА

Реальный JSON который мы увидим в логах:

```json
{
  "SELECTOR_STRUCTURE": {
    "modelSpecs": [
      {"name": "gpt-4", "label": "GPT-4", "group": "openAI"},
      {"name": "custom-1", "label": "Custom Model", "group": undefined}
    ],
    "mappedEndpoints": [
      {"value": "openAI", "label": "OpenAI", "hasModels": true, "modelsCount": 5},
      {"value": "anthropic", "label": "Anthropic", "hasModels": true, "modelsCount": 3},
      {"value": "agents", "label": "Agents", "hasModels": true, "modelsCount": 10}
    ]
  },
  "CUSTOM_GROUPS_STRUCTURE": {
    "customGroups": [
      {
        "groupName": "My Models",
        "specs": [
          {"name": "custom-1", "label": "Custom", "group": "My Models"}
        ]
      }
    ]
  },
  "ENDPOINT_DATA": [
    {
      "value": "openAI",
      "models": [
        {"name": "gpt-4o", "label": "GPT-4 Omni"},
        {"name": "gpt-4o-mini", "label": "GPT-4 Mini"}
      ]
    }
  ]
}
```

---

**Статус:** ✅ ДИАГНОСТИКА СТРУКТУРЫ ГОТОВА
