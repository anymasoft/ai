# Testing Auth System

## Backend Setup

Make sure backend is running on port 7001:
```bash
cd backend
python start.py
```

## Test /api/auth/me Endpoint

```bash
# Create a new user by accessing /api/auth/me with X-User-Email header
curl -X GET http://localhost:7001/api/auth/me \
  -H "X-User-Email: test@example.com"

# Expected response:
# {
#   "id": "...",
#   "email": "test@example.com",
#   "role": "user",
#   "plan_id": "free"
# }
```

## Frontend Flow

1. User goes to http://localhost:5173/auth/sign-in
2. Enters email: `test@example.com`
3. Enters password: (any value, not validated)
4. Clicks "Login"
5. Frontend:
   - Sets email in Zustand store
   - Calls `GET /api/auth/me` with `X-User-Email: test@example.com`
   - Backend creates user if not exists
   - Sets role in Zustand store
   - Redirects to `/app/playground`
6. User appears in sidebar with email and username (before @)

## Admin Access

To make user admin:
```bash
sqlite3 backend/data/app.db "UPDATE users SET role='admin' WHERE email='test@example.com'"
```

Now user will see Admin section in sidebar:
- Messages (with unread count badge)
- Users
- Payments

Without admin role:
- Admin section is completely hidden
- No polling for unread count
- API requests return 403 Forbidden

## Database

Check users table:
```bash
sqlite3 backend/data/app.db "SELECT id, email, role, plan_id FROM users;"
```
