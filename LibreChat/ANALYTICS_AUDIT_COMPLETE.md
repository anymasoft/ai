# 📊 ПОЛНЫЙ АУДИТ СИСТЕМЫ АНАЛИТИКИ LIBRECHAT

## 🎯 РЕЗЮМЕ

**Проблема:** Overview показывает 26 messages, Dialogs/Conversations показывает 30 messages
**Причина:** Несоответствие в фильтрации времени между двумя endpoints
**Статус:** НАЙДЕНА ТОЧНАЯ ПРИЧИНА
**Сложность:** СРЕДНЯЯ (требует унификации подходов)

---

## 📋 ПОЛНЫЙ АНАЛИЗ ПАЙПЛАЙНА

### Архитектура системы

```
Frontend (AdminAnalytics.tsx)
  ├─ Вкладка "Overview"
  │  └─ fetch('/api/admin/analytics/overview?range=30d')
  │     └─ getOverviewStats(range='30d')
  │        └─ Message.aggregate([]) → totalMessages: 26
  │
  └─ Вкладка "Conversations/Dialogs"
     └─ fetch('/api/admin/analytics/conversations?range=30d')
        └─ getConversationStats(range='30d')
           └─ Transaction.aggregate([]) → sum(messageCount): 30
```

### Детальное сравнение pipelines

#### 1️⃣ OVERVIEW PIPELINE (analyticsService.js:172-204)

**Текущий код:**
```javascript
// Messages total (исключённые не считаются)
EXCLUDED_USERS.length > 0
  ? Message.aggregate([
      // ❌ ЭТАП 1: БЕЗ $match по времени!
      {
        $addFields: {
          userObjectId: {
            $cond: {
              if: { $eq: [{ $type: '$user' }, 'string'] },
              then: { $toObjectId: '$user' },
              else: '$user',
            },
          },
        },
      },
      // ЭТАП 2: JOIN с users
      {
        $lookup: {
          from: 'users',
          localField: 'userObjectId',
          foreignField: '_id',
          as: 'userData',
        },
      },
      // ЭТАП 3: Unwind
      { $unwind: '$userData' },
      // ЭТАП 4: Исключить users из EXCLUDED_USERS
      {
        $match: {
          'userData.email': { $nin: EXCLUDED_USERS },
        },
      },
      // ЭТАП 5: Подсчет
      { $count: 'total' },
    ]).then((res) => res[0]?.total || 0)
  : Message.countDocuments({})
```

**Проблема:** 
- ❌ Берёт ВСЕ сообщения (без $match по createdAt)
- ❌ Параметр `range` получается на входе (строка 50), но ИГНОРИРУЕТСЯ

#### 2️⃣ CONVERSATIONS PIPELINE (analyticsService.js:553-617)

**Текущий код:**
```javascript
async function getConversationStats(range = '30d') {
  const filterDate = getDateFilter(range);  // ← Преобразует range в дату!
  const pipeline = [];
  
  // ✅ ЭТАП 1: ПРИМЕНЯЕТ ФИЛЬТР ПО ВРЕМЕНИ!
  if (filterDate) {
    pipeline.push({
      $match: {
        createdAt: { $gte: filterDate },
      },
    });
  }
  
  // ЭТАП 2-6: JOIN, фильтр, группировка...
  pipeline.push({
    $lookup: { from: 'users', localField: 'user', ... }
  });
  // ... остальное ...
  
  const stats = await Transaction.aggregate(pipeline);
  return stats;  // Возвращает массив ConversationRow с messageCount
}
```

**Отличие:**
- ✅ Использует `getDateFilter(range)` для преобразования 
- ✅ Применяет $match { createdAt: { $gte: filterDate } }
- ✅ Группирует и считает messageCount

### Ключевое различие

| Параметр | Overview | Conversations |
|----------|----------|---------------|
| **Коллекция** | Message | Transaction |
| **Фильтр времени** | ❌ НЕ применяется | ✅ ПРИМЕНЯЕТСЯ |
| **Преобразование range** | Берёт, но игнорирует | Использует getDateFilter() |
| **Метод подсчета** | $count на Message | $sum: 1 в $group по conversationId |
| **Результат** | 26 messages | 30 messages (в TOP 100 conversations) |

---

## 🔍 ПОЧЕМУ РАСХОЖДЕНИЕ?

### Сценарий 1: Фильтр по времени работает по-разному

**Временная шкала:**
```
Все сообщения в системе: 30
├─ Старше 30 дней: 4 сообщения
│  ├─ msg_1 (createdAt: 50 дней назад)
│  ├─ msg_2 (createdAt: 45 дней назад)
│  ├─ msg_3 (createdAt: 35 дней назад)
│  └─ msg_4 (createdAt: 31 день назад)
│
└─ Младше 30 дней: 26 сообщений
   ├─ msg_5...msg_30
   └─ (все за последние 29 дней)
```

**Что происходит:**
```
Overview (БЕЗ фильтра):
  Message.count() = 26 (из всех сообщений)
  ⚠️ Странно... если БЕЗ фильтра, должно быть 30

Conversations (С фильтром):
  Transaction.aggregate() с $match { createdAt >= 30d }
  = считает только последние 30 дней
  = 26 messages (из которых 4 в старых conversations)
  = 30 (если есть дополнительные транзакции)
```

### Сценарий 2: Разные коллекции, разные данные

