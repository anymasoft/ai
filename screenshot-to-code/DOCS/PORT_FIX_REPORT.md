# Исправление Портов - Backend на 7001

## Проблема

Backend запускался на дефолтном порту **8000** вместо **7001**.
Это вызывало разборки в подключении Frontend и API.

## Решение

### Дефолтный порт Backend

Backend запускается через:
```bash
# Способ 1: start.py (рекомендуется)
poetry run python start.py  # → порт 7001

# Способ 2: npm из корня
npm run dev:backend  # → порт 7001

# Способ 3: прямой uvicorn (НЕПРАВИЛЬНО)
poetry run uvicorn main:app --reload  # → порт 8000 ❌
```

**`start.py` явно указывает `port=7001`** - это правильный порт для проекта.

### Изменённые файлы

#### 1. Backend API Routes
**Файл:** `backend/api/routes/generate.py` (строка 108)

**БЫЛО:**
```python
stream_url = f"ws://127.0.0.1:8000/api/stream/{generation_id}"
```

**ТЕПЕРЬ:**
```python
stream_url = f"ws://127.0.0.1:7001/api/stream/{generation_id}"
```

#### 2. Frontend Billing API
**Файл:** `frontend/src/logic/billing/api.ts` (строка 5)

**БЫЛО:**
```typescript
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'
```

**ТЕПЕРЬ:**
```typescript
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:7001'
```

#### 3. Документация
- `API_README.md` - все `localhost:8000` → `localhost:7001`
- `API_INTEGRATION_COMPLETE.md` - все `localhost:8000` → `localhost:7001`
- `YUKASSA_INTEGRATION.md` - все `localhost:8000` → `localhost:7001`

## Гарантия

✅ **Backend запускается на:** `http://127.0.0.1:7001`

✅ **Frontend подключается к WebSocket на:** `ws://127.0.0.1:7001/generate-code`

✅ **API endpoints доступны на:** `http://127.0.0.1:7001/api/*`

✅ **WebSocket потоковых результатов на:** `ws://127.0.0.1:7001/api/stream/*`

## Запуск

```bash
# Backend (из корня)
npm run dev:backend
# ИЛИ
cd backend
poetry run python start.py

# Frontend (из корня)
npm run dev:frontend
# ИЛИ
cd frontend
npm run dev

# Оба сразу
npm run dev
```

## Проверка

Открыть http://localhost:5173 в браузере.

В DevTools Console должны появиться логи:
```
[WS] Connecting to backend @ ws://127.0.0.1:7001/generate-code
[WS] ✓ CONNECTED to backend successfully
```

В backend консоли должны появиться:
```
[WS] HANDLER ENTERED
[WS:0] Handler start
...
[WS:8] DONE enqueue_generation
```

## Коммит

- **Hash:** `34dcbb4`
- **Message:** "fix: Изменить все порты с 8000 на 7001"

## Почему это было проблемой

1. **Frontend** использует `VITE_WS_BACKEND_URL=ws://127.0.0.1:7001`
2. **Backend start.py** явно запускает на `port=7001`
3. **API routes** указывали на `ws://127.0.0.1:8000` (неправильно)
4. **Frontend billing api** указывала на `http://localhost:8000` (неправильно)

Это создавало несоответствие между тем где запускается backend и где frontend его ищет.

## Больше не будет

❌ Попыток подключиться к неправильному порту
❌ "connection refused" ошибок
❌ WebSocket таймаутов
✅ Корректного подключения Front-End к Backend на единственном правильном порту 7001
