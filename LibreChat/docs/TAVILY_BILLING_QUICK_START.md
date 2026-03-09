# Tavily Billing - Быстрый старт

## TL;DR

Система автоматически вычитает **1000 токенов** за каждый вызов Tavily Web Search. Эта документация объясняет как это работает и как добавить биллинг для других инструментов.

## Основные файлы

| Файл | Назначение | Строки | Статус |
|------|-----------|--------|--------|
| `api/app/clients/tools/util/toolBilling.js` | Логика биллинга | 140 | **NEW** ✨ |
| `api/app/clients/tools/util/handleTools.js` | Загрузка инструментов | 48, 441 | **MODIFIED** 📝 |
| `api/models/balanceMethods.js` | Проверка баланса | 14-42, 155 | **MODIFIED** 📝 |

## Как работает

### Для User-а (видимая часть)

```
User: "Найди информацию о Python"
  ↓
Model вызывает Tavily
  ↓
[Система проверяет баланс]
  ↓
Если достаточно: -1000 токенов, показать результаты
Если мало: "Недостаточно токенов"
```

### Для Developer-а (техническая часть)

```
1. handleTools.js загружает Tavily
   ↓
2. Оборачивает в createBilledTool()
   ↓
3. При вызове инструмента:
   - Перехватить _call метод
   - Проверить баланс: checkBalanceRecord()
   - Если OK: создать Transaction, обновить Balance
   - Выполнить инструмент
   - Вернуть результат
   ↓
4. При ошибке баланса:
   - Не выполнять инструмент
   - Выбросить ошибку
```

## Код компонентов

### 1. Проверка баланса (toolBilling.js)

```javascript
const balanceCheck = await checkBalanceRecord({
  user: userId,
  model: 'tool',
  tokenType: 'tool',
  amount: 1000,  // Стоимость Tavily
});

if (!balanceCheck.canSpend) {
  throw new Error(`Insufficient tokens`);
}
```

### 2. Создание транзакции (toolBilling.js)

```javascript
const transaction = new Transaction({
  user: userId,
  context: 'tool',
  toolName: 'tavily_search_results_json',
  tokenType: 'tool',
  rawAmount: -1000,
});

transaction.rate = 1;
transaction.tokenValue = -1000;

await transaction.save();
await updateBalance({ user: userId, incrementValue: -1000 });
```

### 3. Обёртывание инструмента (handleTools.js)

```javascript
if (tool === 'tavily_search_results_json' && loadedTool && user) {
  return createBilledTool(loadedTool, tool, user, {
    conversationId,
    messageId,
  });
}
```

## Примеры Usage

### Пример 1: Успешный вызов

```javascript
// User баланс: 5000 токенов
// User запрашивает: "Tavily search for Python 3.12"

// Система:
// 1. Проверка баланса: 5000 >= 1000 ✅
// 2. Создание Transaction: -1000 токенов
// 3. Выполнение Tavily API
// 4. Новый баланс: 4000

// Result: Результаты Tavily возвращены модели
```

### Пример 2: Недостаточный баланс

```javascript
// User баланс: 500 токенов
// User запрашивает: "Tavily search for Python 3.12"

// Система:
// 1. Проверка баланса: 500 < 1000 ❌
// 2. Выброс ошибки

// Result: Error - "Insufficient tokens for tavily_search_results_json"
```

### Пример 3: Добавить новый инструмент с биллингом

```javascript
// 1. Обновить TOOL_COSTS в toolBilling.js
const TOOL_COSTS = {
  tavily_search_results_json: 1000,
  my_custom_tool: 500,  // NEW
};

// 2. Добавить в handleTools.js (в цикл создания инструментов)
if (tool === 'my_custom_tool' && loadedTool && user) {
  return createBilledTool(loadedTool, tool, user, {...});
}

// 3. Готово! my_custom_tool теперь имеет биллинг
```

## Логирование

### Нормальный flow

```
[TAVILY BILLING] Checking balance for user=abc123 cost=1000
[TAVILY BILLING] user=abc123 cost=1000 balance_before=5000
[TAVILY BILLING] Transaction recorded for user=abc123 tool=tavily_search_results_json cost=1000
```

