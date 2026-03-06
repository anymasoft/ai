# 🚀 Быстрый старт тестирования Yandex OAuth

## 📋 За 5 минут проверить OAuth в боевом режиме

### ✅ Шаг 0: Подготовка

```bash
# Убедиться что в .env есть:
# ─────────────────────────────────────
# YANDEX_CLIENT_ID=your_client_id
# YANDEX_CLIENT_SECRET=your_client_secret
# DOMAIN_SERVER=http://localhost:3080
# DOMAIN_CLIENT=http://localhost:3080
# ALLOW_SOCIAL_REGISTRATION=true
# ─────────────────────────────────────

# Перезагрузить сервер:
npm run dev
# или используемый вами способ запуска
```

### ✅ Шаг 1: Открыть браузер

1. Перейти на `http://localhost:3080` (или ваш URL)
2. Нажать кнопку "Sign in with Yandex"
3. **Первая проверка:** Это должно редиректить на Yandex

**В консоли сервера должны появиться эти логи:**

```
📊 AUTH_CHECKPOINT: OAUTH_REDIRECT
   - provider: yandex
   - state: a1b2c3d4...
   - redirectUri: http://localhost:3080/oauth/yandex/callback

🍪 SETTING STATE COOKIE:
   - name: oauth_state_yandex
   - value: a1b2c3d4...
   [остальные параметры]

✅ Yandex OAuth state saved to cookie
```

**Если этих логов нет → СТОП!** Смотреть "Диагностика ниже"

---

### ✅ Шаг 2: Проверить что cookie установлена

Пока на странице Yandex:

1. Открыть DevTools (`F12`)
2. Вкладка **Application** (Chrome) или **Storage** (Firefox)
3. Найти **Cookies** → `localhost`
4. Ищем: `oauth_state_yandex`

**Если есть:**
```
Name:    oauth_state_yandex
Value:   a1b2c3d4e5f6... (длинная строка)
Domain:  localhost
Path:    /
HttpOnly: ✅ Yes
Secure:  No (для localhost OK)
SameSite: Lax
```

**Если нет → СТОП!** Смотреть "Диагностика"

---

### ✅ Шаг 3: Авторизоваться на Yandex

1. Ввести email и пароль от Yandex аккаунта
2. Дать permission приложению
3. Yandex редиректит обратно на приложение

**В консоли сервера должны появиться:**

```
🔍 DEBUG: CALLBACK HEADERS & COOKIES
   - req.headers.cookie: oauth_state_yandex=a1b2c3d4...
   - req.cookies keys: oauth_state_yandex
   - req.cookies.oauth_state_yandex: a1b2c3d4...

📊 AUTH_CHECKPOINT: OAUTH_CALLBACK_START
   - provider: yandex
   - error: none
   - code: [код от Yandex]
   - state: a1b2c3d4...
   - savedState from cookie: a1b2c3d4...

✅ State verified successfully

📡 Exchanging code for tokens...

✅ Tokens received

👤 Fetching user info from Yandex...

✅ User info received
```

**Если видите эти логи → ВСЁ РАБОТАЕТ!** Браузер редиректится на `/chat`

---

## ❌ Диагностика

### Проблема: Логи "OAUTH_REDIRECT" не появляются

**Причина:** Редирект на `/oauth/yandex` не сработал

**Проверьте:**
```bash
# 1. YANDEX_CLIENT_ID установлен?
grep "YANDEX_CLIENT_ID" .env

# 2. Сервер перезагружен?
# (Убить сервер и запустить заново)

# 3. Route зарегистрирован?
grep -n "router.get('/yandex'" /api/server/routes/oauth.js
# Должна быть строка: router.get('/yandex', yandexOAuthRedirect);
```

### Проблема: Cookie отсутствует в DevTools

**Причины:**
1. Браузер заблокировал (secure параметр неправильный)
2. Другой домен (localhost vs 127.0.0.1)
3. sameSite: 'strict' вместо 'lax'

**Проверьте в `/api/server/controllers/auth/yandex.js` строку ~48:**

```javascript
res.cookie('oauth_state_yandex', state, {
  httpOnly: true,
  secure: false,         // ← ДОЛЖНО БЫТЬ FALSE для localhost
  sameSite: 'lax',       // ← ДОЛЖНО БЫТЬ 'lax', не 'strict'
  path: '/',             // ← Правильно
  maxAge: 10 * 60 * 1000
});
```

### Проблема: Cookie есть в DevTools, но отсутствует на callback

**Логи будут:**
```
req.cookies.oauth_state_yandex: ❌ NOT FOUND
```

**Проверьте:**
1. Домен не изменился ли (смотреть URL в браузере)
   - Должно быть: `http://localhost:3080/...`
   - НЕ должно быть: `http://127.0.0.1:3080/...`

