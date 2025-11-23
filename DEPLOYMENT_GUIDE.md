## DEPLOYMENT GUIDE - Plan Expiration & Webhook Protection

------------------------------
### DIFF FOR SERVER_TEMPLATE.py
------------------------------

```diff
--- a/auth-system/SERVER_TEMPLATE.py
+++ b/auth-system/SERVER_TEMPLATE.py

@@ -177,6 +177,12 @@ def init_db():
     cursor.execute('''
         CREATE INDEX IF NOT EXISTS idx_token
         ON users(token)
     ''')
+
+    # Add plan_expires_at column if it doesn't exist
+    cursor.execute("PRAGMA table_info(users)")
+    columns = [col[1] for col in cursor.fetchall()]
+    if 'plan_expires_at' not in columns:
+        cursor.execute('ALTER TABLE users ADD COLUMN plan_expires_at INTEGER')

@@ -260,17 +266,28 @@ def create_or_update_user(email, plan='Free'):

 def get_user_by_token(token):
     """Получает данные пользователя по токену"""
+    import time
     conn = sqlite3.connect(USERS_DB)
     cursor = conn.cursor()

     cursor.execute('''
-        SELECT email, plan
+        SELECT email, plan, plan_expires_at
         FROM users
         WHERE token = ?
     ''', (token,))

     result = cursor.fetchone()
-    conn.close()

     if result:
-        return {'email': result[0], 'plan': result[1]}
+        email, plan, plan_expires_at = result[0], result[1], result[2]
+
+        # Auto-reset expired plans
+        if plan != 'Free' and plan_expires_at is not None:
+            current_time = int(time.time())
+            if current_time > plan_expires_at:
+                cursor.execute('UPDATE users SET plan = ?, plan_expires_at = NULL WHERE email = ?', ('Free', email))
+                conn.commit()
+                plan = 'Free'
+
+        conn.close()
+        return {'email': email, 'plan': plan}
+
+    conn.close()
     return None

@@ -1035,6 +1054,7 @@ def payment_webhook():

             if email and plan and plan in ['Pro', 'Premium']:
                 # Обновляем план пользователя в БД
+                import time
                 conn = sqlite3.connect(USERS_DB)
                 cursor = conn.cursor()

@@ -1042,17 +1062,27 @@ def payment_webhook():
                 cursor.execute('SELECT email, plan FROM users WHERE email = ?', (email,))
                 user_before = cursor.fetchone()
                 print(f"[WEBHOOK] Пользователь ДО обновления: {user_before}")

-                cursor.execute('UPDATE users SET plan = ? WHERE email = ?', (plan, email))
+                # Set plan expiration: current time + 30 days
+                plan_expires_at = int(time.time()) + (30 * 24 * 60 * 60)
+                cursor.execute('UPDATE users SET plan = ?, plan_expires_at = ? WHERE email = ?', (plan, plan_expires_at, email))
                 updated_rows = cursor.rowcount

                 # Записываем платёж в историю payments
                 payment_id = payment_info.get('id', '')
                 status = payment_info.get('status', 'succeeded')
                 raw_data = json.dumps(payment_info)

-                cursor.execute('''
-                    INSERT INTO payments (email, plan, payment_id, status, raw)
-                    VALUES (?, ?, ?, ?, ?)
-                ''', (email, plan, payment_id, status, raw_data))
+                # Protection from duplicate webhooks
+                cursor.execute('SELECT COUNT(*) FROM payments WHERE payment_id = ?', (payment_id,))
+                exists = cursor.fetchone()[0] > 0
+
+                if not exists:
+                    cursor.execute('''
+                        INSERT INTO payments (email, plan, payment_id, status, raw)
+                        VALUES (?, ?, ?, ?, ?)
+                    ''', (email, plan, payment_id, status, raw_data))
+                else:
+                    print(f"[WEBHOOK] ⚠️ Duplicate payment_id: {payment_id}, skipping INSERT")

                 conn.commit()

@@ -1109,6 +1138,7 @@ def payment_success():

                 if payment_status == 'succeeded':
                     # Платёж успешен - обновляем план в БД
+                    import time
                     conn = sqlite3.connect(USERS_DB)
                     cursor = conn.cursor()

@@ -1116,7 +1146,9 @@ def payment_success():
                     user_before = cursor.fetchone()
                     print(f"[PAYMENT-SUCCESS] Пользователь ДО: {user_before}")

-                    cursor.execute('UPDATE users SET plan = ? WHERE email = ?', (plan, email))
+                    # Set plan expiration: current time + 30 days
+                    plan_expires_at = int(time.time()) + (30 * 24 * 60 * 60)
+                    cursor.execute('UPDATE users SET plan = ?, plan_expires_at = ? WHERE email = ?', (plan, plan_expires_at, email))
                     updated_rows = cursor.rowcount
                     conn.commit()

@@ -1258,19 +1290,28 @@ def admin_users():

     # Получаем пользователей с пагинацией
     cursor.execute('''
-        SELECT email, plan, created_at
+        SELECT email, plan, created_at, plan_expires_at
         FROM users
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?
     ''', (per_page, offset))

+    import time
+    current_time = int(time.time())
     users = []
     for row in cursor.fetchall():
-        users.append({
-            'email': row[0],
-            'plan': row[1],
-            'created_at': row[2]
+        email, plan, created_at, plan_expires_at = row[0], row[1], row[2], row[3]
+        is_expired = (plan != 'Free' and plan_expires_at is not None and current_time > plan_expires_at)
+        users.append({
+            'email': email,
+            'plan': plan,
+            'created_at': created_at,
+            'plan_expires_at': plan_expires_at,
+            'isExpired': is_expired
         })

     conn.close()
```

