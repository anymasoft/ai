# 📐 ПЛАН РЕФАКТОРИНГА: SUBSCRIPTION SSOT АРХИТЕКТУРА

## 1. АНАЛИЗ ТЕКУЩЕЙ АРХИТЕКТУРЫ

### 1.1 Откуда берется план сейчас

```
МЕНЮ АВАТАРКИ (AccountSettings.tsx)
├─ useQuery(['allowedModels', token])
├─ GET /api/models/allowed
├─ Subscription.findOne({ userId }) в backend
├─ Кэш: React-Query staleTime=60s, gcTime=60s
└─ Кэш: HTTP Cache-Control max-age=60

СТРАНИЦА /PRICING (Pricing.tsx)
├─ fetch('/api/balance')
├─ GET /api/balance
├─ Subscription.findOne({ userId }) в backend
├─ Кэш: HTTP Cache (depends on browser)
└─ Кэш: NO explicit invalidation

ADMIN ОБНОВЛЕНИЕ (admin.js:119-150)
├─ PATCH /api/admin/users/:userId/plan
├─ Subscription.findOneAndUpdate({ userId }, { plan, ... })
├─ БД обновлена ✅
└─ Кэши НЕ инвалидированы ❌
```

### 1.2 Текущие API endpoints, возвращающие plan

| Endpoint | Файл | Строки | Возвращает | Кэш |
|----------|------|--------|-----------|-----|
| GET /api/models/allowed | api/server/routes/models.js | 38-86 | { plan, models, ... } | 60s HTTP |
| GET /api/balance | api/server/controllers/Balance.js | 4-42 | { plan, planExpiresAt, ... } | Browser default |
| PATCH /api/admin/users/:userId/plan | api/server/routes/admin.js | 119-150 | { ok: true, plan } | None |

### 1.3 Текущее кэширование

```
BACKEND IN-MEMORY CACHING:
├─ checkSubscription._planCache (TTL: 60s)
│  └─ Путь: api/server/middleware/checkSubscription.js:29-40
│  └─ Инвалидация: invalidatePlanCache() есть, но НЕ вызывается ❌
├─ checkSpecAllowedForPlan._planCache (TTL: 60s)
│  └─ Путь: api/server/middleware/checkSpecAllowedForPlan.js:35-46
│  └─ Инвалидация: invalidatePlanCache() есть, но НЕ вызывается ❌

FRONTEND REACT-QUERY CACHING:
├─ useQuery(['allowedModels', token])
│  └─ staleTime: 60_000ms
│  └─ gcTime: 60_000ms
│  └─ Инвалидация: НЕ вызывается при обновлении плана ❌

HTTP RESPONSE CACHING:
├─ /api/models/allowed: Cache-Control: private, max-age=60
├─ /api/balance: (not set explicitly)
```

### 1.4 Точки рассинхронизации

```
t=0s    АДМИН МЕНЯЕТ ТАРИФ: pro → business
        └─ БД обновлена: Subscription.plan = 'business' ✅

t=5s    ПОЛЬЗОВАТЕЛЬ ОТКРЫВАЕТ МЕНЮ
        └─ React-Query < 60s → возвращает кэш = 'pro' ❌❌❌

t=10s   ПОЛЬЗОВАТЕЛЬ ОТКРЫВАЕТ /PRICING
        └─ fetch('/api/balance') → читает из БД = 'business' ✅

t=65s   ПОЛЬЗОВАТЕЛЬ СНОВА ОТКРЫВАЕТ МЕНЮ
        └─ React-Query > 60s → запрашивает свежие = 'business' ✅

РЕЗУЛЬТАТ: РАССИНХРОНИЗАЦИЯ НА 5-60 СЕКУНД
```

### 1.5 Проблемные места в коде

**Файл:** `api/server/routes/models.js:38-86`
```javascript
// ❌ ПРОБЛЕМА: В этом endpoint смешаны concerns:
// 1. Получение моделей по плану
// 2. Возврат плана в response (ДЛЯ МЕНЮ АВАТАРКИ)
// 3. HTTP кэширование на 60s
```

