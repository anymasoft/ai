# Аудит системы авторизации LibreChat
## Отчет по возможности добавления Yandex OAuth

---

## 1. Текущие способы авторизации

### Полностью поддерживаемые провайдеры:

| Провайдер | Статус | Пакет | Env переменные |
|-----------|--------|-------|----------------|
| **Google OAuth 2.0** | ✅ Активен | `passport-google-oauth20` | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` |
| **Facebook** | ✅ Активен | `passport-facebook` | `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET` |
| **GitHub** | ✅ Активен | `passport-github2` | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` |
| **Discord** | ✅ Активен | `passport-discord` | `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` |
| **Apple** | ✅ Активен | `passport-apple` | `APPLE_CLIENT_ID`, `APPLE_PRIVATE_KEY_PATH` |
| **OpenID Connect** | ✅ Активен | встроенный | `OPENID_CLIENT_ID`, `OPENID_CLIENT_SECRET`, `OPENID_ISSUER`, `OPENID_SCOPE`, `OPENID_SESSION_SECRET` |
| **SAML 2.0** | ✅ Активен | `@node-saml/passport-saml` | `SAML_ENTRY_POINT`, `SAML_ISSUER`, `SAML_CERT`, `SAML_SESSION_SECRET` |
| **LDAP** | ✅ Поддерживается | `passport-ldapauth` | LDAP конфиг |
| **JWT** | ✅ Поддерживается | `passport-jwt` | Конфиг в файле |
| **Local (email)** | ✅ Базовый | `passport-local` | По умолчанию |

---

## 2. Архитектура системы авторизации

### Файловая структура:

```
api/
├── strategies/                          # Все passport стратегии
│   ├── index.js                        # Экспорт всех стратегий
│   ├── googleStrategy.js               # Google OAuth
│   ├── facebookStrategy.js             # Facebook
│   ├── githubStrategy.js               # GitHub
│   ├── discordStrategy.js              # Discord
│   ├── appleStrategy.js                # Apple
│   ├── openidStrategy.js               # OpenID Connect
│   ├── samlStrategy.js                 # SAML
│   ├── ldapStrategy.js                 # LDAP
│   ├── localStrategy.js                # Email/Password
│   ├── jwtStrategy.js                  # JWT
│   ├── openIdJwtStrategy.js            # OpenID JWT
│   ├── socialLogin.js                  # Общий обработчик OAuth (логика + БД)
│   └── process.js                      # Функции создания/обновления пользователей
├── server/
│   ├── socialLogins.js                 # Инициализация стратегий (configureSocialLogins)
│   ├── routes/
│   │   ├── auth.js                     # Email login/register маршруты
│   │   └── oauth.js                    # OAuth callback маршруты
│   ├── controllers/auth/
│   │   └── oauth.js                    # Обработчик OAuth результатов (setAuthTokens)
│   └── middleware/
│       └── loginLimiter.js             # Rate limiting для логина
└── package.json                         # Зависимости (все passport-*)
```

### Поток авторизации OAuth:

```
1. Клиент нажимает "Login with Google"
                ↓
2. GET /oauth/google (route: api/server/routes/oauth.js:43)
                ↓
3. passport.authenticate('google')
   → перенаправляет на Google OAuth
                ↓
4. Пользователь авторизуется в Google
                ↓
5. Google перенаправляет обратно на /oauth/google/callback
                ↓
6. passport.authenticate('google') (callback route: api/server/routes/oauth.js:51)
   → вызывает стратегию (googleStrategy.js:13 → socialLogin.js)
                ↓
7. socialLogin.js обрабатывает профиль:
   - Проверяет домен email (allowedDomains)
   - Проверяет существующего пользователя по googleId или email
   - Если новый → создаёт пользователя (createSocialUser)
   - Если существует → обновляет данные (handleExistingUser)
                ↓
8. oauthHandler (api/server/controllers/auth/oauth.js) генерирует токен и устанавливает cookies
                ↓
9. res.redirect(redirectUri) → клиент логируется
```

---

## 3. Используемые библиотеки

### Основные пакеты:

```json
{
  "passport": "^0.6.0",                      // Основной фреймворк
  "passport-google-oauth20": "^2.0.0",      // Google Strategy
  "passport-facebook": "^3.0.0",             // Facebook Strategy
  "passport-github2": "^0.1.12",             // GitHub Strategy
  "passport-discord": "^0.1.4",              // Discord Strategy
  "passport-apple": "^2.0.2",                // Apple Strategy
  "@node-saml/passport-saml": "^5.1.0",     // SAML Strategy
  "passport-ldapauth": "^3.0.1",             // LDAP Strategy
  "passport-jwt": "^4.0.1",                  // JWT Strategy
  "passport-local": "^1.0.0",                // Email/Password Strategy
  "express-session": "^1.17.x",              // Session middleware
  "openid-client": "^x.x.x"                  // OpenID Connect
}
```

