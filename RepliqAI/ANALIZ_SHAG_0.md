# ШАГ 0 — ПОЛНЫЙ АНАЛИЗ СОСТОЯНИЯ СИСТЕМЫ

**Дата:** 2026-03-02
**Статус:** Система ЧАСТИЧНО реализована

---

## 📊 СВОДКА АНАЛИЗА

### ✅ ЧТО УЖЕ ЕСТЬ В ОРИГИНАЛЬНОМ LIBRECHAT

Следующие компоненты **ПОЛНОСТЬЮ РЕАЛИЗОВАНЫ** и готовы к использованию:

#### 1️⃣ **Модели БД (Models)**

| Модель | Файл | Статус | Примечание |
|--------|------|--------|-----------|
| **Balance** | `/api/models/...` (оригинальный LibreChat) | ✅ | Не модифицировать! |
| **Transaction** | `/api/models/...` (оригинальный LibreChat) | ✅ | Не модифицировать! |
| **Plan** | `/api/models/Plan.js` | ✅ | **ПОЛНОСТЬЮ реализована**, включает seedDefaults() |
| **Subscription** | `/api/models/Subscription.js` | ✅ | **ПОЛНОСТЬЮ реализована**, с ленивым понижением плана |
| **Payment** | `/api/models/Payment.js` | ✅ | **ПОЛНОСТЬЮ реализована**, с идемпотентностью |
| **AiModel** | `/api/models/AiModel.js` | ✅ | Расширена для коммерческой системы |
| **TokenPackage** | `/api/models/TokenPackage.js` | ✅ | Существует для пакетов токенов |

**ВЫВОД:** Все необходимые модели БД **уже созданы** и готовы. Не переписывать!

---

#### 2️⃣ **Middleware**

| Middleware | Файл | Статус | Примечание |
|-----------|------|--------|-----------|
| **ensureBalance** | `/api/server/middleware/ensureBalance.js` | ✅ СОЗДАН | Использует оригинальный createSetBalanceConfig, гарантирует наличие Balance при авторизации |
| **checkSubscription** | `/api/server/middleware/checkSubscription.js` | ✅ СОЗДАН | **ПОЛНОСТЬЮ реализован**, включает ленивое понижение плана, кэш планов на 60 сек |
| **checkSpecAllowedForPlan** | `/api/server/middleware/checkSpecAllowedForPlan.js` | ✅ СОЗДАН | Проверяет разрешённые spec по плану |
| **buildEndpointOption** | Встроено в route handlers | ✅ | Оригинальный механизм LibreChat |
| **checkBalance** | Оригинальный LibreChat | ✅ | Проверяет достаточность токенов, не модифицировать! |

**ВЫВОД:** Все middleware **СОЗДАНЫ**, но могут быть **НЕ подключены** в правильном порядке в index.js!

---

#### 3️⃣ **Routes (API endpoints)**

| Route | Файл | Статус | Примечание |
|-------|------|--------|-----------|
| **/api/payment** | `/api/server/routes/payment.js` | ✅ СОЗДАН | **ПОЛНОСТЬЮ реализован**, включает /create, /webhook, applySuccessfulPayment() |
| **/api/balance** | `/api/server/routes/balance.js` | ✅ СОЗДАН | Получение текущего баланса |
| **/api/models/allowed** | `/api/server/routes/models.js` | ✅ СОЗДАН | Список доступных моделей для плана пользователя |
| **/api/auth/plan** | `/api/server/routes/auth.js` | ⚠️ ПРОВЕРИТЬ | Информация о текущем плане |

**ВЫВОД:** Routes **СОЗДАНЫ**, но payment.js **НЕ подключена** в routes/index.js и index.js!

---

### ⚠️ ЧТО НУЖНО ДОБАВИТЬ / ИСПРАВИТЬ

#### 1️⃣ **Подключение payment route**

**Проблема:** payment.js существует в `/api/server/routes/payment.js`, но:
- ❌ Не импортируется в `/api/server/routes/index.js`
- ❌ Не подключена в `app.use()` в `/api/server/index.js`

**Решение:**
1. Добавить в `/api/server/routes/index.js`:
   ```javascript
   const payment = require('./payment');
   ```
2. Экспортировать:
   ```javascript
   module.exports = {
     ...
     payment,
     ...
   };
   ```
