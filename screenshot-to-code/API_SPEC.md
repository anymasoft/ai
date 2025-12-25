# Screenshot-to-Code API Specification

Version: 1.0
Date: 2024-12-24

## Authentication

All requests (except `/health`) require API key in header:

```
X-API-Key: your_api_key_here
```

Response codes for auth:
- `401 Unauthorized` - missing or invalid API key
- `403 Forbidden` - valid key but insufficient credits

---

## Endpoints

### 1. GET /api/health

Health check endpoint.

**Request:**
```http
GET /api/health
```

**Response:** `200 OK`
```json
{
  "status": "ok",
  "version": "1.0"
}
```

---

### 2. GET /api/formats

List available output formats and their costs.

**Request:**
```http
GET /api/formats
X-API-Key: xxx
```

**Response:** `200 OK`
```json
{
  "formats": [
    {
      "id": "html_tailwind",
      "name": "HTML + Tailwind",
      "tier": "free",
      "cost": 1
    },
    {
      "id": "html_css",
      "name": "HTML + CSS",
      "tier": "free",
      "cost": 1
    },
    {
      "id": "react_tailwind",
      "name": "React + Tailwind",
      "tier": "pro",
      "cost": 2
    },
    {
      "id": "vue_tailwind",
      "name": "Vue + Tailwind",
      "tier": "pro",
      "cost": 2,
      "beta": true
    }
  ]
}
```

---

### 3. POST /api/generate

Start code generation.

**Credits are deducted immediately on successful start.**

**Request:**
```http
POST /api/generate
X-API-Key: xxx
Content-Type: application/json
```

**Body:**
```json
{
  "input": {
    "type": "image | url",
    "data": "base64_image_data | https://example.com"
  },
  "format": "html_tailwind",
  "instructions": "Optional user instructions"
}
```

**Validation:**
- `input.type`: required, one of `["image", "url"]`
- `input.data`: required
  - if `type=image`: base64 encoded image (PNG/JPEG/WEBP)
  - if `type=url`: valid http/https URL
- `format`: required, one of `["html_tailwind", "html_css", "react_tailwind", "vue_tailwind"]`
- `instructions`: optional, string, max 500 chars

**Response:** `201 Created`
```json
{
  "generation_id": "gen_abc123def456",
  "status": "processing",
  "credits_charged": 2,
  "stream_url": "ws://api.example.com/api/stream/gen_abc123def456"
}
```

**stream_url Configuration:**

The `stream_url` is generated dynamically based on your setup:

1. **Production (Behind reverse proxy):**
   - Set environment variable: `API_PUBLIC_BASE_URL=https://api.example.com`
   - Response will use: `wss://api.example.com/api/stream/{id}` (WebSocket Secure)
   - Example: `export API_PUBLIC_BASE_URL=https://api.example.com`

2. **Development (Local):**
   - No environment variable needed
   - API detects scheme from request: `http://localhost:7001` → `ws://localhost:7001/api/stream/{id}`
   - If HTTPS: `https://localhost:7001` → `wss://localhost:7001/api/stream/{id}`

3. **Behind Nginx/Apache reverse proxy:**
   ```bash
   export API_PUBLIC_BASE_URL=https://yourdomain.com
   # Backend can be on http://localhost:7001 internally
   # But clients will connect to wss://yourdomain.com/api/stream/{id}
   ```

**Security Note:**
- In production, always use `wss://` (WebSocket Secure with TLS)
- Never use `ws://` (unencrypted) with API keys on untrusted networks
- Set `API_PUBLIC_BASE_URL` to HTTPS URL for automatic `wss://` conversion

**Errors:**
- `400 Bad Request` - invalid input
  ```json
  {
    "error": "invalid_input",
    "message": "field 'format' must be one of [...]"
  }
  ```
- `402 Payment Required` - insufficient credits
  ```json
  {
    "error": "insufficient_credits",
    "message": "Required: 2, Available: 0"
  }
  ```
- `429 Too Many Requests` - rate limit exceeded
  ```json
  {
    "error": "rate_limit",
    "message": "Max 10 concurrent generations"
  }
  ```

---

### 4. WS /api/stream/{generation_id}

WebSocket stream for real-time generation updates.

**Connection:**
```
ws://api.example.com/api/stream/gen_abc123def456?api_key=xxx
```

**⚠️ SECURITY REQUIREMENTS:**

1. **HTTPS/WSS Mandatory in Production**
   - API key is passed in query parameter (visible in logs, browser history, proxies)
   - **MUST use `wss://` (WebSocket Secure)** instead of `ws://` in production
   - HTTP + Query parameter = **UNENCRYPTED API KEY** (security breach)
   - Set `API_PUBLIC_BASE_URL` to HTTPS URL to get `wss://` URLs

