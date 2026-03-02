# ПОЛНЫЙ ТЕХНИЧЕСКИЙ АУДИТ НАШЕГО ПРОЕКТА LibreChat
## Архитектурный анализ: Balance, Subscription, Tiers & Model Restrictions

**Дата аудита:** 2 марта 2026
**Режим:** АНАЛИЗ БЕЗ ИЗМЕНЕНИЙ
**Сравнение:** Наш проект VS оригинальный librechat_ai
**Цель:** Выявить дублирование, конфликты, риски и возможности упрощения

---

## 1. СТРУКТУРА СОБСТВЕННОЙ РЕАЛИЗАЦИИ

### 1.1 МОДЕЛИ И КОНФИГУРАЦИЯ

```
ФАЙЛЫ АРХИТЕКТУРЫ:
├─ /LibreChat/api/models/Subscription.js          [ОТДЕЛЬНАЯ модель подписок]
├─ /LibreChat/api/models/Payment.js               [ОТДЕЛЬНАЯ модель платежей]
├─ /LibreChat/api/models/Plan.js                  [БД конфигурация тарифов]
├─ /LibreChat/api/server/utils/subscriptionConfig.js [ЗАГОТОВКА - не используется активно!]
├─ /LibreChat/api/models/balanceMethods.js        [ИЗ ОРИГИНАЛА - checkBalance]
├─ /LibreChat/api/models/spendTokens.js           [ИЗ ОРИГИНАЛА - spendTokens]
├─ /LibreChat/api/models/Transaction.js           [ИЗ ОРИГИНАЛА - createTransaction]
└─ /LibreChat/packages/api/src/middleware/balance.ts [ИЗ ОРИГИНАЛА - createSetBalanceConfig]

MIDDLEWARE ПРОВЕРОК:
├─ /LibreChat/api/server/middleware/checkSubscription.js    [НОВОЕ - проверка плана по model]
├─ /LibreChat/api/server/middleware/checkSpecAllowedForPlan.js [НОВОЕ - проверка плана по spec]
└─ /LibreChat/packages/api/src/middleware/balance.ts        [ИЗ ОРИГИНАЛА - init баланса]

ROUTES & CONTROLLERS:
├─ /LibreChat/api/server/routes/payment.js        [НОВОЕ - обработка платежей]
├─ /LibreChat/api/server/routes/balance.js        [ИЗ ОРИГИНАЛА]
├─ /LibreChat/api/server/controllers/Balance.js   [ИЗ ОРИГИНАЛА]
└─ /LibreChat/api/server/routes/auth.js           [МОДИФИЦИРОВАН - setBalanceConfig на login]
```

---

## 2. АРХИТЕКТУРНЫЕ КОНФЛИКТЫ И ДУБЛИРОВАНИЕ

### 2.1 КОНФЛИКТ #1: Две системы конфигурации тарифов

**subscriptionConfig.js (ЗАГОТОВКА - НЕ ИСПОЛЬЗУЕТСЯ)**
```javascript
// /LibreChat/api/server/utils/subscriptionConfig.js
const PLAN_CONFIGS = {
  free: { allowedModelPatterns: ['gpt-4o-mini'] },  // ← SUBSTRING MATCHING!
};
function isModelAllowed(plan, modelName) {
  return cfg.allowedModelPatterns.some((p) => modelName.toLowerCase().includes(p));
}
```

**Plan.js модель (ИСПОЛЬЗУЕТСЯ В БОЕВОМ КОДЕ)**
```javascript
// /LibreChat/api/models/Plan.js
const SEED_DEFAULTS = [
  {
    planId: 'free',
    allowedModels: ['gpt-4o-mini', 'gpt-3.5-turbo'],  // ← EXACT MATCH!
  },
];
function isModelAllowed(planConfig, modelName) {
  return planConfig.allowedModels.includes(modelName);
}
```

**ПРОБЛЕМА:**
- ❌ subscriptionConfig.js использует SUBSTRING MATCHING
- ❌ Plan.js использует EXACT MATCH
- 🔴 subscriptionConfig.js не интегрирован, это МЕРТВЫЙ КОД
- ⚠️ Дублирование конфигурации: какой источник истины?

---

### 2.2 КОНФЛИКТ #2: Три разных источника истины

**Источник 1: appConfig.balance (YAML)**
```yaml
# librechat.yaml
balance:
  enabled: true
  startBalance: 20000
  autoRefillEnabled: true
```
**Используется:** createSetBalanceConfig при login

