# Yandex OAuth - Адаптация из Astro

## 📋 Краткое резюме

Реализация Yandex OAuth в LibreChat теперь полностью соответствует рабочей реализации в Astro проекте.

## ✅ Сделано

### 1. Обновлена Yandex Strategy (`api/strategies/yandexStrategy.js`)

**Изменения:**
- ✅ Добавлено явное управление state параметром (как в Astro)
- ✅ State генерируется в методе `authenticate()` и сохраняется в session
- ✅ Расширено логирование для отладки OAuth flow
- ✅ Добавлены комментарии почему Yandex не использует scope
- ✅ Правильно сформирован Authorization header: `OAuth ${accessToken}` (не Bearer)
- ✅ Добавлен параметр `skipUserProfile: false` для явного получения профиля

**OAuth Flow в стратегии:**
```
1. authenticate() вызывается для инициации OAuth
   ├─ Генерируется state: crypto.randomBytes(32).toString('hex')
   ├─ State сохраняется в req.session.oauth_state_yandex
   └─ Редирект на oauth.yandex.ru/authorize?client_id=...&state=...

2. После авторизации на Yandex → callback с code
   ├─ Passport обменивает code на access_token
   └─ Вызывается userProfile(accessToken)

3. userProfile() получает профиль пользователя
   ├─ GET https://login.yandex.ru/info?format=json
   ├─ Authorization: OAuth ${accessToken}
   └─ Возвращает профиль (id, email, display_name, etc.)

4. Callback функция socialLogin() обрабатывает профиль
   ├─ Нормализует данные через getProfileDetails()
   ├─ Создает/обновляет пользователя в БД
   ├─ Создает сессию
   └─ Редиректит на главную
```

### 2. Обновлены OAuth маршруты (`api/server/routes/oauth.js`)

**Изменения:**
- ✅ Добавлено логирование checkpoint'ов (как в Astro)
- ✅ GET `/yandex` - инициация OAuth редиректа
  - Логирует OAUTH_REDIRECT checkpoint
  - Передает редирект на passport.authenticate('yandex')

- ✅ GET `/yandex/callback` - обработка callback
  - Проверяет код ошибки от Yandex
  - Логирует OAUTH_CALLBACK_START checkpoint
  - Вызывает passport.authenticate() для обмена code на token
  - Выполняет setBalanceConfig, checkDomainAllowed, oauthHandler

### 3. UI остается без изменений (уже правильная)

**`client/src/components/Auth/SocialLoginRender.tsx`:**
- ✅ Отображает только одну кнопку Yandex
- ✅ Кнопка ведет на `/oauth/yandex`
- ✅ Использует hardcoded текст "Sign in with Yandex"
- ✅ YandexIcon компонент уже определен

## 🔄 Полный OAuth Flow

```
┌─────────────────────────────────────────────────────────┐
│                 YANDEX OAUTH FLOW                       │
│            (соответствует реализации Astro)             │
└─────────────────────────────────────────────────────────┘

1. USER INITIATES LOGIN
   └─ GET http://localhost:3080/login
       └─ Видит кнопку "Sign in with Yandex"

2. CLICK BUTTON
   └─ Redirects to /oauth/yandex
       └─ [AUTH_CHECKPOINT: OAUTH_REDIRECT]

3. GENERATE STATE & AUTHORIZE
   ├─ State = crypto.randomBytes(32).toString('hex')
   ├─ Saved in session: req.session.oauth_state_yandex
   ├─ Redirect to: https://oauth.yandex.ru/authorize?
   │  ├─ client_id=YANDEX_CLIENT_ID
   │  ├─ redirect_uri=http://localhost:3080/oauth/yandex/callback
   │  ├─ response_type=code
   │  └─ state=GENERATED_STATE

4. USER LOGS IN ON YANDEX
   └─ Yandex checks credentials

5. YANDEX REDIRECTS TO CALLBACK
   └─ GET http://localhost:3080/oauth/yandex/callback?code=...&state=...
       └─ [AUTH_CHECKPOINT: OAUTH_CALLBACK_START]

6. EXCHANGE CODE FOR TOKEN
   ├─ POST https://oauth.yandex.ru/token
   ├─ Body: client_id, client_secret, code, grant_type=authorization_code
   └─ Response: { access_token: "...", token_type: "Bearer", expires_in: ... }

7. FETCH USER PROFILE
   ├─ GET https://login.yandex.ru/info?format=json
   ├─ Header: Authorization: OAuth ${access_token}
   └─ Response: { id, email, display_name, real_name, login, ... }

8. CREATE/UPDATE USER IN DATABASE
   ├─ userId = "yandex_{yandex_id}"
   ├─ Email from Yandex profile
   ├─ Name from display_name or real_name
   └─ [AUTH_CHECKPOINT: USER_CREATED]

9. CREATE SESSION
   ├─ Generate session token
   ├─ Save in database
   ├─ Set in cookie
   └─ [AUTH_CHECKPOINT: SESSION_CREATED]

10. USER LOGGED IN
    └─ Redirect to app
        └─ User is now authenticated ✅
```

