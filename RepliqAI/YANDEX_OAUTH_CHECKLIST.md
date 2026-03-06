# ✅ Чек-лист добавления Yandex OAuth

---

## 📋 Фаза 1: Подготовка

- [ ] **Создать приложение на Yandex**
  - [ ] Перейти на https://oauth.yandex.ru/client
  - [ ] Создать новое приложение "LibreChat Repliq"
  - [ ] Добавить Redirect URI:
    - [ ] `http://localhost:3080/oauth/yandex/callback` (dev)
    - [ ] `https://repliq.art/oauth/yandex/callback` (prod)
  - [ ] Выбрать права: `login:email`, `login:info`
  - [ ] Получить Client ID (App ID)
  - [ ] Получить Client Secret (App Secret)
  - [ ] Сохранить учетные данные в безопасном месте

- [ ] **Изучить документацию**
  - [ ] Прочитать AUDIT_AUTHORIZATION_SYSTEM.md
  - [ ] Изучить YANDEX_OAUTH_IMPLEMENTATION.md
  - [ ] Посмотреть AUTH_ARCHITECTURE_DIAGRAM.md

---

## 🔧 Фаза 2: Разработка

### Шаг 1: Создать файл yandexStrategy.js

- [ ] Создать файл: `api/strategies/yandexStrategy.js`
- [ ] Скопировать базовый код из документации
- [ ] Убедиться что:
  - [ ] Используется `passport-oauth2` как базовый Strategy
  - [ ] URL авторизации: `https://oauth.yandex.ru/authorize`
  - [ ] URL токена: `https://oauth.yandex.ru/token`
  - [ ] URL профиля: `https://login.yandex.ru/info`
  - [ ] Скоп: `login:email login:info`
  - [ ] Функция getProfileDetails правильно извлекает:
    - [ ] `email` из `default_email` или `emails[0]`
    - [ ] `id` из `profile.id`
    - [ ] `username` из `profile.login`
    - [ ] `name` из `display_name`
    - [ ] `avatarUrl` (генерируется из avatar ID)

### Шаг 2: Обновить strategies/index.js

- [ ] Добавить импорт: `const yandexLogin = require('./yandexStrategy');`
- [ ] Добавить в module.exports: `yandexLogin,`
- [ ] Проверить синтаксис (npm run lint)

### Шаг 3: Обновить api/server/socialLogins.js

- [ ] Добавить импорт: `const { yandexLogin } = require('~/strategies');`
- [ ] Добавить в функцию configureSocialLogins():
  ```javascript
  if (process.env.YANDEX_CLIENT_ID && process.env.YANDEX_CLIENT_SECRET) {
    logger.info('Registering Yandex OAuth strategy');
    passport.use(yandexLogin());
  }
  ```
- [ ] Проверить что строки добавлены перед `logger.info('Social logins configured')`

### Шаг 4: Обновить api/server/routes/oauth.js

- [ ] Добавить маршруты в конец файла (перед `module.exports`):
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
- [ ] Проверить синтаксис

### Шаг 5: Обновить .env и .env.example

- [ ] Добавить в `.env`:
  ```
  YANDEX_CLIENT_ID=your_app_id_from_yandex
  YANDEX_CLIENT_SECRET=your_app_secret_from_yandex
  ```
- [ ] Добавить в `.env.example`:
  ```
  # Yandex OAuth (https://oauth.yandex.ru/client)
  YANDEX_CLIENT_ID=
  YANDEX_CLIENT_SECRET=
  ```

### Шаг 6: Опционально - обновить User schema

- [ ] Проверить `db/models/userSchema.js` или User model
- [ ] Убедиться что есть поле для ID каждого провайдера
- [ ] Если нужно, добавить: `yandexId: { type: String, sparse: true }`

---

## 🧪 Фаза 3: Тестирование

### Локальное тестирование

- [ ] **Установить зависимости:**
  ```bash
  npm install
  ```

- [ ] **Запустить сервер:**
  ```bash
  npm start
  ```
  - [ ] Убедиться что логи содержат:
    - `"Configuring social logins..."`
    - `"Registering Yandex OAuth strategy"`
    - `"Social logins configured successfully"`

- [ ] **Проверить маршруты:**
  ```bash
  curl http://localhost:3080/api/auth/oauth/yandex -v
  ```
  - [ ] Должен вернуть 302 redirect на Yandex OAuth
  - [ ] URL должен содержать правильный client_id

- [ ] **Мануальное тестирование в браузере:**
  - [ ] Открыть http://localhost:3080/login
  - [ ] Найти кнопку "Sign in with Yandex" (если добавлена в UI)
  - [ ] Клик на кнопку
  - [ ] Должен перенаправиться на https://oauth.yandex.ru/authorize
  - [ ] Авторизоваться с Yandex аккаунтом
  - [ ] Должен вернуться на приложение с установленными cookies
  - [ ] Проверить что пользователь залогирован

- [ ] **Проверить логи для ошибок:**
  ```bash
  npm start 2>&1 | grep -i "yandex\|error"
  ```

### Тестирование коллизий

- [ ] **Тестировать первый login:**
  - [ ] User1 логирует через Yandex
  - [ ] Должно создаться новое пользователь в БД
  - [ ] Должна быть проверка emailVerified

