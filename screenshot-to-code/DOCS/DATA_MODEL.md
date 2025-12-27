# Data Model

## 1. APIKey

Represents an API key for authentication and billing.

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | ✅ | Primary key, format: `key_xxx` |
| `key_hash` | string | ✅ | SHA256 hash of actual API key |
| `name` | string | ❌ | Human-readable label |
| `tier` | string | ✅ | `free` or `pro` |
| `credits_total` | int | ✅ | Total credits allocated |
| `credits_used` | int | ✅ | Credits consumed, default: 0 |
| `rate_limit_concurrent` | int | ✅ | Max concurrent generations, default: 10 |
| `rate_limit_hourly` | int | ✅ | Max generations per hour, default: 100 |
| `created_at` | datetime | ✅ | Creation timestamp |
| `last_used_at` | datetime | ❌ | Last successful request |
| `is_active` | bool | ✅ | Key enabled/disabled, default: true |

### Indexes
- `key_hash` (unique)
- `is_active`

### Business Rules
- API key is random 32-char string: `sk_live_xxx` or `sk_test_xxx`
- Only hash is stored in DB
- `credits_available = credits_total - credits_used`
- Tier determines which formats are accessible:
  - `free`: html_tailwind, html_css
  - `pro`: all formats

### Extensibility
Future fields:
- `organization_id` - multi-tenancy
- `allowed_formats` - granular format permissions
- `webhook_url` - generation completion notifications

---

## 2. Generation

Represents a single code generation request and result.

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | ✅ | Primary key, format: `gen_xxx` |
| `api_key_id` | string | ✅ | Foreign key → APIKey.id |
| `status` | string | ✅ | `processing`, `completed`, `failed` |
| `format` | string | ✅ | Output format requested |
| `input_type` | string | ✅ | `image` or `url` |
| `input_data` | string | ✅ | Base64 image or URL |
| `input_thumbnail` | string | ❌ | Small preview for display |
| `instructions` | string | ❌ | User instructions |
| `result_code` | text | ❌ | Generated HTML code |
| `error_message` | string | ❌ | Error if failed |
| `credits_charged` | int | ✅ | Credits deducted |
| `model_used` | string | ❌ | LLM model name |
| `duration_ms` | int | ❌ | Generation duration |
| `created_at` | datetime | ✅ | Request timestamp |
| `started_at` | datetime | ❌ | Generation start |
| `completed_at` | datetime | ❌ | Generation end |

### Indexes
- `api_key_id, created_at DESC`
- `status`
- `created_at` (for cleanup)

### Status Transitions
```
processing → completed (success)
processing → failed (error)
```

No other transitions allowed.

### Business Rules
- `credits_charged` set immediately on creation
- `result_code` only populated on `completed` status
- `error_message` only populated on `failed` status
- Old generations (>30 days) can be purged

### Extensibility
Future fields:
- `variant_count` - number of variants generated
- `variant_index` - if multiple variants
- `parent_generation_id` - for refinements/iterations
- `metadata` - JSON field for extra data

---

## 3. RateLimit (in-memory or cache)

Track hourly rate limits per API key.

### Structure (Redis/dict)
```python
{
  "key_xxx:hour:2024-12-24T10": {
    "count": 5,
    "reset_at": "2024-12-24T11:00:00Z"
  }
}
```

Not persisted to SQLite - ephemeral.

---

## Database Schema (SQLite)

```sql
CREATE TABLE api_keys (
    id TEXT PRIMARY KEY,
    key_hash TEXT NOT NULL UNIQUE,
    name TEXT,
    tier TEXT NOT NULL DEFAULT 'free',
    credits_total INTEGER NOT NULL DEFAULT 0,
    credits_used INTEGER NOT NULL DEFAULT 0,
    rate_limit_concurrent INTEGER NOT NULL DEFAULT 10,
    rate_limit_hourly INTEGER NOT NULL DEFAULT 100,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT 1
);

CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_active ON api_keys(is_active);

CREATE TABLE generations (
    id TEXT PRIMARY KEY,
    api_key_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'processing',
    format TEXT NOT NULL,
    input_type TEXT NOT NULL,
    input_data TEXT NOT NULL,
    input_thumbnail TEXT,
    instructions TEXT,
    result_code TEXT,
    error_message TEXT,
    credits_charged INTEGER NOT NULL,
    model_used TEXT,
    duration_ms INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    FOREIGN KEY (api_key_id) REFERENCES api_keys(id)
);

CREATE INDEX idx_generations_api_key ON generations(api_key_id, created_at DESC);
CREATE INDEX idx_generations_status ON generations(status);
CREATE INDEX idx_generations_created ON generations(created_at);
```

---

## Initial Data

### Default API Key (for development)

```sql
INSERT INTO api_keys (
    id,
    key_hash,
    name,
    tier,
    credits_total,
    credits_used
) VALUES (
    'key_dev_default',
    -- hash of 'sk_test_development_key_12345678'
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    'Development Key',
    'pro',
    10000,
    0
);
```

Actual key: `sk_test_development_key_12345678`

---

## Relationships

```
APIKey (1) ←→ (N) Generation
```

One API key can have many generations.
Generation always belongs to one API key.

---

## Data Retention

- **Generations:** Keep for 30 days, then purge
- **API Keys:** Keep indefinitely unless manually deleted
- **Rate limit data:** Keep for current hour only

Cleanup job runs daily:
```sql
DELETE FROM generations
WHERE created_at < datetime('now', '-30 days');
```
