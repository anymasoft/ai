# ПЛАН РЕАЛИЗАЦИИ: Spec-First архитектура с системой тарифов

## 🎯 ЦЕЛЬ
Привести механизм выбора моделей в соответствие с оригинальной spec-driven архитектурой LibreChat и добавить коммерческую систему тарифов, которая ограничивает доступ через `allowedSpecs`.

## 📊 АРХИТЕКТУРНАЯ ДИАГРАММА

```
КЛИЕНТ (Frontend)
  ↓
ModelSelector выбирает spec
  ↓
setConversation({ spec: "claude-haiku-4-5" })
  ↓
payload отправляет ТОЛЬКО spec
  ↓
BACKEND
  ↓
checkSpecAllowedForPlan middleware
  ├─ Получить spec из req.body.spec
  ├─ Получить план пользователя
  ├─ Проверить spec в plan.allowedSpecs
  └─ Если NO → 403 MODEL_NOT_ALLOWED
  ↓
buildEndpointOption middleware
  ├─ Если enforce = true:
  │   ├─ Найти modelSpec по spec.name
  │   ├─ Взять modelSpec.preset.model
  │   └─ Назначить endpoint и model из preset
  └─ Игнорировать req.body.model полностью
  ↓
API Call к моделям
  └─ Используется ТОЛЬКО model из preset
```

## 🔧 ФАЙЛЫ ДЛЯ ИЗМЕНЕНИЯ

### BACKEND
1. **api/server/middleware/checkSpecAllowedForPlan.js** (NEW)
   - Проверка spec против plan.allowedSpecs

2. **api/server/middleware/buildEndpointOption.js** (MODIFY)
   - Удалить fallback на req.body.model
   - Использовать ТОЛЬКО spec → preset.model
   - Убрать логику использования conversation.model

3. **api/routes/endpoints/models.js** (MODIFY)
   - /api/models/allowed фильтрует spec по тарифу

4. **models/Plan.js** или эквивалент (MODIFY)
   - Добавить поле allowedSpecs: string[]
   - Убрать allowedModels если есть

### FRONTEND
1. **client/src/components/Chat/Menus/Endpoints/ModelSelector.tsx** (MODIFY)
   - Работать ТОЛЬКО со spec
   - При выборе → setConversation({ spec })
   - НЕ обновлять conversation.model вручную

2. **client/src/components/Chat/Menus/Endpoints/ModelSelectorContext.tsx** (MODIFY)
   - handleSelectSpec работает правильно
   - Убрать handleSelectModel
   - Убрать handleSelectEndpoint для model-based выбора

3. **client/src/hooks/Input/useSelectMention.ts** (MODIFY)
   - onSelectEndpoint работает со spec
   - Не пытается использовать model как источник истины

4. **client/src/utils/buildDefaultConvo.ts** (MODIFY)
   - Использовать spec для выбора модели
   - Не полагаться на conversation.model

5. **client/src/hooks/useNewConvo.ts** (MODIFY)
   - buildDefaultConvo получает spec, а не model

### CONFIG
1. **librechat.yaml** (MODIFY)
   - modelSpecs.enforce = true
   - Полный список spec с preset.model
   - Никаких fallback

## 📝 ДЕТАЛЬНАЯ РЕАЛИЗАЦИЯ

### 1. MODELSPECS В CONFIG

```yaml
# librechat.yaml
modelSpecs:
  enforce: true  # ← ОБЯЗАТЕЛЬНО true
  list:
    - name: gpt-4.1-mini
      label: GPT-4.1 Mini
      icon: openai
      preset:
        endpoint: openAI
        model: gpt-4.1-mini

    - name: claude-haiku-4-5
      label: Claude Haiku 4.5
      icon: anthropic
      preset:
        endpoint: anthropic
        model: claude-haiku-4-5

    - name: claude-sonnet-4-6
      label: Claude Sonnet 4.6
      icon: anthropic
      preset:
        endpoint: anthropic
        model: claude-sonnet-4-6

    # ... остальные модели
```

**Правила:**
- Каждый spec имеет уникальный name
- preset содержит ТОЛЬКО endpoint и model
- Нет fallback, нет условных значений
- Порядок = порядок в UI

### 2. МОДЕЛЬ PLAN

