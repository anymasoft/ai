# 🎯 ПЛАН ВЫПОЛНЕНИЯ ДИАГНОСТИКИ

**Цель:** Найти источник проблемы - почему селектор показывает ВСЕ 16 моделей вместо фильтрованных по плану.

---

## 📊 ГИПОТЕЗЫ ДО ЗАПУСКА

| Гипотеза | Если True | Логи покажут |
|----------|-----------|-------------|
| **H1:** API не вызывается вообще | Fallback на startupConfig | `FALLBACK to startupConfig` |
| **H2:** API вызывается но возвращает 401/500 | Ошибка auth | `response status: 401/500` |
| **H3:** API возвращает ВСЕ модели (16) | Backend не фильтрует | `Models count: 16` вместо 7 |
| **H4:** API возвращает 7 моделей но код игнорирует | Ошибка в useMemo | `API returns 7` но `FINAL: 16` |

---

## ✅ ШАГИ ДИАГНОСТИКИ

### ЭТАП 1: Подготовка (~2 минуты)

- [ ] npm install завершен (уже запущен)
- [ ] npm run build завершен и успешен (после install)
- [ ] npm run dev запущен и слушает http://localhost:3080

### ЭТАП 2: Открытие приложения (~1 минута)

- [ ] Открыт браузер на http://localhost:3080
- [ ] Приложение загрузилось без ошибок
- [ ] Вы авторизованы (видна переписка)

### ЭТАП 3: Подготовка DevTools (~30 секунд)

- [ ] Открыт DevTools (F12)
- [ ] Перейдена на вкладка "Console" (не Elements, не Network)
- [ ] В поле фильтра Console введено: `[MODELS_DIAGNOSTIC]`

### ЭТАП 4: Открытие селектора (~10 секунд)

- [ ] Нажата кнопка "Select Model" в чате
- [ ] Видна шапка селектора с поиском и списком моделей

### ЭТАП 5: Сбор логов (~10 секунд)

Консоль должна показать логи в таком порядке (смотрите ТОЛЬКО строки с [MODELS_DIAGNOSTIC]):

```
1️⃣ [MODELS_DIAGNOSTIC] Starting fetch GET /api/models/allowed
2️⃣ [MODELS_DIAGNOSTIC] GET /api/models/allowed response status: XXX
3️⃣ [MODELS_DIAGNOSTIC] GET /api/models/allowed response data: {...}
4️⃣ [MODELS_DIAGNOSTIC] Models count: N
5️⃣ [MODELS_DIAGNOSTIC] Models: [...]
6️⃣ [MODELS_DIAGNOSTIC] Plan: XXX
7️⃣ [MODELS_DIAGNOSTIC] allowedModelsQuery.data: {...}
8️⃣ [MODELS_DIAGNOSTIC] allowedModelsQuery.isLoading: false
9️⃣ [MODELS_DIAGNOSTIC] allowedModelsQuery.error: null
🔟 [MODELS_DIAGNOSTIC] Using allowedModels from API, count: N
    OR
    [MODELS_DIAGNOSTIC] FALLBACK to startupConfig.modelSpecs
1️⃣1️⃣ [MODELS_DIAGNOSTIC] Mapped specs from API: [...]
1️⃣2️⃣ [MODELS_DIAGNOSTIC] FINAL modelSpecs for selector: [...]
```

### ЭТАП 6: Проверка Network (~30 секунд)

- [ ] Перейти на Network tab в DevTools
- [ ] Очистить фильтры
- [ ] В фильтре введить: `/api/models/allowed`
- [ ] Если видна строка - нажать на нее
- [ ] Посмотреть:
  - Status (должен быть 200)
  - Response (должны быть models и plan)

---

## 🔍 КЛЮЧЕВЫЕ МЕТРИКИ ДЛЯ СБОРА

### Метрика 1: Выполняется ли запрос?
```
✅ ЛОГИКА: Видна ли строка "Starting fetch"?
   - YES → Запрос ВЫПОЛНЯЕТСЯ
   - NO  → Запрос НЕ ВЫПОЛНЯЕТСЯ (почему? проверить devtools)
```

### Метрика 2: HTTP статус
```
✅ ЛОГИКА: Какой статус в "response status"?
   - 200 → API успешен
   - 401 → Ошибка авторизации (нет токена?)
   - 500 → Ошибка сервера
   - Нет строки → Запрос не дошел
```

