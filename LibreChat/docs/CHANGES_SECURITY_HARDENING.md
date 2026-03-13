# 🔒 ИЗМЕНЕНИЯ БЕЗОПАСНОСТИ: Жёсткая Авторизация и Ban Система

**Дата:** 13 марта 2026
**Версия:** v0.8.3-rc1 + Безопасность
**Статус:** ✅ РЕАЛИЗОВАНО

---

## 📋 ИТОГОВАЯ СВОДКА

Внесены **минимальные backend-only** изменения для реализации трёх целей:

1. ✅ **Разрешить регистрацию ТОЛЬКО с реальным email Yandex**
2. ✅ **Полностью запретить fallback @librechat.local**
3. ✅ **Сделать забаненного пользователя недееспособным в системе**

---

## 🔧 ВНЕСЁННЫЕ ИЗМЕНЕНИЯ

### ЧАСТЬ 1️⃣: Жёсткая проверка email в Yandex OAuth

**Файл:** `api/server/controllers/auth/yandex.js`

**Добавлена проверка домена email (строки 208-226):**

```javascript
// 🔒 ЧАСТЬ 1: Проверка домена email (только Yandex!)
const validYandexDomains = /@(yandex\.ru|yandex\.com|ya\.ru|yandex\.by|yandex\.kz|yandex\.ua)$/i;
if (!validYandexDomains.test(userEmail)) {
  console.error(`❌ YANDEX OAUTH ERROR: Invalid email domain`);
  console.error(`Email: ${userEmail}`);
  console.error(`Allowed domains: yandex.ru, yandex.com, ya.ru, yandex.by, yandex.kz, yandex.ua`);

  logger.error('[Yandex OAuth] Invalid email domain - not a Yandex email', {
    email: userEmail,
    yandexId: yandexUser.id,
  });

  return res.redirect(
    `${domains.client}/sign-in?error=invalid_email_domain&provider=yandex`,
  );
}
```

**Что это делает:**
- ✅ Проверяет что email заканчивается на допустимый домен Yandex
- ✅ Поддерживает: yandex.ru, yandex.com, ya.ru, yandex.by, yandex.kz, yandex.ua
- ✅ Отклоняет любые другие домены (включая @librechat.local)
- ✅ Логирует попытку с неправильным домером
- ✅ Редиректит на /sign-in с ошибкой `invalid_email_domain`

---

### ЧАСТЬ 2️⃣: Проверка существующих @librechat.local аккаунтов

**Файл:** `api/server/controllers/auth/yandex.js`

**Добавлена проверка legacy аккаунтов (строки 241-259):**

```javascript
// 🔒 ЧАСТЬ 2: Проверка что это не legacy .local аккаунт
if (user && user.email.endsWith('@librechat.local')) {
  console.error(`❌ SECURITY: Attempt to login with legacy .local account`);
  console.error(`Email: ${user.email}`);
  console.error(`This account is no longer valid and must be migrated`);

  logger.error('[Security] Attempt login with legacy .local account', {
    email: user.email,
    userId: user._id,
  });

  return res.redirect(
    `${domains.client}/sign-in?error=invalid_account&provider=yandex`,
  );
}
```

**Что это делает:**
- ✅ Ищет существующего пользователя по email
- ✅ Если найден пользователь с @librechat.local, блокирует вход
- ✅ Логирует попытку входа в legacy аккаунт
- ✅ Редиректит на /sign-in с ошибкой `invalid_account`
- ✅ Защита от миграции старых некорректных аккаунтов

---

### ЧАСТЬ 3️⃣: Добавление checkBan middleware на основные маршруты

**Файл:** `api/server/index.js`

**Импорт checkBan (строка 30):**

```javascript
const { checkDomainAllowed, checkBan } = require('~/server/middleware');
```

**Добавление checkBan к 5 основным маршрутам:**

