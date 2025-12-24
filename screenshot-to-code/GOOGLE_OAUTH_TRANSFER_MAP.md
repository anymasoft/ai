# ЧАСТЬ B — КАРТА ПЕРЕНОСА GOOGLE OAUTH

## Таблица переноса элементов из YouTubeAnalytics в Screen2code

| Элемент | Где в YouTubeAnalytics | Куда в Screen2code | Изменения |
|---------|------------------------|-------------------|-----------|
| **Google OAuth Provider** | `next-auth` library | FastAPI + `google-auth-httplib2` | Меняется lib, логика та же |
| **OAuth Config** | `/src/lib/auth.ts` | `/backend/api/oauth/config.py` | Переносим GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, callbackURL |
| **signIn callback** | `auth.ts` (проверка user в БД, создание) | `/backend/api/oauth/callbacks.py` (функция `handle_oauth_signin`) | Логика та же, просто в FastAPI |
| **jwt callback** | `auth.ts` (добавляем id, role в token) | JWT encode в FastAPI, в payload добавляем id, role | Логика та же |
| **session callback** | `auth.ts` (возвращает session с id, role) | HTTP response с session data в JSON | Логика та же |
| **Session Strategy** | NextAuth JWT | FastAPI: HttpOnly cookies + JWT | Меняется механизм, логика та же |
| **Route handler** | `/api/auth/[...nextauth]/route.ts` | `/backend/api/routes/oauth/google.py` | Мультиплексер для разных endpoint'ов OAuth |
| **Callback URL** | `http://localhost:3000/api/auth/callback/google` | `http://localhost:7001/api/oauth/google/callback` | Меняется backend URL |
| **Sign-in page** | `/src/app/(auth)/sign-in/` (Next.js) | `/frontend/src/app/auth/sign-in/` (React) | UI переносим, логика та же |
| **Google Sign-in popup** | `/src/app/auth/google-signin/page.tsx` | `/frontend/src/app/auth/google-signin.html` или отдельный компонент | signIn() → window.location.href на backend OAuth URL |
| **Auth callback page** | `/src/app/auth-callback/page.tsx` | `/frontend/src/app/auth/callback/` | Обработка redirect от backend, postMessage родителю |
| **Middleware auth check** | `/src/middleware.ts` (Next.js middleware) | React Router protected routes + custom hook | Меняется механизм, логика та же |
| **Admin check** | `admin-config.ts` (ADMIN_EMAIL) | `/backend/config.py` (ADMIN_EMAIL или env) | Простой перенос |
| **Admin layout protection** | `/src/app/(dashboard)/admin/layout.tsx` (server-side) | React component с useAuthStore + ProtectedRoute | Логика та же, implementация на фронтенде |
| **User API endpoint** | `GET /api/user` (читает из БД) | `GET /api/auth/user` (читает из БД) | Endpoint переходит на backend |
| **Users table** | SQLite: users (id, email, name, role, plan, disabled, expiresAt) | SQLite: users (ТАКАЯ ЖЕ структура) | **БЕЗ ИЗМЕНЕНИЙ** |
| **Session on Frontend** | `useSession()` from next-auth | Zustand store + custom hook `useAuthStore()` | Меняется механизм получения, данные те же |
| **Protected routes** | Next.js middleware + layout checks | React Router + `ProtectedRoute` компонент | Логика та же |
| **Logout** | `signOut()` from next-auth | DELETE `/api/auth/logout` + clear cookies | Логика та же |
| **Disabled user check** | `/auth/check-disabled/route.ts` | `/backend/api/oauth/check_disabled.py` | Логика та же, в FastAPI |
| **Post-login redirect** | `callbackUrl` в signIn | URL параметр `redirect_to` в OAuth callback | Логика та же |
| **Error handling** | `pages.error = "/auth-callback"` с `?error=` param | FastAPI redirect с параметром `error` в URL | Логика та же |

---

## Диаграмма Flow'ов

### YouTubeAnalytics (Next.js + NextAuth)

```
Frontend (Next.js)
  ↓
Click "Sign in with Google"
  ↓ (popup)
/auth/google-signin page
  ↓
signIn("google", { callbackUrl: "/auth-callback" })
  ↓
NextAuth internal: /api/auth/signin/google
  ↓
Google OAuth consent screen
  ↓
Google redirects to: /api/auth/callback/google?code=XXX&state=YYY
  ↓
NextAuth receives code
  ↓
Exchange code for tokens
  ↓
signIn callback: проверяем user в БД, создаём если нужно
  ↓
jwt callback: добавляем id, role в JWT
  ↓
session callback: возвращаем session с user data
  ↓
NextAuth redirects to: /auth-callback
  ↓
auth-callback page: postMessage parent window + close popup
  ↓
Parent window redirects to: /trending
```

