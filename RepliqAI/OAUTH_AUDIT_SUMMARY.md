# 🔴 КРАТКИЙ ОТЧЕТ: КРИТИЧЕСКИЕ ПРОБЛЕМЫ OAUTH YANDEX

## НАЙДЕНА КРИТИЧЕСКАЯ ПРОБЛЕМА

### ❌ КРИТИКО: passport.session() НЕ ВЫЗЫВАЕТСЯ

**Файл**: `/api/server/index.js`

**Проблема (строка 177-178)**:
```javascript
// ✅ ЭТО ЕСТЬ:
app.use(passport.initialize());

// ❌ ЭТО ОТСУТСТВУЕТ:
app.use(passport.session());  // REQUIRED!
```

**Почему это проблема**:
1. Passport OAuth2Strategy требует `passport.session()` для сохранения state между запросами
2. State используется для CSRF защиты
3. Без этого, state НЕ сохраняется в `req.session.passport.state`
4. На callback Passport не может верифицировать state
5. Результат: **Браузер зависает после успешного логина на Yandex**

**Ожидаемый процесс**:
```javascript
app.use(session({...}));              // Line 164
app.use(passport.initialize());       // Line 177
app.use(passport.session());          // ❌ ОТСУТСТВУЕТ, ДОЛЖНА БЫТЬ ЗДЕСЬ!
await configureSocialLogins(app);     // Line 188
```

---

## 2️⃣ ВТОРАЯ ПРОБЛЕМА: ДВА CALLBACK МАРШРУТА

### Несоответствие между маршрутами:

**Маршрут 1** (`/api/server/routes/oauth.js:223-252`):
```javascript
router.get('/yandex/callback', ...)  // → /oauth/yandex/callback
```

**Маршрут 2** (`/api/server/index.js:205-215`):
```javascript
app.get('/auth/yandex-callback', ...)  // → /auth/yandex-callback
```

**Проблема**:
- Yandex OAuth может быть настроена на один маршрут
- Приложение может использовать другой
- YANDEX_URI переменная может переопределить callback URL
- Результат: **Mismatch между OAuth провайдером и приложением**

### Где код проверяет callback URL:

- `yandexStrategy.js:103`: `callbackURL = ${DOMAIN_SERVER}/oauth/yandex/callback`
- Если установлена `YANDEX_URI`, используется её вместо стандартного пути

---

## 3️⃣ SESSION CONFIGURATION ISSUES

### Session параметры (`index.js:164-173`):

| Параметр | Текущее значение | Проблема |
|----------|-----------------|----------|
| saveUninitialized | **true** | Создаёт session для каждого запроса |
| sameSite | ❌ НЕ УКАЗАН | Отсутствует для основной session |

---

## 📍 ГДЕ ТОЧНО ЛОМАЕТСЯ ЦЕПОЧКА

```
✅ GET /oauth/yandex
   → passport.authenticate('yandex') → redirect на https://oauth.yandex.ru/authorize

✅ Yandex login
   → redirect на /oauth/yandex/callback?code=...&state=...

✅ GET /oauth/yandex/callback
   → passport.authenticate('yandex')
     - Получает access_token ✅
     - Вызывает verify callback ✅
     - Создаёт пользователя в БД ✅

❌ ЗДЕСЬ ЗАВИСАЕТ:
   - passport.authenticate() пытается верифицировать state
   - НО req.session.passport.state НЕ СУЩЕСТВУЕТ (нет passport.session()!)
   - Passport может отклонить запрос или вызвать undefined behavior
   - oauthHandler никогда не вызывается ИЛИ вызывается с ошибкой

❌ РЕЗУЛЬТАТ: Браузер зависает, не получив redirect на ${DOMAIN_CLIENT}
```

---

## 🎯 ЧТО ПРОВЕРИТЬ

### 1. Проверить logs на наличие:
- "STEP 3 verify callback" - есть ли в консоли?
- "STEP 4 oauthHandler" - есть ли в консоли?
- Ошибки в passport на stage state верификации

### 2. Проверить session:
```javascript
// В oauth.js:235
console.log(`   - session state: ${req.session?.passport?.state ? req.session.passport.state.slice(0, 8) + '...' : 'none'}`);
```
- Если выводит "none", то state НЕ сохраняется

### 3. Проверить callback route:
- Какой callback URL зарегистрирован в Yandex OAuth?
- Совпадает ли с ${DOMAIN_SERVER}/oauth/yandex/callback?
- Или используется YANDEX_URI переменная?

---

## 📋 ФАЙЛЫ ДЛЯ ПРОВЕРКИ

1. **`/api/server/index.js`** (строка 162-189)
   - Session конфигурация
   - passport.initialize()
   - ❌ ОТСУТСТВУЕТ: passport.session()

2. **`/api/server/routes/oauth.js`** (строка 208-252)
   - /oauth/yandex маршрут
   - /oauth/yandex/callback маршрут
   - Debug логи

3. **`/api/strategies/yandexStrategy.js`** (строка 95-105)
   - Динамическая конфигурация callbackURL
   - YANDEX_URI переменная

4. **`/api/server/index.js`** (строка 205-215)
   - ❌ АЛЬТЕРНАТИВНЫЙ /auth/yandex-callback маршрут

---

## 📌 ИТОГ

**ГЛАВНАЯ ПРИЧИНА ЗАВИСАНИЯ**: Отсутствует `app.use(passport.session())` middleware

**РЕЗУЛЬТАТ**: State НЕ верифицируется, браузер зависает на этапе OAuth callback

**КОД ДЛЯ ДОБАВЛЕНИЯ**:
```javascript
// В /api/server/index.js после строки 177:
app.use(passport.initialize());
app.use(passport.session());  // ← ДОБАВИТЬ ЭТУ СТРОКУ
```

---

**ДОПОЛНИТЕЛЬНЫЙ ОТЧЕТ**: Смотри `OAUTH_YANDEX_AUDIT.md` для полного анализа (703 строки)
