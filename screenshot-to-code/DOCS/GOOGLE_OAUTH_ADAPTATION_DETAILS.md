# ЧАСТЬ C — АДАПТАЦИЯ GOOGLE OAUTH ПОД VITE + FASTAPI

## 1. GOOGLE OAUTH CONFIG В FASTAPI

### Откуда берём (YouTubeAnalytics)
```typescript
// /src/lib/auth.ts
GoogleProvider({
  clientId: process.env.GOOGLE_CLIENT_ID || "",
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
})
```

### Куда переносим (Screen2code FastAPI)

**Файл:** `/backend/api/oauth/config.py`

```python
import os

# Google OAuth Configuration
# Переносим прямо из env переменных

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")

# URLs
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:7001")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

GOOGLE_OAUTH_REDIRECT_URI = f"{BACKEND_URL}/api/oauth/google/callback"
GOOGLE_OAUTH_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_OAUTH_TOKEN_URL = "https://www.googleapis.com/oauth2/v4/token"
GOOGLE_OAUTH_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"

# JWT Secret (для подписи tokens)
JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key-change-in-production")

# Scopes (те же, что использует NextAuth)
GOOGLE_OAUTH_SCOPES = [
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/userinfo.email",
]

# Admin
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@example.com")
```

### ENV файл

**Файл:** `/backend/.env`

```bash
# Google OAuth
GOOGLE_CLIENT_ID=your_client_id_from_google
GOOGLE_CLIENT_SECRET=your_client_secret_from_google
JWT_SECRET=super-secret-jwt-key-change-this-in-production

# URLs
BACKEND_URL=http://localhost:7001
FRONTEND_URL=http://localhost:5173

# Admin
ADMIN_EMAIL=admin@example.com
```

---

## 2. FASTAPI ENDPOINTS ДЛЯ OAUTH FLOW

### Endpoint 1: Инициация логина

**Файл:** `/backend/api/routes/oauth.py`