```javascript
// models/Plan.js (или создать новый файл)
const planSchema = new Schema({
  userId: ObjectId,
  tier: {
    type: String,
    enum: ['free', 'pro', 'business'],
    default: 'free'
  },

  // ← ГЛАВНОЕ: ограничение через spec, а не model
  allowedSpecs: {
    type: [String],
    default: ['gpt-4.1-mini']
  },

  // Пример конфигурации:
  // tier: 'free'       → allowedSpecs: ['gpt-4.1-mini']
  // tier: 'pro'        → allowedSpecs: ['gpt-4.1-mini', 'claude-haiku-4-5', 'gpt-5.2', 'deepseek-chat']
  // tier: 'business'   → allowedSpecs: ALL (или список)

  createdAt: Date,
  updatedAt: Date
});

// Helper функция
planSchema.methods.canUseSpec = function(specName) {
  return this.allowedSpecs.includes(specName);
};
```

### 3. /API/MODELS/ALLOWED

```javascript
// api/routes/endpoints/models.js
app.get('/api/models/allowed', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const startupConfig = req.config.modelSpecs;

    // Получить план пользователя
    const plan = await Plan.findOne({ userId });
    const allowedSpecs = plan?.allowedSpecs || ['gpt-4.1-mini'];

    // Фильтровать spec по плану
    const filteredSpecs = (startupConfig.list || [])
      .filter(spec => allowedSpecs.includes(spec.name));

    return res.status(200).json({
      modelSpecs: {
        enforce: true,
        list: filteredSpecs
      }
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});
```

### 4. MIDDLEWARE: checkSpecAllowedForPlan

```javascript
// api/server/middleware/checkSpecAllowedForPlan.js
module.exports = async (req, res, next) => {
  try {
    const { spec } = req.body;
    const userId = req.user?.id;

    // Если нет spec - это OK, позволить даже без ограничения
    if (!spec) {
      return next();
    }

    // Получить план
    const plan = await Plan.findOne({ userId });
    const allowedSpecs = plan?.allowedSpecs || ['gpt-4.1-mini'];

    // Проверить, разрешена ли эта spec
    if (!allowedSpecs.includes(spec)) {
      return res.status(403).json({
        error: 'MODEL_NOT_ALLOWED',
        message: `Spec "${spec}" is not allowed for your plan`,
        allowedSpecs
      });
    }

    next();
  } catch (error) {
    console.error('checkSpecAllowedForPlan error:', error);
    next();
  }
};

// В router:
router.post('/ask',
  authenticateUser,
  checkSpecAllowedForPlan,  // ← ДО buildEndpointOption
  buildEndpointOption,
  conversationController.ask
);
```

### 5. BUILDENDPOINTOPTION (Переделка)

```javascript
// api/server/middleware/buildEndpointOption.js
module.exports = (req, res, next) => {
  const appConfig = req.config;
  const { spec } = req.body;

  // ===== SPEC-FIRST ЛОГИКА =====
  if (appConfig.modelSpecs?.enforce === true) {
    // MODE 1: ENFORCED - ТОЛЬКО spec
    if (!spec) {
      return res.status(400).json({
        error: 'SPEC_REQUIRED',
        message: 'spec is required when modelSpecs.enforce = true'
      });
    }

    // Найти spec в конфиге
    const modelSpec = appConfig.modelSpecs.list.find(s => s.name === spec);
    if (!modelSpec) {
      return res.status(400).json({
        error: 'SPEC_NOT_FOUND',
        message: `Model spec "${spec}" not found in configuration`
      });
    }

    // Взять preset из spec
    const { endpoint, model } = modelSpec.preset;

    // Применить к conversation
    const conversation = req.body;
    conversation.endpoint = endpoint;
    conversation.model = model;
    conversation.spec = spec;

    // ← Удалить любые попытки использовать req.body.model
    // ← Удалить любые fallback логики
    // ← Удалить использование conversation.model

    // Парсить conversation по endpoint schema
    // (остальная логика buildEndpointOption)
    const endpointOption = parseConvo({
      endpoint,
      conversation,
      possibleValues: {
        models: [model]  // ← ТОЛЬКО модель из preset
      }
    });

    req.endpointOption = endpointOption;
    return next();
  }

  // MODE 2: NON-ENFORCED - fallback на оригинальную логику
  // (сохранить для совместимости, но в нашем случае не использовать)
  // ...
  next();
};
```

## 🎨 FRONTEND ИЗМЕНЕНИЯ

### ModelSelector.tsx (УПРОЩЕНИЕ)

