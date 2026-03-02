# ПОЛНЫЙ ТЕХНИЧЕСКИЙ АУДИТ LIBRECHAT
## Balance, Usage, Tariffs & Model Restrictions

**Дата:** 2 марта 2026
**Статус:** Исследование - БЕЗ ИЗМЕНЕНИЙ
**Область исследования:** /home/user/ai/librechat_ai (оригинальный LibreChat)

---

## 1. СТРУКТУРА НАЙДЕННЫХ ФАЙЛОВ

### Основные компоненты Balance системы:
```
МОДЕЛИ:
  - packages/data-schemas/src/schema/balance.ts          [SCHEMA]
  - packages/data-schemas/src/types/balance.ts           [TYPES]
  - packages/data-schemas/src/models/balance.ts          [MODEL FACTORY]
  - packages/data-schemas/src/schema/transaction.ts      [TRANSACTION SCHEMA]
  - packages/data-schemas/src/models/transaction.ts      [TRANSACTION MODEL]

КОНТРОЛЬ БАЛАНСА:
  - api/server/controllers/Balance.js                    [REST API Controller]
  - api/server/routes/balance.js                         [REST API Route]
  - api/models/balanceMethods.js                         [CORE LOGIC - checkBalance, checkBalanceRecord]
  - api/models/spendTokens.js                            [SPEND LOGIC - spendTokens, spendStructuredTokens]
  - api/models/Transaction.js                            [TRANSACTION CREATION - createTransaction, createAutoRefillTransaction]

MIDDLEWARE:
  - packages/api/src/middleware/balance.ts               [BALANCE CONFIG MIDDLEWARE]
  - packages/api/src/middleware/balance.spec.ts          [TESTS - comprehensive]

PRICING & RATES:
  - api/models/tx.js                                     [PRICING DATABASE - 300+ моделей]

ИСПОЛЬЗОВАНИЕ:
  - packages/api/src/agents/usage.ts                     [recordCollectedUsage function]
  - api/app/clients/BaseClient.js                        [SPEND IN CHAT]
  - api/server/controllers/assistants/chatV1.js          [SPEND IN ASSISTANTS]
  - api/server/controllers/assistants/chatV2.js          [SPEND IN ASSISTANTS]

КОНФИГУРАЦИЯ & ADMIN:
  - packages/api/src/app/config.ts                       [getBalanceConfig]
  - config/add-balance.js                                [CLI: добавить баланс]
  - config/set-balance.js                                [CLI: установить баланс]
  - config/list-balances.js                              [CLI: список балансов]

ТИПЫ & ИНТЕРФЕЙСЫ:
  - packages/data-schemas/src/types/user.ts              [BalanceConfig interface]
  - packages/data-provider/src/roles.ts                  [Role definitions]
```

---

## 2. АРХИТЕКТУРНАЯ СХЕМА ОРИГИНАЛА

### 2.1 DATA MODELS

#### Balance Model (MongoDB)
```typescript
interface IBalance extends Document {
  user: ObjectId,                          // Ссылка на User
  tokenCredits: number,                    // Основной баланс (1000 = 1 mill = $0.001)
  autoRefillEnabled: boolean,              // Включить ли автопополнение
  refillIntervalValue: number,             // Значение интервала (30)
  refillIntervalUnit: enum,                // Единица: 'seconds'|'minutes'|'hours'|'days'|'weeks'|'months'
  lastRefill: Date,                        // Дата последнего пополнения
  refillAmount: number,                    // Сумма пополнения при срабатывании
}
```

#### Transaction Model (MongoDB)
```typescript
interface ITransaction extends Document {
  user: ObjectId,                          // Кто потратил
  conversationId?: string,                 // К какому разговору отнести
  tokenType: 'prompt'|'completion'|'credits',  // Тип потраченных токенов
  model?: string,                          // Какую модель использовал (gpt-4o и т.д.)
  context?: string,                        // Контекст: 'message', 'autoRefill', 'admin', 'incomplete'
  valueKey?: string,                       // Ключ для поиска в pricing tables
  rate?: number,                           // Коэффициент конвертации (цена за 1 токен)
  rawAmount?: number,                      // Сколько токенов потрачено (отрицательное число)
  tokenValue?: number,                     // Финальная стоимость в credits
  inputTokens?: number,                    // Для структурированных токенов
  writeTokens?: number,                    // Для cache write tokens
  readTokens?: number,                     // Для cache read tokens
  messageId?: string,                      // ID сообщения в разговоре
  createdAt: Date,                         // Когда произошла трата
}
```

