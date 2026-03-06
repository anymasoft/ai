# АРХИТЕКТУРНЫЙ ПЛАН: ЕДИНЫЙ ИСТОЧНИК ИСТИНЫ ДЛЯ МОДЕЛЕЙ

**Дата**: 2026-03-03
**Версия**: 1.0
**Статус**: Утвержден

---

## РАЗДЕЛ 1: АНАЛИЗ ТЕКУЩЕЙ АРХИТЕКТУРЫ

### 1.1 Существующие источники моделей

#### Источник #1: AiModel (MongoDB коллекция)
```
File: api/models/AiModel.js
SEED_DEFAULTS: 16 моделей (hardcoded в JS)
┌─ modelId: 'gpt-4o'
├─ provider: 'openai'
├─ endpointKey: 'openAI'
├─ displayName: 'GPT-4o'
└─ isActive: true
```

**Использование:**
- ✅ `/api/models/all` — админка загружает все модели
- ✅ Валидация при сохранении плана (PATCH /api/admin/mvp/plans/:planId)
- ✅ `/api/models/allowed` — фильтрует по плану (но не используется фронтенду)

**Проблемы:**
- Hardcoded SEED_DEFAULTS в JS файле
- Дублирует список из librechat.yaml
- Не синхронизирован

---

#### Источник #2: librechat.yaml (конфиг файл)
```yaml
File: librechat.yaml
modelSpecs:
  list:
    - name: "gpt-4o"
      label: "GPT-4o"
      preset:
        endpoint: "openAI"
        model: "gpt-4o"
        temperature: 0.7
        max_tokens: 4096
```

**Использование:**
- ✅ `/api/config` — стартовая конфигурация (через getAppConfig → AppService)
- ✅ Фронтенд получает через startupConfig.modelSpecs.list
- ✅ ModelSelectorContext использует это для рендеринга селектора
- ✅ Не применяется фильтрация по плану

**Проблемы:**
- Hardcoded в YAML файле
- Дублирует AiModel.js SEED_DEFAULTS
- Не учитывает тарифы пользователя
- Содержит полные presets (endpoint, temperature, max_tokens)

---

#### Источник #3: Plan.allowedModels (MongoDB коллекция)
```javascript
File: api/models/Plan.js
{
  planId: 'pro',
  allowedModels: [
    'gpt-4o',
    'gpt-4o-mini',
    'claude-sonnet-4-6',
    'deepseek-chat'
  ]
}
```

**Использование:**
- ✅ Проверка доступа в `checkSubscription` middleware (при POST/PUT/PATCH)
- ✅ Отображение на странице /pricing
- ✅ `/api/models/allowed` возвращает для админки

**Проблемы:**
- Только защитный слой, не влияет на UI
- Проверка только при отправке сообщения (слишком поздно)
- Нет фильтрации в селекторе

---

### 1.2 Поток данных (текущий)

```
АДМИНКА:
  AdminPanel.tsx
    ↓ GET /api/models/all
  models.js endpoint
    ↓
  AiModel.find({ isActive: true })
    ↓
  MongoDB AiModel
    ↓ SEED_DEFAULTS инициализирует коллекцию
  [16 моделей]

СЕЛЕКТОР В ЧАТЕ:
  ModelSelector.tsx
    ↓ startupConfig.modelSpecs.list (инициализация)
  ModelSelectorContext
    ↓
  /api/config (при загрузке приложения)
  config.js endpoint
    ↓
  getAppConfig → AppService
    ↓
  loadCustomConfig
    ↓
  librechat.yaml (HARDCODED modelSpecs)
    ↓ [16 моделей]
  startupConfig.modelSpecs.list
    ↓ (НО БЕЗ ФИЛЬТРАЦИИ ПО ПЛАНУ!)
  Селектор показывает ВСЕ модели
    ↓
  Пользователь выбирает модель
    ↓
  POST /api/conversations
    ↓
  checkSubscription middleware
    ↓
  Если модель не в Plan.allowedModels → 403!
    ↓
  ❌ UX ПРОБЛЕМА: Пользователь видел модель, но получает ошибку

ПРОВЕРКА ДОСТУПА:
  POST /api/conversations (с выбранной моделью)
    ↓
  checkSubscription middleware
    ↓
  Subscription.findOne({ userId })
  Plan.findOne({ planId })
  isModelAllowed(planConfig, modelId)
    ↓ [Проверка allowedModels]
    ↓ Если не разрешена → res.status(403)
```

