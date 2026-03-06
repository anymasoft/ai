# 🎯 АУДИТ OAUTH YANDEX В ASTRO - ЭТАЛОННАЯ РЕАЛИЗАЦИЯ

## ОБЩАЯ ИНФОРМАЦИЯ

**Проект**: Astro (SSR, Node.js адаптер)
**Реализация**: Собственный OAuth pipeline БЕЗ Passport
**Статус**: ✅ РАБОТАЕТ БЕЗ ЗАВИСАНИЙ
**БД**: SQLite (better-sqlite3)

---

## 1️⃣ НАЙДЕННЫЕ ФАЙЛЫ

```
/astro/src/pages/api/auth/yandex.ts       ← OAuth redirect (инициация)
/astro/src/pages/auth/yandex-callback.ts  ← OAuth callback (обработка)
/astro/src/pages/api/auth/google.ts       ← Google OAuth redirect
/astro/src/pages/auth/google-callback.ts  ← Google OAuth callback
/astro/src/lib/auth.ts                    ← Auth функции (upsertUser, createSession)
/astro/src/lib/db.ts                      ← SQLite БД инициализация
/astro/astro.config.mjs                   ← Конфигурация Astro
```

---

## 2️⃣ OAUTH МАРШРУТЫ

### Маршрут 1: Инициация OAuth redirect (`/api/auth/yandex`)

**Файл**: `/astro/src/pages/api/auth/yandex.ts`

**Код**:
```typescript
export const GET: APIRoute = async (context) => {
  const clientId = process.env.YANDEX_CLIENT_ID;
  const redirectUri = `${new URL(context.url.toString()).origin}/auth/yandex-callback`;

  if (!clientId) {
    return new Response('YANDEX_CLIENT_ID is not set', { status: 500 });
  }

  // Генерируем state для защиты от CSRF атак
  const state = crypto.randomBytes(32).toString('hex');

  console.log(`\n📊 AUTH_CHECKPOINT: OAUTH_REDIRECT`);
  console.log(`   - provider: yandex`);
  console.log(`   - state: ${state.slice(0, 8)}...`);
  console.log(`   - redirectUri: ${redirectUri}`);

  // Сохраняем state в cookies
  context.cookies.set('oauth_state_yandex', state, {
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 10, // 10 минут
  });

  console.log(`✅ Yandex OAuth state saved to cookie`);

  // Параметры для Yandex OAuth
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    state: state,
  });

  const yandexAuthUrl = `https://oauth.yandex.ru/authorize?${params.toString()}`;
  console.log(`🔄 Redirecting to Yandex OAuth: ${yandexAuthUrl.slice(0, 80)}...`);

  return context.redirect(yandexAuthUrl);
};
```

**Параметры**:
- **routePath**: `/api/auth/yandex`
- **method**: GET
- **state**: ✅ Генерируется как `crypto.randomBytes(32).toString('hex')`
- **state сохранение**: ✅ В httpOnly cookie `oauth_state_yandex` на 10 минут
- **redirectUri**: ✅ Динамически создаётся из origin (поддерживает разные domains)
- **response_type**: `code` (стандартный OAuth2 Authorization Code Flow)

### Маршрут 2: OAuth callback обработка (`/auth/yandex-callback`)

**Файл**: `/astro/src/pages/auth/yandex-callback.ts`

**Основные этапы**:

#### Шаг 1: Получить параметры из URL
```typescript
const code = context.url.searchParams.get('code');
const state = context.url.searchParams.get('state');
const error = context.url.searchParams.get('error');
```

#### Шаг 2: Проверить ошибки
```typescript
if (error) {
  console.error(`❌ AUTH_FAILED`);
  return context.redirect(`/sign-in?error=yandex_auth_failed&provider=yandex`);
}
```

#### Шаг 3: Проверить code и state
```typescript
if (!code || !state) {
  console.error(`❌ AUTH_FAILED`);
  return context.redirect('/sign-in?error=missing_params&provider=yandex');
}
```

#### Шаг 4: **КРИТИЧНО - VERIFY STATE**
```typescript
const savedState = context.cookies.get('oauth_state_yandex')?.value;
console.log(`   - savedState from cookie: ${savedState ? savedState.slice(0, 8) + '...' : 'MISSING'}`);