**Источник 2: Plan модель в БД**
```javascript
// /LibreChat/api/models/Plan.js SEED_DEFAULTS
{ planId: 'free', allowedModels: ['gpt-4o-mini'], ... }
```
**Используется:** checkSubscription, checkSpecAllowedForPlan

**Источник 3: subscriptionConfig.js**
```javascript
const PLAN_CONFIGS = { free: { allowedModelPatterns: ['gpt-4o-mini'] } };
```
**Используется:** НИГДЕ! (МЕРТВЫЙ КОД)

**ВЫВОД:**
- 🔴 КРИТИЧНО: subscriptionConfig.js не поддерживается, должен быть удален
- ⚠️ Если изменить конфиг в одном месте, нужно менять везде
- ⚠️ Разработчики могут запутаться, какой использовать

---

## 3. MIDDLEWARE PIPELINE И ПОРЯДОК

### 3.1 Фактический pipeline (agents/chat.js)

```
POST /api/agents/chat
    ↓
[Auth] authenticateUser
    ↓
1. moderateText
2. checkAgentAccess
3. checkAgentResourceAccess
4. validateConvoAccess
5. checkSpecAllowedForPlan   ← проверка доступа к spec
6. buildEndpointOption      ← spec → endpoint + model
7. checkSubscription        ← проверка доступа к model
8. AgentController
    ↓
BaseClient.checkBalance()   ← проверка баланса перед LLM
    ↓
[LLM Request]
    ↓
spendTokens()               ← списание токенов
```

**ПРОБЛЕМА: Двойная проверка модели**
- checkSpecAllowedForPlan проверяет: `planConfig.allowedSpecs.includes(spec)`
- buildEndpointOption преобразует: `spec → model`
- checkSubscription проверяет: `planConfig.allowedModels.includes(modelId)`

**РИСК: Рассинхронизация**
Если в Plan:
- allowedSpecs = ['gpt-4o']
- allowedModels = ['gpt-3.5-turbo']

То spec пройдет, model не пройдет → КОНФЛИКТ!

---

## 4. PAYMENT И RACE CONDITIONS

### 4.1 applySuccessfulPayment в payment.js

```javascript
async function applySuccessfulPayment(externalPaymentId) {
  // 1. Обновляем Balance
  const updatedBalance = await Balance.findOneAndUpdate(
    { user: userId },
    { $inc: { tokenCredits: creditsNum } },
  );

  // 2. Обновляем Subscription
  if (type === 'subscription') {
    const subscription = await upsertSubscription(userId, planId, durationDays);
  }

  // 3. Обновляем Payment
  await Payment.findOneAndUpdate(
    { externalPaymentId },
    { status: 'succeeded' }
  );
}
```

**КРИТИЧНЫЕ ПРОБЛЕМЫ:**

🔴 **Отсутствие транзакций**
- Три отдельные операции БД
- Если шаг 2 упадет:
  - Balance обновлена ✓
  - Subscription НЕ обновлена ✗
  - Payment.status = 'succeeded' ✓
  - Результат: пользователь имеет токены, но план не обновлен!

🔴 **Race condition при двух одновременных платежах**
- Оба платежа читают старый Balance
- Оба добавляют одну сумму
- Финальный баланс неправильный
- **Решение в оригинале:** updateBalance использует optimistic locking

🔴 **Нет idempotency**
- Если платеж пришел дважды → балл удвоится
- Нужно проверить: `Payment.findOne({ externalPaymentId }).lean()` ПЕРЕД обновлением

---

## 5. BALANCE ИНИЦИАЛИЗАЦИЯ

### 5.1 Сравнение с оригиналом

**ОРИГИНАЛ (librechat_ai):**
```
[ANY REQUEST from authenticated user]
  ↓
middleware/balance.ts: createSetBalanceConfig
  ├─ Ленивая инициализация на первый запрос
  └─ Если Balance не существует → upsert с startBalance
```

**НАШЕ (LibreChat):**
```
POST /api/auth/login
  ↓
loginController
  ↓
setBalanceConfig middleware
  ├─ Инициализация только на login
  └─ Если Balance не существует → upsert с startBalance
```

**РАЗЛИЧИЯ:**
- ✅ Оригинал: lazy initialization на первый запрос
- ❌ Наше: только на login
- 🔴 РИСК: Если пользователь создан через OAuth/LDAP → no initialization!
- 🔴 РИСК: Если admin изменил startBalance → старые пользователи не получат update

