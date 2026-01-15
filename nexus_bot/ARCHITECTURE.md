# 🎬 Beem Video Engine - Архитектура

Полностью независимый видео-генератор, встроенный в Telegram-бот.

## 🏗️ Полный пайплайн

```
┌─────────────────────────────────────────────────────┐
│              TELEGRAM USER INTERACTION              │
└──────────────────┬──────────────────────────────────┘
                   │
        ┌──────────▼──────────┐
        │  /start command     │
        │  or photo upload    │
        └──────────┬──────────┘
                   │
        ┌──────────▼─────────────────────┐
        │   Telegram UI (aiogram FSM)    │
        │  - Collect photo               │
        │  - Collect text prompt         │
        │  - Confirm generation          │
        └──────────┬─────────────────────┘
                   │
        ┌──────────▼──────────────────────────────────┐
        │       VIDEO ENGINE - PHASE 1                │
        │     Smart Prompt Enhancer                   │
        ├──────────────────────────────────────────────┤
        │ 1. Detect PRESERVE constraints               │
        │ 2. Call GPT-4o-mini for enhancement          │
        │ 3. Translate RU → EN                         │
        │ 4. Add cinematic details                     │
        │ 5. Add NO_GENERATION block (if PRESERVE)    │
        │ Result: prompt_cinematic                     │
        └──────────┬──────────────────────────────────┘
                   │
        ┌──────────▼──────────────────────────────────┐
        │       VIDEO ENGINE - PHASE 2                │
        │     Camera Director Compilation             │
        ├──────────────────────────────────────────────┤
        │ 1. Extract preservation keywords             │
        │ 2. If PRESERVE keywords found:               │
        │    → Use ONLY [Static shot]                  │
        │ 3. Else:                                     │
        │    → Call GPT-4o-mini for camera commands   │
        │ 4. Validate 15 allowed MiniMax commands     │
        │ 5. Sanitize invalid commands                │
        │ Result: prompt_director (with commands)     │
        └──────────┬──────────────────────────────────┘
                   │
        ┌──────────▼──────────────────────────────────┐
        │       VIDEO ENGINE - PHASE 3                │
        │     Queue Management                        │
        ├──────────────────────────────────────────────┤
        │ 1. Create QueueItem                          │
        │ 2. Add to queue (FIFO)                       │
        │ 3. Start async processor (concurrency=1)    │
        │ 4. Dequeue when processor available          │
        └──────────┬──────────────────────────────────┘
                   │
        ┌──────────▼──────────────────────────────────┐
        │       VIDEO ENGINE - PHASE 4                │
        │     MiniMax API Call                        │
        ├──────────────────────────────────────────────┤
        │ 1. Convert JPEG to base64                    │
        │ 2. POST /video_generation                    │
        │    - first_frame_image: base64              │
        │    - prompt: prompt_director                │
        │    - duration: 6 or 10 secs                 │
        │    - resolution: 768P                       │
        │ 3. Get generation_id from response           │
        │ Result: generation_id (MiniMax task ID)     │
        └──────────┬──────────────────────────────────┘
                   │
        ┌──────────▼──────────────────────────────────┐
        │       VIDEO ENGINE - PHASE 5                │
        │     Status Polling                          │
        ├──────────────────────────────────────────────┤
        │ 1. Loop for max 120 iterations (2 mins)     │
        │ 2. GET /video_generation?task_id=gen_id    │
        │ 3. Check status:                            │
        │    - "processing" → continue polling        │
        │    - "done" → go to Phase 6                 │
        │    - "failed" → error handling              │
        │ 4. Update progress every iteration          │
        │ Result: video_url (download URL)            │
        └──────────┬──────────────────────────────────┘
                   │
        ┌──────────▼──────────────────────────────────┐
        │       VIDEO ENGINE - PHASE 6                │
        │     Video Download                          │
        ├──────────────────────────────────────────────┤
        │ 1. Download video from video_url            │
        │ 2. Save to /tmp/beem-videos/                 │
        │ 3. Store file path in status                 │
        │ Result: video_path (local file)             │
        └──────────┬──────────────────────────────────┘
                   │
        ┌──────────▼──────────────────────────────────┐
        │     Telegram Bot - Send Result              │
        ├──────────────────────────────────────────────┤
        │ 1. Retrieve video_path from engine          │
        │ 2. Send as Telegram video                    │
        │ 3. Offer to create another video            │
        │ 4. Cleanup temp files                        │
        └──────────┬──────────────────────────────────┘
                   │
            ┌──────▼─────┐
            │    DONE    │
            └────────────┘
```

