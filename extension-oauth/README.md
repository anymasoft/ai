# VideoReader Extension с OAuth авторизацией

Chrome расширение для просмотра и перевода YouTube субтитров с Google OAuth авторизацией.

## 📁 Структура

```
extension-oauth/
├── background.js      # Service Worker с OAuth логикой
├── content.js         # Content script для YouTube (БЕЗ изменений)
├── manifest.json      # Manifest V3 (добавлен только popup)
├── styles.css         # Стили YouTube панели (БЕЗ изменений)
├── flags.js           # SVG флаги языков (БЕЗ изменений)
├── popup.html         # НОВЫЙ: Popup для OAuth
├── popup.js           # НОВЫЙ: JS для popup
├── assets/
│   └── logo.png
└── README.md
```

## ✅ Что добавлено

### Новые файлы:
- **popup.html** - простой HTML popup (vanilla JS, БЕЗ React, БЕЗ сборки)
- **popup.js** - логика авторизации

### Изменённые файлы:

**manifest.json:**
- Добавлен `"default_popup": "popup.html"`
- Добавлен permission `"tabs"`
- Добавлен host permission `"http://localhost:5000/*"`

**background.js:**
- Добавлена функция `openOAuthPopup()` - открывает `http://localhost:5000/auth`
- Добавлена функция `getPlan()` - запрашивает план с backend
- Добавлены message handlers:
  - `{type: "login"}` - открыть OAuth окно
  - `{type: "get-plan"}` - получить тариф
  - `{type: "AUTH_SUCCESS", token: "..."}` - сохранить токен

### НЕ изменено:
- ✅ content.js (YouTube UI и функционал)
- ✅ styles.css
- ✅ flags.js

## 🚀 Установка

### 1. Загрузить расширение в Chrome

```bash
# Открой Chrome
chrome://extensions/

# Включи "Режим разработчика"
# Нажми "Загрузить распакованное расширение"
# Выбери папку: extension-oauth/
```

### 2. Настроить Flask Backend

Скопируй `oauth_callback.html` в Flask templates:

```bash
cp ../oauth_callback.html /path/to/flask/templates/
```

Реализуй endpoints:

**GET `/auth`** - начать Google OAuth

**GET `/auth/callback`** - обработать callback

```python
@app.route('/auth/callback')
def auth_callback():
    # Google OAuth logic
    token = generate_jwt_token(user_email, plan)

    # Рендер callback с токеном
    return render_template('oauth_callback.html', token=token)
```

**GET `/api/plan`** - вернуть тариф

```python
@app.route('/api/plan')
def get_plan():
    token = request.headers.get('Authorization').replace('Bearer ', '')
    # Verify token
    return jsonify({
        "email": "user@example.com",
        "plan": "Premium"  # Free | Premium | Pro
    })
```

## 🧪 Тестирование OAuth Flow

### 1. Открыть popup расширения

Кликни на иконку расширения → откроется popup

### 2. Кликнуть "Login with Google"

Откроется OAuth окно `http://localhost:5000/auth`

### 3. Авторизоваться через Google

Flask обработает callback и вернёт `oauth_callback.html` с токеном

### 4. Проверить что токен сохранён

Открой DevTools расширения:

```javascript
chrome.storage.local.get('auth_token', (r) => {
  console.log('Token:', r.auth_token);
});
```

### 5. Проверить что план получен

```javascript
chrome.runtime.sendMessage({ type: 'get-plan' }, (response) => {
  console.log('Plan:', response);
});
```

### 6. Открыть YouTube видео

Справа от видео должна появиться панель VideoReader (как раньше)

## 📝 Messaging API

### Background ← Popup

**Login:**
```javascript
chrome.runtime.sendMessage({ type: "login" })
```

**Get Plan:**
```javascript
chrome.runtime.sendMessage({ type: "get-plan" }, (response) => {
  // response: { email: "...", plan: "Free" | "Premium" | "Pro" }
})
```

**Auth Success** (from OAuth callback):
```javascript
chrome.runtime.sendMessage({
  type: "AUTH_SUCCESS",
  token: "eyJhbGc..."
})
```

## 🔐 OAuth Callback HTML

Файл `oauth_callback.html` должен быть на Flask сервере.

Flask рендерит шаблон с токеном:

```html
<script>
window.__TOKEN__ = "{{ token }}";
chrome.runtime.sendMessage({ type: 'AUTH_SUCCESS', token: "{{ token }}" });
window.close();
</script>
```

## 🐛 Troubleshooting

### Расширение не загружается

Проверь что все файлы на месте:
```bash
ls extension-oauth/
# Должны быть: background.js, content.js, manifest.json, styles.css, flags.js, popup.html, popup.js
```

### OAuth окно не открывается

1. Проверь что Flask backend запущен на `http://localhost:5000`
2. Проверь permissions в manifest.json
3. Проверь console background script

### Popup показывает "Loading..." бесконечно

1. Открой DevTools popup → Console
2. Проверь ошибки
3. Проверь что background script работает

### YouTube панель не работает

Расширение НЕ должно ломать YouTube панель! Если панель не работает:

1. Открой DevTools → Console
2. Проверь ошибки в content.js
3. Убедись что content.js НЕ был изменён

## ✨ Что НЕ изменено

Согласно требованиям, **НЕ изменено**:

- ✅ content.js - весь функционал YouTube панели
- ✅ styles.css - все стили
- ✅ flags.js - SVG флаги

**Добавлено только:**
- Popup для OAuth (popup.html + popup.js)
- OAuth handlers в background.js
- Минимальные изменения в manifest.json

Расширение должно работать **точно так же** как раньше на YouTube!

## 📦 Файлы

- `background.js` - 113 строк (+79 строк для OAuth)
- `content.js` - БЕЗ изменений
- `manifest.json` - 3 изменения (+popup, +tabs, +localhost)
- `popup.html` - 139 строк (НОВЫЙ)
- `popup.js` - 61 строка (НОВЫЙ)
- `styles.css` - БЕЗ изменений
- `flags.js` - БЕЗ изменений

---

**НИКАКОГО Plasmo, никакого React, никакой сборки!**

Просто vanilla HTML/CSS/JS + твоё оригинальное расширение.
