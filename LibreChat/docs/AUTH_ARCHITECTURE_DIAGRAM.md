# Диаграмма архитектуры системы авторизации LibreChat

---

## 1. Общая архитектура авторизации

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client (Frontend)                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Login Page                                              │   │
│  │  [Email/Pass] [Google] [Facebook] [GitHub] [Yandex]    │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    Express Server (Backend)                      │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Routes Layer (api/server/routes/)                      │   │
│  │  ┌──────────────────────────────────────────────────┐   │   │
│  │  │ /oauth/google       /oauth/facebook              │   │   │
│  │  │ /oauth/github       /oauth/discord               │   │   │
│  │  │ /oauth/yandex   (НОВОЕ)                         │   │   │
│  │  └──────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                         ↓        ↓        ↓                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Passport.js (API routes/oauth.js)                       │   │
│  │ ┌──────────────────────────────────────────────────┐   │   │
│  │ │ passport.authenticate('google')                  │   │   │
│  │ │ passport.authenticate('facebook')                │   │   │
│  │ │ passport.authenticate('yandex')   (НОВОЕ)       │   │   │
│  │ └──────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Strategy Layer (api/strategies/)                       │   │
│  │  ┌──────────────────────────────────────────────────┐   │   │
│  │  │ googleStrategy.js      facebookStrategy.js      │   │   │
│  │  │ githubStrategy.js      yandexStrategy.js(НОВОЕ) │   │   │
│  │  │ discordStrategy.js     appleStrategy.js         │   │   │
│  │  │ openidStrategy.js      samlStrategy.js          │   │   │
│  │  │ ldapStrategy.js        localStrategy.js         │   │   │
│  │  └──────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              ↓                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Social Login Processing (socialLogin.js)               │   │
│  │  ┌──────────────────────────────────────────────────┐   │   │
│  │  │ 1. Extract Profile: email, id, avatar, name     │   │   │
│  │  │ 2. Validate Email Domain                        │   │   │
│  │  │ 3. Find/Create User in DB                       │   │   │
│  │  │ 4. Update User Avatar & Settings                │   │   │
│  │  └──────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              ↓                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  OAuth Handler (api/server/controllers/auth/oauth.js)   │   │
│  │  ┌──────────────────────────────────────────────────┐   │   │
│  │  │ Generate Auth Tokens                            │   │   │
│  │  │ Set Secure Cookies                              │   │   │
│  │  │ Redirect to Client                              │   │   │
│  │  └──────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Database (MongoDB)                                     │   │
│  │  ┌──────────────────────────────────────────────────┐   │   │
│  │  │ User {                                          │   │   │
│  │  │   email, password, googleId, facebookId,       │   │   │
│  │  │   githubId, discordId, yandexId, ...           │   │   │
│  │  │   avatar, name, role, ban, ...                 │   │   │
│  │  │ }                                               │   │   │
│  │  └──────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    OAuth Providers                               │
│                                                                  │
│  [Google]    [Facebook]    [GitHub]    [Discord]    [Apple]    │
│  [OpenID]    [SAML]        [LDAP]      [Yandex] ← НОВОЕ        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Поток OAuth авторизации (для Yandex)

