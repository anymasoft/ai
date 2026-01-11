# Архитектура платежной системы

## Обзор

Платежная система интегрирована с **ЮКасса** для обработки платежей в рублях (RUB).

Система основана на **прямой продаже кредитов** - пользователи покупают нужное количество кредитов по фиксированной цене за кредит, без привязки к пакетам.

**Технологический стек:**
- Backend: Astro (Node.js адаптер)
- БД: SQLite (better-sqlite3)
- Платежный сервис: ЮКасса API v3
- Аутентификация: Session tokens

---

## Компоненты системы

### 1. Frontend (Клиент)

#### `/billing` - Страница покупки кредитов

**Три варианта покупки:**

1. **Разовая покупка (Custom)**: 89₽ за кредит (1-10 кредитов)
   - Пользователь вводит количество кредитов
   - Цена обновляется в реальном времени: `credits × 89₽`

2. **Basic план**: 50 кредитов за 3950₽ (79₽ за кредит)
3. **Professional план**: 200 кредитов за 13800₽ (69₽ за кредит, популярный)

**Сценарий:**
1. Пользователь выбирает вариант и количество (для разовой покупки)
2. Нажимает кнопку "Купить"
3. Отправляет `POST /api/payments/yookassa/create` с `{ credits, amount }`
4. Получает `paymentUrl` от ЮКасса
5. Редиректится на форму ЮКасса (`window.location.href = paymentUrl`)
6. После оплаты редиректится обратно на `/billing`
7. **Polling логика** проверяет статус каждую секунду (до 60 раз)
8. Когда статус = `succeeded`:
   - Получает обновленный баланс через `GET /api/user/balance`
   - Обновляет баланс в DOM без перезагрузки

---

### 2. Backend API Endpoints

#### `POST /api/payments/yookassa/create`

**Логика:**
```
1. Проверяем аутентификацию (session token)
2. Парсим { credits, amount } из body
3. Валидируем: credits > 0, amount > 0
4. Создаём запрос к ЮКасса API:
   - Сумма: amount рублей
   - Описание: "Покупка N кредитов - user@email.com"
   - Возврат: /billing
5. Сохраняем платёж в БД со статусом 'pending':
   - Сохраняем количество кредитов в поле credits
6. Возвращаем paymentUrl клиенту
```

**Запрос к ЮКасса:**
```json
POST https://api.yookassa.ru/v3/payments
{
  "amount": { "value": "3950", "currency": "RUB" },
  "confirmation": { "type": "redirect", "return_url": "/billing" },
  "capture": true,
  "description": "Покупка 50 кредитов - user@email.com"
}
```

**БД запись (payments таблица):**
```sql
INSERT INTO payments (
  id, externalPaymentId, userId,
  amount, credits, provider, status, createdAt, updatedAt
) VALUES (
  'payment_<timestamp>_<userId>',
  '<yookassa_payment_id>',
  '<user_id>',
  3950,
  50,
  'yookassa',
  'pending',
  <timestamp>,
  <timestamp>
)
```

---

#### `GET /api/payments/yookassa/check?paymentId=<externalPaymentId>`

**Логика (Polling endpoint):**
```
1. Проверяем аутентификацию
2. Если paymentId не передан → ищем последний pending платеж пользователя
3. Проверяем статус платежа в БД
4. Если статус уже 'succeeded' → возвращаем success
5. Если статус не 'pending' → возвращаем error
6. ЗАПРАШИВАЕМ статус у ЮКасса:
   GET https://api.yookassa.ru/v3/payments/{paymentId}
7. Если ЮКасса говорит status='succeeded' AND paid=true:
   → Вызываем applySuccessfulPayment(paymentId)
8. Возвращаем статус клиенту
```

**Ответ:**
```json
{ "success": true, "status": "succeeded" }
или
{ "success": false, "status": "pending" }
или
{ "success": false, "status": "failed", "error": "..." }
```

---

#### `GET /api/user/balance`

**Логика:**
```
1. Проверяем аутентификацию
2. SELECT generation_balance, generation_used FROM users WHERE id = ?
3. Возвращаем текущий баланс
```

**Ответ:**
```json
{
  "success": true,
  "generation_balance": 50,
  "generation_used": 0
}
```

---

### 3. Core Business Logic

#### `applySuccessfulPayment(paymentId: string)`

**Файл:** `src/lib/payments.ts`

**Идемпотентная функция** - безопасна для повторных вызовов!

**Логика:**
```
1. Найти платёж в БД по externalPaymentId
2. ЗАЩИТА: если статус уже 'succeeded' → выход (уже применен)
3. ЗАЩИТА: если статус != 'pending' → ошибка (неправильный статус)
4. Получить количество кредитов из поля credits в payments таблице
5. АТОМАРНОЕ ОБНОВЛЕНИЕ баланса:
   UPDATE users
   SET generation_balance = generation_balance + credits,
       updatedAt = ?
   WHERE id = ?
6. Обновить статус платежа:
   UPDATE payments
   SET status = 'succeeded', updatedAt = ?
   WHERE externalPaymentId = ?
7. Return { success: true }
```

**Где вызывается:**
- Из check endpoint когда `status === 'succeeded'`
- Из webhook при получении `payment.succeeded` события

---

## Таблицы БД