```python
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import RedirectResponse
import secrets
import json
from api.oauth.config import (
    GOOGLE_CLIENT_ID,
    GOOGLE_OAUTH_REDIRECT_URI,
    GOOGLE_OAUTH_AUTH_URL,
    GOOGLE_OAUTH_SCOPES,
    FRONTEND_URL,
)

router = APIRouter(prefix="/api/oauth", tags=["oauth"])

# Временное хранилище state (в production нужен Redis или БД)
oauth_states = {}

@router.get("/google")
async def initiate_google_oauth(redirect_to: str = Query(default="/playground")):
    """
    Инициирует Google OAuth flow.

    Эта функция генерирует authorization URL и редиректит пользователя на Google.

    Эквивалент: NextAuth signIn("google") в YouTubeAnalytics
    """

    # Генерируем state для CSRF protection (обязательно!)
    state = secrets.token_urlsafe(32)
    oauth_states[state] = {
        "redirect_to": redirect_to,
        "created_at": datetime.now(),
    }

    # Строим authorization URL (тот же, что использует Google OAuth)
    auth_url = (
        f"{GOOGLE_OAUTH_AUTH_URL}?"
        f"client_id={GOOGLE_CLIENT_ID}&"
        f"redirect_uri={GOOGLE_OAUTH_REDIRECT_URI}&"
        f"response_type=code&"
        f"scope={'+'.join(GOOGLE_OAUTH_SCOPES)}&"
        f"access_type=offline&"
        f"state={state}"
    )

    # Редиректим пользователя на Google
    return RedirectResponse(url=auth_url)


@router.post("/google/callback")
async def google_oauth_callback(
    code: str = Query(...),
    state: str = Query(...),
):
    """
    Обрабатывает callback от Google OAuth.

    1. Проверяет state (CSRF protection)
    2. Обменивает code на access token
    3. Получает информацию о пользователе
    4. Создаёт/обновляет пользователя в БД
    5. Создаёт JWT token
    6. Возвращает redirect с токеном

    Эквивалент: NextAuth callback handlers в YouTubeAnalytics
    """
    from datetime import datetime, timedelta
    import httplib2
    import json as json_lib
    from urllib.parse import urlencode

    # PART 1: Проверяем state
    if state not in oauth_states:
        raise HTTPException(status_code=400, detail="Invalid state parameter")

    oauth_state = oauth_states.pop(state)
    redirect_to = oauth_state.get("redirect_to", "/playground")

    # PART 2: Обмениваем code на access token
    try:
        http = httplib2.Http()
        token_url = f"{GOOGLE_OAUTH_TOKEN_URL}"
        body = urlencode({
            "code": code,
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": GOOGLE_OAUTH_REDIRECT_URI,
            "grant_type": "authorization_code",
        })

        headers = {"Content-Type": "application/x-www-form-urlencoded"}
        resp, content = http.request(token_url, "POST", body=body, headers=headers)

        if resp.status != 200:
            raise HTTPException(status_code=400, detail="Failed to exchange code for token")

        token_data = json_lib.loads(content)
        access_token = token_data.get("access_token")

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"OAuth token exchange failed: {str(e)}")

    # PART 3: Получаем информацию о пользователе
    try:
        http = httplib2.Http()
        resp, content = http.request(
            f"{GOOGLE_OAUTH_USERINFO_URL}?access_token={access_token}",
            "GET"
        )

        if resp.status != 200:
            raise HTTPException(status_code=400, detail="Failed to get user info")

        user_info = json_lib.loads(content)

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to get user info: {str(e)}")

    # PART 4: Создаём/проверяем пользователя в БД
    # ===== ЛОГИКА ИЗ YouTubeAnalytics ПЕРЕНОСИТСЯ СЮДА =====
    from db.app import get_conn

    user_id = user_info.get("id")  # Google User ID
    user_email = user_info.get("email")
    user_name = user_info.get("name")

    if not user_id or not user_email:
        raise HTTPException(status_code=400, detail="Missing required user info from Google")

    conn = get_conn()
    cursor = conn.cursor()

    # Проверяем, существует ли пользователь
    cursor.execute("SELECT id, disabled FROM users WHERE id = ?", (user_id,))
    existing_user = cursor.fetchone()

    if existing_user is None:
        # Создаём нового пользователя (ЛОГИКА ИЗ YouTubeAnalytics)
        now_timestamp = int(datetime.now().timestamp())
        cursor.execute(
            """
            INSERT INTO users (id, email, name, role, plan, disabled, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (user_id, user_email, user_name or user_email.split("@")[0], "user", "free", 0, now_timestamp, now_timestamp)
        )
        conn.commit()
    else:
        # Проверяем, не отключен ли пользователь (ЛОГИКА ИЗ YouTubeAnalytics)
        if existing_user[1] == 1:  # disabled == 1
            conn.close()
            # Перенаправляем на страницу ошибки доступа
            return RedirectResponse(
                url=f"{FRONTEND_URL}/auth-callback?error=access_denied",
                status_code=302
            )

    conn.close()

    # PART 5: Создаём JWT token
    # ===== ЛОГИКА ИЗ JWT CALLBACK ПЕРЕНОСИТСЯ СЮДА =====
    import jwt

    payload = {
        "sub": user_id,  # subject (user id)
        "id": user_id,
        "email": user_email,
        "name": user_name,
        "role": "admin" if user_email == ADMIN_EMAIL else "user",
        "exp": datetime.utcnow() + timedelta(days=30),  # 30 дней как в NextAuth
        "iat": datetime.utcnow(),
    }

    access_token = jwt.encode(
        payload,
        JWT_SECRET,
        algorithm="HS256"
    )

    # PART 6: Возвращаем redirect с токеном
    # Frontend получит токен из cookie (мы его установим в middleware)
    response = RedirectResponse(
        url=f"{FRONTEND_URL}/auth-callback?success=true&redirect_to={redirect_to}",
        status_code=302
    )

    # Устанавливаем HttpOnly cookie с JWT token
    response.set_cookie(
        key="authorization",
        value=f"Bearer {access_token}",
        httponly=True,
        secure=True,  # HTTPS only в production
        samesite="lax",
        max_age=30 * 24 * 60 * 60,  # 30 дней
    )

    return response
```

### Endpoint 2: Получение текущего пользователя

**Файл:** `/backend/api/routes/auth.py`

