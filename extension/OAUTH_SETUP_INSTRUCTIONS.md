# Инструкция по настройке Google OAuth для Chrome Extension

## Шаг 1: Добавить ключ в manifest.json ✅

Добавь эту строку в `extension/manifest.json` (в корень объекта):

```json
"key": "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEArktSA/kZQ+qOdvHULb9PYAiAT7tkfGkfBj0e5gpi7ZiUAWr8UtgyrQTRzd8PlCvnBa8a/HDnECCJfImha7cJeobBaF7aa2Wd1Nr/tyYuPqbCZ5U5qFrMtqdcten/jIV7Mvq9ZeFSzhq14PYhiPVSsbtilP+RKkXP5ZA1GhVaeFRISHfVg4PSjj/ZgHzJosY6YNctj2uyDevEr5mYPhsDVVfroe3fyMf049nYdJofF+6CvlHscbYSUMZvE6w7QxwPRmDAjDB87I4SQ6B3dhzXO9OklhHX5GeOlaRcimMj20uYswMw+feMLk+Rv60NkQ8SujjQVnQzY5T7/QQzSy/80wIDAQAB"
```

**Важно:**
- Это сделает твой Extension ID постоянным
- Extension ID: `daamjkjejnimollocefmpekknhcldbcd`
- Приватный ключ `extension-key.pem` НЕ КОММИТЬ в Git!

---

## Шаг 2: Настроить Google Cloud Console

### 2.1. Открой Google Cloud Console
Перейди: https://console.cloud.google.com/

### 2.2. Создай или выбери проект
- Если нет проекта → "Create Project" → назови "Video Reader AI"
- Если есть → выбери нужный проект

### 2.3. Включи Google+ API
1. В меню слева: "APIs & Services" → "Library"
2. Найди "Google+ API" (или "Google People API")
3. Нажми "Enable"

### 2.4. Создай OAuth 2.0 Client ID
1. Перейди: "APIs & Services" → "Credentials"
2. Нажми "+ CREATE CREDENTIALS" → "OAuth client ID"
3. Если попросит настроить OAuth consent screen:
   - Application type: External
   - App name: Video Reader AI
   - User support email: твой email
   - Developer contact: твой email
   - Scopes: Add scope → выбери `userinfo.email` и `userinfo.profile`
   - Test users: добавь свой email (для тестирования)
   - Сохрани

4. Создай Client ID:
   - Application type: **Chrome Extension** (не Web application!)
   - Name: Video Reader AI Dev
   - Item ID: `daamjkjejnimollocefmpekknhcldbcd`
   - Нажми "Create"

### 2.5. Получи Client ID
После создания появится окно с:
- **Client ID** - скопируй его (вида: `123456789-xxxxxxxx.apps.googleusercontent.com`)

---

## Шаг 3: Обновить manifest.json с Client ID

Найди в `extension/manifest.json` секцию `oauth2` и вставь свой Client ID:

```json
"oauth2": {
  "client_id": "ТВОЙ_CLIENT_ID.apps.googleusercontent.com",
  "scopes": [
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile"
  ]
}
```

---

## Шаг 4: Добавить Authorized redirect URIs (для custom popup)

Если используешь custom popup (не Chrome Identity API), добавь redirect URI:

1. В Google Cloud Console → Credentials → твой OAuth Client
2. В разделе "Authorized redirect URIs" добавь:
   ```
   https://daamjkjejnimollocefmpekknhcldbcd.chromiumapp.org/
   ```
3. Сохрани

---

## Шаг 5: Проверить настройки

### 5.1. Загрузи расширение в Chrome
1. Открой Chrome → `chrome://extensions/`
2. Включи "Developer mode" (справа вверху)
3. Нажми "Load unpacked"
4. Выбери папку `extension/`

### 5.2. Проверь Extension ID
- В списке расширений найди "Video Reader AI"
- Под названием будет ID - он должен совпадать с: `daamjkjejnimollocefmpekknhcldbcd`
- Если совпадает ✅ - всё правильно!

### 5.3. Тестируй авторизацию
1. Кликни на иконку расширения
2. Нажми "Continue with Google"
3. Должно открыться popup окно 480x640 с Google OAuth
4. Разреши доступ
5. Проверь консоль браузера - там будут логи

---

## Важные файлы:

- ✅ `extension-key.pem` - **ПРИВАТНЫЙ КЛЮЧ** (добавь в .gitignore!)
- ✅ `extension-key-public.txt` - публичный ключ (для manifest.json)
- ✅ `extension-id.txt` - твой Extension ID
- ✅ `OAUTH_SETUP_INSTRUCTIONS.md` - эта инструкция

---

## Troubleshooting

### Ошибка: "Invalid client ID"
- Проверь, что Client ID правильно вставлен в manifest.json
- Проверь, что в Google Cloud указан правильный Extension ID

### Ошибка: "Redirect URI mismatch"
- Добавь `https://daamjkjejnimollocefmpekknhcldbcd.chromiumapp.org/` в Authorized redirect URIs
- Или используй Chrome Identity API вместо custom popup

### Extension ID изменился после перезагрузки
- Убедись, что "key" добавлен в manifest.json
- Перезагрузи расширение в chrome://extensions/

---

## Production (для Chrome Web Store)

Когда будешь публиковать в Chrome Web Store:
1. **Удали** `"key"` из manifest.json
2. Chrome Web Store сам создаст постоянный ID
3. Используй этот ID для production OAuth Client в Google Cloud
4. Создай отдельный OAuth Client ID для production

