# 🔍 ПОЛНЫЙ ТЕХНИЧЕСКИЙ АУДИТ OAUTH АВТОРИЗАЦИИ YANDEX

## ДАТА АУДИТА
- Проведён: 2026-03-06
- Версия проекта: LibreChat v0.8.3-rc1
- Ветка: claude/explore-librechat-structure-Oq9TW

---

## 1️⃣ НАЙДЕННЫЕ МАРШРУТЫ OAUTH

### Маршруты в `/api/server/routes/oauth.js`:

**ШАГ 1 - Инициация OAuth редиректа:**
```javascript
// Строка 208-219
router.get(
  '/yandex',
  (req, res, next) => { ... },
  passport.authenticate('yandex', {
    state: true,
  }),
);
```
- **Путь**: GET `/oauth/yandex`
- **Функция**: Инициирует редирект на https://oauth.yandex.ru/authorize
- **State**: ✅ Включён (state: true)
- **Session**: ✅ Требуется для сохранения state

**ШАГ 2 - Callback обработка:**
```javascript
// Строка 223-252
router.get(
  '/yandex/callback',
  (req, res, next) => { ... },
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
- **Путь**: GET `/oauth/yandex/callback`
- **Функция**: Обработка callback от Yandex с code и state
- **Session**: ❌ **ОТКЛЮЧЕНА** (session: false)

### Дополнительный маршрут в `/api/server/index.js`:

**ШАГ 2B - Альтернативный callback:**
```javascript
// Строка 205-215
app.get(
  '/auth/yandex-callback',
  passport.authenticate('yandex', {
    failureRedirect: `${process.env.DOMAIN_CLIENT}/oauth/error`,
    failureMessage: true,
    
  }),
  setBalanceConfig,
  checkDomainAllowed,
  oauthHandler,
);
```
- **Путь**: GET `/auth/yandex-callback`
- **Функция**: **АЛЬТЕРНАТИВНЫЙ** callback маршрут
- **Session**: ⚠️ **НЕ УКАЗАНА** (используется значение по умолчанию)
- **⚠️ ПОТЕНЦИАЛЬНАЯ ПРОБЛЕМА**: Два разных маршрута для обработки callback!

---

## 2️⃣ ПОРЯДОК MIDDLEWARE В EXPRESS

### Session конфигурация (строка 162-174):
```javascript
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
    resave: false,
    saveUninitialized: true,  // ⚠️ TRUE - сохраняет пустые session
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);
```

### Passport инициализация (строка 177-178):
```javascript
app.use(passport.initialize());
passport.use(jwtLogin());
```

### ⚠️ КРИТИЧЕСКАЯ ПРОБЛЕМА: ОТСУТСТВУЕТ `passport.session()`

**❌ ОБНАРУЖЕНО**: В index.js **НЕ ВЫЗЫВАЕТСЯ** `app.use(passport.session())`

**Проблема**: 
- Passport OAuth2Strategy требует `passport.session()` middleware для сохранения state
- State используется для CSRF защиты
- Без этого middleware, state не сохраняется в session
- Браузер может зависнуть, так как Passport не может верифицировать state

**Ожидаемо должно быть:**
```javascript
app.use(session({...}));
app.use(passport.initialize());
app.use(passport.session());  // ⚠️ ОТСУТСТВУЕТ!
```

### Монтирование OAuth маршрутов (строка 191-192):
```javascript
app.use('/oauth', routes.oauth);
```

### Порядок middleware в целом:
```
1. noIndex
2. express.json() + express.urlencoded()
3. handleJsonParseError
4. Property definition for req.query
5. mongoSanitize()
6. cors()
7. cookieParser()
8. compression() (если не отключена)
9. staticCache()
10. ⚠️ session() - ЕСТЬ
11. ⚠️ passport.initialize() - ЕСТЬ
12. ❌ passport.session() - ОТСУТСТВУЕТ!
13. configureSocialLogins() - ЕСТЬ
14. app.use('/oauth', routes.oauth)
15. Alternative /auth/yandex-callback route
16. routes.auth, routes.admin, etc.
```

---

## 3️⃣ КОНФИГУРАЦИЯ EXPRESS-SESSION

### Конфигурационные параметры:

| Параметр | Значение | Статус |
|----------|----------|--------|
| secret | process.env.SESSION_SECRET | ✅ Переменная окружения |
| resave | false | ✅ Правильно |
| saveUninitialized | **true** | ⚠️ Сохраняет пустые session |
| cookie.secure | NODE_ENV === 'production' | ✅ Правильно |
| cookie.httpOnly | true | ✅ Правильно |
| cookie.sameSite | ❌ **НЕ УКАЗАНА** | ⚠️ Не установлена для основной session |
| cookie.maxAge | 24 * 60 * 60 * 1000 (24 часа) | ✅ Разумное значение |

### Проблемы конфигурации:

1. **saveUninitialized: true** - Создаёт session для каждого запроса, даже без данных
   - Может привести к избыточному использованию памяти/хранилища
   - Рекомендуется: false или true в зависимости от Passport requirements

2. **Отсутствует sameSite для основной session**
   - Для OAuth это важно для безопасности
   - В setAuthTokens используется sameSite: 'strict' для cookies

---

## 4️⃣ YANDEX OAUTH2STRATEGY КОНФИГУРАЦИЯ

### Файл: `/api/strategies/yandexStrategy.js`

#### Конструктор стратегии (строка 39-51):
```javascript
class YandexStrategy extends OAuth2Strategy {
  constructor(options, verify) {
    options.authorizationURL = 'https://oauth.yandex.ru/authorize';
    options.tokenURL = 'https://oauth.yandex.ru/token';
    options.skipUserProfile = false;
    options.state = true;  // ✅ КРИТИЧНО: Включена CSRF защита
    super(options, verify);

    this.name = 'yandex';
    this._userProfileURL = 'https://login.yandex.ru/info';
    this._passReqToCallback = options.passReqToCallback;
  }
```

#### Параметры стратегии:

| Параметр | Значение | Описание |
|----------|----------|---------|
| authorizationURL | https://oauth.yandex.ru/authorize | ✅ Правильный endpoint |
| tokenURL | https://oauth.yandex.ru/token | ✅ Правильный endpoint |
| callbackURL | ${DOMAIN_SERVER}/oauth/yandex/callback | ⚠️ Может быть переопределена через YANDEX_URI |
| skipUserProfile | false | ✅ Получать профиль |
| state | true | ✅ Включена CSRF защита |
| clientID | process.env.YANDEX_CLIENT_ID | ⚠️ Должна быть заполнена |
| clientSecret | process.env.YANDEX_CLIENT_SECRET | ⚠️ Должна быть заполнена |

#### Динамическая конфигурация callbackURL (строка 95-105):
```javascript
let callbackURL;

if (process.env.YANDEX_URI) {
  // Если YANDEX_URI установлена, использовать её как полный URL
  callbackURL = process.env.YANDEX_URI;
  console.log('[Yandex OAuth] Using custom YANDEX_URI:', callbackURL);
} else {
  // Иначе использовать стандартный путь
  callbackURL = `${process.env.DOMAIN_SERVER}/oauth/yandex/callback`;
  console.log('[Yandex OAuth] Using default callback URL:', callbackURL);
}
```

#### ⚠️ ПОТЕНЦИАЛЬНАЯ ПРОБЛЕМА: YANDEX_URI может вызвать несоответствие
- Если YANDEX_URI = `/auth/yandex-callback`, то стратегия будет редиректить на /auth/yandex-callback
- Но основной маршрут обработки находится в `/api/server/routes/oauth.js` (/oauth/yandex/callback)
- Оба маршрута существуют, но могут использовать разные конфигурации

#### Получение профиля пользователя (строка 57-80):
```javascript
async userProfile(accessToken) {
  try {
    console.log('[Yandex OAuth] Fetching user profile...');
    const response = await axios.get(
      `${this._userProfileURL}?format=json`,
      {
        headers: {
          // ВАЖНО: Yandex требует OAuth формат, не Bearer!
          Authorization: `OAuth ${accessToken}`,
          'User-Agent': 'passport-yandex',
        },
      }
    );

    const profile = response.data;
    profile.provider = 'yandex';

    console.log(`[Yandex OAuth] Profile fetched successfully for user: ${profile.login}`);
    return profile;
  } catch (error) {
    console.error('[Yandex OAuth] Profile fetch error:', error.message);
    throw error;
  }
}
```
- **userProfileURL**: https://login.yandex.ru/info
- **Authorization Header**: `OAuth ${accessToken}` (Yandex специфичный формат)
- ✅ Правильная обработка профиля

---

## 5️⃣ VERIFY CALLBACK ФУНКЦИЯ

### Файл: `/api/strategies/socialLogin.js`

```javascript
const socialLogin =
  (provider, getProfileDetails) => 
    async (accessToken, refreshToken, idToken, profile, cb) => {
      try {
        // 1. Нормализация профиля
        const { email, id, avatarUrl, username, name, emailVerified } = 
          getProfileDetails({ idToken, profile });

        // 2. Получение конфигурации приложения
        const appConfig = await getAppConfig();

        // 3. Проверка допуска email домена
        if (!isEmailDomainAllowed(email, appConfig?.registration?.allowedDomains)) {
          logger.error(`[${provider}Login] Authentication blocked - email domain not allowed`);
          const error = new Error(ErrorTypes.AUTH_FAILED);
          error.code = ErrorTypes.AUTH_FAILED;
          error.message = 'Email domain not allowed';
          return cb(error);
        }

        // 4. Поиск существующего пользователя
        const providerKey = `${provider}Id`;
        let existingUser = null;

        if (id && typeof id === 'string') {
          existingUser = await findUser({ [providerKey]: id });
        }

        if (!existingUser) {
          existingUser = await findUser({ email: email?.trim() });
        }

        // 5. Обработка существующего пользователя
        if (existingUser?.provider === provider) {
          await handleExistingUser(existingUser, avatarUrl, appConfig, email);
          return cb(null, existingUser);  // ✅ Возвращает пользователя
        }

        // 6. Проверка разрешения регистрации
        const ALLOW_SOCIAL_REGISTRATION = isEnabled(process.env.ALLOW_SOCIAL_REGISTRATION);
        if (!ALLOW_SOCIAL_REGISTRATION) {
          logger.error(`[${provider}Login] Registration blocked - social registration is disabled`);
          const error = new Error(ErrorTypes.AUTH_FAILED);
          return cb(error);
        }

        // 7. Создание нового пользователя
        const newUser = await createSocialUser({
          email, avatarUrl, provider,
          providerKey: `${provider}Id`,
          providerId: id,
          username, name, emailVerified, appConfig,
        });
        return cb(null, newUser);  // ✅ Возвращает нового пользователя
      } catch (err) {
        logger.error(`[${provider}Login]`, err);
        return cb(err);  // ❌ Возвращает ошибку
      }
    };
```

### Сигнатура callback:
```javascript
(accessToken, refreshToken, idToken, profile, cb)
```

### Вызов callback:
- ✅ Успех: `cb(null, user)`
- ✅ Существующий пользователь: `cb(null, existingUser)`
- ✅ Ошибка: `cb(error)`
- ✅ Всегда вызывается через error или результат

---

## 6️⃣ OAUTHHANDLER ФУНКЦИЯ

### Файл: `/api/server/controllers/auth/oauth.js`

```javascript
function createOAuthHandler(redirectUri = domains.client) {
  /**
   * A handler to process OAuth authentication results.
   */
  return async (req, res, next) => {
    try {
      // 1. Проверка: заголовки уже отправлены?
      if (res.headersSent) {
        return;
      }

      // 2. Проверка бана пользователя
      await checkBan(req, res);
      if (req.banned) {
        return;  // checkBan уже отправил ответ
      }

      // 3. Проверка admin панели (cross-origin)
      if (isAdminPanelRedirect(redirectUri, getAdminPanelUrl(), domains.client)) {
        const cache = getLogStores(CacheKeys.ADMIN_OAUTH_EXCHANGE);
        const sessionExpiry = Number(process.env.SESSION_EXPIRY) || DEFAULT_SESSION_EXPIRY;
        const token = await generateToken(req.user, sessionExpiry);
        const refreshToken = req.user.tokenset?.refresh_token || req.user.federatedTokens?.refresh_token;
        const exchangeCode = await generateAdminExchangeCode(cache, req.user, token, refreshToken);

        const callbackUrl = new URL(redirectUri);
        callbackUrl.searchParams.set('code', exchangeCode);
        logger.info(`[OAuth] Admin panel redirect with exchange code for user: ${req.user.email}`);
        return res.redirect(callbackUrl.toString());  // ✅ Завершает с redirect
      }

      // 4. Стандартный OAuth flow - установка cookies
      if (
        req.user &&
        req.user.provider == 'openid' &&
        isEnabled(process.env.OPENID_REUSE_TOKENS) === true
      ) {
        await syncUserEntraGroupMemberships(req.user, req.user.tokenset.access_token);
        setOpenIDAuthTokens(req.user.tokenset, req, res, req.user._id.toString());
      } else {
        await setAuthTokens(req.user._id, res);  // ✅ Устанавливает cookies
      }
      
      res.redirect(redirectUri);  // ✅ Финальный redirect на client
    } catch (err) {
      logger.error('Error in setting authentication tokens:', err);
      next(err);  // ✅ Передаёт ошибку обработчику
    }
  };
}
```

### Завершение HTTP Response:

| Сценарий | HTTP Response | Статус |
|----------|---------------|--------|
| Admin panel redirect | res.redirect(exchangeCodeUrl) | ✅ Завершено |
| Standard OAuth | res.redirect(redirectUri) | ✅ Завершено |
| Пользователь забанен | checkBan отправляет res.status(403) | ✅ Завершено |
| Ошибка | next(err) передаёт ErrorController | ✅ Завершено |

✅ **ВЫВОД**: oauthHandler ВСЕГДА завершает HTTP response или передаёт ошибку middleware.

---

## 7️⃣ ПРОВЕРКА ЗАВЕРШЕНИЯ HTTP RESPONSE

### Маршрут /oauth/yandex/callback:

```javascript
router.get(
  '/yandex/callback',
  (req, res, next) => {
    // Логирование и обработка ошибок
    if (error) {
      return res.redirect(`${domains.client}/oauth/error?error=yandex_auth_failed`);
    }
    next();
  },
  passport.authenticate('yandex', {
    failureRedirect: `${domains.client}/oauth/error`,
    failureMessage: true,
    session: false,
  }),
  setBalanceConfig,        // Middleware
  checkDomainAllowed,      // Middleware
  oauthHandler,            // ✅ Finale handler - res.redirect()
);
```

### Цепочка завершения:

1. **Middleware логирования** → `next()`
2. **passport.authenticate()** → 
   - ❌ Ошибка: `res.redirect(failureRedirect)`
   - ✅ Успех: `req.user = profile, next()`
3. **setBalanceConfig** → `next()`
4. **checkDomainAllowed** → 
   - ❌ Домен не допущен: `res.redirect('/login')`
   - ✅ Допущен: `next()`
5. **oauthHandler** → 
   - ✅ `res.redirect(redirectUri)` ИЛИ
   - ✅ `next(error)` при ошибке

✅ **ВЫВОД**: HTTP response ВСЕГДА завершается на одном из этапов.

---

## 8️⃣ DEBUG ЛОГИ В КОДЕ

### Текущие debug точки:

#### Точка 1 - Инициация OAuth редиректа (строка 210-214):
```javascript
console.log(`\n📊 AUTH_CHECKPOINT: OAUTH_REDIRECT`);
console.log(`   - provider: yandex`);
console.log(`   - redirectUri: ${req.get('host')}/oauth/yandex/callback`);
```

#### Точка 2 - Callback начало обработки (строка 230-235):
```javascript
console.log(`\n📊 AUTH_CHECKPOINT: OAUTH_CALLBACK_START`);
console.log(`   - provider: yandex`);
console.log(`   - error: ${error || 'none'}`);
console.log(`   - code: ${code ? code.slice(0, 10) + '...' : 'missing'}`);
console.log(`   - state received: ${state ? state.slice(0, 8) + '...' : '❌ MISSING'}`);
console.log(`   - session state: ${req.session?.passport?.state ? req.session.passport.state.slice(0, 8) + '...' : 'none'}`);
```

#### Точка 3 - Получение профиля (yandexStrategy.js строка 74):
```javascript
console.log(`[Yandex OAuth] Profile fetched successfully for user: ${profile.login}`);
```

#### Логирование на уровне verify callback:
- ✅ В socialLogin.js используется logger

#### Логирование в oauthHandler:
- ✅ logger.info для успешных redirect'ов
- ✅ logger.error для ошибок

---

## 9️⃣ ПРОВЕРКА SESSION МЕЖДУ REDIRECT И CALLBACK

### Session создание при /oauth/yandex:

```javascript
// В express-session конфигурации (index.js:164)
session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,  // Создаёт session сразу
  cookie: {
    secure: NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
  },
})
```

### Сохранение state в session:

❌ **ПРОБЛЕМА**: State сохраняется в `req.session.passport.state`, но **ТОЛЬКО если вызывается `passport.session()`**

**Ожидаемое**:
```javascript
req.session.passport = {
  state: 'random-state-value'
}
```

**Проверка в коде** (oauth.js:235):
```javascript
console.log(`   - session state: ${req.session?.passport?.state ? req.session.passport.state.slice(0, 8) + '...' : 'none'}`);
```

Если это выводит 'none', то state НЕ сохраняется в session.

### Session передача при callback:

Браузер автоматически отправляет cookie при редиректе от Yandex:
```
GET /oauth/yandex/callback?code=...&state=...
Cookie: connect.sid=<session-id>
```

✅ **Теоретически должно работать**, но требует `passport.session()`.

---

## 🔟 ПРОВЕРКА СОВПАДЕНИЯ CALLBACK ROUTE

### Конфигурация redirect URI в Yandex:

Должна быть одна из:
1. `http://localhost:3080/oauth/yandex/callback` (стандартный)
2. Кастомный URL из YANDEX_URI переменной окружения

