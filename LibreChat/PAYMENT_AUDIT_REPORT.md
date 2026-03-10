# ПОЛНЫЙ АУДИТ ПЛАТЁЖНОЙ СИСТЕМЫ RepliqAI

**Дата аудита:** 2026-03-10
**Статус:** ⚠️ КРИТИЧНЫЕ ПРОБЛЕМЫ НАЙДЕНЫ
**Конфиденциальность:** Внутренний документ

---

## EXECUTIVE SUMMARY

### Текущее состояние
- ✅ Интеграция с ЮKassa работает (webhook + polling)
- ✅ Транзакционная целостность при применении платежа
- ❌ **5 критичных проблем безопасности**
- ❌ **Нет защиты от множественных платежей**
- ❌ **Нет cleanup процесса**

### Выявленные риски
| Риск | Вероятность | Воздействие | Статус |
|------|------------|-----------|--------|
| Double-click создаст 2+ платежа | 🔴 Высокая | Финансовый убыток | КРИТИЧЕН |
| Платёж зависнет 'pending' | 🔴 Гарантирован | UX проблема + база растёт | КРИТИЧЕН |
| Webhook не обработается | 🟠 Средняя | Платёж не применится | ВЫСОКИЙ |
| Потеря данных о платеже | 🟠 Средняя | Пользователь не узнает | ВЫСОКИЙ |

---

## 1. КОД СОЗДАНИЯ ПЛАТЕЖА

### Endpoint: POST /api/payment/create
**Файл:** `api/server/routes/payment.js` (строки 223-303)

**Процесс создания:**
```javascript
1. Валидация packageId (подписка или token pack)
2. Получение цены и параметров из БД
3. Создание платежа в ЮKassa API
   ├─ capture: true (автоматический захват)
   ├─ Idempotence-Key (для идемпотентности)
   └─ metadata с userId, packageId, токенами
4. Создание записи в БД с status='pending'
5. Возврат { paymentId, confirmationUrl }
```

**Текущая защита:**
- ✅ Валидация packageId
- ✅ Normalization (lowercase)
- ✅ Idempotence-Key от ЮKassa
- ❌ **НЕТ проверки на существующий pending платёж**
- ❌ **НЕТ rate limiting на этот endpoint**

---

## 2. СТРУКТУРА БД (Payment Model)

```javascript
{
  externalPaymentId: String (unique, required, index),
  userId: ObjectId (ref='User', required, index),
  packageId: String (required),
  type: String (enum: ['subscription', 'token_pack']),
  planPurchased: String (default: null),
  tokenCredits: Number (required),
  amount: String (e.g., '3990.00'),
  status: String (enum: ['pending', 'succeeded', 'failed'], default: 'succeeded'), // ⚠️
  expiresAt: Date (default: null),
  createdAt: Date (auto),
  updatedAt: Date (auto)
}
```

### Проблемы структуры
- ❌ **Нет createdAt index** → slow queries для cleanup
- ❌ **Нет expiresAt field** → невозможно определить старые платежи
- ❌ **default: 'succeeded' странный** → но в коде переопределяется
- ❌ **Нет retry_count** → нет tracking webhook retry'ев

---

## 3. СТАТУСЫ И ПЕРЕХОДЫ

### Статусы платежа в системе

```
┌─────────────────────────────────────────────────────┐
│                                                       │
│  PENDING ──┬──(webhook/success)──→ SUCCEEDED        │
│            │                                           │
│            └──(timeout 24h)───────→ EXPIRED          │
│            │                                           │
│            └──(cancel)────────────→ FAILED           │
│                                                       │
└─────────────────────────────────────────────────────┘
```

### Frontend paymentCheck state
```
null
 ├─ (user clicks buy) → 'checking'
 ├─ (webhook arrives) → 'ok' (3s, then null)
 ├─ (still pending) → 'pending' (forever until refresh)
 └─ (error) → 'error'
```