**Файл:** `api/server/controllers/Balance.js:4-42`
```javascript
// ❌ ПРОБЛЕМА: В этом endpoint смешаны concerns:
// 1. Получение баланса
// 2. Возврат плана в response (ДЛЯ /PRICING)
// 3. Нет явного кэширования
```

**Файл:** `api/server/routes/admin.js:119-150`
```javascript
// ❌ ПРОБЛЕМА: После обновления плана:
// 1. БД обновлена ✅
// 2. Backend _planCache НЕ инвалидирован ❌
// 3. Frontend кэш НЕ инвалидирован ❌
// 4. Результат: рассинхронизация
```

---

## 2. ЦЕЛЕВАЯ АРХИТЕКТУРА (SSOT)

### 2.1 Новый единый API endpoint

```
GET /api/user/subscription
├─ Требует: JWT auth
├─ Возвращает: { planId, planKey, planName, expiresAt, allowedModels, limits }
├─ Кэш: staleTime=0, refetchOnWindowFocus=true
└─ Источник: ТОЛЬКО Subscription.findOne({ userId })
```

### 2.2 Новый поток данных

```
MongoDB Subscription
    ↓
    └─ GET /api/user/subscription (БЕЗ кэша)
        ↓
        ├─→ useSubscription() hook (Frontend)
        │   ├─→ Меню аватарки
        │   ├─→ Страница /pricing
        │   ├─→ ModelSelector (allowedModels)
        │   └─→ Любые бейджи тарифов
        │
        └─→ Backend middleware (checkSubscription, checkSpecAllowedForPlan)
            ├─→ Каждый запрос читает из БД (БЕЗ in-memory cache)
            ├─→ Проверяет expiration
            └─→ Прикрепляет req.subscription к request
```

### 2.3 Изменения backend

**ДО:**
```
GET /api/models/allowed → { plan, models, ... } + Cache-Control: 60s
GET /api/balance → { plan, planExpiresAt, ... }
PATCH /api/admin/users/:userId/plan → БД update (no cache invalidation)
```

**ПОСЛЕ:**
```
GET /api/user/subscription → { planId, planKey, planName, allowedModels, ... } (no cache)
GET /api/models/allowed → { models, ... } (no plan, no cache header)
GET /api/balance → { tokenCredits, ... } (no plan, plan comes from subscription)
PATCH /api/admin/users/:userId/plan → БД update + invalidateQueries(['subscription'])
```

### 2.4 Изменения frontend

**ДО:**
```typescript
const { data: planData } = useQuery(['allowedModels', token])  // ❌ Для плана
const { data: balanceData } = fetch('/api/balance')           // ❌ Для плана
```

**ПОСЛЕ:**
```typescript
const { data: subscription } = useSubscription()              // ✅ ЕДИНЫЙ source
// subscription.planId, subscription.planKey, subscription.allowedModels
```

### 2.5 Удаляемые кэши

```
BACKEND IN-MEMORY:
❌ checkSubscription._planCache
❌ checkSpecAllowedForPlan._planCache
❌ Все TTL кэширование планов

FRONTEND REACT-QUERY:
❌ useQuery(['allowedModels', token]) для плана
✅ useQuery(['subscription']) ← ТОЛЬКО ЭТО

HTTP:
❌ Cache-Control: private, max-age=60 в /api/models/allowed
✅ NO caching в /api/user/subscription
```

---

## 3. СПИСОК ИЗМЕНЕНИЙ ПО ФАЙЛАМ

### 3.1 Новые файлы

| Файл | Описание |
|------|---------|
| `api/server/routes/subscription.js` | Новый маршрут для GET /api/user/subscription |
| `api/server/controllers/SubscriptionController.js` | Контроллер для subscription endpoint |
| `client/src/hooks/useSubscription.ts` | React hook для получения subscription |

### 3.2 Изменяемые файлы (BACKEND)

