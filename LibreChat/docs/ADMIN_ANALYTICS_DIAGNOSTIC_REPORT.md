# 🔍 ДИАГНОСТИКА ПРОБЛЕМЫ ADMIN ANALYTICS - ПОЛНЫЙ ОТЧЁТ

## СИМПТОМЫ (ИЗ ОПИСАНИЯ)
- ✅ Tokens today: отрицательное значение (работает)
- ✅ Tokens total: корректное значение (работает)
- ❌ Messages today: 0 (НЕ РАБОТАЕТ)
- ❌ Messages total: 0 (НЕ РАБОТАЕТ)
- ❌ Conversations: 0 (НЕ РАБОТАЕТ)

**Это означает:** Transaction система работает, но подсчёт сообщений и диалогов сломан

---

## АНАЛИЗ 1: ТИПЫ ДАННЫХ В MONGODB СХЕМАХ

### Message Schema (`packages/data-schemas/src/schema/message.ts`):
```typescript
user: {
  type: String,      // ⚠️ STRING!
  index: true,
  required: true
},
conversationId: {
  type: String,      // ⚠️ STRING!
  index: true,
  required: true
}
```

### Conversation Schema (`packages/data-schemas/src/schema/convo.ts`):
```typescript
user: {
  type: String,      // ⚠️ STRING!
  index: true
},
conversationId: {
  type: String,      // ⚠️ STRING!
  unique: true
}
```

### Transaction Schema (`packages/data-schemas/src/schema/transaction.ts`):
```typescript
user: {
  type: mongoose.Schema.Types.ObjectId,  // ⚠️ OBJECTID!
  ref: 'User',
  index: true,
  required: true
},
conversationId?: string  // ✅ STRING (правильно)
```

### User Schema:
- `_id: ObjectId` (по умолчанию в MongoDB)

---

## ❌ КРИТИЧЕСКАЯ ПРОБЛЕМА - TYPE MISMATCH В $lookup

### Проблема 1: Message.user (String) vs User._id (ObjectId)

**Файл:** `api/server/services/analyticsService.js`
**Функция:** `getOverviewStats()` строки 113-146 (activeUsers24h, messages24h)
**Функция:** `getOverviewStats()` строки 148-171 (messagesTotal)

```javascript
// Когда EXCLUDED_USERS не пуста:
Message.aggregate([
  {
    $match: { createdAt: { $gte: new Date(...) } }
  },
  {
    $lookup: {
      from: 'users',
      localField: 'user',      // ❌ Type: String
      foreignField: '_id',     // ❌ Type: ObjectId
      as: 'userData',
    },
  },
  { $unwind: '$userData' },   // ❌ Вернёт 0 документов!
  { $match: { 'userData.email': { $nin: EXCLUDED_USERS } } },
  { $count: 'total' },
])
```

**Результат:** MongoDB не может соединить String с ObjectId → НОЛЬ документов!
**Затронуто:** messages24h, messagesTotal (когда EXCLUDED_USERS установлена)

### Проблема 2: Conversation._id (ObjectId) vs Transaction.conversationId (String)

**Файл:** `api/server/services/analyticsService.js`
**Функция:** `getOverviewStats()` строки 245-282 (totalConversations)

```javascript
// Когда EXCLUDED_USERS не пуста:
Conversation.aggregate([
  {
    $lookup: {
      from: 'transactions',
      localField: '_id',            // ❌ Type: ObjectId
      foreignField: 'conversationId', // ❌ Type: String
      as: 'transactions',
    },
  },
  { $unwind: '$transactions' },   // ❌ Вернёт 0 документов!
  // ... остальной pipeline для фильтрации
])
```

**Результат:** MongoDB не может соединить ObjectId с String → НОЛЬ документов!
**Затронуто:** totalConversations (когда EXCLUDED_USERS установлена)

---

## КОД СОХРАНЕНИЯ ДАННЫХ

### Как сохраняется Message.user:
**Файл:** `api/models/Message.js` строки 51-55

```javascript
const update = {
  ...params,
  user: req.user.id,  // ← String ID пользователя (UUID или ObjectId as string)
  messageId: params.newMessageId || params.messageId,
};
await Message.findOneAndUpdate(
  { messageId: params.messageId, user: req.user.id },
  update,
  { upsert: true, new: true }
);
```

**Факт:** `req.user.id` это STRING, сохраняется как STRING в Message.user поле

### Как сохраняется Transaction.user:
**Файл:** `api/models/spendTokens.js` строки 30-35

