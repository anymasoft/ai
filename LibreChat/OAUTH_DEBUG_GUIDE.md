# 🔍 Руководство по отладке Yandex OAuth State Cookie

## 📋 Описание проблемы

**Симптом**: При OAuth callback получаем `state: XXXXX` из URL, но `savedState from cookie: MISSING`

Это означает, что cookie `oauth_state_yandex` **не отправляется браузером обратно** на callback.

---

## 🎯 Причины и решения

### Причина 1: Cookie параметры неправильные

**Проверяемые параметры:**

| Параметр | Текущее значение | Требуемое значение |
|----------|------------------|-------------------|
| name | `oauth_state_yandex` | ✅ Правильное |
| httpOnly | `true` | ✅ Правильное |
| secure | `false` (для localhost) | ✅ Правильное для тестирования |
| sameSite | `'lax'` | ✅ Правильное |
| path | `/` | ✅ Правильное |
| maxAge | `600000` (10 мин) | ✅ Правильное |

**Текущий код в `/api/server/controllers/auth/yandex.js`:**

```javascript
res.cookie('oauth_state_yandex', state, {
  httpOnly: true,
  secure: false,        // Для localhost
  sameSite: 'lax',      // Важно!
  path: '/',            // Охватывает весь домен
  maxAge: 10 * 60 * 1000, // 10 минут
});
```

---

## 🔧 Пошаговая отладка

### Шаг 1: Запустить приложение и проверить логи при редиректе

Перейти в браузер на: `http://localhost:3080/oauth/yandex`

**Ожидаемые логи на сервере:**

```
📊 AUTH_CHECKPOINT: OAUTH_REDIRECT
   - provider: yandex
   - state: a1b2c3d4...
   - redirectUri: http://localhost:3080/oauth/yandex/callback

🍪 SETTING STATE COOKIE:
   - name: oauth_state_yandex
   - value: a1b2c3d4...
   - httpOnly: true
   - secure: false
   - sameSite: lax
   - path: /
   - maxAge: 600000 (10 min)

✅ Yandex OAuth state saved to cookie
```

**Что проверить:**
- ✅ Логи печатаются?
- ✅ State генерируется правильно?
- ✅ Message "state saved to cookie" появляется?

---

### Шаг 2: Проверить что cookie установлена в браузере

**Используя DevTools браузера:**

1. Открыть `F12` (DevTools)
2. Перейти на вкладку **Application** (или **Storage** в Firefox)
3. Найти **Cookies** → `http://localhost:3080`
4. Ищем `oauth_state_yandex`

**Ожидаемое:**

| Свойство | Значение |
|----------|----------|
| Name | `oauth_state_yandex` |
| Value | `a1b2c3d4...` (64-символьная строка) |
| Domain | `localhost` |
| Path | `/` |
| Expires / MaxAge | ~10 минут с момента установки |
| HttpOnly | ✅ Yes |
| Secure | ❌ No (для localhost) |
| SameSite | `Lax` |

**Если cookie отсутствует:**
- ❌ Возможно, что-то блокирует установку cookie
- ❌ Проверить консоль браузера на ошибки
- ❌ Проверить что `secure: false` для localhost

---

### Шаг 3: Полный OAuth flow с логированием callback

**На этапе callback браузер должен автоматически отправить cookie обратно.**

Браузер редиректит на: `http://localhost:3080/oauth/yandex/callback?code=...&state=...`

**Ожидаемые логи на сервере (при успехе):**

```
🔍 DEBUG: CALLBACK HEADERS & COOKIES
   - req.headers.cookie: oauth_state_yandex=a1b2c3d4...; [другие cookies]
   - req.cookies keys: oauth_state_yandex, [другие cookies]
   - req.cookies.oauth_state_yandex: a1b2c3d4...

📊 AUTH_CHECKPOINT: OAUTH_CALLBACK_START
   - provider: yandex
   - error: none
   - code: 1234567890...
   - state: a1b2c3d4...
   - savedState from cookie: a1b2c3d4...

✅ State verified successfully
```

**Если `req.cookies.oauth_state_yandex: ❌ NOT FOUND`:**

Переходим к диагностике ниже.

---

## 🐛 Диагностика когда cookie отсутствует на callback

### Проблема 1: Cookie заблокирована браузером

**Решение:**
- Убедиться что `secure: false` для localhost (иначе браузер не примет)
- Убедиться что `sameSite: 'lax'` (не `strict`)
- Убедиться что `path: '/'` (охватывает оба маршрута: `/oauth/yandex` и `/oauth/yandex/callback`)

### Проблема 2: Редирект на другой домен/порт

**Если URL в браузере меняется (например, с localhost:3080 на 127.0.0.1:3080):**

Cookies привязаны к конкретному **domain**. Браузер не пошлёт cookie если домен меняется.

**Проверить:**
```bash
# В .env должно быть:
DOMAIN_SERVER=http://localhost:3080
DOMAIN_CLIENT=http://localhost:3080

# И в Yandex приложении callback URL должен быть:
# http://localhost:3080/oauth/yandex/callback
```

