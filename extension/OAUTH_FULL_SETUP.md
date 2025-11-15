# Video Reader AI - OAuth Полная Настройка

## 🔑 ВСЕ КЛЮЧИ И НАСТРОЙКИ (готово к работе)

Все необходимые ключи и ID уже находятся в репозитории.
**НЕ ТРЕБУЕТСЯ** ничего настраивать вручную!

---

## 🆔 Extension ID (фиксированный)

```
nkbcpdlfjbkodkhlpppgcdpelegacfhh
```

Этот ID **ВСЕГДА постоянный** благодаря публичному ключу в `manifest.json`.

---

## 🔐 Ключи расширения

### Приватный ключ (extension-key.pem)
```
extension/extension-key.pem
```
⚠️ **ВАЖНО**: Приватный ключ находится в репозитории для полной автономности проекта.
В production рекомендуется удалить из репозитория после публикации в Chrome Web Store.

### Публичный ключ (в manifest.json)
```
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA5Fu8OYSfX6NgH8MSaa+TXWRwZpZaYNhKSccIGa6eKAevipGIiphWvZ1AhxZt3SRneRXgFGh0NVlvZCtXXNwEkpo9B54HuVjm7IXpyhSMO3+A4NuBo1UXzD1OPN2+BnM/NXyLuREE5WNFZgALlsbeC6ROZWDpqr0xqIgHmZICeA5ZJRq1py+ugwp4Fk2lHmfI3TtGwxqoNafjBV7SlJGFlD/gnWhN++gaa56qvBzeXHMdBx4+R6xlHQ9JMg1QmlCo0fQfVlQvOjvgVHIs3D54RCblCj/U2zcHIeI2O3aZi9/soXsTdCLVcxg5oU6S7N7SUNZ25fhBw3YuycDpLrrKfQIDAQAB
```

---

## 🌐 Google OAuth настройки

### Client ID
```
431567664470-tnur42uavtfv279g05e2vq58q9b45ecg.apps.googleusercontent.com
```

Прописан в:
- `extension/manifest.json` (строка 55)
- `extension/background.js` (строка 4)

### Redirect URI (вычисляется автоматически)
```
https://nkbcpdlfjbkodkhlpppgcdpelegacfhh.chromiumapp.org/
```

### Scopes
```
openid
email
profile
```

---

## 📋 Настройка Google Cloud Console

### 1. Создай OAuth Client ID

Перейди: https://console.cloud.google.com/apis/credentials

1. **Нажми**: "+ CREATE CREDENTIALS" → "OAuth client ID"

2. **Заполни**:
   - Application type: **Chrome Extension**
   - Name: `Video Reader AI`
   - Item ID: `nkbcpdlfjbkodkhlpppgcdpelegacfhh`

3. **Нажми**: "Create"

4. **Скопируй Client ID** (должен быть: `431567664470-tnur42uavtfv279g05e2vq58q9b45ecg.apps.googleusercontent.com`)

### 2. Настрой OAuth Consent Screen

1. **App name**: Video Reader AI
2. **User support email**: твой email
3. **Scopes**: `openid`, `email`, `profile`
4. **Test users**: добавь свой email для тестирования

---

## 🚀 Быстрый старт

### Вариант 1: Из репозитория

```bash
# 1. Клонируй репозиторий
git clone <repo-url>
cd ai/extension

# 2. Открой Chrome
chrome://extensions/

# 3. Включи Developer mode

# 4. Load unpacked → выбери папку extension/

# 5. Проверь Extension ID
# Должен быть: nkbcpdlfjbkodkhlpppgcdpelegacfhh

# 6. Кликни на иконку расширения

# 7. Нажми "Продолжить с Google"

# 8. ✅ Готово!
```

### Вариант 2: Из ZIP

```bash
# 1. Скачай ZIP репозитория

# 2. Распакуй

# 3. chrome://extensions/

# 4. Developer mode → ON

# 5. Load unpacked → выбери extension/

# 6. Extension ID = nkbcpdlfjbkodkhlpppgcdpelegacfhh ✅

# 7. Кликни на иконку → "Продолжить с Google"

# 8. ✅ Работает!
```

---

## 📁 Структура файлов

```
extension/
├── manifest.json                    (v4.0.0, публичный ключ внутри)
├── background.js                    (OAuth логика, Client ID внутри)
├── auth_popup.html                  (UI popup 480×640)
├── auth_popup.js                    (UI логика)
├── popup.css                        (Стили)
├── extension-key.pem               (⚠️ ПРИВАТНЫЙ КЛЮЧ)
├── PROJECT_STRUCTURE.md            (Документация)
└── OAUTH_FULL_SETUP.md            (Этот файл)
```

