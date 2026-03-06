# 📋 ПОЛНЫЙ ПЛАН ВОССТАНОВЛЕНИЯ КОММЕРЧЕСКОЙ СИСТЕМЫ LibreChat

**Дата:** 2026-03-02
**Версия плана:** 1.0
**Приоритет:** ВЫСОКИЙ

---

## 📌 РЕЗЮМЕ

Система уже **80% реализована**. Нужна интеграция существующих компонентов и проверка подключения.

**Критичные шаги:**
1. Подключить `/api/payment` route
2. Проверить middleware порядок
3. Верифицировать webhook
4. Добавить переменные окружения
5. Тестирование

**Время реализации:** ~3-4 часа

---

## 🎯 ЦЕЛЬ

Восстановить полностью функциональную коммерческую систему LibreChat на основе существующего COMMERCIAL_ARCHITECTURE_FULL.md, **не переписывая** оригинальные механизмы LibreChat.

---

## 📊 ЭТАПЫ РЕАЛИЗАЦИИ

---

### ЭТАП 1: ПОДКЛЮЧЕНИЕ ROUTES (30 минут)

#### Шаг 1.1: Добавить payment import в routes/index.js

**Файл:** `/home/user/ai/LibreChat/api/server/routes/index.js`

**Действие:**
```javascript
// Добавить в начало файла (после других import'ов)
const payment = require('./payment');

// Добавить в module.exports (в правильном порядке)
module.exports = {
  mcp,
  auth,
  adminAuth,
  payment,    // ← ДОБАВИТЬ
  keys,
  // ...остальное
};
```

**Проверка:**
```bash
grep "const payment" /home/user/ai/LibreChat/api/server/routes/index.js
```

---

#### Шаг 1.2: Подключить payment route в index.js

**Файл:** `/home/user/ai/LibreChat/api/server/index.js`

**Действие:** Добавить строку после других routes (примерно после строки 152):
```javascript
app.use('/api/payment', routes.payment);
```

**Контекст:**
```javascript
// ДО
app.use('/api/balance', routes.balance);
app.use('/api/models', routes.models);

// ПОСЛЕ
app.use('/api/balance', routes.balance);
app.use('/api/models', routes.models);
app.use('/api/payment', routes.payment);  // ← ДОБАВИТЬ
```

**Проверка:**
```bash
grep -n "app.use.*payment" /home/user/ai/LibreChat/api/server/index.js
```

---

### ЭТАПЛЮЧОК 2: ПРОВЕРКА MIDDLEWARE ПОРЯДКА (45 минут)

#### Шаг 2.1: Найти где подключены message routes

**Файл:** `/home/user/ai/LibreChat/api/server/routes/messages.js`

**Действие:** Найти строку `router.post()` и проверить middleware:

```bash
grep -n "router.post\|router.get" /home/user/ai/LibreChat/api/server/routes/messages.js | head -10
```

**Ожидаемый результат:** Найти основной message endpoint

---

#### Шаг 2.2: Проверить цепочку middleware

**Что искать:**

В каждом route, который отправляет запрос к LLM, должна быть цепочка:

```javascript
router.post(
  '/some-path',
  requireJwtAuth,           // 1. Аутентификация
  ensureBalance,            // 2. Создать Balance если нет
  checkSubscription,        // 3. Проверить план (ленивое понижение)
  checkSpecAllowedForPlan,  // 4. Проверить разрешённые spec
  buildEndpointOption,      // 5. Преобразовать spec → model
  checkSubscription,        // 6. Проверить доступ к модели
  checkBalance,             // 7. Проверить токены
  // ... остальная логика
);
```

**Если цепочки нет:**

1. Добавить import middleware в routes/messages.js:
```javascript
const ensureBalance = require('../middleware/ensureBalance');
const checkSubscription = require('../middleware/checkSubscription');
const checkSpecAllowedForPlan = require('../middleware/checkSpecAllowedForPlan');
```

2. Обновить route:
```javascript
router.post(
  '/path',
  requireJwtAuth,
  ensureBalance,
  checkSubscription,
  checkSpecAllowedForPlan,
  buildEndpointOption,
  checkBalance,
  async (req, res) => { ... }
);
```

---

#### Шаг 2.3: Проверить convos route

**Файл:** `/home/user/ai/LibreChat/api/server/routes/convos.js`

**Действие:** Выполнить аналогичную проверку для conversation routes

---

### ЭТАП 3: ПРОВЕРКА PAYMENT WEBHOOK (30 минут)

#### Шаг 3.1: Найти webhook endpoint

**Файл:** `/home/user/ai/LibreChat/api/server/routes/payment.js`

**Действие:** Найти строку `router.post('/webhook')`

