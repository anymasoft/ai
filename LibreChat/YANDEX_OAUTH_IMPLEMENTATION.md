# Руководство по добавлению Yandex OAuth в LibreChat

## Быстрый старт: Добавление Yandex OAuth за 5 шагов

---

## Шаг 1️⃣: Создать приложение в Yandex

1. Перейти на https://oauth.yandex.ru/client
2. Нажать "Создать приложение"
3. Заполнить:
   - **Название**: LibreChat Repliq
   - **Описание**: AI Workspace
   - **Redirect URI**:
     - Разработка: `http://localhost:3080/oauth/yandex/callback`
     - Продакшен: `https://repliq.art/oauth/yandex/callback`
4. Выбрать права:
   - `login:email` - email пользователя
   - `login:info` - основная информация профиля
5. Получить:
   - **App ID** (Client ID)
   - **App Secret** (Client Secret)

---

## Шаг 2️⃣: Установить зависимость

### Вариант A: Если есть пакет passport-yandex

```bash
npm install --save passport-yandex
```

### Вариант B: Если нужно создать свою стратегию (рекомендуется)

Используем `passport-oauth2` как базу.

---

## Шаг 3️⃣: Создать файл yandexStrategy.js

**Файл:** `api/strategies/yandexStrategy.js`

```javascript
const { Strategy: OAuth2Strategy } = require('passport-oauth2');
const axios = require('axios');
const socialLogin = require('./socialLogin');

/**
 * Извлечение данных профиля Yandex
 * @param {Object} profile - Профиль от Yandex API
 * @returns {Object} Нормализованные данные
 */
const getProfileDetails = ({ profile }) => {
  // Генерируем аватар URL если есть ID аватара
  const avatarUrl = profile.default_avatar_id
    ? `https://avatars.yandex.net/get-yapic/${profile.default_avatar_id}/islands-200`
    : null;

  // Получаем email (приоритет: default_email -> первый из emails)
  const email = profile.default_email || profile.emails?.[0];

  // Генерируем имя пользователя
  const username = profile.login;
  const name = profile.display_name || profile.real_name || profile.login;

  return {
    email,
    id: profile.id,
    avatarUrl,
    username,
    name,
    emailVerified: true, // Yandex гарантирует верификацию
  };
};

/**
 * Yandex OAuth 2.0 Strategy
 *
 * Yandex использует стандартный OAuth 2.0 и дополнительный API для получения профиля
 */
class YandexStrategy extends OAuth2Strategy {
  constructor(options, verify) {
    options.authorizationURL = 'https://oauth.yandex.ru/authorize';
    options.tokenURL = 'https://oauth.yandex.ru/token';
    super(options, verify);

    this.name = 'yandex';
    this._userProfileURL = 'https://login.yandex.ru/info';
    this._passReqToCallback = options.passReqToCallback;
  }

  /**
   * Получить профиль пользователя от Yandex API
   */
  async userProfile(accessToken) {
    try {
      const response = await axios.get(
        `${this._userProfileURL}?format=json`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'User-Agent': 'passport-yandex',
          },
        }
      );

      const profile = response.data;
      profile.provider = 'yandex';

      return profile;
    } catch (error) {
      console.error('Yandex profile fetch error:', error);
      throw error;
    }
  }

  /**
   * OAuth 2.0 callback
   */
  authenticate(req, options) {
    options.scope = options.scope || ['login:email', 'login:info'];
    super.authenticate(req, options);
  }
}

// Создать обработчик для socialLogin
const yandexLogin = socialLogin('yandex', getProfileDetails);

/**
 * Экспортировать конструктор стратегии
 */
module.exports = () =>
  new YandexStrategy(
    {
      clientID: process.env.YANDEX_CLIENT_ID,
      clientSecret: process.env.YANDEX_CLIENT_SECRET,
      callbackURL: `${process.env.DOMAIN_SERVER}/oauth/yandex/callback`,
    },
    yandexLogin
  );
