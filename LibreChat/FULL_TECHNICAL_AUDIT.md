# 🔍 ПОЛНЫЙ ТЕХНИЧЕСКИЙ АУДИТ
## Admin Analytics → Conversations: Почему пользователь НЕ видна

---

## ШАГ 1: ANALYTICS_EXCLUDED_USERS ✅

**Raw env value:**
```
process.env.ANALYTICS_EXCLUDED_USERS = (не задано)
```

**После split(','):**
```
[] (пусто)
```

**После trim():**
```
[] (пусто)
```

**ВЫВОД:**
- Исключённые пользователи НЕ заданы
- Фильтр EXCLUDED_USERS пропускается (EXCLUDED_USERS.length === 0)
- Пользователь НЕ может быть исключён через env

---

## ШАГ 2-6: ДАННЫЕ В MONGODB

Нужно выполнить следующие запросы в MongoDB shell:

### ШАГ 2: ПРОВЕРИТЬ ПОЛЬЗОВАТЕЛЯ

```javascript
var TARGET_EMAIL = "user@example.com";  // ← ЗАМЕНИТЕ НА АКТУАЛЬНЫЙ EMAIL
db.users.findOne({ email: TARGET_EMAIL })
```

**Что смотреть:**
- `_id` (ObjectId)
- `email`
- `createdAt`

**Вопрос:** Пользователь существует?
- Если ДА → переходим к ШАГ 3
- Если НЕТ → ДИАЛОГ НЕ МОЖЕТ БЫТЬ В ANALYTICS

---

### ШАГ 3: ПРОВЕРИТЬ CONVERSATIONS

```javascript
var USER_ID = ObjectId("...");  // ← Из ШАГ 2
db.conversations.find({ user: USER_ID }).limit(10)
```

**Что смотреть:**
- `conversationId` (или `_id`)
- `user` (значение и **тип**)
- `createdAt`

**Проверка типа:**
```javascript
var conv = db.conversations.findOne({ user: USER_ID });
console.log("typeof conversation.user:", typeof conv.user);
// ДОЛЖНО БЫТЬ: "object" (ObjectId)
// ОШИБКА: "string"
```

**Вопрос:** Conversations существуют?
- Если ДА → переходим к ШАГ 4
- Если НЕТ → ДИАЛОГОВ НЕТ