if (!savedState || savedState !== state) {
  console.error(`❌ AUTH_FAILED - state_mismatch`);
  return context.redirect('/sign-in?error=state_mismatch&provider=yandex');
}

// Очищаем state cookie
context.cookies.delete('oauth_state_yandex');
```

#### Шаг 5: Обменять код на токены
```typescript
const tokenResponse = await fetch('https://oauth.yandex.ru/token', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code: code,
    grant_type: 'authorization_code',
  }).toString(),
});

const tokens = await tokenResponse.json() as YandexTokenResponse;
```

#### Шаг 6: Получить профиль пользователя
```typescript
const userInfoResponse = await fetch('https://login.yandex.ru/info', {
  headers: {
    Authorization: `OAuth ${tokens.access_token}`,
    'Content-Type': 'application/json',
  },
});

const yandexUser = await userInfoResponse.json() as YandexUserInfo;
```

#### Шаг 7: Создать/обновить пользователя
```typescript
const userId = `yandex_${yandexUser.id}`;
const user = upsertUser(userId, userEmail, userName, undefined);
```

#### Шаг 8: Создать сессию
```typescript
const sessionToken = createSession(user.id);

// Сохраняем токен сессии в cookies
context.cookies.set('session_token', sessionToken, {
  httpOnly: true,
  secure: import.meta.env.PROD,
  sameSite: 'lax',
  path: '/',
  maxAge: 30 * 24 * 60 * 60, // 30 дней
});
```

#### Шаг 9: Редирект с успехом
```typescript
return context.redirect('/app?auth=1&provider=yandex');
```

---

## 3️⃣ АРХИТЕКТУРА БЕЗ PASSPORT

### ✅ ЧТО ИСПОЛЬЗУЕТСЯ:

1. **Встроенный Astro API Routes** (`/pages/api/`)
2. **Native Node.js fetch()** для HTTP запросов
3. **SQLite БД** (better-sqlite3) для хранения пользователей и сессий
4. **Cookies** для сохранения state и session token
5. **Нет Passport** - всё реализовано вручную

### ❌ ЧТО НЕ ИСПОЛЬЗУЕТСЯ:

- ❌ Passport
- ❌ passport.initialize()
- ❌ passport.session()
- ❌ express-session
- ❌ OAuth2Strategy

### Почему это работает:

**State верификация хранится в COOKIES, а не в SESSION!**

```
1. GET /api/auth/yandex
   └─→ Генерируем state = crypto.randomBytes(32).toString('hex')
   └─→ Сохраняем в httpOnly cookie: oauth_state_yandex = state
   └─→ Redirect на https://oauth.yandex.ru/authorize?state=xxx

2. Yandex OAuth server
   └─→ Пользователь вводит credentials
   └─→ Redirect на /auth/yandex-callback?code=...&state=...

3. GET /auth/yandex-callback?code=...&state=...
   └─→ Получаем savedState из cookie
   └─→ Проверяем: state === savedState ✓
   └─→ Удаляем cookie (больше не нужен)
   └─→ Обмениваем code на tokens
   └─→ Получаем профиль пользователя
   └─→ Создаём user в БД
   └─→ Создаём session в БД
   └─→ Сохраняем session_token в httpOnly cookie
   └─→ Redirect на /app