**Проблема:** 'pending' состояние НЕ хранится в БД, только в component state!

---

## 4. МЕХАНИЗМЫ ЗАВЕРШЕНИЯ ПЛАТЕЖА

### A. Webhook (PROD/Staging)
**Endpoint:** `POST /api/payment/webhook`
**Отправитель:** ЮKassa
**Частота:** При изменении статуса платежа

```javascript
1. ЮKassa отправляет POST с payment.status = 'succeeded'
2. System находит Payment по externalPaymentId
3. Проверяет status == 'succeeded'
4. Вызывает applySuccessfulPayment():
   ├─ Начинает Transaction
   ├─ Updates Balance: +tokenCredits
   ├─ Updates Subscription: plan, planExpiresAt
   ├─ Updates Payment: status='succeeded'
   ├─ Commits transaction
   └─ Invalidates cache
5. Возвращает 200 OK
```

**Статус идемпотентности:** ✅ Защищена (проверка `existing.status === 'succeeded'`)

### B. Polling (Fallback для localhost)
**Endpoint:** `GET /api/payment/check`
**Триггер:** Frontend после редиректа с `?payment=success`
**Частота:** ONE-TIME (или ручное обновление)

```javascript
1. Frontend вызывает GET /api/payment/check?id={paymentId}
2. Backend ищет Payment{ userId, status: 'pending' }
3. Проверяет статус у ЮKassa API
4. Если 'succeeded' → applySuccessfulPayment()
5. Возвращает { ok, status, tokenCredits }
6. Frontend показывает бейдж на 3 секунды
```

**Проблема:** Если платёж всё ещё 'waiting_for_capture' → бейдж "обновите через минуту"

---

## 5. КРИТИЧНЫЙ СЦЕНАРИЙ: Незавершённый платёж

### Что происходит step-by-step

```
STEP 1: Пользователь нажимает "Купить"
├─ Frontend: POST /api/payment/create { packageId: 'pro' }
├─ Backend: Создаёт запись Payment { status: 'pending' }
├─ Backend: Отправляет запрос в ЮKassa
└─ Frontend: Получает confirmationUrl и редиректит на ЮKassa

STEP 2: Пользователь НА СТРАНИЦЕ ОПЛАТЫ
├─ Вариант A: Успешно платит
│  └─ ЮKassa: Отправляет webhook → status='succeeded'
├─ Вариант B: Закрывает вкладку
│  └─ ЮKassa: Отменяет платёж через 24 часа
└─ Вариант C: Нажимает "назад"
   └─ ЮKassa: Платёж остаётся в 'waiting_for_capture'

STEP 3: Пользователь возвращается на /pricing?payment=success
├─ Frontend: Проверяет sessionStorage.getItem('pendingPaymentId')
├─ Frontend: Вызывает GET /api/payment/check
├─ Backend: ЮKassa вернула 'waiting_for_capture' или 'pending'
└─ Frontend: setPaymentCheck({ status: 'pending', message: '...' })

STEP 4: Статус "обновите через минуту" ОСТАЁТСЯ
├─ Если пользователь закроет вкладку → потеряется
├─ Если пользователь обновит страницу → очистится (новый component)
├─ Если пользователь ждёт 30 мин → recentDone check найдёт ошибку
└─ ВЕЧНО: Payment.status остаётся 'pending' в БД

STEP 5: Спустя 24 часа
└─ ЮKassa отменит платёж → webhook с 'canceled'
    └─ Backend: updateMany({ status: 'failed' })
        └─ Но затем платёж ЗАБЫЕТСЯ в БД
```

---

## 6. ПОДРОБНЫЙ АНАЛИЗ РИСКОВ

### 🔴 РИСК #1: Double-click создаст 2+ платежа (КРИТИЧЕН)

**Вероятность:** 🔴 Гарантирована
**Воздействие:** 💰 Финансовый убыток, страхование

