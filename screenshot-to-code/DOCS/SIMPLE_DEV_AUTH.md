# Simple Dev Auth System

## Overview

Простая система аутентификации для разработки Screen2code БЕЗ OAuth, API keys или усложненной логики.

## How It Works

### Frontend (Client)

1. **Login** → User enters email at `/auth/sign-in`
2. **Store** → Email saved in Zustand auth store (localStorage)
3. **API Calls** → All requests automatically add `X-User-Email: <email>` header
4. **Sidebar** → Displays user email in avatar dropdown

### Backend (Server)

1. **Middleware** → `get_current_user()` dependency reads `X-User-Email` header
2. **DB Check** → Looks up user in `users` table by email
3. **Auto-Create** → If user doesn't exist, creates with `role='user'`
4. **Admin Check** → `get_admin_user()` dependency checks if `role='admin'`

## Usage

### Sign In

```
1. Go to http://localhost:5173/auth/sign-in
2. Enter any email (password ignored)
3. Click "Login"
4. Redirected to /app/playground
5. Email appears in sidebar avatar
```

### API Requests

All requests automatically include the header:
```
X-User-Email: user@example.com
```

No other configuration needed.

### Admin Access

**Default:** Users get `role='user'`

**To make user admin:**
```sql
UPDATE users SET role='admin' WHERE email='admin@example.com'
```

Then that user can access:
- `/admin/messages`
- `/admin/users`
- `/admin/payments`

If user tries to access admin pages without `role='admin'`:
- Frontend: Redirects to `/playground` on 403
- Backend: Returns 403 Forbidden

### Logout

Click avatar → "Log out" button
- Clears email from store
- Removes X-User-Email header from subsequent requests
- Redirects to `/auth/sign-in`

## Database

### users table

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'user',  -- 'user' or 'admin'
  plan_id TEXT DEFAULT 'free',
  created_at TEXT,
  ...
)
```

**Auto-created on first login** if doesn't exist.

## Logging

### Admin Requests

Each admin request logs:
```
[ADMIN_AUTH] Checking admin access - db_path=/path/to/app.db, email=user@example.com, role=user
```

### User Creation

```
[USER_AUTH] Created new user: user@example.com (id=abc123...)
```

## No:

- ✗ OAuth
- ✗ JWT / Tokens
- ✗ Cookies / Sessions
- ✗ Password validation
- ✗ X-Admin-Email header (old, removed)
- ✗ Extra tables

## Files

### Frontend

- `frontend/src/store/auth.ts` - Zustand store for email
- `frontend/src/app/auth/sign-in/components/login-form-1.tsx` - Login form
- `frontend/src/lib/api.ts` - API utility with X-User-Email header
- `frontend/src/components/app-sidebar.tsx` - Shows email in sidebar
- `frontend/src/components/nav-user.tsx` - User menu with logout

### Backend

- `backend/api/user_auth.py` - User auth dependency + auto-create
- `backend/api/admin_auth.py` - Admin auth dependency (uses get_current_user)
- `backend/api/routes/admin/*.py` - Admin endpoints with get_admin_user

## Testing

```bash
# 1. Sign in as user@example.com
curl -X POST http://localhost:5173/auth/sign-in \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"anything"}'

# 2. Make admin request (will get 403)
curl http://localhost:7001/api/admin/users \
  -H "X-User-Email: user@example.com"

# 3. Update role in DB
sqlite3 backend/data/app.db "UPDATE users SET role='admin' WHERE email='user@example.com'"

# 4. Try again (should work)
curl http://localhost:7001/api/admin/users \
  -H "X-User-Email: user@example.com"
```

## Development

- No auth system to maintain
- Email is single source of truth
- All requests traceable by email
- Role can be changed in DB instantly
- No sessions to manage
- No tokens to refresh
