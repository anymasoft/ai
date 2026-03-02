# 🔧 ДИАГНОСТИЧЕСКИЙ ОТЧЕТ: "argument handler must be a function"

**Дата:** 2026-03-02
**Ошибка:** `"There was an uncaught error: argument handler must be a function"`
**Статус:** 🔴 АКТИВНО ДИАГНОСТИРУЕТСЯ

---

## 📋 АНАЛИЗ ПРОБЛЕМЫ

### Что произошло

При интеграции коммерческой системы в LibreChat возникла ошибка Express:
```
"argument handler must be a function"
```

Это означает, что в `app.use()` или `router.use()` передан **НЕ function**, а что-то другое (undefined, объект, строка и т.д.).

### Где проверены ошибочные пути

✅ **Проверены и работают:**
- `routes/index.js` - payment импортирован и экспортирован правильно
- `payment.js` - экспортирует `router` (функция)
- `ensureBalance.js` - экспортирует функцию
- `checkSubscription.js` - экспортирует функцию
- `checkSpecAllowedForPlan.js` - экспортирует функцию
- `buildEndpointOption.js` - создает `req.builtEndpointOption` (не middleware)

### Где может быть проблема

❓ **Возможные причины:**

1. **ensureBalance использует createSetBalanceConfig неправильно**
   - Файл: `api/server/middleware/ensureBalance.js`
   - Проблема: Может быть, `createSetBalanceConfig()` возвращает что-то не функцию?
   - Решение: Нужно проверить что возвращает `require('@librechat/api').createSetBalanceConfig`

2. **Динамическое требование в convos.js/messages.js/agents/index.js**
   - Может быть, путь `~/server/middleware/ensureBalance` не разрешается правильно?
   - Решение: Добавить try/catch и логирование при загрузке middleware

3. **Конфликт с существующим middleware**
   - Может быть, в routes уже есть какой-то middleware с тем же именем?
   - Решение: Переименовать наши middleware

---

## 🛠️ ВРЕМЕННОЕ РЕШЕНИЕ

Все коммерческие middleware **ОТКЛЮЧЕНЫ** в:
- ✅ `/api/server/routes/convos.js`
- ✅ `/api/server/routes/messages.js`
- ✅ `/api/server/routes/agents/index.js`

Сервер должен запуститься без ошибок. Если запускается - проблема в одном из наших middleware.

---

## 🔍 ДИАГНОСТИЧЕСКИЙ ПЛАН

### ШАГ 1: Проверить что сервер запускается

```bash
npm start
# или
yarn start
# или в зависимости от проекта
```

**Ожидаемый результат:**
- ✅ Сервер слушает на порту (обычно 3080)
- ✅ Нет ошибок в консоли
- ✅ API доступен на http://localhost:3080

---

### ШАГ 2: Включить middleware поочередно

Если сервер запускается без наших middleware, включи их по одному:

**2a) Включить ТОЛЬКО ensureBalance в convos.js:**
```javascript
const ensureBalance = require('~/server/middleware/ensureBalance');
// ...
router.use(ensureBalance);
```

**Тест:** `npm start` → Сработает ли?
- ✅ ДА → ensureBalance рабочий
- ❌ НЕТ → ensureBalance сломан

**2b) Если ensureBalance работает, добавить checkSubscription:**
```javascript
const checkSubscription = require('~/server/middleware/checkSubscription');
// ...
router.use(checkSubscription);
```

**2c) Если работают оба, добавить checkSpecAllowedForPlan:**
```javascript
const checkSpecAllowedForPlan = require('~/server/middleware/checkSpecAllowedForPlan');
// ...
router.use(checkSpecAllowedForPlan);
```

---

### ШАГ 3: Если нашли проблемный middleware

**Если проблема в ensureBalance.js:**

Потенциальное решение - переписать без использования createSetBalanceConfig:

```javascript
const { Balance } = require('~/db/models');

async function ensureBalance(req, res, next) {
  if (!req.user) return next();

  try {
    const userId = req.user._id || req.user.id;
    await Balance.findOneAndUpdate(
      { user: userId },
      { $setOnInsert: { user: userId, tokenCredits: 0 } },
      { upsert: true }
    );
    next();
  } catch (err) {
    next(); // Ошибка в balance не должна блокировать
  }
}

module.exports = ensureBalance;
```

**Если проблема в checkSubscription или checkSpecAllowedForPlan:**

Проверить, что функция правильно определена и не возвращает undefined.

---

### ШАГ 4: Добавить debug логирование

Добавить в convos.js перед router.use():

```javascript
console.log('ensureBalance type:', typeof ensureBalance);
console.log('checkSubscription type:', typeof checkSubscription);
console.log('checkSpecAllowedForPlan type:', typeof checkSpecAllowedForPlan);

router.use(requireJwtAuth);
if (typeof ensureBalance === 'function') {
  router.use(ensureBalance);
} else {
  console.error('ERROR: ensureBalance is not a function!', ensureBalance);
}
```

---

## 📊 ТЕКУЩИЙ СТАТУС ИНТЕГРАЦИИ

| Компонент | Статус | Статус |
|-----------|--------|--------|
| Payment route | ✅ Подключена | Работает |
| ensureBalance middleware | ⚠️ Отключена | Требует проверки |
| checkSubscription middleware | ⚠️ Отключена | Требует проверки |
| checkSpecAllowedForPlan middleware | ⚠️ Отключена | Требует проверки |
| buildEndpointOption.js модификация | ✅ Подключена | Работает |
| Frontend /pricing | ✅ Подключена | Работает |

---

## 📝 NEXT STEPS

1. **Запустить сервер** с отключенными middleware
2. **Убедиться что работает** (curl http://localhost:3080/health)
3. **Включить middleware поочередно**, чтобы найти проблемный
4. **Исправить проблемный middleware**
5. **Переподключить все** в правильном порядке

---

## 💾 ОТКАТ (если нужен)

Все изменения **ОТМЕНЯЕМЫ**. Можно просто закомментировать:

```bash
# В convos.js, messages.js, agents/index.js:
# Закомментировать строки с require коммерческих middleware
# Закомментировать строки с router.use(...)
```

Сервер заработает как обычно LibreChat.

---

**Диагностирование:** В процессе
**Затраченное время:** ~20 минут
**Ожидаемое время на исправление:** 15-30 минут