### 1.3 Точки дублирования

| Модель | AiModel.js | librechat.yaml | Одинакова? |
|--------|-----------|----------------|-----------|
| gpt-4o | ✅ | ✅ | ✅ |
| gpt-4o-mini | ✅ | ✅ | ✅ |
| gpt-4.1-mini | ✅ | ✅ | ✅ |
| gpt-4-turbo | ✅ | ✅ | ✅ |
| gpt-4 | ✅ | ✅ | ✅ |
| gpt-3.5-turbo | ✅ | ✅ | ✅ |
| gpt-5.2 | ✅ | ✅ | ✅ |
| claude-sonnet-4-6 | ✅ | ✅ | ✅ |
| claude-opus-4-6 | ✅ | ✅ | ✅ |
| claude-haiku-4-5 | ✅ | ✅ | ✅ |
| deepseek-chat | ✅ | ✅ | ✅ |
| deepseek-reasoner | ✅ | ✅ | ✅ |
| gemini-2.0-flash | ✅ | ✅ | ✅ |
| gemini-1.5-pro | ✅ | ✅ | ✅ |
| llama-3.1-70b-versatile | ✅ | ✅ | ✅ |
| mixtral-8x7b-32768 | ✅ | ✅ | ✅ |

**ВЫВОД:** 100% дублирование, модели одинаковые.

### 1.4 Риски текущей архитектуры

| Риск | Вероятность | Воздействие | Описание |
|------|------------|-----------|---------|
| **Рассинхрон моделей** | Высокая | Критическое | Если обновить SEED_DEFAULTS, но не librechat.yaml → селектор не покажет новую модель |
| **403 после выбора** | Средняя | Критическое | UX проблема: пользователь видит модель в селекторе, но при отправке сообщения → ошибка 403 |
| **Сложность обновления** | Средняя | Критическое | Нужно обновлять ДВА места (AiModel.js + librechat.yaml) |
| **Отсутствие фильтрации UI** | Высокая | Критическое | Селектор не фильтрует по тарифу, только backend проверяет |
| **Хрупкая архитектура** | Высокая | Высокое | Много мест, где используются модели, трудно найти все |
| **Нет автозаполнения** | Высокая | Высокое | Если в Plan.allowedModels указан неправильный modelId → ошибка только при отправке |

---

## РАЗДЕЛ 2: ЦЕЛЕВАЯ АРХИТЕКТУРА

### 2.1 Принципы новой архитектуры

1. **Single Source of Truth (SSOT):**
   - AiModel (MongoDB коллекция) — ЕДИНСТВЕННЫЙ источник списка моделей
   - SEED_DEFAULTS определяет начальное состояние
   - Любые изменения модели → только в MongoDB

2. **Фильтрация по плану на фронтенде:**
   - Селектор показывает ТОЛЬКО модели из Plan.allowedModels
   - Нет 403 ошибок после выбора модели
   - Backend защищает как вторичный слой

3. **Синхронизированность:**
   - librechat.yaml используется ТОЛЬКО для конфигурации endpoint'ов
   - modelSpecs.list УДАЛЯЕТСЯ как источник UI
   - Все остальное берется из MongoDB

4. **Обратная совместимость:**
   - Существующие подписки продолжают работать
   - Plan.allowedModels не меняет структуру
   - API endpoints остаются теми же (но с новой логикой)

### 2.2 Целевая архитектура: Диаграмма потоков

