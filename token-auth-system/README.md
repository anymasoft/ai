# Token Authentication System - Migration Guide

## Обзор изменений

Система полностью переведена с cookie/session авторизации на простую токен-модель с использованием Bearer tokens.

### Ключевые изменения:

1. **Backend (Flask)**:
   - Создана отдельная БД `users.db` для хранения пользователей
   - Таблица `users(email TEXT PRIMARY KEY, token TEXT, plan TEXT)`
   - При OAuth callback генерируется UUID токен
   - Новый endpoint `/api/plan` работает только с Bearer токенами
   - Полностью убраны session/cookie

2. **Extension (Chrome)**:
   - Слушает postMessage от OAuth popup
   - Сохраняет токен в `chrome.storage.local`
   - Использует Bearer token в заголовке Authorization
   - Функция `fetchPlan()` возвращает план пользователя

## Структура файлов

```
token-auth-system/
├── SERVER_TEMPLATE.py    # Обновленный Flask сервер с токен-авторизацией
├── content.js            # Обновленный content script для расширения
└── README.md            # Эта инструкция
```

## Установка и запуск

### 1. Backend (Flask)

```bash
cd token-auth-system
python SERVER_TEMPLATE.py
```

Сервер запустится на `http://localhost:5000` и создаст две базы данных:
- `translations.db` - кеш переводов (как раньше)
- `users.db` - пользователи с токенами (новая)

### 2. Extension (Chrome)

Замените содержимое `extension/content.js` на новую версию из `token-auth-system/content.js`.

## Инструкции по тестированию

### Тест 1: Генерация токена при OAuth

**Цель**: Проверить, что токен генерируется и отправляется в расширение

**Шаги**:
1. Откройте Chrome DevTools (F12) на странице YouTube
2. Перейдите на вкладку Console
3. Откройте OAuth popup (через расширение или напрямую):
   ```
   http://localhost:5000/auth/callback?code=TEST_CODE
   ```
4. **Ожидаемый результат**:
   - В консоли popup должно появиться: `Token sent to extension`
   - В консоли родительской страницы: `[VideoReader] Получен токен от OAuth callback: 12345678...`
   - Popup автоматически закроется через 1 секунду

**Проверка в коде**:
- Откройте DevTools → Application → Storage → Local Storage
- Найдите ключ `token` с UUID значением

### Тест 2: Запись токена в БД

**Цель**: Убедиться, что токен и план сохраняются в `users.db`

**Шаги**:
1. После успешного OAuth (Тест 1) проверьте логи Flask сервера
2. **Ожидаемый результат**:
   ```
   [TOKEN AUTH] Создан/обновлен пользователь test@example.com, токен: 12345678...
   ```

**Проверка в БД**:
```bash
sqlite3 users.db
SELECT * FROM users;
```

**Ожидаемый результат**:
```
test@example.com|12345678-1234-5678-1234-567812345678|Free|1234567890
```

**Структура таблицы**:
- `email` - email пользователя
- `token` - UUID токен (32 символа hex)
- `plan` - тарифный план (Free/Pro/Premium)
- `created_at` - timestamp создания

### Тест 3: Получение плана через API

**Цель**: Проверить, что расширение получает план пользователя через Bearer token

**Шаги**:
1. Откройте YouTube с установленным расширением
2. Откройте DevTools → Console
3. Найдите в консоли сообщения от `[VideoReader]`
4. **Ожидаемый результат**:
   ```
   [VideoReader] Получен токен от OAuth callback: 12345678...
   [VideoReader] Токен сохранён в chrome.storage
   [VideoReader] Current plan: Free (test@example.com)
   ```

**Ручная проверка через curl**:
```bash
# Замените TOKEN на реальный токен из chrome.storage
curl -H "Authorization: Bearer TOKEN" http://localhost:5000/api/plan
```

**Ожидаемый результат (успех)**:
```json
{
  "status": "ok",
  "email": "test@example.com",
  "plan": "Free"
}
```

**Ожидаемый результат (неверный токен)**:
```json
{
  "error": "unauthorized"
}
```

### Тест 4: Проверка без токена

**Цель**: Убедиться, что без токена пользователь получает Free план

**Шаги**:
1. Очистите chrome.storage:
   ```javascript
   chrome.storage.local.clear()
   ```
2. Перезагрузите страницу YouTube
3. **Ожидаемый результат в консоли**:
   ```
   [VideoReader] Токен отсутствует - пользователь не авторизован
   [VideoReader] Current plan: Free
   ```

### Тест 5: Проверка невалидного токена

**Цель**: Убедиться, что невалидный токен обрабатывается корректно

