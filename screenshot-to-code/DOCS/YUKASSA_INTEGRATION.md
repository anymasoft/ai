# ЮKassa Integration Plan для Screen2Code

## 🎯 Цель

Интегрировать ЮKassa для приёма платежей за подписки и дополнительные credits.

---

## 💰 Тарифы и Цены

### Подписки (рекуррентные платежи)

| Plan | Price | Credits/month | Renewal |
|------|-------|---------------|---------|
| Free | 0₽ | 500 | N/A |
| Basic | 2,490₽ | 5,000 | Ежемесячно |
| Professional | 8,490₽ | 25,000 | Ежемесячно |

**Пересчёт из долларов (курс ~86₽/$):**
- $29 → 2,490₽
- $99 → 8,490₽

### Разовые пакеты credits (топ-ап)

| Package | Credits | Price | Cost per credit |
|---------|---------|-------|-----------------|
| Starter | 1,000 | 990₽ | ~1₽ |
| Standard | 5,000 | 4,490₽ | ~0.9₽ |
| Premium | 15,000 | 11,990₽ | ~0.8₽ |

---

## 🏗️ Архитектура Интеграции

### Backend Endpoints (FastAPI)

```
POST   /api/billing/subscribe          - Создать подписку
POST   /api/billing/buy-credits        - Купить credits
POST   /api/billing/webhook            - Webhook от ЮKassa
GET    /api/billing/payment/:id        - Статус платежа
POST   /api/billing/cancel-subscription - Отменить подписку
```

### Database Schema

**Таблица `subscriptions`:**
```sql
CREATE TABLE subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    plan_id TEXT NOT NULL,  -- 'free', 'basic', 'professional'
    status TEXT NOT NULL,   -- 'active', 'cancelled', 'past_due'
    yukassa_subscription_id TEXT UNIQUE,
    current_period_start TIMESTAMP NOT NULL,
    current_period_end TIMESTAMP NOT NULL,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_yukassa ON subscriptions(yukassa_subscription_id);
```

**Таблица `payments`:**
```sql
CREATE TABLE payments (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,  -- 'subscription', 'topup'
    amount INTEGER NOT NULL,  -- в копейках (рублях * 100)
    credits_amount INTEGER,   -- сколько credits начислено
    status TEXT NOT NULL,     -- 'pending', 'succeeded', 'cancelled'
    yukassa_payment_id TEXT UNIQUE,
    yukassa_confirmation_url TEXT,
    metadata TEXT,  -- JSON with plan_id, package_id, etc
    created_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_payments_user ON payments(user_id);
CREATE INDEX idx_payments_yukassa ON payments(yukassa_payment_id);
```

---

## 🔄 Workflow

### 1. Подписка на План

**Клиент:**
```javascript
// Клик на Upgrade Plan
const response = await fetch('/api/billing/subscribe', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer USER_TOKEN' },
  body: JSON.stringify({
    plan_id: 'basic'  // или 'professional'
  })
});

const { payment_url } = await response.json();
// Редирект на payment_url (ЮKassa)
window.location.href = payment_url;
```

**Сервер (backend/api/billing/subscribe.py):**
```python
@router.post("/api/billing/subscribe")
async def create_subscription(
    request: SubscribeRequest,
    user = Depends(get_current_user)
):
    # 1. Проверить, нет ли уже активной подписки
    # 2. Получить plan_id и цену
    plan_price = PLAN_PRICES[request.plan_id]  # 249000 копеек

    # 3. Создать Payment в ЮKassa
    from yookassa import Payment, Configuration
    Configuration.account_id = YUKASSA_SHOP_ID
    Configuration.secret_key = YUKASSA_SECRET_KEY

    payment = Payment.create({
        "amount": {
            "value": f"{plan_price / 100:.2f}",  # 2490.00
            "currency": "RUB"
        },
        "confirmation": {
            "type": "redirect",
            "return_url": f"{FRONTEND_URL}/billing?status=success"
        },
        "capture": True,
        "description": f"Подписка {request.plan_id}",
        "metadata": {
            "user_id": user.id,
            "type": "subscription",
            "plan_id": request.plan_id
        }
    })

    # 4. Сохранить payment в БД
    save_payment(
        user_id=user.id,
        type="subscription",
        amount=plan_price,
        yukassa_payment_id=payment.id,
        yukassa_confirmation_url=payment.confirmation.confirmation_url,
        metadata={"plan_id": request.plan_id}
    )

    # 5. Вернуть URL для редиректа
    return {
        "payment_id": payment.id,
        "payment_url": payment.confirmation.confirmation_url
    }
```