2. **Authentication**
   - Requires `api_key` query parameter
   - Invalid/missing key: connection closes with reason "Invalid API key" or "API key required"
   - Returns WebSocket close code 1008 (Policy Violation)

3. **Best Practices**
   - Never use `ws://` with API keys on untrusted networks
   - Rotate API keys regularly
   - Use different keys for different applications
   - Monitor usage in admin panel

**Server → Client Messages:**

All WebSocket messages use snake_case for field names.

1. **Status Update** (initial message when client connects)
```json
{
  "type": "status",
  "message": "Analyzing screenshot...",
  "variant_index": 0
}
```

2. **Code Chunk** (streamed as generation progresses)
```json
{
  "type": "chunk",
  "data": "<div>...",
  "variant_index": 0
}
```

3. **Variant Complete** (sent when all chunks for a variant are done)
```json
{
  "type": "variant_complete",
  "variant_index": 0
}
```

4. **Error** (sent if generation fails)
```json
{
  "type": "error",
  "error": "generation_failed",
  "message": "Model rate limit exceeded",
  "variant_index": 0
}
```

**Error types:**
- `generation_failed` - LLM API error
- `generation_timeout` - exceeded 10 minute timeout
- `generation_not_found` - generation ID not found
- `internal_error` - unexpected server error

**Note:** No separate "complete" message is sent. Connection closes after `variant_complete`.

**Client → Server:** (none, read-only stream)

**Connection closes after:**
- Generation completes (success or error)
- 10 minutes timeout
- Client disconnect

---

### 5. GET /api/generations/{id}

Get generation result and metadata.

**Request:**
```http
GET /api/generations/gen_abc123def456
X-API-Key: xxx
```

**Response:** `200 OK`
```json
{
  "id": "gen_abc123def456",
  "status": "completed | processing | failed",
  "format": "html_tailwind",
  "created_at": "2024-12-24T10:30:00Z",
  "completed_at": "2024-12-24T10:30:15Z",
  "input": {
    "type": "image",
    "preview": "base64_thumbnail"
  },
  "result": {
    "code": "<html>...</html>",
    "preview_url": null
  },
  "error": null,
  "credits_charged": 1
}
```

**Status values:**
- `processing` - generation in progress
- `completed` - success, result available
- `failed` - error occurred, see `error` field

**Errors:**
- `404 Not Found` - generation not found or not owned by this API key
  ```json
  {
    "error": "not_found",
    "message": "Generation not found"
  }
  ```

---

### 6. GET /api/limits

Get current API key usage and limits.

**Request:**
```http
GET /api/limits
X-API-Key: xxx
```

**Response:** `200 OK`
```json
{
  "credits": {
    "available": 1000,
    "total": 1000,
    "used": 0
  },
  "rate_limits": {
    "concurrent_generations": {
      "limit": 10,
      "current": 2
    },
    "generations_per_hour": {
      "limit": 100,
      "current": 5,
      "reset_at": "2024-12-24T11:00:00Z"
    }
  },
  "tier": "pro"
}
```

---

## Credits Deduction Logic

**When credits are charged:**
- **Immediately** on `POST /api/generate` success (before generation starts)
- If generation fails after start → credits are NOT refunded
- If request is rejected (400/429) → credits are NOT charged

**Amount charged:**
- `html_tailwind`: 1 credit
- `html_css`: 1 credit
- `react_tailwind`: 2 credits
- `vue_tailwind`: 2 credits

**Why no refunds:**
- Model API calls are made immediately
- Costs are incurred even if generation fails
- Simple accounting, no edge cases

---

## Error Codes Summary

| Code | Error | Description |
|------|-------|-------------|
| 400 | `invalid_input` | Validation failed |
| 401 | `unauthorized` | Missing/invalid API key |
| 402 | `insufficient_credits` | Not enough credits |
| 403 | `forbidden` | Valid key, access denied |
| 404 | `not_found` | Resource not found |
| 429 | `rate_limit` | Too many requests |
| 500 | `internal_error` | Server error |

---

## Rate Limits

Per API key:
- **Concurrent generations:** 10
- **Generations per hour:** 100
- **Max image size:** 10MB
- **Request timeout:** 60s (HTTP), 600s (WebSocket)

---

## Notes

- All timestamps are ISO 8601 UTC
- All IDs use prefix format: `gen_`, `key_`, etc.
- Base64 images must include data URI prefix: `data:image/png;base64,...`
- WebSocket reconnection not supported - use polling if connection drops
- Generation results stored for 30 days
