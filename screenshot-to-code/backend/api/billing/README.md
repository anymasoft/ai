# Billing Module - ЮKassa Integration

## Статус: 🚧 В разработке

Этот модуль содержит заглушки для интеграции с ЮKassa.

## TODO

### 1. Установить зависимости

```bash
pip install yookassa
```

### 2. Создать таблицы БД

См. схему в `/YUKASSA_INTEGRATION.md`

```sql
- subscriptions
- payments
```

### 3. Создать endpoints

- [ ] `subscribe.py` - POST /api/billing/subscribe
- [ ] `topup.py` - POST /api/billing/buy-credits
- [ ] `webhook.py` - POST /api/billing/webhook
- [ ] `payments.py` - GET /api/billing/payment/:id
- [ ] `subscriptions.py` - POST /api/billing/cancel-subscription

### 4. Настроить конфигурацию

```bash
# backend/.env
YUKASSA_SHOP_ID=123456
YUKASSA_SECRET_KEY=live_xxxxxxxx
YUKASSA_WEBHOOK_SECRET=webhook_secret
FRONTEND_URL=https://screen2code.com
```

### 5. Подключить к main.py

```python
from api.billing import subscribe, topup, webhook, payments, subscriptions

app.include_router(subscribe.router)
app.include_router(topup.router)
app.include_router(webhook.router)
app.include_router(payments.router)
app.include_router(subscriptions.router)
```

## Документация

См. полную документацию в `/YUKASSA_INTEGRATION.md`
