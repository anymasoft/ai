#!/bin/bash

# Скрипт для генерации фиксированного ключа Chrome расширения
# Это нужно для того, чтобы extension ID не менялся при разработке

echo "🔑 Генерация ключа для Chrome расширения..."
echo ""

# 1. Генерируем приватный ключ (2048-bit RSA)
openssl genrsa 2048 > extension-key.pem 2>/dev/null

echo "✅ Приватный ключ создан: extension-key.pem"
echo "⚠️  ВАЖНО: Храни этот файл в секрете! Добавь в .gitignore"
echo ""

# 2. Извлекаем публичный ключ в формате, который нужен Chrome
openssl rsa -in extension-key.pem -pubout -outform DER 2>/dev/null | base64 -w 0 > extension-key-public.txt

echo "✅ Публичный ключ создан: extension-key-public.txt"
echo ""

# 3. Показываем публичный ключ для вставки в manifest.json
PUBLIC_KEY=$(cat extension-key-public.txt)
echo "📋 Скопируй этот ключ и вставь в manifest.json:"
echo ""
echo "  \"key\": \"$PUBLIC_KEY\""
echo ""

# 4. Вычисляем extension ID из публичного ключа
# Extension ID = первые 128 бит SHA256 хэша публичного ключа, закодированные в специальный алфавит
openssl rsa -in extension-key.pem -pubout -outform DER 2>/dev/null | \
  openssl dgst -sha256 -binary | \
  head -c 16 | \
  xxd -p | \
  tr '0123456789abcdef' 'abcdefghijklmnop' > extension-id.txt

EXTENSION_ID=$(cat extension-id.txt)
echo "🆔 Твой Extension ID:"
echo ""
echo "   $EXTENSION_ID"
echo ""
echo "   Используй этот ID в Google Cloud Console!"
echo ""

# 5. Создаем файл с инструкциями
cat > OAUTH_SETUP_INSTRUCTIONS.md <<EOF
# Инструкция по настройке Google OAuth для Chrome Extension

## Шаг 1: Добавить ключ в manifest.json ✅

Добавь эту строку в \`extension/manifest.json\` (в корень объекта):

\`\`\`json
"key": "$PUBLIC_KEY"
\`\`\`

**Важно:**
- Это сделает твой Extension ID постоянным
- Extension ID: \`$EXTENSION_ID\`
- Приватный ключ \`extension-key.pem\` НЕ КОММИТЬ в Git!

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
   - Scopes: Add scope → выбери \`userinfo.email\` и \`userinfo.profile\`
   - Test users: добавь свой email (для тестирования)
   - Сохрани

4. Создай Client ID:
   - Application type: **Chrome Extension** (не Web application!)
   - Name: Video Reader AI Dev
   - Item ID: \`$EXTENSION_ID\`
   - Нажми "Create"

### 2.5. Получи Client ID
После создания появится окно с:
- **Client ID** - скопируй его (вида: \`123456789-xxxxxxxx.apps.googleusercontent.com\`)

---

## Шаг 3: Обновить manifest.json с Client ID

Найди в \`extension/manifest.json\` секцию \`oauth2\` и вставь свой Client ID:

\`\`\`json
"oauth2": {
  "client_id": "ТВОЙ_CLIENT_ID.apps.googleusercontent.com",
  "scopes": [
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile"
  ]
}
\`\`\`

---

## Шаг 4: Добавить Authorized redirect URIs (для custom popup)

Если используешь custom popup (не Chrome Identity API), добавь redirect URI:

1. В Google Cloud Console → Credentials → твой OAuth Client
2. В разделе "Authorized redirect URIs" добавь:
   \`\`\`
   https://$EXTENSION_ID.chromiumapp.org/
   \`\`\`
3. Сохрани

---

## Шаг 5: Проверить настройки

### 5.1. Загрузи расширение в Chrome
1. Открой Chrome → \`chrome://extensions/\`
2. Включи "Developer mode" (справа вверху)
3. Нажми "Load unpacked"
4. Выбери папку \`extension/\`

### 5.2. Проверь Extension ID
- В списке расширений найди "Video Reader AI"
- Под названием будет ID - он должен совпадать с: \`$EXTENSION_ID\`
- Если совпадает ✅ - всё правильно!

### 5.3. Тестируй авторизацию
1. Кликни на иконку расширения
2. Нажми "Continue with Google"
3. Должно открыться popup окно 480x640 с Google OAuth
4. Разреши доступ
5. Проверь консоль браузера - там будут логи

---

## Важные файлы:

- ✅ \`extension-key.pem\` - **ПРИВАТНЫЙ КЛЮЧ** (добавь в .gitignore!)
- ✅ \`extension-key-public.txt\` - публичный ключ (для manifest.json)
- ✅ \`extension-id.txt\` - твой Extension ID
- ✅ \`OAUTH_SETUP_INSTRUCTIONS.md\` - эта инструкция

---

## Troubleshooting

### Ошибка: "Invalid client ID"
- Проверь, что Client ID правильно вставлен в manifest.json
- Проверь, что в Google Cloud указан правильный Extension ID

### Ошибка: "Redirect URI mismatch"
- Добавь \`https://$EXTENSION_ID.chromiumapp.org/\` в Authorized redirect URIs
- Или используй Chrome Identity API вместо custom popup

### Extension ID изменился после перезагрузки
- Убедись, что "key" добавлен в manifest.json
- Перезагрузи расширение в chrome://extensions/

---

## Production (для Chrome Web Store)

Когда будешь публиковать в Chrome Web Store:
1. **Удали** \`"key"\` из manifest.json
2. Chrome Web Store сам создаст постоянный ID
3. Используй этот ID для production OAuth Client в Google Cloud
4. Создай отдельный OAuth Client ID для production

EOF

echo "📝 Создана инструкция: OAUTH_SETUP_INSTRUCTIONS.md"
echo ""
echo "✅ Готово! Теперь:"
echo "   1. Добавь .gitignore для приватного ключа"
echo "   2. Прочитай OAUTH_SETUP_INSTRUCTIONS.md"
echo "   3. Следуй инструкциям по порядку"
echo ""
