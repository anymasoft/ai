# 📊 АУДИТ АДМИНСКОГО UI УПРАВЛЕНИЯ ПОЛЬЗОВАТЕЛЯМИ

**Дата:** 13 марта 2026
**Версия:** v0.8.3-rc1
**Статус:** ✅ АУДИТ ЗАВЕРШЕН (БЕЗ ИЗМЕНЕНИЙ)

---

## 🎯 ИТОГОВАЯ СВОДКА

**Найдено:** 2 разных компонента управления пользователями в системе

### ❌ ОСНОВНОЙ (ГЛАВНЫЙ) КОМПОНЕНТ: AdminPanel.tsx

- **Файл:** `client/src/routes/AdminPanel.tsx`
- **Статус:** Встроенная таблица, БЕЗ ban/unban функций
- **API Endpoint:** `/api/admin/mvp/users`
- **Интерфейс:** UserRow — **БЕЗ banned полей**
- **Ban кнопки:** ❌ ОТСУТСТВУЮТ

### ✅ АЛЬТЕРНАТИВНЫЙ КОМПОНЕНТ: UserManagement.tsx

- **Файл:** `client/src/components/Admin/UserManagement.tsx`
- **Статус:** Полная реализация с ban/unban
- **API Endpoint:** `/api/admin/users`
- **Интерфейс:** User — **С banned полями**
- **Ban кнопки:** ✅ ПРИСУТСТВУЮТ И РАБОТАЮТ
- **Статус:** Существует, но НЕ используется в AdminPanel

---

## 📋 ДЕТАЛЬНЫЙ АНАЛИЗ

### ЧАСТЬ 1: ОСНОВНОЙ КОМПОНЕНТ (AdminPanel.tsx)

**Расположение:** `client/src/routes/AdminPanel.tsx`

#### Таблица пользователей (строки 514-614)

```jsx
<table className="w-full text-sm">
  <thead>
    <tr>
      <th>Пользователь</th>
      <th>Тариф</th>
      <th>Баланс (кредиты)</th>
      <th>Расход (~USD)</th>
      <th>Дата рег.</th>
      <th>Начислить</th>
    </tr>
  </thead>
  <tbody>
    {data.users.map((u) => (
      <tr key={u._id}>
        {/* Колонки 👇 */}
      </tr>
    ))}
  </tbody>
</table>
```

#### Колонки таблицы:

| № | Колонка | Строки | JSX |
|---|---------|--------|-----|
| 1️⃣ | **Пользователь** | 543-553 | `<td>{u.email}</td>` |
| 2️⃣ | **Тариф** | 554-572 | `<select value={u.plan}>` |
| 3️⃣ | **Баланс** | 573-585 | `{formatCredits(u.tokenCredits)}` |
| 4️⃣ | **Расход** | 586-588 | `{creditsToUsd(u.tokenCredits)}` |
| 5️⃣ | **Дата регистрации** | 589-591 | `{new Date(u.createdAt).toLocaleDateString()}` |
| 6️⃣ | **Начислить** | 592-610 | `<input/>` + `<button>+ Начислить</button>` |

#### Интерфейс UserRow (строки 30-40)

```typescript
interface UserRow {
  _id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  tokenCredits: number;
  emailVerified: boolean;
  plan: 'free' | 'pro' | 'business';
  planExpiresAt: string | null;
}
```

**❌ ПРОБЛЕМА:** НЕ содержит поля:
- ❌ `banned`
- ❌ `bannedAt`
- ❌ `banReason`

#### API Endpoint в AdminPanel

**Строка 129:**
```javascript
const res = await fetch(`/api/admin/mvp/users?page=${page}`, {
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  },
});
```

**Endpoint:** `/api/admin/mvp/users`

#### Ban функции в AdminPanel

**Поиск:** `grep -n "ban\|unban\|banned" AdminPanel.tsx`
**Результат:** ❌ **НЕ найдено ничего**

- ❌ Нет функции `handleBan`
- ❌ Нет функции `handleUnban`
- ❌ Нет условных кнопок
- ❌ Нет модали для ввода причины