**Сценарий:**
```javascript
User clicks "Купить" → Response delay (1-2 сек)
User clicks "Купить" снова (потому что не видит реакции)

Request 1: POST /api/payment/create → Payment 1 created, id=xyz1
Request 2: POST /api/payment/create → Payment 2 created, id=xyz2
Request 3: POST /api/payment/create → Payment 3 created, id=xyz3

sessionStorage содержит только xyz3!

Результат:
- Все три платежи в БД со status='pending'
- sessionStorage.getItem('pendingPaymentId') = 'xyz3'
- Если xyz2 будет завершён → токены зачислены
- Если xyz1 и xyz3 остались pending → зависнут
```

**Почему нет защиты:**
- ❌ Нет disabled state на кнопке
- ❌ Нет loading флага
- ❌ Нет debounce/throttle
- ❌ Нет проверки на существующий recent pending платёж
- ❌ sessionStorage может быть перезаписан

**Fix:**
```javascript
const [isLoading, setIsLoading] = useState(false);

const handleBuy = async (packageId) => {
  if (isLoading) return; // ← Guard
  setIsLoading(true);
  try {
    const res = await fetch('/api/payment/create', ...);
    // ...
  } finally {
    setIsLoading(false);
  }
};

<button disabled={isLoading} onClick={...}>
  {isLoading ? 'Обработка...' : 'Купить'}
</button>
```

---

### 🔴 РИСК #2: Платёж зависнет 'pending' навсегда (КРИТИЧЕН)

**Вероятность:** 🔴 При любом сбое webhook
**Воздействие:** 🔴 БД засоряется, пользователь не может оплатить

**Сценарий:**
```
1. Пользователь оплатил → ЮKassa вернула 'succeeded'
2. ЮKassa отправляет webhook на /api/payment/webhook
3. Network error → webhook не доходит
4. Backend никогда не получит уведомление
5. Payment.status остаётся 'pending' НАВСЕГДА
6. Через 30 дней: запись всё ещё в БД
```

**Почему нет защиты:**
- ❌ Нет cleanup cron job'а
- ❌ Нет timeout логики
- ❌ Нет retry queue для webhook'ов
- ❌ Нет autoupdate из ЮKassa API

**Последствия:**
- 📈 БД растёт на сотни мёртвых платежей
- 🔴 Пользователь может запустить второй платёж, третий...
- 💾 Мусор в базе

**Fix:**
```javascript
// 1. Добавить cleanup cron job
setInterval(async () => {
  const hour = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const expired = await Payment.updateMany(
    { status: 'pending', createdAt: { $lt: hour } },
    { status: 'expired' }
  );
  logger.info(`Cleanup: ${expired.modifiedCount} expired payments`);
}, 60 * 60 * 1000); // Every hour
```

---

### 🔴 РИСК #3: Webhook не обработается, платёж потеряется (ВЫСОКИЙ)

**Вероятность:** 🟠 При сетевых ошибках
**Воздействие:** 🔴 Пользователь не получит токены, хотя деньги списаны

**Сценарий:**
```
1. ЮKassa отправляет webhook на /api/payment/webhook
2. applySuccessfulPayment() начинает транзакцию
3. Balance.findOneAndUpdate() успешен
4. Subscription.findOneAndUpdate() успешен
5. Payment.findOneAndUpdate() — ERROR (e.g., DB connection lost)
6. session.abortTransaction() откатывает ВСЁ
7. ЮKassa не знает, что webhook failed
8. Retry не произойдёт

Результат: Пользователь оплатил, но токены не получил
```

**Почему нет защиты:**
- ❌ Нет webhook delivery queue (e.g., Redis, Bull)
- ❌ Нет retry logic для webhook'ов
- ❌ Нет webhook history/logging
- ❌ ЮKassa отправляет webhook один раз

**Fix:** Использовать message queue (Bull/RabbitMQ)

---

### 🟠 РИСК #4: Frontend state потеряется при закрытии вкладки (ВЫСОКИЙ)