| Файл | Изменения |
|------|-----------|
| `api/server/routes/index.js` | Добавить маршрут `/subscription` |
| `api/server/routes/models.js` | Удалить возврат `plan` из ответа, удалить Cache-Control header |
| `api/server/controllers/Balance.js` | Удалить возврат `plan` из ответа |
| `api/server/routes/admin.js` | Добавить `queryClient.invalidateQueries(['subscription'])` после update |
| `api/server/middleware/checkSubscription.js` | Удалить `_planCache`, удалить TTL кэширование |
| `api/server/middleware/checkSpecAllowedForPlan.js` | Удалить `_planCache`, удалить TTL кэширование |

### 3.3 Изменяемые файлы (FRONTEND)

| Файл | Изменения |
|------|-----------|
| `client/src/components/Nav/AccountSettings.tsx` | Заменить `useQuery(['allowedModels'])` на `useSubscription()` |
| `client/src/routes/Pricing.tsx` | Заменить `fetch('/api/balance')` на `useSubscription()` |
| `client/src/components/Chat/Menus/Endpoints/ModelSelectorContext.tsx` | Заменить получение моделей с берутся из `subscription.allowedModels` |

### 3.4 Удаляемые файлы

Нет файлов полностью удаляется, только функциональность вырезается.

---

## 4. МИГРАЦИОННАЯ СТРАТЕГИЯ (БЕЗ ДАУНТАЙМА)

### 4.1 Фаза 1: Создание нового endpoint (BACKWARD COMPATIBLE)

```
1. Создать GET /api/user/subscription
   └─ Работает параллельно со старыми endpoints
   └─ Старые endpoints ПРОДОЛЖАЮТ работать
2. Frontend может выбирать где брать plan
3. Нет breaking changes
```

### 4.2 Фаза 2: Миграция frontend на новый hook

```
1. Создать useSubscription() hook
2. Постепенно мигрировать компоненты:
   ├─ AccountSettings.tsx
   ├─ Pricing.tsx
   ├─ ModelSelectorContext.tsx
3. Старые компоненты могут использовать старые endpoints
4. Нет breaking changes
```

### 4.3 Фаза 3: Очистка backend

```
1. Когда все UI перешли на новый hook:
   ├─ Удалить plan возврат из /api/models/allowed
   ├─ Удалить plan возврат из /api/balance
   ├─ Удалить in-memory cache
2. ВАЖНО: Это безопасно, потому что только новый hook их используетет
```

### 4.4 Гарантии безопасности

```
✅ БД НЕ меняется
✅ Подписка НЕ теряется
✅ Биллинг НЕ ломается
✅ Авторизация НЕ меняется
✅ allowedModels структура НЕ меняется
✅ Middleware проверки продолжают работать
```

---

## 5. ПЛАН ТЕСТИРОВАНИЯ

### 5.1 Unit тесты

```
Тест 1: GET /api/user/subscription возвращает правильный план
  ├─ Mock: Subscription.findOne({ userId: '123' })
  ├─ Assert: response.planId === 'pro'
  └─ Assert: response.allowedModels === ['gpt-4o', ...]

Тест 2: Истёкший план автоматически становится 'free'
  ├─ Mock: Subscription с planExpiresAt < now
  ├─ Assert: response.planId === 'free'
  └─ Assert: response.allowedModels === ['gpt-4o-mini', ...]

Тест 3: useSubscription hook правильно fetches
  ├─ Mock: fetch GET /api/user/subscription
  ├─ Assert: subscription.planId === 'pro'
  └─ Assert: subscription.allowedModels.length > 0
```

### 5.2 Integration тесты

