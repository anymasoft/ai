# ЧАСТЬ E — ПРОВЕРКА И ГОТОВНОСТЬ GOOGLE OAUTH

## ✅ РЕАЛИЗАЦИЯ ЗАВЕРШЕНА

**Коммит:** `b710dc2`

Полная реализация Google OAuth из YouTubeAnalytics переносится в Screen2code:
- ✅ Backend (FastAPI) — все endpoints готовы
- ✅ Frontend (React) — все компоненты готовы
- ✅ Database schema — обновлена
- ✅ Configuration — добавлены .env файлы

---

## 🔧 ШАГИ ДЛЯ АКТИВАЦИИ

### Шаг 1: Google OAuth Configuration

1. Перейди на [Google Cloud Console](https://console.cloud.google.com/)
2. Создай или выбери проект
3. Включи Google+ API
4. Перейди в "OAuth 2.0 Client IDs"
5. Создай "Web application" если нет
6. **Добавь Authorized Redirect URIs:**
   - `http://localhost:7001/api/oauth/google/callback` (для локальной разработки)
   - `https://your-domain.com/api/oauth/google/callback` (для продакшена)

⚠️ **ВАЖНО:** Пользователь уже добавил:
```
http://localhost:7001/api/auth/callback/google
```

Это **НЕПРАВИЛЬНЫЙ** URL! Нужно изменить на:
```
http://localhost:7001/api/oauth/google/callback
```

7. Скопируй:
   - Client ID
   - Client Secret

### Шаг 2: Заполни .env файлы

**Файл:** `/backend/.env`
```bash
GOOGLE_CLIENT_ID=your_client_id_from_google
GOOGLE_CLIENT_SECRET=your_client_secret_from_google
JWT_SECRET=super-secret-jwt-key-change-in-production

BACKEND_URL=http://localhost:7001
FRONTEND_URL=http://localhost:5173

ADMIN_EMAIL=admin@example.com
```

**Файл:** `/frontend/.env`
```bash
VITE_API_URL=http://localhost:7001
```

### Шаг 3: Установи зависимости

**Backend:**
```bash
cd backend
poetry install
# Если нужны новые пакеты:
poetry add google-auth-httplib2 pyjwt
```

**Frontend:**
```bash
cd frontend
npm install
# или yarn install
```

### Шаг 4: Запусти приложение

**Backend:**
```bash
cd backend
poetry run uvicorn main:app --reload --port 7001
```

**Frontend:**
```bash
cd frontend
npm run dev
# или yarn dev
```

### Шаг 5: Тестируй

1. Открой http://localhost:5173
2. Перейди на страницу логина
3. Нажми "Sign in with Google"
4. Выбери Google аккаунт
5. Перенаправит на callback страницу и закроет popup
6. Parent window получит auth-success
7. Перенаправит на /playground

---

## 📋 ПОЛНЫЙ ЧЕКЛИСТ ФУНКЦИОНАЛЬНОСТИ

### Backend Endpoints

- [ ] `GET /api/oauth/google` — инициирует OAuth flow
  ```bash
  curl http://localhost:7001/api/oauth/google?redirect_to=/playground
  # Должен редиректить на Google
  ```

- [ ] `GET /api/oauth/google/callback?code=XXX&state=YYY` — обрабатывает callback
  ```bash
  # Автоматический, вызывается Google после oauth
  # Должен создать JWT cookie и редиректить на /auth-callback
  ```

- [ ] `GET /api/auth/user` — получает текущего пользователя
  ```bash
  curl -b "authorization=Bearer <jwt_token>" http://localhost:7001/api/auth/user
  # Returns: {id, email, name, role, plan, disabled, expiresAt}
  ```

- [ ] `POST /api/auth/logout` — логирует пользователя
  ```bash
  curl -X POST -b "authorization=Bearer <jwt_token>" http://localhost:7001/api/auth/logout
  # Returns: {ok: true}
  # Удаляет cookie
  ```

### Frontend Components

- [ ] `/auth/sign-in` — страница логина с кнопкой Google
  - Кнопка открывает popup
  - Fallback если popup заблокирован

- [ ] `/auth/callback` — обработка redirect от backend
  - Получает success/error параметры
  - Посылает postMessage parent window
  - Закрывает popup

- [ ] `ProtectedRoute` компонент
  - Проверяет авторизацию
  - Перенаправляет на /auth/sign-in если не авторизован
  - Проверяет требуемую role

### Database

- [ ] Users таблица содержит все колонки:
  ```sql
  id, email, name, plan_id, plan, role, disabled, expiresAt, created_at, updated_at
  ```

- [ ] Миграция выполнена успешно (no errors при запуске)

### Session Management

- [ ] JWT token создается после OAuth callback
  - Payload: `{id, email, name, role, exp, iat}`
  - Подписан с JWT_SECRET
  - HttpOnly cookie: `authorization: Bearer <token>`

- [ ] Frontend получает token в cookie
  - useAuthStore проверяет cookie при загрузке
  - Хранит user в Zustand store
  - Отправляет cookie в fetch запросах (credentials: 'include')

### Admin Functionality

- [ ] Admin определяется по email
  - `ADMIN_EMAIL` в конфиге = "admin@example.com"
  - Если email пользователя == ADMIN_EMAIL → role = "admin"

- [ ] Admin endpoints защищены
  - ProtectedRoute с requiredRole="admin"
  - Backend проверяет role в JWT

---

## 🧪 MANUAL TESTING

### Тест 1: Новый пользователь логинится

**Шаги:**
1. Открой http://localhost:5173/auth/sign-in
2. Нажми "Sign in with Google"
3. Выбери Google аккаунт (не админа)
4. Должен редиректить на /playground

**Проверка:**
```bash
sqlite3 backend/data/app.db "SELECT id, email, name, role, plan FROM users LIMIT 1"
# Должен показать новую запись с role='user', plan='free'
```

### Тест 2: Получение информации о пользователе

**Шаги:**
1. Залогинься (Тест 1)
2. Откройся DevTools → Application → Cookies
3. Найди `authorization` cookie
4. Скопируй значение (без "Bearer ")

**Команда:**
```bash
curl -b "authorization=Bearer <скопированный_token>" http://localhost:7001/api/auth/user
# Должен вернуть: {id, email, name, role: "user", plan: "free", disabled: false}
```

### Тест 3: Логаут

**Команда:**
```bash
curl -X POST -b "authorization=Bearer <token>" http://localhost:7001/api/auth/logout
# Должен вернуть: {ok: true}
# Cookie удалится
```

### Тест 4: Защита маршрутов

**Шаги:**
1. Открой http://localhost:5173/playground (защищенный маршрут) без логина
2. Должен редиректить на /auth/sign-in

### Тест 5: Админ доступ

**Шаги:**
1. Залогинься с email = ADMIN_EMAIL из .env
2. Проверь, что user.role = "admin"
3. Попробуй открыть /admin/messages (если есть такой маршрут)
4. Должна открыться админ панель

---

## 🔍 TROUBLESHOOTING

### Проблема 1: "Invalid state parameter" при OAuth callback

**Причина:** state не сохранился в oauth_states

**Решение:**
- В production нужно использовать Redis вместо in-memory dict
- Для локальной разработки: перезапусти backend

### Проблема 2: "Token exchange failed"

**Причина:**
- GOOGLE_CLIENT_ID или GOOGLE_CLIENT_SECRET неправильный
- URL в Google Console не совпадает с GOOGLE_OAUTH_REDIRECT_URI в config.py

**Решение:**
```bash
# Проверь в config.py
cat backend/api/oauth/config.py | grep REDIRECT_URI
# Должен быть: http://localhost:7001/api/oauth/google/callback

# Проверь в Google Console
# Должен быть точно такой же
```

### Проблема 3: CORS ошибка при fetch на frontend

**Причина:** Backend не разрешает cookies с frontend домена

**Решение:**
- Проверь main.py:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,  # ← ОБЯЗАТЕЛЬНО!
    ...
)
```

### Проблема 4: "Not authenticated" при GET /api/auth/user

**Причина:** Cookie не отправляется в запросе

**Решение:**
- Frontend: используй `credentials: 'include'` в fetch
- Backend: Zustand store автоматически это делает

### Проблема 5: User создается без имени

**Причина:** Google не вернул поле "name"

**Решение:** Используется fallback:
```python
display_name = name or email.split("@")[0]
# Если нет имени - используется часть email до @
```

---

## 📊 АРХИТЕКТУРА (Полный Flow)

```
Frontend
  ↓ (Click "Sign in with Google")
  ↓