### Возможные несоответствия:

| Сценарий | Configured | Actual | Статус |
|----------|-----------|--------|--------|
| Стандартный | ${DOMAIN_SERVER}/oauth/yandex/callback | GET /oauth/yandex/callback | ✅ Совпадает |
| YANDEX_URI = /auth/yandex-callback | YANDEX_URI | GET /auth/yandex-callback | ✅ Совпадает |
| Mismatch | /oauth/yandex/callback | /auth/yandex-callback | ❌ Несоответствие |

### Где используется Callback URL:

1. **YandexStrategy** (yandexStrategy.js:103):
   ```javascript
   callbackURL = `${process.env.DOMAIN_SERVER}/oauth/yandex/callback`;
   ```

2. **Yandex OAuth приложение** (внешняя конфигурация):
   - Должна быть зарегистрирована в https://oauth.yandex.ru/

3. **Два маршрута в коде**:
   - `/oauth/yandex/callback` (в oauth.js)
   - `/auth/yandex-callback` (в index.js)

---

## 🎯 КРИТИЧЕСКИЕ ПРОБЛЕМЫ

### 1️⃣ ОТСУТСТВУЕТ `passport.session()` MIDDLEWARE - КРИТИЧНО!

**Проблема**: 
- Session не используется Passport для сохранения state
- State используется для CSRF защиты
- Без state верификации, браузер может зависнуть