### Отсутствует:
- Нет `passport-yandex` или подобного пакета для Yandex

---

## 4. Как регистрируются стратегии

### Файл: `api/server/socialLogins.js`

Стратегии регистрируются условно по наличию env переменных:

```javascript
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(googleLogin());  // googleLogin это результат googleStrategy.js()
}
```

### Маршруты регистрируются в: `api/server/routes/oauth.js`

```javascript
router.get('/google',
  passport.authenticate('google', { scope: [...], session: false })
);

router.get('/google/callback',
  passport.authenticate('google', {...}),
  setBalanceConfig,
  checkDomainAllowed,
  oauthHandler
);
```

---

## 5. Env переменные для текущих провайдеров

### Google:
```env
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=yyy
GOOGLE_CALLBACK_URL=/oauth/google/callback
```

### Facebook:
```env
FACEBOOK_CLIENT_ID=xxx
FACEBOOK_CLIENT_SECRET=yyy
```

### GitHub:
```env
GITHUB_CLIENT_ID=xxx
GITHUB_CLIENT_SECRET=yyy
```

### Discord:
```env
DISCORD_CLIENT_ID=xxx
DISCORD_CLIENT_SECRET=yyy
```

### Apple:
```env
APPLE_CLIENT_ID=xxx
APPLE_PRIVATE_KEY_PATH=/path/to/key
```

### OpenID Connect:
```env
OPENID_CLIENT_ID=xxx
OPENID_CLIENT_SECRET=yyy
OPENID_ISSUER=https://provider.com
OPENID_SCOPE=openid profile email
OPENID_SESSION_SECRET=random-secret
OPENID_REUSE_TOKENS=false  # опционально
```

### SAML:
```env
SAML_ENTRY_POINT=https://provider.com/sso
SAML_ISSUER=application-name
SAML_CERT=/path/to/cert.pem
SAML_SESSION_SECRET=random-secret
```

---

## 6. API Yandex OAuth 2.0

### Важные endpoints:

| Endpoint | URL |
|----------|-----|
| **Authorization** | `https://oauth.yandex.ru/authorize` |
| **Token** | `https://oauth.yandex.ru/token` |
| **User Info** | `https://login.yandex.ru/info` |
| **Profile** | `https://login.yandex.ru/info?format=json` |

### Параметры:

```
Authorization URL:
GET https://oauth.yandex.ru/authorize
  ?client_id=APP_ID
  &response_type=code
  &redirect_uri=CALLBACK_URL
  &state=random_state

Token Request (POST):
POST https://oauth.yandex.ru/token
  grant_type=authorization_code
  code=AUTH_CODE
  client_id=APP_ID
  client_secret=APP_SECRET

User Info (GET):
GET https://login.yandex.ru/info?format=json
  Authorization: Bearer ACCESS_TOKEN
```

### Профиль Yandex возвращает:

```json
{
  "id": "123456789",
  "login": "username",
  "first_name": "Ivan",
  "last_name": "Petrov",
  "display_name": "Ivan Petrov",
  "real_name": "Ivan Petrov",
  "sex": "m",
  "default_email": "ivan@yandex.ru",
  "emails": ["ivan@yandex.ru"],
  "default_phone": {
    "id": "123456",
    "number": "+79991234567"
  },
  "phones": [...],
  "birthday": "1990-01-01",
  "default_avatar_id": "avatarId"
}
```

---

## 7. Архитектура добавления Yandex OAuth

### Шаг 1: Установить пакет passport-yandex

```bash
npm install passport-yandex
```

**Примечание:** Нужно проверить существование пакета, возможно нужно создать собственную стратегию.

### Шаг 2: Создать файл `api/strategies/yandexStrategy.js`

```javascript
const { Strategy: YandexStrategy } = require('passport-yandex');
const socialLogin = require('./socialLogin');

const getProfileDetails = ({ profile }) => ({
  email: profile.default_email || profile.emails?.[0],
  id: profile.id,
  avatarUrl: profile.default_avatar_id
    ? `https://avatars.yandex.net/get-yapic/${profile.default_avatar_id}/islands-200`
    : null,
  username: profile.login,
  name: profile.display_name || profile.real_name,
  emailVerified: true,
});