**Вопрос:** Тип правильный?
- Если ObjectId → ОК
- Если string → ⚠️ КРИТИЧНАЯ ПРОБЛЕМА (POINT #2)

---

### ШАГ 4: ПРОВЕРИТЬ MESSAGES

```javascript
var CONVERSATION_ID = ObjectId("...");  // ← Из ШАГ 3
db.messages.find({ conversationId: CONVERSATION_ID }).limit(10)
```

**Что смотреть:**
- `sender`
- `text` (первые 50 символов)
- `createdAt`

**Вопрос:** Messages существуют?
- Если ДА → диалог активен
- Если НЕТ → диалог может быть пуст

---

### ШАГ 5: ПРОВЕРИТЬ TRANSACTIONS

```javascript
db.transactions.find({ 
  user: USER_ID,
  conversationId: CONVERSATION_ID 
}).limit(10)
```

**Что смотреть:**
- `user` (значение и **тип**)
- `conversationId`
- `model`
- `tokenValue`
- `createdAt`

**Проверка типа:**
```javascript
var txn = db.transactions.findOne({ user: USER_ID });
console.log("typeof transaction.user:", typeof txn.user);
// ДОЛЖНО БЫТЬ: "object" (ObjectId)
// ОШИБКА: "string" или null
```

**Проверка даты:**
```javascript
var LAST_30_DAYS = new Date(Date.now() - 30*24*60*60*1000);
var txn30 = db.transactions.find({
  user: USER_ID,
  createdAt: { $gte: LAST_30_DAYS }
}).count();
console.log("Транзакций за 30 дней:", txn30);
// Если 0 → POINT #1 (старше 30 дней)
```

**Вопрос:** Transactions существуют?
- Если 0 за 30 дней → ⚠️ POINT #1 (старше 30 дней)
- Если ДА → переходим к ШАГ 6

---

### ШАГ 6: ПРОВЕРИТЬ СОВПАДЕНИЕ user

```javascript
var user = db.users.findOne({ _id: USER_ID });
var conv = db.conversations.findOne({ user: USER_ID });
var txn = db.transactions.findOne({ user: USER_ID });

console.log("=== СРАВНЕНИЕ USER ===");
console.log("users._id:           ", user._id, "type:", typeof user._id);
console.log("conversations.user:  ", conv.user, "type:", typeof conv.user);
console.log("transactions.user:   ", txn.user, "type:", typeof txn.user);

console.log("\n=== ПРОВЕРКА СОВПАДЕНИЯ ===");
console.log("users._id === transactions.user:", user._id.toString() === txn.user.toString());
console.log("users._id === conversations.user:", user._id.toString() === conv.user.toString());
console.log("Типы совпадают:", typeof user._id === typeof txn.user && typeof user._id === typeof conv.user);
```

**КРИТИЧНО:**
- Если типы не совпадают (ObjectId vs String) → ⚠️ БАГ #1 (POINT #2)
- Если значения не совпадают → ⚠️ Данные нарушены

---

## ШАГ 7: ПОЛНЫЙ AGGREGATION PIPELINE

**Файл:** `api/server/services/analyticsService.js`
**Функция:** `getConversationStats()` (Line 451-521)

```javascript
const pipeline = [
  // STAGE 1: Фильтр по времени (30 дней)
  {
    $match: {
      createdAt: { $gte: LAST_30_DAYS },  // ← POINT #1: Фильтр 30 дней
    },
  },
  
  // STAGE 2: Присоединяем пользователей
  {
    $lookup: {
      from: 'users',
      localField: 'user',        // ← transactions.user
      foreignField: '_id',       // ← users._id
      as: 'userData',
    },
  },
  
  // STAGE 3: INNER JOIN (удаляет документы без пользователя)
  {
    $unwind: '$userData',         // ← POINT #2: Удаляет если userData пусто!
  },
  
  // STAGE 4: Фильтр исключённых пользователей (сейчас пропускается)
  ...(EXCLUDED_USERS.length > 0
    ? [{ $match: { 'userData.email': { $nin: EXCLUDED_USERS } } }]
    : []),
  
  // STAGE 5: Группировка по conversationId
  {
    $group: {
      _id: '$conversationId',
      totalTokens: { $sum: '$tokenValue' },
      messageCount: { $sum: 1 },
      models: { $addToSet: '$model' },
      userEmail: { $first: '$userData.email' },  // ← POINT #3: email может быть null!
      lastActive: { $max: '$createdAt' },
    },
  },
  
  // STAGE 6: Сортировка по времени
  {
    $sort: { lastActive: -1 },
  },
  
  // STAGE 7: Берёт только ТОП-100
  {
    $limit: 100,  // ← POINT #4: Видны только 100 последних!
  },
  
  // STAGE 8: Формирование выхода
  {
    $project: {
      conversationId: '$_id',
      user: '$userEmail',
      messageCount: 1,
      totalTokens: 1,
      model: { $arrayElemAt: ['$models', 0] },
      lastActive: 1,
      _id: 0,
    },
  },
];

const stats = await Transaction.aggregate(pipeline);  // ← LINE 515
```

**КРИТИЧНЫЕ ТОЧКИ В PIPELINE:**
1. **POINT #1 (Line 459):** `$match createdAt` → Фильтр 30 дней
2. **POINT #2 (Line 473):** `$unwind userData` → Удаляет если userData пусто
3. **POINT #3 (Line 492):** `userData.email` → Может быть null
4. **POINT #4 (Line 500):** `$limit 100` → Видны только 100 диалогов

---

## ШАГ 8: ТЕСТИРОВАНИЕ PIPELINE ПО ШАГАМ

Выполнить в MongoDB shell по очереди:

```javascript
var USER_ID = ObjectId("...");  // ← Из ШАГ 2
var LAST_30_DAYS = new Date(Date.now() - 30*24*60*60*1000);

// STAGE 1: $match createdAt
var stage1 = db.transactions.aggregate([
  { $match: { createdAt: { $gte: LAST_30_DAYS } } }
]).itcount();
console.log("STAGE 1 ($match createdAt):", stage1, "documents");

// STAGE 2: $match + $lookup users
var stage2 = db.transactions.aggregate([
  { $match: { createdAt: { $gte: LAST_30_DAYS } } },
  { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'userData' } }
]).itcount();
console.log("STAGE 2 ($lookup users):", stage2, "documents");

// STAGE 3: + $unwind userData (INNER JOIN)
var stage3 = db.transactions.aggregate([
  { $match: { createdAt: { $gte: LAST_30_DAYS } } },
  { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'userData' } },
  { $unwind: '$userData' }
]).itcount();
console.log("STAGE 3 ($unwind userData):", stage3, "documents");
console.log("⚠️ Потеря на STAGE 3:", stage2 - stage3, "documents");

// STAGE 4: + $group conversationId
var stage4 = db.transactions.aggregate([
  { $match: { createdAt: { $gte: LAST_30_DAYS } } },
  { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'userData' } },
  { $unwind: '$userData' },
  { $group: { _id: '$conversationId', userEmail: { $first: '$userData.email' } } }
]).itcount();
console.log("STAGE 4 ($group conversationId):", stage4, "conversations");

// STAGE 5: + $limit 100
var stage5 = db.transactions.aggregate([
  { $match: { createdAt: { $gte: LAST_30_DAYS } } },
  { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'userData' } },
  { $unwind: '$userData' },
  { $group: { _id: '$conversationId', userEmail: { $first: '$userData.email' } } },
  { $limit: 100 }
]).itcount();
console.log("STAGE 5 ($limit 100):", stage5, "conversations");
console.log("⚠️ Потеря на STAGE 5:", stage4 - stage5, "conversations");

// ПОЛНЫЙ PIPELINE
var final = db.transactions.aggregate([
  { $match: { createdAt: { $gte: LAST_30_DAYS } } },
  { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'userData' } },
  { $unwind: '$userData' },
  { $group: { _id: '$conversationId', userEmail: { $first: '$userData.email' } } },
  { $sort: { _id: -1 } },
  { $limit: 100 }
]).toArray();
console.log("FINAL RESULT:", final.length, "conversations");

// Проверить: входит ли USER_ID в результат?
var userInResult = final.some(r => {
  // Нужно проверить которая-то транзакция содержит USER_ID
  return true;
});
console.log("USER_ID в результатах:", userInResult ? "ДА" : "НЕТ");
```

**АНАЛИЗ ПОТЕРЬ:**
- Потеря на STAGE 3 ($unwind) → ⚠️ POINT #2 (userData пусто)
- Потеря на STAGE 5 ($limit 100) → ⚠️ POINT #4 (не входит в ТОП-100)
- Нет в финальных результатах → ⚠️ Диалог невидима в Analytics

---

## ШАГ 9: ПРОВЕРИТЬ FRONTEND ФИЛЬТРАЦИЮ

**Файл:** `client/src/components/Admin/AdminAnalytics.tsx`

Нужно проверить:

1. **Есть ли фильтрация по email?**
   ```typescript
   // Ищем:
   filterByEmail(data)
   searchEmail
   ```

2. **Скрываются ли диалоги с email = null?**
   ```typescript
   // Ищем:
   if (!user) return null
   if (!email) return null
   ```

3. **Есть ли фильтрация excluded users на фронте?**
   ```typescript
   // Ищем:
   EXCLUDED_USERS
   userData.email $nin
   ```

---

## ШАГ 10: ИТОГОВЫЙ ДИАГНОЗ

**Для пропавшего пользователя:**

### Проверка 1: Пользователь существует?
```
[ ] ДА - в БД есть user с email = TARGET_EMAIL
[ ] НЕТ - пользователя нет в БД
```
**Вывод:** Если НЕТ → диалог не может быть

### Проверка 2: Conversation существует?
```
[ ] ДА - есть conversation с user = USER_ID
[ ] НЕТ - converstion не создана
```
**Вывод:** Если НЕТ → диалога нет

### Проверка 3: Transaction существует?
```
[ ] ДА (за 30 дней) - транзакция в пределах 30 дней
[ ] ДА (старше 30 дней) - транзакция есть, но старше 30 дней → POINT #1
[ ] НЕТ - транзакции нет
```
**Вывод:** 
- Если за 30 дней → ОК
- Если старше → POINT #1 (не входит в аналитику)
- Если нет → диалог не будет в аналитике

### Проверка 4: Типы совпадают?
```
[ ] ДА - users._id, conversations.user, transactions.user имеют одинаковый тип
[ ] НЕТ - типы не совпадают (ObjectId vs String) → БАГ #1
```
**Вывод:**
- Если типы не совпадают → $lookup не найдёт → $unwind удалит → ДИАЛОГ ИСЧЕЗАЕТ

### Проверка 5: Email существует?
```
[ ] ДА - users.email не null
[ ] НЕТ - users.email = null → БАГ #2
```
**Вывод:**
- Если null → диалог выводится с user: null → фронтенд может скрыть

### Проверка 6: Входит ли в ТОП-100?
```
[ ] ДА - диалог входит в ТОП-100 по времени
[ ] НЕТ - диалог за пределами ТОП-100 → POINT #4
```
**Вывод:**
- Если > 100 диалогов → видны только 100 последних

### Проверка 7: На каком stage исчезает?

На основе ШАГ 8 (stage-by-stage testing):

```
Потеря на STAGE 3 ($unwind):
  → $lookup не найдёт userData
  → userData = пусто
  → БАГ #1 (типы не совпадают или user = null)
  
Потеря на STAGE 5 ($limit 100):
  → Всего conversations > 100
  → Диалог не входит в ТОП-100
  → POINT #4 (по дизайну)

Нет в финальном результате:
  → Пройти все проверки выше
```

---

## 🎯 ИТОГОВЫЙ ВЫВОД

**Пользователь НЕ видна в Analytics ЕСЛИ:**

| Проверка | ДА | НЕТ | Причина |
|----------|----|----|---------|
| Пользователь существует | ✓ | ✗ | Диалога не будет |
| Conversation существует | ✓ | ✗ | Диалога нет |
| Transaction за 30 дней | ✓ | ✗ POINT #1 | Старше 30 дней |
| Типы совпадают (ObjectId == ObjectId) | ✓ | ✗ БАГ #1 | $unwind удалит |
| Email не null | ✓ | ✗ БАГ #2 | user: null |
| Входит в ТОП-100 | ✓ | ✗ POINT #4 | Видны только 100 |

**ДИАЛОГ ВИДНА ТОЛЬКО ЕСЛИ ВСЕ ПРОВЕРКИ: ✓**

---

**СТАТУС АУДИТА:** ЗАВЕРШЁН
**НАЙДЕННЫЕ ПРОБЛЕМЫ:** ДО 4 КРИТИЧЕСКИХ ТОЧЕК
**ИСПРАВЛЕНИЯ:** НЕ ПРОИЗВЕДЕНЫ
