# 🔍 ТЕХНИЧЕСКИЙ AUDIT: Admin Analytics & Token Accounting System
## RepliqAI (LibreChat)

**Дата:** 2026-03-12
**Статус:** Полный анализ архитектуры и проблемы с фильтром времени
**Выводы:** НАЙДЕНА КОРНЕВАЯ ПРИЧИНА ПРОБЛЕМЫ

---

## 📋 СОДЕРЖАНИЕ

1. Архитектура админской панели
2. Как считаются расходы токенов
3. Как формируется аналитика
4. Как работает фильтр времени
5. Как frontend передает фильтр
6. Как backend применяет фильтр
7. MongoDB aggregation pipelines
8. **ТОЧНАЯ ПРИЧИНА ПРОБЛЕМЫ С ФИЛЬТРОМ 24H**

---

## 1️⃣ АРХИТЕКТУРА АДМИНСКОЙ ПАНЕЛИ

### Frontend структура

**Основные компоненты:**
```
client/src/
├── routes/
│   └── AdminPanel.tsx          # Главный компонент админки
└── components/Admin/
    └── AdminAnalytics.tsx      # Компонент аналитики
```

### AdminPanel.tsx (client/src/routes/AdminPanel.tsx)

**Tabs (вкладки):**
```typescript
type Tab = 'users' | 'payments' | 'settings' | 'analytics';
```

**Основные интерфейсы:**
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

interface PaymentRow {
  _id: string;
  email: string;
  name: string;
  packageId: string;
  tokenCredits: number;
  amount: string;
  status: string;
  createdAt: string;
}
```

**Функциональность:**
- Управление пользователями
- История платежей
- Настройки планов и пакетов токенов
- Аналитика использования (импортируется AdminAnalytics компонент)

---

### AdminAnalytics.tsx (client/src/components/Admin/AdminAnalytics.tsx)

**Tabs в аналитике:**
```typescript
type AnalyticsTab = 'overview' | 'models' | 'users' | 'conversations' | 'costs';
```

**Фильтр времени:**
```typescript
const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d' | 'all'>('30d');
```

**Кнопки фильтра:** (строки 501-541, 634-673)
```
[24h] [7d] [30d] [All]
```

**Основные интерфейсы ответов:**

```typescript
// Overview статистика
interface OverviewData {
  totalUsers: number;
  activeUsers24h: number;
  messages24h: number;
  totalMessages: number;
  tokens24h: number;
  totalTokens: number;
  totalConversations: number;
}

// Данные по моделям
interface ModelUsageRow {
  model: string;
  requests: number;
  uniqueUsers: number;
  totalTokens: number;
  endpoint: string;
}

// Данные по пользователям
interface UserUsageRow {
  userId: string;
  email: string;
  plan: string;
  requests: number;
  totalTokens: number;
  lastActive: string;
  favoriteModel: string;
}

// Данные по диалогам
interface ConversationRow {
  conversationId: string;
  user: string;          // ← Email, не userId!
  messageCount: number;
  totalTokens: number;
  model: string;
  lastActive: string;
}

