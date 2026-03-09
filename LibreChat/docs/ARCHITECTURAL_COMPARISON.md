# 🔄 АРХИТЕКТУРНОЕ СРАВНЕНИЕ: ASTRO vs LIBRECHAT

## КРАТКИЙ ОБЗОР

| Аспект | Astro ✅ | LibreChat ❌ |
|--------|---------|------------|
| **Фреймворк** | Astro SSR | Express.js |
| **OAuth реализация** | Собственная | Passport OAuth2Strategy |
| **State хранение** | httpOnly Cookie | req.session.passport.state |
| **State верификация** | ✅ Работает | ❌ Не работает (нет passport.session()) |
| **Результат** | ✅ БЕЗ зависаний | ❌ ЗАВИСАЕТ браузер |

---

## ДЕТАЛЬ #1: STATE MANAGEMENT

### Астро (ПРАВИЛЬНО) 🎯

```
1. ИНИЦИАЦИЯ (/api/auth/yandex)
   ├─→ state = crypto.randomBytes(32).toString('hex')
   ├─→ context.cookies.set('oauth_state_yandex', state, {httpOnly})
   └─→ redirect на https://oauth.yandex.ru/authorize?state=xxx

2. CALLBACK (/auth/yandex-callback)
   ├─→ savedState = context.cookies.get('oauth_state_yandex')
   ├─→ if (savedState !== state) return redirect('/sign-in?error=...')
   ├─→ context.cookies.delete('oauth_state_yandex')
   └─→ ✅ Продолжить обработку
```

**Ключ**: State хранится в **httpOnly cookie**, доступен браузером при callback.

### LibreChat (НЕПРАВИЛЬНО) ❌

```
1. ИНИЦИАЦИЯ (/oauth/yandex)
   ├─→ passport.authenticate('yandex', {state: true})
   ├─→ Passport ожидает сохранить state в req.session.passport.state
   └─→ redirect на https://oauth.yandex.ru/authorize?state=xxx

2. CALLBACK (/oauth/yandex/callback)
   ├─→ passport.authenticate('yandex', {...})
   ├─→ Passport ожидает найти req.session.passport.state
   ├─→ ❌ НО req.session.passport.state НЕ СУЩЕСТВУЕТ
   │   (passport.session() middleware не вызывается!)
   ├─→ Passport не может верифицировать state
   └─→ ❌ Браузер зависает или получает ошибку
```

**Проблема**: State ожидается в session, но session не управляется passport.session() middleware.

---

## ДЕТАЛЬ #2: MIDDLEWARE STACK

### Астро (НЕТУ MIDDLEWARE)

```
GET /api/auth/yandex
  └─→ /pages/api/auth/yandex.ts (обработчик маршрута)
      └─→ Независимая обработка

GET /auth/yandex-callback
  └─→ /pages/auth/yandex-callback.ts (обработчик маршрута)
      └─→ Независимая обработка
```

**Плюсы**:
- ✅ Просто и понятно
- ✅ Нет зависимостей между маршрутами
- ✅ Полный контроль над process flow

### LibreChat (EXPRESS MIDDLEWARE STACK)

```
app.use(session({...}))                    ✅ ЕСТЬ
app.use(passport.initialize())             ✅ ЕСТЬ
app.use(passport.session())                ❌ ОТСУТСТВУЕТ!
app.use('/oauth', routes.oauth)

  GET /oauth/yandex
    └─→ passport.authenticate('yandex', {...})
        └─→ Ожидает passport.session() middleware

  GET /oauth/yandex/callback
    └─→ passport.authenticate('yandex', {...})
        └─→ Ожидает найти state в req.session.passport.state
            (которой не существует, потому что passport.session() не вызывается)
```

**Проблема**: Недостаёт одной критической строки:
```javascript
app.use(passport.session());  // ← ДОЛЖНА БЫТЬ ПОСЛЕ passport.initialize()!
```

---

## ДЕТАЛЬ #3: STATE VERIFICATION

### Астро - Прямое сравнение

```typescript
// Сохранить
const state = crypto.randomBytes(32).toString('hex');
context.cookies.set('oauth_state_yandex', state, {httpOnly: true});

// Проверить
const savedState = context.cookies.get('oauth_state_yandex')?.value;
const receivedState = context.url.searchParams.get('state');

if (!savedState || savedState !== receivedState) {
  // ❌ Redirect на ошибку
  return context.redirect('/sign-in?error=state_mismatch');
}
// ✅ Продолжить
```