### Screen2code (Vite + FastAPI + OAuth)

```
Frontend (Vite React)
  ↓
Click "Sign in with Google"
  ↓ (popup)
/frontend/src/app/auth/google-signin component
  ↓
window.location.href = "/api/oauth/google"
  ↓
FastAPI: GET /api/oauth/google
  ↓
Generate authorization URL с client_id, redirect_uri, scope, state
  ↓
Redirect на: https://accounts.google.com/o/oauth2/v2/auth?...
  ↓
Google OAuth consent screen
  ↓
Google redirects to: /api/oauth/google/callback?code=XXX&state=YYY
  ↓
FastAPI: POST /api/oauth/google/callback
  ↓
Exchange code for tokens (используя google-auth)
  ↓
Get user info from Google
  ↓
handle_oauth_signin callback: проверяем user в БД, создаём если нужно
  ↓
Create JWT token: добавляем id, role в payload
  ↓
Set HttpOnly cookie: `Authorization: Bearer <jwt>`
  ↓
Redirect to: /auth-callback?success=true
  ↓
/auth-callback component: postMessage parent window + close popup
  ↓
Parent window получает auth-success
  ↓
Frontend: dispatch userStore.setUser() из cookies
  ↓
Redirect to: /playground
```

---

## Ключевые различия стеков

| Компонент | NextAuth (Next.js) | Наш подход (FastAPI) |
|-----------|-------------------|---------------------|
| **OAuth lib** | `next-auth/providers/google` | `google-auth-httplib2` или `authlib` |
| **Callback handler** | Built-in NextAuth callback | FastAPI route с обработкой code |
| **Session storage** | NextAuth internal (cookies + JWT) | HttpOnly cookies + JWT в FastAPI |
| **Session on frontend** | `useSession()` hook | Zustand store + custom hook |
| **Auth check on backend** | `getServerSession()` | `get_current_user()` dependency |
| **Auth check on frontend** | NextAuth middleware | React Router + Protected routes |
| **Logout** | `signOut()` function | DELETE request + clear cookies |

---

## Что ПЕРЕНОСИМ 1-в-1 (БЕЗ ИЗМЕНЕНИЙ)

1. ✅ **Таблица users в БД** — ТОЧНАЯ копия
2. ✅ **Логика создания user при первом логине** — ТОЧНАЯ копия
3. ✅ **Логика signIn callback** — ТОЧНАЯ копия (только синтаксис FastAPI)
4. ✅ **JWT payload** — ТОЧНАЯ копия (id, role)
5. ✅ **Admin check через ADMIN_EMAIL** — ТОЧНАЯ копия
6. ✅ **Logic для disabled users** — ТОЧНАЯ копия
7. ✅ **Redirect flow** — ТОЧНАЯ копия (просто другие URL'ы)
8. ✅ **Error handling** — ТОЧНАЯ копия
9. ✅ **Google OAuth scopes** — ТОЧНАЯ копия

---

## Что ПЕРЕДЕЛЫВАЕМ (только механика, логика та же)

1. 🔄 **Session storage** — NextAuth cookies → FastAPI HttpOnly cookies
2. 🔄 **Frontend auth hook** — `useSession()` → Zustand `useAuthStore()`
3. 🔄 **Middleware** — Next.js middleware → React Router Protected routes
4. 🔄 **Callback handler** — NextAuth internal → FastAPI endpoint
5. 🔄 **Logout** — `signOut()` → DELETE request

---

## Минимальный перенос

**Обязательные файлы для переноса:**

### Backend (FastAPI)
1. `/backend/api/oauth/config.py` — GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, URLs
2. `/backend/api/oauth/google.py` — GET /api/oauth/google, POST /api/oauth/google/callback
3. `/backend/api/oauth/callbacks.py` — handle_oauth_signin (логика из next-auth)
4. `/backend/api/routes/auth.py` — DELETE /api/auth/logout, GET /api/auth/user
5. `/backend/db/schema.py` — users table (копия из YouTubeAnalytics)

### Frontend (React)
1. `/frontend/src/app/auth/sign-in/` — UI для логина (почти как есть)
2. `/frontend/src/app/auth/google-signin.tsx` — компонент для popup
3. `/frontend/src/app/auth/callback/` — компонент для обработки redirect
4. `/frontend/src/store/auth.ts` — Zustand store для user и session
5. `/frontend/src/components/router/protected-route.tsx` — защита маршрутов

### Config
1. `.env` — GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, BACKEND_URL

---

## Готовность к переносу

- ✅ Полная информация о структуре YouTubeAnalytics
- ✅ Полная таблица переноса элементов
- ✅ Понимание различий между Next.js и FastAPI
- ✅ Минимальный набор файлов для переноса

**СЛЕДУЮЩИЙ ШАГ:** ЧАСТЬ C — адаптация деталей под другой стек.