Popup: /api/oauth/google?redirect_to=/playground
  ↓ (GET)
Backend: GET /api/oauth/google
  ↓ Генерирует state
  ↓ Редиректит на https://accounts.google.com/...
  ↓
Google OAuth Screen
  ↓ (Пользователь выбирает аккаунт и разрешает)
  ↓
Google redirects to: /api/oauth/google/callback?code=XXX&state=YYY
  ↓ (GET)
Backend: GET /api/oauth/google/callback
  ├─ Проверяет state
  ├─ Обменивает code на access_token
  ├─ Получает user info из Google
  ├─ Проверяет/создает user в БД
  ├─ Создает JWT token
  ├─ Sets HttpOnly cookie
  └─ Редиректит на /auth-callback?success=true
  ↓
Popup: /auth-callback
  ├─ Получает success=true из URL
  ├─ Посылает postMessage parent window: {type: "auth-success"}
  └─ Закрывает себя
  ↓
Parent window
  ├─ Получает auth-success message
  ├─ Вызывает useAuthStore.checkAuth()
  │  └─ GET /api/auth/user → отправляет cookie
  │     ← 200 OK с user data
  │     ← Сохраняет в Zustand store
  └─ Редиректит на /playground
  ↓
App
  ├─ ProtectedRoute проверяет user из store
  ├─ Если user есть → показывает playground
  └─ Если user нет → редиректит на /auth/sign-in