```tsx
function ModelSelectorContent() {
  const { modelSpecs, selectedValues, setSelectedValues } = useModelSelectorContext();

  const onSpecChange = (specName: string) => {
    // ← ГЛАВНОЕ: обновляем ТОЛЬКО spec
    setSelectedValues({
      endpoint: '',      // ← не нужно
      model: '',         // ← не нужно, это определяется spec
      modelSpec: specName // ← ТОЛЬКО ЭТО
    });
  };

  // Отправить в conversation
  const { setConversation } = useChatContext();
  useEffect(() => {
    if (selectedValues.modelSpec) {
      setConversation(prev => ({
        ...prev,
        spec: selectedValues.modelSpec
        // ← НЕ обновлять conversation.model
      }));
    }
  }, [selectedValues.modelSpec]);

  return (
    <ModelSpecSelector
      specs={modelSpecs}
      selectedSpec={selectedValues.modelSpec}
      onChange={onSpecChange}
    />
  );
}
```

### ModelSelectorContext.tsx (УПРОЩЕНИЕ)

```tsx
// Удалить все handler функции для model:
// ❌ handleSelectModel
// ❌ handleSelectEndpoint (для model)
// ✅ Оставить handleSelectSpec

const handleSelectSpec = (spec: TModelSpec) => {
  const { endpoint } = spec.preset;

  // Вызвать onSelectSpec (из useSelectMention)
  onSelectSpec?.(spec);

  // Обновить selectedValues
  setSelectedValues({
    endpoint: '',        // ← не используется
    model: '',           // ← не используется
    modelSpec: spec.name // ← ТОЛЬКО это
  });

  // ← НЕ вызывать onSelectEndpoint
  // ← НЕ обновлять conversation.model
  // ← newConversation вызовется из useSelectSpec
};
```

### Payload Структура

```typescript
// ДО (Неправильно)
{
  endpoint: 'anthropic',
  model: 'claude-haiku-4-5',
  spec: 'claude-haiku-4-5'  // ← конфликт
}

// ПОСЛЕ (Правильно)
{
  spec: 'claude-haiku-4-5'
  // ← Больше ничего не нужно
  // ← endpoint и model определяются spec.preset на backend
}
```

## 🧪 ПРОВЕРОЧНЫЕ ТОЧКИ

### 1. Backend Проверка
```bash
curl -X POST http://localhost:3000/ask \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "spec": "claude-haiku-4-5"
  }'

# Ожидаемо:
# ✅ Если spec в allowedSpecs → запрос идёт
# ✅ model в endpointOption = "claude-haiku-4-5" (из preset)
# ❌ Если spec НЕ в allowedSpecs → 403 MODEL_NOT_ALLOWED
```

### 2. Frontend Проверка
```javascript
// В DevTools:
// 1. Выбрать модель в UI
console.log('conversation.spec'); // ← должна быть spec.name
console.log('conversation.model'); // ← может быть undefined или старое значение

// 2. Проверить payload
// В Network tab, при отправке запроса:
// {
//   "spec": "claude-haiku-4-5",
//   ...
// }
```

## 🚨 ЧТО УДАЛИТЬ

1. ❌ Все использования req.body.model как источника истины на backend
2. ❌ Все useEffect, которые синхронизируют model и spec
3. ❌ Все fallback логики типа "если model не найден, использовать default"
4. ❌ Все попытки "guess" model из endpoint
5. ❌ Все конфликты между model и spec в одном объекте

## ✅ ЧТО ОСТАВИТЬ

1. ✅ Оригинальная spec-driven логика LibreChat
2. ✅ parseConvo для schema validation
3. ✅ useSelectMention для координации выбора
4. ✅ localStorage для сохранения последней выбранной spec
5. ✅ Все UI компоненты, просто изменить что они передают

## 📋 ИТОГОВАЯ ЦЕПОЧКА (ПРАВИЛЬНАЯ)

```
1. Пользователь видит список spec (отфильтрованный по его плану)
2. Выбирает "Claude Haiku 4.5" (это spec.name = "claude-haiku-4-5")
3. UI: setConversation({ spec: "claude-haiku-4-5" })
4. Payload: { spec: "claude-haiku-4-5" }
5. Backend checkSpecAllowedForPlan: ✅ разрешено
6. Backend buildEndpointOption:
   - Находит modelSpec по name
   - Берёт endpoint и model из modelSpec.preset
   - Результат: endpoint="anthropic", model="claude-haiku-4-5"
7. API запрос: claude-haiku-4-5 ✅
8. Результат: Haiku, а не Sonnet!
```

## 🎓 ПРИНЦИПЫ

- **Spec is King**: Выбор spec = выбор модели полностью
- **One Source of Truth**: modelSpecs.list в конфиге
- **Deterministic**: Нет угадываний, нет fallback
- **Commercial Control**: Тариф ограничивает spec.list
- **No Conflicts**: model всегда совпадает с spec.preset.model
- **Clean Backend**: req.body.model игнорируется, используется только spec
