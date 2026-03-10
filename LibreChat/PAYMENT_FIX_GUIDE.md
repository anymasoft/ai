# ПОШАГОВОЕ РУКОВОДСТВО ПО ИСПРАВЛЕНИЮ ПЛАТЁЖНОЙ СИСТЕМЫ

## БЫСТРОЕ РЕЗЮМЕ ДЛЯ РАЗРАБОТЧИКА

### 🔴 Критичные проблемы (исправить в течение 48 часов)

1. **Double-click создаёт 2+ платежа**
   - Проблема: Нет disabled state на кнопке
   - Файл: `client/src/routes/Pricing.tsx` (строка 253-274)
   - Решение: Добавить `isLoading` state + disabled attribute
   - Время: 30 минут

2. **Платёж может зависнуть pending навсегда**
   - Проблема: Нет cleanup cron job'а
   - Файл: `api/server/cleanup.js` или новый файл
   - Решение: setInterval для обновления старых pending платежей
   - Время: 1 час

3. **Webhook может не обработаться**
   - Проблема: Нет retry logic'и
   - Файл: `api/server/routes/payment.js` (строка 422-485)
   - Решение: Использовать message queue (Bull/Redis)
   - Время: 4 часа

---

## РЕШЕНИЕ 1: Защита от Double-Click ⏱️ 30 минут

**Файл:** `client/src/routes/Pricing.tsx`

```javascript
// ШАГ 1: Добавить isLoading state (рядом с paymentCheck)
const [isLoading, setIsLoading] = useState(false);

// ШАГ 2: Модифицировать handleBuy функцию
const handleBuy = async (packageId: string) => {
  if (isLoading) return; // ← ЗАЩИТА: Игнорируем клики если уже обрабатываем

  setIsLoading(true);
  try {
    const res = await fetch('/api/payment/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ packageId }),
      credentials: 'include',
    });
    const data = await res.json();
    if (data.confirmationUrl) {
      if (data.paymentId) sessionStorage.setItem('pendingPaymentId', data.paymentId);
      window.location.href = data.confirmationUrl;
    } else {
      alert(data.error || 'Ошибка создания платежа');
      setIsLoading(false);
    }
  } catch (err) {
    alert('Ошибка соединения с сервером');
    setIsLoading(false);
  }
};

// ШАГ 3: Обновить кнопку "Купить" (найти оба места где вызывается handleBuy)
<button
  onClick={() => handleBuy(plan.planId)}
  disabled={isLoading}  // ← ДОБАВИТЬ: Отключить при обработке
  className={`w-full rounded-xl py-2.5 text-sm font-semibold transition-colors ${
    isLoading ? 'opacity-50 cursor-not-allowed' : ''  // ← ДОБАВИТЬ: Стили для disabled
  } ${
    style.highlight
      ? 'bg-blue-600 text-white hover:bg-blue-700'
      : 'bg-gray-900 text-white hover:bg-gray-700 dark:bg-white dark:text-gray-900'
  }`}
>
  {isLoading ? '⏳ Обработка...' : (currentPlan === plan.planId ? 'Продлить подписку' : 'Купить')}
</button>

// ТАКЖЕ обновить кнопку для token packages (строка ~518)
<button
  onClick={() => handleBuy(pkg.packageId)}
  disabled={isLoading}  // ← ДОБАВИТЬ
  className="flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
>
  <Plus className="size-4" />
  {isLoading ? 'Обработка...' : 'Купить'}
</button>
```

**✅ После этого:** Пользователь не сможет создать 2+ платежа одним быстрым кликом

---

## РЕШЕНИЕ 2: Cleanup Cron Job ⏱️ 1 час

**Файл 1:** `api/server/cleanup.js` (в конец файла)

```javascript
// Добавить новую функцию перед module.exports

/**
 * Cleanup старых pending платежей (старше 24 часов)
 * Вызывается каждый час
 */
async function cleanupExpiredPayments() {
  try {
    const Payment = require('~/models/Payment');
    const { logger } = require('@librechat/data-schemas');

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const result = await Payment.updateMany(
      {
        status: 'pending',
        createdAt: { $lt: twentyFourHoursAgo }
      },
      {
        status: 'expired',
        updatedAt: new Date()
      }
    );

    if (result.modifiedCount > 0) {
      logger.info(`[Cleanup] Expired ${result.modifiedCount} old pending payments`);
    }
  } catch (err) {
    const { logger } = require('@librechat/data-schemas');
    logger.error('[Cleanup] Error cleaning up expired payments:', err);
  }
}

// В module.exports добавить:
module.exports = {
  cleanupOrphanedFiles,
  cancelExpiredRuns,
  cleanupExpiredTokens,
  cleanupExpiredPayments  // ← ДОБАВИТЬ
};
```

**Файл 2:** `api/server/index.js` (найти где импортируются cleanup функции)

