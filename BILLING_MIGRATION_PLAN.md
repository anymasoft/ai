# 📋 План переноса финансовой инфраструктуры из ai/beem в Video AI

## 1️⃣ АНАЛИЗ ТЕКУЩЕЙ СИСТЕМЫ В ai/beem

### Database Schema

**Таблица users** - основные данные пользователя
```
id TEXT PRIMARY KEY
email TEXT UNIQUE
name TEXT
image TEXT
role TEXT (default: 'user') - может быть 'admin'
plan TEXT (default: 'free') - может быть 'free', 'basic', 'pro', 'enterprise'
generation_balance INTEGER - текущие кредиты
generation_used INTEGER - всего использовано кредитов
createdAt INTEGER (unix timestamp)
updatedAt INTEGER (unix timestamp)
disabled INTEGER (0 или 1)
```

**Таблица packages** - тарифные пакеты для покупки
```
key TEXT PRIMARY KEY ('basic', 'pro', 'enterprise')
title TEXT
price_rub INTEGER - цена в рублях
generations INTEGER - сколько кредитов в пакете
is_active INTEGER (0 или 1)
created_at INTEGER
updated_at INTEGER
```

**Таблица payments** - история платежей через ЮКассу
```
id TEXT PRIMARY KEY (внутренний ID)
externalPaymentId TEXT UNIQUE (ID от ЮКассы)
userId TEXT - кому принадлежит платёж
packageKey TEXT - какой пакет покупали
amount REAL - сумма в рублях
currency TEXT (default: 'RUB')
status TEXT ('pending' → 'succeeded')
provider TEXT (default: 'yookassa')
createdAt INTEGER
updatedAt INTEGER
```

**Таблица admin_subscriptions** - переопределение подписок вручную (admin)
```
userId TEXT PRIMARY KEY
plan TEXT (default: 'free')
isPaid INTEGER (0 или 1)
expiresAt INTEGER (nullable)
provider TEXT (default: 'manual')
updatedAt INTEGER
```

---

## 2️⃣ API ENDPOINTS В ai/beem

### Платежи (Yookassa)
- `POST /api/payments/yookassa/create` - создать платёж (запрашивает packageKey)
- `POST /api/payments/yookassa/webhook` - webhook от ЮКассы (payment.succeeded)
- `POST /api/payments/yookassa/check` - проверить статус платежа
- `GET /api/payments/user-history` - история платежей текущего юзера

### Администратор
- `GET /api/admin/users` - список всех пользователей с балансом
- `PATCH /api/admin/users` - изменить generation_balance/generation_used
- `PATCH /api/admin/user-balance` - изменить баланс конкретного юзера (balanceDelta или resetBalance)
- `GET /api/admin/payments` - история всех платежей
- `GET /api/admin/payments/by-id` - детали платежа по ID

### Получение данных пользователя
- `GET /api/user` - информация о текущем пользователе (включая generation_balance)

---

## 3️⃣ КЛЮЧЕВАЯ ЛОГИКА

### Поток пополнения баланса
1. Юзер нажимает "Upgrade" → POST `/api/payments/yookassa/create`
2. Выбирает пакет (basic/pro/enterprise)
3. Получает ссылку на платёж ЮКассы
4. После оплаты ЮКасса отправляет webhook → `POST /api/payments/yookassa/webhook`
5. Функция `applySuccessfulPayment()` в `/lib/payments.ts`:
   - Находит платёж в БД по externalPaymentId
   - Проверяет, что status === 'pending' (идемпотентна)
   - Берёт количество генераций из packages таблицы
   - **Увеличивает users.generation_balance** на это количество
   - Обновляет payments.status = 'succeeded'

### Поток списания баланса
- Функция `deductCredits(userId, amount)` в `/lib/billing/deductCredits.ts`:
  - Проверяет, что users.generation_balance >= amount
  - Если нет → возвращает { success: false, error: 'INSUFFICIENT_BALANCE' }
  - Если да → атомарное UPDATE:
    - `generation_balance = generation_balance - amount`
    - `generation_used = generation_used + amount`
  - ВАЖНО: вызывается ТОЛЬКО после успешного завершения операции

### Admin управление балансом
- `PATCH /api/admin/user-balance`:
  - Проверяет role === 'admin'
  - Может resetBalance (обнулить баланс)
  - Может изменить balanceDelta (прибавить/вычесть)

---

## 4️⃣ ТЕКУЩЕЕ СОСТОЯНИЕ Video AI