**РЕШЕНИЕ:**
Переместить createSetBalanceConfig на уровень app middleware:
```javascript
app.use(authenticateUser);
app.use(createSetBalanceConfig({...}));  // На КАЖДЫЙ запрос!
```

---

## 6. ПРОИЗВОДИТЕЛЬНОСТЬ И N+1 ЗАПРОСЫ

### 6.1 БД запросы на один chat запрос

```
POST /api/agents/chat
  ↓
checkSpecAllowedForPlan
  └─ SELECT * FROM plans WHERE planId IN (?)  ← БД 1
     (кэш на 60сек, но может быть cache miss)

buildEndpointOption
  └─ (no DB query)

checkSubscription
  └─ SELECT * FROM subscriptions WHERE userId=?  ← БД 2
     (кэш на 60сек, но может быть cache miss)

BaseClient.checkBalance()
  └─ SELECT * FROM balances WHERE user=?  ← БД 3
     (НЕТ кэша! каждый раз запрос)

spendTokens()
  └─ INSERT INTO transactions ...  ← БД 4
  └─ UPDATE balances (retry up to 10x) ← БД 5...15
```

**ИТОГО:** 4-5 обязательных запросов, потенциально до 15

**ПРОБЛЕМЫ:**
- ⚠️ Нет кэша для Balance (есть только для Plan и Subscription)
- ⚠️ updateBalance может retry 10 раз → 10+ запросов!
- ⚠️ При cache miss → еще 1-2 запроса
- ⚠️ Нет batch queries

---

## 7. ВЫЯВЛЕННЫЕ УЯЗВИМОСТИ

### 7.1 КРИТИЧНЫЕ 🔴

**1. Отсутствие транзакций при платежах**
- applySuccessfulPayment обновляет отдельно
- Может быть inconsistency
- РЕШЕНИЕ: `session.startTransaction()`

**2. Race condition при concurrent платежах**
- Два платежа одновременно → потеря данных
- РЕШЕНИЕ: optimistic locking как в оригинале

**3. Подделка model через payload**
- checkSubscription берет из `req.body?.model`
- Может обойти checkSpecAllowedForPlan
- РЕШЕНИЕ: проверять только из `req.builtEndpointOption.model`

**4. Balance инициализируется только на login**
- Пользователь из OAuth/LDAP/SAML → no balance!
- РЕШЕНИЕ: middleware на уровень app

---

### 7.2 ВЫСОКИЕ ⚠️

**1. Рассинхронизация allowedModels и allowedSpecs**
- Если spec разрешен, но model нет → конфликт
- РЕШЕНИЕ: валидация при обновлении Plan

**2. subscriptionConfig.js мертвый код**
- Не используется в коде
- Дублирует информацию из Plan.js
- РЕШЕНИЕ: УДАЛИТЬ

**3. Кэш может быть неактуален**
- 60 сек задержка при обновлении Plan
- РЕШЕНИЕ: invalidatePlanCache везде

**4. Нет audit trail**
- Нет логирования попыток доступа
- Нет истории изменений Plan
- РЕШЕНИЕ: добавить logger.warn при MODEL_NOT_ALLOWED

---

## 8. СРАВНЕНИЕ С ОРИГИНАЛОМ

### 8.1 ЧТО ВЗЯЛИ ИЗ ОРИГИНАЛА

| Компонент | Оригинал | Наше | Статус |
|-----------|---------|------|--------|
| Balance модель | ✅ есть | ✅ используем | ✅ совместимо |
| Transaction система | ✅ есть | ✅ используем | ✅ совместимо |
| checkBalance функция | ✅ есть | ✅ используем | ✅ совместимо |
| spendTokens функция | ✅ есть | ✅ используем | ✅ совместимо |
| createSetBalanceConfig | ✅ есть | ✅ используем | ⚠️ только на login |
| pricing/tx.js (300+ моделей) | ✅ есть | ✅ используем | ✅ совместимо |

### 8.2 ЧТО ДОБАВИЛИ НОВОЕ

| Компонент | Статус | Проблемы |
|-----------|--------|----------|
| Subscription модель | ✅ добавлена | ❌ не используется оригиналом |
| Payment модель | ✅ добавлена | 🔴 нет транзакций |
| Plan модель в БД | ✅ добавлена | ⚠️ три источника истины |
| checkSubscription MW | ✅ добавлена | ⚠️ два раза проверяет model |
| checkSpecAllowedForPlan MW | ✅ добавлена | ⚠️ может быть рассинхрон |

