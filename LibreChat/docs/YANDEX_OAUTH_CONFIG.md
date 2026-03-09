# Yandex OAuth Конфигурация в LibreChat

## Обзор

LibreChat настроен на использование **только Yandex OAuth** для входа пользователей. Все остальные методы аутентификации отключены.

## OAuth Flow

```
┌─────────────┐
│  /login     │  Пользователь на странице входа
└──────┬──────┘
       │
       ▼
┌─────────────────────────┐
│ Кнопка "Sign in Yandex" │  SocialLoginRender.tsx
│ (oauthPath="yandex")    │  ведет на /oauth/yandex
└──────┬──────────────────┘
       │
       ▼
┌──────────────────────────┐
│ GET /oauth/yandex        │  routes/oauth.js:205-210
│ (passport.authenticate)  │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────────┐
│ oauth.yandex.ru (редирект)   │ Перенаправление на Yandex
└──────┬───────────────────────┘
       │ (пользователь логинится)
       │
       ▼
┌────────────────────────────────────────────┐
│ GET ${YANDEX_URI}                          │
│ (callback параметр из yandexStrategy.js)   │
│ http://localhost:3080/oauth/yandex/callback│
└──────┬─────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│ /oauth/yandex/callback       │  routes/oauth.js:214-224
│ (passport.authenticate)      │  (или /auth/yandex-callback)
│ + setBalanceConfig           │
│ + checkDomainAllowed         │
│ + oauthHandler               │
└──────┬───────────────────────┘
       │
       ▼
┌────────────────────────────┐
│ socialLogin (коллбэк)       │ strategies/socialLogin.js
│ - Создать пользователя     │
│ - Установить сессию        │
└──────┬─────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│ Пользователь авторизован    │
│ (редирект на главную)       │
└─────────────────────────────┘
```

## Конфигурация переменных окружения

### Требуемые переменные:

```env
# Yandex OAuth credentials
YANDEX_CLIENT_ID=xxxxxxxxxxxxxxxx
YANDEX_CLIENT_SECRET=xxxxxxxxxxxxxxxx

# Домены
DOMAIN_SERVER=http://localhost:3080
DOMAIN_CLIENT=http://localhost:3080

# (Опционально) Кастомный callback URL
# Если не установлена, использует: ${DOMAIN_SERVER}/oauth/yandex/callback
YANDEX_URI=http://localhost:3080/oauth/yandex/callback
```

## Файлы конфигурации

### 1. **api/strategies/yandexStrategy.js**
- Расширяет `passport-oauth2` Strategy
- Использует `process.env.YANDEX_URI` если установлена
- Fallback: `${process.env.DOMAIN_SERVER}/oauth/yandex/callback`
- Fetches user profile с `https://login.yandex.ru/info`
- Authorization header: `OAuth ${accessToken}` (не Bearer!)
- НЕ использует scope (права конфигурируются при регистрации приложения)

### 2. **api/server/routes/oauth.js**
- GET `/yandex` → Passport редирект на oauth.yandex.ru
- GET `/yandex/callback` → Обработка callback, авторизация пользователя

### 3. **client/src/components/Auth/SocialLoginRender.tsx**
- Отображает только кнопку Yandex
- `oauthPath="yandex"` → генерирует ссылку на `/oauth/yandex`
- Label: "Sign in with Yandex" (hardcoded, не использует i18n)

### 4. **api/server/socialLogins.js**
- Регистрирует только Yandex стратегию
- Все остальные провайдеры закомментированы/отключены

### 5. **api/server/routes/config.js**
- `emailLoginEnabled: false` (отключена форма email/password)
- `yandexLoginEnabled: true` (включена Yandex кнопка)
- `registrationEnabled: false` (отключена регистрация)

## Ключевые особенности Yandex OAuth

1. **NO SCOPE**: Yandex OAuth не принимает scope в запросах. Права конфигурируются при регистрации приложения в Yandex.

2. **Authorization Header**: `OAuth ${token}`, НЕ `Bearer ${token}`

3. **Profile URL**: `https://login.yandex.ru/info?format=json`

4. **Custom Callback**: Поддерживает кастомный callback URL через YANDEX_URI переменную окружения

5. **State Parameter**: Passport автоматически добавляет state для CSRF защиты

## Отладка

Проверьте логи сервера при старте:

```
[Yandex OAuth] Using custom YANDEX_URI: http://localhost:3080/oauth/yandex/callback
```

или

```
[Yandex OAuth] Using default callback URL: http://localhost:3080/oauth/yandex/callback
```

## Ошибки и решения

### 1. "invalid_scope" от Yandex
**Причина**: Scope параметры передаются в OAuth запрос
**Решение**: Убедитесь что в `api/server/routes/oauth.js` для Yandex маршрутов нет `scope` параметра

### 2. 404 на callback URL
**Причина**: Callback URL из YANDEX_URI не совпадает с зарегистрированным маршрутом
**Решение**: Убедитесь что маршрут в `routes/oauth.js` совпадает с `YANDEX_URI` переменной

### 3. "Sign in with Yandex" на кнопке не переводится
**Причина**: Используется hardcoded строка вместо i18n ключа
**Решение**: Это намеренно -避免ies с локализацией. Измените label в SocialLoginRender.tsx если нужен другой текст.

## Тестирование

1. Запустите сервер:
```bash
npm install
npm run build
npm run start
```

2. Откройте `http://localhost:3080/login`

3. Кликните "Sign in with Yandex"

4. Вы должны быть перенаправлены на oauth.yandex.ru

5. После логина на Yandex, вы вернетесь на `/oauth/yandex/callback`

6. Если успешно, вы будете перенаправлены на главную страницу с установленной сессией

## Отключение всех остальных методов входа

Все остальные методы OAuth уже отключены в коде:
- ✅ Google OAuth - отключена в `socialLogins.js`
- ✅ Facebook OAuth - отключена в `socialLogins.js`
- ✅ GitHub OAuth - отключена в `socialLogins.js`
- ✅ Discord OAuth - отключена в `socialLogins.js`
- ✅ Apple OAuth - отключена в `socialLogins.js`
- ✅ OpenID Connect - отключена в `socialLogins.js`
- ✅ SAML - отключена в `socialLogins.js`
- ✅ Email/Password login - отключена в `config.js`

Полная конфигурация обеспечивает использование ТОЛЬКО Yandex OAuth как единственного метода входа.
