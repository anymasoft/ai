# ПОЛНАЯ ДОКУМЕНТАЦИЯ КОММЕРЧЕСКОЙ АРХИТЕКТУРЫ LibreChat

**Дата: 2026-03-02**
**Версия: 1.0**
**Статус: Полная функциональная архитектура с системой тарификации, платежами и ограничениями доступа**

---

## ОГЛАВЛЕНИЕ

1. [РАЗДЕЛ 1 — ОБЩАЯ АРХИТЕКТУРА](#раздел-1--общая-архитектура)
2. [РАЗДЕЛ 2 — МОДЕЛИ БАЗЫ ДАННЫХ](#раздел-2--модели-базы-данных)
3. [РАЗДЕЛ 3 — MIDDLEWARE](#раздел-3--middleware)
4. [РАЗДЕЛ 4 — PAYMENT FLOW](#раздел-4--payment-flow)
5. [РАЗДЕЛ 5 — UI ЧАСТЬ](#раздел-5--ui-часть)
6. [РАЗДЕЛ 6 — КОНФИГУРАЦИЯ](#раздел-6--конфигурация)
7. [РАЗДЕЛ 7 — ИЗВЕСТНЫЕ ПРОБЛЕМЫ И РЕШЕНИЯ](#раздел-7--известные-проблемы-и-решения)
8. [РАЗДЕЛ 8 — ПОШАГОВОЕ ВОССОЗДАНИЕ С НУЛЯ](#раздел-8--пошаговое-воссоздание-с-нуля)

---

# РАЗДЕЛ 1 — ОБЩАЯ АРХИТЕКТУРА

## 1.1 Обзор коммерческой модели

Наша система реализует многоуровневую коммерческую модель на базе LibreChat:

### Три основных компонента системы:

**A. Тарифные планы (Plans)**
- Free (бесплатный, с ограничениями)
- Pro (месячная подписка)
- Business (месячная подписка, полный доступ)

**B. Баланс и токены (Balance & Tokens)**
- Каждый пользователь имеет токен-баланс (tokenCredits)
- Баланс пополняется при покупке подписки или пакета токенов
- Баланс убывает при каждом сообщении (зависит от модели)

**C. Платежи и подписки (Payments & Subscriptions)**
- Интеграция с платежной системой ЮKassa
- Автоматическое управление сроком действия подписки
- Идемпотентность платежей (повторные платежи не создают дубликаты)

---

## 1.2 Архитектурный flow пользователя

```
┌─────────────────────────────────────────────────────────────┐
│ 1. AUTH & INITIALIZATION                                    │
│ ├─ loginController / signupController                       │
│ ├─ ensureBalance middleware (создает Balance если его нет)  │
│ └─ Subscription инициализируется с планом 'free'            │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│ 2. REQUEST PREPROCESSING                                    │
│ ├─ checkSpecAllowedForPlan (валидация spec по плану)      │
│ ├─ buildEndpointOption (преобразование spec → model)       │
│ └─ checkSubscription (проверка доступа к модели)           │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│ 3. BALANCE CHECK                                            │
│ ├─ checkBalance (хватает ли токенов для запроса)           │
│ └─ Если нет → 402 Payment Required                         │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│ 4. REQUEST PROCESSING                                       │
│ ├─ Выполнение запроса к AI API                             │
│ └─ Успешно выполнено                                        │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│ 5. BILLING & ACCOUNTING                                     │
│ ├─ spendTokens (вычитание токенов из баланса)             │
│ ├─ Transaction запись (история расходов)                   │
│ └─ Если баланс закончился → алерт пользователю            │
└─────────────────────────────────────────────────────────────┘
```

---

## 1.3 Где используются оригинальные механизмы LibreChat

LibreChat содержит полную систему управления балансом токенов:

**Файлы из оригинального LibreChat (не модифицируются):**

1. **Balance.js** (`/home/user/ai/LibreChat/api/models/Balance.js`)
   - Модель БД для хранения tokenCredits
   - Поля: user, tokenCredits, autoRefillEnabled, refillInterval

2. **Transaction.js** (`/home/user/ai/LibreChat/api/models/Transaction.js`)
   - История расходов токенов
   - Связана с Balance и User
   - Используется для аудита и отчетов

3. **checkBalance middleware** (в оригинальном LibreChat)
   - Проверяет достаточность токенов ДО выполнения запроса

4. **spendTokens функция**
   - Вычитает токены после успешного запроса
   - Атомарная операция

**Оригинальный flow:**
```
User Request → checkBalance → AI Processing → spendTokens → Save Transaction
```

---

## 1.4 Где используется наш кастомный слой

Мы добавили коммерческий слой НА ТОП оригинального LibreChat:

**Новые модели (кастом):**
1. **Plan.js** — конфигурация тарифов
2. **Subscription.js** — статус подписки пользователя
3. **Payment.js** — история платежей
4. **AiModel.js** — каталог доступных моделей (расширена)

**Новые middleware (кастом):**
1. **ensureBalance** — создает Balance если его нет (при первой авторизации)
2. **checkSpecAllowedForPlan** — валидирует доступность spec по плану
3. **checkSubscription** — проверяет доступ к модели по плану

**Новые routes (кастом):**
1. **/api/payment** — платежи (ЮKassa интеграция)
2. **/api/models/allowed** — список доступных моделей для пользователя
3. **/api/auth/plan** — информация о текущем плане

**Новая UI (кастом):**
1. `/pricing` — страница с планами и кнопкой покупки
2. Balance display в навигации
3. Model selector с фильтрацией по плану

---

# РАЗДЕЛ 2 — МОДЕЛИ БАЗЫ ДАННЫХ

## 2.1 Plan.js — конфигурация тарифов

**Файл:** `/home/user/ai/LibreChat/api/models/Plan.js`

### Схема

```javascript
{
  planId:                 String (enum: ['free', 'pro', 'business']),
  label:                  String,                    // "Free", "Pro", "Business"
  priceRub:               Number,                    // цена в рублях (0 для free)
  tokenCreditsOnPurchase: Number,                    // токены при покупке
  durationDays:           Number,                    // 30 дней для платных
  allowedModels:          [String],                  // ['gpt-4o', 'claude-sonnet']
  allowedSpecs:           [String],                  // для spec-driven архитектуры
  isActive:               Boolean,
  createdAt:              Date,
  updatedAt:              Date
}
```

### Дефолтные значения

```javascript
FREE PLAN:
  planId: 'free'
  label: 'Free'
  priceRub: 0
  tokenCreditsOnPurchase: 0
  durationDays: null
  allowedModels: ['gpt-4o-mini', 'gpt-3.5-turbo']

PRO PLAN:
  planId: 'pro'
  label: 'Pro'
  priceRub: 3_990
  tokenCreditsOnPurchase: 5_000_000
  durationDays: 30
  allowedModels: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1-mini', 'gpt-4-turbo',
                  'claude-sonnet-4-6', 'claude-haiku-4-5', 'deepseek-chat']

BUSINESS PLAN:
  planId: 'business'
  label: 'Business'
  priceRub: 9_990
  tokenCreditsOnPurchase: 12_000_000
  durationDays: 30
  allowedModels: [все модели]
```

### Важные особенности

**1. allowedModels = [] означает ВСЕ модели разрешены**
```javascript
if (allowed.length === 0) return true;  // все модели разрешены
return allowed.includes(modelName);    // иначе точное совпадение
```

**2. seedDefaults() — идемпотентная инициализация**
- Вызывается при старте сервера
- Использует $set и $setOnInsert для избежания перезаписи пользовательских изменений
- Обновляет цены и токены, но НЕ перезаписывает allowedModels

**3. Связи с другими моделями**
- `Subscription` ссылается на `Plan.planId`
- `checkSpecAllowedForPlan` кэширует планы в памяти (CACHE_TTL = 60 сек)
- `checkSubscription` также кэширует планы

### Где используется

1. **models.js** (`/api/models/allowed`)
   - Загружает план по planId
   - Возвращает allowedModels и allowedSpecs

2. **payment.js** (`/api/payment/create`, `applySuccessfulPayment`)
   - Читает durationDays при создании платежа
   - Читает priceRub и tokenCreditsOnPurchase

3. **checkSpecAllowedForPlan middleware**
   - Кэширует все планы
   - Проверяет allowedSpecs по текущему плану пользователя

4. **checkSubscription middleware**
   - Кэширует все планы
   - Проверяет allowedModels по текущему плану пользователя

---

## 2.2 Subscription.js — статус подписки пользователя

**Файл:** `/home/user/ai/LibreChat/api/models/Subscription.js`

### Схема

```javascript
{
  userId:       ObjectId (ref: 'User', unique, required, indexed),
  plan:         String (enum: ['free', 'pro', 'business'], default: 'free'),
  planStartedAt: Date,
  planExpiresAt: Date | null,
  createdAt:    Date,
  updatedAt:    Date
}
```

### Описание полей

| Поле | Тип | Назначение |
|------|-----|-----------|
| userId | ObjectId | Уникальная ссылка на User, индексирована для быстрого поиска |
| plan | String | Текущий активный план ('free', 'pro', 'business') |
| planStartedAt | Date | Когда начался текущий план (для аудита) |
| planExpiresAt | Date\|null | Когда истекает план (null для free, т.к. он вечный) |

### Важные правила

**1. Ленивое понижение плана**
```javascript
// Если план истёк → автоматически понижается до free
if (plan !== 'free' && planExpiresAt && new Date(planExpiresAt) < new Date()) {
  plan = 'free';
  planExpiresAt = null;
}
```
Это происходит в нескольких местах для надежности:
- checkSubscription middleware
- models.js (/api/models/allowed)
- auth.js (/api/auth/plan)
- payment.js (при применении платежа)

**2. Если Subscription не найдена**
```javascript
// Пользователь считается на плане 'free'
let plan = subscription?.plan || 'free';
```

**3. Гарантия наличия Subscription**
- При регистрации пользователя создается запись с планом 'free'
- Если запись не найдена, она создается автоматически при первом запросе
- Это гарантирует, что у КАЖДОГО пользователя есть подписка

### Где используется

1. **models.js** (`/api/models/allowed`)
   ```javascript
   const subscription = await Subscription.findOne({ userId }).lean();
   let plan = subscription?.plan || 'free';
   ```

2. **auth.js** (`/api/auth/plan`)
   ```javascript
   const subscription = await Subscription.findOne({ userId }).lean();
   ```

3. **checkSubscription middleware**
   ```javascript
   const subscription = await Subscription.findOne({ userId }).lean();
   ```

4. **checkSpecAllowedForPlan middleware**
   ```javascript
   const subscription = await Subscription.findOne({ userId }).lean();
   ```

5. **payment.js** (`upsertSubscription`)
   ```javascript
   // Обновляет Subscription при успешном платеже
   await Subscription.findOneAndUpdate(
     { userId },
     { plan: planId, planStartedAt: now, planExpiresAt },
     { upsert: true }
   );
   ```

6. **Balance controller** (`/api/balance`)
   ```javascript
   // Показывает текущий план в ответе баланса
   const subscription = await Subscription.findOne({ userId }).lean();
   ```

---

## 2.3 Payment.js — история платежей

**Файл:** `/home/user/ai/LibreChat/api/models/Payment.js`

### Схема

```javascript
{
  externalPaymentId: String (unique, indexed, required),  // ID от ЮKassa
  userId:            ObjectId (ref: 'User', indexed, required),
  packageId:         String,                              // 'pro', 'business'
  type:              String (enum: ['subscription', 'token_pack']),
  planPurchased:     String | null,                       // 'pro' или 'business'
  tokenCredits:      Number,                              // сколько токенов добавить
  amount:            String,                              // '3990.00'
  status:            String (enum: ['pending', 'succeeded', 'failed']),
  expiresAt:         Date | null,                         // когда истекает подписка
  createdAt:         Date,
  updatedAt:         Date
}
```

### Описание полей

| Поле | Тип | Назначение |
|------|-----|-----------|
| externalPaymentId | String | Уникальный ID от платежной системы (ЮKassa), используется для идемпотентности |
| userId | ObjectId | Кому принадлежит платеж |
| packageId | String | Что покупает пользователь ('pro', 'business', или ID пакета токенов) |
| type | String | Тип платежа: 'subscription' (меняет план) или 'token_pack' (только токены) |
| planPurchased | String | Для подписки: какой план куплен ('pro' или 'business') |
| tokenCredits | Number | Сколько токенов добавится в Balance |
| amount | String | Сумма в рублях (строка для точности) |
| status | String | Статус платежа |
| expiresAt | Date | Когда истекает купленная подписка |

### Процесс платежа

**Статусы платежа:**

```
[pending] ──(webhook от ЮKassa)──> [succeeded]  ✓
   │
   └──(ошибка)──> [failed]  ✗
```

**Flow:**

1. Frontend отправляет POST /api/payment/create с packageId
2. Backend создает Payment с status='pending'
3. ЮKassa показывает форму оплаты
4. После оплаты ЮKassa отправляет webhook на /api/payment/webhook
5. Backend вызывает `applySuccessfulPayment(externalPaymentId)`
6. В MongoDB транзакции обновляются 3 документа атомарно:
   - Balance (+tokenCredits)
   - Subscription (plan, planExpiresAt)
   - Payment (status='succeeded')

### Идемпотентность

**Проблема:** Если webhook отправится дважды, платеж будет применен дважды!

**Решение:** Используем externalPaymentId как ключ для идемпотентности:

```javascript
// ПЕРЕД транзакцией проверяем
const existing = await Payment.findOne({ externalPaymentId }).lean();

if (existing && existing.status === 'succeeded') {
  return { ok: true, alreadyDone: true };  // платеж уже применен
}

if (!existing || existing.status !== 'pending') {
  return { ok: false };  // платеж в неправильном статусе
}
```

### Где используется

1. **payment.js** - все платежи проходят через Payment модель
2. **Admin панель** - просмотр истории платежей пользователей
3. **Аудит** - отслеживание всех транзакций

---

## 2.4 AiModel.js — каталог моделей (расширена)

**Файл:** `/home/user/ai/LibreChat/api/models/AiModel.js`

### Что добавлено

Стандартная модель LibreChat расширена полями для управления моделями:

```javascript
{
  modelId:      String,   // "gpt-4o", "claude-sonnet-4-6", etc.
  displayName:  String,   // Отображаемое имя для UI
  provider:     String,   // "openai", "anthropic", "deepseek", etc.
  endpointKey:  String,   // Тип endpoint'а
  isActive:     Boolean,  // Активна ли модель
  // ... другие поля оригинального LibreChat
}
```

### Использование в системе

1. **models.js** - при загрузке /api/models/allowed:
   ```javascript
   // Получаем модели которые разрешены по плану
   const query = allowedModelIds.length > 0
     ? { modelId: { $in: allowedModelIds }, isActive: true }
     : { isActive: true };
   const models = await AiModel.find(query).lean();
   ```

2. **checkSubscription middleware** - валидирует что выбранная модель в allowedModels:
   ```javascript
   const modelId = req.builtEndpointOption?.model;
   const allowed = planConfig.allowedModels || [];
   if (allowed.length === 0 || allowed.includes(modelId)) {
     // модель разрешена
   }
   ```

3. **Pricing page** - показывает какие модели в каком плане:
   ```javascript
   // UI получает список моделей для каждого плана
   ```

---

## 2.5 Balance (оригинальный LibreChat)

**Файл:** оригинальное поле LibreChat (не модифицируется)

### Краткий обзор

```javascript
{
  user:                  ObjectId (ref: 'User'),
  tokenCredits:          Number,      // основное поле: количество токенов
  autoRefillEnabled:     Boolean,     // для авто-пополнения
  refillIntervalValue:   Number,      // каждые N дней
  refillIntervalUnit:    String,      // 'day', 'week', 'month'
  lastRefill:            Date,
  refillAmount:          Number,      // на сколько пополнять
  createdAt:             Date,
  updatedAt:             Date
}
```

### Как используется в системе

1. **ensureBalance middleware** - создает Balance при авторизации если его нет
2. **checkBalance middleware** - проверяет достаточность tokenCredits перед запросом
3. **applySuccessfulPayment** - увеличивает tokenCredits при успешном платеже
4. **spendTokens** - уменьшает tokenCredits после успешного запроса

---

## 2.6 Transaction (оригинальный LibreChat)

**Файл:** оригинальное поле LibreChat (не модифицируется)

### Схема

```javascript
{
  userId:          ObjectId (ref: 'User'),
  conversationId:  ObjectId (ref: 'Conversation'),
  model:           String,
  tokenCredits:    Number,    // сколько потрачено
  // ... другие поля для аудита
  createdAt:       Date
}
```

### Использование

После каждого успешного запроса к AI, создается Transaction запись для истории расходов.

---

# РАЗДЕЛ 3 — MIDDLEWARE

## 3.1 ensureBalance

**Файл:** `/home/user/ai/LibreChat/api/server/middleware/ensureBalance.js`

### Назначение

Гарантирует что у каждого авторизованного пользователя есть запись в коллекции Balance.

### Когда вызывается

- **ВСЕ запросы** проходят через этот middleware
- Но обрабатывает только req.user (аутентифицированные запросы)

### Что делает

```javascript
async function ensureBalance(req, res, next) {
  // Если пользователь не авторизован — пропускаем
  if (!req.user?.id && !req.user?._id) {
    return next();
  }

  const userId = req.user._id;

  // Проверяем есть ли Balance
  const balance = await Balance.findOne({ user: userId }).lean();

  if (!balance) {
    // Создаем Balance с 0 токенов
    await Balance.create({
      user: userId,
      tokenCredits: 0,
      autoRefillEnabled: false
    });
  }

  next();
}
```

### Edge cases

1. **Первый запрос пользователя**
   - Balance еще не создана
   - ensureBalance создает ее автоматически
   - Пользователь может использовать free модели

2. **Параллельные запросы**
   - MongoDB unique constraint гарантирует что создастся только одна запись
   - Другие запросы найдут уже созданную запись

3. **Если MongoDB недоступна**
   - middleware вызывает next() в catch блоке
   - Запрос продолжает обработку
   - Может привести к 402 Payment Required позже

---

## 3.2 checkSpecAllowedForPlan

**Файл:** `/home/user/ai/LibreChat/api/server/middleware/checkSpecAllowedForPlan.js`

### Назначение

Проверяет что выбранный spec разрешен на тарифном плане пользователя.

Используется в spec-driven архитектуре (новые модели используют spec вместо прямого model).

### Когда вызывается

В middleware цепочке перед buildEndpointOption:

```
authenticateUser
  ↓
checkSubscription (проверка срока подписки)
  ↓
checkSpecAllowedForPlan ← ЗДЕСЬ
  ↓
buildEndpointOption (преобразование spec → endpoint+model)
```

### Как работает

```javascript
async function checkSpecAllowedForPlan(req, res, next) {
  const userId = req.user?._id || req.user?.id;
  if (!userId) return next();

  // 1. Получаем подписку
  const subscription = await Subscription.findOne({ userId }).lean();
  let plan = subscription?.plan || 'free';

  // 2. Получаем spec из payload
  const spec = req.body?.spec;
  if (!spec) return next();  // нет spec → пропускаем проверку

  // 3. Загружаем планы (с кэшем на 60 сек)
  const plans = await getPlans();
  const planConfig = plans[plan];

  // 4. Проверяем разрешен ли spec
  const allowed = planConfig.allowedSpecs || [];
  if (allowed.length === 0) return next();  // все spec разрешены

  if (!allowed.includes(spec.name)) {
    return res.status(403).json({
      error: `Spec "${spec.name}" недоступна на плане "${plan}".`,
      code: 'SPEC_NOT_ALLOWED'
    });
  }

  next();
}
```

### Кэширование планов

```javascript
let _planCache = null;
let _cacheExpiresAt = 0;
const CACHE_TTL = 60_000;  // 60 секунд

async function getPlans() {
  // Если кэш еще свежий — возвращаем его
  if (_planCache && Date.now() < _cacheExpiresAt) {
    return _planCache;
  }

  // Иначе загружаем из БД
  await Plan.seedDefaults();
  const plans = await Plan.find({}, 'planId allowedSpecs isActive').lean();
  _planCache = Object.fromEntries(plans.map((p) => [p.planId, p]));
  _cacheExpiresAt = Date.now() + CACHE_TTL;

  return _planCache;
}
```

**Зачем кэш?**
- На каждый запрос не ходим в БД (экономия ресурсов)
- 60 сек кэша достаточно для консистентности
- Можно инвалидировать вручную после изменения плана

### Error handling

- Если Subscription не найдена → используется план 'free'
- Если Plan не найден в кэше → возвращаем ошибку 403
- Если нет spec в запросе → пропускаем проверку

---

## 3.3 buildEndpointOption

**Файл:** (встроено в основной route handler)

### Назначение

Преобразует spec (новая архитектура) в model (старая архитектура) для совместимости с LibreChat.

### Как работает

```javascript
// Входящий запрос:
{
  "spec": {
    "name": "gpt-4o",
    "preset": {
      "model": "gpt-4o"  // это то что нам нужно
    }
  }
}

// buildEndpointOption выполняет:
req.builtEndpointOption = {
  model: "gpt-4o",      // извлекли из spec.preset.model
  endpoint: "openai"    // определили по модели
};

// Теперь остальной код использует req.builtEndpointOption.model
```

### Где хранится результат

`req.builtEndpointOption.model` — используется:
- checkSubscription middleware
- checkBalance middleware
- AI API call

### Критичность

ОЧЕНЬ критично для безопасности! Комментарий в checkSubscription:

```javascript
// SECURITY: Use model ONLY from buildEndpointOption (которое идёт ДО этого middleware)
// ЗАПРЕЩЕНО использовать req.body?.model или req.body?.endpointOption?.model
// Это защищает от подмены модели в payload
```

Если пользователь попытается отправить:
```javascript
{
  "spec": "gpt-4o-mini",  // имеет право
  "endpointOption": {
    "model": "gpt-4o"  // хочет подменить на дорогую
  }
}
```

Такая попытка не сработает, т.к. checkSubscription используется ТОЛЬКО `req.builtEndpointOption.model`.

---

## 3.4 checkSubscription

**Файл:** `/home/user/ai/LibreChat/api/server/middleware/checkSubscription.js`

### Назначение

Проверяет что пользователь имеет доступ к выбранной модели по его тарифному плану.

### Когда вызывается

В middleware цепочке:

```
buildEndpointOption (построен model)
  ↓
checkSubscription ← ЗДЕСЬ
  ↓
checkBalance (проверка токенов)
```

### Как работает

```javascript
async function checkSubscription(req, res, next) {
  // 1. Получаем userId (используем ObjectId, не строку!)
  const userId = req.user?._id || req.user?.id;
  if (!userId) return next();

  // 2. Загружаем подписку
  const subscription = await Subscription.findOne({ userId }).lean();
  let plan = subscription?.plan || 'free';

  // 3. Проверяем истек ли план
  let planExpiresAt = subscription?.planExpiresAt || null;
  if (plan !== 'free' && planExpiresAt && new Date(planExpiresAt) < new Date()) {
    // Ленивое понижение до free
    await Subscription.findOneAndUpdate(
      { userId },
      { plan: 'free', planExpiresAt: null }
    );
    plan = 'free';
    planExpiresAt = null;
  }

  // 4. Сохраняем в req для downstream
  req.subscription = { plan, planExpiresAt };

  // 5. SECURITY: Получаем модель ТОЛЬКО из buildEndpointOption
  const modelId = req.builtEndpointOption?.model;
  if (!modelId) {
    // Критичная ошибка в порядке middleware!
    return res.status(500).json({
      error: 'Internal server error: invalid middleware order',
      code: 'INVALID_MIDDLEWARE_ORDER'
    });
  }

  // 6. Загружаем планы (с кэшем)
  const plans = await getPlans();
  const planConfig = plans[plan];

  // 7. Проверяем разрешена ли модель
  const allowed = planConfig.allowedModels || [];
  if (allowed.length === 0) {
    // Пустой список = все модели разрешены
    return next();
  }

  if (allowed.includes(modelId)) {
    return next();  // модель разрешена
  }

  // Модель НЕ разрешена на этом плане
  return res.status(403).json({
    error: `Модель "${modelId}" недоступна на плане "${plan}"`,
    code: 'MODEL_NOT_ALLOWED'
  });
}
```

### Ленивое понижение плана

**Почему это важно:**

```
Пользователь купил Pro на 30 дней
День 30 → план истекает
День 31 → user делает запрос

Что произойдет?
1. checkSubscription видит что planExpiresAt < теперь
2. Автоматически понижает план до 'free'
3. Обновляет БД (atomically)
4. Запрос продолжает обработку как от free пользователя
```

**Преимущества:**
- Не нужен background job для ежедневной проверки
- Работает только когда пользователь делает запрос
- Гарантирует что пользователь сразу видит что его план истек

### Порядок middleware критичен!

```javascript
app.use(buildEndpointOption);        // ← построить model
app.use(checkSubscription);           // ← проверить доступ
app.use(checkBalance);                // ← проверить токены
// AI processing
```

Если изменить порядок — система сломается:

```javascript
// НЕПРАВИЛЬНО:
app.use(checkSubscription);           // req.builtEndpointOption еще не готов!
app.use(buildEndpointOption);
```

---

## 3.5 checkBalance (оригинальный LibreChat)

**Назначение:** Проверяет что у пользователя достаточно tokenCredits для запроса.

**Когда вызывается:** Перед AI processing, после проверки доступа к модели.

**Что делает:**
1. Получает стоимость запроса (зависит от модели)
2. Проверяет Balance.tokenCredits >= cost
3. Если нет → возвращает 402 Payment Required
4. Если да → пропускает дальше

---

# РАЗДЕЛ 4 — PAYMENT FLOW

## 4.1 Полный сценарий платежа

### Инициирование платежа

**Frontend:** Пользователь нажимает "Купить Pro"

```javascript
// POST /api/payment/create
{
  "packageId": "pro"  // или "business"
}
```

**Backend:** `/home/user/ai/LibreChat/api/server/routes/payment.js`

```javascript
router.post('/create', requireJwtAuth, async (req, res) => {
  const { packageId } = req.body;
  const userId = req.user._id;

  // 1. Загружаем и валидируем пакет
  const planDoc = await Plan.findOne({ planId: packageId, isActive: true }).lean();
  if (!planDoc) return res.status(400).json({ error: 'Пакет не найден' });

  // 2. Генерируем idempotence ключ (для защиты от дубликатов)
  const idempotenceKey = `${userId}-${packageId}-${Date.now()}`;

  // 3. Подготавливаем платеж
  const payment = {
    amount: planDoc.priceRub.toFixed(2),
    currency: 'RUB',
    description: `Подписка ${planDoc.label}`
  };

  // 4. Отправляем запрос в ЮKassa API
  const yukassaResponse = await axios.post(
    'https://api.yookassa.ru/v3/payments',
    payment,
    { auth: yukassaAuth(), headers: { 'Idempotence-Key': idempotenceKey } }
  );

  // 5. Создаем запись в нашей БД
  await Payment.create({
    externalPaymentId: yukassaResponse.data.id,  // ID от ЮKassa
    userId,
    packageId,
    type: planDoc.durationDays ? 'subscription' : 'token_pack',
    planPurchased: planDoc.durationDays ? packageId : null,
    tokenCredits: planDoc.tokenCreditsOnPurchase,
    amount: payment.amount,
    status: 'pending'
  });

  // 6. Возвращаем данные для подтверждения платежа
  res.json({
    redirectUrl: yukassaResponse.data.confirmation.redirect_url
  });
});
```

**Что происходит:**
1. Payment создается с status='pending'
2. Возвращается ссылка на форму ЮKassa
3. Frontend редирект на эту ссылку

---

### Обработка успешного платежа

**ЮKassa:** Пользователь ввел данные карты и платеж прошел

**Webhook:** ЮKassa отправляет POST на `/api/payment/webhook`

```javascript
router.post('/webhook', async (req, res) => {
  const { object } = req.body;
  const externalPaymentId = object.id;

  // 1. Проверяем что это успешный платеж
  if (object.status !== 'succeeded') {
    return res.status(200).json({ ok: false });
  }

  // 2. Применяем платеж (с идемпотентностью)
  const result = await applySuccessfulPayment(externalPaymentId);

  res.status(200).json({ ok: result.ok });
});
```

---

### applySuccessfulPayment — ядро payment flow

**Файл:** `/home/user/ai/LibreChat/api/server/routes/payment.js`

```javascript
async function applySuccessfulPayment(externalPaymentId) {
  // 1. ИДЕМПОТЕНТНОСТЬ: Проверяем ПЕРЕД транзакцией
  const existing = await Payment.findOne({ externalPaymentId }).lean();

  if (existing && existing.status === 'succeeded') {
    return { ok: true, alreadyDone: true };  // платеж уже применен!
  }
  if (!existing || existing.status !== 'pending') {
    return { ok: false };  // платеж в неправильном статусе
  }

  // 2. ТРАНЗАКЦИЯ: Начинаем транзакцию MongoDB
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { userId, tokenCredits, planPurchased, type } = existing;

    // ══════════════════════════════════════════════════
    // STEP 1: Обновляем Balance (добавляем токены)
    // ══════════════════════════════════════════════════
    const updatedBalance = await Balance.findOneAndUpdate(
      { user: userId },
      { $inc: { tokenCredits } },
      { upsert: true, new: true, session }  // session ОБЯЗАТЕЛЕН!
    );
    if (!updatedBalance) {
      await session.abortTransaction();
      return { ok: false, message: 'Ошибка обновления баланса' };
    }

    // ══════════════════════════════════════════════════
    // STEP 2: Обновляем Subscription (меняем план)
    // ══════════════════════════════════════════════════
    let subscription = null;
    if (type === 'subscription' && planPurchased) {
      const planDoc = await Plan.findOne({ planId: planPurchased }).lean();

      // Определяем дату истечения (продлеваем если есть текущий план)
      const existing = await Subscription.findOne({ userId }, null, { session }).lean();
      let baseDate = new Date();
      if (existing && existing.plan === planPurchased &&
          existing.planExpiresAt && new Date(existing.planExpiresAt) > new Date()) {
        baseDate = new Date(existing.planExpiresAt);
      }

      const planExpiresAt = new Date(baseDate);
      planExpiresAt.setDate(planExpiresAt.getDate() + planDoc.durationDays);

      subscription = await Subscription.findOneAndUpdate(
        { userId },
        { plan: planId, planStartedAt: new Date(), planExpiresAt },
        { upsert: true, new: true, session }  // session ОБЯЗАТЕЛЕН!
      ).lean();
    }

    // ══════════════════════════════════════════════════
    // STEP 3: Обновляем Payment (меняем статус на succeeded)
    // ══════════════════════════════════════════════════
    const updatedPayment = await Payment.findOneAndUpdate(
      { externalPaymentId },
      { status: 'succeeded', expiresAt: subscription?.planExpiresAt || null },
      { new: true, session }  // session ОБЯЗАТЕЛЕН!
    );
    if (!updatedPayment) {
      await session.abortTransaction();
      return { ok: false, message: 'Ошибка обновления платежа' };
    }

    // ══════════════════════════════════════════════════
    // ЕСЛИ ВСЕ ОПЕРАЦИИ УСПЕШНЫ → КОММИТИМ
    // ══════════════════════════════════════════════════
    await session.commitTransaction();
    await session.endSession();

    logger.info(`[payment/apply] Payment succeeded: ${externalPaymentId}, user: ${userId}`);
    return { ok: true };

  } catch (err) {
    await session.abortTransaction();
    await session.endSession();
    logger.error('[payment/apply] Transaction failed:', err);
    return { ok: false, message: 'Ошибка обработки платежа' };
  }
}
```

---

## 4.2 MongoDB транзакция

### Почему нужна транзакция?

Представьте что произойдет БЕЗ транзакции:

```
1. Balance обновлен (+5_000_000 токенов)
2. Subscription обновлена (plan='pro', expires=2026-04-02)
3. ❌ Ошибка БД при обновлении Payment
   → Payment все еще status='pending'
   → Следующий webhook повторит платеж!
   → У пользователя 10_000_000 токенов вместо 5_000_000!
```

**С транзакцией:**

```
1. BEGIN TRANSACTION
2. Balance обновлен (+5_000_000)
3. Subscription обновлена (plan='pro')
4. ❌ Ошибка БД при Payment
   → ROLLBACK: Balance и Subscription откатываются
   → Payment остается 'pending'
   → Следующий webhook повторит все корректно
```

### Синтаксис транзакции

```javascript
const session = await mongoose.startSession();
session.startTransaction();

try {
  // Каждая операция ДОЛЖНА иметь session
  await Model.findOneAndUpdate({ ... }, { session });
  await OtherModel.findOneAndUpdate({ ... }, { session });

  await session.commitTransaction();  // успех
} catch (err) {
  await session.abortTransaction();   // откат
} finally {
  await session.endSession();         // закрыть сессию
}
```

---

## 4.3 Идемпотентность платежей

### Проблема

```
1. Пользователь нажимает "Купить Pro"
2. Отправляется POST /api/payment/create
3. Ошибка сети → запрос не доставлен
4. Frontend повторяет запрос
5. Создается ВТОРОЙ платеж с той же карточки!
```

### Решение 1: Idempotence-Key в ЮKassa

```javascript
const idempotenceKey = `${userId}-${packageId}-${Date.now()}`;
const yukassaResponse = await axios.post(
  'https://api.yookassa.ru/v3/payments',
  payment,
  {
    headers: { 'Idempotence-Key': idempotenceKey }  // ЮKassa гарантирует уникальность
  }
);
```

ЮKassa гарантирует что если запрос с тем же idempotenceKey придет дважды, она вернет результат первого платежа.

### Решение 2: externalPaymentId в нашей БД

```javascript
// Проверяем ПЕРЕД транзакцией
const existing = await Payment.findOne({ externalPaymentId }).lean();

if (existing && existing.status === 'succeeded') {
  // Платеж уже был применен → не применяем еще раз
  return { ok: true, alreadyDone: true };
}
```

---

## 4.4 Текстовая диаграмма payment flow

```
┌──────────────────────────────────────────────────────────────┐
│ 1. FRONTEND: Пользователь выбирает план                      │
│    POST /api/payment/create { packageId: "pro" }             │
└────────────────┬─────────────────────────────────────────────┘
                 │
┌────────────────▼─────────────────────────────────────────────┐
│ 2. BACKEND: Создаем Payment с status='pending'               │
│    - Вызываем ЮKassa API                                    │
│    - Получаем redirect_url                                   │
│    - Возвращаем пользователю                                 │
└────────────────┬─────────────────────────────────────────────┘
                 │
┌────────────────▼─────────────────────────────────────────────┐
│ 3. FRONTEND: Редирект на форму оплаты ЮKassa                │
│    пользователь вводит данные карты                          │
└────────────────┬─────────────────────────────────────────────┘
                 │
┌────────────────▼─────────────────────────────────────────────┐
│ 4. YUKASSA: Обработка платежа                               │
│    - Снятие денег с карты                                    │
│    - Отправка webhook на наш сервер                          │
└────────────────┬─────────────────────────────────────────────┘
                 │
┌────────────────▼─────────────────────────────────────────────┐
│ 5. WEBHOOK: POST /api/payment/webhook                         │
│    { object: { id: "externalPaymentId", status: "succeeded" }}
└────────────────┬─────────────────────────────────────────────┘
                 │
┌────────────────▼─────────────────────────────────────────────┐
│ 6. BACKEND: applySuccessfulPayment(externalPaymentId)        │
│    ├─ Проверка идемпотентности                              │
│    ├─ BEGIN TRANSACTION                                       │
│    ├─ Balance: +5_000_000 токенов                            │
│    ├─ Subscription: plan='pro', expires=2026-04-02           │
│    ├─ Payment: status='succeeded'                             │
│    └─ COMMIT TRANSACTION                                      │
└────────────────┬─────────────────────────────────────────────┘
                 │
┌────────────────▼─────────────────────────────────────────────┐
│ 7. FRONTEND: Получает алерт что платеж успешен              │
│    - Баланс пополнен                                         │
│    - План изменен на Pro                                     │
│    - UI обновляется                                          │
└──────────────────────────────────────────────────────────────┘
```

---

# РАЗДЕЛ 5 — UI ЧАСТЬ

## 5.1 Страница /pricing

**Файл:** `/home/user/ai/LibreChat/client/src/routes/Pricing.tsx`

### Компоненты

```
Pricing.tsx
├── Header: "Выберите оптимальный план"
├── PricingPlans component (карточки планов)
│  ├── Free план
│  │  ├── Цена: "Бесплатно"
│  │  ├── Список моделей: gpt-4o-mini, gpt-3.5-turbo
│  │  └── Кнопка: "Выбран" (disabled)
│  │
│  ├── Pro план
│  │  ├── Цена: "₽3,990 / месяц"
│  │  ├── Токены: "5,000,000 TC"
│  │  ├── Список моделей: 7 моделей
│  │  └── Кнопка: "Купить" (onClick → /api/payment/create)
│  │
│  └── Business план
│     ├── Цена: "₽9,990 / месяц"
│     ├── Токены: "12,000,000 TC"
│     ├── Список моделей: ВСЕ модели
│     └── Кнопка: "Купить" (onClick → /api/payment/create)
│
└── Comparison table (какие модели в каком плане)
```

### Данные загружаются откуда?

```javascript
// Способ 1: Из /api/models/allowed
const response = await fetch('/api/models/allowed', { credentials: 'include' });
const { plan, allowedModels } = await response.json();
// Показываем текущий план пользователя и его модели

// Способ 2: Из /api/admin/mvp/plans (для всех планов)
const plans = await fetch('/api/admin/mvp/plans');
// Показываем ВСЕ планы для сравнения
```

### Процесс покупки

```javascript
async function handleBuy(planId) {
  try {
    // 1. POST /api/payment/create
    const response = await fetch('/api/payment/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ packageId: planId })
    });

    const { redirectUrl } = await response.json();

    // 2. Редирект на ЮKassa
    window.location.href = redirectUrl;

    // 3. После оплаты пользователь вернется с ?payment=success
    // Frontend должен проверить статус платежа
  } catch (err) {
    console.error('Payment error:', err);
  }
}
```

### Проверка статуса платежа

После возврата с ЮKassa (URL: `/pricing?payment=success`):

```javascript
// GET /api/payment/check (для localhost)
// или webhook уже обработал платеж (для продакшена)

// Frontend может вызвать:
const checkPayment = async () => {
  const response = await fetch('/api/payment/check', { credentials: 'include' });
  const { status } = await response.json();

  if (status === 'succeeded') {
    // Обновить UI: показать новый баланс и план
    // Редирект на /c/new
  } else if (status === 'pending') {
    // Показать spinner: "Проверяем статус..."
  } else {
    // Ошибка
  }
};
```

---

## 5.2 Отображение баланса в UI

**Компоненты:**

1. **Balance display в навигации**
   - `/home/user/ai/LibreChat/client/src/components/Nav/SettingsTabs/Balance/Balance.tsx`
   - Показывает текущий tokenCredits
   - Кнопка "Пополнить" → редирект на /pricing

2. **Account Settings**
   - `/home/user/ai/LibreChat/client/src/components/Nav/AccountSettings.tsx`
   - Показывает текущий план (Free, Pro, Business)
   - Получает данные из `/api/models/allowed`

### Как получить баланс

```javascript
// GET /api/balance
const response = await fetch('/api/balance', { credentials: 'include' });
const { tokenCredits, plan, planStartedAt, planExpiresAt } = await response.json();

// Отобразить:
// Баланс: 5,000,000 TC
// План: Pro (истекает 2026-04-02)
```

---

## 5.3 Отображение текущего плана

**Где показывается:**

```
AccountSettings.tsx (в навигации)
├─ "Баланс" раздел
│  ├─ Badge с планом (Free / Pro / Business)
│  └─ Кнопка "Пополнить"
│
PricingPlans.tsx (на странице /pricing)
└─ Кнопка "Выбран" для текущего плана (disabled)
```

**Как получить:**

```javascript
// Способ 1: /api/models/allowed
const response = await fetch('/api/models/allowed', { credentials: 'include' });
const { plan } = await response.json();

// Способ 2: /api/auth/plan
const response = await fetch('/api/auth/plan', { credentials: 'include' });
const { plan, planExpiresAt } = await response.json();
```

---

## 5.4 Ограничение моделей в селекторе

**Компонент:** Model selector в chat UI

### Как работает

```javascript
// 1. Загружаем доступные модели
const response = await fetch('/api/models/allowed', { credentials: 'include' });
const { models, allowedModels } = await response.json();

// 2. Фильтруем модели по текущему плану
const availableModels = models.filter(m =>
  allowedModels.length === 0 || allowedModels.includes(m.modelId)
);

// 3. Отображаем только доступные
// Недоступные модели либо скрыты, либо с лейблом "Upgrade required"
```

### UI для недоступной модели

```javascript
{
  modelId: 'gpt-4o',
  displayName: 'GPT-4o (Upgrade required)',
  disabled: true,
  onClick: () => navigate('/pricing')
}
```

---

# РАЗДЕЛ 6 — КОНФИГУРАЦИЯ

## 6.1 Переменные .env

### Payment интеграция (ЮKassa)

```bash
# Обязательно для платежей
YOOKASSA_SHOP_ID=1234567
YOOKASSA_API_KEY=test_secret_key_xxxxx

# Опционально (по умолчанию /pricing?payment=success)
YOOKASSA_RETURN_URL=https://example.com/pricing?payment=success
```

### Database

```bash
# MongoDB (стандартный LibreChat)
MONGODB_URI=mongodb://localhost:27017/librechat
```

### Server

```bash
# Для webhook'ов от ЮKassa
DOMAIN_SERVER=https://example.com
```

---

## 6.2 Параметры в librechat.yaml / конфигах

### Model Specs (для spec-driven архитектуры)

```yaml
# Конфиг приложения
modelSpecs:
  enforce: false  # если true, то обязательно использовать spec
  list:
    - name: "gpt-4o"
      preset:
        model: "gpt-4o"
        endpoint: "openai"
    - name: "claude-sonnet-4-6"
      preset:
        model: "claude-sonnet-4-6"
        endpoint: "anthropic"
```

### Balance конфиг (опционально)

```yaml
balance:
  enabled: true  # включить ли отображение баланса
```

---

## 6.3 Критичные для продакшена

**ОЧЕНЬ ВАЖНО!**

1. **Уникальность Payment.externalPaymentId**
   - Это гарантирует идемпотентность
   - БЕЗ индекса система сломается

2. **Уникальность Subscription.userId**
   - У каждого пользователя может быть только одна подписка
   - БЕЗ этого можно создать дублики

3. **Транзакции в applySuccessfulPayment**
   - БЕЗ них платежи могут быть применены дважды
   - БЕЗ них может потеряться деньги

4. **Кэш планов (60 сек)**
   - Снижает нагрузку на БД
   - После изменения плана кэш обновляется через 60 сек или вручную

5. **requireJwtAuth на route'ах платежей**
   - БЕЗ этого кто угодно может создать платеж за другого

---

# РАЗДЕЛ 7 — ИЗВЕСТНЫЕ ПРОБЛЕМЫ И РЕШЕНИЯ

## 7.1 Исторические проблемы

### Проблема 1: Пользователь без подписки (РЕШЕНО)

**Что было:**
```
❌ Пользователь был создан
❌ Но запись в Subscription не создана
→ /api/models/allowed выбрасывает ошибку
→ UI не может загрузить доступные модели
```

**Решение:**
1. При регистрации ОБЯЗАТЕЛЬНО создаем Subscription с планом 'free'
2. При запросе /api/models/allowed автоматически создаем Subscription если нет
3. ensureBalance также гарантирует Balance

**Код:**
```javascript
// В registerUser (AuthService.js):
await Subscription.create({
  userId: newUserId,
  plan: 'free',
});

// В /api/models/allowed (models.js):
if (!subscription) {
  await Subscription.create({
    userId,
    plan: 'free',
  });
  subscription = { plan: 'free' };
}
```

### Проблема 2: Платеж применился дважды (РЕШЕНО)

**Что было:**
```
❌ Webhook от ЮKassa пришел дважды
❌ applySuccessfulPayment вызвалась дважды
→ У пользователя 10_000_000 токенов вместо 5_000_000
```

**Решение:**
1. Используем externalPaymentId как уникальный ключ
2. Проверяем ПЕРЕД транзакцией что платеж не был уже применен
3. MongoDB транзакция гарантирует что все обновления либо применены либо откатаны

**Код:**
```javascript
const existing = await Payment.findOne({ externalPaymentId }).lean();
if (existing && existing.status === 'succeeded') {
  return { ok: true, alreadyDone: true };
}
```

### Проблема 3: userId как строка (РЕШЕНО)

**Что было:**
```
❌ userId преобразовывается в строку: userId.toString()
❌ MongoDB ищет по ObjectId
→ Subscription.findOne({ userId: "616c..." }) не находит
→ Всегда создается новая Subscription
```

**Решение:**
- Везде используем userId как ObjectId для поиска
- Только для логирования преобразуем в строку

**Код:**
```javascript
// ❌ НЕПРАВИЛЬНО:
const userId = req.user._id.toString();
const subscription = await Subscription.findOne({ userId }); // не найдет!

// ✅ ПРАВИЛЬНО:
const userId = req.user._id;
const subscription = await Subscription.findOne({ userId });
const userIdString = userId.toString();  // только для логирования
```

---

## 7.2 Хрупкие части архитектуры

### 1. Порядок middleware

**Очень критично!**

```javascript
// ПРАВИЛЬНЫЙ порядок:
authenticateUser
  ↓
checkSpecAllowedForPlan (валидация spec)
  ↓
buildEndpointOption (построение model)
  ↓
checkSubscription (проверка доступа к model)
  ↓
checkBalance (проверка токенов)
```

Если изменить порядок — checkSubscription не будет иметь req.builtEndpointOption.model!

### 2. Кэш планов

Если изменить план (через admin панель), то:
- Первые 60 сек будет кэшированное значение
- Через 60 сек обновится автоматически
- Или можно вызвать invalidatePlanCache() вручную

### 3. Транзакции MongoDB

ВСЕГДА используйте session в applySuccessfulPayment:

```javascript
// НЕПРАВИЛЬНО:
await Balance.findOneAndUpdate({ user: userId }, { $inc: { tokenCredits } });

// ПРАВИЛЬНО:
await Balance.findOneAndUpdate(
  { user: userId },
  { $inc: { tokenCredits } },
  { session }  // ← ОБЯЗАТЕЛЬНО!
);
```

---

## 7.3 Критичные зависимости

### Зависимость 1: ЮKassa API

Если ЮKassa API недоступна:
```
❌ /api/payment/create вернет ошибку
→ Пользователь не может купить подписку
→ Может повредить revenue
```

**Решение:** Мониторить доступность, логировать ошибки, иметь fallback

### Зависимость 2: MongoDB транзакции

Если MongoDB < 4.0:
```
❌ Транзакции не поддерживаются
→ applySuccessfulPayment может применить платеж дважды
```

**Решение:** Требовать MongoDB >= 4.0

### Зависимость 3: Уникальные индексы

Если индекс удалить:
```
❌ unique: true в схеме не работает
→ Можно создать дублики (Payment, Subscription)
```

**Решение:** Проверить индексы в продакшене

---

# РАЗДЕЛ 8 — ПОШАГОВОЕ ВОССОЗДАНИЕ С НУЛЯ

Этот раздел описывает как внедрить систему тарификации в чистый LibreChat.

## Шаг 1: Добавить модель Plan

### Файл: `/api/models/Plan.js`

```javascript
'use strict';
const mongoose = require('mongoose');

const planSchema = new mongoose.Schema({
  planId: { type: String, enum: ['free', 'pro', 'business'], unique: true, required: true, index: true },
  label: { type: String, required: true },
  priceRub: { type: Number, required: true, default: 0, min: 0 },
  tokenCreditsOnPurchase: { type: Number, required: true, default: 0, min: 0 },
  durationDays: { type: Number, default: null },
  allowedModels: { type: [String], default: [] },
  allowedSpecs: { type: [String], default: [] },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

// seedDefaults метод (см. раздел 2.1)

module.exports = mongoose.model('Plan', planSchema);
```

### Что здесь важно:

1. **planId как enum** — только 3 возможных значения
2. **unique: true** — нельзя создать дублики
3. **seedDefaults()** — инициализирует дефолты при старте

### Тестирование:

```bash
# Запустить сервер
npm start

# Проверить что планы созданы в БД
# MongoDB > db.plans.find()
```

---

## Шаг 2: Добавить модель Subscription

### Файл: `/api/models/Subscription.js`

```javascript
'use strict';
const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true,
  },
  plan: {
    type: String,
    enum: ['free', 'pro', 'business'],
    default: 'free',
  },
  planStartedAt: { type: Date, default: null },
  planExpiresAt: { type: Date, default: null, index: true },
}, { timestamps: true });

module.exports = mongoose.model('Subscription', subscriptionSchema);
```

### Что здесь важно:

1. **userId unique: true** — одна подписка на пользователя
2. **planExpiresAt indexed** — поиск по истечению плана (для ленивого понижения)
3. **default: 'free'** — все новые пользователи стартуют с free

### Обновить models/index.js:

```javascript
// В экспорте добавить:
module.exports = {
  ...methods,
  Plan: require('./Plan'),
  Subscription: require('./Subscription'),
  // ... остальное
};
```

### Тестирование:

```bash
# Создать Subscription для тестового пользователя
db.subscriptions.insertOne({
  userId: ObjectId("..."),
  plan: 'free',
  planStartedAt: new Date(),
  planExpiresAt: null
})
```

---

## Шаг 3: Добавить модель Payment

### Файл: `/api/models/Payment.js`

```javascript
'use strict';
const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  externalPaymentId: { type: String, unique: true, required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  packageId: { type: String, required: true },
  type: { type: String, enum: ['subscription', 'token_pack'], default: 'subscription' },
  planPurchased: { type: String, default: null },
  tokenCredits: { type: Number, required: true },
  amount: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'succeeded', 'failed'], default: 'succeeded' },
  expiresAt: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);
```

### Что здесь важно:

1. **externalPaymentId unique** — идемпотентность платежей
2. **status enum** — только валидные статусы

### Обновить models/index.js:

```javascript
module.exports = {
  ...methods,
  Plan: require('./Plan'),
  Subscription: require('./Subscription'),
  Payment: require('./Payment'),
};
```

---

## Шаг 4: Добавить ensureBalance middleware

### Файл: `/api/server/middleware/ensureBalance.js`

```javascript
'use strict';
const { Balance } = require('~/db/models');
const { logger } = require('@librechat/data-schemas');

async function ensureBalance(req, res, next) {
  try {
    if (!req.user?._id && !req.user?.id) return next();

    const userId = req.user._id;
    const balance = await Balance.findOne({ user: userId }).lean();

    if (!balance) {
      await Balance.create({
        user: userId,
        tokenCredits: 0,
        autoRefillEnabled: false,
      });
      logger.info(`[ensureBalance] Created balance for user ${userId}`);
    }

    next();
  } catch (err) {
    logger.error('[ensureBalance] Error:', err);
    next();  // пропускаем ошибку, не блокируем запрос
  }
}

module.exports = ensureBalance;
```

### Подключить в app.js:

```javascript
const ensureBalance = require('./middleware/ensureBalance');

// В цепочке middleware (ДО routes):
app.use(ensureBalance);
```

### Тестирование:

```bash
# 1. Авторизуемся
curl -X POST http://localhost:3080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password"}'

# 2. Проверяем что Balance создан
# MongoDB > db.balances.find({ user: ObjectId(...) })
```

---

## Шаг 5: Добавить checkSpecAllowedForPlan middleware

### Файл: `/api/server/middleware/checkSpecAllowedForPlan.js`

(См. раздел 3.2 для полного кода)

### Подключить в app.js:

```javascript
const checkSpecAllowedForPlan = require('./middleware/checkSpecAllowedForPlan');

// Порядок ОЧЕНЬ критичен!
app.use(checkSpecAllowedForPlan);  // ПЕРЕД buildEndpointOption
app.use(buildEndpointOption);
app.use(checkSubscription);
app.use(checkBalance);
```

---

## Шаг 6: Добавить checkSubscription middleware

### Файл: `/api/server/middleware/checkSubscription.js`

(См. раздел 3.4 для полного кода)

### Подключить в app.js:

```javascript
const checkSubscription = require('./middleware/checkSubscription');

// Правильный порядок:
app.use(buildEndpointOption);
app.use(checkSubscription);  // ПОСЛЕ buildEndpointOption
```

---

## Шаг 7: Добавить Payment route

### Файл: `/api/server/routes/payment.js`

(См. раздел 4 для полного кода)

### Подключить в app.js:

```javascript
const paymentRoutes = require('./routes/payment');

app.use('/api/payment', paymentRoutes);
```

### Переменные .env:

```bash
YOOKASSA_SHOP_ID=1234567
YOOKASSA_API_KEY=test_secret_key
```

### Тестирование:

```bash
# Создать платеж
curl -X POST http://localhost:3080/api/payment/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"packageId": "pro"}'

# Должен вернуть: { redirectUrl: "https://yookassa.ru/..." }
```

---

## Шаг 8: Добавить /api/models/allowed route

### Добавить в `/api/server/routes/models.js`:

```javascript
router.get('/allowed', requireJwtAuth, async (req, res) => {
  try {
    const userId = req.user._id;

    let subscription = await Subscription.findOne({ userId }).lean();
    if (!subscription) {
      await Subscription.create({ userId, plan: 'free' });
      subscription = { plan: 'free' };
    }

    let plan = subscription?.plan || 'free';

    // ... (остальной код, см. раздел 4)
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});
```

### Тестирование:

```bash
curl http://localhost:3080/api/models/allowed \
  -H "Authorization: Bearer <token>"

# Должен вернуть:
# {
#   "models": [...],
#   "plan": "free",
#   "allowedModels": ["gpt-4o-mini", "gpt-3.5-turbo"]
# }
```

---

## Шаг 9: Добавить UI компоненты

### 1. Страница /pricing

**Файл:** `/client/src/routes/Pricing.tsx`

```jsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

export function Pricing() {
  const { data: plans } = useQuery({
    queryKey: ['plans'],
    queryFn: async () => {
      const res = await fetch('/api/admin/mvp/plans');
      return res.json();
    }
  });

  const handleBuy = async (planId) => {
    const res = await fetch('/api/payment/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ packageId: planId })
    });
    const { redirectUrl } = await res.json();
    window.location.href = redirectUrl;
  };

  return (
    <div>
      <h1>Выберите план</h1>
      {plans?.map(plan => (
        <div key={plan.planId}>
          <h2>{plan.label}</h2>
          <p>₽{plan.priceRub}</p>
          <button onClick={() => handleBuy(plan.planId)}>Купить</button>
        </div>
      ))}
    </div>
  );
}
```

### 2. Balance display в AccountSettings

**Обновить:** `/client/src/components/Nav/AccountSettings.tsx`

```jsx
export function AccountSettings() {
  const { data: planData } = useQuery({
    queryKey: ['allowedModels'],
    queryFn: async () => {
      const res = await fetch('/api/models/allowed', { credentials: 'include' });
      return res.json();
    },
    enabled: !!token && isAuthenticated,
    suspense: true,
  });

  const planBadge = PLAN_BADGE[planData.plan];

  return (
    // ... UI с отображением планов
    <span className={planBadge.className}>{planBadge.label}</span>
  );
}
```

---

## Шаг 10: Интеграция и тестирование

### Checklist:

- [ ] Plan модель создана и seeded
- [ ] Subscription модель создана
- [ ] Payment модель создана
- [ ] ensureBalance middleware подключен (создает Balance)
- [ ] checkSpecAllowedForPlan middleware подключен
- [ ] checkSubscription middleware подключен
- [ ] Payment routes подключены
- [ ] /api/models/allowed route подключен
- [ ] YOOKASSA переменные в .env
- [ ] Pricing page создана
- [ ] AccountSettings обновлен
- [ ] Все middleware в правильном порядке

### Полное тестирование:

```bash
# 1. Регистрация → автоматически создается Subscription и Balance
POST /api/auth/register

# 2. Получить доступные модели
GET /api/models/allowed → { plan: 'free', allowedModels: [...] }

# 3. Создать платеж
POST /api/payment/create { packageId: 'pro' }

# 4. Симулировать webhook (для localhost)
POST /api/payment/webhook { object: { id: "...", status: "succeeded" } }

# 5. Проверить что Subscription обновлена
# MongoDB > db.subscriptions.find()

# 6. Проверить что Balance обновлена
# MongoDB > db.balances.find()

# 7. Попытаться использовать платную модель
# POST /api/chat/send { model: 'gpt-4o' }
# → должен вернуть успех если план Pro
```

---

## Итого

**Приблизительно:**
- 8 файлов модифицировано/создано
- 3 middleware добавлено
- 1 payment route добавлен
- 2 UI компонента обновлено
- ~600 строк кода
- 2-3 часа интеграции

**Критичные моменты:**
1. Порядок middleware
2. Использование ObjectId для поиска (не строка)
3. Транзакции в applySuccessfulPayment
4. Идемпотентность платежей
5. Гарантия наличия Subscription и Balance

---

# ЗАКЛЮЧЕНИЕ

Эта документация описывает полную архитектуру коммерческой системы LibreChat с:

- ✅ Системой тарификации (3 плана)
- ✅ Управлением доступом к моделям
- ✅ Платежной системой (ЮKassa)
- ✅ Балансом токенов
- ✅ Подписками пользователей
- ✅ Полной идемпотентностью
- ✅ Транзакционной консистентностью

Используя эту документацию, можно:
1. Понять как работает текущая система
2. Воссоздать систему в новом LibreChat
3. Модифицировать и расширять компоненты
4. Добавить новые планы и функции
5. Интегрировать другие платежные системы

**Версия документации:** 1.0 (2026-03-02)
**Статус:** Полная функциональная архитектура
**Объем:** ~40 страниц текста