```
ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ:
  Фронтенд загружается
    ↓
  GET /api/config (как и раньше)
  [Но modelSpecs.list БОЛЬШЕ НЕ возвращается!]
  [Или возвращается, но не используется селектором]
    ↓
  startupConfig загружается (без modelSpecs.list в селекторе)
    ↓
  Пользователь открывает чат
    ↓
  ModelSelector инициализируется


СЕЛЕКТОР В ЧАТЕ (NEW):
  ModelSelector.tsx
    ↓
  ModelSelectorContext
    ↓
  useQuery('allowedModels')
    ↓ GET /api/models/allowed (требует auth)
  models.js endpoint
    ↓
  const userId = req.user._id
  const subscription = await Subscription.findOne({ userId })
  const plan = subscription?.plan || 'free'
    ↓
  const planDoc = await Plan.findOne({ planId: plan })
  const allowedModelIds = planDoc?.allowedModels || []
    ↓
  if (allowedModelIds.length === 0) {
    // Пустой массив = все модели разрешены
    const models = await AiModel.find({ isActive: true })
  } else {
    // Есть ограничение
    const models = await AiModel.find({
      modelId: { $in: allowedModelIds },
      isActive: true
    })
  }
    ↓
  Возвращаем с полной информацией:
  {
    models: [
      {
        modelId: 'gpt-4o',
        displayName: 'GPT-4o',
        provider: 'openai',
        endpointKey: 'openAI'
      },
      ...
    ],
    plan: 'pro',
    modelsByEndpoint: {
      openAI: ['gpt-4o', 'gpt-4o-mini'],
      anthropic: ['claude-sonnet-4-6'],
      ...
    }
  }
    ↓
  ModelSelectorContext получает данные
    ↓
  filterItems() — фильтрует по поисковому запросу
    ↓
  Селектор показывает ВСЕ разрешенные модели
    ↓
  Пользователь выбирает модель (гарантированно в плане)
    ↓
  POST /api/conversations (с выбранной моделью)
    ↓
  checkSubscription middleware (вторичная защита)
    ↓
  ✅ Модель разрешена (мы уже знали это!)
  ✅ Сообщение отправляется


АДМИНИСТРАТОР:
  AdminPanel.tsx
    ↓ GET /api/models/all (все модели)
  models.js endpoint
    ↓
  AiModel.find({ isActive: true })
    ↓
  [16 моделей]
  [Админ выбирает подмножество для плана]
    ↓
  PATCH /api/admin/mvp/plans/:planId
    ↓
  admin.js controller
    ↓
  const update = {
    allowedModels: [...selected models...]
  }
  Plan.findOneAndUpdate({ planId }, update)
  invalidatePlanCache() // Clear in-memory cache
    ↓
  ✅ Тариф обновлен
  ✅ Кэш инвалидирован
  ✅ При следующем GET /api/models/allowed
     селектор покажет новые модели


ПРОВЕРКА ДОСТУПА (защитный слой):
  POST /api/conversations (с моделью)
    ↓
  checkSubscription middleware
    ↓
  Даже если somehow модель попала в payload, но не в плане
    ↓
  isModelAllowed(planConfig, modelId) вернет false
    ↓
  res.status(403) { error: 'Model not allowed' }
    ↓
  ✅ Защита от эксплуатации
```

### 2.3 Изменения API endpoints

#### /api/models/all (без изменений)
```
GET /api/models/all
Возвращает ВСЕ активные модели из AiModel
[Используется админкой]
Ответ: { models: [...] }
```

#### /api/models (без изменений)
```
GET /api/models
Возвращает модели по эндпоинтам (старый API)
[Для совместимости и ModelSelect компонентов]
Ответ: { openAI: [...], anthropic: [...], ... }
```

#### /api/models/allowed (ПЕРЕДЕЛАН)
```
GET /api/models/allowed (требует auth)
OLD:
  Возвращает модели, разрешенные по плану
  Ответ: { models: [...], plan: 'pro' }
  НО НИКТО НИ ИЗ ФРОНТЕНДА НИ ИСПОЛЬЗУЕТ!

NEW:
  Возвращает модели, разрешенные по плану
  Ответ: {
    models: [
      {
        modelId: 'gpt-4o',
        displayName: 'GPT-4o',
        provider: 'openai',
        endpointKey: 'openAI'
      },
      ...
    ],
    plan: 'pro',
    modelsByEndpoint: {
      openAI: ['gpt-4o', 'gpt-4o-mini'],
      anthropic: ['claude-sonnet-4-6'],
      ...
    }
  }
  ИСПОЛЬЗУЕТСЯ: ModelSelector на фронтенде
```