**Вероятность:** 🟠 Часто
**Воздействие:** 🟠 UX проблема, пользователь не узнает статус

**Сценарий:**
```
1. Пользователь заканчивает платёж на ЮKassa
2. Редиректится на /pricing?payment=success
3. Frontend: setPaymentCheck({ status: 'ok' })
4. Пользователь закрывает вкладку
5. Вернулся на сайт → заново открыл Pricing
6. Component переинициализировался → paymentCheck = null
7. Бейдж исчез, пользователь не знает статус платежа
```

**Почему это проблема:**
- ❌ Бейдж хранится только в component state
- ❌ Информация теряется при refresh'е
- ❌ Пользователь не может увидеть историю

**Fix:** Использовать localStorage
```javascript
const [paymentCheck, setPaymentCheck] = useState(() => {
  const saved = localStorage.getItem('paymentCheck');
  return saved ? JSON.parse(saved) : null;
});

useEffect(() => {
  if (paymentCheck) {
    localStorage.setItem('paymentCheck', JSON.stringify(paymentCheck));
  } else {
    localStorage.removeItem('paymentCheck');
  }
}, [paymentCheck]);
```

---

### 🟠 РИСК #5: Нет cleanup процесса для БД (ВЫСОКИЙ)

**Вероятность:** 🔴 Гарантирован при длительной работе
**Воздействие:** 📈 БД растёт, performance деградирует

**Сценарий:**
```
После 1 года работы:
- 100 пользователей
- Средний 3 платежа на пользователя (один не завершился)
- Payment collection: 300 записей
- 100 записей со status='pending' (мусор)
- Query { userId, status: 'pending' } всегда медленнее

Через 5 лет:
- 50000 платежей, 15000 'pending'
- Индекс не поможет
- Collection размер: МБ → ГБ
```

**Почему нет защиты:**
- ❌ Нет TTL index на Payment
- ❌ Нет cron job для cleanup
- ❌ Нет архивирования старых платежей

---

## 7. ВСЕ ВОЗМОЖНЫЕ СТАТУСЫ И ПЕРЕХОДЫ

```
┌────────────────────────────────────────────────────────────┐
│                  PAYMENT STATUS MACHINE                    │
├────────────────────────────────────────────────────────────┤
│                                                              │
│                          ┌──────────┐                       │
│                    ┌───→ │SUCCEEDED │ ← SUCCESS              │
│                    │     └──────────┘   (webhook)           │
│                    │                                          │
│     ┌─────────┐   │                                          │
│     │ PENDING │ ──┤                                          │
│     └─────────┘   │     ┌────────┐                          │
│         ↑         └───→ │ FAILED │ ← CANCELED               │
│         │               └────────┘   (webhook)              │
│         │                                                    │
│      (create)                                                │
│                                                              │
│     ┌─────────┐                                              │
│  ┌─ │ EXPIRED │ (auto, timeout 24h)                          │
│  │  └─────────┘                                              │
│  └─── (cleanup cron job) — НЕ РЕАЛИЗОВАНО                    │
│                                                              │
└────────────────────────────────────────────────────────────┘
```

**YOOKASSA Status → PAYMENT Status Mapping:**
```
YK: 'pending' → PAYMENT: 'pending'
YK: 'waiting_for_capture' → PAYMENT: 'pending'
YK: 'succeeded' → PAYMENT: 'succeeded'
YK: 'canceled' → PAYMENT: 'failed'
YK: 'timeout' (24h) → PAYMENT: 'expired' (НЕ РЕАЛИЗОВАНО)
```

---

## 8. ТАБЛИЦА ВСЕХ РИСКОВ

