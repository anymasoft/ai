# ✅ Проверка Middleware для OAuth Cookie

## 🎯 Задача

Убедиться что middleware в `/api/server/index.js` **правильно расположены** для работы cookies в OAuth flow.

---

## ✅ Текущее состояние (Правильное)

### Порядок middleware в `/api/server/index.js` (линии 125-189)

```javascript
// ШАГ 1: Body parsers
app.use(express.json({ limit: '3mb' }));                    // Линия 127
app.use(express.urlencoded({ extended: true, limit: '3mb' }));  // Линия 128
app.use(handleJsonParseError);                              // Линия 129

// ШАГ 2: Request property setup (Express 5 compatibility)
app.use((req, _res, next) => {                              // Линии 135-142
  Object.defineProperty(req, 'query', {
    ...Object.getOwnPropertyDescriptor(req, 'query'),
    value: req.query,
    writable: true,
  });
  next();
});

// ШАГ 3: Security
app.use(mongoSanitize());                                    // Линия 144
app.use(cors());                                            // Линия 145

// ШАГ 4: ✅ COOKIE PARSER - ЗДЕСЬ ПРАВИЛЬНО!
app.use(cookieParser());                                    // Линия 146

// ШАГ 5: Compression
if (!isEnabled(DISABLE_COMPRESSION)) {
  app.use(compression());                                   // Линии 148-151
}

// ШАГ 6: Static files
app.use(staticCache(...));                                  // Линии 154-156

// ШАГ 7: SESSION MIDDLEWARE - ПОСЛЕ cookieParser() ✅
app.use(session({                                           // Линии 163-174
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
}));

// ШАГ 8: PASSPORT - ПОСЛЕ session() ✅
app.use(passport.initialize());                             // Линия 177
// passport.session() НЕ используется (для Yandex OAuth)

// ШАГ 9: Social logins
if (isEnabled(ALLOW_SOCIAL_LOGIN)) {
  await configureSocialLogins(app);                         // Линия 188
}

// ШАГ 10: OAuth routes
app.use('/oauth', routes.oauth);                            // Линия 192
```

---

## 🔍 Критические проверки

### ✅ cookieParser размещен правильно?

```
ПРАВИЛЬНЫЙ ПОРЯДОК:
  1. Body parsers (json, urlencoded)
  2. Security (mongoSanitize, cors)
  3. ✅ cookieParser()  ← ЗДЕСЬ
  4. Session middleware
  5. Passport
  6. Routes

НЕПРАВИЛЬНЫЙ ПОРЯДОК (может привести к проблемам):
  ❌ Session ПЕРЕД cookieParser
  ❌ cookieParser после passport
  ❌ Отсутствует cookieParser вообще
```

**Текущее состояние: ✅ ПРАВИЛЬНОЕ**

### ✅ cookieParser импортирован?

```javascript
// Линия 11 в /api/server/index.js:
const cookieParser = require('cookie-parser');

// ✅ Да, импортирован!
```

### ✅ res.cookie() использует правильные параметры?

В `/api/server/controllers/auth/yandex.js` линии 48-54:

```javascript
res.cookie('oauth_state_yandex', state, {
  httpOnly: true,              // ✅ Правильно: JS не может прочитать
  secure: false,               // ✅ Правильно для localhost
  sameSite: 'lax',             // ✅ Правильно: CSRF protection + отправляется на callback
  path: '/',                   // ✅ Правильно: охватывает весь домен
  maxAge: 10 * 60 * 1000,     // ✅ Правильно: 10 минут
});
```

---

## 🧪 Тестовые сценарии

### Сценарий 1: Проверить что cookie парсируется

Временно добавить в `/api/server/controllers/auth/yandex.js`:

```javascript
const yandexOAuthCallback = async (req, res) => {
  try {
    // DEBUG: Проверить что cookieParser работает
    console.log('req.cookies тип:', typeof req.cookies);
    console.log('req.cookies constructor:', req.cookies.constructor.name);
    console.log('req.cookies пустой?', Object.keys(req.cookies).length === 0);

    // Если вы видите:
    // req.cookies тип: object
    // req.cookies constructor: Object
    // req.cookies пустой? false  (если есть cookies)
    // ТО cookieParser работает правильно
```

### Сценарий 2: Проверить Set-Cookie header при редиректе

Добавить в `/api/server/controllers/auth/yandex.js`:

```javascript
const yandexOAuthRedirect = async (req, res) => {
  try {
    // ... код ...
    res.cookie('oauth_state_yandex', state, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 10 * 60 * 1000,
    });

    // DEBUG: Проверить что Set-Cookie header отправляется
    const setsCookie = res.getHeader('set-cookie');
    console.log('Set-Cookie headers:', setsCookie);
    // Должно быть что-то вроде:
    // oauth_state_yandex=a1b2c3d4...; Path=/; HttpOnly; Max-Age=600000; SameSite=Lax
```

---

## 🐛 Что может пойти не так

| Проблема | Признак | Решение |
|----------|---------|---------|
| cookieParser не установлен | `req.cookies` undefined | `npm install cookie-parser` |
| cookieParser в неправильном месте | Cookies не парсируются | Переместить после body parsers, перед session |
| secure: true на localhost | Cookie не отправляется | Изменить на `secure: false` |
| sameSite: 'strict' | Cookie не отправляется на callback | Изменить на `sameSite: 'lax'` |
| path: '/oauth' (слишком узкий) | Cookie есть на /oauth/yandex, но нет на /oauth/yandex/callback | Изменить на `path: '/'` |
| Домен меняется (localhost vs 127.0.0.1) | Cookie не отправляется | Использовать один домен везде |

---

## 🛠️ Как проверить что всё настроено правильно

### 1️⃣ Проверить что middleware есть

```bash
grep -n "cookieParser" /home/user/ai/LibreChat/api/server/index.js
```

Ожидаемый вывод: `11: const cookieParser = require('cookie-parser');` и `146: app.use(cookieParser());`

### 2️⃣ Проверить что порядок правильный

```bash
grep -n "app.use" /home/user/ai/LibreChat/api/server/index.js | head -20
```

Должно быть:
```
126: app.use(noIndex);
127: app.use(express.json(...
128: app.use(express.urlencoded(...
...
145: app.use(cors());
146: app.use(cookieParser());  ← ДО session!
...
163: app.use(session({
```

### 3️⃣ Проверить cookie параметры в yandex.js

```bash
grep -A 6 "res.cookie('oauth_state_yandex'" /home/user/ai/LibreChat/api/server/controllers/auth/yandex.js
```

Ожидаемый вывод:
```javascript
res.cookie('oauth_state_yandex', state, {
  httpOnly: true,
  secure: false,              // ← для localhost
  sameSite: 'lax',            // ← лак, не стрикт
  path: '/',                  // ← весь домен
  maxAge: 10 * 60 * 1000,
});
```

---

## ✅ Финальный чек-лист

- [ ] cookieParser импортирован в index.js
- [ ] cookieParser() добавлен в middleware pipeline
- [ ] cookieParser() идёт ПЕРЕД session middleware
- [ ] cookie параметры используют `httpOnly: true`
- [ ] cookie параметры используют `sameSite: 'lax'` (не 'strict')
- [ ] cookie параметры используют `path: '/'`
- [ ] cookie параметры используют `secure: false` для localhost
- [ ] No errors in server logs when setting cookie
- [ ] req.cookies доступны в callback функции
- [ ] Cookie header видна в DevTools Network tab

---

## 🔗 Дополнительно

Если всё выше проверено и работает, но cookie всё равно отсутствует на callback:

→ Смотреть `OAUTH_DEBUG_GUIDE.md` раздел "Диагностика когда cookie отсутствует на callback"