#### /api/config (без изменений)
```
GET /api/config
Возвращает конфигурацию приложения
НО: startupConfig.modelSpecs.list БОЛЬШЕ НЕ используется селектором!
Может остаться для совместимости, но не применяется
```

### 2.4 Структура данных (без изменений)

#### AiModel (MongoDB)
```javascript
{
  _id: ObjectId,
  modelId: 'gpt-4o',      // ← Уникальный ключ
  provider: 'openai',      // ← Кто провайдер
  endpointKey: 'openAI',   // ← Какой эндпоинт в LibreChat
  displayName: 'GPT-4o',   // ← Как показывать в UI
  isActive: true,          // ← Скрыта ли модель
  createdAt: Date,
  updatedAt: Date
}
```

#### Plan.allowedModels (MongoDB, без изменений)
```javascript
{
  planId: 'pro',
  allowedModels: [
    'gpt-4o',
    'gpt-4o-mini',
    'claude-sonnet-4-6',
    'deepseek-chat'
  ],
  // ... остальные поля
}
```

#### Subscription (MongoDB, без изменений)
```javascript
{
  userId: ObjectId,
  plan: 'pro',
  planExpiresAt: Date,
  // ... остальные поля
}
```

---

## РАЗДЕЛ 3: МИГРАЦИОННАЯ СТРАТЕГИЯ

### 3.1 Фаза 1: Подготовка (без breaking changes)

**Шаги:**
1. ✅ Обновить /api/models/allowed endpoint
   - Добавить полную информацию из AiModel
   - Сохранить назад совместимость (все поля старого API)

2. ✅ Добавить новый хук на фронтенде
   - `useAllowedModels()` вместо `useGetModelsQuery()`
   - Сначала параллельно существует с старым

3. ✅ Обновить ModelSelectorContext
   - Добавить параллельную логику
   - Сначала старый путь еще работает

### 3.2 Фаза 2: Переключение (gradual rollout)

**Шаги:**
1. ✅ Переключить ModelSelector на новый endpoint
   - GET /api/models/allowed вместо startupConfig
   - Проверить что все работает

2. ✅ Убедиться что нет регрессий
   - Селектор показывает нужные модели
   - Нет 403 ошибок
   - Тарифы работают

3. ✅ Удалить дублирование
   - SEED_DEFAULTS может остаться в AiModel.js (не менять)
   - librechat.yaml modelSpecs оставить (может использоваться извне)

### 3.3 Фаза 3: Cleanup (опционально)

**Шаги:**
1. ❓ Удалить modelSpecs.list из /api/config (только если никто не использует)
2. ❓ Удалить SEED_DEFAULTS из AiModel.js (только если есть другой источник)
3. ❓ Simplify librechat.yaml (удалить modelSpecs)

---

## РАЗДЕЛ 4: ДЕТАЛЬНЫЙ СПИСОК ИЗМЕНЕНИЙ

### 4.1 Backend изменения

#### Файл 1: api/server/routes/models.js

**Статус:** ПЕРЕДЕЛАН

**Что меняется:**
- Обновить GET /api/models/allowed endpoint
- Добавить полную информацию из AiModel
- Сохранить совместимость со старой структурой