**НЕ ДОЛЖНО быть:**
- `localhost` и `127.0.0.1` одновременно (это разные домены!)
- `localhost:3080` и `localhost` без портов

### Проблема 3: cookieParser middleware отсутствует или неправильно расположен

**Проверить `/api/server/index.js`:**

```javascript
// На линии ~146 должно быть:
app.use(cookieParser());
```

**Порядок middleware ВАЖЕН:**

```javascript
1. express.json()
2. express.urlencoded()
3. mongoSanitize()
4. cors()
5. cookieParser()  ← Здесь!
6. session()
7. passport.initialize()
```

Если `cookieParser()` идёт **после** `session()`, cookies не будут парсироваться.

---

## 📊 Полный алгоритм отладки

```
┌─ Запустить сервер
├─ Перейти на /oauth/yandex
├─ Проверить логи "SETTING STATE COOKIE"
│  └─ Если нет → ошибка в редиректе, проверить консоль
│
├─ Открыть DevTools → Application → Cookies
├─ Искать oauth_state_yandex
│  ├─ Если есть → OK, переходим дальше
│  └─ Если нет → Проблема с установкой cookie
│      ├─ Проверить secure/sameSite параметры
│      ├─ Проверить консоль браузера на ошибки
│      └─ Проверить что localhost (не 127.0.0.1)
│
├─ Пройти OAuth авторизацию на Yandex
├─ После редиректа обратно проверить логи "DEBUG: CALLBACK HEADERS & COOKIES"
│  ├─ Если req.headers.cookie содержит oauth_state_yandex → OK!
│  └─ Если ❌ EMPTY → Cookie не отправляется браузером
│      ├─ Проверить что домен не изменился
│      ├─ Проверить что страница загружается по тому же домену
│      └─ Проверить DevTools → Network → смотреть Cookie header на GET /oauth/yandex/callback
│
└─ Если cookie есть, но state не совпадает:
   ├─ Может быть timeout > 10 минут
   ├─ Может быть несколько вкладок/браузеров одновременно
   └─ Может быть cookie был очищен
```

---

## 🛠️ Инструменты отладки

### Способ 1: Посмотреть Network в DevTools

1. Открыть DevTools (`F12`)
2. Вкладка **Network**
3. Установить фильтр на `yandex` (чтобы видеть только OAuth запросы)
4. Нажать на GET запрос `/oauth/yandex/callback`
5. В правой панели смотреть **Request Headers** → **Cookie:**

Там должно быть: `oauth_state_yandex=a1b2c3d4...`

### Способ 2: Проверить сервер логи

```bash
# Если используется Docker:
docker logs <container_name> | grep -A 20 "DEBUG: CALLBACK"

# Если запущено локально:
# Просто смотреть в консоль где запущен npm/node
```

### Способ 3: Временно добавить логирование в браузер

В файле `/api/server/controllers/auth/yandex.js`, функция `yandexOAuthCallback`:

```javascript
// Добавить после парсирования cookies:
console.log('Full cookies object:', JSON.stringify(req.cookies, null, 2));
```

---

## 🎯 Контрольный список перед тестированием

- [ ] `.env` содержит `YANDEX_CLIENT_ID` и `YANDEX_CLIENT_SECRET`
- [ ] `.env` содержит `DOMAIN_SERVER=http://localhost:3080`
- [ ] `.env` содержит `DOMAIN_CLIENT=http://localhost:3080`
- [ ] В Yandex приложении callback URL = `http://localhost:3080/oauth/yandex/callback`
- [ ] Используется `localhost`, а не `127.0.0.1`
- [ ] NODE_ENV не установлен (или установлен в `development`)
- [ ] Сервер перезагружен после изменений `.env`
- [ ] `cookieParser()` есть в `/api/server/index.js` на строке ~146
- [ ] `sameSite: 'lax'` в cookie параметрах (не `strict`)

---

## 📝 Что дальше?

После запуска с этими логами:

1. **Если логи показывают что cookie устанавливается и отправляется обратно:**
   - Проблема решена! State проверка должна работать.

2. **Если cookie НЕ отправляется обратно:**
   - Проверить домен (localhost vs 127.0.0.1)
   - Проверить что обе ссылки используют один и тот же порт
   - Убедиться что редирект идёт на тот же домен

3. **Если все логи нормальные но авторизация всё равно не работает:**
   - Возможно, ошибка в создании пользователя в BD
   - Возможно, ошибка в `setAuthTokens()`
   - Проверить логи после "State verified successfully"

---

## 🔗 Связанные файлы

- `/api/server/controllers/auth/yandex.js` - Основной OAuth handler
- `/api/server/routes/oauth.js` - Route definitions
- `/api/server/index.js` - Middleware setup
- `.env` - Configuration

## 📚 Документация

- `YANDEX_OAUTH_IMPLEMENTATION.md` - Описание реализации
- `ARCHITECTURAL_COMPARISON.md` - Сравнение с Astro подходом