| Маршрут | Строка | Изменение |
|---------|--------|-----------|
| /api/user | 221 | `app.use('/api/user', checkBan, routes.user);` |
| /api/messages | 225 | `app.use('/api/messages', checkBan, routes.messages);` |
| /api/convos | 227 | `app.use('/api/convos', checkBan, routes.convos);` |
| /api/assistants | 247 | `app.use('/api/assistants', checkBan, routes.assistants);` |
| /api/files | 249 | `app.use('/api/files', checkBan, await routes.files.initialize());` |

**Что это делает:**
- ✅ checkBan middleware проверяется ПЕРЕД обработкой любого запроса
- ✅ Если user.banned === true, возвращается 403 с кодом USER_BANNED
- ✅ Блокирует доступ к:
  - Профилю пользователя (`/api/user/*`)
  - Сообщениям (`/api/messages/*`)
  - Разговорам (`/api/convos/*`)
  - Ассистентам (`/api/assistants/*`)
  - Загрузкам файлов (`/api/files/*`)

---

### ЧАСТЬ 4️⃣: Проверка блокировки в checkBan middleware

**Файл:** `api/server/middleware/checkBan.js`

**Код уже содержит нужную логику (строки 49-65):**

```javascript
if (req.user) {
  let user = req.user;
  if (typeof req.user.banned === 'undefined') {
    user = await findUser({ _id: req.user._id }, 'banned bannedAt');
  }

  if (user?.banned === true) {
    logger.warn(`[Ban Check] Permanent ban detected for user: ${req.user.email}`);
    req.banned = true;
    return res.status(403).json({
      message: 'Your account has been suspended.',
      code: 'USER_BANNED',  // ← Frontend ловит этот код
    });
  }
}
```

**Что это делает:**
- ✅ Проверяет user.banned при каждом запросе
- ✅ Если поле не загружено, загружает из БД
- ✅ Возвращает 403 Forbidden с кодом USER_BANNED
- ✅ Логирует попытку доступа забаненного пользователя
- ✅ Frontend может обработать этот код и показать UI

---

### ЧАСТЬ 5️⃣: Защита от self-ban

**Файл:** `api/server/routes/admin.js`

**Добавлена проверка в endpoint ban (строки 715-720):**

```javascript
router.patch('/users/:userId/ban', requireJwtAuth, requireAdminRole, async (req, res) => {
  try {
    const { userId } = req.params;
    const { banReason = 'No reason provided' } = req.body;

    // 🔒 ЧАСТЬ 5: Защита от self-ban - админ не может забанить сам себя
    if (req.user._id.toString() === userId) {
      logger.warn(`[admin/ban] Attempt to ban yourself by ${req.user.email}`);
      return res.status(400).json({ error: 'You cannot ban yourself' });
    }

    // ... (основной код ban'а)
```

**Что это делает:**
- ✅ Проверяет что админ не пытается забанить сам себя
- ✅ Если userId совпадает с req.user._id, возвращает 400 Bad Request
- ✅ Логирует попытку self-ban
- ✅ Защита от случайной блокировки собственного аккаунта

---

### ЧАСТЬ 6️⃣: Frontend компонент (ПРОВЕРЕН, БЕЗ ИЗМЕНЕНИЙ)

**Файл:** `client/src/components/Admin/UserManagement.tsx`

✅ **Уже правильно использует:**
- Endpoint: `GET /api/admin/mvp/users` для загрузки списка
- Endpoint: `PATCH /api/admin/mvp/users/:userId/ban` для бана
- Endpoint: `PATCH /api/admin/mvp/users/:userId/unban` для разбана
- Поле: `banned` для отображения статуса

❌ **НЕ было изменено** — согласно требованиям (только backend)

---

## 📊 СТАТИСТИКА ИЗМЕНЕНИЙ

| Файл | Добавлено строк | Тип изменения |
|------|-----------------|---------------|
| yandex.js | 48 | Проверка домена + legacy account |
| index.js | 5 | Импорт + добавление checkBan |
| admin.js | 6 | Защита от self-ban |
| **ВСЕГО** | **59** | **Минимальные + безопасные** |