### 2.2 FLOW КОНТРОЛЯ БАЛАНСА

```
USER REQUEST
     ↓
[MIDDLEWARE] createSetBalanceConfig
  └─> Проверить: есть ли Balance record для user
  └─> Если нет → создать с startBalance (из config)
  └─> Если есть → обновить config (autoRefill settings)
     ↓
[CONTROLLER/CLIENT] BaseClient, Assistants
  └─> Перед отправкой в LLM:
      └─> await checkBalance({ req, res, txData })
          └─> Получить tokenCost = amount * multiplier
          └─> Читать текущий Balance record
          └─> Если balance < tokenCost → ERROR (TOKEN_BALANCE violation)
          └─> Если autoRefill && balance - tokenCost <= 0 →
              └─> createAutoRefillTransaction()
                  └─> Создать Transaction (context: 'autoRefill')
                  └─> updateBalance(+refillAmount)
                  └─> Пересчитать balance
          └─> Если можно потратить → return true
     ↓
[LLM REQUEST] (OpenAI, Claude, etc.)
     ↓
[RESPONSE] Получить tokenUsage (prompt_tokens, completion_tokens)
     ↓
[RECORD USAGE] recordCollectedUsage() или spendTokens()
  └─> Для каждого типа токенов (prompt/completion):
      └─> createTransaction({
          user, model, conversationId, tokenType,
          rawAmount: -promptTokens (отрицательное!),
          })
      └─> calculateTokenValue(transaction)
          └─> multiplier = getMultiplier({ model, tokenType })
          └─> tokenValue = rawAmount * multiplier (= отрицательное число)
      └─> transaction.save() → в БД
      └─> updateBalance(incrementValue: tokenValue)  [OPTIMISTIC CONCURRENCY CONTROL]
          └─> Выполнять retry с exponential backoff (10 попыток)
          └─> Условное обновление: WHERE tokenCredits == currentValue
     ↓
[RESULT] Balance обновлен, Transaction залогирован
```

### 2.3 KEY FUNCTIONS

#### checkBalance (api/models/balanceMethods.js)
```javascript
function checkBalance({ req, res, txData }) {
  // 1. Рассчитать стоимость: tokenCost = amount * multiplier
  // 2. Если autoRefill включен AND balance <= tokenCost:
  //    -> createAutoRefillTransaction()
  //    -> Обновить balance += refillAmount
  // 3. Если balance >= tokenCost: return true
  // 4. Иначе: logViolation() и throw error
}
```

#### spendTokens (api/models/spendTokens.js)
```javascript
async function spendTokens(txData, tokenUsage) {
  // Для prompt и completion токенов:
  // 1. Создать Transaction с rawAmount = -tokens
  // 2. calculateTokenValue(txn) -> tokenValue = -tokens * rate
  // 3. updateBalance(incrementValue: tokenValue)
}
```

#### updateBalance (api/models/Transaction.js)
```javascript
async function updateBalance({ user, incrementValue, setValues }) {
  // Optimistic Concurrency Control с 10 retry попытками
  // 1. Читать текущий balance: currentCredits
  // 2. Рассчитать новый: newCredits = currentCredits + incrementValue
  // 3. Обновить УСЛОВНО: WHERE tokenCredits == currentCredits
  // 4. Если конфликт -> retry с exponential backoff (50ms, 100ms, 200ms...)
}
```

---

## 3. ПРИНЦИП РАБОТЫ (ДЕТАЛЬНО)

### 3.1 Инициализация баланса для нового пользователя

**Когда:** При первом запросе аутентифицированного пользователя
**Где:** middleware/balance.ts → createSetBalanceConfig()
**Как:**
1. Middleware срабатывает на каждый request от аутентифицированного user
2. Ищет Balance record в БД для текущего user
3. Если NOT FOUND:
   - Создает новый Balance документ
   - Устанавливает tokenCredits = config.startBalance (например, 20000)
   - Устанавливает autoRefill параметры из config
   - Сохраняет в БД
4. Если FOUND:
   - Проверяет, изменились ли параметры в конфиге
   - Обновляет только то, что изменилось
5. Затем вызывает next() для продолжения обработки

