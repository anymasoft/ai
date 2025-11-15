# Video Reader AI - Структура проекта и OAuth

## 🎯 Готово к работе из коробки!

Все ключи, Client ID и Extension ID уже прописаны в репозитории.
**НЕ ТРЕБУЕТСЯ** ручная настройка!

---

## 🔑 Ключевая информация

### Extension ID (фиксированный):
```
nkoahkpnbdojfjgmjhdmcjkaejhaheae
```

### Google OAuth Client ID:
```
431567664470-tnur42uavtfv279g05e2vq58q9b45ecg.apps.googleusercontent.com
```

### Redirect URI (вычисляется автоматически):
```javascript
const REDIRECT_URI = `https://${chrome.runtime.id}.chromiumapp.org/`;
// = https://nkoahkpnbdojfjgmjhdmcjkaejhaheae.chromiumapp.org/
```

---

## 📁 Структура файлов

### OAuth файлы:

1. **manifest.json** - Конфигурация расширения
   - Публичный ключ для фиксированного Extension ID
   - OAuth2 Client ID и scopes
   - Permissions: storage, identity, tabs, alarms, system.display

2. **background.js** - Service Worker, OAuth логика
   - `loginWithGoogle()` - запуск OAuth через chrome.identity.launchWebAuthFlow
   - Извлечение id_token из redirect URL
   - Декодирование JWT и сохранение user данных
   - Открытие auth popup (480×640, центрированный)
   - Закрытие popup после успешной авторизации

3. **auth_popup.html** - UI страница авторизации
   - Минималистичный темный дизайн (Tailwind CSS)
   - Размер: 480×640
   - Кнопка "Продолжить с Google"
   - Логотип и описание сервиса

4. **auth_popup.js** - Логика UI popup
   - Отправка сообщения `{ type: 'login' }` в background.js
   - Обработка authSuccess/authError
   - Блокировка кнопки на время авторизации
   - Автоматическое закрытие при успехе

5. **popup.css** - Стили для auth popup
   - Анимации (fadeIn)
   - Hover эффекты
   - Адаптивный дизайн

---

## 🔄 Как работает OAuth Flow

```
1. Пользователь кликает на иконку расширения
   ↓
2. background.js создает popup окно (480×640, центрированное)
   chrome.windows.create({
     url: 'auth_popup.html',
     type: 'popup',
     width: 480,
     height: 640,
     left: (центр экрана),
     top: (центр экрана)
   })
   ↓
3. auth_popup.html отображается с кнопкой "Продолжить с Google"
   ↓
4. Пользователь кликает кнопку
   ↓
5. auth_popup.js отправляет сообщение:
   chrome.runtime.sendMessage({ type: 'login' })
   ↓
6. background.js получает сообщение и запускает OAuth:
   chrome.identity.launchWebAuthFlow({
     url: authUrl,
     interactive: true
   })
   ↓
7. Открывается встроенное Google OAuth окно
   ↓
8. Пользователь авторизуется в Google
   ↓
9. Google редиректит на:
   https://nkoahkpnbdojfjgmjhdmcjkaejhaheae.chromiumapp.org/#id_token=...
   ↓
10. background.js извлекает id_token из hash:
    const hash = new URL(redirectedUrl).hash.substring(1);
    const params = new URLSearchParams(hash);
    const idToken = params.get('id_token');
   ↓
11. background.js декодирует JWT:
    const payload = JSON.parse(atob(idToken.split('.')[1]));
    // payload содержит: email, name, picture, sub
   ↓
12. background.js сохраняет в chrome.storage.local:
    {
      idToken: '...',
      user: { email, name, picture, sub },
      authenticated: true,
      timestamp: Date.now()
    }
   ↓
13. background.js отправляет authSuccess в popup:
    chrome.tabs.sendMessage(authPopupId, {
      type: 'authSuccess',
      user: payload
    })
   ↓
14. auth_popup.js получает authSuccess и закрывает окно:
    window.close()
   ↓
15. Пользователь авторизован ✅
```

---

## 🚀 Как использовать

### Вариант 1: Из репозитория

```bash
# 1. Клонируй репозиторий
git clone <repo-url>

# 2. Перейди в папку extension
cd ai/extension

