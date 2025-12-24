# Screenshot-to-Code API

REST API для генерации кода из скриншотов и URL.

## 🚀 Quick Start

### 1. Initialize Database

```bash
cd backend
python api/init_db.py
```

Это создаст:
- Таблицы `api_keys` и `generations`
- Development API key: `sk_test_development_key_12345678`

### 2. Run API Server

```bash
# API is integrated into main app
cd backend
uvicorn main:app --reload --port 8000
```

Or run the standalone API app:
```bash
uvicorn api.app:app --reload --port 8000
```

### 3. Test API

```bash
# Health check
curl http://localhost:8000/api/health

# Get formats (requires API key)
curl -H "X-API-Key: sk_test_development_key_12345678" \
  http://localhost:8000/api/formats

# Check limits
curl -H "X-API-Key: sk_test_development_key_12345678" \
  http://localhost:8000/api/limits
```

---

## 📚 Documentation

- **API Spec**: `API_SPEC.md` - полная спецификация эндпоинтов
- **Data Model**: `DATA_MODEL.md` - схема базы данных

---

## 🏗️ Architecture

```
backend/
├── api/                    # API layer (NEW)
│   ├── __init__.py
│   ├── app.py             # FastAPI application
│   ├── init_db.py         # Database initialization
│   ├── auth.py            # API key authentication
│   ├── credits.py         # Credits management
│   ├── models/            # Pydantic schemas
│   │   ├── requests.py
│   │   └── responses.py
│   └── routes/            # API endpoints
│       ├── health.py      # ✅ GET /api/health
│       ├── formats.py     # ✅ GET /api/formats
│       ├── generate.py    # ⚠️ POST /api/generate (partial)
│       ├── generations.py # ✅ GET /api/generations/{id}
│       ├── limits.py      # ⚠️ GET /api/limits (partial)
│       └── stream.py      # ⚠️ WS /api/stream/{id} (stub)
│
├── routes/                 # Existing UI routes
│   └── generate_code.py   # WebSocket generation logic
│
└── db/                     # Database
    └── app.db             # SQLite database
```

---

## ✅ Implemented

### Completed Endpoints

| Endpoint | Status | Notes |
|----------|--------|-------|
| `GET /api/health` | ✅ | Fully working |
| `GET /api/formats` | ✅ | Fully working |
| `POST /api/generate` | ✅ | Triggers background generation via queue |
| `GET /api/generations/{id}` | ✅ | Fully working |
| `GET /api/limits` | ✅ | Returns actual concurrent and hourly counts |
| `WS /api/stream/{id}` | ✅ | Streams from database with polling |

### Features

✅ API key authentication
✅ Credits deduction
✅ Tier-based access (free/pro)
✅ Database schema
✅ Request validation
✅ Error handling

---

## ✅ Integration Complete

All priority tasks have been completed:

### ✅ Priority 1: Generation Integration

**Implementation:**
- Created `api/generation_service.py` with `DatabaseWebSocket` mock
- Integrated with existing queue system (`gen_queue`)
- Background generation triggered via `asyncio.create_task()`
- Results stored in `data/api.db` generations table

**How it works:**
1. POST `/api/generate` saves generation record
2. Triggers background task that enqueues job
3. Queue worker processes job using existing pipeline
4. Mock WebSocket writes chunks to database instead of streaming
5. Database updated on completion/failure

---

### ✅ Priority 2: WebSocket Streaming

**Implementation:**
- Implemented polling-based streaming in `api/routes/stream.py`
- Reads from database every 0.5s
- Streams new chunks as they become available
- Handles completed/failed states
- 5-minute timeout with graceful cleanup

**How it works:**
1. Client connects to WS `/api/stream/{id}`
2. Endpoint verifies API key and ownership
3. If generation complete, streams all chunks immediately
4. If processing, polls database for updates
5. Closes connection on completion/failure/timeout

---

### ✅ Priority 3: Rate Limiting

**Implementation:**
- Implemented actual tracking in `api/routes/limits.py`
- Concurrent: Counts `status='processing'` generations
- Hourly: Counts generations created in last hour
- Uses SQLite queries (can be optimized with Redis later)

**Database queries:**
```python
# Concurrent
SELECT COUNT(*) FROM generations
WHERE api_key_id = ? AND status = 'processing'

# Hourly
SELECT COUNT(*) FROM generations
WHERE api_key_id = ? AND created_at > ?
```

---

## 🧪 Testing

### Manual Testing

```bash
# 1. Generate code
curl -X POST http://localhost:8000/api/generate \
  -H "X-API-Key: sk_test_development_key_12345678" \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "type": "url",
      "data": "https://example.com"
    },
    "format": "html_tailwind",
    "instructions": "Make it beautiful"
  }'

# Response:
# {
#   "generation_id": "gen_abc123...",
#   "status": "processing",
#   "credits_charged": 1,
#   "stream_url": "ws://..."
# }

# 2. Get generation result
curl -H "X-API-Key: sk_test_development_key_12345678" \
  http://localhost:8000/api/generate/gen_abc123...
```

---

## 📊 Database

**Note:** API uses separate database `data/api.db` to avoid schema conflicts with UI database `data/app.db`.

### Check API Keys

```bash
sqlite3 backend/data/api.db
```

```sql
-- List all API keys
SELECT id, name, tier, credits_total, credits_used
FROM api_keys;

-- Add new API key
INSERT INTO api_keys (id, key_hash, name, tier, credits_total)
VALUES (
  'key_custom_1',
  -- Generate hash: echo -n 'your_secret_key' | sha256sum
  'hash_here',
  'My API Key',
  'pro',
  1000
);
```

### Check Generations

```sql
-- List recent generations
SELECT id, format, status, credits_charged, created_at
FROM generations
ORDER BY created_at DESC
LIMIT 10;

-- Count by status
SELECT status, COUNT(*) FROM generations GROUP BY status;
```

---

## 🔐 Security

### Production Checklist

- [ ] Change CORS `allow_origins` from `*` to specific domains
- [ ] Use HTTPS only
- [ ] Implement rate limiting (Redis recommended)
- [ ] Add request size limits
- [ ] Set up monitoring/logging
- [ ] Rotate development API keys
- [ ] Add webhook signatures (if implementing webhooks)

---

## 💡 Next Steps

### Immediate (Required for MVP)

1. **Integrate generation** - Connect `/api/generate` to actual code generation
2. **Integrate streaming** - Connect `/api/stream` to existing WebSocket
3. **Add rate limiting** - Track concurrent and hourly limits

### Short-term (Nice to have)

4. **Add polling endpoint** - `GET /api/generations/{id}/status` for clients without WebSocket
5. **Add list endpoint** - `GET /api/generations?limit=10` for history
6. **Add cleanup job** - Delete generations older than 30 days

### Long-term (Future)

7. **Add webhooks** - Notify on generation completion
8. **Add analytics** - Track usage, popular formats, success rate
9. **Add variants** - Support multiple generation variants
10. **Add refinements** - Allow iterating on existing generations

---

## 📞 Support

For questions or integration help:
- Read `API_SPEC.md` for detailed endpoint documentation
- Check `DATA_MODEL.md` for database schema
- Review existing code in `routes/generate_code.py` for generation logic

---

## License

Same as main project.