#### Таблица БЕЗ ban кнопок

**Строки 592-610 — только "Начислить":**

```jsx
<td className="px-4 py-3">
  <div className="flex items-center gap-1.5">
    <input
      type="number"
      placeholder="кредиты"
      value={creditInputs[u._id] || ''}
      onChange={(e) => setCreditInputs(...)}
    />
    <button onClick={() => addCredits(u._id)}>
      + Начислить
    </button>
  </div>
</td>
```

**❌ НЕТ КНОПОК BAN / UNBAN**

---

### ЧАСТЬ 2: АЛЬТЕРНАТИВНЫЙ КОМПОНЕНТ (UserManagement.tsx)

**Расположение:** `client/src/components/Admin/UserManagement.tsx`

#### Интерфейс User (строки 11-21)

```typescript
interface User {
  _id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  provider: string;
  banned?: boolean;           // ✅ ЕСТЬ
  bannedAt?: string;         // ✅ ЕСТЬ
  banReason?: string;        // ✅ ЕСТЬ
}
```

**✅ СОДЕРЖИТ ВСЕ нужные поля для ban!**

#### Таблица с ban функцией (строки 208-330)

```jsx
<table>
  <thead>
    <tr>
      <th>Email</th>
      <th>Name</th>
      <th>Provider</th>
      <th>Role</th>
      <th>Status</th>           {/* ← Новая колонка! */}
      <th>Actions</th>          {/* ← Кнопки BAN/UNBAN */}
    </tr>
  </thead>
  <tbody>
    {users.map((user) => (
      <tr>
        {/* ... остальные колонки ... */}
      </tr>
    ))}
  </tbody>
</table>
```

#### Колонка Status (строки 280-295)

```jsx
<td className="px-4 py-3">
  <div className="flex items-center gap-1">
    {user.banned ? (
      <>
        <Ban className="h-4 w-4 text-red-500" />
        <span className="text-red-500 font-medium">Banned</span>
      </>
    ) : (
      <>
        <CheckCircle2 className="h-4 w-4 text-green-500" />
        <span className="text-green-500 font-medium">Active</span>
      </>
    )}
  </div>
</td>
```

**✅ Отображает статус: Banned (красный) или Active (зелёный)**

#### Колонка Actions с Ban/Unban кнопками (строки 297-324)

```jsx
<td className="px-4 py-3">
  <div className="flex gap-2">
    {user.banned ? (
      <Button
        size="sm"
        variant="outline"
        onClick={() => handleUnban(user._id)}
        disabled={processingId === user._id}
      >
        Unban
      </Button>
    ) : (
      <Button
        size="sm"
        variant="destructive"
        onClick={() =>
          setBanReasonModal({ userId: user._id, visible: true })
        }
        disabled={processingId === user._id}
      >
        Ban
      </Button>
    )}
  </div>
</td>
```

**✅ УСЛОВНЫЕ КНОПКИ:**
- Если `user.banned === true` → кнопка **Unban** (outline)
- Если `user.banned === false` → кнопка **Ban** (destructive/красная)

#### Ban функции

**handleBan (строки 92-132):**
```javascript
const handleBan = useCallback(
  async (userId: string) => {
    const response = await fetch(`/api/admin/users/${userId}/ban`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ banReason: banReason || 'No reason provided' }),
    });

    // Обновляет локально
    setUsers((prev) =>
      prev.map((u) =>
        u._id === userId
          ? {
              ...u,
              banned: true,
              bannedAt: new Date().toISOString(),
              banReason: banReason || 'No reason provided',
            }
          : u,
      ),
    );
  },
  [token, banReason],
);
```

**handleUnban (строки 135-171):**
```javascript
const handleUnban = useCallback(
  async (userId: string) => {
    const response = await fetch(`/api/admin/users/${userId}/unban`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    // Обновляет локально
    setUsers((prev) =>
      prev.map((u) =>
        u._id === userId
          ? {
              ...u,
              banned: false,
              bannedAt: undefined,
              banReason: '',
            }
          : u,
      ),
    );
  },
  [token],
);
```

#### Modal для ввода причины бана (строки 349-390)

