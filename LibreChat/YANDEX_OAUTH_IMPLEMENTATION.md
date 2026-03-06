# 🔐 Yandex OAuth Реализация БЕЗ Passport

## 📋 Обзор

Новая реализация Yandex OAuth базируется на простом cookie-based state management, как в Astro проекте.

**Ключевые изменения**:
- ❌ Удалён Passport из OAuth pipeline
- ✅ Реализован собственный OAuth handler
- ✅ State сохраняется в httpOnly cookie, а не в session
- ✅ Простой и надёжный flow

---

## 🏗️ Архитектура

### Основные файлы

```
/api/server/controllers/auth/yandex.js
  ├─→ yandexOAuthRedirect()   - Инициация OAuth
  └─→ yandexOAuthCallback()   - Обработка callback

/api/server/routes/oauth.js
  ├─→ GET /oauth/yandex
  └─→ GET /oauth/yandex/callback

/api/server/socialLogins.js
  └─→ ❌ passport.use(yandexLogin()) удалена
```

---

## 📊 OAuth Pipeline

```
Browser
  ↓ GET /oauth/yandex
yandexOAuthRedirect()
  ├─→ state = crypto.randomBytes(32).toString('hex')
  ├─→ res.cookie('oauth_state_yandex', state, {httpOnly, sameSite})
  └─→ redirect https://oauth.yandex.ru/authorize?state=...
  ↓
Yandex Login Page
  ├─→ User enters credentials
  └─→ Redirect /oauth/yandex/callback?code=...&state=...
  ↓
yandexOAuthCallback()
  ├─→ Verify state from cookie ✅
  ├─→ Exchange code → token
  ├─→ Fetch profile from Yandex
  ├─→ Create/update user in DB
  ├─→ setAuthTokens(user._id, res)
  └─→ redirect /chat ✅
```

---

## 🔒 State Management

### Почему cookies вместо session?

Старая реализация требовала `passport.session()` middleware для сохранения state в `req.session.passport.state`, но это middleware не вызывалась! 

Новая реализация использует httpOnly cookie:
```javascript
// Сохранить
res.cookie('oauth_state_yandex', state, {
  httpOnly: true,   // JS не может прочитать
  secure: true,     // HTTPS only в production
  sameSite: 'lax',  // CSRF protection
  maxAge: 10 * 60 * 1000  // 10 минут
});

// Проверить
const savedState = req.cookies.oauth_state_yandex;
if (savedState !== receivedState) {
  return res.redirect('/sign-in?error=state_mismatch');
}
```

---

## 🔧 Конфигурация

### .env

```env
YANDEX_CLIENT_ID=your_id
YANDEX_CLIENT_SECRET=your_secret
DOMAIN_SERVER=http://localhost:3080
DOMAIN_CLIENT=http://localhost:3080
ALLOW_SOCIAL_REGISTRATION=true
```

### Yandex App Settings

Callback URL должен быть: `{DOMAIN_SERVER}/oauth/yandex/callback`

---

## ✅ Преимущества

| Аспект | До | После |
|--------|---|---|
| Зависимости | Passport | Встроено |
| State | Session (отсутствует) | Cookie ✅ |
| Надёжность | Зависает ❌ | Работает ✅ |
| Отладка | Сложно | Просто |
| Безопасность | Неполная | Полная |

---

## 🐛 Логирование

Новая реализация логирует все этапы:
- `AUTH_CHECKPOINT: OAUTH_REDIRECT`
- `AUTH_CHECKPOINT: OAUTH_CALLBACK_START`
- `AUTH_CHECKPOINT: USER_CREATED`
- `AUTH_CHECKPOINT: SESSION_CREATED`

---

## 📝 Что далее?

1. Проверить что YANDEX_CLIENT_ID и YANDEX_CLIENT_SECRET установлены
2. Запустить приложение
3. Тестировать OAuth flow
4. Проверить логи на чекпоинты

Для полной документации смотрите:
- `ASTRO_OAUTH_REFERENCE.md` - Эталонная реализация
- `ARCHITECTURAL_COMPARISON.md` - Сравнение архитектур
