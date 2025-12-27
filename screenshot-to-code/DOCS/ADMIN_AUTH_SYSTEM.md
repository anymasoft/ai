# Admin Access Control System

## Architecture

```
Frontend (X-User-Email header)
         ↓
get_current_user()
  - reads X-User-Email from headers
  - creates user if not exists (role='user')
  - returns user dict with email, role
         ↓
Admin routes: /api/admin/*
  - require Depends(get_admin_user)
  - get_admin_user checks role='admin'
  - if role != 'admin' → 403 Forbidden
  - if role == 'admin' → access allowed
         ↓
Log: [ADMIN_AUTH] email={}, role={}
```

## File Locations

### Core Auth
- `backend/api/user_auth.py` - `get_current_user()` dependency
  - Reads X-User-Email header
  - Creates user if not exists
  - Returns user dict

- `backend/api/admin_auth.py` - `get_admin_user()` dependency
  - Uses get_current_user()
  - Checks role == 'admin'
  - Logs: db_path, email, role
  - Raises 403 if not admin

### Admin Routes (all use Depends(get_admin_user))
- `backend/api/routes/admin/messages.py`
  - GET /api/admin/messages
  - GET /api/admin/messages/{id}
  - PATCH /api/admin/messages/{id}/read
  - DELETE /api/admin/messages/{id}
  - GET /api/admin/messages/unread-count

- `backend/api/routes/admin/users.py`
  - GET /api/admin/users
  - POST /api/admin/users/change-plan
  - PATCH /api/admin/users/disable

- `backend/api/routes/admin/payments.py`
  - GET /api/admin/payments

## How It Works

1. **User signs in**
   - Frontend: email → auth store
   - Every request: X-User-Email: email header

2. **User accesses /admin/messages**
   - Frontend calls: GET /api/admin/messages
   - Header: X-User-Email: test@example.com

3. **Backend processes request**
   - get_admin_user() is called (Depends)
   - Calls get_current_user(x_user_email="test@example.com")
   - Reads from X-User-Email header ONLY
   - Checks app.db for user
   - If not exists: creates with role='user'
   - If exists: returns user data (including role)
   - Checks: if user.role != 'admin' → 403
   - Logs: [ADMIN_AUTH] db_path=..., email=test@example.com, role=user

4. **Result**
   - If role='admin': returns data (200)
   - If role='user': 403 Forbidden

## Database Setup

Make user an admin:
```bash
sqlite3 backend/data/app.db "UPDATE users SET role='admin' WHERE email='test@example.com';"
```

Check user role:
```bash
sqlite3 backend/data/app.db "SELECT email, role FROM users WHERE email='test@example.com';"
```

## Testing

1. Start backend:
```bash
cd backend
python start.py
```

2. Check logs for backend startup:
```
[APP] Starting application...
```

3. Open frontend: http://localhost:5173

4. Sign in as: test@example.com (password: anything)

5. Check backend logs - should see:
```
[USER_AUTH] Created new user: test@example.com (id=...)
```

6. Try to access admin panel: http://localhost:5173/admin/messages

7. Backend should log:
```
[ADMIN_AUTH] Checking admin access - db_path=..., email=test@example.com, role=user
```

8. Frontend should show 403 error

9. Make user admin in database:
```bash
sqlite3 backend/data/app.db "UPDATE users SET role='admin' WHERE email='test@example.com';"
```

10. Refresh admin panel in frontend

11. Backend should log:
```
[ADMIN_AUTH] Checking admin access - db_path=..., email=test@example.com, role=admin
```

12. Frontend should show admin panel with messages list

## Key Points

- **NO /api/auth/me endpoint** - deleted
- **X-User-Email ONLY** - no cookies, no JWT, no OAuth
- **Auto-create users** - first request creates user with role='user'
- **Role manual** - only way to set role='admin' is direct DB edit
- **All admin routes protected** - every /api/admin/* requires role='admin'
- **Comprehensive logging** - [ADMIN_AUTH] logs show email and role for debugging
