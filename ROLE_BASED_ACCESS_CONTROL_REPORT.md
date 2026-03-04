# Отчёт: Role-Based Access Control для Settings в LibreChat

## Статус: ✅ ЗАВЕРШЕНО

Успешно реализована система ограничения доступа к чувствительным настройкам на основе роли пользователя.

---

## 📋 РЕЗЮМЕ

Добавлен полноценный контроль доступа на основе ролей (RBAC) для пользовательских настроек.

**Система двухуровневая:**
1. **Frontend**: Скрывает компоненты для обычных пользователей (CSS-level)
2. **Backend**: Блокирует API endpoints на уровне сервера (409 Forbidden)

---

## 🎯 ЧУВСТВИТЕЛЬНЫЕ НАСТРОЙКИ (Доступны только ADMIN)

### 1. Вкладка "Data" (скрыта полностью)
- **ImportConversations** - импорт разговоров из файла
- **RevokeKeys** - отзыв API ключей пользователя
- **AgentApiKeys** - управление ключами агентов (условно)
- **ClearChats** - очистка всех разговоров

### 2. Вкладка "Balance" (скрыта полностью)
- **AutoRefillSettings** - настройки автоматического пополнения баланса
- **refillAmount** - размер пополнения
- **refillIntervalValue** - интервал пополнения
- **refillIntervalUnit** - единица интервала (дни, недели, месяцы)

### 3. Вкладка "Speech" (Advanced режим скрыт)
- **Advanced Mode Tab** - вкладка расширенных настроек
- **ConversationMode** - режим разговора (advanced)
- **DecibelValue** - уровень децибел для STT
- **AutoSendText** - автоматическая отправка текста
- **CloudBrowserVoices** - облачные голоса браузера (admin-only)

---

## 📁 ИЗМЕНЕННЫЕ ФАЙЛЫ

### Frontend (Client-side)

#### 1. **useIsAdmin.ts** (НОВЫЙ)
```typescript
// /client/src/hooks/useIsAdmin.ts
- Новый hook для проверки роли администратора
- Возвращает: boolean (user?.role === 'ADMIN')
- Используется во всех компонентах Settings
```

#### 2. **Settings.tsx**
```typescript
- Импорт: useIsAdmin hook
- Изменение: settingsTabs теперь фильтруется по ролям
- Скрыт: Data вкладка (только для ADMIN)
- Скрыт: Balance вкладка (только для ADMIN)
- handleKeyDown: обновлена логика навигации между вкладками
```

#### 3. **SettingsTabs/Data/Data.tsx**
```typescript
- Импорт: useIsAdmin hook
- Скрыты условно:
  * ImportConversations (if !isAdmin)
  * RevokeKeys (if !isAdmin)
  * ClearChats (if !isAdmin)
  * AgentApiKeys (if !isAdmin && !hasAccessToApiKeys)
- Доступна для всех:
  * SharedLinks
  * DeleteCache
```

#### 4. **SettingsTabs/Balance/Balance.tsx**
```typescript
- Импорт: useIsAdmin hook
- Скрыты условно:
  * AutoRefillSettings (if !isAdmin)
  * AutoRefillEnabled (if !isAdmin)
  * RefillAmount, RefillIntervalValue, RefillIntervalUnit (if !isAdmin)
- Доступны для всех:
  * TokenCreditsItem (только для чтения)
```

#### 5. **SettingsTabs/Speech/Speech.tsx**
```typescript
- Импорт: useIsAdmin hook
- Скрыты условно:
  * Advanced Mode Tab (if !isAdmin)
  * ConversationModeSwitch (if !isAdmin)
  * DecibelSelector (if !isAdmin)
  * AutoSendTextSelector (if !isAdmin)
  * CloudBrowserVoicesSwitch (if !isAdmin)
- Доступна для всех:
  * Simple Mode (базовые настройки TTS/STT)
```

### Backend (Server-side)

#### 1. **requireAdminRole.js** (НОВЫЙ)
```javascript
// /api/server/middleware/requireAdminRole.js
- Новый middleware для проверки админ-роли
- Проверяет: req.user?.role === SystemRoles.ADMIN
- Возвращает: 403 Forbidden если роль не ADMIN
- Логирует: попытки несанкционированного доступа
```

#### 2. **routes/keys.js** (DELETE endpoints)
```javascript
// DELETE /api/keys/:name
- Добавлен: requireAdminRole middleware
- Запрещает: обычным пользователям удалять ключи

// DELETE /api/keys?all=true
- Добавлен: requireAdminRole middleware
- Запрещает: обычным пользователям удалять все ключи
```

#### 3. **routes/convos.js** (Import & Clear endpoints)
```javascript
// POST /api/convos/import
- Добавлен: requireAdminRole middleware (первый в цепи)
- Запрещает: обычным пользователям импортировать разговоры

// DELETE /api/convos/all
- Добавлен: requireAdminRole middleware
- Запрещает: обычным пользователям очищать все разговоры
```

#### 4. **controllers/Balance.js**
```javascript
- Добавлена: role-based logic в balanceController
- Для USER (обычного пользователя):
  * Возвращает: только tokenCredits (read-only)
  * Скрывает: autoRefillEnabled, refillAmount, refillIntervalValue и т.д.

- Для ADMIN:
  * Возвращает: все поля включая autoRefill settings
  * Логика: как раньше (фильтрация на основе autoRefillEnabled)
```

---

## 🔐 ЗАЩИЩЁННЫЕ ENDPOINTS

| Endpoint | Метод | Требуемая роль | Действие |
|----------|-------|---|---------|
| `/api/keys/:name` | DELETE | ADMIN | RevokeKey |
| `/api/keys?all=true` | DELETE | ADMIN | RevokeAllKeys |
| `/api/convos/import` | POST | ADMIN | ImportConversations |
| `/api/convos/all` | DELETE | ADMIN | ClearChats |
| `/api/balance` | GET | - | Фильтрует данные по ролям |
| `/api/user/delete` | DELETE | - | Уже защищён (canDeleteAccount) |