**Изменения:**
```javascript
// БЫЛО: Возвращает только моделей с плана
// БУДЕТ: Возвращает полную информацию с AiModel

router.get('/allowed', requireJwtAuth, async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const subscription = await Subscription.findOne({ userId }).lean();
    let plan = subscription?.plan || 'free';

    if (plan !== 'free' && subscription?.planExpiresAt &&
        new Date(subscription.planExpiresAt) < new Date()) {
      plan = 'free';
    }

    await Plan.seedDefaults();
    const planDoc = await Plan.findOne({ planId: plan }, 'allowedModels').lean();
    const allowedModelIds = planDoc?.allowedModels ?? [];

    await AiModel.seedDefaults();

    // НОВОЕ: Используем AiModel для полной информации
    const query = allowedModelIds.length > 0
      ? { modelId: { $in: allowedModelIds }, isActive: true }
      : { isActive: true };

    const models = await AiModel.find(query)
      .sort({ provider: 1, displayName: 1 })
      .select('modelId provider endpointKey displayName -_id')
      .lean();

    // Организуем по эндпоинтам
    const modelsByEndpoint = {};
    models.forEach((model) => {
      if (!modelsByEndpoint[model.endpointKey]) {
        modelsByEndpoint[model.endpointKey] = [];
      }
      modelsByEndpoint[model.endpointKey].push(model.modelId);
    });

    res.set('Cache-Control', 'private, max-age=60');
    return res.json({
      ...modelsByEndpoint,
      models,        // Полный массив с информацией
      plan,          // План для UI бейджа
    });
  } catch (err) {
    logger.error('[models/allowed]', err);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
});
```

---

#### Файл 2: api/models/AiModel.js

**Статус:** БЕЗ ИЗМЕНЕНИЙ (остается как source of truth)

**Почему не меняется:**
- SEED_DEFAULTS — это конфигурация системы
- Оставляем как есть для инициализации

---

#### Файл 3: librechat.yaml

**Статус:** БЕЗ КРИТИЧЕСКИХ ИЗМЕНЕНИЙ

**Что меняется:**
- modelSpecs.list может остаться (не используется селектором)
- Или удалить если не используется нигде
- Оставить endpoint конфигурации

**Почему:**
- Selectors больше не зависит от modelSpecs
- Но другие части могут использовать (agents, assistants)

---

### 4.2 Frontend изменения

#### Файл 1: client/src/components/Chat/Menus/Endpoints/ModelSelectorContext.tsx

**Статус:** ПЕРЕДЕЛАН

**Что меняется:**
- Добавить query на /api/models/allowed
- Использовать его вместо startupConfig.modelSpecs

**Новый код структура:**
```typescript
// НОВОЕ: Query для разрешенных моделей
const allowedModelsQuery = useQuery({
  queryKey: ['allowedModels'],
  queryFn: async () => {
    const res = await fetch('/api/models/allowed', {
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to load allowed models');
    return res.json();
  },
  enabled: !!userId,  // Только если пользователь авторизован
  staleTime: 60_000,  // Кэш 60 секунд
});

// НОВОЕ: modelSpecs из allowedModels вместо startupConfig
const modelSpecs = useMemo(() => {
  // БЫЛО: startupConfig?.modelSpecs?.list ?? []
  // БУДЕТ: Строить из allowedModelsQuery.data

  if (!allowedModelsQuery.data?.models) {
    return [];
  }

  // Конвертировать модели в modelSpecs формат
  return allowedModelsQuery.data.models.map((model) => ({
    name: model.modelId,
    label: model.displayName,
    preset: {
      endpoint: mapEndpointKey(model.endpointKey),
      model: model.modelId,
    },
  }));
}, [allowedModelsQuery.data]);

// Фильтрация по агентам остается как было
// (не менять логику, добавлять к новому)
```

---

#### Файл 2: client/src/components/Chat/Menus/Endpoints/ModelSelector.tsx

**Статус:** БЕЗ ИЗМЕНЕНИЙ

**Почему:**
- Использует ModelSelectorContext
- Context подменяет данные
- UI остается той же

---

#### Файл 3: client/src/components/Input/ModelSelect/ModelSelect.tsx

**Статус:** БЕЗ ИЗМЕНЕНИЙ

**Почему:**
- Этот компонент для старого API
- Остается для совместимости

---

### 4.3 Какие файлы УДАЛЯЮТСЯ

**Файлы, которые можно удалить:**
- Нет критических удалений
- Все остается для совместимости

**Файлы, которые можно почистить (опционально):**
- client/src/components/Chat/Menus/Endpoints/ModelSelectorChatContext.tsx (если не используется)