```bash
grep -n "router.post.*webhook" /home/user/ai/LibreChat/api/server/routes/payment.js
```

**Ожидаемый результат:** Должна быть реализована обработка webhook от ЮKassa

---

#### Шаг 3.2: Убедиться в наличии applySuccessfulPayment

**Что проверять:**

```javascript
// payment.js должен содержать функцию applySuccessfulPayment
async function applySuccessfulPayment(externalPaymentId) {
  // 1. Проверка идемпотентности
  // 2. Начало транзакции MongoDB
  // 3. Обновление Balance
  // 4. Обновление Subscription
  // 5. Обновление Payment статуса
  // 6. Коммит транзакции
}

// И вызов из webhook handler:
router.post('/webhook', async (req, res) => {
  const result = await applySuccessfulPayment(externalPaymentId);
  res.json({ ok: result.ok });
});
```

**Проверка:**
```bash
grep -n "async function applySuccessfulPayment\|router.post.*webhook" /home/user/ai/LibreChat/api/server/routes/payment.js
```

---

#### Шаг 3.3: Проверить использование MongoDB session

**Что проверять:**

```javascript
const session = await mongoose.startSession();
session.startTransaction();

try {
  // Все операции ДОЛЖНЫ иметь { session }
  await Balance.findOneAndUpdate(..., { session });
  await Subscription.findOneAndUpdate(..., { session });
  await Payment.findOneAndUpdate(..., { session });

  await session.commitTransaction();
} catch (err) {
  await session.abortTransaction();
}
```

**Если нет session → КРИТИЧНАЯ ОШИБКА! Может быть двойной платеж!**

---

### ЭТАП 4: ПЕРЕМЕННЫЕ ОКРУЖЕНИЯ (15 минут)

#### Шаг 4.1: Проверить .env.example

**Файл:** `/home/user/ai/LibreChat/.env.example`

**Действие:** Убедиться что есть:

```env
# === ЮKassa Integration ===
YOOKASSA_SHOP_ID=...
YOOKASSA_API_KEY=...
YOOKASSA_RETURN_URL=http://localhost:3080/pricing?payment=success
```

**Если нет → Добавить**

---

#### Шаг 4.2: Обновить инструкции

**Файл:** Любой документ с setup инструкциями

**Действие:** Добавить примечание:

```
Для работы платежной системы заполните в .env:
- YOOKASSA_SHOP_ID: ID магазина из кабинета ЮKassa
- YOOKASSA_API_KEY: Секретный API ключ
- YOOKASSA_RETURN_URL: URL возврата после оплаты (по умолчанию)
```

---

### ЭТАП 5: ПРОВЕРКА API ENDPOINTS (20 минут)

#### Шаг 5.1: Тестировать GET /api/balance

```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:3080/api/balance
```

**Ожидаемый ответ:**
```json
{
  "tokenCredits": 15000,
  "plan": "free",
  "planExpiresAt": null
}
```

---

#### Шаг 5.2: Тестировать GET /api/models/allowed

```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:3080/api/models/allowed
```

**Ожидаемый ответ:**
```json
{
  "models": [
    { "modelId": "gpt-4o-mini", "displayName": "GPT-4o Mini" },
    { "modelId": "gpt-3.5-turbo", "displayName": "GPT-3.5 Turbo" }
  ],
  "plan": "free",
  "allowedModels": ["gpt-4o-mini", "gpt-3.5-turbo"]
}
```

---

#### Шаг 5.3: Тестировать POST /api/payment/create

```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"packageId":"pro"}' \
  http://localhost:3080/api/payment/create
```

**Ожидаемый ответ:**
```json
{
  "redirectUrl": "https://yookassa.ru/..."
}
```

---

### ЭТАП 6: FRONTEND КОМПОНЕНТЫ (2 часа)

#### Шаг 6.1: Создать страницу /pricing

**Файл:** `/home/user/ai/LibreChat/client/src/routes/Pricing.tsx` (или Pricing.jsx)

**Минимальный компонент:**
```jsx
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
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packageId: planId })
    });
    const data = await res.json();
    window.location.href = data.redirectUrl;
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

---

#### Шаг 6.2: Добавить balance display в навигации

**Файл:** `/home/user/ai/LibreChat/client/src/components/Nav/AccountSettings.tsx`

**Добавить:**
```jsx
const { data: balance } = useQuery({
  queryKey: ['balance'],
  queryFn: async () => {
    const res = await fetch('/api/balance', { credentials: 'include' });
    return res.json();
  }
});

