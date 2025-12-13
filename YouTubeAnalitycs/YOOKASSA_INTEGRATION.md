# Интеграция ЮKassa для платежей по подпискам

## Описание

Реализована интеграция платежной системы ЮKassa для управления подписками на тарифы:
- **Basic** - 990 ₽/месяц (30 сценариев в месяц)
- **Professional** - 2490 ₽/месяц (100 сценариев в месяц)
- **Enterprise** - 5990 ₽/месяц (300 сценариев в месяц)

Интеграция позволяет пользователям оплатить подписку на странице `/settings/billing` и получить доступ к соответствующему тариф на 30 дней.

## Архитектура и поток платежа

### 1. Инициирование платежа

**Страница**: `/settings/billing` (компонент `PricingPlans`)

Когда пользователь нажимает кнопку "Оплатить" для тариф, компонент отправляет POST запрос:

```
POST /api/payments/yookassa/create
Content-Type: application/json

{
  "planId": "basic" | "professional" | "enterprise"
}
```

### 2. API Endpoint: `/api/payments/yookassa/create` (POST)

**Файл**: `src/app/api/payments/yookassa/create/route.ts`

Обработчик:
1. Проверяет аутентификацию пользователя (NextAuth сессия)
2. Валидирует planId
3. Вычисляет цену тариф (в копейках)
4. Создаёт платёж в ЮKassa API с помощью REST запроса
5. Возвращает URL для оплаты

```json
Response (200 OK):
{
  "success": true,
  "paymentUrl": "https://yookassa.ru/checkout/..."
}

Response (error):
{
  "success": false,
  "error": "Описание ошибки"
}
```

**Технические детали**:
- Использует Basic Auth с YOOKASSA_SHOP_ID и YOOKASSA_API_KEY
- Генерирует уникальный Idempotence-Key для каждого платежа
- Ответ платежа содержит confirmation URL (ссылка на оплату)

### 3. Оплата в ЮKassa

Пользователь переходит по confirmation URL и оплачивает платёж через ЮKassa.

### 4. Webhook обработка: `/api/payments/yookassa/webhook` (POST)

**Файл**: `src/app/api/payments/yookassa/webhook/route.ts`

После успешной оплаты ЮKassa отправляет webhook уведомление:

```json
POST /api/payments/yookassa/webhook
{
  "type": "notification",
  "event": "payment.succeeded",
  "data": {
    "object": {
      "id": "payment-id",
      "status": "succeeded",
      "amount": { "value": "990.00", "currency": "RUB" },
      "metadata": {
        "userId": "user-id",
        "planId": "basic"
      }
    }
  }
}
```

Обработчик:
1. Парсит webhook уведомление
2. Проверяет тип события (payment.succeeded)
3. Извлекает userId и planId из metadata
4. Вычисляет дату истечения (текущая дата + 30 дней)
5. Обновляет пользователя в БД

### 5. Обновление БД

**Функция**: `updateUserPlan()` в `src/lib/payments.ts`

Обновляет таблицу `users`:
- `plan` = "basic" | "professional" | "enterprise"
- `expiresAt` = timestamp когда истекает подписка (текущее время + 30 дней)
- `paymentProvider` = "yookassa"
- `updatedAt` = текущее время

**SQL запрос**:
```sql
UPDATE users
SET plan = ?, expiresAt = ?, paymentProvider = ?, updatedAt = ?
WHERE id = ?
```

## Структура БД

Таблица `users` расширена тремя новыми колонками:

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  image TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  plan TEXT NOT NULL DEFAULT 'free',           -- текущий тариф
  language TEXT NOT NULL DEFAULT 'en',
  disabled INTEGER NOT NULL DEFAULT 0,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,

  -- Новые колонки для платежей:
  expiresAt INTEGER,                           -- timestamp истечения подписки
  paymentProvider TEXT DEFAULT 'free'          -- провайдер платежа (yookassa, stripe, manual, free)
);
```

## Файлы реализации

### Основные файлы интеграции

1. **`src/lib/payments.ts`** (новый)
   - Утилиты для работы с платежами
   - `updateUserPlan()` - обновление плана пользователя в БД
   - `getUserPaymentInfo()` - получение информации о платеже пользователя
   - `isSubscriptionActive()` - проверка активности подписки
   - `getPlanPrice()` - получение цены тариф
   - `getPlanName()` - получение имени тариф

2. **`src/app/api/payments/yookassa/create/route.ts`** (новый)
   - API endpoint для инициирования платежа
   - Создание платежа через ЮKassa API
   - Возврат confirmation URL для оплаты

3. **`src/app/api/payments/yookassa/webhook/route.ts`** (новый)
   - Webhook обработчик от ЮKassa
   - Обновление плана пользователя после успешной оплаты
   - Обработка ошибок и idempotency

4. **`src/components/pricing-plans.tsx`** (обновлён)
   - Добавлена поддержка платежей для режима 'billing'
   - Кнопка "Оплатить" инициирует платёж
   - Индикатор загрузки во время создания платежа
   - Вывод ошибок при сбое платежа
   - Текущий план остаётся disabled

5. **`src/lib/db.ts`** (обновлён)
   - Добавлены колонки expiresAt и paymentProvider в таблицу users

### Вспомогательные файлы

6. **`.env.example`** (новый)
   - Пример конфигурации окружения
   - Переменные для ЮKassa (YOOKASSA_SHOP_ID, YOOKASSA_API_KEY)

## Конфигурация окружения

Добавьте в `.env.local` (или переменные окружения):

```
YOOKASSA_SHOP_ID=123456
YOOKASSA_API_KEY=test_...
NEXTAUTH_URL=http://localhost:3000
```

Получить Shop ID и API Key:
1. Регистрируетесь на https://yookassa.ru/
2. Создаёте магазин
3. Получаете Shop ID (он также называется merchantId)
4. Генерируете API Key в настройках магазина

## Тестирование

### Тестовые карты ЮKassa

Для тестирования платежей используйте тестовые карты:
- **Успешный платёж**: 4111 1111 1111 1111, любая дата, любой CVC
- **Отклонённый платёж**: 4000 0000 0000 0002

### Сценарий тестирования

1. Откройте `/settings/billing`
2. Выберите тариф и нажмите "Оплатить"
3. Введите тестовые данные карты
4. Проверьте, что план обновился в БД

### Проверка в БД

```sql
-- Проверить план пользователя и срок действия
SELECT id, email, plan, expiresAt, paymentProvider
FROM users
WHERE id = 'user-id';
```

## Дополнительные возможности (не реализованы в MVP)

- Отмена подписки
- Автоматическое продление подписки
- История платежей
- Сохранение карт для будущих платежей
- Возврат платежей
- Поддержка других платёжных систем

## Безопасность

- Все платежи обрабатываются через HTTPS
- API ключи хранятся в переменных окружения
- Webhook подписи проверяются (в MVP - упрощённая проверка)
- Metadata содержит userId и planId для верификации

## Интеграция с NextAuth

Информация о плане пользователя хранится в:
1. **БД** - таблица `users` (колонка `plan`)
2. **JWT токен** - добавляется в session callback
3. **Session** - доступна как `session.user.plan`

После успешной оплаты:
1. Обновляется БД (план и срок действия)
2. Пользователь перенаправляется на `/settings/billing?success=1`
3. Сессия обновляется при следующем обновлении страницы