```javascript
// Найти строку:
const {
  cleanupOrphanedFiles,
  cancelExpiredRuns,
  cleanupExpiredTokens
} = require('./cleanup');

// Изменить на:
const {
  cleanupOrphanedFiles,
  cancelExpiredRuns,
  cleanupExpiredTokens,
  cleanupExpiredPayments  // ← ДОБАВИТЬ
} = require('./cleanup');

// Найти где вызываются setInterval'ы (обычно ниже в файле):
setInterval(cleanupOrphanedFiles, 30 * 60 * 1000); // 30 min
setInterval(cancelExpiredRuns, 60 * 60 * 1000);    // 1 hour
setInterval(cleanupExpiredTokens, 24 * 60 * 60 * 1000); // 24 hours

// И добавить:
setInterval(cleanupExpiredPayments, 60 * 60 * 1000); // 1 hour (каждый час)
```

**✅ После этого:** Старые pending платежи автоматически помечаются как 'expired' через 24 часа

---

## РЕШЕНИЕ 3: Проверка Existing Pending ⏱️ 1 час

**Файл:** `api/server/routes/payment.js`

**Найти функцию:**
```javascript
router.post('/create', requireJwtAuth, async (req, res) => {
  try {
    await ensureSeeded();
    const { packageId } = req.body;
    const userId = req.user._id;

    // ← ВСТАВИТЬ СЮДА (ПОСЛЕ этих строк, ДО валидации packageId)
```

**Вставить код:**
```javascript
    // ✅ НОВОЕ: Проверить существующий pending платёж
    const recentPending = await Payment.findOne({
      userId,
      status: 'pending',
      createdAt: { $gte: new Date(Date.now() - 30 * 60 * 1000) } // за последние 30 минут
    }).lean();

    if (recentPending) {
      logger.warn(`[payment/create] User ${userId} has recent pending payment: ${recentPending.externalPaymentId}`);
      return res.status(400).json({
        error: 'У вас уже есть незавершённый платёж. Завершите его или дождитесь истечения (30 минут).'
      });
    }
```

**✅ После этого:** Пользователь не сможет создать новый платёж если у него есть незавершённый платёж менее 30 минут назад

---

## РЕШЕНИЕ 4: Persistent Payment Status ⏱️ 30 минут

**Файл:** `client/src/routes/Pricing.tsx`

**Найти строку с paymentCheck state:**
```javascript
const [paymentCheck, setPaymentCheck] = useState<
  { status: 'checking' | 'ok' | 'error' | 'pending'; message?: string } | null
>(null);
```

**Изменить на:**
```javascript
const [paymentCheck, setPaymentCheck] = useState<
  { status: 'checking' | 'ok' | 'error' | 'pending'; message?: string } | null
>(() => {
  // Восстановить из sessionStorage при инициализации
  const saved = sessionStorage.getItem('paymentCheck');
  try {
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
});
```

**Добавить useEffect для сохранения (после остальных useEffect'ов):**
```javascript
// Сохранять paymentCheck в sessionStorage при изменении
useEffect(() => {
  if (paymentCheck) {
    sessionStorage.setItem('paymentCheck', JSON.stringify(paymentCheck));
  } else {
    sessionStorage.removeItem('paymentCheck');
  }
}, [paymentCheck]);
```

**✅ После этого:** Бейдж о платеже сохранится в sessionStorage и вернётся при refresh'е

---

## РЕШЕНИЕ 5: Webhook Retry Logic ⏱️ 4 часа (Advanced)

**Файл:** `api/server/routes/payment.js`

**Добавить новую функцию перед module.exports (в конец файла перед экспортом):**

```javascript
/**
 * Applies payment with retry logic for webhook resilience
 */
async function applySuccessfulPaymentWithRetry(paymentId, maxRetries = 3) {
  const retryDelays = [5000, 15000, 30000]; // 5s, 15s, 30s delays
  const { logger } = require('@librechat/data-schemas');

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await applySuccessfulPayment(paymentId);

      if (result.ok) {
        return result;
      }

      // Если ok=false но не из-за ошибки БД, не retry'им
      if (!result.message.includes('Ошибка при') && !result.message.includes('Failed')) {
        return result;
      }
    } catch (err) {
      logger.error(`[payment/apply-retry] Attempt ${attempt + 1}/${maxRetries} failed:`, err.message);

      if (attempt < maxRetries - 1) {
        const delay = retryDelays[attempt];
        logger.info(`[payment/apply-retry] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        logger.error(`[payment/apply-retry] All ${maxRetries} attempts failed for payment ${paymentId}`);
        return {
          ok: false,
          message: `Ошибка после ${maxRetries} попыток: ${err.message}`
        };
      }
    }
  }
}
```

**Найти в webhook функции:**
```javascript
    if (payment.status === 'succeeded') {
      const result = await applySuccessfulPayment(payment.id);
```

**Изменить на:**
```javascript
    if (payment.status === 'succeeded') {
      const result = await applySuccessfulPaymentWithRetry(payment.id);
```

**✅ После этого:** Если webhook обработается с ошибкой, система автоматически повторит попытку 3 раза

---

## ТЕСТИРОВАНИЕ ВСЕХ ИСПРАВЛЕНИЙ

### Тест 1: Double-click защита ✅ (5 минут)

```bash
# 1. Открыть https://yoursite/pricing
# 2. Открыть DevTools (F12) → Network tab
# 3. Нажать кнопку "Купить" быстро 3 раза
# 4. Проверить сетевые запросы

✅ ОЖИДАЕТСЯ: Только 1 POST /api/payment/create запрос
❌ БЫЛО ДО: 3 POST запроса
```

### Тест 2: Cleanup Job ✅ (10 минут)

```bash
# 1. Открыть MongoDB (mongosh)
# 2. Создать тестовые платежи с древней датой:

mongosh> use librechat_db
mongosh> db.payments.insertMany([
  {
    externalPaymentId: "test1",
    userId: ObjectId("..."),
    status: "pending",
    createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000)
  },
  {
    externalPaymentId: "test2",
    userId: ObjectId("..."),
    status: "pending",
    createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000)
  },
  {
    externalPaymentId: "test3",
    userId: ObjectId("..."),
    status: "pending",
    createdAt: new Date(Date.now() - 10 * 60 * 1000)
  }
])