### `users` таблица
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  image TEXT,
  plan TEXT DEFAULT 'free',
  role TEXT DEFAULT 'user',
  disabled INTEGER DEFAULT 0,
  generation_balance INTEGER DEFAULT 0,    ← КРЕДИТЫ
  generation_used INTEGER DEFAULT 0,       ← ИСПОЛЬЗОВАНО
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
)
```

### `payments` таблица
```sql
CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  externalPaymentId TEXT NOT NULL UNIQUE,   ← ID от ЮКасса
  amount REAL NOT NULL,                     ← Сумма в рублях
  credits INTEGER DEFAULT 0,                ← Количество купленных кредитов
  currency TEXT DEFAULT 'RUB',
  status TEXT DEFAULT 'pending',             ← pending → succeeded → failed
  provider TEXT DEFAULT 'yookassa',
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,
  FOREIGN KEY (userId) REFERENCES users(id)
)

CREATE INDEX idx_payments_externalPaymentId ON payments(externalPaymentId);
CREATE INDEX idx_payments_userId_createdAt ON payments(userId, createdAt DESC);
CREATE INDEX idx_payments_status ON payments(status);
```

---

## Поток данных

```
┌─────────────────────────────────────────────────────────────┐
│ 1. ИНИЦИАЦИЯ ПЛАТЕЖА                                        │
├─────────────────────────────────────────────────────────────┤
│ User → /billing → SELECT количество и вариант               │
│ POST /api/payments/yookassa/create { credits, amount }      │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. CREATE PAYMENT                                            │
├─────────────────────────────────────────────────────────────┤
│ [CREATE] POST https://api.yookassa.ru/v3/payments           │
│ [CREATE] INSERT INTO payments status='pending'              │
│          сохраняет amount и credits                         │
│ [CREATE] RETURN paymentUrl to client                        │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. ОПЛАТА В YOOKASSA                                        │
├─────────────────────────────────────────────────────────────┤
│ window.location.href = paymentUrl                           │
│ User fills payment form                                     │
│ YooKassa processes payment                                  │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. ВОЗВРАТ И POLLING                                        │
├─────────────────────────────────────────────────────────────┤
│ redirect → /billing                                         │
│ [POLLING] interval loop: GET /api/payments/yookassa/check   │
│ [CHECK] SELECT FROM payments WHERE externalPaymentId=?      │
│ [CHECK] GET https://api.yookassa.ru/v3/payments/{id}        │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. УСПЕШНЫЙ ПЛАТЕЖ                                          │
├─────────────────────────────────────────────────────────────┤
│ [CHECK] YooKassa return status='succeeded', paid=true       │
│ [CHECK] call applySuccessfulPayment(paymentId)              │
│ [applySuccessfulPayment] SELECT payment FROM payments       │
│ [applySuccessfulPayment] UPDATE users balance += credits    │
│ [applySuccessfulPayment] UPDATE payments status='succeeded' │
│ [CHECK] RETURN { status: 'succeeded' }                      │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. ОБНОВЛЕНИЕ UI                                            │
├─────────────────────────────────────────────────────────────┤
│ [POLLING] status==='succeeded'                              │
│ [POLLING] GET /api/user/balance                             │
│ [POLLING] updateBalanceDisplay(newBalance)                  │
│ User sees balance updated WITHOUT page reload               │
└─────────────────────────────────────────────────────────────┘
```

---

## Логирование

### Все операции логируются в терминал для отладки

#### CREATE endpoint
```
[CREATE] КОНФИГУРАЦИЯ:
[CREATE]   - authUrl = http://localhost:4321
[CREATE]   - webhookUrl = http://localhost:4321/api/payments/yookassa/webhook
[CREATE]   - Shop ID = ✓ SET
[CREATE] ✅ Payment created in YooKassa: <paymentId>
[CREATE] Payment details: amount=3950₽, credits=50, user=<userId>
[CREATE] ✅ Payment saved to DB: <paymentId>, local_id=..., status=pending
```

#### CHECK endpoint
```
[CHECK] START: Checking payment (userId: <userId>)
[CHECK] Found latest pending payment: <paymentId>
[CHECK] Found payment in DB: status=pending, userId=<userId>
[CHECK] Payment is pending, checking YooKassa API...
[CHECK] YooKassa response: status=succeeded, paid=true
[CHECK] ✅ YooKassa confirmed succeeded, applying payment...
[applySuccessfulPayment] Processing payment: <paymentId>
[applySuccessfulPayment] Found payment: userId=<userId>, credits=50, status=pending
[applySuccessfulPayment] Adding 50 credits to user <userId>
[applySuccessfulPayment] Balance update for user <userId>: 0 + 50 = 50 (changes: 1)
[applySuccessfulPayment] ✅ Success! Payment <paymentId> activated for user <userId>
[CHECK] ✅ SUCCESS: Payment <paymentId> APPLIED for user <userId>
[CHECK] BALANCE UPDATED: new balance = 50
```

---

## Безопасность

1. ✅ **Идемпотентность:** `applySuccessfulPayment()` проверяет статус перед UPDATE
2. ✅ **Аутентификация:** Все endpoints требуют session token
3. ✅ **Авторизация:** Пользователи не видят платежи других людей
4. ✅ **Foreign Keys:** SQLite включены для консистентности
5. ✅ **Атомарность:** UPDATE operations в одной транзакции
6. ✅ **Валидация:** credits и amount проверяются перед созданием платежа

---

## Расширения в будущем

1. **Webhook поддержка** (для production):
   - POST `/api/payments/yookassa/webhook`
   - Обрабатывает `payment.succeeded` события от ЮКасса
   - Вызывает `applySuccessfulPayment()` асинхронно

2. **История платежей:**
   - GET `/api/payments/user-history`
   - SELECT * FROM payments WHERE userId = ? ORDER BY createdAt DESC

3. **Admin управление:**
   - PATCH `/api/admin/user-balance`
   - Админ может добавлять/удалять кредиты вручную

4. **Refund логика:**
   - DELETE операции с возвратом кредитов

5. **Audit logs:**
   - Отдельная таблица для логирования всех финансовых операций