```
┌───────────────────────────────────────────────────────────────────┐
│ CLIENT SIDE                                                       │
│                                                                   │
│  User clicks "Login with Yandex"                                 │
│              ↓                                                     │
│  Browser navigates to:                                           │
│  http://localhost:3080/oauth/yandex                             │
│              ↓                                                     │
│  [Middleware: logHeaders, loginLimiter]                         │
└───────────────────────────────────────────────────────────────────┘
                             ↓
┌───────────────────────────────────────────────────────────────────┐
│ SERVER SIDE (Passport)                                            │
│                                                                   │
│  GET /oauth/yandex                                              │
│  ↓                                                                │
│  passport.authenticate('yandex')                                │
│  ↓                                                                │
│  YandexStrategy.authenticate()                                  │
│  ↓                                                                │
│  Build Authorization URL:                                       │
│  https://oauth.yandex.ru/authorize?                            │
│    client_id=YOUR_APP_ID                                       │
│    response_type=code                                          │
│    redirect_uri=/oauth/yandex/callback                         │
│    scope=login:email login:info                                │
│    state=random_state                                          │
│  ↓                                                                │
│  res.redirect(authorizationURL)                                 │
└───────────────────────────────────────────────────────────────────┘
                             ↓
┌───────────────────────────────────────────────────────────────────┐
│ YANDEX OAUTH SERVER                                               │
│                                                                   │
│  User sees Yandex login page                                    │
│  User enters credentials                                        │
│  User confirms authorization                                   │
│  ↓                                                                │
│  Yandex redirects to:                                           │
│  http://localhost:3080/oauth/yandex/callback?                  │
│    code=AUTH_CODE                                              │
│    state=original_state                                        │
└───────────────────────────────────────────────────────────────────┘
                             ↓
┌───────────────────────────────────────────────────────────────────┐
│ SERVER SIDE (Callback Processing)                                │
│                                                                   │
│  GET /oauth/yandex/callback?code=AUTH_CODE&state=...           │
│  ↓                                                                │
│  [Middleware: setBalanceConfig, checkDomainAllowed]            │
│  ↓                                                                │
│  passport.authenticate('yandex')                               │
│  ↓                                                                │
│  YandexStrategy.userProfile(accessToken)                       │
│  ↓                                                                │
│  POST to https://oauth.yandex.ru/token:                        │
│  {                                                              │
│    grant_type: 'authorization_code',                           │
│    code: AUTH_CODE,                                            │
│    client_id: YANDEX_CLIENT_ID,                               │
│    client_secret: YANDEX_CLIENT_SECRET                        │
│  }                                                              │
│  ↓                                                                │
│  Get accessToken in response                                   │
│  ↓                                                                │
│  GET https://login.yandex.ru/info?format=json                 │
│  Headers: Authorization: Bearer ACCESS_TOKEN                   │
│  ↓                                                                │
│  Response: {                                                    │
│    id: "123456789",                                            │
│    login: "user.name",                                         │
│    display_name: "User Name",                                 │
│    default_email: "user@yandex.ru",                          │
│    default_avatar_id: "avatar123"                            │
│  }                                                              │
│  ↓                                                                │
│  Call Verify Callback:                                         │
│  socialLogin('yandex', getProfileDetails)                     │
└───────────────────────────────────────────────────────────────────┘
                             ↓
┌───────────────────────────────────────────────────────────────────┐
│ SOCIAL LOGIN PROCESSING (socialLogin.js)                         │
│                                                                   │
│  Extract Profile Details:                                      │
│  {                                                              │
│    email: 'user@yandex.ru',                                   │
│    id: '123456789',                                           │
│    username: 'user.name',                                     │
│    name: 'User Name',                                         │
│    avatarUrl: '...',                                          │
│    emailVerified: true                                        │
│  }                                                              │
│  ↓                                                                │
│  Get App Config                                                │
│  ↓                                                                │
│  Validate email domain allowed?                                │
│  ├─ NO → Error: Email domain not allowed                      │
│  └─ YES → Continue                                            │
│  ↓                                                                │
│  Find existing user:                                           │
│  1. By yandexId                                               │
│  2. By email                                                  │
│  ↓                                                                │
│  ├─ Found + same provider → Update user                       │
│  ├─ Found + different provider → Error: conflict             │
│  └─ Not found → Create new user (if registration allowed)    │
│  ↓                                                                │
│  Return user object                                            │
└───────────────────────────────────────────────────────────────────┘
                             ↓
┌───────────────────────────────────────────────────────────────────┐
│ OAUTH HANDLER (api/server/controllers/auth/oauth.js)            │
│                                                                   │
│  req.user = authenticated user                                 │
│  ↓                                                                │
│  Check ban status                                              │
│  ├─ Banned → Reject                                           │
│  └─ Not banned → Continue                                     │
│  ↓                                                                │
│  Check if admin panel redirect                                 │
│  ├─ Yes → Generate exchange code                              │
│  └─ No → Set cookies                                          │
│  ↓                                                                │
│  setAuthTokens(user._id, res)                                 │
│  ├─ Generate JWT token                                        │
│  ├─ Generate refresh token                                    │
│  └─ Set secure HTTPOnly cookies                              │
│  ↓                                                                │
│  res.redirect(DOMAIN_CLIENT)                                  │
│  → User redirected to main app                                │
└───────────────────────────────────────────────────────────────────┘
                             ↓
┌───────────────────────────────────────────────────────────────────┐
│ CLIENT SIDE (Final)                                               │
│                                                                   │
│  User logged in! 🎉                                            │
│  Browser has auth cookies                                      │
│  Can access protected routes                                   │
└───────────────────────────────────────────────────────────────────┘
```

---

## 3. Файловая структура стратегий

