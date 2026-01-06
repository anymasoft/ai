# Проверка синхронизации отображения тариф (План Синхронизации)

## Проблема, которая была решена

**Симптом:** Одного и того же пользователя видели разные значения тариф:
- В ЛК (User UI): Basic
- В админке (Admin UI): Free

**Корневая причина:** Функция `getUserPaymentInfo()` была auto-downgrading план при ЧТЕНИИ:
- Если `expiresAt < now` → план = 'free'
- Если `monthlyUsage >= limit` → план = 'free'
- Это происходило при каждом запросе, что приводило к несогласованности

**Нарушение правила:** Функции ЧТЕНИЯ НЕ должны мутировать данные

## Архитектура решения

### 1. Источник Истины
- **Единственный источник:** таблица `users.plan` в базе данных
- **Уровень слоя:** все читают напрямую из БД, БЕЗ кэширования

### 2. Слои Доступа

#### Слой 1: Читающие функции (PURE READ)
Эти функции читают и возвращают данные как они есть в БД, БЕЗ мутаций:

- `getUserPaymentInfo()` - `/src/lib/payments.ts` - читает plan, expiresAt, paymentProvider
- `GET /api/user` - `/src/app/api/user/route.ts` - читает user info + plan + expiresAt
- `GET /api/admin/users` - `/src/app/api/admin/users/route.ts` - читает список пользователей + их планы
- `GET /api/admin/payments` - `/src/app/api/admin/payments/route.ts` - читает платежи (не мутирует план)
- `GET /api/admin/limits` - `/src/app/api/admin/limits/route.ts` - читает лимиты (не мутирует план)

**Инвариант:** Ни одна из этих функций НЕ может менять план

#### Слой 2: Пишущие функции (EXPLICIT WRITE)
Эти функции явно изменяют план в БД:

- `updateUserPlan()` - `/src/lib/payments.ts` - обновляет plan + expiresAt + сбрасывает usage
- `POST /api/payments/yookassa/webhook` - `/src/app/api/payments/yookassa/webhook/route.ts` - ЕДИНСТВЕННАЯ точка активации при платеже
- `POST /api/admin/users/change-plan` - изменяет план на выбранный
- `POST /api/admin/payments/extend` - продлевает expiresAt
- Функции из `/src/lib/subscription-downgrade.ts` - явный downgrade (если понадобится)

**Инвариант:** Только эти функции могут менять план

### 3. UI Слой

#### User UI (ЛК)
- Использует hook `useUser()` - `/src/hooks/useUser.ts`
- Polling каждые 10 секунд на `/api/user`
- Источник: `users.plan` из БД
- Примеры: `/app/(dashboard)/settings/billing`, `/app/(dashboard)/trending`

#### Admin UI (Админка)
- Использует hook `useAdminUsers()` - `/src/hooks/useAdminUsers.ts`
- Polling каждые 10 секунд на `/api/admin/users`
- Источник: `users.plan` из БД (через JOIN в SQL)
- Примеры: `/app/(dashboard)/admin/users`

**Инвариант:** Оба читают из одного источника (users.plan в БД)

## Проверочный Список

### Проверка 1: Нет Downgrade при Чтении
```
✓ getUserPaymentInfo() - PURE READ, no mutations
✓ GET /api/user - PURE READ, no mutations
✓ GET /api/admin/users - PURE READ, no mutations
✓ GET /api/admin/payments - PURE READ, no mutations
✓ GET /api/admin/limits - PURE READ, no mutations
```

### Проверка 2: Единственная Точка Активации (Webhook)
```
✓ POST /api/payments/yookassa/webhook - ТОЛЬКО здесь активируется новый план
✓ Webhook проверяет идемпотентность по status='pending'|'succeeded'
✓ Webhook не может быть обойдена (confirm endpoint заглушен)
✓ Webhook обновляет users.plan + users.expiresAt + users.paymentProvider
```

### Проверка 3: Всегда Разные Значения → Ошибка
Если Admin UI и User UI показывают разные планы для одного пользователя:
1. Проверить, что обе API читают из одной таблицы (users)
2. Проверить, что между запросами не было явных операций write
3. Проверить логи функций чтения - там НЕ должно быть UPDATE запросов