**Простота**: 3 строки проверки состояния.

### LibreChat - Passport управление

```javascript
// Сохранить (ожидается в passport.js)
// Passport должна сохранить в req.session.passport.state
// Но passport.session() middleware отсутствует!

// Проверить (в passport.js)
// Passport ожидает найти req.session.passport.state
// Но она не существует!
// Результат: Ошибка верификации или undefined behavior
```

**Сложность**: Зависит от Passport, но Passport не может работать без middleware.

---

## ДЕТАЛЬ #4: SESSION CREATION

### Астро - SQLite

```typescript
export function createSession(userId: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

  db.prepare(
    'INSERT INTO sessions (id, userId, token, expiresAt, createdAt) VALUES (?, ?, ?, ?, ?)'
  ).run(crypto.randomUUID(), userId, token, expiresAt, now);

  return token;
}
```

**Где хранится**: SQLite БД, таблица `sessions`.
**Как передаётся**: Токен в httpOnly cookie.

### LibreChat - express-session

```javascript
// express-session middleware управляет req.session
// Session может храниться в памяти, MongoDB, Redis и т.д.
// Но oauth state никогда не достигает session!
```

**Где хранится**: Зависит от конфигурации (memory, mongo, redis).
**Как передаётся**: Через session cookie.

---

## ПОЛНЫЙ СРАВНИТЕЛЬНЫЙ PIPELINE

### ASTRO: ✅ РАБОТАЮЩИЙ PIPELINE

```
Browser → /api/auth/yandex
  └─→ state = random()
  └─→ cookie[oauth_state] = state
  └─→ redirect → Yandex

Yandex → /auth/yandex-callback?code=...&state=...
  └─→ savedState = cookie[oauth_state] ✓ НАЙДЕНА!
  └─→ if (savedState === state) ✓ СОВПАДАЕТ!
  └─→ exchange code → tokens
  └─→ fetch profile
  └─→ upsertUser()
  └─→ sessionToken = createSession()
  └─→ cookie[session_token] = sessionToken
  └─→ redirect → /app ✅ УСПЕХ
```

### LIBRECHAT: ❌ ЗАВИСАЮЩИЙ PIPELINE

```
Browser → /oauth/yandex
  └─→ passport.authenticate('yandex')
  └─→ Passport ожидает сохранить state в session
  └─→ ❌ БЕЗ passport.session() middleware это не происходит!
  └─→ redirect → Yandex

Yandex → /oauth/yandex/callback?code=...&state=...
  └─→ passport.authenticate('yandex')
  └─→ Passport ожидает найти state в req.session.passport.state
  └─→ ❌ req.session.passport.state НЕ СУЩЕСТВУЕТ!
  └─→ Passport не может верифицировать state
  └─→ ❌ Обработка прерывается или вызывает undefined behavior
  └─→ Browser не получает final redirect
  └─→ ❌ БРАУЗЕР ЗАВИСАЕТ
```

---

## LESSON LEARNED: КОГДА ПРОСТОЕ ЛУЧШЕ

### Астро выбрал простоту:

1. ❌ Не использует Passport (уменьшает зависимости)
2. ✅ Реализует OAuth вручную (полный контроль)
3. ✅ Хранит state в cookies (просто и безопасно)
4. ✅ Прямая проверка state (нет магии middleware)

### LibreChat выбрал сложность:

1. ✅ Использует Passport (для переиспользуемости)
2. ❌ Неполная конфигурация (отсутствует passport.session())
3. ❌ Ожидает state в session (зависит от middleware)
4. ❌ Скрытая логика верификации (трудно отладить)

---

## ПРАКТИЧЕСКИЙ ВЫВОД

Если LibreChat использует Passport:
- **Нужно добавить**: `app.use(passport.session());` после `app.use(passport.initialize());`
- **Где**: `/api/server/index.js` строка 177

Если хотите переделать как Астро:
- **Нужно убрать**: Passport из OAuth flow
- **Нужно добавить**: Собственный OAuth handler с cookie-based state
- **Результат**: Работающий, простой и отладочный код