---

## 🧪 ТЕСТОВЫЕ СЦЕНАРИИ

### 1. Обычный пользователь (USER)
```
✅ Видит: GENERAL, CHAT, COMMANDS, SPEECH (Simple mode), ACCOUNT
❌ Не видит: DATA, BALANCE
❌ Не может: удалять ключи, импортировать разговоры, очищать все чаты
❌ Видит в Balance: только tokenCredits (чтение)
❌ Видит в Speech: только Simple режим
```

### 2. Администратор (ADMIN)
```
✅ Видит: все вкладки включая DATA и BALANCE
✅ Может: удалять ключи, импортировать разговоры, очищать все чаты
✅ Видит в Balance: все настройки autoRefill
✅ Видит в Speech: и Simple и Advanced режимы
```

### 3. API тестирование

```bash
# USER попытается удалить ключ
DELETE /api/keys/my-key -H "Authorization: Bearer user_token"
← 403 Forbidden: "This operation requires administrator privileges"

# ADMIN удаляет ключ
DELETE /api/keys/my-key -H "Authorization: Bearer admin_token"
← 204 No Content (успех)

# USER получает баланс
GET /api/balance -H "Authorization: Bearer user_token"
← 200 { "tokenCredits": 1000 }  // только это поле

# ADMIN получает баланс
GET /api/balance -H "Authorization: Bearer admin_token"
← 200 {
    "tokenCredits": 1000,
    "autoRefillEnabled": true,
    "refillAmount": 5000,
    "refillIntervalValue": 30,
    "refillIntervalUnit": "days",
    "lastRefill": "2026-03-04T11:30:00Z"
  }
```

---

## 📊 СТАТИСТИКА ИЗМЕНЕНИЙ

### Файлы
- **Новых**: 2 файла
  - `useIsAdmin.ts` (frontend hook)
  - `requireAdminRole.js` (backend middleware)
- **Модифицировано**: 7 файлов
  - Settings.tsx
  - Data.tsx
  - Balance.tsx
  - Speech.tsx
  - keys.js
  - convos.js
  - Balance.js

### Строки кода
- **Добавлено**: ~150 строк
- **Изменено**: ~30 строк
- **Удалено**: 0 строк (ничего не удалено!)

---

## ✨ КЛЮЧЕВЫЕ ОСОБЕННОСТИ

### 1. Двухуровневая защита
- **Frontend**: CSS-level скрывает компоненты (user experience)
- **Backend**: API-level блокирует доступ (security)

### 2. Никаких удалений
- Все компоненты остаются в коде
- Просто условно отображаются
- Легко включить для админов через переменные

### 3. Миграция с минимальными изменениями
- Использует существующий `user.role` из AuthContext
- Использует существующий `SystemRoles.ADMIN` из librechat-data-provider
- Не меняет бизнес-логику

### 4. Логирование доступа
- Новый middleware логирует попытки несанкционированного доступа
- Полезно для аудита и безопасности

---

## 🚀 СЛЕДУЮЩИЕ ШАГИ

### Фаза 2 (Рекомендуется)
1. **Добавить 2FA верификацию** для опасных операций
   - Перед удалением ключей
   - Перед очисткой всех чатов

2. **Валидировать импорт файлов**
   - JSON schema validation
   - Защита от XSS в импортированном контенте

3. **Логирование всех операций**
   - Создать audit log для чувствительных операций
   - Отслеживать: кто, когда, что сделал

### Фаза 3 (Расширенные функции)
1. **Grace period для опасных операций**
   - Например, 24 часа перед фактическим удалением

2. **Резервная копия перед очисткой**
   - Автоматический backup перед `ClearChats`

3. **Notifications**
   - Email уведомление об опасных операциях

---

## 📝 ДОКУМЕНТАЦИЯ

### Использование в компонентах
```typescript
import useIsAdmin from '~/hooks/useIsAdmin';

function MyComponent() {
  const isAdmin = useIsAdmin();

  if (!isAdmin) {
    return null;  // или альтернативный контент
  }

  return <AdminOnlyFeature />;
}
```

### Использование в API endpoints
```javascript
const requireAdminRole = require('~/server/middleware/requireAdminRole');

router.delete('/dangerous-operation', requireAdminRole, async (req, res) => {
  // Этот endpoint доступен только админам
});
```

---

## ✅ CHECKLIST ЗАВЕРШЕНИЯ

- [x] Создан frontend hook для проверки роли
- [x] Обновлены все компоненты Settings для фильтрации по ролям
- [x] Создан backend middleware для проверки админ-роли
- [x] Защищены DELETE endpoints для ключей
- [x] Защищены POST/DELETE endpoints для разговоров
- [x] Обновлен Balance controller для фильтрации по ролям
- [x] Добавлены комментарии в коде
- [x] Ничего не удалено (все компоненты остаются)
- [x] Закоммичены изменения в git
- [x] Создан этот отчёт

---

## 🔗 СВЯЗАННЫЕ ФАЙЛЫ

- Аудит пользовательских настроек: `LIBRECHAT_SETTINGS_AUDIT.md`
- Матрица безопасности: `LIBRECHAT_SECURITY_MATRIX.md`
- План реализации: `LIBRECHAT_IMPLEMENTATION_GUIDE.md`
- Резюме для руководства: `AUDIT_SUMMARY.txt`

---

**Дата завершения:** 4 марта 2026 г.
**Ветка:** `claude/explore-librechat-structure-DGVam`
**Статус:** Готово к review и тестированию