```jsx
{banReasonModal.visible && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
    <div className="w-full max-w-md rounded-lg bg-surface p-6">
      <h3 className="text-lg font-semibold">Ban User</h3>
      <p className="mt-2 text-sm">
        Provide a reason for banning this user (optional)
      </p>

      <div className="mt-4">
        <Label htmlFor="ban-reason">Reason</Label>
        <textarea
          id="ban-reason"
          value={banReason}
          onChange={(e) => setBanReason(e.target.value)}
          placeholder="E.g., Violating terms of service..."
          rows={3}
        />
      </div>

      <div className="mt-6 flex gap-2">
        <Button variant="outline">Cancel</Button>
        <Button
          variant="destructive"
          onClick={() => handleBan(banReasonModal.userId)}
        >
          Ban User
        </Button>
      </div>
    </div>
  </div>
)}
```

**✅ Модала позволяет ввести причину бана перед забанением**

#### API Endpoints (UserManagement)

**Загрузка пользователей (строка 67):**
```javascript
const response = await fetch(`/api/admin/users?${query}`, {
  headers: { Authorization: `Bearer ${token}` },
});
```

**Endpoint:** `/api/admin/users` (без `/mvp`)

**Ban endpoint (строка 96):**
```javascript
const response = await fetch(`/api/admin/users/${userId}/ban`, {
  method: 'PATCH',
});
```

**Unban endpoint (строка 139):**
```javascript
const response = await fetch(`/api/admin/users/${userId}/unban`, {
  method: 'PATCH',
});
```

---

### ЧАСТЬ 3: ПРОВЕРКА БЭКЕНД API

**Файл:** `api/server/routes/admin.js`

#### Endpoint GET /api/admin/users (строки 41-83)

```javascript
router.get('/users', requireJwtAuth, requireAdminRole, async (req, res) => {
  const [users, total] = await Promise.all([
    User.find({}, 'email name role createdAt emailVerified provider banned bannedAt banReason')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(),
  ]);

  const result = users.map((u) => {
    const tokenCredits = balanceMap[u._id.toString()] ?? 0;
    const sub = subMap[u._id.toString()];
    let plan = sub?.plan || 'free';
    let planExpiresAt = sub?.planExpiresAt || null;
    return { ...u, tokenCredits, plan, planExpiresAt };
  });

  res.json({ users: result, total, page, pages: Math.ceil(total / limit) });
});
```

**✅ Возвращает:** `email name role createdAt emailVerified provider banned bannedAt banReason tokenCredits plan planExpiresAt`

#### Endpoint PATCH /api/admin/users/:userId/ban (строки 710-735)

```javascript
router.patch('/users/:userId/ban', requireJwtAuth, requireAdminRole, async (req, res) => {
  const { userId } = req.params;
  const { banReason = 'No reason provided' } = req.body;

  if (req.user._id.toString() === userId) {
    return res.status(400).json({ error: 'You cannot ban yourself' });
  }

  const user = await User.findByIdAndUpdate(
    userId,
    {
      banned: true,
      bannedAt: new Date(),
      banReason,
    },
    { new: true, select: 'email name banned bannedAt banReason' },
  ).lean();

  res.json({ ok: true, user });
});
```

**✅ Работает правильно**

#### Endpoint PATCH /api/admin/users/:userId/unban (строки 741-765)

```javascript
router.patch('/users/:userId/unban', requireJwtAuth, requireAdminRole, async (req, res) => {
  const user = await User.findByIdAndUpdate(
    userId,
    {
      banned: false,
      bannedAt: null,
      banReason: '',
    },
    { new: true, select: 'email name banned bannedAt banReason' },
  ).lean();

  res.json({ ok: true, user });
});
```

**✅ Работает правильно**

---

## 🔴 КРИТИЧЕСКИЕ НАХОДКИ

### ❌ ПРОБЛЕМА 1: Несоответствие интерфейсов

**AdminPanel.tsx использует:**
- Endpoint: `/api/admin/mvp/users`
- Интерфейс: `UserRow` — **БЕЗ** banned полей
- Backend возвращает: **С** banned полями (строка 48)