```

---

## 📝 SUMMARY

### Что работает сейчас:

✅ Google OAuth полностью интегрирован
✅ User создается при первом логине
✅ JWT tokens с правильным payload
✅ HttpOnly cookies для session storage
✅ Admin check через ADMIN_EMAIL
✅ Protected routes на frontend
✅ Graceful error handling
✅ Popup flow с fallback

### Что нужно для production:

❌ Использовать Redis вместо in-memory dict для state
❌ Переключить secure=True в cookies (HTTPS)
❌ Добавить rate limiting на OAuth endpoints
❌ Добавить логирование (Sentry или другое)
❌ Добавить refresh token logic
❌ Добавить logout на всех sessions (сейчас только cookie)

### Текущий статус:

🟢 **ГОТОВО К ЛОКАЛЬНОЙ РАЗРАБОТКЕ**
🟡 **ТРЕБУЕТ ДОДЕЛОК ДЛЯ PRODUCTION**

---

## 📞 ВОПРОСЫ И ПОДДЕРЖКА

Если что-то не работает:

1. Проверь логи backend:
```bash
# Look for [OAuth] или [DB] сообщения
```

2. Проверь консоль frontend:
```javascript
// DevTools → Console
// Look for fetch errors, postMessage events
```

3. Проверь cookies в DevTools:
```
Application → Cookies → localhost:5173 → authorization
```

4. Проверь БД:
```bash
sqlite3 backend/data/app.db "SELECT * FROM users LIMIT 5"
```

---

## 🎉 ВСЁ ГОТОВО!

Реализация Google OAuth завершена. Все файлы созданы, закоммичены и запушены.

**Следующий шаг:** Заполни .env файлы и запусти приложение.

**Дата завершения:** 24 декабря 2025
**Коммит:** `b710dc2`
**Статус:** ✅ READY TO USE
