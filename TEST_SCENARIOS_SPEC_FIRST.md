# ТЕСТОВЫЕ СЦЕНАРИИ - Spec-First Архитектура

## 📋 СЦЕНАРИЙ 1: Пользователь свободного плана выбирает модель

### Предусловия
- Пользователь с планом `free` может использовать только `gpt-4o-mini`
- Попытка использовать другие модели должна быть заблокирована

### Шаги
```bash
# 1. Пользователь с Free планом заходит в UI
# 2. В ModelSelector видит только доступные spec:
#    - gpt-4o-mini
#    - (другие из allowedSpecs для free)

# 3. Выбирает "GPT 4.o Mini" → spec = "gpt-4o-mini"
# UI отправляет: { spec: "gpt-4o-mini" }

curl -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <free_user_token>" \
  -d '{
    "spec": "gpt-4o-mini",
    "message": "Hello"
  }'
```

### Ожидаемый результат
```json
{
  "status": 200,
  "model_used": "gpt-4o-mini"
}
```

### Проверка на backend
```javascript
// В logs:
[SPEC CHECK] "gpt-4o-mini" against plan "free" ✅ allowed
[buildEndpointOption] ✅ SPEC-FIRST: "gpt-4o-mini" → endpoint="openAI", model="gpt-4o-mini"
[MODEL CHECK] gpt-4o-mini against plan "free" ✅ allowed
```

---

## ❌ СЦЕНАРИЙ 2: Пользователь свободного плана пытается использовать Pro модель

### Предусловия
- Пользователь с планом `free` НЕ имеет доступа к `claude-sonnet-4-6`
- `claude-sonnet-4-6` есть в allowedSpecs только для `pro` плана

### Шаги
```bash
# 1. Пользователь видит в UI только free модели
# 2. Попытается отправить запрос с claude-sonnet-4-6:

curl -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <free_user_token>" \
  -d '{
    "spec": "claude-sonnet-4-6",
    "message": "Hello"
  }'
```

### Ожидаемый результат
```json
{
  "status": 403,
  "error": "SPEC_NOT_ALLOWED",
  "message": "Spec \"claude-sonnet-4-6\" недоступна на плане \"free\". Перейдите на Pro или Business.",
  "allowedSpecs": ["gpt-4o-mini"]
}
```

### Проверка на backend
```javascript
// В logs:
[SPEC CHECK] "claude-sonnet-4-6" against plan "free" ❌ NOT allowed
// Запрос отклонен middleware checkSpecAllowedForPlan ДО buildEndpointOption
```

---

## 🎯 СЦЕНАРИЙ 3: Pro пользователь выбирает Claude Haiku

### Предусловия
- Пользователь с планом `pro` может использовать:
  - `gpt-4o`, `gpt-4o-mini`, `gpt-4.1-mini`
  - `claude-haiku-4-5`, `claude-sonnet-4-6`
  - `deepseek-chat`

### Шаги
```bash
# 1. Pro пользователь видит доступные модели в UI
# 2. Выбирает "Claude Haiku 4.5" → spec = "claude-haiku-4-5"

curl -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <pro_user_token>" \
  -d '{
    "spec": "claude-haiku-4-5",
    "message": "Hello"
  }'
```

### Ожидаемый результат
```json
{
  "status": 200,
  "model_used": "claude-haiku-4-5",
  "endpoint": "anthropic"
}
```

### Проверка на backend
```javascript
// В logs:
[SPEC CHECK] "claude-haiku-4-5" against plan "pro" ✅ allowed
[buildEndpointOption] ✅ SPEC-FIRST: "claude-haiku-4-5" → endpoint="anthropic", model="claude-haiku-4-5"
[MODEL CHECK] claude-haiku-4-5 against plan "pro" ✅ allowed
```

---

## 🔒 СЦЕНАРИЙ 4: Запрос БЕЗ spec (ошибка)

### Предусловия
- Отправлен запрос без spec поля

### Шаги
```bash
curl -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <user_token>" \
  -d '{
    "message": "Hello"
    // ← НЕТ spec
  }'
```

### Ожидаемый результат (если enforce=true)
```json
{
  "status": 400,
  "error": "SPEC_REQUIRED",
  "message": "spec is required when modelSpecs.enforce = true"
}
```

### Проверка на backend
```javascript
// В logs:
[buildEndpointOption] 🔴 SPEC-FIRST MODE: spec is required
```

---

## 🎓 СЦЕНАРИЙ 5: /api/models/allowed endpoint

### Шаги
```bash
# Free пользователь запрашивает доступные модели
curl -X GET http://localhost:3000/api/models/allowed \
  -H "Authorization: Bearer <free_user_token>"
```

### Ожидаемый результат
```json
{
  "modelSpecs": {
    "enforce": true,
    "list": [
      {
        "name": "gpt-4o-mini",
        "label": "GPT-4.o Mini",
        "preset": {
          "endpoint": "openAI",
          "model": "gpt-4o-mini"
        }
      }
      // ← ТОЛЬКО free модели
    ]
  },
  "allowedSpecs": ["gpt-4o-mini"],
  "plan": "free"
}
```