### Метрика 3: Количество моделей от API
```
✅ ЛОГИКА: Какое число в "Models count"?
   - 7 или 8 → Фильтр работает! ✅
   - 16 → Фильтр не работает! ❌ (проверить backend)
   - 0 → Все модели отфильтрованы
   - Нет строки → API не вернул models
```

### Метрика 4: Используется ли API или Fallback?
```
✅ ЛОГИКА: Какая строка видна?
   - "Using allowedModels from API" → Отлично! ✅
   - "FALLBACK to startupConfig" → Проблема! ❌ (почему fallback?)
```

### Метрика 5: Финальное количество моделей
```
✅ ЛОГИКА: Сколько в "FINAL modelSpecs for selector"?
   - 7-8 → Правильно! ✅
   - 16  → ВОТ ПРОБЛЕМА! ❌
```

---

## 📝 ФОРМА СБОРА РЕЗУЛЬТАТОВ

Скопируйте и заполните:

```
РЕЗУЛЬТАТЫ ДИАГНОСТИКИ
======================

Дата/время: [ЗАПОЛНИТЬ]
Пользователь план: [ЗАПОЛНИТЬ - free/pro/business?]

1️⃣  Запрос выполняется?
   [ ] YES - видна "Starting fetch"
   [ ] NO  - логов вообще нет

2️⃣  HTTP статус:
   Ответ: [ЗАПОЛНИТЬ - 200/401/500/...]

3️⃣  Модели от API:
   Количество: [ЗАПОЛНИТЬ - сколько?]
   Список: [ЗАПОЛНИТЬ - какие modelId?]

4️⃣  API или Fallback?
   [ ] Using allowedModels from API
   [ ] FALLBACK to startupConfig

5️⃣  Финальное количество:
   [ЗАПОЛНИТЬ - сколько?]

6️⃣  Network запрос:
   [ ] Видна строка /api/models/allowed
   [ ] Status: [ЗАПОЛНИТЬ]
   [ ] Response содержит models? [YES/NO]

ВЫВОДЫ:
-------
[НАПИСАТЬ - что это означает?]
```

---

## 🚨 ЕСЛИ ЧТО-ТО ПОШЛО НЕ ТАК

### Если npm install не успешен:
```bash
rm -rf node_modules package-lock.json
npm install
```

### Если npm run build не успешен:
```bash
npm install
npm run build
```

### Если npm run dev не запускается:
```bash
# Проверить какие процессы слушают порт 3080
lsof -i :3080
# Если есть - убить:
kill -9 <PID>
# Или запустить на другом порту:
npm run dev -- --port 3081
```

### Если DevTools показывает старый код:
```
Жесткая перезагрузка страницы: Ctrl+Shift+R (или Cmd+Shift+R на Mac)
```

### Если логов нет вообще:
```
1. Проверить что npm run build реально пересобрал код
2. Перезагрузить страницу (Ctrl+Shift+R)
3. Открыть новый селектор
4. Проверить что код содержит console.log:
   grep -n "MODELS_DIAGNOSTIC" client/src/components/Chat/Menus/Endpoints/ModelSelectorContext.tsx
```

---

## ✨ ЧТО ДАЛЬШЕ

После сбора результатов:

1. **Если API работает (200, 7 моделей, используется):**
   - ✅ Значит проблема РЕШЕНА!
   - Перестроить npm run build еще раз
   - Перезагрузить http://localhost:3080

2. **Если API не вызывается (нет логов):**
   - ❌ Проверить: компонент не монтируется? useQuery отключен?
   - Проверить Network tab - запрос вообще отправляется?
   - Проверить browser console на ошибки

3. **Если API возвращает 16 моделей:**
   - ❌ Проблема в BACKEND
   - Проверить: api/server/routes/models.js line 52-54
   - Проверить: Plan.allowedModels в БД

4. **Если API возвращает 7 но FINAL показывает 16:**
   - ❌ Проблема в USEMEMO ЛОГИКЕ
   - Проверить: условие `if (allowedModelsQuery.data?.models)`
   - Может ли быть что-то кэшировалось неправильно?

---

**Статус:** 🔍 ГОТОВ К ЗАПУСКУ ДИАГНОСТИКИ