```python
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from datetime import datetime

router = APIRouter(prefix="/api/auth", tags=["auth"])

def get_current_user(request: Request):
    """
    Middleware для проверки JWT token из cookie.
    Используется для защиты protected endpoints.
    """
    import jwt

    # Получаем token из cookie
    token = request.cookies.get("authorization")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Убираем "Bearer " prefix
    if token.startswith("Bearer "):
        token = token[7:]

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        user_id = payload.get("id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.DecodeError:
        raise HTTPException(status_code=401, detail="Invalid token")


@router.get("/user")
async def get_user(current_user: dict = Depends(get_current_user)):
    """
    GET /api/auth/user

    Возвращает информацию о текущем пользователе.
    ЧИТАЕТ ИЗ БД, БЕЗ кэширования.

    Эквивалент: GET /api/user в YouTubeAnalytics
    """
    from db.app import get_conn

    conn = get_conn()
    cursor = conn.cursor()

    # ВАЖНО: Читаем СВЕЖИЕ данные из БД (как в YouTubeAnalytics)
    cursor.execute(
        "SELECT id, email, name, role, plan, disabled, expiresAt FROM users WHERE id = ?",
        (current_user["id"],)
    )
    user = cursor.fetchone()
    conn.close()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return JSONResponse({
        "id": user[0],
        "email": user[1],
        "name": user[2],
        "role": user[3],
        "plan": user[4],
        "disabled": bool(user[5]),
        "expiresAt": user[6],
    })


@router.post("/logout")
async def logout():
    """
    POST /api/auth/logout

    Логирует пользователя.
    На Frontend'е удаляются cookies (браузер сделает автоматически).

    Эквивалент: signOut() в YouTubeAnalytics
    """
    response = JSONResponse({"ok": True})
    response.delete_cookie("authorization", httponly=True, secure=True, samesite="lax")
    return response
```

---

## 3. FRONTEND: КАК ИНИЦИИРОВАТЬ ЛОГИН

### Откуда берём (YouTubeAnalytics)

```typescript
// /src/app/(auth)/sign-in/components/login-form-1.tsx
const handleGoogleSignIn = () => {
  const popup = window.open(
    "/auth/google-signin",
    "google-signin",
    `width=500,height=600,...`
  );
  if (!popup) {
    signIn("google", { callbackUrl: "/trending" });
  }
}
```

### Куда переносим (Screen2code React)

**Файл:** `/frontend/src/app/auth/sign-in/page.tsx`

```typescript
import { useState } from "react"
import { useNavigate } from "react-router-dom"

export function SignInPage() {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)

  const handleGoogleSignIn = () => {
    setIsLoading(true)

    // ЛОГИКА ИЗ YouTubeAnalytics:
    // Открываем popup для Google OAuth

    const width = 500
    const height = 600
    const left = window.screen.width / 2 - width / 2
    const top = window.screen.height / 2 - height / 2

    // Редиректим на backend endpoint
    // Backend автоматически редиректит на Google
    const popup = window.open(
      "http://localhost:7001/api/oauth/google?redirect_to=/playground",
      "google-signin",
      `width=${width},height=${height},left=${left},top=${top}`
    )

    // Fallback если popup заблокирован
    if (!popup) {
      window.location.href = "http://localhost:7001/api/oauth/google?redirect_to=/playground"
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <button
        onClick={handleGoogleSignIn}
        disabled={isLoading}
        className="px-4 py-2 bg-blue-500 text-white rounded"
      >
        Sign in with Google
      </button>
    </div>
  )
}
```

---

## 4. FRONTEND: КАК ОБРАБОТАТЬ CALLBACK

### Откуда берём (YouTubeAnalytics)

```typescript
// /src/app/auth-callback/page.tsx
useEffect(() => {
  if (error) {
    if (window.opener) {
      window.opener.postMessage(
        { type: "auth-error", error: error },
        window.location.origin
      );
      window.close();
    }
    return;
  }

  if (window.opener) {
    window.opener.postMessage(
      { type: "auth-success" },
      window.location.origin
    );
    window.close();
  }
}, [error]);
```

### Куда переносим (Screen2code React)

**Файл:** `/frontend/src/app/auth/callback/page.tsx`