### 2. Покупка Credits (Топ-ап)

**Клиент:**
```javascript
// Клик на Buy More Credits
const response = await fetch('/api/billing/buy-credits', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer USER_TOKEN' },
  body: JSON.stringify({
    package_id: 'standard'  // 5,000 credits за 4,490₽
  })
});

const { payment_url } = await response.json();
window.location.href = payment_url;
```

**Сервер (backend/api/billing/topup.py):**
```python
CREDIT_PACKAGES = {
    "starter": {"credits": 1000, "price": 99000},   # 990₽
    "standard": {"credits": 5000, "price": 449000}, # 4,490₽
    "premium": {"credits": 15000, "price": 1199000} # 11,990₽
}

@router.post("/api/billing/buy-credits")
async def buy_credits(
    request: BuyCreditsRequest,
    user = Depends(get_current_user)
):
    package = CREDIT_PACKAGES[request.package_id]

    # Создать Payment в ЮKassa
    payment = Payment.create({
        "amount": {
            "value": f"{package['price'] / 100:.2f}",
            "currency": "RUB"
        },
        "confirmation": {
            "type": "redirect",
            "return_url": f"{FRONTEND_URL}/billing?status=success"
        },
        "capture": True,
        "description": f"Покупка {package['credits']} credits",
        "metadata": {
            "user_id": user.id,
            "type": "topup",
            "package_id": request.package_id,
            "credits": package["credits"]
        }
    })

    # Сохранить в БД
    save_payment(
        user_id=user.id,
        type="topup",
        amount=package["price"],
        credits_amount=package["credits"],
        yukassa_payment_id=payment.id,
        yukassa_confirmation_url=payment.confirmation.confirmation_url,
        metadata={"package_id": request.package_id}
    )

    return {
        "payment_id": payment.id,
        "payment_url": payment.confirmation.confirmation_url
    }
```

### 3. Webhook от ЮKassa

**Endpoint (backend/api/billing/webhook.py):**
```python
@router.post("/api/billing/webhook")
async def yukassa_webhook(request: Request):
    # 1. Получить тело запроса
    body = await request.json()

    # 2. Проверить IP ЮKassa (whitelist)
    client_ip = request.client.host
    if client_ip not in YUKASSA_IPS:
        raise HTTPException(403, "Invalid IP")

    # 3. Извлечь данные
    event_type = body.get("event")  # 'payment.succeeded', 'payment.canceled'
    payment_data = body.get("object")
    payment_id = payment_data.get("id")
    status = payment_data.get("status")
    metadata = payment_data.get("metadata", {})

    # 4. Найти payment в БД
    payment = get_payment_by_yukassa_id(payment_id)
    if not payment:
        return {"status": "error", "message": "Payment not found"}

    # 5. Обработать событие
    if event_type == "payment.succeeded" and status == "succeeded":
        # Обновить payment
        update_payment_status(payment.id, "succeeded")

        # Начислить credits или активировать подписку
        if metadata.get("type") == "topup":
            # Начислить credits
            credits = metadata.get("credits")
            add_credits_to_user(payment.user_id, credits)

        elif metadata.get("type") == "subscription":
            # Активировать подписку
            plan_id = metadata.get("plan_id")
            activate_subscription(
                user_id=payment.user_id,
                plan_id=plan_id,
                yukassa_payment_id=payment_id
            )
            # Начислить стартовые credits
            plan_credits = PLAN_CREDITS[plan_id]
            set_user_credits(payment.user_id, plan_credits)

    elif event_type == "payment.canceled":
        update_payment_status(payment.id, "cancelled")

    return {"status": "ok"}
```

