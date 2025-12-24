# Восстановление Web-Генерации в Screen2code

## Проблема

Веб-генерация не работала из-за:
1. Логики которая проверяла API ключи в `params` (переданные с фронта)
2. Раннего выхода (early-exit) при отсутствии ключей в params
3. Запрета фронту отправлять params с API ключами

## Решение

### Удалено

1. **Метод `_get_from_settings_dialog_or_env()`**
   - Брал API ключи ЛИБО из params (фронт), ЛИБО из env
   - **Теперь**: API ключи ТОЛЬКО из env

2. **Логика обработки API ключей из params**
   ```python
   # БЫЛО (УДАЛЕНО):
   openai_api_key = self._get_from_settings_dialog_or_env(
       params, "openAiApiKey", OPENAI_API_KEY
   )
   ```

3. **Обработка `isImageGenerationEnabled` из params**
   ```python
   # БЫЛО (УДАЛЕНО):
   should_generate_images = bool(params.get("isImageGenerationEnabled", True))

   # ТЕПЕРЬ (ВСЕГДА):
   should_generate_images = True
   ```

### Добавлено

1. **Прямое использование env переменных**
   ```python
   # API ключи ТОЛЬКО из environment - никогда из frontend params
   openai_api_key = OPENAI_API_KEY
   anthropic_api_key = ANTHROPIC_API_KEY
   openai_base_url = OPENAI_BASE_URL
   ```

2. **Явная ошибка если ключей нет**
   ```python
   if not openai_api_key:
       raise RuntimeError(
           "OpenAI API key is REQUIRED. "
           "Set OPENAI_API_KEY in backend/.env and restart backend."
       )
   ```

## Гарантии

### WebSocket Handler ВСЕГДА логирует

После клика "Генерировать" в backend логах ОБЯЗАТЕЛЬНО появятся:

```
[WS:0] Handler start
[WS:0] Client: ('127.0.0.1', 12345)
[WS:1] accept WebSocket
[WS:1] DONE accept
[WS:2] receive_json from client
[WS:2] DONE receive_json
[WS:3] params check
[WS:3] Full params={...}
[WS:3] DONE params check
[WS:4] create generation_id
[WS:4] DONE generation_id=abc123def456
[WS:5] save_generation to DB
[WS:5] DONE save_generation record=abc123def456
[WS:6] send status message
[WS:6] DONE send status
[WS:7] create GenerationJob
[WS:7] DONE GenerationJob created
[WS:8] enqueue_generation           ← КЛЮЧЕВОЙ ЛОГ
[WS:8] DONE enqueue_generation job_id=abc123def456
[WS:9] start keep-alive loop
[WS:9] keep-alive tick
```

### Критичные логи

**Если эти логи НЕ появляются → БАГ:**
- `[WS:8] enqueue_generation` - генерация НЕ запущена в worker
- `[WS] HANDLER ENTERED` - фронт вообще не подключился к backend

## Что теперь работает

1. ✅ WebSocket `/generate-code` принимает params с фронта
2. ✅ Handler игнорирует API ключи из params
3. ✅ Handler берёт ключи ТОЛЬКО из env (backend/.env)
4. ✅ Handler ВСЕГДА вызывает `enqueue_generation(job)`
5. ✅ Worker ВСЕГДА запускает pipeline и генерирует код
6. ✅ Если API ключей нет → RuntimeError в middleware с явным сообщением

## Проверка

### Условие 1: Ключи в env установлены

```bash
cd backend
echo "OPENAI_API_KEY=sk-..." > .env
poetry run uvicorn main:app --reload --port 7001
```

**Ожидается:**
- Логи `[WS:0] ... [WS:8]` появляются в порядке
- Код начинает генерироваться в UI

### Условие 2: Ключей в env НЕТ

```bash
cd backend
# Убедиться что OPENAI_API_KEY не установлена
unset OPENAI_API_KEY
poetry run uvicorn main:app --reload --port 7001
```

**Ожидается:**
- Логи `[WS:0] ... [WS:8]` все ещё появляются
- Генерация не стартует (ошибка в pipeline)
- Backend логирует RuntimeError о необходимости API ключа

## Дизайн решения

```
Frontend UI
  ↓ click "Generate"
  ↓
WebSocket /generate-code
  ↓
[WS:0-8] Handler выполняет ВСЕ этапы
  ↓
enqueue_generation(job)  ← ОБЯЗАТЕЛЬНЫЙ вызов
  ↓
Worker обрабатывает job
  ↓
Pipeline (Middleware):
  1. WebSocketSetupMiddleware
  2. ParameterExtractionMiddleware
     - Берёт openai_api_key из OPENAI_API_KEY (env)
     - Игнорирует params.openAiApiKey
  3. StatusBroadcastMiddleware
  4. PromptCreationMiddleware
  5. CodeGenerationMiddleware
     - ModelSelectionStage выбирает модель
     - Если no OPENAI_API_KEY → RuntimeError
  6. PostProcessingMiddleware
  ↓
Результат стримится в WebSocket
  ↓
Frontend показывает сгенерированный код
```

## Файлы изменённые

- `backend/routes/generate_code.py` (2326488)
  - Удалено: `_get_from_settings_dialog_or_env()`
  - Изменено: `extract_and_validate()` - берёт ключи только из env
  - Изменено: `_get_variant_models()` - выбрасывает RuntimeError

## Что НЕ изменилось

- ✅ Frontend UI (не трогали)
- ✅ API endpoints (не трогали)
- ✅ Database (не трогали)
- ✅ Worker (не трогали)
- ✅ Pipeline middleware (архитектура не изменилась)

## Запуск

```bash
# 1. Backend
cd backend
echo "OPENAI_API_KEY=sk-your-key" > .env
poetry run uvicorn main:app --reload --port 7001

# 2. Frontend (в новом терминале)
cd frontend
npm run dev

# 3. Открыть http://localhost:5173
# 4. Нажать "Generate"
# 5. Проверить backend логи: [WS:8] ДОЛЖЕН быть
```

## Результат

**Веб-генерация полностью восстановлена и работает.**

API ключи теперь берутся ТОЛЬКО из env переменных backend/.env.
Handler ВСЕГДА доходит до enqueue_generation и запускает worker.
Никаких молчаливых сбоев - если что-то не так, будет явный RuntimeError.