# 3. Дождаться следующего часа ИЛИ пересоздать сервер
# 4. Проверить результаты:

mongosh> db.payments.find({ status: { $in: ["expired", "pending"] } })

✅ ОЖИДАЕТСЯ:
  - 2 платежа со status: "expired" (test1, test2)
  - 1 платёж со status: "pending" (test3)

❌ БЫЛО ДО:
  - Все 3 остаются со status: "pending" навсегда
```

### Тест 3: Existing pending check ✅ (10 минут)

```bash
# 1. Открыть https://yoursite/pricing в браузере
# 2. Нажать "Купить" на любом пакете
# 3. На странице оплаты ЗАКРЫТЬ вкладку (не платить)
# 4. Попытаться создать ещё один платёж в течение 30 минут

✅ ОЖИДАЕТСЯ:
  - Alert: "У вас уже есть незавершённый платёж..."
  - Новый платёж НЕ создаётся

❌ БЫЛО ДО:
  - Второй платёж создаётся
```

---

## ФИНАЛЬНЫЙ КОНТРОЛЬНЫЙ СПИСОК

Перед деплоем убедитесь что:

### Frontend (Pricing.tsx)
- [ ] Добавлен `isLoading` state
- [ ] `handleBuy` функция имеет guard `if (isLoading) return`
- [ ] Обе кнопки имеют `disabled={isLoading}`
- [ ] Стили для disabled state добавлены
- [ ] PaymentCheck использует sessionStorage
- [ ] useEffect для сохранения paymentCheck добавлен

### Backend (payment.js & cleanup.js)
- [ ] Функция `cleanupExpiredPayments()` добавлена в cleanup.js
- [ ] Import'ы обновлены в index.js
- [ ] setInterval вызов добавлен в index.js
- [ ] Проверка `recentPending` добавлена в /create endpoint
- [ ] (опционально) Функция `applySuccessfulPaymentWithRetry()` добавлена
- [ ] (опционально) Webhook использует retry функцию

### Тестирование
- [ ] Тест 1 пройден (double-click)
- [ ] Тест 2 пройден (cleanup)
- [ ] Тест 3 пройден (existing pending)

### Deployment
- [ ] Изменения закоммичены в git
- [ ] Code review пройден
- [ ] Изменения задеплоены в staging
- [ ] Smoke тесты прошли
- [ ] Изменения задеплоены в production
- [ ] Мониторинг включен для отслеживания платежей

---

## ОЖИДАЕМЫЕ РЕЗУЛЬТАТЫ

### ДО исправлений:
```
❌ Пользователь может создать 2+ платежа один click
❌ Старые pending платежи засоряют БД (растут на сотни в год)
❌ Webhook ошибка → платёж потеряется (немедленно)
❌ Бейдж о статусе исчезнет при refresh (потеря информации)
⚠️  Нет контроля над зависшими платежами
```

### ПОСЛЕ исправлений:
```
✅ Защита от double-click (disabled button)
✅ Автоматическая очистка старых платежей (every 1 hour)
✅ Webhook retry logic (up to 3 attempts)
✅ Persistent payment status (sessionStorage)
✅ Проверка existing pending (prevent duplicates)
```

---

## ДОПОЛНИТЕЛЬНЫЕ РЕКОМЕНДАЦИИ

### На будущее (не срочно):
1. **Email confirmation** — отправлять пользователю после успешного платежа
2. **Admin dashboard** — просмотр/управление платежами
3. **Payment analytics** — tracking conversion rate, average payment time
4. **Message queue** — для webhook'ов (Bull, RabbitMQ)
5. **Monitoring alerts** — оповещение при сбое платежа

---

**Статус:** Готово к имплементации
**Время на имплементацию:** ~5-6 часов (для всех 5 решений)
**Приоритет:** 🔴 КРИТИЧНЫЙ (особенно Решения 1-3)