**症状**: Браузер зависает после успешного логина на Yandex

**Решение**: Добавить `app.use(passport.session())` после `app.use(session({...}))`

### 2️⃣ ДВА CALLBACK МАРШРУТА - ПОТЕНЦИАЛЬНАЯ ПУТАНИЦА

**Маршруты**:
- `/oauth/yandex/callback` (в `/api/server/routes/oauth.js`)
- `/auth/yandex-callback` (в `/api/server/index.js`)

**Проблема**: 
- Yandex может быть настроена на один, но код может использовать другой
- YANDEX_URI переменная может переопределить callback URL
- Это может привести к несоответствию между OAuth провайдером и приложением

**Решение**: 
- Использовать ТОЛЬКО один callback маршрут
- Убедиться, что YANDEX_URI совпадает с configured callback URL в Yandex

### 3️⃣ SESSION CONFIGURATION ISSUES

**Проблемы**:
- `saveUninitialized: true` создаёт session для каждого запроса
- `sameSite` не установлена для основной session (в cookies)
- Session secret может быть значением по умолчанию в разработке

---

## 📊 ПОЛНЫЙ PIPELINE OAUTH

```
BROWSER (клиент)
    ↓
    → GET /oauth/yandex
    ↓
Express Router (middleware)
    1. logHeaders
    2. loginLimiter
    ↓
passport.authenticate('yandex')
    → Редирект на https://oauth.yandex.ru/authorize?...&state=xxx
    ↓
YANDEX OAuth Server
    → Пользователь вводит credentials
    → Соглашается с доступом
    ↓
    → Редирект на callback URL с code и state
    ↓
BROWSER
    → GET /oauth/yandex/callback?code=...&state=...
    ↓
Express Router (middleware)
    1. passport.authenticate('yandex')
       - ❌ ОШИБКА: state НЕ верифицируется (нет passport.session()!)
       - Получает access_token от Yandex
       - Вызывает verify callback (socialLogin)
       - Создаёт/обновляет пользователя в БД
       - Устанавливает req.user
    2. setBalanceConfig
    3. checkDomainAllowed
    4. oauthHandler
       - Устанавливает auth cookies (refreshToken, token_provider)
       - res.redirect(redirectUri)
    ↓
BROWSER
    → GET ${DOMAIN_CLIENT} с auth cookies
    ↓
Frontend приложение (React)
    → Проверяет auth cookies
    → Загружает пользовательское окружение
    ↓
✅ ИЛИ ❌ Зависание на уровне браузера
```