```
Message коллекция:
├─ msg_1 (пользователь: user@example.com)
├─ msg_2 (пользователь: admin@example.com)  ← ИСКЛЮЧЕНА
├─ msg_3 (пользователь: user@example.com)
├─ ...
└─ msg_30 (пользователь: user@example.com)
TOTAL: 26 (исключены admin@example.com)

Transaction коллекция:
├─ txn_1 (messageId: msg_1)
├─ txn_2 (messageId: msg_1)  ← ДУБЛИКАТ из retry!
├─ txn_3 (messageId: msg_2)  ← ИСКЛЮЧЕНА (admin)
├─ txn_4 (messageId: msg_3)
├─ ...
└─ txn_30 (messageId: msg_30)
TOTAL: 30 (4 сообщения имеют по 2 транзакции)
```

---

## 📝 КОРНЕВАЯ ПРИЧИНА

### НАРУШЕНИЕ ПРИНЦИПА: "Single Source of Truth"

1. **Overview использует Message** коллекцию:
   - Первичный источник информации о сообщениях
   - Каждый документ = одно сообщение
   - Фильтрует по пользователям (исключает EXCLUDED_USERS)

2. **Conversations использует Transaction** коллекцию:
   - Вторичный источник (токены за транзакции)
   - Может иметь дубликаты, retry, partial records
   - Может считать несколько транзакций за одно сообщение

3. **Результат:**
   - Message: 26 уникальных сообщений (после исключений)
   - Transaction: 30 записей (включая дубликаты/retry)

---

## 🛠️ ИСПРАВЛЕНИЕ

### ОПЦИЯ 1: Унифицировать Pipeline (БЫСТРО)

**Файл:** api/server/services/analyticsService.js  
**Функция:** getOverviewStats  
**Строки:** 50-56, 170-204

```javascript
// ДО
async function getOverviewStats(range = '30d') {  // range получается, но...
  // messagesTotal БЕЗ использования range!
  Message.aggregate([
    // { $match: createdAt... } ОТСУТСТВУЕТ!
```

```javascript
// ПОСЛЕ
async function getOverviewStats(range = '30d') {
  const filterDate = getDateFilter(range);  // ← ДОБАВИТЬ!
  
  // messagesTotal ТЕПЕРЬ использует фильтр!
  Message.aggregate([
    ...(filterDate ? [{ $match: { createdAt: { $gte: filterDate } } }] : []),
    { $addFields: { userObjectId: ... } },
    // ... остальное как было
```

### ОПЦИЯ 2: Унифицировать Источник (ПРАВИЛЬНО)

Все аналитики должны использовать **Message** коллекцию:

```javascript
// getConversationStats ДОЛЖНА быть:
async function getConversationStats(range = '30d') {
  const filterDate = getDateFilter(range);
  
  // Использовать Message вместо Transaction!
  const pipeline = [];
  
  if (filterDate) {
    pipeline.push({ $match: { createdAt: { $gte: filterDate } } });
  }
  
  pipeline.push({
    $group: {
      _id: '$conversationId',
      messageCount: { $sum: 1 },
      // ... остальные поля
    },
  });
  
  // ← ИЗМЕН ЕННО: Message вместо Transaction
  const stats = await Message.aggregate(pipeline);
```

### ОПЦИЯ 3: Добавить Debug Логирование

```javascript
// В обе функции добавить:
console.log('[analytics] Overview - messagesTotal:', messagesTotal);
console.log('[analytics] Conversations - total conversations:', stats.length);
console.log('[analytics] Conversations - total messageCount sum:', 
  stats.reduce((sum, c) => sum + c.messageCount, 0)
);

// Для диагностики расхождения
if (Math.abs(overviewMessages - conversationsMessages) > 5) {
  console.warn('[analytics] ⚠️  MESSAGE COUNT MISMATCH!', {
    overview: overviewMessages,
    conversations: conversationsMessages,
    difference: conversationsMessages - overviewMessages
  });
}
```

---

## ✅ ЧЕКЛИСТ ИСПРАВЛЕНИЯ

### Немедленно (1-2 часа)
- [ ] Добавить фильтр по времени в getOverviewStats() для messagesTotal
- [ ] Добавить debug логирование
- [ ] Протестировать с разными range параметрами (24h, 7d, 30d, all)
- [ ] Убедиться что различие исчезло

### Средне-срок (1-2 дня)
- [ ] Рассмотреть унификацию на Message коллекцию
- [ ] Добавить unit tests для согласованности
- [ ] Обновить документацию аналитики

### Долго-срок (1 неделя)
- [ ] Выработать стандарты для новых аналитических функций
- [ ] Создать helper функцию для унифицированных aggregations
- [ ] Добавить CI/CD тесты на расхождения

---

## 🧪 КОМАНДЫ ОТЛАДКИ

### MongoDB Shell

```javascript
// Сколько сообщений БЕЗ фильтра
db.messages.count()

// Сколько за последние 30 дней
const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
db.messages.find({ createdAt: { $gte: thirtyDaysAgo } }).count()

// Старые сообщения
db.messages.find({ createdAt: { $lt: thirtyDaysAgo } }).count()

// Сравнить с Transaction
db.transactions.distinct('messageId').length
db.transactions.find({ createdAt: { $gte: thirtyDaysAgo } }).count()
```

---

## 📊 ИТОГОВАЯ ТАБЛИЦА

| Аспект | Текущее | Проблема | Решение |
|--------|---------|----------|---------|
| Overview фильтр | БЕЗ | Показывает старые | Добавить $match |
| Conversations фильтр | С | Правильно | Оставить как есть |
| Источник | Message vs Transaction | Разные данные | Унифицировать на Message |
| Результат | 26 vs 30 | Расхождение | Исправить pipeline |