```

**КЛЮЧЕВОЕ ОТЛИЧИЕ ОТ LIBRECHAT:**
- LibreChat: State сохраняется в `req.session.passport.state` (требует passport.session())
- Astro: State сохраняется в httpOnly cookie (не требует никаких middleware)

---

## 4️⃣ SESSION КОНФИГУРАЦИЯ

### Cookies в Astro OAuth:

#### 1. State Cookie (temporary)
```typescript
context.cookies.set('oauth_state_yandex', state, {
  httpOnly: true,        // ✅ Недоступна из JS
  secure: import.meta.env.PROD,  // ✅ Только HTTPS в production
  sameSite: 'lax',       // ✅ Отправляется при редиректе от OAuth
  path: '/',
  maxAge: 60 * 10,       // 10 минут
});
```

#### 2. Session Token Cookie (persistent)
```typescript
context.cookies.set('session_token', sessionToken, {
  httpOnly: true,        // ✅ Недоступна из JS
  secure: import.meta.env.PROD,  // ✅ Только HTTPS в production
  sameSite: 'lax',       // ✅ Отправляется при обычных запросах
  path: '/',
  maxAge: 30 * 24 * 60 * 60,  // 30 дней
});
```

### Session хранение в БД:

**Таблица `sessions`**:
```sql
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expiresAt INTEGER NOT NULL,
  createdAt INTEGER NOT NULL,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
)
```

**Процесс**:
```typescript
export function createSession(userId: string): string {
  const db = getDb();
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 дней

  db.prepare(
    'INSERT INTO sessions (id, userId, token, expiresAt, createdAt) VALUES (?, ?, ?, ?, ?)'
  ).run(crypto.randomUUID(), userId, token, expiresAt, now);

  return token;
}
```

---

## 5️⃣ USER MANAGEMENT

### User table
```sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  image TEXT,
  plan TEXT NOT NULL DEFAULT 'free',
  role TEXT NOT NULL DEFAULT 'user',
  disabled INTEGER NOT NULL DEFAULT 0,
  generation_balance INTEGER NOT NULL DEFAULT 0,
  generation_used INTEGER NOT NULL DEFAULT 0,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
)
```

### Функция upsertUser

```typescript
export function upsertUser(
  googleId: string,      // Для Yandex: `yandex_${yandexUser.id}`
  email: string,
  name: string,
  image?: string
): User {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);

  // Проверяем, существует ли пользователь
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(googleId) as User | undefined;

  if (existing) {
    // Обновляем существующего
    db.prepare('UPDATE users SET name = ?, image = ?, updatedAt = ? WHERE id = ?').run(
      name,
      image,
      now,
      googleId
    );
    return db.prepare('SELECT * FROM users WHERE id = ?').get(googleId) as User;
  }

  // Создаём нового пользователя с 3 бонусными кредитами
  db.prepare(
    'INSERT INTO users (id, email, name, image, generation_balance, generation_used, plan, role, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(googleId, email, name, image, 3, 0, 'free', 'user', now, now);

  return db.prepare('SELECT * FROM users WHERE id = ?').get(googleId) as User;
}
```

---

## 6️⃣ MIDDLEWARE ПОРЯДОК

**Astro НЕ имеет традиционного Express middleware stack, так как использует файловую маршрутизацию.**

Вместо этого, каждый файл в `/pages` - это отдельный обработчик:

```
GET /api/auth/yandex
  ↓
/pages/api/auth/yandex.ts
  ├─→ Проверить YANDEX_CLIENT_ID
  ├─→ Генерировать state
  ├─→ Сохранить в cookie
  └─→ context.redirect(yandexAuthUrl)

GET /auth/yandex-callback
  ↓
/pages/auth/yandex-callback.ts
  ├─→ Получить code, state, error
  ├─→ Проверить error
  ├─→ Проверить code & state presence
  ├─→ Verify state from cookie
  ├─→ Обменять code на tokens
  ├─→ Получить профиль
  ├─→ upsertUser()
  ├─→ createSession()
  ├─→ Сохранить session_token в cookie
  └─→ context.redirect('/app')
```

**НЕТ Middleware!**
- ❌ cookieParser() - встроена в Astro
- ❌ session() - не используется
- ❌ passport.initialize()
- ❌ passport.session()

---

## 7️⃣ VERIFY STATE МЕХАНИЗМ

### ✅ ПРАВИЛЬНАЯ РЕАЛИЗАЦИЯ В ASTRO:

**Шаг 1 - Сохранить state**:
```typescript
// В /api/auth/yandex
const state = crypto.randomBytes(32).toString('hex');
context.cookies.set('oauth_state_yandex', state, {
  httpOnly: true,
  secure: import.meta.env.PROD,
  sameSite: 'lax',
  maxAge: 60 * 10,
});
```

**Шаг 2 - Проверить state**:
```typescript
// В /auth/yandex-callback
const savedState = context.cookies.get('oauth_state_yandex')?.value;
const receivedState = context.url.searchParams.get('state');