---

## 🔐 МАТРИЦА БЕЗОПАСНОСТИ

### Сценарий 1: Регистрация с non-Yandex email

```
1. Пользователь нажимает "Sign in with Yandex"
   ↓
2. Yandex OAuth возвращает профиль с email: attacker@gmail.com
   ↓
3. ❌ БЛОКИРОВКА: validYandexDomains.test('attacker@gmail.com') = false
   ↓
4. Редирект на /sign-in?error=invalid_email_domain
```

**Результат:** ❌ Регистрация ОТКЛОНЕНА

---

### Сценарий 2: Попытка входа с @librechat.local аккаунтом

```
1. Пользователь пытается войти через Yandex OAuth
   ↓
2. System находит существующего user с email: old_user@librechat.local
   ↓
3. ❌ БЛОКИРОВКА: user.email.endsWith('@librechat.local') = true
   ↓
4. Редирект на /sign-in?error=invalid_account
```

**Результат:** ❌ Вход ОТКЛОНЕН

---

### Сценарий 3: Забанен пользователь пытается получить доступ

```
1. Пользователь отправляет GET /api/messages
   ↓
2. requireJwtAuth проверяет JWT ✅ OK
   ↓
3. checkBan проверяет user.banned
   ↓
4. ❌ БЛОКИРОВКА: user.banned === true
   ↓
5. Возврат 403 {code: 'USER_BANNED', message: 'Your account has been suspended.'}
```

**Результат:** ❌ Запрос ОТКЛОНЕН

---

### Сценарий 4: Админ пытается забанить сам себя

```
1. Админ отправляет PATCH /api/admin/mvp/users/:userId/ban
   с userId === req.user._id
   ↓
2. requireJwtAuth проверяет JWT ✅ OK
   ↓
3. requireAdminRole проверяет роль ✅ OK
   ↓
4. ❌ БЛОКИРОВКА: req.user._id.toString() === userId
   ↓
5. Возврат 400 {error: 'You cannot ban yourself'}
```

**Результат:** ❌ Запрос ОТКЛОНЕН

---

## ✅ ЧЕКЛИСТ ТЕСТИРОВАНИЯ

### Регистрация и OAuth

- [ ] **Регистрация с реальным email Yandex (@yandex.ru)**
  - Ожидание: ✅ Успешная регистрация
  - Проверка: user.email содержит правильный Yandex email

- [ ] **Попытка регистрации с non-Yandex email**
  - Ожидание: ❌ Ошибка `invalid_email_domain`
  - Проверка: Редирект на /sign-in с параметром error

- [ ] **Попытка входа с @librechat.local аккаунтом (если существует)**
  - Ожидание: ❌ Ошибка `invalid_account`
  - Проверка: Редирект на /sign-in

### Ban функционал

- [ ] **Админ может забанить обычного пользователя**
  - Ожидание: ✅ User.banned = true
  - Проверка: PATCH /api/admin/mvp/users/:userId/ban возвращает 200

- [ ] **Админ не может забанить сам себя**
  - Ожидание: ❌ Ошибка `You cannot ban yourself`
  - Проверка: PATCH /api/admin/mvp/users/:adminId/ban возвращает 400

- [ ] **Забанен пользователь не может использовать API**
  - Ожидание: ❌ 403 USER_BANNED
  - Проверка: GET /api/messages возвращает 403 {code: 'USER_BANNED'}

- [ ] **Забанен пользователь не может загружать сообщения**
  - Ожидание: ❌ 403 USER_BANNED
  - Проверка: POST /api/messages возвращает 403

- [ ] **Забанен пользователь не может получить доступ к файлам**
  - Ожидание: ❌ 403 USER_BANNED
  - Проверка: POST /api/files возвращает 403

- [ ] **Админ может разбанить пользователя**
  - Ожидание: ✅ User.banned = false
  - Проверка: PATCH /api/admin/mvp/users/:userId/unban возвращает 200

