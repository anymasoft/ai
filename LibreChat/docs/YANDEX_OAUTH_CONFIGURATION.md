# 🔐 Конфигурация Yandex OAuth в LibreChat

## Обзор

LibreChat настроена на использование **ТОЛЬКО Yandex OAuth** как единственного способа авторизации.

---

## 📋 Env переменные

### Обязательные:

```env
# Yandex OAuth приложение
YANDEX_CLIENT_ID=your_app_id_from_oauth.yandex.ru
YANDEX_CLIENT_SECRET=your_app_secret_from_oauth.yandex.ru

# Социальные логины должны быть включены
ALLOW_SOCIAL_LOGIN=true
```

### Опциональные:

```env
# Пользовательский callback URL (если не установлен, используется DOMAIN_SERVER/oauth/yandex/callback)
YANDEX_URI=http://localhost:3080/auth/yandex-callback
```

---

## 🔗 Маршруты OAuth

### Инициирование авторизации:

```
GET /oauth/yandex
```

Перенаправляет пользователя на oauth.yandex.ru для авторизации.

### Callback маршруты (выберите один):

**Вариант 1: Стандартный маршрут**
```
GET /oauth/yandex/callback
```

Используется по умолчанию если `YANDEX_URI` не установлена.

**Вариант 2: Пользовательский маршрут**
```
GET /auth/yandex-callback
```

Используется если установлена переменная `YANDEX_URI=http://localhost:3080/auth/yandex-callback`.

---

## ⚙️ Как работает авторизация

### 1️⃣ Определение callback URL

```javascript
// Если установлена YANDEX_URI, используется она
const callbackURL = process.env.YANDEX_URI ||
  `${process.env.DOMAIN_SERVER}/oauth/yandex/callback`;

// Примеры:
// YANDEX_URI=http://localhost:3080/auth/yandex-callback
//   → callbackURL = "http://localhost:3080/auth/yandex-callback"
//
// DOMAIN_SERVER=http://localhost:3080 (без YANDEX_URI)
//   → callbackURL = "http://localhost:3080/oauth/yandex/callback"
```

### 2️⃣ Полный OAuth flow

```
Пользователь нажимает кнопку "Войти через Яндекс"
    ↓
GET /oauth/yandex
    ↓
Passport OAuth2 Strategy генерирует authorization URL
    ↓
Пользователь перенаправляется на https://oauth.yandex.ru/authorize
    ↓
Пользователь авторизуется в Yandex
    ↓
Yandex перенаправляет обратно на:
  - http://localhost:3080/oauth/yandex/callback   ИЛИ
  - http://localhost:3080/auth/yandex-callback
    (зависит от YANDEX_URI)
    ↓
Server получает код авторизации
    ↓
Server POST к https://oauth.yandex.ru/token
  {
    grant_type: 'authorization_code',
    code: AUTH_CODE,
    client_id: YANDEX_CLIENT_ID,
    client_secret: YANDEX_CLIENT_SECRET
  }
    ↓
Server получает access_token
    ↓
Server GET https://login.yandex.ru/info?format=json
  Headers: Authorization: Bearer ACCESS_TOKEN
    ↓
Server получает профиль пользователя:
  {
    id: "123456789",
    login: "user.name",
    display_name: "User Name",
    default_email: "user@yandex.ru",
    default_avatar_id: "avatar123"
  }
    ↓
socialLogin.js обрабатывает профиль
    ↓
Пользователь создается/обновляется в БД
    ↓
oauthHandler() генерирует auth токены
    ↓
Устанавливаются secure cookies
    ↓
Пользователь перенаправляется в приложение ✅
```

---

## 🛠️ Примеры конфигурации

### Вариант 1: Локальная разработка (стандартные маршруты)

```env
YANDEX_CLIENT_ID=your_dev_app_id
YANDEX_CLIENT_SECRET=your_dev_app_secret
DOMAIN_SERVER=http://localhost:3080
ALLOW_SOCIAL_LOGIN=true
```

**Callback URL в Yandex OAuth настройках:**
```
http://localhost:3080/oauth/yandex/callback
```

### Вариант 2: Локальная разработка (пользовательские маршруты)

```env
YANDEX_CLIENT_ID=your_dev_app_id
YANDEX_CLIENT_SECRET=your_dev_app_secret
DOMAIN_SERVER=http://localhost:3080
YANDEX_URI=http://localhost:3080/auth/yandex-callback
ALLOW_SOCIAL_LOGIN=true
```

**Callback URL в Yandex OAuth настройках:**
```
http://localhost:3080/auth/yandex-callback
```