```typescript
import { useEffect } from "react"
import { useSearchParams } from "react-router-dom"

export function AuthCallbackPage() {
  const [searchParams] = useSearchParams()
  const success = searchParams.get("success")
  const error = searchParams.get("error")
  const redirectTo = searchParams.get("redirect_to") || "/playground"

  useEffect(() => {
    // ЛОГИКА ИЗ YouTubeAnalytics:
    // Если в popup - посылаем message родителю и закрываем popup
    // Если ошибка - редиректим на error страницу

    if (error) {
      if (window.opener) {
        window.opener.postMessage(
          {
            type: "auth-error",
            error: error,
          },
          window.location.origin
        )
        window.close()
      } else {
        // Не в popup - просто редирект на error страницу
        window.location.href = "/auth/error"
      }
      return
    }

    if (success === "true") {
      if (window.opener) {
        // Сообщаем parent window что auth успешен
        window.opener.postMessage(
          {
            type: "auth-success",
            redirectTo: redirectTo,
          },
          window.location.origin
        )
        window.close()
      } else {
        // Не в popup - просто редирект
        window.location.href = redirectTo
      }
    }
  }, [success, error, redirectTo])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="spinner"></div>
        <p className="mt-4 text-gray-600">Завершаем вход...</p>
      </div>
    </div>
  )
}
```

---

## 5. FRONTEND: КАК ХРАНИТЬ И ПОЛУЧАТЬ SESSION

### Откуда берём (YouTubeAnalytics)

```typescript
// Используется NextAuth useSession hook
import { useSession } from "next-auth/react"

const { data: session } = useSession()
// session.user.id, session.user.email, session.user.role
```

### Куда переносим (Screen2code React + Zustand)

**Файл:** `/frontend/src/store/auth.ts`

```typescript
import { create } from "zustand"
import { persist } from "zustand/middleware"

export interface User {
  id: string
  email: string
  name: string
  role: "user" | "admin"
  plan: "free" | "basic" | "professional"
}

interface AuthStore {
  user: User | null
  isLoading: boolean
  error: string | null

  // Actions
  setUser: (user: User | null) => void
  checkAuth: () => Promise<void>
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      isLoading: true,
      error: null,

      setUser: (user) => set({ user, isLoading: false }),

      // ГЛАВНОЕ: Проверяем auth статус при загрузке App
      // Эквивалент: useSession() в YouTubeAnalytics
      checkAuth: async () => {
        try {
          set({ isLoading: true })

          // Делаем GET запрос к backend
          const response = await fetch("http://localhost:7001/api/auth/user", {
            credentials: "include", // Отправляем cookies
          })

          if (response.ok) {
            const user = await response.json()
            set({ user, isLoading: false, error: null })
          } else {
            set({ user: null, isLoading: false, error: null })
          }
        } catch (error) {
          set({ user: null, isLoading: false, error: String(error) })
        }
      },

      logout: async () => {
        try {
          await fetch("http://localhost:7001/api/auth/logout", {
            method: "POST",
            credentials: "include",
          })
        } catch (error) {
          console.error("Logout failed:", error)
        } finally {
          set({ user: null })
        }
      },
    }),
    {
      name: "auth-store",
    }
  )
)
```

### Использование в компонентах

```typescript
import { useAuthStore } from "@/store/auth"

export function Dashboard() {
  const { user, isLoading } = useAuthStore()

  if (isLoading) return <div>Loading...</div>
  if (!user) return <div>Not authenticated</div>

  return <div>Hello {user.name}! Your role: {user.role}</div>
}
```

---

## 6. FRONTEND: PROTECTED ROUTES

### Откуда берём (YouTubeAnalytics)

```typescript
// /src/middleware.ts - Next.js middleware
if (protectedRoutes.some(route => pathname.startsWith(route))) {
  const token = await getToken({ req: request })
  if (!token) {
    return NextResponse.redirect(new URL("/sign-in", request.url))
  }
}
```

### Куда переносим (Screen2code React Router)

**Файл:** `/frontend/src/components/protected-route.tsx`

```typescript
import { ReactNode } from "react"
import { Navigate } from "react-router-dom"
import { useAuthStore } from "@/store/auth"

interface ProtectedRouteProps {
  children: ReactNode
  requiredRole?: "user" | "admin"
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, isLoading } = useAuthStore()

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  if (!user) {
    return <Navigate to="/auth/sign-in" replace />
  }

  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/playground" replace />
  }

  return <>{children}</>
}
```