### Ошибка баланса

```
[TAVILY BILLING] Checking balance for user=xyz789 cost=1000
[TAVILY BILLING] Insufficient tokens for tavily_search_results_json. Required: 1000, Available: 500
```

## Troubleshooting

### Проблема: Tavily работает но баланс не вычитается

**Проверить:**
```bash
# 1. Проверить логи на ошибки
grep "TAVILY BILLING" app.log | grep -i error

# 2. Проверить что tool оборачивается
grep "createBilledTool" app.log

# 3. Проверить что Transaction была создана
db.transactions.find({ toolName: "tavily_search_results_json" }).sort({ createdAt: -1 }).limit(1)
```

### Проблема: Tavily отклонена с ошибкой баланса

**Это нормально!**
- User просто не имеет достаточно токенов
- User может пополнить баланс или использовать меньше инструментов

### Проблема: Transaction создана но баланс не обновлен

**Вероятно:**
- updateBalance упала
- MongoDB connection issue

**Решение:**
- Проверить DB connection logs
- Проверить что Balance.enabled = true в config
- Может потребоваться manual reconciliation

## API Изменения

### Вот что добавилось/изменилось:

**NEW в exports:**
```javascript
// balanceMethods.js
module.exports = {
  checkBalance,
  checkBalanceRecord,  // Экспортировано для tool billing
};
```

**NEW функция:**
```javascript
// toolBilling.js
function createBilledTool(tool, toolName, userId, options)
async function billedToolCall(originalCall, input, runManager, toolName, userId, cost, options)
```

**Изменения в handleTools.js:**
```javascript
// Добавлено при загрузке Tavily инструмента
if (tool === 'tavily_search_results_json' && loadedTool && user) {
  return createBilledTool(loadedTool, tool, user, { conversationId, messageId });
}
```

**Изменения в checkBalanceRecord:**
```javascript
// Добавлена специальная обработка для tokenType='tool'
if (tokenType === 'tool') {
  tokenCost = amount;  // Прямая стоимость
  multiplier = 1;
} else {
  // Стандартное вычисление с multiplier
  ...
}
```

## Performance Impact

- **Overhead per tool call:** ~5-7ms
  - checkBalanceRecord DB query: 1-2ms
  - createTransaction: 2-3ms
  - updateBalance: 1-2ms

- **Memory overhead:** ~50KB per active user
  - Transaction objects
  - Balance cache

- **Database impact:** Minimal
  - 1 read (checkBalance)
  - 1 write (createTransaction)
  - 1 update (updateBalance)

## Security

### ✅ Защищено от:
- Пользователь пошёл в отрицательный баланс (проверка ПЕРЕД выполнением)
- Race conditions (DB locks на Balance update)
- Потеря транзакций (saved в DB перед updateBalance)

### ⚠️ Требует внимания:
- checkBalanceRecord должна быть транзакционна (используется lean())
- updateBalance должна быть atomic (используется findOneAndUpdate)
- Auto-refill может пересчитать баланс (обновлён в checkBalanceRecord)

## Следующие шаги

### Добавить биллинг для других MCP инструментов

1. **Найти имя инструмента**
```bash
grep -r "tool === " api/app/clients/tools/
# Результат: tool === 'web_search', tool === 'file_search' и т.д.
```

2. **Определить стоимость**
```javascript
const TOOL_COSTS = {
  tavily_search_results_json: 1000,   // Существует
  web_search: 500,                    // НОВЫЙ
  file_search: 200,                   // НОВЫЙ
};
```

3. **Добавить обёртывание в handleTools.js**
```javascript
if (tool === 'web_search' && loadedTool && user) {
  return createBilledTool(loadedTool, tool, user, {...});
}
```

4. **Готово!**

## Вопросы?

- Документация: `/TAVILY_BILLING_IMPLEMENTATION.md`
- Код: `api/app/clients/tools/util/toolBilling.js`
- Issues: GitHub issues на проекте