### Что есть ✅
- Google OAuth (файл src/lib/auth.ts)
- Таблица users в SQLite (better-sqlite3)
- Навбар с Display "Credits remaining" и кнопкой Upgrade
- Admin panel (/admin) - но с мок-данными
- Страница /billing (Upgrade Your Account)

### Чего НЕ хватает ❌
- Таблица packages (тарифные пакеты)
- Таблица payments (история платежей)
- Таблица admin_subscriptions (опционально, но нужна)
- API endpoints для платежей (create, webhook, check)
- API endpoints для админки (users, user-balance, payments)
- Функция deductCredits для списания кредитов
- Функция applySuccessfulPayment для пополнения баланса

---

## 5️⃣ ПЛАН ДЕЙСТВИЙ

### A) Обновить Database (src/lib/db.ts)
- ✅ Таблица users уже есть (но нужно добавить поля):
  - generation_balance
  - generation_used
- ➕ Создать таблицу packages (с стартовыми пакетами)
- ➕ Создать таблицу payments
- ➕ Создать таблицу admin_subscriptions (опционально)

### B) Создать библиотеки функций
- ➕ `/src/lib/payments.ts` - функция applySuccessfulPayment()
- ➕ `/src/lib/billing/deductCredits.ts` - функция deductCredits()

### C) Создать API endpoints
- ➕ `/src/pages/api/payments/yookassa/create.ts` - создать платёж
- ➕ `/src/pages/api/payments/yookassa/webhook.ts` - webhook от ЮКассы
- ➕ `/src/pages/api/admin/users.ts` - GET список юзеров
- ➕ `/src/pages/api/admin/user-balance.ts` - PATCH баланс

### D) Обновить Frontend
- Обновить `/src/pages/billing.astro` - интегрировать реальный платёж
- Обновить `/src/components/AppNavbar.astro` - отображать реальный баланс
- Обновить `/src/pages/admin.astro` - подключить реальные данные и CRUD операции

### E) Добавить environment variables
- YOOKASSA_SHOP_ID
- YOOKASSA_API_KEY
- AUTH_URL (для webhook redirect)

---

## 6️⃣ ПОРЯДОК РЕАЛИЗАЦИИ

### Фаза 1: Database (CRITICAL)
1. Проверить, есть ли уже в users: generation_balance, generation_used
2. Если нет → добавить миграцию
3. Создать таблицы: packages, payments

### Фаза 2: Функции обработки денег
1. Скопировать/адаптировать applySuccessfulPayment()
2. Скопировать/адаптировать deductCredits()

### Фаза 3: API endpoints
1. create payment (POST /api/payments/yookassa/create)
2. webhook (POST /api/payments/yookassa/webhook)
3. admin endpoints (GET /api/admin/users, PATCH /api/admin/user-balance)

### Фаза 4: Frontend
1. Обновить navbар чтобы показывал реальный баланс
2. Обновить /billing чтобы интегрировал платёж
3. Обновить /admin чтобы управлял реальными юзерами

---

## 7️⃣ ВАЖНЫЕ ПРАВИЛА

🔴 **КРИТИЧНО:**
- generation_balance НИКОГДА не может быть отрицательным
- deductCredits() ВСЕГДА проверяет баланс ДО UPDATE
- applySuccessfulPayment() ИДЕМПОТЕНТНА (можно вызывать много раз)
- Webhook обрабатывает ТОЛЬКО payment.succeeded события
- Admin endpoint проверяет role === 'admin'

🟡 **РЕКОМЕНДАЦИИ:**
- Использовать транзакции где возможно
- Все даты в unix timestamp (Math.floor(Date.now() / 1000))
- Логировать все операции с деньгами
- Не трогать логику генерации видео
- Оставить Google OAuth как есть

---

## 8️⃣ ТЕХНИЧЕСКИЕ РАЗЛИЧИЯ (Astro vs Next.js)

| Aspekt | ai/beem (Next.js) | Video AI (Astro) |
|--------|------------------|-----------------|
| DB | libsql/client | better-sqlite3 |
| Auth | NextAuth | Custom OAuth |
| API routes | /app/api/... | /pages/api/... |
| Types | TypeScript full | TypeScript + Astro |
| Middleware | Next.js middleware | Astro middleware |

**ВАЖНО:** Логика бизнеса одна и та же, только синтаксис немного отличается!

---

## ✅ РЕЗУЛЬТАТ

После завершения:
- 💳 Любой пользователь может купить пакет кредитов через ЮКассу
- 🔄 Баланс пополняется автоматически после платежа
- 📊 Admin может видеть всех юзеров и управлять их балансом
- 🎬 Кнопка Generate (позже) будет проверять generation_balance > 0
- 📈 Финансовая система работает как в проверенном ai/beem