- [ ] **Тестировать повторный login:**
  - [ ] User1 логирует через Yandex снова
  - [ ] Должно найти существующего пользователя
  - [ ] Должна обновиться информация профиля (avatar, name)

- [ ] **Тестировать конфликт доменов:**
  - [ ] Если у приложения есть allowedDomains
  - [ ] Пытаться логиться с не-разрешённого домена
  - [ ] Должно вернуть ошибку "Email domain not allowed"

- [ ] **Тестировать отключенную регистрацию:**
  - [ ] Если ALLOW_SOCIAL_REGISTRATION=false
  - [ ] Новый пользователь должен получить ошибку
  - [ ] Существующий пользователь должен логиться нормально

### Тестирование безопасности

- [ ] **Проверить secure cookies:**
  - [ ] DevTools → Cookies
  - [ ] Cookie должны иметь флаги: Secure, HttpOnly, SameSite=Lax

- [ ] **Проверить CSRF защиту:**
  - [ ] State параметр должен быть валидирован

- [ ] **Проверить rate limiting:**
  - [ ] Быстро нажать много раз на login
  - [ ] Должно получить 429 Too Many Requests

---

## 📱 Фаза 4: Frontend интеграция (опционально)

- [ ] **Найти Login компонент:**
  - [ ] Файл типа: `client/src/pages/Login.tsx` или `Login.jsx`
  - [ ] Или компонент OAuth buttons: `client/src/components/OAuthButtons.tsx`

- [ ] **Добавить кнопку Yandex:**
  ```jsx
  <a href="/api/auth/oauth/yandex" className="btn btn-yandex">
    <img src="/icons/yandex.svg" alt="Yandex" />
    Sign in with Yandex
  </a>
  ```

- [ ] **Добавить CSS для кнопки:**
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

- [ ] **Добавить иконку Yandex:**
  - [ ] Скачать иконку с https://yandex.ru/design/
  - [ ] Сохранить в `client/public/icons/yandex.svg`

---

## ✨ Фаза 5: Финальная проверка

- [ ] **Code Review:**
  - [ ] Проверить что нет console.log() в production коде
  - [ ] Проверить что нет хардкодированных секретов
  - [ ] Проверить что следуем стилю существующего кода

- [ ] **Тестирование на production конфигурации:**
  - [ ] Обновить DOMAIN_SERVER на prod URL
  - [ ] Обновить redirect URI в Yandex OAuth
  - [ ] Протестировать на prod домене

- [ ] **Документация:**
  - [ ] Обновить README с информацией о Yandex OAuth
  - [ ] Добавить в CONTRIBUTING.md инструкции по добавлению новых провайдеров

- [ ] **Коммит:**
  ```bash
  git add api/strategies/yandexStrategy.js
  git add api/strategies/index.js
  git add api/server/socialLogins.js
  git add api/server/routes/oauth.js
  git add .env.example
  git commit -m "feat: Add Yandex OAuth support

  - Create YandexStrategy with passport-oauth2
  - Register strategy in socialLogins
  - Add /oauth/yandex and /oauth/yandex/callback routes
  - Support Yandex profile extraction and user creation
  - Add YANDEX_CLIENT_ID and YANDEX_CLIENT_SECRET env vars"
  ```

---

## 🔍 Чек-лист отладки при проблемах

| Проблема | Решение | Статус |
|----------|---------|--------|
| YANDEX_CLIENT_ID не найден | Проверить `.env` файл | [ ] |
| Redirect URI mismatch | Проверить DOMAIN_SERVER и callback URL в Yandex | [ ] |
| 404 на /oauth/yandex | Проверить что маршруты добавлены в routes/oauth.js | [ ] |
| "Strategy not found" | Проверить что yandexLogin добавлена в socialLogins.js | [ ] |
| Email not in profile | Проверить что getProfileDetails правильно извлекает email | [ ] |
| Пользователь не создается | Проверить что ALLOW_SOCIAL_REGISTRATION=true | [ ] |
| Cookies не устанавливаются | Проверить что shouldUseSecureCookie() и протокол HTTPS | [ ] |
| Rate limiting ошибки | Подождать минуту или перезагрузить | [ ] |

---

## 📊 Метрики успеха

После реализации:

- [ ] 0 ошибок в логах при OAuth flow
- [ ] 100% пользователей могут залогиться через Yandex
- [ ] Время авторизации < 2 сек
- [ ] Все cookies установлены с правильными флагами
- [ ] Profile информация корректно извлекается
- [ ] Новые пользователи создаются в БД
- [ ] Повторные логины работают без ошибок
- [ ] Email домены проверяются если нужно

---

## 📞 Контакты для поддержки

| Проблема | Ресурс |
|----------|--------|
| Yandex OAuth API | https://yandex.ru/dev/id/doc/dg/oauth/concepts/about.html |
| Passport.js | http://www.passportjs.org/ |
| OAuth2.0 Spec | https://tools.ietf.org/html/rfc6749 |
| LibreChat Issues | https://github.com/danny-avila/LibreChat/issues |

---

## 📅 История изменений

| Версия | Дата | Примечания |
|--------|------|-----------|
| 1.0 | 2026-03-06 | Изначальный чек-лист |

