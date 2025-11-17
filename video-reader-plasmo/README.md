# VideoReader Plasmo Extension

YouTube Video Reader с OAuth авторизацией через Google и поддержкой тарифных планов.

## 🚀 Быстрый старт

### 1. Установка зависимостей

```bash
npm install --ignore-scripts
```

### 2. Сборка расширения

```bash
npm run build
```

Результат сборки будет в `build/chrome-mv3-prod/`

### 3. Загрузка в Chrome

1. Открой `chrome://extensions/`
2. Включи "Режим разработчика" (Developer mode)
3. Нажми "Загрузить распакованное расширение" (Load unpacked)
4. Выбери папку `build/chrome-mv3-prod/`

## 📁 Структура проекта

```
video-reader-plasmo/
├── src/
│   ├── popup.tsx           # React UI для popup (Login/Logout)
│   ├── popup.css           # Стили для popup
│   ├── background.ts       # Service Worker (OAuth flow, getPlan)
│   ├── contents/
│   │   ├── youtube.ts      # Content script для YouTube
│   │   └── youtube.css     # Стили для YouTube панели
│   └── utils/
│       └── flags.ts        # SVG флаги языков
├── assets/
│   └── *.png              # Иконки расширения
├── package.json
├── plasmo.config.cjs      # Конфигурация Plasmo
└── tsconfig.json
```

## 🔐 OAuth Авторизация

### Архитектура

1. **Popup UI** (`src/popup.tsx`)
   - Кнопка "Login with Google"
   - Отображение email и плана пользователя
   - Кнопка Logout

2. **Background Script** (`src/background.ts`)
   - Открытие OAuth popup через `chrome.windows.create()`
   - Получение токена из OAuth callback
   - Сохранение токена в `chrome.storage.local` под ключом `auth_token`
   - API для получения тарифа `getPlan()`

3. **Content Script** (`src/contents/youtube.ts`)
   - Вызов `getUserPlan()` для получения текущего тарифа
   - Интеграция с существующей функцией `fetchPlan()`

### OAuth Flow

```
1. User clicks "Login with Google" in popup
   ↓
2. Popup sends message { type: "login" } to background
   ↓
3. Background opens OAuth window: http://localhost:5000/auth
   ↓
4. Flask handles Google OAuth
   ↓
5. After success, Flask redirects to callback with token
   ↓
6. Callback page sends message { type: "AUTH_SUCCESS", token: "..." }
   ↓
7. Background saves token to chrome.storage.local
   ↓
8. Popup updates UI with user info
```

## 🛠️ Flask Backend

### OAuth Callback HTML

Файл `oauth_callback.html` должен быть размещён на Flask сервере.

Flask должен:

1. **Endpoint `/auth`** - начать Google OAuth
2. **Endpoint `/auth/callback`** - обработать callback от Google
3. После успешной авторизации вернуть HTML с токеном:

```python
@app.route('/auth/callback')
def auth_callback():
    # ... Google OAuth logic ...
    token = generate_token(user_email)

    return render_template('oauth_callback.html', token=token)
```

В шаблоне:

```html
<script>
window.__TOKEN__ = "{{ token }}";
</script>
<script src="/static/oauth_callback.js"></script>
```

### API Endpoints

**GET `/api/plan`**

Headers:
```
Authorization: Bearer <token>
```

Response:
```json
{
  "status": "ok",
  "plan": "Premium",
  "email": "user@example.com"
}
```

## 📝 Messaging API

### Background ← Popup/Content

**Login Request**
```javascript
chrome.runtime.sendMessage({ type: "login" })
```

**Get Plan Request**
```javascript
const planData = await chrome.runtime.sendMessage({ type: "get-plan" })
// Returns: { email: "...", plan: "Free" | "Premium" | "Pro" }
```

**Auth Success** (from OAuth callback)
```javascript
chrome.runtime.sendMessage({
  type: "AUTH_SUCCESS",
  token: "eyJhbGc..."
})
```

## 🔧 Development

### Dev режим с hot reload

```bash
npm run dev
```

### Production build

```bash
npm run build
```

### Package для распространения

```bash
npm run package
```

## ✅ Тестирование OAuth Flow

1. Запусти Flask backend на `http://localhost:5000`
2. Убедись что есть endpoints `/auth` и `/auth/callback`
3. Загрузи расширение в Chrome
4. Открой popup расширения
5. Нажми "Login with Google"
6. Должно открыться окно авторизации
7. После авторизации окно закроется
8. Popup покажет email и план пользователя

### Проверка токена в DevTools

```javascript
chrome.storage.local.get('auth_token', (result) => {
  console.log('Token:', result.auth_token);
});
```

### Проверка плана

```javascript
chrome.runtime.sendMessage({ type: 'get-plan' }, (response) => {
  console.log('Plan:', response);
});
```

## 🎯 Что НЕ менялось

Согласно ТЗ, НЕ изменялось:

- ✅ Ядро VideoReader (youtube.ts)
- ✅ UI YouTube панели
- ✅ Translate API
- ✅ Realtime highlighting system
- ✅ Subtitle extraction

Добавлено только:

- ✅ OAuth авторизация через popup
- ✅ Background messaging для getPlan()
- ✅ Интеграция getUserPlan() в content script

## 📦 Dependencies

- **Plasmo**: 0.90.3
- **React**: 18.2.0
- **TypeScript**: 5.3.3

## 🐛 Troubleshooting

### Ошибка "chrome.runtime.sendMessage is not defined"

Убедись что background script загружен. Проверь в `chrome://extensions/`

### Ошибка "Failed to fetch plan"

1. Проверь что Flask backend запущен на `http://localhost:5000`
2. Проверь CORS на сервере
3. Проверь что токен валидный

### OAuth окно не закрывается

Проверь что `oauth_callback.html` правильно отправляет сообщение:

```javascript
chrome.runtime.sendMessage({ type: 'AUTH_SUCCESS', token: '...' })
```

## 📄 License

MIT
