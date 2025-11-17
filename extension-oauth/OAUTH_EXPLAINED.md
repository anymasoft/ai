# 🔐 OAuth авторизация: как расширение видит юзера

## Архитектура авторизации

### 1. OAuth Flow (открывается во вкладке)

```
User → Click "Login" in popup
  ↓
background.js → chrome.tabs.create('http://localhost:5000/auth')
  ↓
Flask → Google OAuth → /auth/callback
  ↓
Flask → render oauth_callback.html с токеном
  ↓
oauth_callback.html → chrome.runtime.sendMessage({type: 'AUTH_SUCCESS', token})
  ↓
background.js → chrome.storage.local.set({auth_token: token})
  ↓
oauth_callback.html → redirect('/pricing')
```

### 2. Как расширение видит авторизованного юзера

После авторизации токен сохранён в `chrome.storage.local` под ключом `auth_token`.

**Popup расширения** (popup.js):
```javascript
// При открытии popup проверяем токен
const storage = await chrome.storage.local.get(['auth_token']);
const token = storage.auth_token;

if (token) {
  // Запрашиваем данные через background
  const planData = await chrome.runtime.sendMessage({ type: 'get-plan' });

  // planData = { email: "user@example.com", plan: "Premium" }
  console.log('User:', planData.email, 'Plan:', planData.plan);
}
```

**Background script** (background.js):
```javascript
// Когда popup запрашивает план
if (message.type === 'get-plan') {
  const { auth_token } = await chrome.storage.local.get(['auth_token']);

  // Запрос к Flask API
  const response = await fetch('http://localhost:5000/api/plan', {
    headers: { 'Authorization': `Bearer ${auth_token}` }
  });

  const data = await response.json();
  // data = { email: "...", plan: "Premium" }

  return data;
}
```

**Content script** (content.js на YouTube):
```javascript
// Если нужно проверить тариф на странице YouTube
const planData = await chrome.runtime.sendMessage({ type: 'get-plan' });

if (planData.plan === 'Free') {
  console.log('User is on Free plan');
  // Показать ограничения
} else if (planData.plan === 'Premium') {
  console.log('User is on Premium plan');
  // Разблокировать функции
}
```

## Состояния пользователя

### 1. НЕ авторизован
```javascript
chrome.storage.local.get(['auth_token'])
// → { auth_token: undefined }

chrome.runtime.sendMessage({ type: 'get-plan' })
// → { plan: 'Free' }
```

### 2. Авторизован (Free)
```javascript
chrome.storage.local.get(['auth_token'])
// → { auth_token: "abc123..." }

chrome.runtime.sendMessage({ type: 'get-plan' })
// → { email: "user@example.com", plan: "Free" }
```

### 3. Авторизован (Premium/Pro)
```javascript
chrome.storage.local.get(['auth_token'])
// → { auth_token: "abc123..." }

chrome.runtime.sendMessage({ type: 'get-plan' })
// → { email: "user@example.com", plan: "Premium" }
```

## Flask API endpoints

### GET `/api/plan`

**Request:**
```http
GET /api/plan HTTP/1.1
Authorization: Bearer abc123...
```

**Response (успех):**
```json
{
  "status": "ok",
  "email": "user@example.com",
  "plan": "Premium"
}
```

**Response (токен невалидный):**
```http
HTTP/1.1 401 Unauthorized
{
  "status": "unauthorized"
}
```

## Как проверить что авторизация работает

### 1. В popup расширения

Открой DevTools для popup:
1. Кликни на иконку расширения (popup откроется)
2. Правый клик → Inspect
3. В Console:

```javascript
// Проверить токен
chrome.storage.local.get('auth_token', (r) => console.log('Token:', r.auth_token))

// Проверить план
chrome.runtime.sendMessage({ type: 'get-plan' }, (r) => console.log('Plan:', r))
```

### 2. На странице YouTube

Открой DevTools на YouTube (F12):

```javascript
// Проверить план через content script
chrome.runtime.sendMessage({ type: 'get-plan' }, (response) => {
  console.log('Email:', response.email);
  console.log('Plan:', response.plan);
});
```

### 3. В background script

1. Открой `chrome://extensions/`
2. Найди расширение → "Service Worker" (inspect)
3. В Console:

```javascript
// Проверить токен
chrome.storage.local.get('auth_token', (r) => console.log('Token:', r.auth_token))

// Запросить план напрямую
fetch('http://localhost:5000/api/plan', {
  headers: {
    'Authorization': 'Bearer ' + (await chrome.storage.local.get('auth_token')).auth_token
  }
})
.then(r => r.json())
.then(console.log)
```

## Логи для отладки

### После успешной авторизации в background console:

```
[VideoReader Background] Service worker запущен
[VideoReader Background] Login request received
[VideoReader Background] OAuth tab opened: 123
[VideoReader Background] Получен токен от OAuth popup
[VideoReader Background] Токен сохранён в storage
[VideoReader Background] OAuth tab closed
[VideoReader Background] Get plan request received
[VideoReader Background] Plan fetched: {email: "user@...", plan: "Premium"}
```

### В popup console:

```
[VideoReader Popup] Popup loaded
[VideoReader Popup] Token updated, reloading user data
Plan: {email: "user@example.com", plan: "Premium"}
```

### В Flask логах:

```
[API /api/plan] Получен токен: abc123...
[API /api/plan] Токен валиден: user@example.com, Premium
127.0.0.1 - - [Date] "GET /api/plan HTTP/1.1" 200 -
```

## Logout

```javascript
// Очистить токен
chrome.storage.local.remove('auth_token')

// Проверить что очистилось
chrome.storage.local.get('auth_token', (r) => console.log('Token:', r.auth_token))
// → Token: undefined
```

После logout popup должен показать кнопку "Login with Google".

## Важные изменения

### Что изменилось:

**1. OAuth открывается во вкладке** (не popup)
- `chrome.tabs.create()` вместо `chrome.windows.create()`
- Вкладка закрывается автоматически после успешной авторизации
- Редирект на `/pricing` вместо закрытия окна

**2. oauth_callback.html**
- Отправляет токен в расширение через `chrome.runtime.sendMessage()`
- Редирект на `/pricing` после успешной отправки
- Работает как для расширения, так и для обычного браузера

**3. background.js**
- Отслеживает OAuth вкладку вместо popup окна
- Закрывает вкладку после получения токена
- Слушает `chrome.tabs.onRemoved` вместо `chrome.windows.onRemoved`

## Коммит

Изменения закоммичены в ветку: `claude/plasmo-video-reader-migration-016HUwbppDtgz5R6sAjqgGxn`

**Изменённые файлы:**
- `extension-oauth/background.js` - OAuth во вкладке
- `oauth_callback.html` - редирект вместо закрытия окна