### Использование в маршрутах

```typescript
// /frontend/src/config/routes.tsx
import { ProtectedRoute } from "@/components/protected-route"

const routes = [
  {
    path: "/auth/sign-in",
    element: <SignInPage />,
  },
  {
    path: "/playground",
    element: (
      <ProtectedRoute>
        <PlaygroundPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/admin/messages",
    element: (
      <ProtectedRoute requiredRole="admin">
        <AdminMessagesPage />
      </ProtectedRoute>
    ),
  },
]
```

---

## 7. BACKEND: КАК ЗАЩИТИТЬ ENDPOINTS

### Откуда берём (YouTubeAnalytics)

```typescript
// /src/app/api/admin/users/route.ts
export async function GET(request: NextRequest) {
  const { isAdmin, response } = await verifyAdminAccess(request)
  if (!isAdmin) return response
}
```

### Куда переносим (Screen2code FastAPI)

**Файл:** `/backend/api/routes/admin.py`

```python
from fastapi import APIRouter, Depends, HTTPException
from api.oauth.config import ADMIN_EMAIL
from api.routes.auth import get_current_user

router = APIRouter(prefix="/api/admin", tags=["admin"])

def get_admin_user(current_user: dict = Depends(get_current_user)):
    """
    Проверяет что пользователь админ.

    Эквивалент: verifyAdminAccess() в YouTubeAnalytics
    """
    if current_user.get("email") != ADMIN_EMAIL:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


@router.get("/users")
async def get_users(admin: dict = Depends(get_admin_user)):
    """
    GET /api/admin/users

    Требует admin прав (проверяется через get_admin_user зависимость).
    """
    from db.app import get_conn

    conn = get_conn()
    cursor = conn.cursor()

    cursor.execute("SELECT id, email, name, role, plan FROM users ORDER BY createdAt DESC")
    users = cursor.fetchall()
    conn.close()

    return {
        "users": [
            {
                "id": u[0],
                "email": u[1],
                "name": u[2],
                "role": u[3],
                "plan": u[4],
            }
            for u in users
        ]
    }
```

---

## 8. ОБРАБОТКА COOKIE И CREDENTIALS

### Frontend должен отправлять cookies

```typescript
// ВАЖНО: Все fetch запросы должны включать credentials
fetch("http://localhost:7001/api/auth/user", {
  credentials: "include",  // ← ОБЯЗАТЕЛЬНО!
})

// Или если используешь axios:
axios.defaults.withCredentials = true
```

### Backend должен разрешить cookies с другого домена (CORS)

**Файл:** `/backend/main.py`

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Frontend URL
    allow_credentials=True,  # ← ОБЯЗАТЕЛЬНО для cookies!
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## РЕЗЮМЕ: ЛОГИКА ПЕРЕНОСИТСЯ 1-В-1

| Компонент | YouTubeAnalytics | Screen2code | Логика |
|-----------|-----------------|-------------|--------|
| User creation | `signIn callback в NextAuth` | `POST /api/oauth/google/callback` | ОДНА И ТА ЖЕ |
| Disabled check | `signIn callback` | `POST /api/oauth/google/callback` | ОДНА И ТА ЖЕ |
| JWT payload | `jwt callback` | `jwt.encode()` в FastAPI | ОДНА И ТА ЖЕ |
| Session storage | `HttpOnly cookies` | `HttpOnly cookies` | ОДНА И ТА ЖЕ |
| Get current user | `getServerSession()` | `Depends(get_current_user)` | ОДНА И ТА ЖЕ |
| Admin check | `ADMIN_EMAIL compare` | `ADMIN_EMAIL compare` | ОДНА И ТА ЖЕ |
| Logout | `signOut()` | `DELETE /api/auth/logout` | ОДНА И ТА ЖЕ |

---

## МИНИМАЛЬНЫЕ РАЗЛИЧИЯ

1. **HTTP вместо тесных интеграций** — HTTP запросы между frontend и backend
2. **Zustand вместо NextAuth hook** — state management на frontend
3. **React Router вместо Next.js middleware** — protection маршрутов
4. **FastAPI вместо NextAuth** — OAuth обработка
5. **Все остальное — копируем из YouTubeAnalytics БЕЗ ИЗМЕНЕНИЙ**