### Вариант 3: Production (стандартные маршруты)

```env
YANDEX_CLIENT_ID=your_prod_app_id
YANDEX_CLIENT_SECRET=your_prod_app_secret
DOMAIN_SERVER=https://repliq.art
ALLOW_SOCIAL_LOGIN=true
```

**Callback URL в Yandex OAuth настройках:**
```
https://repliq.art/oauth/yandex/callback
```

### Вариант 4: Production (пользовательские маршруты)

```env
YANDEX_CLIENT_ID=your_prod_app_id
YANDEX_CLIENT_SECRET=your_prod_app_secret
DOMAIN_SERVER=https://repliq.art
YANDEX_URI=https://repliq.art/auth/yandex-callback
ALLOW_SOCIAL_LOGIN=true
```

**Callback URL в Yandex OAuth настройках:**
```
https://repliq.art/auth/yandex-callback
```

---

## 🔍 Отладка

### Проверить что Yandex стратегия зарегистрирована:

```bash
npm start 2>&1 | grep -i "yandex"
```

Должны видеть логи:
```
Configuring social logins... (Only Yandex OAuth enabled)
Registering Yandex OAuth strategy
Yandex OAuth configured successfully.
```

### Проверить callback URL:

В браузере после авторизации в Yandex должны перенаправиться на:
- `http://localhost:3080/oauth/yandex/callback?code=...` (вариант 1)
- `http://localhost:3080/auth/yandex-callback?code=...` (вариант 2)

Если вместо этого видите ошибку 404 - проверьте что callback URL совпадает в:
1. Yandex OAuth настройках (https://oauth.yandex.ru/client)
2. Переменной `YANDEX_URI` в .env (если используется)
3. Переменной `DOMAIN_SERVER` в .env (если не используется `YANDEX_URI`)

### Проверить profile extraction:

Добавьте логирование в `api/server/controllers/auth/oauth.js`:

```javascript
console.log('OAuth user:', req.user); // Проверить профиль
```

---

## 📂 Файлы конфигурации

| Файл | Переменная | Использование |
|------|-----------|---------------|
| `.env` | `YANDEX_CLIENT_ID` | Client ID для OAuth |
| `.env` | `YANDEX_CLIENT_SECRET` | Client Secret для OAuth |
| `.env` | `YANDEX_URI` | Пользовательский callback URL |
| `.env.example` | Все выше | Документация по переменным |
| `api/strategies/yandexStrategy.js` | Читает из env | Определяет callbackURL |
| `api/server/routes/oauth.js` | Маршруты | GET /oauth/yandex и callback |
| `api/server/routes/config.js` | yandexLoginEnabled | Флаг для UI |

---

## 🧪 Локальное тестирование

### 1. Подготовить окружение:

```bash
# Скопировать .env.example в .env
cp .env.example .env

# Добавить Yandex учетные данные
echo "YANDEX_CLIENT_ID=your_test_app_id" >> .env
echo "YANDEX_CLIENT_SECRET=your_test_app_secret" >> .env
echo "ALLOW_SOCIAL_LOGIN=true" >> .env
```

### 2. Запустить сервер:

```bash
npm start
```

### 3. Открыть браузер:

```
http://localhost:3080/login
```

Должна видеть только кнопку "Войти через Яндекс"

### 4. Нажать кнопку и авторизоваться

### 5. Проверить логи:

```bash
# Должны видеть
Yandex profile fetch successful
[yandexLogin] Creating new user...
```

---

## 🔐 Безопасность

✅ **Реализованные меры:**

1. **OAuth2 стандарт** - используется стандартный OAuth2 flow
2. **Secure cookies** - auth токены в HTTPOnly cookies
3. **State parameter** - CSRF защита
4. **HTTPS (production)** - обязательно в продакшене
5. **Email verification** - Yandex гарантирует верифицированный email
6. **Rate limiting** - защита от перебора
7. **Ban checking** - система блокирования пользователей

---

## 📝 Версия

| Параметр | Значение |
|----------|----------|
| Дата | 2026-03-06 |
| Версия | 1.0 |
| Статус | Production Ready |
| Способ авторизации | Only Yandex OAuth |

---

## 📞 Помощь

**Ссылки:**
- [Yandex OAuth API](https://yandex.ru/dev/id/doc/dg/oauth/concepts/about.html)
- [Oauth.yandex.ru](https://oauth.yandex.ru/client)
- [Passport.js OAuth2](http://www.passportjs.org/packages/passport-oauth2/)