return (
  <div>
    {/* ... существующий код ... */}
    <div>
      Баланс: {balance?.tokenCredits} токенов
      {balance?.plan !== 'free' && (
        <div>План: {balance?.plan}</div>
      )}
    </div>
  </div>
);
```

---

### ЭТАП 7: ТЕСТИРОВАНИЕ (1-2 часа)

#### Шаг 7.1: Unit тесты

**Проверить:**
- ✅ checkSubscription middleware понижает план если истёк
- ✅ Payment идемпотентность (дважды с одним externalPaymentId)
- ✅ MongoDB transaction откатывается при ошибке

---

#### Шаг 7.2: Integration тесты

**Проверить:**
- ✅ Полный flow платежа (от create до webhook)
- ✅ Нельзя выбрать модель вне плана
- ✅ Баланс пополняется при платеже
- ✅ Subscription меняется при платеже

---

#### Шаг 7.3: Manual тесты

**Проверить в браузере:**
- ✅ Страница /pricing открывается
- ✅ Нажатие "Купить" редирект на ЮKassa (или Sandbox)
- ✅ После платежа баланс и план обновляются
- ✅ Нельзя выбрать Pro модель на Free плане (403 ошибка)

---

## 📋 ЧЕКЛИСТ РЕАЛИЗАЦИИ

### Фаза 1: Подключение (день 1)
- [ ] Подключить payment route в routes/index.js
- [ ] Добавить app.use() в index.js
- [ ] Проверить синтаксис (npm run lint)
- [ ] Перезапустить сервер

### Фаза 2: Проверка (день 1)
- [ ] Проверить middleware порядок в routes/messages.js
- [ ] Проверить middleware порядок в routes/convos.js
- [ ] Проверить наличие session в payment.js
- [ ] Добавить недостающие middleware если нужны

### Фаза 3: Окружение (день 1)
- [ ] Добавить YOOKASSA_* переменные в .env.example
- [ ] Заполнить YOOKASSA_* переменные в .env (тестовые значения)
- [ ] Проверить что переменные доступны в payment.js

### Фаза 4: API Тестирование (день 2)
- [ ] Тестировать GET /api/balance
- [ ] Тестировать GET /api/models/allowed
- [ ] Тестировать POST /api/payment/create
- [ ] Тестировать webhook (локально или с Sandbox)

### Фаза 5: Frontend (день 2-3)
- [ ] Создать /pricing page
- [ ] Добавить balance display в навигации
- [ ] Тестировать UI в браузере
- [ ] Убедиться что модель selector фильтрует по плану

### Фаза 6: Финал (день 3)
- [ ] Unit тесты
- [ ] Integration тесты
- [ ] Manual тесты
- [ ] Документация
- [ ] Code review
- [ ] Merge в main

---

## 🚨 КРИТИЧНЫЕ ПРАВИЛА

### 🔴 ЗАПРЕЩЕНО

- ❌ Переписывать Balance модель
- ❌ Создавать вторую систему учета токенов
- ❌ Изменять порядок middleware (может привести к проблемам безопасности)
- ❌ Убирать проверку идемпотентности из Payment
- ❌ Убирать MongoDB session из transakcii
- ❌ Auto-select модели в UI

### ✅ ОБЯЗАТЕЛЬНО

- ✅ Использовать оригинальный Balance механизм
- ✅ Использовать оригинальный spendTokens
- ✅ Использовать оригинальный checkBalance
- ✅ Проверять model ТОЛЬКО из req.builtEndpointOption
- ✅ Ленивое понижение плана (не background job)
- ✅ Кэш планов на 60 сек в memory

---

## 📞 FAQ ПО ВОПРОСАМ

**Q: Почему нельзя переписывать Balance?**
A: Balance — оригинальный механизм LibreChat, используется везде. Любые изменения могут сломать другую функциональность.

**Q: Зачем кэш планов на 60 сек?**
A: На каждый запрос не ходить в БД. 60 сек достаточно для консистентности. После изменения плана можно инвалидировать вручную.

**Q: Почему ленивое понижение плана, а не background job?**
A: Проще и надежнее. План понижается прямо когда пользователь делает запрос. Не нужен отдельный job.

**Q: Что если webhook придет дважды?**
A: Идемпотентность по externalPaymentId. Платеж применится только один раз.

**Q: Как тестировать локально?**
A: Использовать ЮKassa Sandbox или mock webhook'и в unit тестах.

---

## 🎯 ИТОГОВЫЙ РЕЗУЛЬТАТ

После выполнения этого плана система будет:

- ✅ Полностью функциональна
- ✅ Производственна готова
- ✅ Протестирована
- ✅ Задокументирована
- ✅ Соответствует оригинальным механизмам LibreChat

---

**Готовность: 80% → 100%**
**Время реализации: ~3-4 часа активной разработки**
**Сложность: Средняя (интеграция, не новая разработка)**