**Конфигурация:**
```yaml
# librechat.yaml
balance:
  enabled: true
  startBalance: 20000                    # Начальный баланс
  autoRefillEnabled: true                # Включить автопополнение
  refillIntervalValue: 30                # Каждые...
  refillIntervalUnit: 'days'             # ...дней
  refillAmount: 10000                    # Пополнять на сумму
```

### 3.2 Проверка баланса перед запросом в LLM

**Когда:** Перед отправкой запроса в OpenAI, Anthropic и т.д.
**Где:** BaseClient.js, chatV1.js, chatV2.js
**Как:**

```javascript
await checkBalance({
  req: expressRequest,
  res: expressResponse,
  txData: {
    user: userId,
    model: 'gpt-4o',
    endpoint: 'openAI',
    valueKey: 'gpt-4o',          // Ключ для поиска в pricing table
    tokenType: 'prompt',          // Или 'completion'
    amount: 150,                  // Сколько prompt токенов
    endpointTokenConfig: {...},   // Custom pricing для endpoint
  }
});
```

**Алгоритм checkBalance:**
1. Получить multiplier из pricing таблицы
2. Рассчитать токен-стоимость: `tokenCost = amount * multiplier`
3. Прочитать Balance документ пользователя
4. Если balance <= tokenCost AND autoRefill включен:
   - Проверить lastRefill дату
   - Если время с lastRefill >= refillIntervalValue:
     - Вызвать createAutoRefillTransaction(refillAmount)
     - balance = balance + refillAmount
5. Если balance >= tokenCost: return true (разрешить запрос)
6. Иначе: logViolation() и throw Error

### 3.3 Списание токенов после получения ответа

**Когда:** После получения ответа от LLM с usage информацией
**Где:** recordCollectedUsage в agents, или spendTokens в chat handlers

**Алгоритм spendTokens:**
1. Для каждого типа токенов (prompt/completion):
2. Создать Transaction с rawAmount = -tokens
3. calculateTokenValue(txn): tokenValue = -tokens * rate
4. transaction.save() → в БД
5. updateBalance(incrementValue: tokenValue)

### 3.4 Optimistic Concurrency Control (Race condition protection)

**Проблема:** Если два запроса одновременно обновляют баланс, может быть потеря данных

**Решение в updateBalance:**
- Читаем текущий balance
- Обновляем УСЛОВНО: только если баланс не изменился
- Если конфликт → retry с exponential backoff (50ms, 100ms, 200ms...)
- Максимум 10 попыток

---

## 4. ОГРАНИЧЕНИЯ СИСТЕМЫ

### ✅ ЧТО РЕАЛИЗОВАНО:

1. **Balance система:**
   - ✅ Начальный баланс при регистрации
   - ✅ Автоматическое пополнение по расписанию
   - ✅ Динамический расчет стоимости по модели
   - ✅ Логирование всех транзакций
   - ✅ Защита от race conditions

2. **Pricing:**
   - ✅ 300+ моделей с точными коэффициентами
   - ✅ Разные цены для prompt/completion
   - ✅ Premium pricing (tiered) для больших prompt'ов
   - ✅ Cache pricing (write/read tokens)
   - ✅ Custom endpoint pricing

3. **Контроль доступа:**
   - ✅ Запрет на запрос при нулевом балансе
   - ✅ Violation logging
   - ✅ Роли с разрешениями

4. **Admin инструменты:**
   - ✅ CLI commands для добавления баланса
   - ✅ API endpoint для просмотра баланса
   - ✅ Конфигурирование через librechat.yaml

### ❌ ЧТО НЕ РЕАЛИЗОВАНО:

1. **Ограничения моделей:**
   - ❌ НЕТ ограничения моделей по пользователю/роли
   - ❌ НЕТ "только Pro могут использовать GPT-4o"
   - ❌ НЕТ enforce на уровне spec или endpoint

2. **Тарифы/Subscriptions:**
   - ❌ НЕТ разделения на Free/Pro/Business
   - ❌ НЕТ связи между ролью и стартовым балансом
   - ❌ НЕТ модели Subscription в БД

3. **Платежи:**
   - ❌ НЕТ Stripe интеграции
   - ❌ НЕТ платежных шлюзов
   - ❌ НЕТ webhooks для подтверждения платежей

4. **Расширенные фичи:**
   - ❌ НЕТ лимитов на endpoint (только на баланс)
   - ❌ НЕТ rate limiting по пользователю
   - ❌ НЕТ отслеживания использования по моделям в UI