- [ ] **После разбана пользователь снова может использовать API**
  - Ожидание: ✅ API работает
  - Проверка: GET /api/messages возвращает 200

---

## 🎯 ОТВЕТЫ НА ТРЕБОВАНИЯ

### ✅ Требование 1: Разрешить регистрацию ТОЛЬКО с реальным email Yandex

**Решение:**
- Добавлена проверка домена email в `yandex.js` (часть 1)
- Поддерживаемые домены: yandex.ru, yandex.com, ya.ru, yandex.by, yandex.kz, yandex.ua
- Любые другие домены отклоняются с ошибкой `invalid_email_domain`

**Файлы:**
- `api/server/controllers/auth/yandex.js` (строки 208-226)

---

### ✅ Требование 2: Полностью запретить fallback @librechat.local

**Решение:**
- Добавлена проверка legacy аккаунтов в `yandex.js` (часть 2)
- Существующие пользователи с @librechat.local не могут войти
- Попытка входа логируется с warning

**Файлы:**
- `api/server/controllers/auth/yandex.js` (строки 241-259)

---

### ✅ Требование 3: Сделать забаненного пользователя недееспособным

**Решение:**
- Добавлен checkBan middleware на 5 основных маршрутов (часть 3)
- checkBan.js уже содержит нужную логику для проверки user.banned (часть 4)
- Защита от self-ban в admin.js (часть 5)

**Файлы:**
- `api/server/index.js` (строки 30, 221, 225, 227, 247, 249)
- `api/server/middleware/checkBan.js` (строки 49-65)
- `api/server/routes/admin.js` (строки 715-720)

---

## 📝 ПРИМЕРЫ ЗАПРОСОВ

### Попытка регистрации с неверным доменом

```bash
# Yandex возвращает email: attacker@gmail.com
# System отклоняет:
GET /sign-in?error=invalid_email_domain&provider=yandex
```

### Попытка входа с @librechat.local

```bash
# Existing user: test@librechat.local пытается войти
# System отклоняет:
GET /sign-in?error=invalid_account&provider=yandex
```

### Забанен пользователь пытается получить доступ

```bash
# User отправляет:
GET /api/messages
Authorization: Bearer <JWT_TOKEN>

# System возвращает:
403 Forbidden
{
  "message": "Your account has been suspended.",
  "code": "USER_BANNED"
}
```

### Админ пытается забанить сам себя

```bash
# Admin отправляет:
PATCH /api/admin/mvp/users/[ADMIN_ID]/ban
Authorization: Bearer <ADMIN_JWT>
Content-Type: application/json

{
  "banReason": "I'm spamming"
}

# System возвращает:
400 Bad Request
{
  "error": "You cannot ban yourself"
}
```

---

## 🔍 ВАЛИДАЦИЯ КОДА

✅ **Синтаксис JavaScript проверен:**
- `node -c api/server/controllers/auth/yandex.js` — OK
- `node -c api/server/index.js` — OK
- `node -c api/server/routes/admin.js` — OK

✅ **Изменения минимальные и безопасные:**
- Только backend изменения
- Нет новых React компонентов
- Нет изменения архитектуры UI
- Нет новых хуков
- Нет изменения App.jsx

---

## 📚 ДОКУМЕНТАЦИЯ

Полная техническая документация аудита находится в:
- `AUDIT_AUTHORIZATION_SYSTEM.md` — полный аудит системы авторизации

---

## ✨ ИТОГ

**Внесено 3 минимальных, безопасных изменения, которые реализуют:**

1. ✅ Жёсткая проверка email домена (только Yandex)
2. ✅ Блокировка legacy @librechat.local аккаунтов
3. ✅ Полную блокировку забаненных пользователей на всех основных API маршрутах
4. ✅ Защиту от self-ban

**Всего добавлено:** 59 строк кода
**Всего файлов изменено:** 3
**Синтаксис:** ✅ Проверен