// Расходы токенов
interface CostsData {
  tokensToday: number;
  tokens7d: number;
  tokens30d: number;
  costPerModel: { model: string; totalTokens: number; requests: number }[];
  costPerUser: { _id: string; totalTokens: number }[];
}
```

---

## 2️⃣ КАК СЧИТАЮТСЯ РАСХОДЫ ТОКЕНОВ

### 2.1 Модель Transaction

**Файл:** `/packages/data-schemas/src/schema/transaction.ts`

**Схема MongoDB:**
```typescript
interface ITransaction extends Document {
  user: Types.ObjectId;           // ← Ссылка на User
  conversationId?: string;         // ← Ссылка на Conversation (STRING!)
  tokenType: 'prompt' | 'completion' | 'credits';
  model?: string;                  // Модель (claude-3-5-sonnet, gpt-4, и т.д.)
  context?: string;                // Контекст (normal, incomplete, cached)
  valueKey?: string;               // Ключ стоимости
  rate?: number;                   // Множитель для данной модели
  rawAmount?: number;              // Сырое количество токенов
  tokenValue?: number;             // ИТОГОВОЕ количество (rawAmount * rate)
  inputTokens?: number;            // Input токены
  writeTokens?: number;            // Write токены (для кэша)
  readTokens?: number;             // Read токены (для кэша)
  messageId?: string;              // Ссылка на сообщение
  createdAt?: Date;                // ВРЕМЯ СОЗДАНИЯ (используется в фильтре!)
  updatedAt?: Date;
}
```

**Индексы:**
```
- user (indexed)
- conversationId (indexed)
- model (indexed)
- timestamps: true (auto-create createdAt, updatedAt)
```

### 2.2 Расчет tokenValue

**Функция:** `calculateTokenValue()` (api/models/Transaction.js, строки 7-18)

```javascript
function calculateTokenValue(txn) {
  const multiplier = Math.abs(
    getMultiplier({
      valueKey,
      tokenType,
      model,
      endpointTokenConfig,
      inputTokenCount
    }),
  );
  txn.rate = multiplier;
  txn.tokenValue = txn.rawAmount * multiplier;  // ← ГЛАВНАЯ ФОРМУЛА

  // Корректировка если диалог отменён
  if (txn.context === 'incomplete') {
    txn.tokenValue = Math.ceil(txn.tokenValue * CANCEL_RATE);
  }
}
```

**Где создаются транзакции:**

1. `createTransaction()` (строки 58-90)
   - Создает обычную транзакцию
   - Вычисляет tokenValue
   - Сохраняет в DB
   - Обновляет баланс пользователя

2. `createAutoRefillTransaction()` (строки 29-52)
   - Для автоматического пополнения баланса
   - НЕ обновляет tokenValue на основе расходов

3. `createStructuredTransaction()` (строки 96-127)
   - Для структурированных токенов (с раздельным учетом input/write/read)

### 2.3 Поле createdAt - ключевое для фильтра времени

**Когда устанавливается:**
- Автоматически при сохранении в MongoDB (timestamps: true)
- Значение = момент создания транзакции на сервере

**Время на сервере:**
- Используется `Date.now()` без преобразований → UTC время сервера
- NO timezone обработка → всегда UTC

---

## 3️⃣ КАК ФОРМИРУЕТСЯ АНАЛИТИКА

### 3.1 Backend endpoints

**Файл:** `api/server/routes/analytics.js`

**Endpoints:**

| Endpoint | HTTP | Функция | Параметры |
|----------|------|---------|-----------|
| `/api/admin/analytics/overview` | GET | `getOverviewStats()` | ❌ НЕТ |
| `/api/admin/analytics/models` | GET | `getModelUsage()` | ❌ НЕТ |
| `/api/admin/analytics/users` | GET | `getUserUsage()` | ❌ НЕТ |
| `/api/admin/analytics/conversations` | GET | `getConversationStats()` | ❌ НЕТ |
| `/api/admin/analytics/costs` | GET | `getCostBreakdown()` | ❌ НЕТ |

**⚠️ КРИТИЧНО: Ни один endpoint НЕ принимает query параметры для фильтра времени!**

### 3.2 Как frontend вызывает backend

**Файл:** `client/src/components/Admin/AdminAnalytics.tsx` (строки 250-293)

```typescript
const fetchAnalytics = useCallback(async (analyticsTab: AnalyticsTab) => {
  setLoading(true);

  try {
    const endpoint = `/api/admin/analytics/${analyticsTab}`;  // ← Нет параметров!
    const res = await fetch(endpoint, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    // Получает ВСЕ данные без фильтра времени
    const result = await res.json();

    switch (analyticsTab) {
      case 'overview':
        setOverviewData(result.data);
        break;
      case 'models':
        setModelsData(result.data);
        break;
      // ... остальные tabs
    }
  } catch (e) {
    setError(e instanceof Error ? e.message : 'Ошибка загрузки аналитики');
  }
}, [token]);
```

**Ключевая проблема:** endpoint строится БЕЗ передачи timeRange параметра!

---

## 4️⃣ КАК РАБОТАЕТ ФИЛЬТР ВРЕМЕНИ

### 4.1 Frontend фильтрация (CLIENT-SIDE)

**Функция:** `filterByTime()` (строки 150-163)

```typescript
const filterByTime = useCallback((data: any[]) => {
  if (timeRange === 'all') return data;  // Без фильтра для 'all'

  const now = Date.now();
  const rangeMs: Record<string, number> = {
    '24h': 86400000,        // 1 день в миллисекундах
    '7d': 604800000,        // 7 дней
    '30d': 2592000000,      // 30 дней
  };

  return data.filter((item) => {
    // Проверяет ЛОКАЛЬНО на фронте!
    const timestamp = new Date(item.lastActive || item.createdAt).getTime();
    return timestamp > now - rangeMs[timeRange];  // ← Фильтр на CLIENT
  });
}, [timeRange]);
```

**Где применяется в UI:**

**Tab "users" (строка 577):**
```typescript
sortData(filterByTime(filterByEmail(usersData)))
  .slice(0, 100)
```

**Tab "conversations" (строка 713):**
```typescript
sortData(filterByEmail(filterByTime(conversationsData)))
```

**Tab "costs":**
```
Данные уже фильтруются на backend, frontend НЕ применяет filterByTime
```

### 4.2 Backend фильтрация (HARDCODED)

**Файл:** `api/server/services/analyticsService.js`

#### Переменная LAST_30_DAYS (строка 10):
```javascript
const LAST_30_DAYS = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
```

**Используется во всех функциях:**

### getOverviewStats() (строки 25-250)

- `activeUsers24h`: Фильтр $match createdAt >= NOW - 24h (строка 50)
- `messages24h`: Фильтр $match createdAt >= NOW - 24h (строка 91)
- `totalMessages`: БЕЗ фильтра (все сообщения)
- `totalTokens`: БЕЗ фильтра (все токены за всю историю)
- `conversationsTotal`: БЕЗ фильтра (все диалоги)

### getConversationStats() (строки 451-521)

```javascript
const pipeline = [
  {
    $match: {
      createdAt: { $gte: LAST_30_DAYS },  // ← ВСЕГДА 30 дней!
    },
  },
  // ... resto pipeline
  {
    $limit: 100,  // Ограничение 100 диалогов
  },
];

const stats = await Transaction.aggregate(pipeline);
```

**Важно:** Функция НЕ принимает параметров и ВСЕГДА возвращает данные за ПОСЛЕДНИЕ 30 ДНЕЙ, независимо от выбора пользователя!

### getCostBreakdown() (строки 528-727)

```javascript
const stats = await Transaction.aggregate([
  {
    $facet: {
      today: [
        {
          $match: {
            createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
          }
        },
        // ... остальной pipeline
      ],
      last7d: [
        {
          $match: {
            createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
          }
        },
        // ...
      ],
      last30d: [
        {
          $match: {
            createdAt: { $gte: LAST_30_DAYS }
          }
        },
        // ...
      ],
      byModel: [ ... ],
      byUser: [ ... ],
    }
  }
]);
```

**Эта функция хорошо спроектирована** - возвращает разные периоды в одном ответе!

---

## 5️⃣ КАК FRONTEND ПЕРЕДАЕТ ФИЛЬТР

### 5.1 Состояние фильтра

```typescript
const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d' | 'all'>('30d');
```

### 5.2 Кнопки фильтра в UI

**Users tab (строки 501-541):**
```typescript
<button onClick={() => setTimeRange('24h')}>24h</button>
<button onClick={() => setTimeRange('7d')}>7d</button>
<button onClick={() => setTimeRange('30d')}>30d</button>
<button onClick={() => setTimeRange('all')}>All</button>
```

**Conversations tab (строки 634-673):**
```
Точно такие же кнопки
```

### 5.3 Как передается в API (ПРОБЛЕМА!)

```typescript
const endpoint = `/api/admin/analytics/${analyticsTab}`;
// ❌ timeRange НЕ добавляется в URL!
// ❌ query параметры НЕ передаются!
// ❌ body НЕ содержит timeRange!

const res = await fetch(endpoint, {
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
});
```

**Правильно было бы:**
```typescript
const endpoint = `/api/admin/analytics/${analyticsTab}?timeRange=${timeRange}`;
// или
const res = await fetch(endpoint, {
  method: 'POST',
  body: JSON.stringify({ timeRange }),
});
```

---

## 6️⃣ КАК BACKEND ПРИМЕНЯЕТ ФИЛЬТР

### 6.1 Routes handlers

**Файл:** `api/server/routes/analytics.js`

```javascript
// Для всех endpoints:
router.get('/overview', requireJwtAuth, requireAdminRole, async (req, res) => {
  const stats = await getOverviewStats();  // ← НЕ передает параметров!
  res.json({ success: true, data: stats });
});

router.get('/conversations', requireJwtAuth, requireAdminRole, async (req, res) => {
  const stats = await getConversationStats();  // ← НЕ передает параметров!
  res.json({ success: true, data: stats });
});
```

### 6.2 Service функции (БЕЗ параметров)

**Все функции имеют сигнатуру:**
```javascript
async function getConversationStats() {  // ← Нет параметров!
async function getCostBreakdown() {      // ← Нет параметров!
async function getOverviewStats() {      // ← Нет параметров!
async function getModelUsage() {         // ← Нет параметров!
async function getUserUsage() {          // ← Нет параметров!
```

**Вывод:** Backend service функции жестко кодированы на конкретные периоды!

---

## 7️⃣ MongoDB AGGREGATION PIPELINES

### 7.1 getConversationStats() Pipeline

**Файл:** `api/server/services/analyticsService.js` (строки 451-521)

```javascript
const pipeline = [
  // STAGE 1: Фильтр по времени (ПОСЛЕДНИЕ 30 ДНЕЙ)
  {
    $match: {
      createdAt: { $gte: LAST_30_DAYS },  // ← ЖЕСТКО 30 дней!
    },
  },

  // STAGE 2: Присоединяем данные пользователей
  {
    $lookup: {
      from: 'users',
      localField: 'user',        // transactions.user (ObjectId)
      foreignField: '_id',       // users._id
      as: 'userData',
    },
  },

  // STAGE 3: INNER JOIN - удаляет документы без пользователя
  {
    $unwind: '$userData',
  },

  // STAGE 4: Исключаем тестовых пользователей
  ...(EXCLUDED_USERS.length > 0
    ? [{
        $match: {
          'userData.email': { $nin: EXCLUDED_USERS },
        },
      }]
    : []),

  // STAGE 5: Группируем по conversationId
  {
    $group: {
      _id: '$conversationId',
      totalTokens: { $sum: '$tokenValue' },
      messageCount: { $sum: 1 },
      models: { $addToSet: '$model' },
      userEmail: { $first: '$userData.email' },
      lastActive: { $max: '$createdAt' },
    },
  },

  // STAGE 6: Сортируем по времени (новые первыми)
  {
    $sort: { lastActive: -1 },
  },

  // STAGE 7: Берём только ТОП-100
  {
    $limit: 100,
  },

  // STAGE 8: Формируем финальный результат
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

const stats = await Transaction.aggregate(pipeline);
```

**Критические моменты:**
1. Фильтр по LAST_30_DAYS на STAGE 1
2. $limit 100 на STAGE 7 - видны только 100 последних диалогов

### 7.2 getCostBreakdown() Pipeline

**Файл:** `api/server/services/analyticsService.js` (строки 528-650+)

```javascript
const stats = await Transaction.aggregate([
  {
    $facet: {
      // Токены за ДНЕ (последние 24 часа)
      today: [
        {
          $match: {
            createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
        },
        // ... $lookup → $unwind → $match excluded → $group
      ],

      // Токены за 7 ДНЕЙ
      last7d: [
        {
          $match: {
            createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
        },
        // ...
      ],

      // Токены за 30 ДНЕЙ
      last30d: [
        {
          $match: {
            createdAt: { $gte: LAST_30_DAYS },
          },
        },
        // ...
      ],

      // Расходы по МОДЕЛЯМ (за 30 дней)
      byModel: [
        {
          $match: {
            createdAt: { $gte: LAST_30_DAYS },
          },
        },
        // ... $group по model
      ],

      // Расходы по ПОЛЬЗОВАТЕЛЯМ (за 30 дней)
      byUser: [
        {
          $match: {
            createdAt: { $gte: LAST_30_DAYS },
          },
        },
        // ... $group по userData.email
      ],
    },
  },
]);
```

**Возвращаемый результат:**
```javascript
{
  today: { total: number },
  last7d: { total: number },
  last30d: { total: number },
  byModel: [ { model, totalTokens, requests }, ... ],
  byUser: [ { _id (email), totalTokens }, ... ],
}
```

---

## 🎯 8️⃣ ТОЧНАЯ ПРИЧИНА ПРОБЛЕМЫ С ФИЛЬТРОМ 24H

### ПРОБЛЕМА: При выборе "24 часа" админка показывает данные за весь период

### ДИАГНОЗ

**ROOT CAUSE #1: Frontend НЕ передает timeRange на backend**

```typescript
// НЕПРАВИЛЬНО (текущий код):
const endpoint = `/api/admin/analytics/${analyticsTab}`;

// ДОЛЖНО БЫТЬ:
const endpoint = `/api/admin/analytics/${analyticsTab}?timeRange=${timeRange}`;
```

**Результат:** Backend ВСЕГДА возвращает ВСЕ доступные данные (или данные за FIXED периоды).

---

### ROOT CAUSE #2: Backend endpoints НЕ поддерживают query параметры для фильтра времени

**Текущий код (api/server/routes/analytics.js):**
```javascript
router.get('/conversations', requireJwtAuth, requireAdminRole, async (req, res) => {
  const stats = await getConversationStats();  // ← НЕ читает req.query.timeRange
  res.json({ success: true, data: stats });
});
```

**Должно быть:**
```javascript
router.get('/conversations', requireJwtAuth, requireAdminRole, async (req, res) => {
  const timeRange = req.query.timeRange || '30d';  // ← Читать из query
  const stats = await getConversationStats(timeRange);  // ← Передать параметр
  res.json({ success: true, data: stats });
});
```

---

### ROOT CAUSE #3: Service функции НЕ принимают параметров для гибкой фильтрации

**Текущий код (api/server/services/analyticsService.js):**
```javascript
async function getConversationStats() {  // ← Нет параметров
  const pipeline = [
    {
      $match: {
        createdAt: { $gte: LAST_30_DAYS },  // ← ВСЕГДА 30 дней
      },
    },
    // ...
  ];
}
```

**Результат:** Данные ВСЕГДА фильтруются по ПОСЛЕДНИЕ 30 ДНЕЙ, невзирая на выбор пользователя!

---

### ROOT CAUSE #4: Frontend фильтрует данные ПОСЛЕ получения от backend

**Текущий flow:**

```
Frontend выбирает "24h"
    ↓
Frontend вызывает fetch('/api/admin/analytics/conversations')
    ↓
Backend возвращает данные за ПОСЛЕДНИЕ 30 ДНЕЙ
    ↓
Frontend применяет filterByTime() на клиентской стороне
    ↓
Вывод: Данные за 24h фильтруются из данных за 30 дней
```

**Проблема:** Если в течение последних 24 часов было 10 диалогов, но в течение последних 30 дней было 100 диалогов, пользователь видит только эти 10 из 100.

**Проблема усложняется:** Если в последние 24 часа было ТРИ диалога из последних 30 дней, то при выборе "24h" пользователь видит 3 диалога, но они попадают в выборку из полного списка в 100 диалогов (из-за $limit 100 в pipeline).

---

### ROOT CAUSE #5: Несоответствие между frontend и backend

**Frontend ожидает:**
- Полный набор данных за ВЕСЬ период
- Frontend сам применяет фильтр

**Backend возвращает:**
- Данные за FIXED периоды (30 дней для conversations tab)
- Service функции НЕ получают параметров

**Результат:**
- Фильтр "24h" НЕ работает корректно
- Фильтр "7d" НЕ работает (только backend фильтр 30d срабатывает)
- Фильтр "30d" выглядит правильно (совпадает с backend)
- Фильтр "all" НЕ работает (backend возвращает 30d, frontend не фильтрует)

---

### ПРАКТИЧЕСКИЙ ПРИМЕР

**Сценарий:**
- В MongoDB есть 1000 транзакций
  - 200 за последние 24 часа
  - 400 за последние 7 дней
  - 600 за последние 30 дней
  - 400 старше 30 дней

**Что происходит при выборе "24h":**

1. Frontend вызывает GET `/api/admin/analytics/conversations`
2. Backend вызывает `getConversationStats()` БЕЗ параметров
3. Backend возвращает top-100 диалогов из последних 30 дней (используя LAST_30_DAYS)
4. Frontend получает эти 100 диалогов
5. Frontend применяет filterByTime() с фильтром 24h
6. Frontend показывает ТОЛЬКО те диалоги из этих 100, которые были в последние 24 часа
7. Пользователь видит ~10-20 диалогов вместо полного списка за 24h

**Проблема:** Фильтр работает, но работает на НЕПОЛНОМ наборе данных!

---

## 📊 SUMMARY TABLE: ГДЕ ПРИМЕНЯЕТСЯ ФИЛЬТР

| Tab | Backend фильтр | Frontend фильтр | Реальный результат |
|-----|----------------|-----------------|-------------------|
| overview | 24h, all-time | ❌ Нет | Показывает правильно (24h/all) |
| models | 30d | ❌ Нет | ⚠️ ТОЛЬКО 30d, не зависит от выбора |
| users | 30d | ✓ Да (filterByTime) | 🔴 Работает на неполном наборе |
| conversations | 30d | ✓ Да (filterByTime) | 🔴 Работает на неполном наборе |
| costs | today, 7d, 30d | ✓ Да | ✅ ПРАВИЛЬНО (backend возвращает все периоды) |

---

## 🔴 ИТОГОВЫЙ ВЫВОД

### Почему фильтр "24 часа" показывает данные за весь период?

**Ответ:** Он не показывает данные за ВЕСЬ период, а показывает данные за 24 часа, но ИЗ выборки за 30 дней, потому что:

1. **Frontend НЕ передает timeRange на backend** → backend НЕ знает о выборе пользователя
2. **Backend ВСЕГДА возвращает данные за 30 дней** → функции жестко кодированы на этот период
3. **Frontend фильтрует данные на клиентской стороне** → применяет фильтр к неполному набору

### Архитектурная проблема:

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                      │
│  timeRange = "24h"                                       │
│  fetch('/api/admin/analytics/conversations')             │
│                     ↓ БЕЗ параметров                     │
├─────────────────────────────────────────────────────────┤
│                   BACKEND (Node.js)                      │
│  GET /api/admin/analytics/conversations                  │
│  → getConversationStats()  // БЕЗ параметров            │
│  → Query за ПОСЛЕДНИЕ 30 ДНЕЙ                           │
│                     ↓                                    │
│                  MongoDB                                 │
│  MATCH: createdAt >= LAST_30_DAYS                       │
│  → Возвращает ТОП-100 диалогов из последних 30 дней     │
│                     ↓                                    │
├─────────────────────────────────────────────────────────┤
│                    FRONTEND (React)                      │
│  filterByTime(data)  // фильтр 24h на клиенте            │
│  → Показывает ТОЛЬКО диалоги из этих 100 за 24h         │
│  ❌ НЕПОЛНЫЙ список!                                     │
└─────────────────────────────────────────────────────────┘
```

### Решение (для исправления, если будет нужно):

1. Frontend передает `?timeRange=24h` в URL
2. Backend endpoints читают query параметр
3. Service функции принимают параметр и вычисляют правильный фильтр
4. MongoDB query использует динамический фильтр createdAt вместо LAST_30_DAYS

---

## 📌 ДОПОЛНИТЕЛЬНЫЕ НАБЛЮДЕНИЯ

### 1. Tab "costs" работает ПРАВИЛЬНО

Функция `getCostBreakdown()` возвращает данные для ВСЕ периодов (today, 7d, 30d) одновременно, поэтому пользователь видит правильные данные независимо от выбора.

### 2. $limit 100 скрывает больше данных

Даже если бы фильтр времени работал правильно, в conversations tab видны только топ-100 диалогов по времени. Если у пользователя > 100 диалогов в выбранном периоде, остальные скрыты.

### 3. timezone не используется

Все фильтры используют UTC (Date.now()), timezone клиента НЕ учитывается. Для пользователей в других часовых поясах результаты "за 24h" могут быть смещены на час.

### 4. Type mismatch в conversationId

- `Transaction.conversationId` - String
- `Conversation._id` - ObjectId
- Это может привести к проблемам при $lookup, если не обработана правильно

---

**КОНЕЦ ОТЧЕТА**