## 📊 Component Relationships

```
main.py (FastAPI entry point)
  ├─ Starts bot.py in background
  └─ Starts video_engine in background
         │
         ├─ bot.py (Telegram UI)
         │   └─ Calls video_engine.generate_video()
         │       ├─ Prompts for photo
         │       ├─ Prompts for text
         │       └─ Triggers video_engine
         │
         └─ core/video_engine.py (Orchestrator)
             ├─ core/prompts.py
             │   └─ Uses openai.ChatCompletion (GPT-4o-mini)
             │
             ├─ core/director.py
             │   └─ Uses openai.ChatCompletion (GPT-4o-mini)
             │
             ├─ core/minimax.py
             │   └─ Uses aiohttp for MiniMax API
             │
             ├─ core/queue.py
             │   └─ Manages FIFO queue with asyncio.Lock
             │
             └─ Lifecycle:
                 generate_video() → enqueue → dequeue → process → poll
```

## 🔄 Data Flow

### Input
```
user_id: int          # Telegram user ID
photo_path: str       # Local JPEG file path
prompt_text: str      # Russian text from user (max 2000 chars)
duration: int         # 6 or 10 seconds
```

### Phase 1 Output (Smart Prompt Enhancer)
```
prompt_enhanced: str
Example:
"Beautiful sunset over mountains with birds singing in cinematic 4K.
Camera movement from left to right reveals valley below.
NO_GENERATION: sunset, mountains, birds"
```

### Phase 2 Output (Camera Director)
```
prompt_director: str
Example:
"Beautiful sunset over mountains with birds singing in cinematic 4K.
Camera movement from left to right reveals valley below.
NO_GENERATION: sunset, mountains, birds

[Pan left]
[Push in]"
```

### Phase 3 Output (Queue)
```
QueueItem {
  generation_id: uuid
  user_id: int
  prompt: str (prompt_director)
  photo_path: str
  duration: int
}
```

### Phase 4 Output (MiniMax Call)
```
Response:
{
  "success": true,
  "generation_id": "task_12345",
  "status": "queued",
  "cost": 0.5
}
```

### Phase 5 Output (Polling)
```
Response:
{
  "success": true,
  "generation_id": "task_12345",
  "status": "done",
  "video_url": "https://minimax.xxx/videos/output.mp4"
}
```

### Phase 6 Output (Download)
```
File: /tmp/beem-videos/{generation_id}.mp4
Size: ~50-100 MB
Duration: 6 or 10 seconds
Resolution: 768P
```

## 🔐 PRESERVE Constraints System

### Detection
```python
# In prompts.py
if "PRESERVE: sunset, mountains" in prompt:
    preserve_keywords = ["sunset", "mountains"]
    add_no_generation_block = True
```

### Storage
```python
# Database would store
{
  "prompt": "original from user",
  "prompt_enhanced": "after GPT",
  "preserve_block": "sunset, mountains",
  "preserve_keywords": ["sunset", "mountains"]
}
```

### Enforcement in Camera Director
```python
# In director.py
if any(keyword in preserve_keywords for keyword in STATIC_ONLY_KEYWORDS):
    camera_commands = "[Static shot]"  # ONLY this command
    # All other commands forbidden
```