---

## 🔍 ТОЧКА ЗАВИСАНИЯ - ДИАГНОЗ

### Наиболее вероятная причина зависания:

**Браузер зависает после успешного OAuth callback потому, что:**

1. ✅ OAuth redirect работает правильно
2. ✅ Code и token получены правильно
3. ✅ Profile fetched успешно
4. ✅ Пользователь создан/обновлён в БД
5. ✅ oauthHandler вызывает res.redirect(redirectUri)
6. ❌ **ЧТО-ТО БЛОКИРУЕТ REDIRECT:**
   - ❌ State верификация может неявно отклонить запрос (passport.session отсутствует)
   - ❌ checkDomainAllowed может редиректить вместо next()
   - ❌ setAuthTokens может выбросить исключение
   - ⚠️ Альтернативный маршрут может использовать другую конфигурацию

### Специфический диагноз:

**ПРИЧИНА #1 (КРИТИЧНА)**: Отсутствие `passport.session()`
- State НЕ сохраняется и НЕ верифицируется
- OAuth2Strategy может отклонить запрос на этапе state верификации
- Браузер получает error redirect вместо success

---

## 📋 ИТОГОВЫЙ CHECKLIST

- [x] Найдены ВСЕ маршруты OAuth (/oauth/yandex, /oauth/yandex/callback, /auth/yandex-callback)
- [x] Проверен ПОЛНЫЙ порядок middleware Express
- [x] Определена конфигурация express-session (saveUninitialized: true, sameSite: отсутствует)
- [x] Найдена OAuth2Strategy конфигурация (стандартная Yandex, state: true)
- [x] Найден verify callback (socialLogin.js)
- [x] Найден oauthHandler (всегда завершает response)
- [x] Проверено завершение HTTP response (ВСЕ пути завершены)
- [x] Проверена session между redirect и callback (ТРЕБУЕТ passport.session())
- [x] Проверено совпадение callback route (ДВА маршрута - ПОТЕНЦИАЛЬНОЕ НЕСООТВЕТСТВИЕ)
- [x] Определена точка зависания (КРИТИЧНО: passport.session() отсутствует)

---

## 📌 КЛЮЧЕВЫЕ ВЫВОДЫ

1. **КРИТИЧЕСКАЯ ПРОБЛЕМА**: `passport.session()` middleware НЕ вызывается
   - State НЕ сохраняется в session между запросами
   - Passport OAuth2Strategy не может верифицировать state
   - Результат: Браузер зависает или получает ошибку

2. **ВТОРАЯ ПРОБЛЕМА**: Два callback маршрута могут вызвать несоответствие
   - `/oauth/yandex/callback` (основной)
   - `/auth/yandex-callback` (альтернативный)
   - YANDEX_URI может переопределить какой использовать

3. **ТРЕТЬЯ ПРОБЛЕМА**: checkDomainAllowed редиректит на /login вместо error route
   - Может быть неожиданным поведением для OAuth flow

4. **ПОЛОЖИТЕЛЬНО**: oauthHandler корректно завершает HTTP response
   - Все пути имеют завершение (redirect или next(error))