# 3. Открой Chrome
chrome://extensions/

# 4. Включи Developer mode

# 5. Нажми "Load unpacked"

# 6. Выбери папку extension/

# 7. Кликни на иконку расширения

# 8. Нажми "Продолжить с Google"

# 9. Готово! ✅
```

### Вариант 2: Из ZIP

```bash
# 1. Скачай ZIP репозитория

# 2. Распакуй архив

# 3. Открой Chrome → chrome://extensions/

# 4. Включи Developer mode

# 5. Нажми "Load unpacked"

# 6. Выбери папку ai/extension/

# 7. Кликни на иконку расширения

# 8. Нажми "Продолжить с Google"

# 9. Готово! ✅
```

---

## 📊 Данные в chrome.storage.local

После успешной авторизации сохраняются:

```javascript
{
  idToken: "eyJhbGciOiJSUzI1NiIsImtpZCI6Ij...",  // JWT токен
  user: {
    email: "user@gmail.com",
    name: "User Name",
    picture: "https://lh3.googleusercontent.com/...",
    sub: "1234567890"  // Google User ID
  },
  authenticated: true,
  timestamp: 1234567890000
}
```

### Как получить эти данные в content script:

```javascript
chrome.runtime.sendMessage({ action: 'getUserData' }, (response) => {
  if (response.authenticated) {
    console.log('Пользователь авторизован:', response.user);
    console.log('Email:', response.user.email);
    console.log('Имя:', response.user.name);
    console.log('ID Token:', response.idToken);
  }
});
```

---

## 🔧 Google Cloud Console настройка

### ✅ УЖЕ НАСТРОЕНО (не требует изменений):

1. **OAuth Client создан:**
   - Application type: Chrome Extension
   - Client ID: `431567664470-tnur42uavtfv279g05e2vq58q9b45ecg.apps.googleusercontent.com`
   - Item ID: `nkoahkpnbdojfjgmjhdmcjkaejhaheae`

2. **Scopes настроены:**
   - openid
   - email
   - profile

3. **Redirect URI:**
   - `https://nkoahkpnbdojfjgmjhdmcjkaejhaheae.chromiumapp.org/`

---

## 🎨 UI Дизайн

### Auth Popup (480×640):

- **Цветовая схема:**
  - Фон: `#111827` (gray-900)
  - Текст: `#FFFFFF`
  - Вторичный текст: `#9CA3AF` (gray-400)
  - Кнопка: `#FFFFFF` (белая с тенью)
  - Акцент: `#60A5FA` (blue-400)

- **Шрифт:**
  - System font stack: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto`

- **Анимации:**
  - Fade in при загрузке
  - Hover эффекты на кнопках
  - Scale на клик

---

## 🔐 Безопасность

- ✅ ID Token (JWT) хранится в `chrome.storage.local` (защищено Chrome)
- ✅ Токен НЕ отправляется на сторонние серверы
- ✅ OAuth через официальный Google API
- ✅ Chrome Identity API (встроенная безопасность)
- ✅ Публичный ключ в manifest.json (защита от подмены Extension ID)

---

## 📝 Версии

**Текущая версия: 4.0.0**

### Changelog:

#### v4.0.0 (Текущая)
- Полная переработка OAuth системы
- Новый фиксированный Extension ID: `nkoahkpnbdojfjgmjhdmcjkaejhaheae`
- Новый Google OAuth Client ID
- Минималистичный темный popup (480×640)
- Автоматическое центрирование popup
- Все ключи прописаны в репозитории
- Работает из коробки без ручной настройки

---

## 🐛 Troubleshooting

### Проблема: Extension ID изменился
**Решение:** Убедись что публичный ключ в `manifest.json` корректный

### Проблема: OAuth не работает
**Решение:**
1. Проверь Extension ID в `chrome://extensions/`
2. Должен быть: `nkoahkpnbdojfjgmjhdmcjkaejhaheae`
3. Перезагрузи расширение

### Проблема: Popup не центрируется
**Решение:** Убедись что permission `system.display` есть в `manifest.json`

---

## 📞 Контакты

- Репозиторий: [GitHub URL]
- Issues: [GitHub Issues URL]
- Email: [Support Email]

---

**© 2025 Video Reader AI. Все права защищены.**