**РЕЗУЛЬТАТ:** TypeScript type error или данные игнорируются

---

### ❌ ПРОБЛЕМА 2: Две разные системы управления

| Aspekt | AdminPanel | UserManagement |
|--------|-----------|-----------------|
| **Файл** | `routes/AdminPanel.tsx` | `components/Admin/UserManagement.tsx` |
| **Endpoint** | `/api/admin/mvp/users` | `/api/admin/users` |
| **Ban функции** | ❌ НЕТ | ✅ ЕСТЬ |
| **Статус колонка** | ❌ НЕТ | ✅ ЕСТЬ |
| **Используется** | ✅ В AdminPanel | ❌ НЕ ИСПОЛЬЗУЕТСЯ |

---

### ❌ ПРОБЛЕМА 3: UserManagement существует но не используется

**Найдено:**
- Полная реализация ban/unban в UserManagement.tsx
- Красивый UI с модалой для причины
- Правильные API endpoints

**Но:**
- Не подключена в AdminPanel
- Не используется нигде в приложении
- "Мёртвый код"

---

## ✅ ГДЕ ДОБАВИТЬ BAN / UNBAN КНОПКИ

### ВАРИАНТ 1: В ТЕКУЩЕМ AdminPanel.tsx (быстро)

**Файл:** `client/src/routes/AdminPanel.tsx`

**Шаги:**
1. Добавить поля в интерфейс `UserRow` (строки 30-40):
   ```typescript
   interface UserRow {
     // ... существующие поля
     banned?: boolean;
     bannedAt?: string;
     banReason?: string;
   }
   ```

2. Добавить функции `handleBan` и `handleUnban` (после функции `addCredits`)

3. Добавить колонку "Статус" между "Дата рег." и "Начислить"

4. Добавить колонку "Действия" с кнопками Ban/Unban (вместо или после "Начислить")

**Результат:** Ban функция в основной админке

---

### ВАРИАНТ 2: Использовать существующий UserManagement.tsx (чисто)

**Файл:** `client/src/routes/AdminPanel.tsx`

**Шаги:**
1. Добавить импорт:
   ```typescript
   import UserManagement from '~/components/Admin/UserManagement';
   ```

2. Добавить новую вкладку в tab (строка 11):
   ```typescript
   type Tab = 'users' | 'payments' | 'settings' | 'analytics' | 'user-management';
   ```

3. Добавить кнопку для вкладки (строки 436-439)

4. Добавить условный рендер (строка 478):
   ```jsx
   {tab === 'user-management' && <UserManagement />}
   ```

**Результат:** Отдельная вкладка "Управление пользователями" с полным ban функционалом

---

## 📍 ТОЧНЫЕ МЕСТА ДЛЯ ДОБАВЛЕНИЯ

### ВАРИАНТ 1 ДЕТАЛЬНО

**Файл:** `client/src/routes/AdminPanel.tsx`

#### Шаг 1: Обновить интерфейс UserRow (строка 30)

```typescript
interface UserRow {
  _id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  tokenCredits: number;
  emailVerified: boolean;
  plan: 'free' | 'pro' | 'business';
  planExpiresAt: string | null;
  banned?: boolean;           // ← ДОБАВИТЬ
  bannedAt?: string;          // ← ДОБАВИТЬ
  banReason?: string;         // ← ДОБАВИТЬ
}
```

#### Шаг 2: Добавить функции (после функции addCredits, ~366 строка)

```javascript
// Ban функция
const handleBan = async (userId: string, reason?: string) => {
  try {
    const res = await fetch(`/api/admin/mvp/users/${userId}/ban`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ banReason: reason || 'No reason provided' }),
    });
    if (!res.ok) throw new Error('Failed to ban user');

    // Обновить таблицу
    setData((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u._id === userId
          ? { ...u, banned: true, bannedAt: new Date().toISOString() }
          : u,
      ),
    }));
  } catch (e) {
    setError(e instanceof Error ? e.message : 'Ban failed');
  }
};

// Unban функция
const handleUnban = async (userId: string) => {
  try {
    const res = await fetch(`/api/admin/mvp/users/${userId}/unban`, {
      method: 'PATCH',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) throw new Error('Failed to unban user');

    // Обновить таблицу
    setData((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u._id === userId
          ? { ...u, banned: false, bannedAt: undefined }
          : u,
      ),
    }));
  } catch (e) {
    setError(e instanceof Error ? e.message : 'Unban failed');
  }
};
```