```
api/
├── strategies/
│   ├── index.js                    ← Экспортирует все
│   │
│   ├── googleStrategy.js           ✅
│   ├── facebookStrategy.js         ✅
│   ├── githubStrategy.js           ✅
│   ├── discordStrategy.js          ✅
│   ├── appleStrategy.js            ✅
│   ├── openidStrategy.js           ✅
│   ├── samlStrategy.js             ✅
│   ├── ldapStrategy.js             ✅
│   ├── localStrategy.js            ✅
│   ├── jwtStrategy.js              ✅
│   ├── openIdJwtStrategy.js        ✅
│   │
│   ├── yandexStrategy.js           ← НОВОЕ (добавить)
│   │
│   ├── socialLogin.js              ← Общая логика OAuth (используется всеми)
│   ├── process.js                  ← Создание/обновление пользователей
│   └── ...
│
├── server/
│   ├── socialLogins.js             ← Инициализация (добавить Yandex здесь)
│   ├── routes/
│   │   ├── oauth.js                ← Маршруты (добавить /yandex здесь)
│   │   └── auth.js
│   └── controllers/auth/
│       └── oauth.js                ← Обработчик результата
│
└── ...
```

---

## 4. Таблица: Как выглядит каждый провайдер

| Провайдер | Пакет | Callback | Профиль |
|-----------|-------|----------|---------|
| **Google** | `passport-google-oauth20` | GET | {id, email, name, photos} |
| **Facebook** | `passport-facebook` | GET | {id, email, name} |
| **GitHub** | `passport-github2` | GET | {id, login, email, avatar_url} |
| **Discord** | `passport-discord` | GET | {id, username, email, avatar} |
| **Apple** | `passport-apple` | POST | {id, email, name} |
| **OpenID** | openid-client | GET/POST | {sub, email, name, picture} |
| **SAML** | `passport-saml` | POST | {email, name, groups} |
| **LDAP** | `passport-ldapauth` | N/A | {uid, email, cn} |
| **Yandex** | 🆕 Создать | GET | {id, login, email, display_name, default_avatar_id} |

---

## 5. Интеграция Yandex в существующую архитектуру

```
ТЕКУЩЕЕ СОСТОЯНИЕ:
├── Google  ✅
├── Facebook ✅
├── GitHub  ✅
├── Discord ✅
└── ... (еще 4)

ПОСЛЕ ДОБАВЛЕНИЯ YANDEX:
├── Google  ✅
├── Facebook ✅
├── GitHub  ✅
├── Discord ✅
├── Yandex  🆕 ← Копируем паттерн Google
└── ... (еще 4)

ТРЕБУЕМЫЕ ИЗМЕНЕНИЯ:
1. Создать yandexStrategy.js (копируем googleStrategy.js)
2. Добавить в strategies/index.js
3. Добавить регистрацию в socialLogins.js
4. Добавить маршруты в routes/oauth.js
5. Добавить env переменные
```

---

## 6. Соответствие стратегий и env переменных

```javascript
// api/server/socialLogins.js
if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) → passport.use(googleLogin());
if (FACEBOOK_CLIENT_ID && FACEBOOK_CLIENT_SECRET) → passport.use(facebookLogin());
if (GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET) → passport.use(githubLogin());
if (DISCORD_CLIENT_ID && DISCORD_CLIENT_SECRET) → passport.use(discordLogin());
if (APPLE_CLIENT_ID && APPLE_PRIVATE_KEY_PATH) → passport.use(appleLogin());
if (OPENID_CLIENT_ID && OPENID_CLIENT_SECRET && ...) → configureOpenId(app);
if (SAML_ENTRY_POINT && SAML_ISSUER && ...) → setupSaml();

// НОВОЕ:
if (YANDEX_CLIENT_ID && YANDEX_CLIENT_SECRET) → passport.use(yandexLogin());
```

---

## 7. Последовательность файлов при обработке callback

```
1. api/server/routes/oauth.js
   ↓
   router.get('/yandex/callback',
     passport.authenticate('yandex'),
     setBalanceConfig,
     checkDomainAllowed,
     oauthHandler
   )

2. Passport finds strategy 'yandex' → yandexStrategy.js
   ↓
   YandexStrategy calls verify callback → socialLogin.js

3. socialLogin.js processes profile
   ↓
   Creates/updates user → process.js

4. Return authenticated req.user

5. setBalanceConfig middleware

6. checkDomainAllowed middleware

7. oauthHandler (api/server/controllers/auth/oauth.js)
   ↓
   setAuthTokens()
   ↓
   res.redirect(DOMAIN_CLIENT)

8. Client получает cookies и может авторизоваться
```

---

## Легенда

```
✅ - Существует в проекте
🆕 - Нужно добавить для Yandex
← - Указывает направление обработки
→ - Результат выполнения
↓ - Следующий шаг
```