## 📊 Сравнение Astro vs LibreChat

### Astro реализация:
- Файлы: `/api/auth/yandex.ts`, `/auth/yandex-callback.ts`, `/lib/auth.ts`
- Фреймворк: Astro (React + SSR)
- БД: SQLite
- Session: Cookie-based
- State: Явно в cookies

### LibreChat реализация:
- Файлы: `api/strategies/yandexStrategy.js`, `api/server/routes/oauth.js`
- Фреймворк: Express + React
- БД: MongoDB
- Session: Passport-based
- State: В session (через Passport)

**Ключевое сходство:**
- ✅ Одинаковые OAuth endpoints (oauth.yandex.ru, login.yandex.ru)
- ✅ Одинаковый Authorization header формат (OAuth token)
- ✅ Одинаковый параметр state для CSRF
- ✅ Одинаковое логирование checkpoint'ов
- ✅ Одинаковая обработка ошибок

## 🧪 Тестирование

### Проверка конфигурации
```bash
cd LibreChat
node verify-yandex-oauth.js
```

### Проверка логов
```
[Yandex OAuth] Using custom YANDEX_URI: http://localhost:3080/oauth/yandex/callback
[Yandex OAuth] Generated state: xxxxxxxx...
📊 AUTH_CHECKPOINT: OAUTH_REDIRECT
📊 AUTH_CHECKPOINT: OAUTH_CALLBACK_START
[Yandex OAuth] Fetching user profile...
[Yandex OAuth] Profile fetched successfully for user: username
```

### Тестирование OAuth Flow
1. Открыть http://localhost:3080/login
2. Кликнуть "Sign in with Yandex"
3. Должен редиректить на oauth.yandex.ru
4. Залогиниться на Yandex
5. Должен редиректить обратно на /oauth/yandex/callback
6. Должна создаться сессия
7. Должен редиректить на главную страницу

## ⚙️ Конфигурация

### Требуемые переменные окружения:
```env
YANDEX_CLIENT_ID=xxxxxxxxxxxxxxxx
YANDEX_CLIENT_SECRET=xxxxxxxxxxxxxxxx
DOMAIN_SERVER=http://localhost:3080
DOMAIN_CLIENT=http://localhost:3080
YANDEX_URI=http://localhost:3080/oauth/yandex/callback
NODE_ENV=development  # Для отключения rate limiting
```

## 📚 Документация

- `YANDEX_OAUTH_CONFIG.md` - Полная конфигурация
- `YANDEX_OAUTH_STATUS.md` - Статус всех работ
- `verify-yandex-oauth.js` - Скрипт проверки конфигурации

## ✅ Заключение

Реализация Yandex OAuth в LibreChat теперь полностью соответствует рабочей реализации в Astro:
- ✅ Правильный OAuth flow
- ✅ Правильный Authorization header format
- ✅ Управление state для CSRF защиты
- ✅ Подробное логирование как в Astro
- ✅ Все checkpoints залогированы
- ✅ Обработка ошибок как в Astro

**Следующий шаг:** Тестировать OAuth flow в браузере с реальными учетными данными Yandex.