------------------------------
### DIFF FOR admin.js
------------------------------

```diff
--- a/auth-system/admin/admin.js
+++ b/auth-system/admin/admin.js

@@ -133,7 +133,7 @@ function renderUsersTable(users) {
     users.forEach(user => {
         const tr = document.createElement('tr');
         tr.innerHTML = `
             <td class="px-6 py-4 text-sm font-medium text-gray-900">${user.email}</td>
-            <td class="px-6 py-4 text-sm"><span class="plan-badge ${user.plan.toLowerCase()}">${user.plan}</span></td>
+            <td class="px-6 py-4 text-sm"><span class="plan-badge ${user.plan.toLowerCase()}">${user.plan}${user.isExpired ? ' (expired)' : ''}</span></td>
             <td class="px-6 py-4 text-sm text-gray-600">${formatDate(user.created_at)}</td>
             <td class="px-6 py-4 text-sm">
                 <select
```

------------------------------
### SQLITE MIGRATION
------------------------------

**Option 1: Manual check before migration**

```sql
-- Check if column exists first
SELECT COUNT(*) AS column_exists
FROM pragma_table_info('users')
WHERE name='plan_expires_at';

-- If result is 0, run this:
ALTER TABLE users ADD COLUMN plan_expires_at INTEGER;
```

**Option 2: Safe migration script (Python)**

```python
import sqlite3

conn = sqlite3.connect('auth-system/users.db')
cursor = conn.cursor()

# Check if column exists
cursor.execute("PRAGMA table_info(users)")
columns = [col[1] for col in cursor.fetchall()]

if 'plan_expires_at' not in columns:
    cursor.execute('ALTER TABLE users ADD COLUMN plan_expires_at INTEGER')
    print("✅ Column 'plan_expires_at' added successfully")
else:
    print("ℹ️ Column 'plan_expires_at' already exists, skipping")

conn.commit()
conn.close()
```

**Option 3: Direct SQL (fails if column exists)**

```sql
ALTER TABLE users ADD COLUMN plan_expires_at INTEGER;
```

------------------------------
### DEPLOYMENT STEPS
------------------------------

**1. Backup databases:**
```bash
cd /home/user/ai/auth-system
cp users.db users.db.backup
cp translations.db translations.db.backup
```

**2. Apply database migration:**
```bash
# Using Python script (recommended):
python3 -c "
import sqlite3
conn = sqlite3.connect('users.db')
cursor = conn.cursor()
cursor.execute('PRAGMA table_info(users)')
columns = [col[1] for col in cursor.fetchall()]
if 'plan_expires_at' not in columns:
    cursor.execute('ALTER TABLE users ADD COLUMN plan_expires_at INTEGER')
    print('✅ Migration applied')
else:
    print('ℹ️ Already migrated')
conn.commit()
conn.close()
"
```

**3. Restart the Flask server:**
```bash
# If using systemd:
sudo systemctl restart video-reader-api

# If using supervisor:
sudo supervisorctl restart video-reader-api

# If running manually:
pkill -f SERVER_TEMPLATE.py
cd /home/user/ai/auth-system
python3 SERVER_TEMPLATE.py &
```

**4. Verify deployment:**
```bash
# Check server logs for errors:
tail -f /var/log/video-reader-api.log

# Test webhook endpoint:
curl -X POST https://api.beem.ink/payment-webhook \
  -H "Content-Type: application/json" \
  -d '{"event":"payment.succeeded","object":{"metadata":{"email":"test@test.com","plan":"Pro"},"id":"test_payment_id","status":"succeeded"}}'

# Check admin panel:
# Visit https://api.beem.ink/admin and verify users table shows expiration info
```

**5. Monitor for issues:**
```bash
# Watch for webhook logs:
grep "WEBHOOK" /var/log/video-reader-api.log | tail -20

# Check for duplicate protection:
grep "Duplicate payment_id" /var/log/video-reader-api.log
```

------------------------------
### TESTING CHECKLIST
------------------------------

- [ ] Database migration successful (no errors)
- [ ] Server restarts without errors
- [ ] New payments set plan_expires_at (check database)
- [ ] Duplicate webhooks are blocked (check logs)
- [ ] Admin panel shows plan_expires_at field
- [ ] Admin panel shows "(expired)" for expired plans
- [ ] Expired plans auto-reset to Free on next API call
- [ ] No regression in existing payment flow

------------------------------