---

## 5. РЕКОМЕНДАЦИЯ (КОНКРЕТНАЯ)

### 5.1 Вопрос 1: Можно ли использовать оригинальную систему balance как основу?

**ОТВЕТ: ДА**

**ПЛЮСЫ:**
- ✅ System уже полностью работает и протестирована
- ✅ Есть защита от race conditions (optimistic locking)
- ✅ Есть auto-refill логика
- ✅ Есть precise pricing для 300+ моделей
- ✅ Есть CLI tools для admin

**МИНУСЫ:**
- ❌ НЕТ встроенной поддержки тарифов
- ❌ НЕТ ограничения моделей по ролям
- ❌ НЕТ интеграции платежей

### 5.2 Вопрос 2: Можно ли на её базе реализовать тарифы (Free/Pro/Business)?

**ОТВЕТ: ДА, требуется небольшая доработка**

**Рекомендуемый вариант: Расширить через User role**
```typescript
interface IRole {
  name: string;
  tier: 'free' | 'pro' | 'business';
  balanceConfig: {
    startBalance: number,
    refillAmount: number,
    refillIntervalValue: number,
  };
  modelAccess: {
    allowedModels?: string[];
    forbiddenModels?: string[];
  };
}
```

### 5.3 Вопрос 4: Что выгоднее - доработать оригинал или продолжать свою архитектуру?

**ОТВЕТ: Доработать оригинал**

| Аспект | Доработка оригинала | Собственная система |
|--------|------|--------|
| **Effort** | Средний (1-2 дня) | Высокий (дублирование) |
| **Maintenance** | Низкий | Высокий |
| **Testing** | Уже написаны тесты | Нужно писать с нуля |
| **Надежность** | Доказана | Неизвестна |

**КОНКРЕТНАЯ РЕКОМЕНДАЦИЯ:**

1. Дать вашей системе имя-пространство (например, `customBilling`)
2. Использовать оригинальный LibreChat balance для tracking usage
3. Ваша система работает "на слой выше":
   ```
   User Request
      ↓
   [ОРИГИНАЛ] Middleware balance → startBalance
      ↓
   [ВАША] checkCustomBilling() → проверить тариф, модель access
      ↓
   [ОРИГИНАЛ] checkBalance() → проверить баланс
      ↓
   LLM Request
   ```

### 5.4 Вопрос 5: Какие риски при миграции?

**РИСК 1: Race Conditions**
- ✅ РЕШЕНО в оригинале (optimistic locking)

**РИСК 2: Несоответствие между Usage и Balance**
- ⚠️ РЕШЕНИЕ: Periodic reconciliation job

**РИСК 3: Потеря данных о старых тарифах**
- ⚠️ РЕШЕНИЕ: Миграция в UserSubscription модель

**РИСК 4: Конфликт между двумя системами**
- ⚠️ РЕШЕНИЕ: Четкое разделение ответственности

---

## 6. ИТОГОВЫЕ МЕТРИКИ

### Database Collections:
- **Balance:** 1 документ на пользователя
- **Transaction:** 1 документ на каждый spend
- **User:** Ссылка на balance

### API Endpoints:
- `GET /balance` - получить текущий баланс

### CLI Commands:
- `npm run add-balance <email> <amount>`
- `npm run set-balance <email> <amount>`
- `npm run list-balances`

### Поддерживаемые модели: 300+
- OpenAI, Anthropic, Google, Meta, Mistral и другие

---

## ИТОГОВЫЙ ВЫВОД

### ✅ СИСТЕМА ГОТОВА К ИСПОЛЬЗОВАНИЮ ДЛЯ:
1. Отслеживания использования токенов
2. Предотвращения бесплатного использования моделей
3. Простого разделения доступа через admin panel
4. Автоматического пополнения баланса по расписанию

### ❌ СИСТЕМА НЕ ГОТОВА ДЛЯ:
1. Многоуровневых тарифов (Free/Pro/Business)
2. Ограничения моделей по пользователю/роли
3. Платежных операций
4. Управления подписками

### 🎯 РЕКОМЕНДУЕМОЕ ДЕЙСТВИЕ:
**Использовать оригинальную систему balance как основу и добавить слой с ограничениями моделей и тарификацией, не удаляя оригинальную реализацию.**

---

**Аудит завершен. Документ создан без изменений в коде.**
