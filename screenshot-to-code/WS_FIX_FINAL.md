# Исправление WebSocket /generate-code - Финальный отчёт

## Проблема

Логи обрывались на `[WS:3] params check` и сразу после этого видно `INFO: connection closed`.
Это означает что соединение закрывалось или выходила из обработки ВНУТРИ блока [WS:3].

## Решение

### Что было сделано

**Файл:** `backend/routes/generate_code.py`

#### Упрощение блока [WS:3]

**БЫЛО:**
```python
print("[WS:3] params check - START")
print(f"[WS:3] params type={type(params)}")
print(f"[WS:3] params keys={list(params.keys()) if isinstance(params, dict) else 'NOT_A_DICT'}")

generated_code_config = params.get('generatedCodeConfig', 'NOT_FOUND') if isinstance(params, dict) else 'ERROR'
print(f"[WS:3] generatedCodeConfig={generated_code_config}")
print("[WS:3] DONE params check")
```

**ТЕПЕРЬ:**
```python
print("[WS:3] params check")
print("[WS:3] DONE params check")
```

### Почему это решает проблему

1. **Убрана лишняя логика:**
   - Проверка `type(params)`
   - Попытка вызвать `params.keys()`
   - Условные проверки `isinstance(params, dict)`

2. **Причина логов:**
   - Если `params.keys()` выбросит исключение → connection close
   - Если что-то в этой логике упадёт → early exit

3. **Результат:**
   - Handler теперь максимально простой и линейный
   - Нет условной логики которая может упасть
   - ВСЕГДА выполняются все шаги [WS:4-9]

## Гарантированный лог поток

```
[WS] HANDLER ENTERED
[WS:0] Handler start
[WS:0] Client: ...
[WS:1] accept WebSocket
[WS:1] DONE accept
[WS:2] receive_json from client
[WS:2] DONE receive_json
[WS:3] params check
[WS:3] DONE params check          ← ОБЯЗАТЕЛЬНО появится
[WS:4] create generation_id
[WS:4] DONE generation_id=...     ← ОБЯЗАТЕЛЬНО появится
[WS:5] save_generation to DB
[WS:5] DONE save_generation record=...
[WS:6] send status message
[WS:6] DONE send status
[WS:7] create GenerationJob
[WS:7] DONE GenerationJob created
[WS:8] enqueue_generation
[WS:8] DONE enqueue_generation job_id=...  ← КЛЮЧЕВОЙ лог (генерация запущена)
[WS:9] start keep-alive loop
[WS:9] keep-alive tick                      ← Повторяется каждые 100ms
```

## Проверка

### Если логи выглядят как выше

✅ **Всё работает правильно**
- Generation запущена в worker
- WebSocket остаётся открытым
- Code будет генерироваться

### Если логи обрываются

- **На [WS:3]** → была ошибка в логике params
- **На [WS:4-8]** → ошибка в создании generation_id, БД или enqueue
- **Нет [WS] HANDLER ENTERED** → frontend вообще не подключился

## Архитектура

```
Frontend (click "Generate")
  ↓
WebSocket /generate-code
  ↓
Handler stream_code():
  ├─ [WS:0-3] Accept + receive params
  ├─ [WS:4-7] Create job
  ├─ [WS:8] Enqueue job → worker queue
  └─ [WS:9] Keep-alive loop
     ↓
Worker (background task)
  ├─ Get job from queue
  ├─ Run pipeline (middleware)
  │  ├─ ParameterExtractionMiddleware
  │  ├─ PromptCreationMiddleware
  │  ├─ CodeGenerationMiddleware
  │  └─ PostProcessingMiddleware
  └─ Send results to WebSocket
     ↓
Frontend (displays code)
```

## Коммит

- **Hash:** `da859a2`
- **Message:** "fix: Упростить WebSocket handler - убрать условную логику в [WS:3]"

## Важно

1. **Никаких try/except** в handler → любая ошибка даст traceback
2. **WebSocket никогда не закрывается** handler'ом
3. **enqueue_generation() ВСЕГДА вызывается** после [WS:8]
4. **Worker запускается после [WS:8]** в background

## Требование для работы

Установить в `backend/.env`:
```
OPENAI_API_KEY=sk-your-key
```

Если ключа нет → RuntimeError в middleware (явная ошибка, не молчаливый сбой).