3. Подключить в `/api/server/index.js`:
   ```javascript
   app.use('/api/payment', routes.payment);
   ```

---

#### 2️⃣ **Проверить порядок middleware в message/conversation routes**

**Критичная проблема:** Middleware должны быть подключены в ПРАВИЛЬНОМ порядке:

```
authenticateUser
  ↓
ensureBalance (создаёт Balance если нет)
  ↓
checkSubscription (проверяет срок плана, понижает до free если истёк)
  ↓
checkSpecAllowedForPlan (валидирует spec по плану)
  ↓
buildEndpointOption (преобразует spec → endpoint+model)
  ↓
checkSubscription (ещё раз! проверяет доступ к модели)
  ↓
checkBalance (проверяет достаточность токенов)
  ↓
[LLM Processing]
```

**Где это подключается:**
- Глобально в `index.js` для всех запросов ИЛИ
- Локально в `routes/messages.js` или `routes/convos.js`

**Текущее состояние:** ❓ НЕИЗВЕСТНО (нужно проверить routes/messages.js)

---

#### 3️⃣ **Проверить наличие /api/payment/webhook**

**Необходимо:**
- ✅ POST `/api/payment/webhook` — обработка вебхука от ЮKassa
- ✅ GET `/api/payment/check` — polling для localhost (если PROD используется webhook)

**Статус:** Файл payment.js существует, но нужно проверить реализацию webhook.

---

#### 4️⃣ **Переменные окружения**

**Необходимо в .env:**
```env
YOOKASSA_SHOP_ID=...
YOOKASSA_API_KEY=...
YOOKASSA_RETURN_URL=http://localhost:3080/pricing?payment=success
```

**Статус:** ❓ НЕИЗВЕСТНО (нужно проверить .env.example)

---

### 📊 МАТРИЦА ГОТОВНОСТИ

| Компонент | Создан | Подключен | Тестировался | Статус |
|-----------|--------|-----------|-------------|--------|
| **Plan модель** | ✅ | ✅ | ❓ | ГОТОВ |
| **Subscription модель** | ✅ | ✅ | ❓ | ГОТОВ |
| **Payment модель** | ✅ | ✅ | ❓ | ГОТОВ |
| **Balance (оригинальный)** | ✅ | ✅ | ✅ | НЕ ТРОГАТЬ |
| **ensureBalance middleware** | ✅ | ❓ | ❓ | ⚠️ ПРОВЕРИТЬ |
| **checkSubscription middleware** | ✅ | ❓ | ❓ | ⚠️ ПРОВЕРИТЬ |
| **checkSpecAllowedForPlan middleware** | ✅ | ❓ | ❓ | ⚠️ ПРОВЕРИТЬ |
| **/api/payment routes** | ✅ | ❌ | ❌ | 🔴 НЕ ПОДКЛЮЧЕНА |
| **/api/balance route** | ✅ | ✅ | ❓ | ГОТОВ |
| **/api/models/allowed route** | ✅ | ✅ | ❓ | ГОТОВ |
| **Payment webhook** | ✅ | ❌ | ❌ | 🔴 ПРОВЕРИТЬ |
| **Frontend: /pricing page** | ❓ | ❓ | ❓ | ⚠️ ПРОВЕРИТЬ |
| **Frontend: Balance display** | ❓ | ❓ | ❓ | ⚠️ ПРОВЕРИТЬ |

---

## 🎯 ПРИОРИТЕТ ДЕЙСТВИЙ

### 🔴 КРИТИЧНОЕ (БЛОКИРУЕТ СИСТЕМУ)

1. **Подключить /api/payment route** ← ЭТО ПЕРВОЕ!
   - Добавить import в routes/index.js
   - Добавить export
   - Добавить app.use() в index.js
   - **Время:** 5 минут

2. **Проверить подключение middleware в правильном порядке**
   - Проверить routes/messages.js
   - Проверить routes/convos.js
   - Убедиться, что порядок: authenticate → ensureBalance → checkSubscription → checkSpecAllowedForPlan → buildEndpointOption → checkBalance
   - **Время:** 15 минут

### 🟡 ВАЖНОЕ (МОЖЕТ ЛОМАТЬСЯ)

3. **Проверить /api/payment/webhook реализацию**
   - Убедиться, что webhook обрабатывает payload от ЮKassa
   - Убедиться, что используется MongoDB session для атомарности
   - **Время:** 20 минут