const yandexLogin = socialLogin('yandex', getProfileDetails);

module.exports = () =>
  new YandexStrategy(
    {
      clientID: process.env.YANDEX_CLIENT_ID,
      clientSecret: process.env.YANDEX_CLIENT_SECRET,
      callbackURL: `${process.env.DOMAIN_SERVER}${process.env.YANDEX_CALLBACK_URL}`,
    },
    yandexLogin,
  );
```

### Шаг 3: Обновить `api/strategies/index.js`

```javascript
const yandexLogin = require('./yandexStrategy');

module.exports = {
  // ... остальное ...
  yandexLogin,
};
```

### Шаг 4: Обновить `api/server/socialLogins.js`

```javascript
const { yandexLogin } = require('~/strategies');

const configureSocialLogins = async (app) => {
  // ... существующие провайдеры ...

  if (process.env.YANDEX_CLIENT_ID && process.env.YANDEX_CLIENT_SECRET) {
    passport.use(yandexLogin());
  }
};
```

### Шаг 5: Добавить маршруты в `api/server/routes/oauth.js`

```javascript
/**
 * Yandex Routes
 */
router.get(
  '/yandex',
  passport.authenticate('yandex', {
    session: false,
  }),
);

router.get(
  '/yandex/callback',
  passport.authenticate('yandex', {
    failureRedirect: `${domains.client}/oauth/error`,
    failureMessage: true,
    session: false,
  }),
  setBalanceConfig,
  checkDomainAllowed,
  oauthHandler,
);
```

### Шаг 6: Env переменные

```env
YANDEX_CLIENT_ID=your_app_id
YANDEX_CLIENT_SECRET=your_app_secret
YANDEX_CALLBACK_URL=/oauth/yandex/callback
```

### Шаг 7: Обновить БД (если нужно)

В модели User добавить поле:
```javascript
yandexId: String,  // для сохранения yandex ID
```

---

## 8. Список файлов которые нужно изменить

| Файл | Изменение |
|------|-----------|
| `package.json` | Добавить `passport-yandex` |
| `api/strategies/yandexStrategy.js` | **Создать новый файл** |
| `api/strategies/index.js` | Добавить экспорт yandexLogin |
| `api/server/socialLogins.js` | Добавить регистрацию yandex стратегии |
| `api/server/routes/oauth.js` | Добавить /yandex и /yandex/callback маршруты |
| `.env.example` | Добавить YANDEX_* переменные |
| `db/models/userSchema.js` | Добавить yandexId поле (опционально) |

---

## 9. Проверка безопасности

✅ **Текущие меры безопасности:**

1. **Rate limiting** - loginLimiter middleware защищает от перебора
2. **Domain validation** - проверка allowedDomains для email
3. **Email verification** - используется emailVerified флаг
4. **Session management** - используются secure cookies (shouldUseSecureCookie)
5. **User ban check** - checkBan middleware проверяет забанены ли пользователи
6. **Provider consistency** - предотвращает связывание одного email с разными провайдерами

✅ **Для Yandex нужно добавить:**

1. Проверка YANDEX_CLIENT_SECRET в окружении
2. Валидация JWT токена от Yandex (если используется)
3. HTTPS для callbackURL (обязательно в продакшене)

---

## 10. Тестирование при добавлении

```bash
# Локально
YANDEX_CLIENT_ID=test_id \
YANDEX_CLIENT_SECRET=test_secret \
DOMAIN_SERVER=http://localhost:3080 \
npm start

# Проверить маршруты
curl http://localhost:3080/oauth/yandex

# Проверить в браузере
http://localhost:3080/oauth/yandex
```

---

## 11. Альтернатива: Если нет готового пакета

Если `passport-yandex` не существует или устарел, можно использовать **generic OAuth2 strategy**:

```javascript
const { Strategy: OAuth2Strategy } = require('passport-oauth2');
// или использовать openid-client для OpenID Connect совместимости
```

Yandex поддерживает OpenID Connect, поэтому может работать через `OPENID_*` конфиг.

---

## Итоги

| Параметр | Результат |
|----------|-----------|
| **Текущие провайдеры** | 9 (Google, Facebook, GitHub, Discord, Apple, OpenID, SAML, LDAP, Local) |
| **Архитектура** | Модульная, использует Passport.js |
| **Сложность добавления Yandex** | ⭐⭐ Средняя (копировать паттерн Google) |
| **Время реализации** | ~2-3 часа |
| **Требуемые изменения** | 6-7 файлов |
| **Рекомендация** | Использовать OpenID Connect если доступен, иначе OAuth2 Strategy |