if (!savedState || savedState !== receivedState) {
  return context.redirect('/sign-in?error=state_mismatch');
}

// Очистить cookie
context.cookies.delete('oauth_state_yandex');
```

### ❌ ПРОБЛЕМНАЯ РЕАЛИЗАЦИЯ В LIBRECHAT:

**LibreChat ожидает, что:**
```javascript
// passport.session() middleware должна сохранять state в req.session.passport.state
// Но middleware отсутствует!
req.session.passport.state = state;  // ← БЕЗ passport.session() НЕ РАБОТАЕТ!
```

**Результат**:
- State НЕ сохраняется
- При callback `req.session.passport.state` не существует
- Passport не может верифицировать state
- Браузер зависает

---

## 8️⃣ ПОЛНЫЙ PIPELINE OAUTH

```
┌─────────────────────────────────────────────────────────────────┐
│ BROWSER                                                         │
│ (Клиент переходит на /api/auth/yandex)                         │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   ↓ GET /api/auth/yandex
┌─────────────────────────────────────────────────────────────────┐
│ ASTRO API ROUTE                                                 │
│ /pages/api/auth/yandex.ts                                       │
├─────────────────────────────────────────────────────────────────┤
│ 1. Генерировать state = crypto.randomBytes(32).toString('hex')  │
│ 2. Сохранить state в httpOnly cookie (10 минут)                │
│ 3. Создать URL: https://oauth.yandex.ru/authorize?state=xxx... │
│ 4. return context.redirect(yandexAuthUrl)                       │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   ↓ Redirect на Yandex
┌─────────────────────────────────────────────────────────────────┐
│ YANDEX OAUTH SERVER                                             │
│ https://oauth.yandex.ru/authorize                               │
├─────────────────────────────────────────────────────────────────┤
│ 1. Показать форму логина                                        │
│ 2. Пользователь вводит credentials                              │
│ 3. Yandex генерирует authorization code                         │
│ 4. Redirect на /auth/yandex-callback?code=xxx&state=xxx         │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   ↓ Callback с code и state
┌─────────────────────────────────────────────────────────────────┐
│ BROWSER                                                         │
│ GET /auth/yandex-callback?code=...&state=...                   │
│ Cookie: oauth_state_yandex=... (отправляется автоматически)    │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   ↓ GET /auth/yandex-callback
┌─────────────────────────────────────────────────────────────────┐
│ ASTRO API ROUTE                                                 │
│ /pages/auth/yandex-callback.ts                                  │
├─────────────────────────────────────────────────────────────────┤
│ ✅ ШАГИ ОБРАБОТКИ:                                              │
│                                                                 │
│ 1. Получить параметры:                                          │
│    - code = context.url.searchParams.get('code')                │
│    - state = context.url.searchParams.get('state')              │
│    - error = context.url.searchParams.get('error')              │
│                                                                 │
│ 2. Проверить ошибки:                                            │
│    if (error) return context.redirect('/sign-in?error=...')     │
│                                                                 │
│ 3. Проверить code & state:                                      │
│    if (!code || !state) return context.redirect(...)            │
│                                                                 │
│ 4. VERIFY STATE FROM COOKIE:  ✅ КРИТИЧНО!                      │
│    savedState = context.cookies.get('oauth_state_yandex')      │
│    if (!savedState || savedState !== state) return REDIRECT     │
│    context.cookies.delete('oauth_state_yandex')                 │
│                                                                 │
│ 5. Обменять code на tokens:                                     │
│    POST https://oauth.yandex.ru/token                           │
│    body: {                                                      │
│      client_id, client_secret, code, grant_type                 │
│    }                                                            │
│    → tokens = { access_token, ... }                             │
│                                                                 │
│ 6. Получить профиль пользователя:                               │
│    GET https://login.yandex.ru/info                             │
│    headers: { Authorization: `OAuth ${access_token}` }          │
│    → yandexUser = { id, login, email, ... }                     │
│                                                                 │
│ 7. Создать/обновить пользователя:                               │
│    userId = `yandex_${yandexUser.id}`                           │
│    user = upsertUser(userId, email, name)                       │
│    → Вставить/обновить в DB                                     │
│                                                                 │
│ 8. Создать сессию:                                              │
│    sessionToken = createSession(user.id)                        │
│    → INSERT INTO sessions (token, userId, expiresAt)            │
│                                                                 │
│ 9. Сохранить session_token в httpOnly cookie:                   │
│    context.cookies.set('session_token', sessionToken, {         │
│      httpOnly: true,                                            │
│      secure: true (production),                                 │
│      sameSite: 'lax',                                           │
│      maxAge: 30 * 24 * 60 * 60                                  │
│    })                                                           │
│                                                                 │
│ 10. Редирект с успехом:                                         │
│     return context.redirect('/app?auth=1&provider=yandex')      │
│                                                                 │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   ↓ GET /app?auth=1&provider=yandex
┌─────────────────────────────────────────────────────────────────┐
│ BROWSER                                                         │
│ Cookie: session_token=... (отправляется автоматически)         │
│ → Приложение загружается                                        │
│ → Фронтенд проверяет cookie и загружает пользовательское       │
│   окружение                                                     │
│ → ✅ УСПЕШНАЯ АВТОРИЗАЦИЯ                                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔍 СРАВНЕНИЕ: ASTRO VS LIBRECHAT