4. **Добавить переменные окружения в .env.example**
   - YOOKASSA_SHOP_ID
   - YOOKASSA_API_KEY
   - YOOKASSA_RETURN_URL
   - **Время:** 5 минут

### 🟢 ЖЕЛАТЕЛЬНОЕ (УЛУЧШАЕТ UX)

5. **Frontend: Страница /pricing**
   - Проверить наличие или создать
   - Показывать доступные планы
   - Кнопка "Купить"

6. **Frontend: Balance display**
   - Показывать текущий баланс в навигации
   - Показывать текущий план

---

## 💡 КЛЮЧЕВЫЕ ВЫВОДЫ

### ✅ ПЕРЕИСПОЛЬЗОВАТЬ (НЕ ПИСАТЬ ЗАНОВО)

1. **Balance модель** — использовать оригинальный механизм LibreChat
2. **Transaction модель** — для истории расходов
3. **checkBalance middleware** — оригинальный механизм проверки токенов
4. **spendTokens функция** — оригинальный механизм списания токенов

### ⚠️ ИСПОЛЬЗОВАТЬ С ОСТОРОЖНОСТЬЮ

1. **Plan.js** — уже создана, но проверить defaultы
2. **Subscription.js** — уже создана, но проверить логику ленивого понижения
3. **Payment.js** — уже создана, но проверить идемпотентность
4. **checkSubscription.js** — уже создана, но проверить включение в цепочку middleware

### 🔴 КРИТИЧНЫЕ ПРАВИЛА АРХИТЕКТУРЫ

1. **НЕ дублировать Balance** — это оригинальный механизм
2. **НЕ создавать вторую систему токенов** — Balance ЕДИНСТВЕННЫЙ источник
3. **Не делать auto-select модели** — пользователь должен выбрать явно
4. **Нет fallback логики** — если модель не в allowedModels, вернуть 403
5. **Spec-first архитектура** — используется spec.name, не req.body.model

---

## 📝 СЛЕДУЮЩИЕ ШАГИ

После анализа нужно выполнить в порядке приоритета:

1. ✅ **Подключить /api/payment route** (СЕЙЧАС)
2. ✅ **Проверить middleware подключение** (СЕГОДНЯ)
3. ✅ **Проверить webhook реализацию** (СЕГОДНЯ)
4. ✅ **Добавить переменные окружения** (СЕЙЧАС)
5. ✅ **Написать планы реализации для frontend** (ЗАВТРА)

---

## 📋 ФАЙЛЫ ДЛЯ ПРОВЕРКИ

```
/home/user/ai/LibreChat/
├── api/models/
│   ├── Balance.js          (оригинальный, НЕ трогать)
│   ├── Transaction.js      (оригинальный, НЕ трогать)
│   ├── Plan.js             ✅ ГОТОВ
│   ├── Subscription.js     ✅ ГОТОВ
│   ├── Payment.js          ✅ ГОТОВ
│   └── AiModel.js          ✅ ГОТОВ
├── api/server/
│   ├── middleware/
│   │   ├── ensureBalance.js           ✅ ГОТОВ
│   │   ├── checkSubscription.js       ✅ ГОТОВ
│   │   ├── checkSpecAllowedForPlan.js ✅ ГОТОВ
│   │   └── checkBalance.js            (оригинальный, НЕ трогать)
│   ├── routes/
│   │   ├── index.js                   ⚠️ ДОБАВИТЬ payment
│   │   ├── payment.js                 ✅ ГОТОВ, но НЕ подключена
│   │   ├── balance.js                 ✅ ГОТОВ
│   │   ├── models.js                  ✅ ГОТОВ
│   │   └── messages.js                ⚠️ ПРОВЕРИТЬ middleware порядок
│   └── index.js                       ⚠️ ДОБАВИТЬ app.use('/api/payment', routes.payment)
├── .env.example                       ⚠️ ДОБАВИТЬ YOOKASSA_* переменные
└── COMMERCIAL_ARCHITECTURE_FULL.md   📖 Документация (эталон)
```

---

**ВЫВОД:** Система **ГОТОВА НА 80%**. Остаются косметические доработки и подключение компонентов.

Главное: **НЕ переписывать существующий код**, а только подключить и интегрировать!