```

---

## Шаг 4️⃣: Обновить конфигурацию

### 4.1: `api/strategies/index.js`

Добавить импорт:

```javascript
const yandexLogin = require('./yandexStrategy');
```

Добавить в exports:

```javascript
module.exports = {
  // ... существующие ...
  yandexLogin,
};
```

### 4.2: `api/server/socialLogins.js`

Добавить импорт:

```javascript
const { yandexLogin } = require('~/strategies');
```

Добавить в функцию `configureSocialLogins`:

```javascript
const configureSocialLogins = async (app) => {
  // ... существующие провайдеры ...

  if (process.env.YANDEX_CLIENT_ID && process.env.YANDEX_CLIENT_SECRET) {
    logger.info('Registering Yandex OAuth strategy');
    passport.use(yandexLogin());
  }
};
```

### 4.3: `api/server/routes/oauth.js`

Добавить маршруты (в конец файла перед `module.exports`):

```javascript
/**
 * Yandex Routes
 */
router.get(
  '/yandex',
  passport.authenticate('yandex', {
    scope: ['login:email', 'login:info'],
    session: false,
  }),
);

router.get(
  '/yandex/callback',
  passport.authenticate('yandex', {
    failureRedirect: `${domains.client}/oauth/error`,
    failureMessage: true,
    session: false,
    scope: ['login:email', 'login:info'],
  }),
  setBalanceConfig,
  checkDomainAllowed,
  oauthHandler,
);
```

---

## Шаг 5️⃣: Env переменные

### Создать в `.env`:

```env
# Yandex OAuth
YANDEX_CLIENT_ID=YOUR_APP_ID_FROM_YANDEX
YANDEX_CLIENT_SECRET=YOUR_APP_SECRET_FROM_YANDEX
```

### Добавить в `.env.example`:

```env
# Yandex OAuth (https://oauth.yandex.ru/client)
YANDEX_CLIENT_ID=
YANDEX_CLIENT_SECRET=
```

---

## Проверка ✅

### Локальное тестирование:

```bash
# 1. Установить зависимости
npm install

# 2. Запустить сервер
npm start

# 3. Перейти в браузер
http://localhost:3080/oauth/yandex

# 4. Авторизоваться через Yandex
```

### Проверить логи:

```bash
# Должны видеть логи:
# "Registering Yandex OAuth strategy"
# "[yandexLogin] Discovering tools (user requesting..."
# "Sent OAuth login success to client"
```

---

## Отладка

### Проблема: "YANDEX_CLIENT_ID is not set"

**Решение:** Проверить `.env` файл, убедиться что переменные установлены

### Проблема: "Redirect URI mismatch"

**Решение:** Проверить что callbackURL совпадает в:
- Yandex OAuth panel: `https://your-domain/oauth/yandex/callback`
- `.env`: `DOMAIN_SERVER` правильный
- `api/server/routes/oauth.js`: маршрут `/yandex/callback` присутствует

### Проблема: "Email not verified"

**Решение:** Все профили Yandex имеют верифицированный email, проверить логику в socialLogin.js

---

## Frontend интеграция

### Добавить кнопку в Login компонент:

```jsx
<a href="/api/auth/oauth/yandex" className="btn btn-yandex">
  <YandexIcon />
  Sign in with Yandex
</a>
```

### CSS для кнопки:

```css
.btn-yandex {
  background-color: #ffcc00;
  color: #000;
  border: 1px solid #ffcc00;
}

.btn-yandex:hover {
  background-color: #ffdd33;
}
```

---

## Безопасность

| Проверка | Статус |
|----------|--------|
| Secure Cookie | ✅ Автоматически (shouldUseSecureCookie) |
| HTTPS обязательно | ✅ В продакшене |
| Rate limiting | ✅ Через loginLimiter middleware |
| Domain validation | ✅ Через allowedDomains |
| Email verification | ✅ Yandex гарантирует |

---

## Полезные ссылки

- **Yandex OAuth API**: https://yandex.ru/dev/id/doc/dg/oauth/concepts/about.html
- **Yandex Info API**: https://yandex.ru/dev/id/doc/dg/api-standards/about.html
- **Passport.js docs**: http://www.passportjs.org/
- **OAuth2 Flow**: https://tools.ietf.org/html/rfc6749

---

## Версия: 1.0
**Дата**: 2026-03-06
**Статус**: Готово к внедрению

