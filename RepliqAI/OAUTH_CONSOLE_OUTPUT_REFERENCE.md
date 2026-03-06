# 📺 Эталонный вывод консоли для Yandex OAuth

## 🎯 Что должно появиться в консоли сервера

Этот документ показывает **точно ожидаемый вывод** на каждом этапе Yandex OAuth flow.

---

## ✅ Этап 1: Нажали "Sign in with Yandex"

**Действие:** Пользователь нажимает кнопку → браузер переходит на `/oauth/yandex`

**Ожидаемый вывод на сервере:**

```
📊 AUTH_CHECKPOINT: OAUTH_REDIRECT
   - provider: yandex
   - state: a1b2c3d4e5f6...
   - redirectUri: http://localhost:3080/oauth/yandex/callback

🍪 SETTING STATE COOKIE:
   - name: oauth_state_yandex
   - value: a1b2c3d4e5f6...
   - httpOnly: true
   - secure: false
   - sameSite: lax
   - path: /
   - maxAge: 600000 (10 min)

✅ Yandex OAuth state saved to cookie

🔄 Redirecting to Yandex OAuth: https://oauth.yandex.ru/authorize?client_id=...
```

**Что проверить:**
- ✅ Все эти логи появились?
- ✅ State выглядит как 64-символьная hex-строка?
- ✅ redirectUri = `http://localhost:3080/oauth/yandex/callback`?

**Если логов нет:**
- Проверить что маршрут `/oauth/yandex` правильно зарегистрирован
- Проверить что YANDEX_CLIENT_ID установлен в .env

---

## ✅ Этап 2: Ввели пароль Yandex и авторизовались

**Действие:** Пользователь авторизуется на Yandex и даёт permission

**Что происходит:** Yandex редиректит браузер на `/oauth/yandex/callback?code=...&state=...`

**На этом этапе сервер НЕ должен печатать ничего** (только при попадании на callback маршрут)

---

## ✅ Этап 3: Браузер отправляет callback (с cookie!)

**Действие:** Браузер делает GET запрос на `/oauth/yandex/callback?code=XXX&state=YYY`

**Ожидаемый вывод на сервере (ШАГ 1 - Отладка cookies):**

```
🔍 DEBUG: CALLBACK HEADERS & COOKIES
   - req.headers.cookie: oauth_state_yandex=a1b2c3d4e5f6...; sessionid=xyz...
   - req.cookies keys: oauth_state_yandex, sessionid, [другие cookies]
   - req.cookies.oauth_state_yandex: a1b2c3d4e5f6...
```

**Если видите ✅ это:**
```
req.cookies.oauth_state_yandex: a1b2c3d4e5f6...
```

Значит cookie **УСПЕШНО** отправилась браузером!

---

## ✅ Этап 4: Проверка state (если cookie есть)

**Ожидаемый вывод (продолжение):**

```
📊 AUTH_CHECKPOINT: OAUTH_CALLBACK_START
   - provider: yandex
   - error: none
   - code: 1234567890abcdef...
   - state: a1b2c3d4e5f6...
   - savedState from cookie: a1b2c3d4e5f6...

✅ State verified successfully
```

**Что проверить:**
- ✅ `state` из URL = `savedState from cookie`?
- ✅ `error: none`?
- ✅ "State verified successfully" появился?

---

## ✅ Этап 5: Обмен code на token

**Ожидаемый вывод:**

```
✅ State verified successfully

📡 Exchanging code for tokens...

✅ Tokens received

👤 Fetching user info from Yandex...

✅ User info received
```

**Что проверить:**
- ✅ Оба запроса успешны?
- ✅ Нет ошибок "Failed to get tokens"?

---

## ✅ Этап 6: Создание/обновление пользователя

**Ожидаемый вывод:**

```
📊 AUTH_CHECKPOINT: USER_CREATED
   - provider: yandex
   - email: user@example.com
   - name: Иван Петров
   - yandexId: 12345678

✅ New user created: user@example.com (id: yandex_12345678)
```

или (если уже существовал):

```
✅ Existing user found: user@example.com
```

---

## ✅ Этап 7: Установка session/tokens

**Ожидаемый вывод:**

```
📊 AUTH_CHECKPOINT: SESSION_CREATED
   - provider: yandex
   - userId: yandex_12345678

🍪 Auth tokens set

✅ User logged in successfully via Yandex: user@example.com

🔄 Redirecting to http://localhost:3080/chat?auth=1&provider=yandex
```

**Что происходит:**
- ✅ Session/JWT токены установлены
- ✅ Браузер редиректится на `/chat`
- ✅ Пользователь вошёл в приложение

---

## ❌ Проблема: Cookie отсутствует на callback

**Вывод будет:**

```
🔍 DEBUG: CALLBACK HEADERS & COOKIES
   - req.headers.cookie: ❌ EMPTY
   - req.cookies keys: ❌ EMPTY
   - req.cookies.oauth_state_yandex: ❌ NOT FOUND

📊 AUTH_CHECKPOINT: OAUTH_CALLBACK_START
   - provider: yandex
   - error: none
   - code: 1234567890abcdef...
   - state: a1b2c3d4e5f6...
   - savedState from cookie: ❌ MISSING

❌ AUTH_FAILED - state mismatch

[Браузер редиректится на /sign-in?error=state_mismatch&provider=yandex]
```