---

## 📂 Файловая Структура

```
backend/
├── api/
│   ├── billing/
│   │   ├── __init__.py
│   │   ├── subscribe.py      # POST /api/billing/subscribe
│   │   ├── topup.py           # POST /api/billing/buy-credits
│   │   ├── webhook.py         # POST /api/billing/webhook
│   │   ├── payments.py        # GET /api/billing/payment/:id
│   │   └── subscriptions.py   # POST /api/billing/cancel-subscription
│   ├── models/
│   │   ├── billing.py         # Pydantic models для billing
│   │   └── ...
│   └── ...
├── db/
│   ├── billing.py             # Функции для работы с subscriptions/payments
│   └── ...
└── config.py
    # YUKASSA_SHOP_ID
    # YUKASSA_SECRET_KEY
    # YUKASSA_WEBHOOK_SECRET
```

**Frontend:**
```
frontend/src/
├── app/
│   ├── settings/billing/
│   │   ├── page.tsx
│   │   └── components/
│   │       ├── buy-credits-dialog.tsx  # Диалог покупки credits
│   │       └── subscription-dialog.tsx # Диалог апгрейда плана
│   └── ...
└── logic/
    └── billing/
        ├── subscribe.ts       # Логика подписки
        └── topup.ts           # Логика покупки credits
```

---

## 🔐 Конфигурация

**backend/.env:**
```bash
# ЮKassa
YUKASSA_SHOP_ID=123456
YUKASSA_SECRET_KEY=live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
YUKASSA_WEBHOOK_SECRET=webhook_secret_key

# Frontend URL
FRONTEND_URL=https://screen2code.com
```

**Whitelist IP адресов ЮKassa:**
```python
YUKASSA_IPS = [
    "185.71.76.0/27",
    "185.71.77.0/27",
    "77.75.153.0/25",
    "77.75.156.11",
    "77.75.156.35",
    "77.75.154.128/25",
    "2a02:5180::/32"
]
```

---

## ✅ TODO List для Интеграции

### Backend

- [ ] **Установить SDK:**
  ```bash
  pip install yookassa
  ```

- [ ] **Создать таблицы БД:**
  - [ ] `subscriptions` table
  - [ ] `payments` table
  - [ ] Миграция в `backend/db/init_db.py`

- [ ] **Создать endpoints:**
  - [ ] `POST /api/billing/subscribe` - Создать подписку
  - [ ] `POST /api/billing/buy-credits` - Купить credits
  - [ ] `POST /api/billing/webhook` - Webhook обработчик
  - [ ] `GET /api/billing/payment/:id` - Статус платежа
  - [ ] `POST /api/billing/cancel-subscription` - Отменить подписку

- [ ] **Функции БД:**
  - [ ] `save_payment()` - Сохранить платёж
  - [ ] `update_payment_status()` - Обновить статус
  - [ ] `get_payment_by_yukassa_id()` - Найти платёж
  - [ ] `activate_subscription()` - Активировать подписку
  - [ ] `cancel_subscription()` - Отменить подписку
  - [ ] `add_credits_to_user()` - Начислить credits
  - [ ] `set_user_credits()` - Установить credits

- [ ] **Webhook Security:**
  - [ ] IP whitelist проверка
  - [ ] Signature verification (optional)

- [ ] **Cron Jobs:**
  - [ ] Renewal subscriptions (ежемесячно)
  - [ ] Check past_due payments
  - [ ] Reset credits на новый period

### Frontend

- [ ] **Компоненты:**
  - [ ] `BuyCreditsDialog.tsx` - Диалог покупки credits
  - [ ] `SubscriptionDialog.tsx` - Диалог апгрейда плана
  - [ ] `PaymentStatus.tsx` - Страница статуса платежа