---

### 4.4 Новые файлы

**Новые файлы:**
- Нет новых файлов (все в существующих)

**Новые utilities:**
- Может потребоваться хелпер для конвертирования AiModel в modelSpec

---

## РАЗДЕЛ 5: ПЛАН ТЕСТИРОВАНИЯ

### 5.1 Unit тесты

#### Test 1: /api/models/allowed возвращает правильные модели
```javascript
describe('GET /api/models/allowed', () => {
  test('returns all models for free plan', async () => {
    // Setup: создать пользователя с plan=free
    // Action: GET /api/models/allowed
    // Assert: количество моделей = free.allowedModels.length
  });

  test('returns filtered models for pro plan', async () => {
    // Setup: создать пользователя с plan=pro
    // Action: GET /api/models/allowed
    // Assert: количество моделей = pro.allowedModels.length
  });

  test('returns full model info from AiModel', async () => {
    // Setup: создать пользователя
    // Action: GET /api/models/allowed
    // Assert: каждая модель содержит modelId, displayName, provider, endpointKey
  });

  test('caches result for 60 seconds', async () => {
    // Setup: создать пользователя
    // Action: GET /api/models/allowed (1), изменить план, GET /api/models/allowed (2)
    // Assert: первый результат кэширован, второй свеж
  });

  test('handles expired subscription', async () => {
    // Setup: создать пользователя с planExpiresAt в прошлом
    // Action: GET /api/models/allowed
    // Assert: вернулись модели план=free
  });
});
```

#### Test 2: ModelSelectorContext использует allowedModels
```typescript
describe('ModelSelectorContext with allowedModels', () => {
  test('loads models from /api/models/allowed', async () => {
    // Setup: рендер компонента с мок-ответом
    // Action: дождаться загрузки
    // Assert: modelSpecs построены из allowedModels
  });

  test('shows only allowed models in selector', async () => {
    // Setup: plan=free с 2 моделями
    // Action: рендер селектора
    // Assert: видны ровно 2 модели
  });

  test('updates when plan changes', async () => {
    // Setup: рендер, план=free
    // Action: обновить план на pro
    // Assert: селектор показывает новые модели
  });
});
```

#### Test 3: checkSubscription как вторичная защита
```javascript
describe('checkSubscription middleware', () => {
  test('allows model if in plan.allowedModels', async () => {
    // Setup: user.plan=pro, model=gpt-4o (в allowedModels)
    // Action: POST /api/conversations { model: 'gpt-4o' }
    // Assert: статус 200, сообщение отправлено
  });

  test('denies model if not in plan.allowedModels', async () => {
    // Setup: user.plan=free, model=gpt-5.2 (не в allowedModels)
    // Action: POST /api/conversations { model: 'gpt-5.2' }
    // Assert: статус 403, сообщение не отправлено
  });
});
```

### 5.2 Integration тесты

#### Integration Test 1: Полный флоу админа
```
1. Админ открывает /admin/settings
2. Видит 16 моделей в чекбоксах
3. Выбирает 3 модели для pro плана
4. Сохраняет PATCH /api/admin/mvp/plans/pro
5. Обновляется в БД
6. Инвалидируется кэш
7. Пользователь pro плана открывает селектор
8. Видит ровно эти 3 модели
9. Выбирает одну, отправляет сообщение
10. Сообщение отправляется успешно ✅
```

#### Integration Test 2: Обновление плана в реальном времени
```
1. Пользователь с plan=free открывает селектор
2. Видит 2 модели (free.allowedModels)
3. Админ обновляет план пользователя на pro
4. Пользователь обновляет страницу
5. Видит модели pro плана ✅
```

#### Integration Test 3: Рассинхрон между планом и моделью
```
1. План содержит modelId='gpt-99-future' (несуществующая модель)
2. GET /api/models/allowed
3. Модель не возвращается (ее нет в AiModel)
4. Пользователь видит только реальные модели ✅
```

### 5.3 Manual тесты