**Возможные причины:**
1. ❌ Cookie не отправляется браузером (domain mismatch)
2. ❌ Cookie параметры неправильные (secure, sameSite)
3. ❌ Cookie истекла (> 10 минут прошло)
4. ❌ Две вкладки/браузера одновременно (разные cookies)

→ Смотреть `OAUTH_DEBUG_GUIDE.md` раздел "Диагностика"

---

## ❌ Проблема: State не совпадает

**Вывод:**

```
🔍 DEBUG: CALLBACK HEADERS & COOKIES
   - req.headers.cookie: oauth_state_yandex=OLD_VALUE_ABC...
   - req.cookies keys: oauth_state_yandex
   - req.cookies.oauth_state_yandex: OLD_VALUE_ABC...

📊 AUTH_CHECKPOINT: OAUTH_CALLBACK_START
   - state: NEW_VALUE_XYZ...
   - savedState from cookie: OLD_VALUE_ABC...

❌ AUTH_FAILED - state mismatch
```

**Причина:** State в cookie отличается от state в URL

**Возможные причины:**
1. ⏱️ Прошло более 10 минут (cookie истекла)
2. 🔄 Несколько редиректов (state перегенерировался)
3. 📱 Открыли в разных браузерах/девайсах (разные cookies)

**Решение:** Попробовать ещё раз (новый state генерируется при каждом клике на кнопку)

---

## ❌ Проблема: YANDEX_CLIENT_ID не установлен

**Вывод:**

```
❌ YANDEX_CLIENT_ID is not configured
```

**Решение:**
```bash
# Добавить в .env:
YANDEX_CLIENT_ID=your_client_id_here
YANDEX_CLIENT_SECRET=your_client_secret_here
```

---

## ❌ Проблема: Ошибка при обмене code на token

**Вывод:**

```
📡 Exchanging code for tokens...

❌ Failed to get tokens from Yandex: 401 ...
```

**Возможные причины:**
1. ❌ YANDEX_CLIENT_SECRET неправильный
2. ❌ Code уже использован
3. ❌ Code истёк (обычно 10 минут)
4. ❌ redirectUri не совпадает с Yandex приложением

---

## ❌ Проблема: Не получается получить user info

**Вывод:**

```
👤 Fetching user info from Yandex...

❌ Failed to get user info from Yandex: 401 ...
```

**Причина:** access_token невалидный или истёк

---

## 🔧 Как снять логи с сервера

### Способ 1: Если сервер запущен локально

```bash
# Просто смотреть в тот же терминал где запущен:
npm run dev
# или
npm start
```

Все логи появятся в этом терминале.

### Способ 2: Если используется Docker

```bash
# Узнать имя контейнера:
docker ps | grep librechat

# Смотреть логи:
docker logs <container_id> -f

# Или с фильтром:
docker logs <container_id> | grep "AUTH_CHECKPOINT"
```

### Способ 3: Если используется PM2

```bash
# Смотреть логи в реальном времени:
pm2 logs app

# Смотреть последние 100 строк:
pm2 logs app --lines 100

# С фильтром:
pm2 logs app | grep "DEBUG\|AUTH_CHECKPOINT"
```

---

## 📊 Полная таблица ожидаемых логов

| Этап | Лог | Что означает |
|------|-----|-------------|
| 1️⃣ Редирект | `OAUTH_REDIRECT` | User нажал кнопку |
| 1️⃣ Редирект | `SETTING STATE COOKIE` | Cookie установлена |
| 2️⃣ Авторизация | *(нет логов)* | Пользователь на Yandex |
| 3️⃣ Callback | `DEBUG: CALLBACK HEADERS` | Cookie проверяется |
| 4️⃣ Проверка state | `OAUTH_CALLBACK_START` | State из URL |
| 4️⃣ Проверка state | `State verified` ✅ | State совпадает |
| 5️⃣ Token exchange | `Exchanging code` | Идёт запрос на token |
| 5️⃣ Token exchange | `Tokens received` ✅ | Access token получен |
| 5️⃣ Token exchange | `Fetching user info` | Идёт запрос профиля |
| 5️⃣ Token exchange | `User info received` ✅ | Профиль получен |
| 6️⃣ User | `USER_CREATED` | User найден/создан |
| 7️⃣ Session | `SESSION_CREATED` ✅ | Session установлена |
| ✅ Успех | `logged in successfully` | **User в приложении!** |

---

## 🎯 Быстрая диагностика по логам

```
Вижу эти логи        → Значит статус
─────────────────────────────────────
OAUTH_REDIRECT       ✅ Редирект работает
SETTING STATE COOKIE ✅ Cookie установляется
(2️⃣ нет логов)       ✅ Авторизация на Yandex
DEBUG: CALLBACK      ✅ Callback достигнут
State verified       ✅ Cookie правильная
Tokens received      ✅ OAuth credentials OK
User info received   ✅ Yandex API OK
USER_CREATED         ✅ Database OK
SESSION_CREATED      ✅ Auth tokens OK
logged in            ✅ ВСЁ РАБОТАЕТ!

════════════════════════════════════════════

State verified       ❌ State не совпадает!
(code)               → Cookie отсутствует или старая

Exchanging code      ❌ Token exchange failed
                     → YANDEX_CLIENT_SECRET неправильный

Fetching user info   ❌ User info failed
                     → access_token невалиден

USER_CREATED         ❌ Failed to create/update user
                     → Database error
```

---

## 🔗 Дополнительно

Если логи не совпадают с этим документом → проверить `OAUTH_DEBUG_GUIDE.md`