```
Тест 1: Админ обновляет тариф → frontend видит обновление
  ├─ Setup: User на плане 'pro'
  ├─ Action: PATCH /api/admin/users/:userId/plan { plan: 'business' }
  ├─ Assert: GET /api/user/subscription возвращает 'business'
  └─ Assert: React-Query инвалидирован, новые данные в кэше

Тест 2: ModelSelector показывает правильные модели
  ├─ Setup: User на плане 'free'
  ├─ Assert: Показывает только бесплатные модели
  ├─ Action: Админ меняет на 'pro'
  ├─ Assert: Сразу показывает pro модели (без 60s задержки)

Тест 3: Меню и /pricing показывают ОДИНАКОВЫЙ тариф
  ├─ Setup: Открыть меню + /pricing одновременно
  ├─ Action: Администратор меняет план
  ├─ Assert: Оба места сразу показывают новый план
  └─ Assert: Нет рассинхронизации
```

### 5.3 Manual сценарии

```
СЦЕНАРИЙ 1: Изменение тарифа в админке
  1. Открыть админку
  2. Найти пользователя
  3. Нажать "Изменить тариф" → выбрать "Business"
  4. ✅ Меню аватарки СРАЗУ показывает "Business"
  5. ✅ /pricing СРАЗУ показывает "Business"
  6. ✅ ModelSelector СРАЗУ показывает business модели

СЦЕНАРИЙ 2: Открыть несколько вкладок
  1. Открыть вкладку 1: меню аватарки
  2. Открыть вкладку 2: /pricing
  3. В админке: изменить тариф
  4. ✅ Обе вкладки показывают новый тариф (без F5)
  5. ✅ Нет 60s задержки ни на одной вкладке

СЦЕНАРИЙ 3: ModelSelector отражает изменения
  1. Пользователь на "Free"
  2. Открыть ModelSelector
  3. ✅ Показывает только free модели
  4. Админ меняет на "Pro"
  5. ✅ ModelSelector СРАЗУ показывает pro модели
  6. ✅ Нет перезагрузки страницы

СЦЕНАРИЙ 4: Истечение тарифа
  1. User на плане "Pro" с expiration date = TODAY
  2. Сделать запрос к /api/user/subscription
  3. ✅ Возвращает planId = 'free' (автоматическое понижение)
  4. ✅ allowedModels = free models

СЦЕНАРИЙ 5: Middleware проверки работают правильно
  1. User на плане "Pro"
  2. Попытка использовать модель из "Business"
  3. ✅ Middleware отклоняет с 403
  4. Администратор меняет на "Business"
  5. ✅ Та же модель СРАЗУ становится доступной
```

---

## 6. РЕАЛИЗАЦИЯ (ЭТАПЫ)

### ЭТАП 1: Backend (/api/user/subscription)
- [ ] Создать SubscriptionController.js
- [ ] Создать routes/subscription.js
- [ ] Добавить в index.js

### ЭТАП 2: Удалить in-memory кэш
- [ ] Удалить _planCache из checkSubscription.js
- [ ] Удалить _planCache из checkSpecAllowedForPlan.js
- [ ] Добавить прямой Subscription.findOne() в middleware

### ЭТАП 3: Frontend hook
- [ ] Создать useSubscription.ts
- [ ] Добавить в hooks/index.ts

### ЭТАП 4: Миграция компонентов
- [ ] AccountSettings.tsx
- [ ] Pricing.tsx
- [ ] ModelSelectorContext.tsx

### ЭТАП 5: Очистка старых endpoints
- [ ] Удалить plan возврат из /api/models/allowed
- [ ] Удалить plan возврат из /api/balance
- [ ] Удалить Cache-Control header

### ЭТАП 6: Тестирование
- [ ] Manual сценарии
- [ ] Проверка отсутствия рассинхронизации

---

## 7. ЧЕКЛИСТ ОКОНЧАНИЯ

- [ ] GET /api/user/subscription работает
- [ ] useSubscription hook работает
- [ ] Меню и /pricing показывают одинаковый тариф
- [ ] Нет 60s задержки
- [ ] PATCH обновляет оба места сразу
- [ ] ModelSelector показывает правильные модели
- [ ] Middleware проверки работают
- [ ] Нет ломки биллинга
- [ ] Нет ломки allowedModels
- [ ] Все компоненты используют единый источник