| № | Риск | Вероятность | Воздействие | Сложность Fix | Статус |
|---|------|------------|-----------|--------------|--------|
| 1 | Double-click платежи | 🔴 Высокая | 💰 Финансовый | 🟢 Низкая | КРИТИЧЕН |
| 2 | Зависание pending | 🔴 Высокая | 📈 БД растёт | 🟡 Средняя | КРИТИЧЕН |
| 3 | Webhook не обработается | 🟠 Средняя | 🔴 Платёж потеряется | 🔴 Высокая | КРИТИЧЕН |
| 4 | Frontend state потеряется | 🟠 Средняя | 🟠 UX проблема | 🟢 Низкая | ВЫСОКИЙ |
| 5 | Нет cleanup в БД | 🔴 Высокая | 📈 Деградация | 🟡 Средняя | ВЫСОКИЙ |
| 6 | 30-min polling limit | 🟡 Низкая | 🟠 UX проблема | 🟢 Низкая | СРЕДНИЙ |
| 7 | Нет email подтверждения | 🟡 Низкая | 🟠 UX проблема | 🟢 Низкая | СРЕДНИЙ |
| 8 | sessionStorage зависимость | 🟠 Средняя | 🟠 UX проблема | 🟢 Низкая | СРЕДНИЙ |

---

## 9. РЕКОМЕНДАЦИИ ПО ИСПРАВЛЕНИЮ

### Приоритет 1 (СРОЧНО):

**1.1 Защита от double-click**
```
Файл: client/src/routes/Pricing.tsx
Чанч: Добавить isLoading state на handleBuy
Время: 30 минут
```

**1.2 Проверка существующего pending платежа**
```
Файл: api/server/routes/payment.js (endpoint /create)
Чанч: Перед созданием платежа проверить Payment.findOne({ userId, status: 'pending', createdAt: { $gte: 30m } })
Время: 1 час
```

**1.3 Cleanup cron job**
```
Файл: api/server/services/cleanup.js или new file
Чанч: setInterval для Payment.updateMany({ status: 'pending', createdAt: { $lt: 24h } })
Время: 1 час
```

### Приоритет 2 (ВАЖНО):

**2.1 Persistent payment status**
```
Файл: client/src/routes/Pricing.tsx
Чанч: localStorage вместо component state
Время: 1 час
```

**2.2 Webhook retry queue**
```
Файл: Новый файл api/server/services/webhookQueue.js
Чанч: Использовать Bull или Redis для retry
Время: 4 часа
```

### Приоритет 3 (ВАЖНО):

**3.1 Email подтверждение**
```
Файл: api/server/routes/payment.js (applySuccessfulPayment)
Чанч: Отправлять email после успешного платежа
Время: 2 часа
```

**3.2 Payment model миграция**
```
Файл: api/models/Payment.js + migration
Чанч: Добавить expiresAt, retry_count fields
Время: 2 часа
```

---

## 10. ВЫВОДЫ И СЛЕДУЮЩИЕ ШАГИ

### Текущее состояние
✅ Платёжная система основанная функциональность работает
❌ Но есть 5 критичных проблем безопасности и надёжности

### Что нужно сделать немедленно
1. **ЗАВТРА:** Добавить disabled state на кнопку "Купить"
2. **ЗАВТРА:** Добавить проверку recent pending платежей
3. **НЕДЕЛЯ:** Реализовать cleanup cron job
4. **НЕДЕЛЯ:** Добавить localStorage для payment status
5. **МЕСЯЦ:** Реализовать webhook retry queue

### Что нужно контролировать
- Количество pending платежей в БД (должно быть близко к 0)
- Webhook delivery success rate (должно быть >99%)
- Double-click rate в analytics
- Payment processing time (в норме 5-30 сек)

### Последующие улучшения
- [ ] Admin dashboard для управления платежами
- [ ] Payment webhooks history/logs
- [ ] Automated refunds для 'expired' платежей
- [ ] Support для других платёжных провайдеров
- [ ] Payment analytics (conversion rate, avg payment time)

---

**Отчёт подготовлен:** 2026-03-10
**Автор:** Security Audit
**Статус:** Требует немедленного внимания