### Result in MiniMax Call
```python
prompt_director = """
...
NO_GENERATION: sunset, mountains

[Static shot]
"""
# MiniMax honors NO_GENERATION block
# No blur/DOF on preserved elements
```

## 🎯 Queue System Details

### Concurrency Model
```
- Single processor loop
- Takes ONE item from queue at a time
- Processes fully (all 6 phases)
- Then dequeues next item

Timeline:
User1 → Gen1 queued (queue.size=1)
        Gen1 processing... (2-3 minutes)
User2 → Gen2 queued (queue.size=2)
User3 → Gen3 queued (queue.size=3)
        ...
        Gen1 done
        Gen2 starts processing
        Gen3 waits in queue
```

### Implementation
```python
# asyncio.Lock ensures thread-safe
async def process_queue():
    while True:
        item = await queue.dequeue()  # Locked
        if item:
            await _process_generation(item)  # Takes 2-3 minutes
```

## 📝 Status Tracking

```python
# Stored in memory
_generation_status = {
    "gen_uuid": {
        "status": "processing",  # queued → processing → done → failed
        "user_id": 123456,
        "prompt": "...",
        "prompt_enhanced": "...",
        "prompt_cinematic": "...",
        "minimax_generation_id": "task_xxx",
        "minimax_status": "processing",
        "video_path": "/tmp/beem-videos/gen_uuid.mp4",
        "created_at": datetime,
        "completed_at": datetime
    }
}
```

## 🛡️ Error Handling

### Level 1: Generation Initiation
```
- Invalid photo path → error response
- No OPENAI_API_KEY → skip enhancement
- No MINIMAX_API_KEY → error response
```

### Level 2: GPT Calls
```
- Timeout (10-12 sec) → use original text
- OpenAI API error → retry with exponential backoff (3 attempts)
- Rate limit → graceful degradation
```

### Level 3: MiniMax Call
```
- HTTP error → error response with message
- No generation_id → cannot continue
- Callback timeout → polling timeout after 120 sec
```

### Level 4: Download
```
- File not found → continue polling
- Download error → retry once
- Local storage full → error message
```

## 🔌 API Endpoints

### Health Check
```
GET /
GET /health
```

### Debug (development only)
```
GET /debug/state
```

## 📊 Monitoring & Logs

### Engine Logs
```
[ENGINE] generation_initiated: gen_uuid (user=123456)
[ENGINE] prompt_enhanced: gen_uuid
[ENGINE] camera_selected: gen_uuid
[ENGINE] minimax_request: gen_uuid → task_xxx
[ENGINE] minimax_done: gen_uuid
[ENGINE] Generation complete: gen_uuid
```

### Telegram Logs
```
[TG] user_start: 123456
[TG] user_uploaded_photo: 123456
[TG] user_sent_prompt: 123456
[TG] generation_started: 123456
[TG] generation_polling: 123456 (status=processing)
[TG] generation_complete: 123456
```

## 🚀 Deployment Considerations

### Environment
- Python 3.10+
- Async-compatible (uvicorn)
- /tmp directory must exist
- /tmp/beem-videos/ for video storage

### Resources
- CPU: 1+ cores (async I/O bound)
- RAM: 512 MB minimum (1 GB recommended)
- Storage: ~100 MB per video (cleanup after send)
- Network: Outbound HTTPS for OpenAI + MiniMax

### Scalability
- Single Telegram bot instance
- Multiple FastAPI workers possible (separate video engine per worker)
- Queue survives restarts if persisted to DB
- Consider Redis for distributed queue if needed

## 🔮 Future Enhancements

1. **Persistent Queue** - Database instead of in-memory
2. **User Analytics** - Track generations per user
3. **Cost Tracking** - Monitor OpenAI + MiniMax spending
4. **Prompt Templates** - Pre-built prompt starters
5. **Video Editing** - Post-processing effects
6. **Retry Logic** - Automatic requeue on failure
7. **Rate Limiting** - Per-user generation limits
8. **Payment Gateway** - Premium generation tiers