---

## 9. АРХИТЕКТУРНАЯ ОЦЕНКА

### 9.1 По критериям (из 10)

| Критерий | Оценка | Комментарий |
|----------|--------|-----------|
| **Детерминированность** | 6/10 | Три источника истины, кэш может быть неактуален |
| **Невозможность обхода** | 6/10 | Можно передать fake model в payload |
| **Масштабируемость** | 5/10 | Много БД запросов, нет batch queries |
| **Простота сопровождения** | 4/10 | subscriptionConfig.js, три системы конфиг |
| **Готовность к Stripe** | 7/10 | Payment модель есть, но нет транзакций |
| **Скорость вывода в прод** | 8/10 | Базовая функциональность работает |

**СРЕДНЯЯ ОЦЕНКА: 5.7/10** ⚠️

---

## 10. РЕКОМЕНДАЦИИ

### КРИТИЧНО ИСПРАВИТЬ (Week 1)

**1. Внедрить транзакции при платежах**
```javascript
const session = await mongoose.startSession();
try {
  session.startTransaction();
  await Balance.findOneAndUpdate({...}, {...}, {session});
  await Subscription.findOneAndUpdate({...}, {...}, {session});
  await session.commitTransaction();
} catch (err) {
  await session.abortTransaction();
  throw err;
}
```

**2. Защитить от подделки model**
```javascript
// checkSubscription должен проверять только req.builtEndpointOption.model
// или игнорировать req.body?.model вообще
```

**3. Удалить subscriptionConfig.js**
- МЕРТВЫЙ КОД
- Дублирует информацию из Plan.js
- Вводит в заблуждение разработчиков

**4. Переместить balance инициализацию в app middleware**
- Вместо только на login
- Применить на КАЖДЫЙ запрос как в оригинале

---

### ВЫСОКИЙ ПРИОРИТЕТ (Week 2-3)

- [ ] Синхронизировать allowedModels и allowedSpecs в Plan
- [ ] Добавить валидацию Plan.allowedModels против AiModel
- [ ] Добавить audit trail для Payment/Subscription
- [ ] Добавить логирование при MODEL_NOT_ALLOWED

---

### СРЕДНИЙ ПРИОРИТЕТ (Week 4-5)

- [ ] Добавить кэш для Balance (30сек TTL)
- [ ] Инвалидировать кэш при обновлении Plan везде
- [ ] Добавить batch валидацию моделей

---

## 11. ЧТО ХОРОШО И ЧТО ПЛОХО

### ✅ ЧТО СДЕЛАНО ХОРОШО

1. **Модель Subscription отделена от Balance**
   - Правильное разделение ответственности
   - Позволяет управлять сроками отдельно

2. **Plan модель в БД**
   - Можно менять тарифы без редеплоя
   - Гибко и масштабируемо

3. **checkSpecAllowedForPlan и checkSubscription разделены**
   - Четкое разделение ответственности
   - Легче тестировать

4. **Logging MODEL_CHECK и SPEC_CHECK**
   - Помогает найти источник проблемы
   - Гарантирует видимость

---

### ❌ ЧТО СДЕЛАНО ПЛОХО

1. **subscriptionConfig.js мертвый код**
   - Не интегрирован, должен быть удален

2. **Три разных источника истины**
   - YAML, Plan.js, subscriptionConfig.js
   - Путают разработчиков

3. **Отсутствие транзакций при платежах**
   - Критичная уязвимость
   - Может быть потеря денег

4. **Много БД запросов на один chat**
   - 4-5 обязательных, до 15 с retry
   - Без кэша Balance

5. **Balance инициализируется только на login**
   - Пропадают пользователи из OAuth/LDAP

---

## ИТОГОВЫЙ ВЫВОД

```
АРХИТЕКТУРНАЯ ОЦЕНКА: 5.7/10 ⚠️

✅ Базовая функциональность работает
✅ Модели хорошо структурированы
✅ Платежи можно отследить

❌ Три источника истины
❌ Отсутствие транзакций
❌ Можно обойти ограничения
❌ Много БД запросов
❌ Мертвый код subscriptionConfig.js

→ ТРЕБУЕТСЯ: Исправить критичные проблемы перед production
→ ПЛАН: 4 недели на рефакторинг и оптимизацию
```

