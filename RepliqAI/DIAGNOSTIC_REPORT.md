# 🔍 ДИАГНОСТИЧЕСКИЙ ОТЧЕТ: ИСТОЧНИКИ МОДЕЛЕЙ В СЕЛЕКТОРЕ

**Дата:** 2026-03-03
**Статус:** ДИАГНОСТИКА (никаких исправлений не сделано)

---

## 📋 ЧТО ПРОВЕРЯЕТСЯ

1. **Выполняется ли запрос GET /api/models/allowed?**
2. **Где формируется итоговый массив моделей?**
3. **Есть ли fallback на startupConfig.modelSpecs?**
4. **Какие React Query параметры используются?**
5. **Какой реальный ответ приходит с backend?**

---

## ✅ ДОБАВЛЕННЫЕ ЛОГИ В КОД

### Файл: `client/src/components/Chat/Menus/Endpoints/ModelSelectorContext.tsx`

#### ЛОГИРОВАНИЕ В QUERYFN (строки ~79-100)

```
✅ console.log('[MODELS_DIAGNOSTIC] Starting fetch GET /api/models/allowed');
✅ console.log('[MODELS_DIAGNOSTIC] GET /api/models/allowed response status:', res.status);
✅ console.log('[MODELS_DIAGNOSTIC] GET /api/models/allowed response data:', data);
✅ console.log('[MODELS_DIAGNOSTIC] Models count:', data.models?.length);
✅ console.log('[MODELS_DIAGNOSTIC] Models:', data.models?.map(m => m.modelId));
✅ console.log('[MODELS_DIAGNOSTIC] Plan:', data.plan);
```

#### ЛОГИРОВАНИЕ В USEMEMO (строки ~102-150)

```
✅ console.log('[MODELS_DIAGNOSTIC] allowedModelsQuery.data:', allowedModelsQuery.data);
✅ console.log('[MODELS_DIAGNOSTIC] allowedModelsQuery.isLoading:', allowedModelsQuery.isLoading);
✅ console.log('[MODELS_DIAGNOSTIC] allowedModelsQuery.error:', allowedModelsQuery.error);
✅ console.log('[MODELS_DIAGNOSTIC] Using allowedModels from API, count:', count);
✅ console.log('[MODELS_DIAGNOSTIC] FALLBACK to startupConfig.modelSpecs');
✅ console.log('[MODELS_DIAGNOSTIC] FINAL modelSpecs for selector:', modelSpecs.map(m => m.name));
```

---

## 📊 ПАРАМЕТРЫ useQuery В КОДЕ

```typescript
const allowedModelsQuery = useQuery({
  queryKey: ['allowedModels'],           // ← KEY ПАРАМЕТР 1
  queryFn: async () => { ... },          // ← Функция запроса
  staleTime: 60_000,                     // ← 60 сек кэш
  gcTime: 5 * 60_000,                    // ← 5 мин в памяти
  // enabled: не указан (=true по умолчанию)
  // retry: не указан (=3 по умолчанию)
});
```

---

## 🔍 КАК ЗАПУСТИТЬ ДИАГНОСТИКУ

### ШАГИ:

1. **Пересобрать фронтенд:**
   ```bash
   cd /home/user/ai/LibreChat
   npm run build
   ```

2. **Запустить локально:**
   ```bash
   npm run dev
   ```
   Откройте http://localhost:3080

3. **Открыть DevTools:**
   - F12 → Console tab
   - Фильтр: [MODELS_DIAGNOSTIC]

4. **Открыть селектор моделей:**
   - Нажмите кнопку "Select Model" в чате

5. **Посмотреть логи:**
   - Console должна показать логи [MODELS_DIAGNOSTIC]
   - Читать в порядке появления

6. **Проверить Network:**
   - DevTools → Network tab
   - Фильтр: /api/models/allowed
   - Status? Response?

---

## 🎯 ЧТО ИЩЕМ

### Пример хороших логов (API работает):

```
[MODELS_DIAGNOSTIC] Starting fetch GET /api/models/allowed
[MODELS_DIAGNOSTIC] GET /api/models/allowed response status: 200
[MODELS_DIAGNOSTIC] GET /api/models/allowed response data: { models: [...], plan: 'pro' }
[MODELS_DIAGNOSTIC] Models count: 7
[MODELS_DIAGNOSTIC] Models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', ...]
[MODELS_DIAGNOSTIC] Plan: pro
[MODELS_DIAGNOSTIC] allowedModelsQuery.data: { models: [...], plan: 'pro' }
[MODELS_DIAGNOSTIC] allowedModelsQuery.isLoading: false
[MODELS_DIAGNOSTIC] allowedModelsQuery.error: null
[MODELS_DIAGNOSTIC] Using allowedModels from API, count: 7
[MODELS_DIAGNOSTIC] Mapped specs from API: ['gpt-4o', 'gpt-4o-mini', ...]
[MODELS_DIAGNOSTIC] FINAL modelSpecs for selector: ['gpt-4o', 'gpt-4o-mini', ...]
```

### Пример плохих логов (Fallback):

```
[MODELS_DIAGNOSTIC] Starting fetch GET /api/models/allowed
[MODELS_DIAGNOSTIC] GET /api/models/allowed response status: 401
[MODELS_DIAGNOSTIC] FALLBACK to startupConfig.modelSpecs  ← ⚠️ FALLBACK!
[MODELS_DIAGNOSTIC] startupConfig.modelSpecs.list count: 16  ← 16 вместо 7!
[MODELS_DIAGNOSTIC] FINAL modelSpecs for selector: 16 моделей  ← ВСЕ модели!
```

---

## 📋 ЧЕКЛИСТ ДИАГНОСТИКИ

- [ ] npm run build выполнен (нет старого кэша)
- [ ] npm run dev запущен (http://localhost:3080)
- [ ] DevTools открыт (F12)
- [ ] Console фильтрован ([MODELS_DIAGNOSTIC])
- [ ] Селектор открыт (нажата кнопка "Select Model")
- [ ] Логи видны в Console
- [ ] Network запрос /api/models/allowed видна (или нет?)
- [ ] Response от API содержит models?
- [ ] Plan правильный?
- [ ] FINAL modelSpecs показывает сколько моделей?

---

## 🔑 КЛЮЧЕВЫЕ ВОПРОСЫ ДЛЯ ОТВЕТА

После запуска диагностики ответьте:

1. **Выполняется ли запрос?**
   - Видна ли строка `Starting fetch GET /api/models/allowed`?

2. **Какой статус ответа?**
   - Status 200 (успешно) или 401/500 (ошибка)?

3. **Какие модели приходят с API?**
   - Сколько моделей в Models count?
   - Какие modelId?

4. **Используется ли API или Fallback?**
   - Видна ли строка `Using allowedModels from API`?
   - Или видна `FALLBACK to startupConfig`?

5. **Сколько моделей в итоговом массиве?**
   - FINAL modelSpecs count: 7 (как в плане) или 16 (все)?

---

## 📍 ЛОКАЦИЯ ЛОГОВ В КОДЕ

| Что | Файл | Строки | Уровень |
|-----|------|--------|---------|
| queryFn логи | ModelSelectorContext.tsx | ~79-100 | fetch-уровень |
| useMemo логи | ModelSelectorContext.tsx | ~102-150 | логика-уровень |
| Финальный | ModelSelectorContext.tsx | ~152 | результат |

---

**Status:** 🔍 ДИАГНОСТИКА АКТИВНА И ГОТОВА К ЗАПУСКУ