### Проверка 4: Поток Данных
```
Webhook (на платеж)
  ↓
UPDATE users SET plan = ?, expiresAt = ?
  ↓
users table (БД)
  ↓
/api/user (читает напрямую)
  ↓
useUser() (ЛК)

  +---→ /api/admin/users (читает напрямую)
        ↓
        useAdminUsers() (админка)
```

## Как Это Работает Теперь

1. **Плата за подписку через YooKassa:**
   - User делает платёж → YooKassa отправляет webhook
   - Webhook → webhook handler → updateUserPlan()
   - updateUserPlan() → UPDATE users SET plan = 'basic', expiresAt = ...

2. **User UI показывает новый план:**
   - useUser() делает fetch /api/user каждые 10 сек
   - /api/user читает SELECT plan FROM users WHERE id = ?
   - Возвращает новый план (basic)
   - UI обновляется

3. **Admin UI видит то же:**
   - useAdminUsers() делает fetch /api/admin/users каждые 10 сек
   - /api/admin/users читает SELECT u.plan FROM users u
   - Возвращает то же самое значение (basic)
   - Admin видит то же, что видит User

## Защита от Регрессии

### Что НЕ должно происходить:
1. ❌ Функция чтения автоматически изменяет план
2. ❌ Admin UI и User UI показывают разные планы
3. ❌ При чтении plan происходят UPDATE запросы в БД
4. ❌ Plan кэшируется в JWT/session вместо чтения из БД
5. ❌ Downgrade логика разбросана по разным местам

### Что должно происходить:
1. ✅ ВСЕ чтения идут через SELECT, БЕЗ UPDATE
2. ✅ Admin и User видят одинаковые значения
3. ✅ Downgrade логика централизована в `/src/lib/subscription-downgrade.ts`
4. ✅ Webhook — единственная точка активации для платежей
5. ✅ Каждый read endpoint явно указывает "PURE READ" в комментариях

## Файлы, Которые Были Изменены

### Критические (Single Source of Truth):
- `/src/lib/payments.ts` - removeDowngradeLogic из getUserPaymentInfo()
- `/src/app/api/user/route.ts` - PURE READ endpoint
- `/src/lib/subscription-downgrade.ts` - централизованная downgrade логика (новый файл)

### API Endpoints (verified PURE READ):
- `/src/app/api/admin/users/route.ts` - GET только читает
- `/src/app/api/admin/payments/route.ts` - GET только читает
- `/src/app/api/admin/limits/route.ts` - GET только читает
- `/src/app/api/admin/payments/extend/route.ts` - POST: update expiresAt только
- `/src/app/api/admin/users/change-plan/route.ts` - POST: update plan (явно)
- `/src/app/api/billing/script-usage/route.ts` - GET: reads plan, no mutations

### UI Hooks (with Polling):
- `/src/hooks/useUser.ts` - polling /api/user каждые 10 сек
- `/src/hooks/useAdminUsers.ts` - polling /api/admin/users каждые 10 сек

### Webhook (ONLY Write Point):
- `/src/app/api/payments/yookassa/webhook/route.ts` - ЕДИНСТВЕННАЯ точка активации

## Тестирование

### Manual Test 1: Payment Flow
1. User платит через YooKassa → Basic
2. Проверить /api/user → plan = 'basic'
3. Проверить /api/admin/users → план того же user = 'basic'
4. ✅ Должны быть одинаковыми

### Manual Test 2: No Auto-Downgrade on Read
1. Обновить БД: SET expiresAt = (now - 1 day) для test user
2. Сделать GET /api/user для этого user
3. Проверить БД: план НЕ должен измениться на 'free'
4. ✅ План должен остаться как был

### Manual Test 3: Admin and User Sync
1. User видит Basic в ЛК
2. Admin видит Basic в админке для того же user
3. Если разные → проверить логи (должны быть mutation в функции чтения)
4. ✅ Должны быть одинаковыми

## Заключение

- ✅ Все функции чтения — PURE, без мутаций
- ✅ Все функции записи — EXPLICIT, в явных местах
- ✅ Admin UI и User UI читают из одного источника (users.plan)
- ✅ Единственная точка активации плана — webhook
- ✅ Архитектура соответствует принципу "Single Source of Truth"