- [ ] **Логика:**
  - [ ] `billing/subscribe.ts` - API calls для подписки
  - [ ] `billing/topup.ts` - API calls для топ-апа
  - [ ] `billing/cancel.ts` - Отмена подписки

- [ ] **Страницы:**
  - [ ] `/billing?status=success` - Success redirect
  - [ ] `/billing?status=cancelled` - Cancelled redirect

---

## 🧪 Тестирование

### Тестовые данные ЮKassa

**Тестовый магазин:**
- Shop ID: `123456` (из личного кабинета)
- Secret Key: `test_xxxxxx...` (из личного кабинета)

**Тестовые карты:**
```
Успешный платёж:
5555 5555 5555 4477
MM/YY: 12/24
CVC: 123

Отклонённый платёж:
5555 5555 5555 5599
```

### Тестовый webhook

```bash
curl -X POST http://localhost:7001/api/billing/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "type": "notification",
    "event": "payment.succeeded",
    "object": {
      "id": "test_payment_id",
      "status": "succeeded",
      "paid": true,
      "amount": {
        "value": "2490.00",
        "currency": "RUB"
      },
      "metadata": {
        "user_id": "user_123",
        "type": "subscription",
        "plan_id": "basic"
      }
    }
  }'
```

---

## 📊 Мониторинг и Логи

### Важные метрики

- Конверсия подписок (trial → paid)
- Churn rate (отписки)
- Average revenue per user (ARPU)
- Failed payments rate

### Логирование

```python
import logging

logger = logging.getLogger("billing")

# В каждом endpoint
logger.info(f"Payment created: {payment.id} for user {user.id}")
logger.info(f"Subscription activated: {subscription.id}")
logger.warning(f"Payment failed: {payment.id}")
logger.error(f"Webhook processing error: {error}")
```

---

## 🔒 Безопасность

1. **HTTPS only** - все endpoints только через HTTPS
2. **IP Whitelist** - webhook только от ЮKassa IP
3. **Idempotency** - обработка дублирующихся webhook'ов
4. **Database transactions** - атомарные операции начисления credits
5. **Rate limiting** - защита webhook endpoint
6. **Логи audit** - все операции с деньгами логируются

---

## 💡 Дополнительные Фичи (опционально)

### 1. Промокоды

```sql
CREATE TABLE promo_codes (
    code TEXT PRIMARY KEY,
    discount_percent INTEGER,
    max_uses INTEGER,
    used_count INTEGER DEFAULT 0,
    expires_at TIMESTAMP,
    created_at TIMESTAMP
);
```

### 2. Реферальная программа

```sql
CREATE TABLE referrals (
    id TEXT PRIMARY KEY,
    referrer_id TEXT NOT NULL,
    referred_id TEXT NOT NULL,
    bonus_credits INTEGER DEFAULT 1000,
    created_at TIMESTAMP,
    FOREIGN KEY (referrer_id) REFERENCES users(id),
    FOREIGN KEY (referred_id) REFERENCES users(id)
);
```

### 3. Trial period (7 дней)

```python
# При регистрации
if new_user:
    activate_subscription(
        user_id=user.id,
        plan_id="basic",
        trial_until=datetime.now() + timedelta(days=7)
    )
```

---

## 📝 Резюме

**Минимальная интеграция (MVP):**
1. Подписки Basic/Professional
2. Разовая покупка credits
3. Webhook обработка
4. Базовая отмена подписки

**Оценка времени:**
- Backend: 3-4 дня
- Frontend: 2-3 дня
- Тестирование: 1-2 дня
- **Итого:** ~1 неделя

**Стоимость ЮKassa:**
- Комиссия: 2.8% + 10₽ за операцию
- Без абонентки
- Вывод средств: бесплатно

---

Документация готова к использованию. Начните с создания тестового магазина в ЮKassa и получения API ключей.