### Pro пользователь
```bash
curl -X GET http://localhost:3000/api/models/allowed \
  -H "Authorization: Bearer <pro_user_token>"
```

### Ожидаемый результат
```json
{
  "modelSpecs": {
    "enforce": true,
    "list": [
      { "name": "gpt-4o", ... },
      { "name": "gpt-4o-mini", ... },
      { "name": "gpt-4.1-mini", ... },
      { "name": "claude-haiku-4-5", ... },
      { "name": "claude-sonnet-4-6", ... },
      { "name": "deepseek-chat", ... }
    ]
  },
  "allowedSpecs": ["gpt-4o", "gpt-4o-mini", "gpt-4.1-mini", "claude-haiku-4-5", "claude-sonnet-4-6", "deepseek-chat"],
  "plan": "pro"
}
```

---

## 🧪 СЦЕНАРИЙ 6: Frontend ModelSelector UI

### Шаги (в браузере DevTools)

#### 1. Проверить что UI использует spec
```javascript
// В компоненте ModelSelectorContent:
console.log('conversation.spec', conversation?.spec);  // ← должна быть spec.name
console.log('conversation.model', conversation?.model); // ← может быть undefined
```

#### 2. Проверить payload перед отправкой
```javascript
// В Network tab, при отправке запроса к /api/ask:
// Request Body должен содержать:
{
  "spec": "claude-haiku-4-5",
  "message": "Hello",
  // ← НЕ должна быть "model" в payload
}
```

#### 3. Проверить что ModelSelector показывает только доступные spec
```javascript
// Для free пользователя:
// Видно: "GPT-4.o Mini"
// НЕ видно: "Claude Sonnet 4.6", "Claude Opus 4.6"

// Для pro пользователя:
// Видно: "GPT-4.o Mini", "Claude Haiku 4.5", "Claude Sonnet 4.6"
// НЕ видно: "Claude Opus 4.6"

// Для business пользователя:
// Видно: ВСЕ модели
```

---

## 🔍 ОТЛАДКА

### Логи на backend
```bash
# Смотреть логи для проверки:
# 1. [SPEC CHECK] - middleware checkSpecAllowedForPlan
# 2. [buildEndpointOption] - преобразование spec в endpoint+model
# 3. [MODEL CHECK] - проверка model против плана (совместимость)

tail -f logs/librechat.log | grep "SPEC CHECK\|buildEndpointOption\|MODEL CHECK"
```

### Проверка payload в Network tab
```javascript
// Должен быть ТОЛЬКО spec, не model:
✅ Правильно: { spec: "claude-haiku-4-5" }
❌ Неправильно: { model: "claude-haiku-4-5" }
❌ Неправильно: { spec: "...", model: "..." } (конфликт)
```

### Проверка conversation в UI
```javascript
// DevTools Console:
// Правильно:
{
  spec: "claude-haiku-4-5",
  endpoint: null,  // ← может быть null, определяется на backend
  model: undefined // ← может быть undefined, определяется spec.preset
}

// Неправильно:
{
  spec: "claude-haiku-4-5",
  model: "claude-sonnet-4-6" // ← конфликт!
}
```

---

## ✅ КРИТЕРИИ УСПЕХА

### Backend
- ✅ checkSpecAllowedForPlan отклоняет запросы с недопустимой spec
- ✅ buildEndpointOption преобразует spec в endpoint+model из preset
- ✅ /api/models/allowed возвращает отфильтрованный список spec по плану
- ✅ Логи показывают правильный flow: spec → endpoint+model

### Frontend
- ✅ ModelSelector отправляет ТОЛЬКО spec в payload
- ✅ conversation.spec обновляется при выборе
- ✅ conversation.model НЕ обновляется вручную
- ✅ UI показывает только доступные spec для плана

### E2E
- ✅ Пользователь выбирает модель → она работает правильно
- ✅ Пользователь не может использовать недопустимую модель
- ✅ При смене плана список доступных моделей обновляется
- ✅ Нет конфликтов между spec и model

---

## 🚀 ИТОГОВЫЙ FLOW (Правильный)

```
1. UI: Пользователь видит список allowedSpecs (от /api/models/allowed)
2. UI: Выбирает spec (например "claude-haiku-4-5")
3. UI: Отправляет payload { spec: "claude-haiku-4-5" }
4. Backend: checkSpecAllowedForPlan проверяет spec против plana.allowedSpecs
5. Backend: buildEndpointOption преобразует:
   spec="claude-haiku-4-5" → endpoint="anthropic", model="claude-haiku-4-5"
6. Backend: checkSubscription проверяет model против plana.allowedModels (совместимость)
7. Backend: API вызывает claude-haiku-4-5 ✅
8. Result: Используется ПРАВИЛЬНАЯ модель (haiku, а не sonnet override)
```

---

## 📝 ЗАМЕТКИ

- `modelSpecs.enforce = true` - ОБЯЗАТЕЛЬНО для spec-driven архитектуры
- `spec` - источник истины для модели на backend
- `model` - определяется как `spec.preset.model` на backend
- `allowedSpecs` - ограничение доступа на уровне тарифа
- Конфликт `spec vs model` полностью исключён архитектурой