**Шаги**:
1. Установите невалидный токен:
   ```javascript
   chrome.storage.local.set({token: 'invalid-token-12345'})
   ```
2. Перезагрузите страницу YouTube
3. **Ожидаемый результат**:
   ```
   [VideoReader] Токен невалиден - пользователь не авторизован
   [VideoReader] Current plan: Free
   ```

## Основные отличия от старой версии

### Что убрано:

❌ Flask `session` и `session['email']`
❌ Cookie `api_session`
❌ `@app.after_request` hook для установки cookies
❌ `app.secret_key`
❌ `supports_credentials: True` в CORS
❌ `credentials: 'include'` в fetch запросах расширения

### Что добавлено:

✅ База данных `users.db` с таблицей `users`
✅ Функция `create_or_update_user()` - генерация UUID токена
✅ Функция `get_user_by_token()` - валидация токена
✅ postMessage в `/auth/callback` для отправки токена в расширение
✅ Bearer token авторизация в `/api/plan`
✅ Event listener для postMessage в `content.js`
✅ Сохранение токена в `chrome.storage.local`

## API Reference

### POST /translate-line
Без изменений - работает как раньше.

### GET /api/plan
**Новый эндпоинт с токен-авторизацией**

**Headers**:
```
Authorization: Bearer <token>
```

**Response (200)**:
```json
{
  "status": "ok",
  "email": "user@example.com",
  "plan": "Free"
}
```

**Response (401)**:
```json
{
  "error": "unauthorized"
}
```

### GET /auth/callback
**Изменено**: теперь возвращает HTML с postMessage

**Query параметры**:
- `code` - OAuth authorization code

**Поведение**:
1. Обменивает code на Google id_token
2. Извлекает email из JWT
3. Генерирует UUID токен
4. Сохраняет в `users.db`
5. Отправляет postMessage с токеном
6. Закрывает popup через 1 секунду

## Миграция существующих пользователей

Если у вас есть пользователи со старой системой (session/cookie), им потребуется:

1. Заново пройти OAuth авторизацию
2. Получить новый токен
3. Токен будет автоматически сохранён в расширении

**Примечание**: Старые session данные будут игнорироваться. Миграция данных о тарифах должна быть выполнена вручную, если необходимо.

## Безопасность

### Рекомендации:

1. **HTTPS обязателен в продакшене**
   - Токены должны передаваться только по HTTPS
   - Измените `GOOGLE_REDIRECT_URI` на https://

2. **Токены не должны истекать автоматически**
   - В текущей реализации токены бессрочные
   - Для продакшена добавьте поле `expires_at` в таблицу

3. **Rate limiting**
   - Добавьте ограничение на количество запросов к `/api/plan`

4. **Валидация origin**
   - В продакшене проверяйте origin в postMessage:
     ```javascript
     if (event.origin !== 'http://localhost:5000') return;
     ```

## Troubleshooting

### Проблема: Токен не сохраняется в chrome.storage

**Решение**:
1. Проверьте, что в `manifest.json` есть permission:
   ```json
   "permissions": ["storage"]
   ```
2. Проверьте консоль на наличие ошибок

### Проблема: /api/plan возвращает 401

**Возможные причины**:
1. Токен не был добавлен в заголовок Authorization
2. Формат заголовка неверный (должно быть `Bearer <token>`)
3. Токен не существует в БД
4. БД `users.db` не создана или повреждена

**Проверка**:
```bash
sqlite3 users.db "SELECT * FROM users WHERE token='YOUR_TOKEN';"
```

### Проблема: postMessage не работает

**Возможные причины**:
1. Popup не открыт из расширения (нет `window.opener`)
2. Content script не загружен на странице
3. CORS блокирует postMessage

**Проверка**:
- Откройте DevTools в popup окне
- Проверьте консоль на ошибки

## Следующие шаги

После успешного тестирования:

1. Замените `SERVER_TEMPLATE.py` в корне проекта
2. Замените `extension/content.js` новой версией
3. Добавьте реальные Google OAuth credentials в `.env`
4. Протестируйте полный флоу с реальным Google OAuth

## Контрольный чеклист

- [ ] Сервер запускается без ошибок
- [ ] Создаётся база данных users.db
- [ ] OAuth callback генерирует токен
- [ ] Токен записывается в БД
- [ ] postMessage отправляет токен в расширение
- [ ] Расширение сохраняет токен в chrome.storage
- [ ] /api/plan возвращает план по токену
- [ ] /api/plan возвращает 401 для невалидного токена
- [ ] Без токена пользователь получает Free план
- [ ] Перевод субтитров работает как раньше
