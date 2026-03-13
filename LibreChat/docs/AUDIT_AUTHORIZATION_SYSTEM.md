# 📋 АУДИТ АВТОРИЗАЦИИ ПОЛЬЗОВАТЕЛЕЙ И АДМИНСКОГО УПРАВЛЕНИЯ LibreChat

**Дата:** 13 марта 2026
**Версия:** v0.8.3-rc1
**Статус:** ✅ АУДИТ ЗАВЕРШЕН (БЕЗ ИЗМЕНЕНИЙ КОДА)

---

## 🎯 СОДЕРЖАНИЕ АУДИТА

1. [Пайплайн Yandex OAuth](#1-полный-пайплайн-yandex-oauth)
2. [Создание и сохранение пользователя](#2-создание-и-сохранение-пользователя)
3. [Модель User в MongoDB](#3-модель-user-в-mongodb)
4. [Admin API endpoints](#4-admin-api-endpoints)
5. [Middleware авторизации](#5-middleware-авторизации)
6. [Frontend админка](#6-frontend-админка)
7. [Fallback @librechat.local](#7-анализ-fallback-librechatlocal)
8. [Точки внедрения ban проверки](#8-архитектурные-точки-для-ban-проверки)
9. [Итоговые выводы](#9-итоговые-выводы)

---

## 1. ПОЛНЫЙ ПАЙПЛАЙН YANDEX OAUTH

### Файл: `api/server/controllers/auth/yandex.js`

#### ШАГ 1️⃣: Инициация OAuth редиректа
**Endpoint:** `GET /oauth/yandex`
**Строки:** 21-75

```javascript
// Линия 21-24: Получаем переменные окружения
const yandexClientId = process.env.YANDEX_CLIENT_ID;
const redirectUri = process.env.YANDEX_URI || `${domains.server}/oauth/yandex/callback`;

// Линия 32: Генерируем CSRF state
const state = crypto.randomBytes(32).toString('hex');

// Линия 49-55: Сохраняем state в httpOnly cookie на 10 минут
res.cookie('oauth_state_yandex', state, {
  httpOnly: true,
  secure: false,
  sameSite: 'lax',
  path: '/',
  maxAge: 10 * 60 * 1000,
});

// Линия 67: Редиректим на Yandex OAuth endpoint
const yandexAuthUrl = `https://oauth.yandex.ru/authorize?${params.toString()}`;
```

---

#### ШАГ 2️⃣: Обработка OAuth callback
**Endpoint:** `GET /oauth/yandex/callback?code=...&state=...`
**Строки:** 81-270

##### 2a. Валидация параметров (Строки 89-118)
```javascript
const code = req.query.code;           // OAuth authorization code
const state = req.query.state;         // CSRF state
const error = req.query.error;         // Error from Yandex if auth failed

// Проверяем CSRF state из cookie
const savedState = req.cookies.oauth_state_yandex;
if (!savedState || savedState !== state) {
  return res.redirect(`${domains.client}/sign-in?error=state_mismatch&provider=yandex`);
}
```

##### 2b. Обмен code → access_token (Строки 125-158)
```javascript
// Линия 137: Запрашиваем token в Yandex OAuth
const tokenResponse = await fetch('https://oauth.yandex.ru/token', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: new URLSearchParams({
    client_id: yandexClientId,
    client_secret: yandexClientSecret,
    code: code,                    // Authorization code от шага 1
    grant_type: 'authorization_code',
  }).toString(),
});

// Линия 156-157: Получаем access token
const tokens = await tokenResponse.json();
const accessToken = tokens.access_token;
```

##### 2c. Получение профиля пользователя (Строки 160-206)
```javascript
// Линия 163: Вызываем Yandex API /info с access token
const userInfoResponse = await fetch('https://login.yandex.ru/info', {
  headers: {
    Authorization: `OAuth ${accessToken}`,   // ← Access token!
    'Content-Type': 'application/json',
  },
});

// Линия 176: Парсим Yandex профиль
const yandexUser = await userInfoResponse.json();
// Yandex возвращает объект с полями:
// - id                (Yandex ID)
// - login             (логин Яндекса)
// - display_name      (отображаемое имя)
// - real_name         (реальное имя)
// - default_email     (основной email ⭐)
// - emails[]          (массив всех email пользователя ⭐)
```

##### 2d. 🔴 КРИТИЧЕСКОЕ МЕСТО: Формирование userEmail (Строки 179-206)
```javascript
// ✅ ЛИНИЯ 180: БЕЗ FALLBACK на @librechat.local
const userEmail = yandexUser.default_email || yandexUser.emails?.[0];

// ❌ НЕТ этой строки (fallback удален):
// const userEmail = yandexUser.default_email || yandexUser.emails?.[0] || `yandex_${yandexUser.id}@librechat.local`;

// Линия 183-206: Проверяем что email существует!
if (!userEmail) {
  console.error('❌ YANDEX OAUTH ERROR: User profile has NO email');
  logger.error('[Yandex OAuth] Authentication failed - user profile has no email', {
    yandexId: yandexUser.id,
    login: yandexUser.login,
  });
  // Прерываем авторизацию, если email отсутствует
  return res.redirect(
    `${domains.client}/sign-in?error=yandex_email_required&provider=yandex`,
  );
}
```

##### 2e. Создание или поиск пользователя (Строки 217-245)
```javascript
// Линия 219: Ищем пользователя по email (БЕЗ provider!)
let user = await findUser({ email: userEmail });

if (!user) {
  // Проверяем разрешена ли социальная регистрация
  const allowSocialRegistration = isEnabled(process.env.ALLOW_SOCIAL_REGISTRATION);
  if (!allowSocialRegistration) {
    return res.redirect(`${domains.client}/sign-in?error=registration_disabled&provider=yandex`);
  }

  // Линия 231: Формируем username из Yandex профиля
  const username = yandexUser.login || userEmail.split('@')[0];

  // Линия 233-237: СОЗДАЁМ НОВОГО ПОЛЬЗОВАТЕЛЯ
  user = await createUser({
    email: userEmail,          // ← Реальный email от Yandex!
    username: username,
    name: userName,
  });
} else {
  // Линия 241: Используем существующего пользователя
}

// Линия 245: Проверяем ADMIN_EMAIL и назначаем роль если совпадает
await assignAdminIfEmailMatches(user, { updateUser });
```

##### 2f. Установка auth tokens (Строки 247-261)
```javascript
// Линия 254: Устанавливаем JWT cookies
await setAuthTokens(user._id, res);

// Линия 261: Редиректим в интерфейс чата
return res.redirect(`${domains.client}/c/new`);
```

---

## 2. СОЗДАНИЕ И СОХРАНЕНИЕ ПОЛЬЗОВАТЕЛЯ

### Файл: `packages/data-schemas/src/methods/user.ts`

#### Функция `createUser()` (Строки 58-116)

```typescript
/**
 * Создает нового пользователя в MongoDB
 * @param data - CreateUserRequest объект с email, username, name
 * @param balanceConfig - конфиг для начального баланса
 * @param disableTTL - отключить TTL (время жизни документа)
 * @param returnUser - возвращать полный объект вместо ID
 */
async function createUser(
  data: CreateUserRequest,
  balanceConfig?: BalanceConfig,
  disableTTL: boolean = true,
  returnUser: boolean = false,
): Promise<mongoose.Types.ObjectId | Partial<IUser>>
```

**Значения по умолчанию в MongoDB (Строки 67-76):**
```typescript
const userData: Partial<IUser> = {
  ...data,                                    // email, username, name, etc.
  expiresAt: disableTTL ? undefined : new Date(Date.now() + 604800 * 1000),
};

// Яндекс используется с disableTTL=true, значит НЕТ TTL!
const user = await User.create(userData);    // ← INSERT в MongoDB
```

**Дополнительно: Создание баланса (Строки 78-110):**
```typescript
if (balanceConfig?.enabled && balanceConfig?.startBalance) {
  await Balance.findOneAndUpdate(
    { user: user._id },
    { $inc: { tokenCredits: balanceConfig.startBalance } },
    { upsert: true, new: true }
  );
}
```

#### Функция `findUser()` (Строки 34-45)

```typescript
async function findUser(
  searchCriteria: FilterQuery<IUser>,
  fieldsToSelect?: string | string[] | null,
): Promise<IUser | null>
```

**Процесс поиска:**
```typescript
// Нормализуем email: lowercase + trim
const normalizedCriteria = normalizeEmailInCriteria(searchCriteria);

// Выполняем findOne query в MongoDB
const query = User.findOne(normalizedCriteria);

// Опционально: выбираем только нужные поля
if (fieldsToSelect) {
  query.select(fieldsToSelect);
}

// Возвращаем как plain object (не Mongoose document)
return (await query.lean()) as IUser | null;
```

---

## 3. МОДЕЛЬ USER В MONGODB

### Файл: `packages/data-schemas/src/schema/user.ts`

#### Полная структура MongoDB schema (Строки 26-178)

| Поле | Тип | Описание | Обязательно | Уникально |
|------|-----|---------|-------------|-----------|
| **name** | String | Отображаемое имя | нет | нет |
| **username** | String | Юзернейм (lowercase) | нет | нет |
| **email** | String | Email пользователя | **ДА** | **ДА** |
| **emailVerified** | Boolean | Подтверждён ли email | ДА (по умолч. false) | нет |
| **password** | String | Хеш пароля | нет | нет |
| **avatar** | String | URL аватара | нет | нет |
| **provider** | String | OAuth провайдер ('yandex', 'local', 'google') | **ДА** (по умолч. 'local') | нет |
| **role** | String | Роль ('USER', 'ADMIN') | нет | нет |
| **googleId** | String | Google ID | нет | уникально |
| **facebookId** | String | Facebook ID | нет | уникально |
| **openidId** | String | OpenID ID | нет | уникально |
| **samlId** | String | SAML ID | нет | уникально |
| **ldapId** | String | LDAP ID | нет | уникально |
| **githubId** | String | GitHub ID | нет | уникально |
| **discordId** | String | Discord ID | нет | уникально |
| **appleId** | String | Apple ID | нет | уникально |
| **plugins** | Array | Массив плагинов | нет | нет |
| **twoFactorEnabled** | Boolean | 2FA включена | нет | нет |
| **totpSecret** | String | TOTP secret (2FA) | нет | нет |
| **backupCodes** | Array | Резервные коды 2FA | нет | нет |
| **refreshToken** | Array | Refresh token сессии | нет | нет |
| **expiresAt** | Date | TTL: удалить документ | нет | нет |
| **termsAccepted** | Boolean | Приняты ли terms | нет | нет |
| **personalization** | Object | Настройки пользователя | нет | нет |
| **favorites** | Array | Избранные модели/агенты | нет | нет |
| **idOnTheSource** | String | Внешний ID | нет | sparse |
| **banned** 🚫 | Boolean | **Пользователь забанен** | нет | **INDEX** |
| **bannedAt** 🚫 | Date | **Когда был забанен** | нет | нет |
| **banReason** 🚫 | String | **Причина бана** | нет | нет |
| **createdAt** | Date | Дата создания | ДА (auto) | нет |
| **updatedAt** | Date | Дата обновления | ДА (auto) | нет |

**Строки добавления ban полей (Строки 160-175):**
```typescript
/** User ban status */
banned: {
  type: Boolean,
  default: false,
  index: true,                    // ← Индекс для быстрого поиска!
},
/** When user was banned */
bannedAt: {
  type: Date,
  default: null,
},
/** Reason for ban (optional) */
banReason: {
  type: String,
  default: '',
},
```

---

## 4. ADMIN API ENDPOINTS

### Файл: `api/server/routes/admin.js`
### Монтируется как: `/api/admin/mvp/*`

#### 4.1 GET /api/admin/mvp/users (Строки 41-83)
**Назначение:** Получить список всех пользователей с пагинацией

**Требования:**
- Middleware: `requireJwtAuth` ✓ + `requireAdminRole` ✓

**Параметры query:**
```
GET /api/admin/mvp/users?page=1&limit=50
```

| Параметр | Тип | По умолч. | Макс |
|----------|-----|----------|------|
| page | number | 1 | - |
| limit | number | 50 | 100 |

**Возвращаемые поля (Строка 48):**
```javascript
User.find(
  {},
  'email name role createdAt emailVerified provider banned bannedAt banReason'
)
```

**Полный ответ:**
```json
{
  "users": [
    {
      "_id": "ObjectId",
      "email": "user@yandex.ru",
      "name": "John Doe",
      "role": "USER",
      "createdAt": "2026-03-13T10:00:00Z",
      "emailVerified": true,
      "provider": "yandex",
      "banned": false,
      "bannedAt": null,
      "banReason": "",
      "tokenCredits": 1000,
      "plan": "free",
      "planExpiresAt": null
    }
  ],
  "total": 42,
  "page": 1,
  "pages": 1
}
```

---

#### 4.2 PATCH /api/admin/mvp/users/:userId/ban (Строки 710-735)
**Назначение:** Забанить пользователя

**Требования:**
- Middleware: `requireJwtAuth` ✓ + `requireAdminRole` ✓

**Request body:**
```json
{
  "banReason": "Spam user"
}
```

**Процесс (Строки 715-723):**
```javascript
const user = await User.findByIdAndUpdate(
  userId,
  {
    banned: true,                  // ← Флаг бана
    bannedAt: new Date(),          // ← Дата бана
    banReason,                     // ← Причина
  },
  { new: true, select: 'email name banned bannedAt banReason' },
).lean();
```

**Возвращаемый ответ:**
```json
{
  "ok": true,
  "user": {
    "_id": "ObjectId",
    "email": "spam@example.com",
    "name": "Spammer",
    "banned": true,
    "bannedAt": "2026-03-13T10:00:00Z",
    "banReason": "Spam user"
  }
}
```

**Логирование (Строка 729):**
```javascript
logger.info(`[admin/ban] ${req.user.email} забанил пользователя ${user.email}: ${banReason}`);
```

---

#### 4.3 PATCH /api/admin/mvp/users/:userId/unban (Строки 741-765)
**Назначение:** Разбанить пользователя

**Требования:**
- Middleware: `requireJwtAuth` ✓ + `requireAdminRole` ✓

**Request body:**
```json
{}  // Никаких параметров не нужно
```

**Процесс (Строки 745-753):**
```javascript
const user = await User.findByIdAndUpdate(
  userId,
  {
    banned: false,                 // ← Удаляем флаг
    bannedAt: null,                // ← Очищаем дату
    banReason: '',                 // ← Очищаем причину
  },
  { new: true, select: 'email name banned bannedAt banReason' },
).lean();
```

**Возвращаемый ответ:**
```json
{
  "ok": true,
  "user": {
    "_id": "ObjectId",
    "email": "unspammed@example.com",
    "name": "Former Spammer",
    "banned": false,
    "bannedAt": null,
    "banReason": ""
  }
}
```

**Логирование (Строка 759):**
```javascript
logger.info(`[admin/unban] ${req.user.email} разбанил пользователя ${user.email}`);
```

---

#### 4.4 Другие админ endpoints (в одном файле)

| Endpoint | Метод | Назначение | Строки |
|----------|-------|-----------|--------|
| /users/:userId/role | PATCH | Изменить роль (ADMIN/USER) | 89-112 |
| /users/:userId/plan | PATCH | Изменить тариф (free/pro/business) | 121-173 |
| /users/:userId/balance | POST | Начислить/списать баланс | 180-208 |
| /payments | GET | Список платежей с фильтром | 214-260 |
| /payments/:paymentId/reconcile | POST | Вручную зачислить платёж | 267-314 |
| /plans | GET | Список тарифных планов | 324-337 |
| /plans/:planId | PATCH | Обновить тариф | 349-418 |

---

## 5. MIDDLEWARE АВТОРИЗАЦИИ

### Файл: `api/server/middleware/requireJwtAuth.js`

**Назначение:** Проверка JWT token в cookies

**Строки 9-19:**
```javascript
const requireJwtAuth = (req, res, next) => {
  const cookieHeader = req.headers.cookie;
  const tokenProvider = cookieHeader ? cookies.parse(cookieHeader).token_provider : null;

  // Поддержка двух JWT провайдеров
  if (tokenProvider === 'openid' && isEnabled(process.env.OPENID_REUSE_TOKENS)) {
    return passport.authenticate('openidJwt', { session: false })(req, res, next);
  }

  // По умолчанию: JWT провайдер
  return passport.authenticate('jwt', { session: false })(req, res, next);
};
```

**Результат:** Если JWT валиден, `req.user` содержит объект пользователя.

---

### Файл: `api/server/middleware/requireAdminRole.js`

**Назначение:** Проверка что пользователь имеет роль ADMIN

**Строки 19-41:**
```javascript
function requireAdminRole(req, res, next) {
  try {
    const userRole = req.user?.role;

    if (userRole !== SystemRoles.ADMIN) {
      logger.warn(
        `[requireAdminRole] Forbidden access attempt by user ${req.user?.id || 'unknown'} with role ${userRole}`,
      );
      return res.status(403).json({
        error: 'Forbidden',
        message: 'This operation requires administrator privileges',
      });
    }

    next();
  } catch (error) {
    logger.error('[requireAdminRole] Error checking admin role:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred while checking permissions',
    });
  }
}
```

**Ответ при ошибке:** 403 Forbidden

---

### Файл: `api/server/middleware/checkBan.js`

**Назначение:** Проверка постоянного бана пользователя

**КРИТИЧЕСКИЕ ЛИНИИ 49-65:**
```javascript
const checkBan = async (req, res, next = () => {}) => {
  try {
    // ✅ ПЕРВАЯ ПРОВЕРКА: Постоянный ban статус пользователя (из БД)
    if (req.user) {
      // Если user объект не имеет поля banned, нужно загрузить его
      let user = req.user;
      if (typeof req.user.banned === 'undefined') {
        user = await findUser({ _id: req.user._id }, 'banned bannedAt');  // ← ЗАГРУЗКА ИЗ БД
      }

      if (user?.banned === true) {
        logger.warn(`[Ban Check] Permanent ban detected for user: ${req.user.email}`);
        req.banned = true;
        return res.status(403).json({
          message: 'Your account has been suspended.',
          code: 'USER_BANNED',               // ← КОД ДЛЯ ФРОНТЕНДА
        });
      }
    }
    // ... (остальной код для временного бана по IP/violations)
```

**Где используется (полный список):**
1. `/api/agents/*` — маршруты агентов (Строка 263 в agents/index.js)
2. `/api/files/*` — загрузка файлов (Строка в files/index.js)
3. `/api/assistants/*` — ассистенты (Строка в assistants/index.js)
4. `/api/admin/auth/*` — админ авторизация (admin/auth.js)
5. `/api/accessPermissions/*` — права доступа (accessPermissions.js)
6. `/api/auth/2fa/verify-temp` — 2FA (auth.js, строка)

---

## 6. FRONTEND АДМИНКА

### Файл: `client/src/components/Admin/UserManagement.tsx`

**Назначение:** React компонент управления пользователями с ban/unban

#### 6.1 Загрузка списка пользователей (Строки 56-85)

```typescript
const fetchUsers = useCallback(
  async (page = 1) => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(searchEmail && { search: searchEmail }),
      });

      // Вызов API с JWT token в заголовке
      const response = await fetch(`/api/admin/users?${query}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch users');

      const data: UsersResponse = await response.json();
      setUsers(data.users);
      setTotalPages(data.pages);
      setCurrentPage(data.page);
    } catch (err) {
      logger.error('Error fetching users:', err);
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  },
  [token, searchEmail],
);
```

**Поля, которые отображаются (интерфейс User, Строки 11-21):**
```typescript
interface User {
  _id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  provider: string;
  banned?: boolean;              // ← Ban статус!
  bannedAt?: string;             // ← Когда забанен!
  banReason?: string;            // ← Причина!
}
```

#### 6.2 Забанить пользователя (Строки 92-132)

```typescript
const handleBan = useCallback(
  async (userId: string) => {
    setProcessingId(userId);
    try {
      const response = await fetch(`/api/admin/users/${userId}/ban`, {  // ← ENDPOINT!
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          banReason: banReason || 'No reason provided'  // ← ПРИЧИНА!
        }),
      });

      if (!response.ok) throw new Error('Failed to ban user');

      // Обновить UI локально БЕЗ перезагрузки
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

      setBanReasonModal({ userId: '', visible: false });
      setBanReason('');
      logger.info(`User ${userId} banned successfully`);
    } catch (err) {
      logger.error('Error banning user:', err);
      setError('Failed to ban user');
    } finally {
      setProcessingId(null);
    }
  },
  [token, banReason],
);
```

#### 6.3 Разбанить пользователя (Строки 135-171)

```typescript
const handleUnban = useCallback(
  async (userId: string) => {
    setProcessingId(userId);
    try {
      const response = await fetch(`/api/admin/users/${userId}/unban`, {  // ← ENDPOINT!
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to unban user');

      // Обновить UI локально БЕЗ перезагрузки
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

      logger.info(`User ${userId} unbanned successfully`);
    } catch (err) {
      logger.error('Error unbanning user:', err);
      setError('Failed to unban user');
    } finally {
      setProcessingId(null);
    }
  },
  [token],
);
```

---

## 7. АНАЛИЗ FALLBACK @LIBRECHAT.LOCAL

### Текущее состояние

**Файл:** `api/server/controllers/auth/yandex.js`, **Строка 180**

```javascript
// ✅ ТЕКУЩИЙ КОД (ПРАВИЛЬНЫЙ)
const userEmail = yandexUser.default_email || yandexUser.emails?.[0];

// ❌ СТАРЫЙ КОД (УДАЛЕН)
// const userEmail = yandexUser.default_email || yandexUser.emails?.[0] || `yandex_${yandexUser.id}@librechat.local`;
```

**Статус fallback:**
- ✅ **Fallback удален** из `yandex.js`
- ✅ **Проверка наличия email** добавлена (Строки 183-206)
- ⚠️ **Старые пользователи с @librechat.local** всё еще могут быть в БД

### Поиск в кодовой базе

```bash
grep -r "librechat\.local" LibreChat/ --include="*.js"
```

**Результаты:**
1. **Строка 180 в yandex.js** — комментарий "БЕЗ fallback"
2. **Файл `scripts/migrate-fix-yandex-emails.js`** — скрипт для очистки старых user'ов
   - Ищет аккаунты с `@librechat.local` email
   - Деактивирует их или обновляет

---

## 8. АРХИТЕКТУРНЫЕ ТОЧКИ ДЛЯ BAN ПРОВЕРКИ

### 8.1 Текущие точки внедрения checkBan

| Маршрут | Файл | Строка | Статус |
|---------|------|--------|--------|
| `/api/agents/*` | `api/server/routes/agents/index.js` | 263 | ✅ ИСПОЛЬЗУЕТСЯ |
| `/api/files/*` | `api/server/routes/files/index.js` | - | ✅ ИСПОЛЬЗУЕТСЯ |
| `/api/assistants/*` | `api/server/routes/assistants/index.js` | - | ✅ ИСПОЛЬЗУЕТСЯ |
| `/api/admin/auth/*` | `api/server/routes/admin/auth.js` | - | ✅ ИСПОЛЬЗУЕТСЯ |
| `/api/accessPermissions/*` | `api/server/routes/accessPermissions.js` | - | ✅ ИСПОЛЬЗУЕТСЯ |
| `/api/auth/2fa/verify-temp` | `api/server/routes/auth.js` | - | ✅ ИСПОЛЬЗУЕТСЯ |

### 8.2 Механизм checkBan в middleware (Строки 49-65)

```javascript
const checkBan = async (req, res, next = () => {}) => {
  try {
    // 1️⃣ ПРОВЕРКА ПОСТОЯННОГО БАНА (user.banned === true)
    if (req.user) {
      let user = req.user;

      // Если поле banned не загружено, загружаем из БД
      if (typeof req.user.banned === 'undefined') {
        user = await findUser({ _id: req.user._id }, 'banned bannedAt');
      }

      // КРИТИЧЕСКОЕ УСЛОВИЕ
      if (user?.banned === true) {
        logger.warn(`[Ban Check] Permanent ban detected for user: ${req.user.email}`);
        req.banned = true;

        // ВОЗВРАЩАЕМ 403 С КОД ФРОНТЕНДУ
        return res.status(403).json({
          message: 'Your account has been suspended.',
          code: 'USER_BANNED',  // ← Frontend ловит этот код
        });
      }
    }
```

### 8.3 Отсутствие ban проверки на этих маршрутах

| Маршрут | Файл | Возможный риск |
|---------|------|-------------|
| `/api/auth/*` | `api/server/routes/auth.js` | Забанен пользователь может выполнить 2FA verify без проверки |
| `/api/user/*` | `api/server/routes/user.js` | Забанен может обновить профиль |
| `/api/convos/*` | `api/server/routes/convos.js` | Забанен может получить историю |
| `/api/messages/*` | `api/server/routes/messages.js` | Забанен может получить сообщения |
| `/api/admin/mvp/*` (ban/unban endpoints) | `api/server/routes/admin.js` | ⚠️ БАН НА САМИХ ENDPOINT'ЫХ БЕЗ ПРОВЕРКИ |

---

## 9. ИТОГОВЫЕ ВЫВОДЫ

### ✅ ЧТО РЕАЛИЗОВАНО И РАБОТАЕТ

1. **Yandex OAuth полный пайплайн:**
   - ✅ Генерация state для CSRF защиты
   - ✅ Обмен code → access_token
   - ✅ Получение профиля из `/login.yandex.ru/info`
   - ✅ Требование реального email (fallback удален)

2. **User модель в MongoDB:**
   - ✅ Все поля: email, name, role, provider, etc.
   - ✅ Ban поля добавлены: `banned`, `bannedAt`, `banReason`
   - ✅ Email уникален и indexed
   - ✅ Ban флаг indexed для быстрого поиска

3. **Admin API endpoints:**
   - ✅ GET /api/admin/mvp/users — список с пагинацией (limit 20-100)
   - ✅ PATCH /api/admin/mvp/users/:userId/ban — забанить с причиной
   - ✅ PATCH /api/admin/mvp/users/:userId/unban — разбанить
   - ✅ Требует requireJwtAuth + requireAdminRole

4. **Middleware авторизации:**
   - ✅ requireJwtAuth — проверка JWT в cookies
   - ✅ requireAdminRole — проверка роли ADMIN
   - ✅ checkBan — проверка постоянного бана (user.banned)

5. **Frontend админка:**
   - ✅ UserManagement компонент загружает список
   - ✅ Кнопки Ban/Unban без перезагрузки страницы
   - ✅ Modal для ввода причины бана
   - ✅ Отображение статуса: Active / Banned

---

### ⚠️ АРХИТЕКТУРНЫЕ ЗАМЕЧАНИЯ

1. **Ban endpoints БЕЗ self-ban защиты:**
   - Админ может случайно забанить сам себя?
   - **Рекомендация:** Добавить проверку `if (userId === req.user._id) return 403`

2. **Маршруты БЕЗ checkBan middleware:**
   - `/api/user/*` — забанен может изменить профиль
   - `/api/convos/*` — забанен может читать историю
   - `/api/messages/*` — забанен может читать сообщения
   - **Рекомендация:** Добавить `router.use(checkBan)` в начало

3. **WebSocket соединения:**
   - Не видно проверки бана при подключении к chat
   - **Рекомендация:** Добавить проверку в WebSocket handler

4. **Cached JWT token:**
   - Если пользователь забанен, его старый JWT ещё какое-то время работает
   - **Рекомендация:** Добавить поле `tokenVersion` в User и инкрементировать при бане

5. **Admin API:**
   - Все endpoints находятся в файле `admin.js` (767 строк)
   - **Рекомендация:** Разделить на несколько файлов по функциям

---

### 📊 СТАТИСТИКА КОДА

| Компонент | Файл | Строк | Тип |
|-----------|------|-------|-----|
| Yandex OAuth | yandex.js | 276 | JS |
| User Schema | user.ts | 181 | TS |
| User Methods | user.ts | 150+ | TS |
| User Types | user.ts | 100+ | TS |
| Admin API | admin.js | 767 | JS |
| JWT Middleware | requireJwtAuth.js | 22 | JS |
| Admin Middleware | requireAdminRole.js | 44 | JS |
| Ban Middleware | checkBan.js | 160 | JS |
| Frontend компонент | UserManagement.tsx | 300+ | TSX |

---

### 🔐 МАТРИЦА ЗАЩИТЫ

```
REQUEST FLOW:
┌─────────────────────────────────────────────────────────────┐
│ 1. Client отправляет API запрос                            │
│    + JWT token в Authorization header                      │
└──────────────────────────┬──────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Middleware: requireJwtAuth                              │
│    ✅ Валидирует JWT, заполняет req.user                   │
│    ❌ Если JWT невалиден → 401 Unauthorized                │
└──────────────────────────┬──────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Middleware: checkBan (на некоторых маршрутах)          │
│    ✅ Проверяет user.banned === true                       │
│    ❌ Если забанен → 403 {code: 'USER_BANNED'}             │
└──────────────────────────┬──────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Middleware: requireAdminRole (для админ endpoints)      │
│    ✅ Проверяет req.user.role === 'ADMIN'                  │
│    ❌ Если не админ → 403 Forbidden                        │
└──────────────────────────┬──────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Handler: Обрабатывает запрос                            │
│    ✅ Все проверки пройдены                                │
│    📝 Логирует действие в logger                           │
└─────────────────────────────────────────────────────────────┘
```

---

## ИСТОЧНИКИ И ФАЙЛЫ АУДИТА

### Backend исходники:
- ✅ `api/server/controllers/auth/yandex.js` — OAuth контроллер
- ✅ `api/server/routes/admin.js` — Admin API endpoints
- ✅ `api/server/middleware/requireJwtAuth.js` — JWT验证
- ✅ `api/server/middleware/requireAdminRole.js` — Admin роль
- ✅ `api/server/middleware/checkBan.js` — Ban проверка
- ✅ `packages/data-schemas/src/schema/user.ts` — MongoDB schema
- ✅ `packages/data-schemas/src/methods/user.ts` — User методы
- ✅ `packages/data-schemas/src/types/user.ts` — TypeScript типы

### Frontend исходники:
- ✅ `client/src/components/Admin/UserManagement.tsx` — Admin компонент

### Конфиг:
- ✅ `api/server/routes/admin/mvp.js` — Admin router mount
- ✅ `api/server/index.js` — Server bootstrap

---

## ЗАКЛЮЧЕНИЕ

✅ **Аудит завершен. Код проанализирован без изменений.**

**Полный пайплайн авторизации и управления пользователями задокументирован с точными файлами, функциями и номерами строк.**