---

## 🔄 OAuth Flow

```
1. Пользователь кликает иконку расширения
   ↓
2. background.js открывает auth_popup.html (480×640)
   ↓
3. Пользователь нажимает "Продолжить с Google"
   ↓
4. auth_popup.js → chrome.runtime.sendMessage({ type: 'login' })
   ↓
5. background.js → chrome.identity.launchWebAuthFlow({
     url: "https://accounts.google.com/o/oauth2/auth?
           client_id=431567664470-tnur42uavtfv279g05e2vq58q9b45ecg...
           &response_type=id_token
           &redirect_uri=https://nkbcpdlfjbkodkhlpppgcdpelegacfhh.chromiumapp.org/
           &scope=openid email profile"
   })
   ↓
6. Google OAuth → Пользователь авторизуется
   ↓
7. Google → Redirect:
   https://nkbcpdlfjbkodkhlpppgcdpelegacfhh.chromiumapp.org/#id_token=...
   ↓
8. background.js → Извлекает id_token из hash
   ↓
9. background.js → Декодирует JWT:
   {
     email: "user@gmail.com",
     name: "User Name",
     picture: "https://...",
     sub: "123456789"
   }
   ↓
10. background.js → Сохраняет в chrome.storage.local
   ↓
11. background.js → Закрывает popup
   ↓
12. ✅ Пользователь авторизован!
```

---

## 📊 Данные в Storage

После авторизации в `chrome.storage.local`:

```javascript
{
  idToken: "eyJhbGciOiJSUzI1NiIs...",
  user: {
    email: "user@gmail.com",
    name: "User Name",
    picture: "https://lh3.googleusercontent.com/...",
    sub: "1234567890"
  },
  authenticated: true,
  timestamp: 1234567890000
}
```

---

## 🔍 Проверка работы

### 1. Extension ID
```bash
chrome://extensions/
→ найди "Video Reader AI"
→ ID должен быть: nkbcpdlfjbkodkhlpppgcdpelegacfhh
```

### 2. Background Service Worker
```bash
chrome://extensions/
→ найди "Video Reader AI"
→ нажми "service worker"
→ Консоль должна показать:
   "Video Reader AI background service worker запущен"
   "Extension ID: nkbcpdlfjbkodkhlpppgcdpelegacfhh"
   "Client ID: 431567664470-tnur42uavtfv279g05e2vq58q9b45ecg.apps.googleusercontent.com"
```

### 3. Auth Popup
```bash
Кликни на иконку расширения
→ Должно открыться popup окно 480×640
→ С кнопкой "Продолжить с Google"
```

### 4. OAuth Flow
```bash
Нажми "Продолжить с Google"
→ Должно открыться Google OAuth окно
→ Авторизуйся
→ Popup должен закрыться
→ В консоли background: "✅ Данные сохранены в storage"
```

---

## ⚠️ ВАЖНО: Безопасность

### ⚠️ Приватный ключ в репозитории

Файл `extension-key.pem` содержит **приватный ключ** расширения.

**Для разработки:**
- ✅ Можно хранить в репозитории для удобства
- ✅ Обеспечивает фиксированный Extension ID

**Для production:**
- ❌ НЕ рекомендуется хранить в публичном репозитории
- ❌ Удали из репозитория перед публикацией в Chrome Web Store
- ✅ Chrome Web Store сам создаст постоянный ID при публикации

### Рекомендации:

1. **Для development**: Оставь ключ в репозитории
2. **Для production**: Удали ключ и поле `"key"` из `manifest.json` перед публикацией
3. **Для private репозитория**: Можно оставить ключ

---

## 🎯 Итог

**✅ ВСЕ готово к работе:**
- Extension ID фиксированный
- Client ID прописан
- Redirect URI вычисляется автоматически
- Публичный ключ в manifest.json
- Приватный ключ в репозитории
- OAuth работает из коробки

**🚀 Просто загрузи расширение и тестируй!**

---

## 📞 Поддержка

Если что-то не работает:
1. Проверь Extension ID в `chrome://extensions/`
2. Проверь консоль background service worker
3. Проверь OAuth Client ID в Google Cloud Console
4. Убедись что Item ID = `nkbcpdlfjbkodkhlpppgcdpelegacfhh`

---

**© 2025 Video Reader AI**