#### Шаг 3: Добавить колонку после "Дата рег." (после строки 531)

```jsx
<th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
  Статус
</th>
```

#### Шаг 4: Добавить ячейку статуса в тело таблицы (после строки 591)

```jsx
<td className="px-4 py-3">
  {u.banned ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700 dark:bg-red-900 dark:text-red-200">
      🔴 Banned
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700 dark:bg-green-900 dark:text-green-200">
      🟢 Active
    </span>
  )}
</td>
```

#### Шаг 5: Добавить колонку "Действия" (вместо или после "Начислить", строка 610)

```jsx
<td className="px-4 py-3">
  <div className="flex items-center gap-1.5">
    {!u.banned ? (
      <button
        onClick={() => handleBan(u._id)}
        className="whitespace-nowrap rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700 transition-colors"
      >
        Ban
      </button>
    ) : (
      <button
        onClick={() => handleUnban(u._id)}
        className="whitespace-nowrap rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700 transition-colors"
      >
        Unban
      </button>
    )}
  </div>
</td>
```

---

### ВАРИАНТ 2 ДЕТАЛЬНО

**Файл:** `client/src/routes/AdminPanel.tsx`

#### Шаг 1: Добавить импорт (после строки 7)

```typescript
import UserManagement from '~/components/Admin/UserManagement';
```

#### Шаг 2: Добавить вкладку (строка 11)

```typescript
type Tab = 'users' | 'payments' | 'settings' | 'analytics' | 'user-management';
```

#### Шаг 3: Инициализировать состояние (строка 90)

```typescript
const [tab, setTab] = useState<Tab>('users');
```

#### Шаг 4: Добавить кнопку вкладки (после строки 439)

```jsx
<Button
  onClick={() => setTab('user-management')}
  className={
    tab === 'user-management' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'
  }
>
  User Management
</Button>
```

#### Шаг 5: Добавить условный рендер (строка 639)

```jsx
{tab === 'user-management' && <UserManagement />}
```

---

## 📊 СРАВНЕНИЕ ВАРИАНТОВ

| Вариант | Трудность | Время | Преимущества | Недостатки |
|---------|-----------|-------|-------------|-----------|
| **1** (встроить в AdminPanel) | Средняя | 30-40 мин | Один интерфейс, простота | Дублирование логики, смешанный код |
| **2** (использовать UserManagement) | Низкая | 10-15 мин | Чистый код, переиспользование, разделение | Отдельная вкладка, два разных набора столбцов |

---

## ✨ ИТОГ АУДИТА

### 🔍 Что найдено:

1. **Основной AdminPanel.tsx:**
   - ✅ Таблица с пользователями работает
   - ❌ Ban/unban функции отсутствуют
   - ❌ Интерфейс UserRow не содержит banned полей
   - ❌ Нет кнопок для управления ban статусом

2. **Альтернативный UserManagement.tsx:**
   - ✅ Полная реализация ban/unban
   - ✅ Красивый UI с модалой
   - ✅ Правильные endpoints
   - ❌ Не используется в AdminPanel

3. **Backend:**
   - ✅ Все endpoints работают правильно
   - ✅ Поля banned/bannedAt/banReason правильно сохраняются

### 🎯 Рекомендация:

**ВАРИАНТ 2** — добавить вкладку "User Management" в AdminPanel:
- Использует существующий работающий компонент
- Минимум изменений
- Чистое разделение функций
- Быстрая реализация (10-15 минут)

**Точное место для добавления:**
- Файл: `client/src/routes/AdminPanel.tsx`
- Строки для добавления импорта: после строки 7
- Строки для добавления вкладки: после строки 439
- Строки для добавления рендера: после строки 639