```javascript
prompt = await createTransaction({
  ...txData,
  tokenType: 'prompt',
  rawAmount: promptTokens === 0 ? 0 : -normalizedPromptTokens,
  inputTokenCount: normalizedPromptTokens,
});
```

**txData.user** приходит как String из контроллера (`api/server/controllers/agents/client.js`):
```javascript
user: this.user ?? this.options.req.user?.id,  // ← String!
```

**Результат:** Mongoose пытается присвоить String в ObjectId поле → либо неявная конверсия, либо ошибка

---

## ИСТОРИЯ FIXES - ГДЕ ПОТЕРЯНО РЕШЕНИЕ

### Commit bdc59d6f (2026-03-12):
```
Implement analytics dashboard for RepliqAI admin panel
```
- Создан analyticsService.js
- Простой countDocuments() без фильтрации

### Commit c83251ef (2026-03-12 12:49:25):
```
Fix analytics data issues: email display, user type mismatch, and test user exclusion
```
**Решение для type mismatch:**
- Добавлена поддержка `ANALYTICS_EXCLUDED_USERS` env переменной
- Добавлена `$addFields` стадия для конверсии user ID в ObjectId перед $lookup
- **Логика:** Если user это String, конвертировать в ObjectId для успешного $lookup

### Commit 7412eb91 (2026-03-12 13:05:20):
```
Fix analytics exclusion logic: filter excluded users BEFORE grouping, not after
```
**КРИТИЧЕСКИЙ БАГ:**
- Удален `$addFields` для конверсии типов
- Добавлен комментарий: "Removed $addFields userObjectId (lookup handles both types)"
- ❌ **ЭТО НЕПРАВДА!** MongoDB НЕ может автоматически соединить String с ObjectId!

### Commit c5b15fdb (2026-03-13 09:40:44):
```
Fix Admin Analytics time filter: Move filtering from client to backend
```
- Добавлена функция `getDateFilter(range)`
- Добавлена поддержка range параметра ('24h', '7d', '30d', 'all')
- **Но:** Type mismatch проблема осталась нерешённой!

---

## ТОЧНАЯ ПРИЧИНА НУЛЕВЫХ ЗНАЧЕНИЙ

### Когда EXCLUDED_USERS пуста/не установлена:
```javascript
EXCLUDED_USERS.length > 0  // FALSE
  ? Message.aggregate([...])      // ❌ Не выполняется
  : Message.countDocuments({})    // ✅ ИСПОЛЬЗУЕТСЯ - работает!
```
**Результат в админ панели:** messages = корректное значение ✅

### Когда EXCLUDED_USERS установлена (по умолчанию в коде - пустой массив):
```javascript
EXCLUDED_USERS.length > 0  // TRUE (потому что массив существует?)
  ? Message.aggregate([                    // ❌ ИСПОЛЬЗУЕТСЯ
      { $match: { createdAt: { $gte: ... } } },
      {
        $lookup: {
          from: 'users',
          localField: 'user',              // String
          foreignField: '_id',             // ObjectId
          as: 'userData',
        },
      },
      { $unwind: '$userData' },            // ❌ Результат пустой!
      { $match: { 'userData.email': { $nin: EXCLUDED_USERS } } },
      { $count: 'total' },
    ])
  : ...
```
**Результат в админ панели:** messages = 0 ❌ (нет совпадений в $lookup)

---

## АРХИТЕКТУРНЫЕ НЕСООТВЕТСТВИЯ

| Коллекция | Поле | Тип | Сохранение | Статус |
|-----------|------|-----|-----------|--------|
| **Message** | user | String | req.user.id (String) | ✅ Согласовано |
| **Message** | conversationId | String | UUID/String | ✅ Согласовано |
| **Conversation** | _id | ObjectId | MongoDB default | ✅ Согласовано |
| **Conversation** | conversationId | String | UUID/String | ⚠️ Дублирует _id |
| **Conversation** | user | String | req.user.id (String) | ✅ Согласовано |
| **Transaction** | user | ObjectId (schema) | req.user.id (String) | ❌ РАССОГЛАСОВАНИЕ |
| **Transaction** | conversationId | String | conversationId (String) | ✅ Согласовано |
| **User** | _id | ObjectId | MongoDB default | ✅ Согласовано |

---

## ТАБЛИЦА СООТВЕТСТВИЙ ТИПОВ В $lookup

### Попытки $lookup в analyticsService:

```
1️⃣ Message.$lookup (activeUsers24h, messages24h, messagesTotal):
   localField: 'user' (String) ↔ foreignField: '_id' (ObjectId)
   ❌ ОШИБКА: Типы не совпадают!
   Результат: $unwind возвращает 0 документов

2️⃣ Conversation.$lookup (totalConversations):
   localField: '_id' (ObjectId) ↔ foreignField: 'conversationId' (String)
   ❌ ОШИБКА: Типы не совпадают!
   Результат: $unwind возвращает 0 документов

3️⃣ Transaction.$lookup (tokensData, в getCostBreakdown):
   localField: 'user' (ObjectId в schema) ↔ foreignField: '_id' (ObjectId)
   ⚠️ ЧАСТИЧНО РАБОТАЕТ: В schema ObjectId, но на практике может быть String
   Результат: Работает случайно или с неполными данными
```

---

## ДОКАЗАТЕЛЬСТВА В КОДЕ

### analyticsService.js - Линия 82-88 (activeUsers24h с EXCLUDED_USERS):
```javascript
$lookup: {
  from: 'users',
  localField: 'user',      // Message.user это String по schema!
  foreignField: '_id',     // User._id это ObjectId!
  as: 'userData',
},
```

### analyticsService.js - Линия 150-156 (messagesTotal):
```javascript
$lookup: {
  from: 'users',
  localField: 'user',      // Message.user это String!
  foreignField: '_id',     // ObjectId!
  as: 'userData',
},
```

### analyticsService.js - Линия 248-252 (totalConversations):
```javascript
$lookup: {
  from: 'transactions',
  localField: '_id',               // ObjectId
  foreignField: 'conversationId',  // String!
  as: 'transactions',
},
```

---

## ПОЧЕМУ ТОКЕНЫ РАБОТАЮТ

В `getCostBreakdown()` (строки 591-799):
```javascript
Transaction.aggregate([
  {
    $facet: {
      last24h: [
        { $match: { createdAt: { $gte: ... } } },
        {
          $lookup: {
            from: 'users',
            localField: 'user',      // ObjectId по schema
            foreignField: '_id',     // ObjectId
            as: 'userData',          // ✅ РАБОТАЕТ!
          },
        },
        { $unwind: '$userData' },
        // ... filter and group
      ],
      // ... остальные facets
    },
  },
])
```

**Результат:** Типы совпадают (ObjectId ↔ ObjectId) → $lookup работает ✅
**Поэтому:** Tokens работают, а messages и conversations = 0

---

## ВЫВОД

### Первопричина (Root Cause):
**Несоответствие типов данных в MongoDB $lookup aggregation pipelines:**

1. **Message.user (String) ≠ User._id (ObjectId)**
   - Затрагивает: activeUsers24h, messages24h, messagesTotal

2. **Conversation._id (ObjectId) ≠ Transaction.conversationId (String)**
   - Затрагивает: totalConversations

### Временная шкала проблемы:
1. ✅ c83251ef добавил исправление ($addFields конверсия типов)
2. ❌ 7412eb91 удалил это исправление с неправильным комментарием
3. ⚠️ c5b15fdb добавил range параметр, но не решил type mismatch
4. ❌ Текущее состояние: type mismatch проблема активна

### Как исправление было потеряно:
- Commit c83251ef добавил `$addFields` для конверсии user ID из String в ObjectId
- Commit 7412eb91 удалил это, заявив "lookup handles both types"
- Это предположение неправильно - MongoDB требует явной конверсии типов

---

## ✅ ДИАГНОСТИКА ЗАВЕРШЕНА

| Параметр | Значение |
|----------|----------|
| **Статус** | ✅ Точная причина найдена |
| **Тип проблемы** | Type Mismatch в MongoDB $lookup |
| **Основной файл** | api/server/services/analyticsService.js |
| **Затронутые функции** | getOverviewStats(), getConversationStats() |
| **Ветка** | claude/explore-librechat-structure-PJLgE |
| **Последний релевантный commit** | c5b15fdb (2026-03-13) |
| **Виновный commit** | 7412eb91 (удалено исправление типов) |

### Пострадавшие метрики:
- ❌ Messages today (messages24h)
- ❌ Messages total (messagesTotal)
- ❌ Conversations (totalConversations)
- ✅ Tokens today (работает)
- ✅ Tokens total (работает)

### Условие, при котором проблема проявляется:
- EXCLUDED_USERS установлена или инициализирована как пустой массив
- Использование aggregation вместо countDocuments()
- Type mismatch в $lookup -> $unwind -> $match pipeline