| Аспект | Astro | LibreChat |
|--------|-------|----------|
| **Фреймворк** | Astro SSR | Express.js |
| **OAuth реализация** | Собственная (no Passport) | Passport OAuth2Strategy |
| **State сохранение** | ✅ httpOnly cookie | ❌ req.session.passport.state (требует passport.session()) |
| **State верификация** | ✅ Прямое сравнение из cookie | ❌ Passport не может верифицировать (нет passport.session()) |
| **Session хранение** | SQLite БД | express-session (памяти/mongo) |
| **Session middleware** | ❌ Нет (встроена в Astro) | ✅ Есть (но passport.session() отсутствует) |
| **Middleware stack** | ❌ Нет Express middleware | ✅ Есть (но неправильно настроена) |
| **Cookies** | httpOnly, sameSite, secure | httpOnly, secure (но sameSite отсутствует) |
| **Database** | SQLite (better-sqlite3) | MongoDB |
| **API routes** | /pages/api - встроены | /api - Express routes |
| **Результат** | ✅ Работает без зависаний | ❌ Браузер зависает на callback |

---

## ✅ ЧТО РАБОТАЕТ В ASTRO:

1. ✅ State генерируется как криптографически стойкий случайный код
2. ✅ State сохраняется в httpOnly cookie
3. ✅ State доступен при callback (браузер отправляет cookies автоматически)
4. ✅ State верифицируется перед обменом code на tokens
5. ✅ State cookie удаляется после верификации
6. ✅ Session создаётся в БД с токеном
7. ✅ Session token сохраняется в httpOnly cookie
8. ✅ User создаётся/обновляется в БД
9. ✅ Все ошибки обрабатываются с редиректом
10. ✅ Финальный redirect на /app с параметрами

---

## ❌ ЧТО НЕ РАБОТАЕТ В LIBRECHAT:

1. ❌ passport.session() middleware отсутствует
2. ❌ State НЕ сохраняется в req.session.passport.state
3. ❌ При callback state НЕ доступен для верификации
4. ❌ Passport не может верифицировать state
5. ❌ oauthHandler может не вызваться ИЛИ вызваться с ошибкой
6. ❌ Браузер не получает final redirect
7. ❌ Браузер зависает

---

## 📌 КЛЮЧЕВОЙ ВЫВОД

**Астро решает проблему ИСКЛЮЧИВ Passport и реализовав OAuth вручную.**

Вместо того, чтобы полагаться на Passport для управления state:
- **Astro**: Сохраняет state в httpOnly cookie, проверяет его напрямую
- **LibreChat**: Ожидает, что Passport сохранит state в session, но middleware отсутствует

**Это не просто bugfix, это кардинально другая архитектура.**