2. Два редиректа ли подряд
   - Может быть редирект на главную, потом на callback
   - Cookie может не отправиться во втором редиректе

### Проблема: State не совпадает

**Логи:**
```
state: NEW_VALUE_XYZ...
savedState from cookie: OLD_VALUE_ABC...
❌ AUTH_FAILED - state mismatch
```

**Причины:**
- Прошло > 10 минут (cookie истекла)
- Открыли в разных браузерах/вкладках
- Несколько редиректов подряд

**Решение:** Попробовать ещё раз (полностью новый flow)

### Проблема: "Failed to get tokens from Yandex"

**Логи:**
```
📡 Exchanging code for tokens...
❌ Failed to get tokens from Yandex: 401 ...
```

**Причины:**
- YANDEX_CLIENT_SECRET неправильный
- Code уже использован
- Code истёк (обычно 10 мин)

**Решение:**
1. Проверить CLIENT_SECRET в .env
2. Попробовать ещё раз (новый code)
3. Убедиться что redirectUri совпадает

### Проблема: "Failed to create/update user"

**Логи:**
```
USER_CREATED
   - email: user@example.com
...
❌ Failed to create/update user: ...
```

**Причины:**
- Ошибка в БД
- User с таким email уже существует другой регистрацией
- ALLOW_SOCIAL_REGISTRATION=false

**Решение:**
1. Проверить .env: `ALLOW_SOCIAL_REGISTRATION=true`
2. Проверить логи БД ошибки

---

## 🎯 Контрольный список конфигурации

Перед тестированием убедиться:

```
☐ .env содержит:
  ☐ YANDEX_CLIENT_ID=[your_id]
  ☐ YANDEX_CLIENT_SECRET=[your_secret]
  ☐ DOMAIN_SERVER=http://localhost:3080
  ☐ DOMAIN_CLIENT=http://localhost:3080
  ☐ ALLOW_SOCIAL_REGISTRATION=true
  ☐ ALLOW_SOCIAL_LOGIN=true (если есть)

☐ Yandex приложение (https://oauth.yandex.ru/client) содержит:
  ☐ Callback URL = http://localhost:3080/oauth/yandex/callback
  ☐ Permissions = требуемые

☐ Код:
  ☐ yandex.js существует: /api/server/controllers/auth/yandex.js
  ☐ Routes правильные: /api/server/routes/oauth.js содержит:
    ☐ router.get('/yandex', yandexOAuthRedirect);
    ☐ router.get('/yandex/callback', yandexOAuthCallback);
  ☐ Cookie параметры: secure: false, sameSite: 'lax', path: '/'

☐ Сервер:
  ☐ Перезагружен после изменения .env
  ☐ Запущен без ошибок
  ☐ Логирует на консоль
```

---

## 📊 Таблица диагностики

| Где ломается | Логи | Причина | Решение |
|--------------|------|---------|---------|
| Редирект на Yandex | Нет `OAUTH_REDIRECT` | Нет YANDEX_CLIENT_ID | Добавить в .env |
| Cookie установка | Есть `SETTING STATE COOKIE`, нет в DevTools | secure: true при localhost | Изменить на false |
| Cookie отправка | Есть в DevTools, но `❌ NOT FOUND` на callback | Domain мисмэтч (localhost vs 127.0.0.1) | Использовать один домен |
| State проверка | `state mismatch` | Cookie истекла или старая | Попробовать заново |
| Token exchange | "Failed to get tokens" | Неправильный SECRET | Проверить .env |
| User creation | "Failed to create/update user" | ALLOW_SOCIAL_REGISTRATION=false | Установить true |

---

## 🔗 Дополнительные ресурсы

Если этот быстрый старт не помог:

1. **Подробная отладка:** `OAUTH_DEBUG_GUIDE.md`
2. **Проверка middleware:** `COOKIE_MIDDLEWARE_VERIFICATION.md`
3. **Чтение логов:** `OAUTH_CONSOLE_OUTPUT_REFERENCE.md`
4. **Полная реализация:** `YANDEX_OAUTH_IMPLEMENTATION.md`

---

## 🚀 Если всё работает!

Поздравляем! 🎉

Следующие шаги:

1. **Тестирование на производстве:**
   - Изменить `secure: false` на `secure: process.env.NODE_ENV === 'production'`
   - Убедиться что HTTPS работает

2. **Очистка логов:**
   - Удалить debug логи (опционально)
   - Оставить важные чекпоинты

3. **Документирование:**
   - Обновить README с инструкциями по настройке Yandex OAuth
   - Добавить информацию о требуемых .env переменных

4. **Безопасность:**
   - Убедиться что YANDEX_CLIENT_SECRET не коммитится
   - Проверить что cookie защищены httpOnly
