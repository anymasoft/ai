# Техническая документация: anymasoft/ai (LibreChat + монетизация)

> Версия LibreChat: v0.8.3-rc1
> Дата: 2026-02

---

## Содержание

1. [Общая архитектура](#1-общая-архитектура)
2. [Система моделей](#2-система-моделей)
3. [Система тарифов](#3-система-тарифов)
4. [Система токенов](#4-система-токенов)
5. [Платежи (ЮKassa)](#5-платежи-юkassa)
6. [Админ-панель](#6-админ-панель)
7. [API эндпоинты](#7-api-эндпоинты)
8. [Важные принципы](#8-важные-принципы)
9. [Схема данных](#9-схема-данных)
10. [Сценарии поведения](#10-сценарии-поведения)

---

## 1. Общая архитектура

### Backend

| Компонент | Технология |
|-----------|-----------|
| Runtime | Node.js (поддерживается также Bun) |
| Framework | Express.js |
| Аутентификация | Passport.js, JWT (Bearer-токен в заголовке `Authorization`) |
| ODM | Mongoose |
| Логирование | `@librechat/data-schemas` logger |
| HTTP-клиент | axios (для ЮKassa API) |
| Сжатие | compression middleware |

### Frontend

| Компонент | Технология |
|-----------|-----------|
| Framework | React 18 + TypeScript |
| Сборка | Vite |
| Роутинг | React Router v6 (`createBrowserRouter`) |
| State | Recoil + React Query (`@tanstack/react-query`) |
| UI-компоненты | `@librechat/client` (OGDialog, Button, Spinner и др.) |
| HTTP | `fetch` API с Bearer-токеном |

### База данных

**MongoDB** — единственная БД. Схема через Mongoose.

Соединение: `MONGO_URI=mongodb://127.0.0.1:27017/LibreChat`

### Redis

Опциональный. Используется для:
- Кэширования стримов LLM (`USE_REDIS_STREAMS`)
- Кэша OAuth-обмена (`CacheKeys.ADMIN_OAUTH_EXCHANGE`)

Без Redis приложение работает полностью.

### Структура проекта

```
/
├── api/                        # Backend (Node.js/Express)
│   ├── server/
│   │   ├── index.js            # Точка входа, монтирование роутеров
│   │   ├── routes/
│   │   │   ├── admin.js        # /api/admin/mvp — управление моделями/планами/пользователями
│   │   │   ├── payment.js      # /api/payment — ЮKassa интеграция
│   │   │   ├── models.js       # /api/models — каталог моделей
│   │   │   ├── balance.js      # /api/balance — баланс токенов
│   │   │   └── admin/auth.js   # /api/admin — аутентификация в либрочат-админку
│   │   ├── middleware/
│   │   │   └── checkSubscription.js  # Middleware: lazy expiry + проверка allowedModels
│   │   └── controllers/
│   │       └── Balance.js      # Возвращает баланс + план (с lazy expiry)
│   ├── models/                 # Mongoose-схемы (LibreChat core)
│   ├── db/
│   │   └── models.js           # Реэкспорт всех Mongoose-моделей
│   └── models/                 # Кастомные схемы монетизации
│       ├── AiModel.js          # Каталог AI-моделей
│       ├── Plan.js             # Тарифные планы
│       ├── Subscription.js     # Подписки пользователей
│       ├── Payment.js          # История платежей
│       └── TokenPackage.js     # Пакеты токенов
├── client/                     # Frontend (React/TypeScript)
│   └── src/
│       ├── routes/
│       │   ├── AdminPanel.tsx  # /admin — управление
│       │   ├── Pricing.tsx     # /pricing — страница тарифов
│       │   └── Billing.tsx     # /billing — история платежей
│       └── components/Chat/Menus/Endpoints/
│           └── ModelSelectorContext.tsx  # Загрузка и фильтрация моделей для UI
├── librechat.yaml              # Конфигурация LibreChat (modelSpecs, endpoints, interface)
└── .env                        # Секреты (API-ключи, MONGO_URI, YOOKASSA_*)
```

### Переменные окружения (ключевые)

```env
MONGO_URI=mongodb://127.0.0.1:27017/LibreChat
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
DEEPSEEK_API_KEY=...
YOOKASSA_SHOP_ID=...
YOOKASSA_API_KEY=...
YOOKASSA_RETURN_URL=https://example.com/pricing?payment=success
DOMAIN_CLIENT=https://example.com
```

---

## 2. Система моделей

### Коллекция `AiModel`

Файл: `api/models/AiModel.js`

**Единственный источник истины** для списка доступных моделей. Plans ссылаются на `modelId` из этой коллекции.

#### Поля схемы

| Поле | Тип | Описание |
|------|-----|----------|
| `modelId` | String | Уникальный идентификатор модели (PK). Используется в API-запросах к провайдеру. Индекс, `unique: true` |
| `provider` | String | Провайдер: `'openai'`, `'anthropic'`, `'deepseek'` |
| `endpointKey` | String | Имя LibreChat-эндпоинта: `'openAI'`, `'anthropic'`, `'deepseek'` (кастомный) |
| `displayName` | String | Название для UI |
| `isActive` | Boolean | `true` — видна пользователям и в планах. `false` — каскадно удаляется из Plans |

#### Дефолтные записи (seedDefaults)

`seedDefaults()` идемпотентен (`$setOnInsert`). Не перезаписывает существующие.
**Важно**: `seedDefaults()` не вызывается в `GET /api/admin/mvp/models` — только в пользовательских эндпоинтах.

| modelId | provider | endpointKey | displayName |
|---------|----------|-------------|-------------|
| `gpt-4.1-mini` | openai | openAI | GPT-4.1 Mini |
| `gpt-5.2` | openai | openAI | GPT-5.2 |
| `claude-4-6-sonnet` | anthropic | anthropic | Claude 4.6 Sonnet |
| `claude-4-6-opus` | anthropic | anthropic | Claude 4.6 Opus |
| `deepseek-chat` | deepseek | deepseek | DeepSeek V3 |
| `deepseek-reasoner` | deepseek | deepseek | DeepSeek R2 |

### Загрузка моделей: GET /api/models/all

- **Аутентификация**: публичный (без токена)
- **Назначение**: страница `/pricing` — список всех активных моделей
- **Поведение**: вызывает `AiModel.seedDefaults()`, затем возвращает все записи с `isActive: true`
- **Ответ**: `{ models: [{ modelId, provider, endpointKey, displayName }] }`

### Загрузка моделей: GET /api/models/allowed

- **Аутентификация**: `requireJwtAuth` (Bearer-токен обязателен)
- **Назначение**: `ModelSelectorContext` — список моделей для текущего пользователя
- **Поведение**:
  1. Находит `Subscription` пользователя → определяет `plan`
  2. Lazy expiry: если подписка истекла — `plan = 'free'`
  3. `Plan.seedDefaults()` + `AiModel.seedDefaults()`
  4. Ищет план в `Plan`, берёт `allowedModels`
  5. Если `allowedModels.length > 0` → фильтр по `$in`. Если `[]` → все активные модели
  6. Кэш: `Cache-Control: private, max-age=60`
- **Ответ**: `{ models: [...], plan: 'free'|'pro'|'business' }`

### ModelSelector в UI

Файл: `client/src/components/Chat/Menus/Endpoints/ModelSelectorContext.tsx`

**Порядок работы**:

1. `useQuery(['allowedModels', token])` → `GET /api/models/allowed` с `Authorization: Bearer <token>`
2. Пока запрос выполняется → показываются YAML-спеки (fallback из `startupConfig`)
3. При ошибке → fallback на YAML-спеки
4. При успехе (`allowedModelsData` и `endpointsConfig` оба загружены):
   - **Фильтр**: из результата API оставляются только модели, чей `endpointKey` есть в `endpointsConfig` (т.е. реально настроен на сервере)
   - Каждая модель превращается в синтетический `TModelSpec`: `{ name: modelId, label: displayName, iconURL, preset: { endpoint: endpointKey, model: modelId } }`
   - `mappedEndpoints` обнуляется — стандартный список LibreChat-эндпоинтов скрывается
5. `handleSelectSpec(spec)` → `onSelectSpec(spec)` → `newConversation({ template, preset })`

**Иконки**:
- Встроенные эндпоинты (`openAI`, `anthropic`, `google`, ...): `iconURL = endpointKey` → соответствующая иконка из `icons` map
- Кастомные эндпоинты (`deepseek` и др.): `iconURL = 'custom'` → `CustomMinimalIcon`

### Middleware проверки allowedModels

Файл: `api/server/middleware/checkSubscription.js`

Вызывается на каждый чат-запрос.

```
checkSubscription(req, res, next):
  1. userId из req.user
  2. Subscription.findOne({ userId }) → plan, planExpiresAt
  3. Lazy expiry: если истекла → понижаем в БД до free
  4. req.subscription = { plan, planExpiresAt }
  5. modelName = req.body.model || req.body.endpointOption.model || ...
  6. getPlans() → кэш 60 сек → planConfig
  7. isModelAllowed(planConfig, modelName): allowed.includes(modelName)  ← EXACT match
  8. Если не разрешено → 403 { error, code: 'MODEL_NOT_ALLOWED' }
```

**Кэш планов**: in-memory, TTL 60 сек. Инвалидируется через `invalidatePlanCache()` после изменений через admin-API.

**Exact matching**: никакого substring-matching, regex или wildcard. Только `Array.prototype.includes()`.

---

## 3. Система тарифов

### Коллекция `Plan`

Файл: `api/models/Plan.js`

#### Поля схемы

| Поле | Тип | Описание |
|------|-----|----------|
| `planId` | String | `'free'` \| `'pro'` \| `'business'`. Уникальный, индекс |
| `label` | String | Название для UI (`'Free'`, `'Pro'`, `'Business'`) |
| `priceRub` | Number | Цена в рублях/месяц. `free = 0` |
| `tokenCreditsOnPurchase` | Number | Токены, начисляемые при покупке |
| `durationDays` | Number\|null | Длительность подписки в днях. `null` = бессрочно (free) |
| `allowedModels` | [String] | Массив `modelId` из AiModel. `[]` = все модели разрешены |
| `isActive` | Boolean | Неактивный план недоступен для покупки |

#### Текущая сегментация (seed-defaults)

| Plan | priceRub | tokenCreditsOnPurchase | durationDays | allowedModels |
|------|----------|----------------------|--------------|---------------|
| free | 0 | 0 | null | `['gpt-4.1-mini']` |
| pro | 3 990 | 5 000 000 | 30 | `['gpt-4.1-mini', 'claude-4-6-sonnet', 'deepseek-chat']` |
| business | 9 990 | 12 000 000 | 30 | `['gpt-4.1-mini', 'gpt-5.2', 'claude-4-6-sonnet', 'claude-4-6-opus', 'deepseek-chat', 'deepseek-reasoner']` |

> `seedDefaults()` идемпотентен (`$setOnInsert`). Не перезаписывает изменения, сделанные через admin-панель.

### Коллекция `Subscription`

Файл: `api/models/Subscription.js`

| Поле | Тип | Описание |
|------|-----|----------|
| `userId` | ObjectId | ref: User. Уникальный, индекс |
| `plan` | String | `'free'` \| `'pro'` \| `'business'`. Default: `'free'` |
| `planStartedAt` | Date\|null | Дата начала текущей подписки |
| `planExpiresAt` | Date\|null | Дата истечения. `null` = бессрочно (free) |

Если запись в коллекции отсутствует — пользователь считается на плане `free`.

### Логика подписки

#### Продление подписки (`upsertSubscription` в `payment.js`)

```
upsertSubscription(userId, planId, durationDays):
  existing = Subscription.findOne({ userId })

  if existing.plan == planId AND existing.planExpiresAt > now:
    baseDate = existing.planExpiresAt  // продление от текущей даты истечения
  else:
    baseDate = now                     // новая подписка или апгрейд

  planExpiresAt = baseDate + durationDays
  Subscription.findOneAndUpdate({ userId }, { plan, planStartedAt: now, planExpiresAt }, { upsert: true })
```

**Продление**: если пользователь покупает тот же план повторно и подписка ещё активна — срок складывается (добавляется к текущей дате истечения).

**Апгрейд**: если покупается другой план (или текущий истёк) — `baseDate = now`. Предыдущие дни не компенсируются.

#### Lazy expiry

Истечение подписки обрабатывается **лениво** — в момент запроса, без cron.
Срабатывает в двух местах:

1. **`checkSubscription.js`** — при каждом чат-запросе
2. **`Balance.js` (GET /api/balance)** — при загрузке баланса

Логика:
```
if plan != 'free' AND planExpiresAt < now:
  Subscription.update({ plan: 'free', planExpiresAt: null, planStartedAt: null })
  plan = 'free'
```

**Токены при истечении не сгорают.** Только план понижается до `free`.

---

## 4. Система токенов

### Что такое tokenCredits

`tokenCredits` — внутренняя валюта. Хранится в коллекции `Balance` (LibreChat core).

**Курс**: `1 tokenCredit = $0.000001`
То есть `1 000 000 TC ≈ $1.00`

### Списание токенов

Происходит автоматически после каждого ответа модели через LibreChat core.

**Вызов цепочки**:
1. LLM возвращает ответ с `usage: { promptTokens, completionTokens }`
2. `spendTokens(txData, tokenUsage)` → `createTransaction()`
3. `createTransaction()` вызывает `updateBalance()` — оптимистичный concurrency control, до 10 retry

**Расчёт стоимости**: в `tx.js` хранится таблица множителей `tokenValues` по именам моделей. Используется substring-matching (`modelName.includes(key)`). Каждая единица токена умножается на multiplier. Пример: `gpt-4o-mini` input: 0.15, output: 0.60 (cents per 1M tokens).

**Баланс не уходит в минус**: `Math.max(0, currentCredits + increment)`.

### Стартовый баланс

При регистрации: `startBalance: 15000 TC` (≈ $0.015, ~25 сообщений GPT-4o-mini).
Задаётся в `librechat.yaml`:
```yaml
balance:
  enabled: true
  startBalance: 15000
  autoRefillEnabled: false
```

### Что происходит при нуле баланса

LibreChat core блокирует отправку сообщений при `tokenCredits <= 0`. Пользователь видит сообщение о необходимости пополнения.

### Пакеты токенов (TokenPackage)

Разовая докупка. **Не меняет plan и planExpiresAt**. Только пополняет баланс.

| packageId | label | priceRub | tokenCredits |
|-----------|-------|----------|--------------|
| `token_pack` | Пакет токенов | 990 | 3 000 000 |

---

## 5. Платежи (ЮKassa)

### Коллекция `Payment`

Файл: `api/models/Payment.js`

| Поле | Тип | Описание |
|------|-----|----------|
| `externalPaymentId` | String | ID платежа в ЮKassa. Уникальный, индекс |
| `userId` | ObjectId | ref: User. Индекс |
| `packageId` | String | `'pro'`, `'business'` или `'token_pack'` |
| `type` | String | `'subscription'` — меняет план; `'token_pack'` — только токены |
| `planPurchased` | String\|null | Для `type=subscription`: `'pro'` или `'business'` |
| `tokenCredits` | Number | Количество токенов к зачислению |
| `amount` | String | Сумма в виде строки: `'3990.00'` |
| `status` | String | `'pending'` \| `'succeeded'` \| `'failed'` |
| `expiresAt` | Date\|null | Дата истечения подписки (заполняется при succeeded) |

### Процесс создания платежа

```
POST /api/payment/create { packageId }

1. Определяем тип: TokenPackage.findOne({ packageId }) → token_pack
                  или Plan.findOne({ planId: packageId }) → subscription
2. Создаём платёж в ЮKassa (axios POST)
3. Payment.findOneAndUpdate({ upsert: true }, { status: 'pending', ... })
4. Возвращаем { paymentId, confirmationUrl }
5. Пользователь редиректится на confirmationUrl (страница ЮKassa)
6. После оплаты — редирект на YOOKASSA_RETURN_URL (?payment=success)
```

### Обработка успешного платежа (`applySuccessfulPayment`)

```
applySuccessfulPayment(externalPaymentId):
  1. Payment.findOne({ externalPaymentId })
  2. Если status=succeeded → return { ok: true, alreadyDone: true }  // идемпотентность
  3. Если не pending → error
  4. Balance.$inc({ tokenCredits: +creditsNum })
  5. Если type=subscription && planPurchased:
       upsertSubscription(userId, planPurchased, plan.durationDays)
  6. Payment.update({ status: 'succeeded', expiresAt })
```

### Webhook vs Polling

| Среда | Механизм |
|-------|---------|
| PROD / staging | `POST /api/payment/webhook` (ЮKassa отправляет сама) |
| localhost / dev | `GET /api/payment/check` (frontend вызывает после редиректа `?payment=success`) |

**Webhook**: ЮKassa POST → `res.sendStatus(200)` сразу (ответ не ждёт обработки) → `applySuccessfulPayment()`

**Polling (`/api/payment/check`)**:
1. Ищет `pending` платёж пользователя
2. Если нет — ищет недавно `succeeded` (последние 30 мин)
3. Если есть pending — запрашивает статус у ЮKassa API
4. При `succeeded` — вызывает `applySuccessfulPayment()`

### Идемпотентность

- Дублирование вебхука безопасно: `applySuccessfulPayment` проверяет `status === 'succeeded'` и возвращает `alreadyDone: true`
- При создании платежа: `Idempotence-Key: ${userId}-${packageId}-${Date.now()}` (уникален для каждого клика)
- `Payment.findOneAndUpdate({ upsert: true })` — запись не дублируется

### Ручная сверка (admin reconcile)

`POST /api/admin/mvp/payments/:paymentId/reconcile` — запрашивает статус платежа в ЮKassa и вручную зачисляет токены. Используется при потере вебхука (тестовые среды).

---

## 6. Админ-панель

Файл: `client/src/routes/AdminPanel.tsx`
API: `api/server/routes/admin.js` (монтируется как `/api/admin/mvp`)

Доступ: только пользователи с `role === 'ADMIN'` (проверка `requireAdminRole` на каждом маршруте + на клиенте).

### Вкладка Users

**Данные**: `GET /api/admin/users` — пагинированный список пользователей с балансами и планами.

**Операции**:

| Действие | Endpoint |
|----------|----------|
| Изменить роль | `PATCH /api/admin/users/:userId/role` |
| Изменить план | `PATCH /api/admin/users/:userId/plan` |
| Изменить баланс | `POST /api/admin/users/:userId/balance` |

`PATCH /api/admin/users/:userId/plan { plan, durationDays? }` — немедленно устанавливает новый план в `Subscription`, не создаёт запись `Payment`.

### Вкладка Payments

**Данные**: `GET /api/admin/payments` — список всех платежей (до 500), с фильтрами по email и дате.
**Ручная сверка**: `POST /api/admin/payments/:paymentId/reconcile`

### Вкладка Settings

Три секции:

#### Управление Models (каталог AiModel)

| Действие | Endpoint | Особенности |
|----------|----------|-------------|
| Список | `GET /api/admin/mvp/models` | Без seedDefaults — только что в БД |
| Создать | `POST /api/admin/mvp/models` | Валидация обязательных полей. Конфликт 409 если modelId дублируется |
| Обновить | `PATCH /api/admin/mvp/models/:modelId` | Если `isActive=false` → каскадно удаляет из всех Plans + invalidatePlanCache |
| Удалить | `DELETE /api/admin/mvp/models/:modelId` | Каскадно удаляет из Plans (`$pull`) + invalidatePlanCache |

**Влияние на UI**: После удаления/деактивации модели кэш планов в `checkSubscription` инвалидируется немедленно. Клиентский кэш `allowedModels` (React Query) обновится через ≤60 сек.

#### Управление Plans (тарифы)

| Действие | Endpoint |
|----------|----------|
| Список | `GET /api/admin/mvp/plans` (включает TokenPackages) |
| Обновить | `PATCH /api/admin/mvp/plans/:planId` |

Обновляемые поля: `priceRub`, `tokenCreditsOnPurchase`, `allowedModels`, `isActive`.

**Ограничения**:
- `free` нельзя деактивировать
- `free`: `priceRub` должен быть 0, `allowedModels` должен содержать хотя бы 1 модель
- Платные планы: `priceRub >= 100`
- Все modelId в `allowedModels` должны существовать в коллекции AiModel (валидация)
- После обновления: `invalidatePlanCache()` → middleware применяет изменения немедленно

#### Управление TokenPackages (пакеты токенов)

`PATCH /api/admin/mvp/token-packages/:packageId { priceRub?, tokenCredits?, isActive? }`

### Что обновляется динамически

| Изменение в admin | Когда применяется |
|-------------------|-------------------|
| allowedModels в Plan | Немедленно (invalidatePlanCache) |
| Деактивация модели | Немедленно в middleware; UI — до 60 сек |
| Цена плана | Немедленно на странице /pricing (React Query нет кэша) |
| isActive модели/плана | Немедленно |

---

## 7. API эндпоинты

### Публичные (без авторизации)

| Метод | URL | Описание |
|-------|-----|----------|
| GET | `/api/models/all` | Все активные модели из AiModel. Используется страницей /pricing |
| GET | `/api/payment/plans` | Активные тарифы и пакеты токенов. Используется страницей /pricing |
| POST | `/api/payment/webhook` | Вебхук ЮKassa (проверяет только `type: notification`) |

### Пользовательские (requireJwtAuth)

| Метод | URL | Описание |
|-------|-----|----------|
| GET | `/api/models/allowed` | Модели, разрешённые по плану пользователя. `Cache-Control: private, max-age=60` |
| GET | `/api/models/` | LibreChat standard — список моделей по эндпоинтам |
| GET | `/api/balance` | Баланс токенов + план + даты подписки |
| POST | `/api/payment/create` | Создать платёж ЮKassa. Body: `{ packageId }` |
| GET | `/api/payment/check` | Проверить статус последнего pending-платежа (для localhost) |
| GET | `/api/payment/history` | История платежей пользователя |

### Административные (requireJwtAuth + requireAdminRole)

#### Пользователи

| Метод | URL | Описание |
|-------|-----|----------|
| GET | `/api/admin/users` | Список пользователей (пагинация: `?page=&limit=`) |
| PATCH | `/api/admin/users/:id/role` | Изменить роль (`ADMIN` или `USER`) |
| PATCH | `/api/admin/users/:id/plan` | Установить план (`{ plan, durationDays? }`) |
| POST | `/api/admin/users/:id/balance` | Изменить баланс (`{ credits: +/- }`) |

#### Платежи

| Метод | URL | Описание |
|-------|-----|----------|
| GET | `/api/admin/payments` | Список платежей (`?email=&from=&to=`) |
| POST | `/api/admin/payments/:paymentId/reconcile` | Ручная сверка с ЮKassa |

#### Тарифы и модели

| Метод | URL | Описание |
|-------|-----|----------|
| GET | `/api/admin/mvp/plans` | Все планы + пакеты токенов |
| PATCH | `/api/admin/mvp/plans/:planId` | Обновить план |
| PATCH | `/api/admin/mvp/token-packages/:packageId` | Обновить пакет токенов |
| GET | `/api/admin/mvp/models` | Все модели (активные и неактивные) |
| POST | `/api/admin/mvp/models` | Создать модель |
| PATCH | `/api/admin/mvp/models/:modelId` | Обновить модель |
| DELETE | `/api/admin/mvp/models/:modelId` | Удалить модель (каскадно из Plans) |

---

## 8. Важные принципы

### Exact matching для modelId

В `checkSubscription.js` и повсюду используется `allowed.includes(modelName)` — строгое совпадение полного `modelId`. Никакого substring-matching, regex, wildcard или case-insensitive matching.

```js
// Правильно: exact match
allowed.includes('gpt-4.1-mini')  // true только для 'gpt-4.1-mini'

// Неверно (не используется):
allowed.some(p => modelName.includes(p))  // substring — ЗАПРЕЩЕНО
```

### Нет хардкода моделей в UI

В UI нет ни одного захардкоженного списка моделей. Все модели приходят из:
- `GET /api/models/allowed` → `ModelSelectorContext.tsx` (чат)
- `GET /api/models/all` → `Pricing.tsx` (страница тарифов)
- `GET /api/admin/mvp/models` → `AdminPanel.tsx` (управление)

### Plans + AiModel — единственный источник истины

- `Plan.allowedModels` содержит массив `modelId` из `AiModel`
- `AiModel` определяет что реально существует
- `checkSubscription` читает Plans из кэша, не из UI
- Любое изменение через admin-API немедленно применяется через `invalidatePlanCache()`

### ModelSelector показывает только реально доступные модели

В `ModelSelectorContext` применяется двойная фильтрация:
1. `/api/models/allowed` возвращает только разрешённые по плану
2. Frontend дополнительно фильтрует: `endpointsConfig[m.endpointKey] != null` — только те, чей LibreChat-эндпоинт реально настроен на сервере (есть API-ключ)

Это предотвращает ситуацию, когда пользователь видит модель, но при отправке сообщения разговор не переключается (endpointKey не найден в endpointsConfig → LibreChat падает на дефолтный эндпоинт).

### Каскадное удаление

При `DELETE /api/admin/mvp/models/:modelId` или `PATCH isActive=false`:
```
Plan.updateMany({ allowedModels: modelId }, { $pull: { allowedModels: modelId } })
```
Модель немедленно пропадает из всех тарифных планов.

---

## 9. Схема данных

### AiModel

```
Collection: aimodels
Index: modelId (unique)

Field         Type      Required  Default
modelId       String    yes       —        (PK, indexed)
provider      String    yes       —        ('openai'|'anthropic'|'deepseek'|...)
endpointKey   String    yes       —        ('openAI'|'anthropic'|'deepseek'|...)
displayName   String    yes       —
isActive      Boolean   no        true
createdAt     Date      auto
updatedAt     Date      auto
```

### Plan

```
Collection: plans
Index: planId (unique)

Field                   Type      Required  Default
planId                  String    yes       —        enum: free|pro|business
label                   String    yes       —
priceRub                Number    yes       0
tokenCreditsOnPurchase  Number    yes       0
durationDays            Number    no        null
allowedModels           [String]  no        []       (массив modelId)
isActive                Boolean   no        true
createdAt               Date      auto
updatedAt               Date      auto
```

### Subscription

```
Collection: subscriptions
Index: userId (unique), planExpiresAt

Field         Type      Required  Default
userId        ObjectId  yes       —        ref: User, indexed
plan          String    no        'free'   enum: free|pro|business
planStartedAt Date      no        null
planExpiresAt Date      no        null     indexed
createdAt     Date      auto
updatedAt     Date      auto
```

Если записи нет — пользователь на `free`.

### Payment

```
Collection: payments
Index: externalPaymentId (unique), userId

Field             Type      Required  Default
externalPaymentId String    yes       —        (ЮKassa paymentId)
userId            ObjectId  yes       —        ref: User
packageId         String    yes       —        planId или 'token_pack'
type              String    no        subscription  enum: subscription|token_pack
planPurchased     String    no        null
tokenCredits      Number    yes       —
amount            String    no        ''       ('3990.00')
status            String    no        succeeded  enum: pending|succeeded|failed
expiresAt         Date      no        null
createdAt         Date      auto
updatedAt         Date      auto
```

### TokenPackage

```
Collection: tokenpackages
Index: packageId (unique)

Field         Type    Required  Default
packageId     String  yes       —
label         String  yes       —
priceRub      Number  yes       —
tokenCredits  Number  yes       —
isActive      Boolean no        true
```

### Balance (LibreChat core)

```
Collection: balances
Index: user (unique)

Field         Type      Description
user          ObjectId  ref: User
tokenCredits  Number    Текущий баланс токенов (≥ 0)
```

### User (LibreChat core)

```
Collection: users

Ключевые поля:
_id      ObjectId
email    String (unique)
name     String
role     String  'USER'|'ADMIN'
```

---

## 10. Сценарии поведения

### Регистрация пользователя

1. Пользователь регистрируется через `/api/auth/register`
2. LibreChat создаёт запись `User`
3. LibreChat начисляет `startBalance: 15000 TC` на счёт (коллекция `Balance`)
4. Запись `Subscription` не создаётся → план = `free`
5. При первом GET `/api/models/allowed`: `seedDefaults()` создаёт Plans, AiModel если не было

### Покупка Pro

1. Пользователь на `/pricing` нажимает «Купить Pro»
2. `POST /api/payment/create { packageId: 'pro' }`
3. Сервер создаёт платёж в ЮKassa, сохраняет `Payment { status: pending }`
4. Пользователь переходит на страницу ЮKassa, оплачивает
5. ЮKassa редиректит на `YOOKASSA_RETURN_URL?payment=success`

   **PROD**: ЮKassa параллельно POST `/api/payment/webhook`:
   - `applySuccessfulPayment()` → `Balance += 5_000_000 TC`
   - `upsertSubscription(userId, 'pro', 30)` → `planExpiresAt = now + 30 дней`
   - `Payment.status = 'succeeded'`

   **DEV/localhost**: frontend вызывает `GET /api/payment/check`:
   - Находит `pending` платёж → запрашивает статус у ЮKassa
   - При `succeeded` → `applySuccessfulPayment()`

6. Страница обновляет баланс и план

### Апгрейд с Pro до Business

1. Пользователь с активным Pro покупает Business
2. `upsertSubscription(userId, 'business', 30)`:
   - `existing.plan = 'pro'` ≠ `'business'` → `baseDate = now`
   - `planExpiresAt = now + 30 дней`
   - Остаток дней Pro не компенсируется
3. `Balance += 12_000_000 TC`
4. `checkSubscription` начинает разрешать Business-модели

### Повторная покупка того же плана (продление)

1. Пользователь с Pro (истекает через 10 дней) покупает Pro ещё раз
2. `upsertSubscription(userId, 'pro', 30)`:
   - `existing.plan = 'pro'`, `planExpiresAt > now` → `baseDate = planExpiresAt`
   - `planExpiresAt = currentExpiry + 30 дней`
3. Итог: +30 дней к текущему сроку

### Истечение подписки (lazy expiry)

1. `planExpiresAt` прошёл
2. Cron НЕТ. Обработка при следующем запросе:
   - Чат-запрос → `checkSubscription` → обнаруживает просроченный план
   - `Subscription.update({ plan: 'free', planExpiresAt: null, planStartedAt: null })`
   - Запрос продолжается на плане `free`
3. При `GET /api/balance` → аналогичная проверка в `Balance.js`
4. Токены НЕ сгорают. Только план понижается.
5. Если текущая сессия использовала Pro-модель — следующий запрос получит 403 `MODEL_NOT_ALLOWED`

### Докупка токенов (token_pack)

1. `POST /api/payment/create { packageId: 'token_pack' }`
2. При успехе: `Balance += 3_000_000 TC`
3. `Subscription` не меняется — план остаётся прежним
4. `Payment.type = 'token_pack'`, `planPurchased = null`

### Изменение тарифов администратором

1. Администратор открывает `/admin`, вкладка Settings → Plans
2. Например, добавляет `gpt-5.2` в `pro.allowedModels`
3. `PATCH /api/admin/mvp/plans/pro { allowedModels: [..., 'gpt-5.2'] }`:
   - Валидация: `gpt-5.2` должен существовать в AiModel
   - `Plan.findOneAndUpdate()`
   - `invalidatePlanCache()` → кэш `checkSubscription` сбрасывается
4. Следующий чат-запрос Pro-пользователя с `gpt-5.2` → middleware перечитывает Plans из БД → разрешает
5. `ModelSelectorContext` обновится через ≤60 сек (TTL кэша React Query)

### Добавление новой модели

1. Admin: `POST /api/admin/mvp/models { modelId, provider, endpointKey, displayName }`
2. Добавить `modelId` в нужные планы: `PATCH /api/admin/mvp/plans/:planId { allowedModels: [..., newModelId] }`
3. Убедиться, что `endpointKey` настроен в `librechat.yaml` (иначе модель будет отфильтрована на клиенте)
4. Пользователи с нужным планом увидят модель в селекторе через ≤60 сек

---

*Конец документации*