#### Сценарий 1: UX селектора
```
✅ Открыть страницу с чатом
✅ Нажать на селектор моделей
✅ Видны ТОЛЬКО разрешенные по плану модели
✅ Нет других моделей в списке
✅ Выбрать модель
✅ Отправить сообщение
✅ Сообщение отправляется без ошибок
✅ Нет 403 после выбора
```

#### Сценарий 2: Смена тарифа
```
✅ Пользователь с plan=free
✅ Видит 2 модели в селекторе
✅ Администратор обновляет его на plan=pro
✅ Пользователь обновляет страницу (F5)
✅ Видит теперь 7 моделей
✅ Может выбрать любую
✅ Сообщение отправляется
```

#### Сценарий 3: Безопасность (защитный слой)
```
✅ Пользователь с plan=free
✅ Попробовать отправить сообщение с model='gpt-5.2' (не в плане)
✅ (Через DevTools подменить request)
✅ Backend проверяет через checkSubscription
✅ Возвращает 403 ✅
```

#### Сценарий 4: Кэширование
```
✅ Открыть селектор
✅ Видны модели (1-я загрузка)
✅ Закрыть селектор
✅ Открыть селектор снова
✅ Видны ТЕ ЖЕ модели (кэш 60 секунд)
✅ Ждать >60 секунд
✅ Обновить
✅ Видны свежие модели
```

---

## РАЗДЕЛ 6: ПРОВЕРКА СООТВЕТСТВИЯ ТРЕБОВАНИЯМ

### 6.1 Требования функциональности

| Требование | Статус | Проверка |
|-----------|--------|---------|
| AiModel = Single Source of Truth | ✅ | /api/models/allowed загружает из AiModel |
| Селектор показывает только разрешенные | ✅ | GET /api/models/allowed фильтрует по плану |
| Нет 403 после выбора | ✅ | Только разрешенные модели показаны |
| Backend защита работает | ✅ | checkSubscription проверяет при отправке |
| librechat.yaml не источник UI | ✅ | Селектор использует /api/models/allowed |
| Нет дублирования в UI | ✅ | Один источник (AiModel через API) |

### 6.2 Требования совместимости

| Требование | Статус | Проверка |
|-----------|--------|---------|
| Биллинг не сломан | ✅ | Plan.allowedModels структура не менялась |
| Подписки работают | ✅ | Subscription не менялся |
| Alias resolution работает | ✅ | checkSubscription остался без изменений |
| Тарифы работают | ✅ | Plan.allowedModels валидируется |

### 6.3 Требования качества кода

| Требование | Статус | Проверка |
|-----------|--------|---------|
| Нет console.log | ✅ | Только logger из data-schemas |
| Нет временных костылей | ✅ | Чистая реализация |
| Минимальное дублирование | ✅ | SSOT паттерн |
| Четкая логика | ✅ | Clearly defined flows |

---

## РАЗДЕЛ 7: ВЫПОЛНЕНИЕ ПЛАНА

### 7.1 Последовательность реализации

```
Фаза 1: Backend подготовка
  1. Обновить /api/models/allowed endpoint
  2. Убедиться что возвращает полную информацию из AiModel
  3. Проверить кэширование

Фаза 2: Frontend переключение
  1. Обновить ModelSelectorContext
  2. Добавить запрос на /api/models/allowed
  3. Построить modelSpecs из результата
  4. Протестировать UI

Фаза 3: Валидация
  1. Unit тесты
  2. Integration тесты
  3. Manual тесты
  4. Проверка совместимости

Фаза 4: Cleanup (опционально)
  1. Удалить неиспользуемый код
  2. Оптимизировать если нужно
```

### 7.2 Критерии успешности

✅ **Успех достигнут, когда:**
1. Селектор загружает модели из /api/models/allowed
2. Показывает только разрешенные по плану
3. Нет 403 ошибок после выбора модели
4. Все unit тесты проходят
5. Все integration тесты проходят
6. Manual сценарии работают
7. Биллинг продолжает работать

---

**Статус плана:** ✅ УТВЕРЖДЕН И ГОТОВ К РЕАЛИЗАЦИИ

