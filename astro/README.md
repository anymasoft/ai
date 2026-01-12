# 🎬 Beem - MiniMax Video SaaS Platform

**Полнофункциональная платформа для генерации видеороликов с использованием MiniMax AI Video API.**

- **Адрес:** `/home/user/ai/astro`
- **Язык:** TypeScript + Astro 5.1.3
- **Стиль:** Tailwind CSS
- **База данных:** SQLite (better-sqlite3)
- **Аутентификация:** Session-based (OAuth 2.0)
- **Платежи:** YooKassa
- **Уведомления:** Telegram Bot

---

## 📋 Содержание

1. [Архитектура](#архитектура)
2. [Функциональность](#функциональность)
3. [Компоненты](#компоненты)
4. [Pipeline Видео](#pipeline-видео)
5. [Системы Уведомлений](#системы-уведомлений)
6. [Типы Ошибок](#типы-ошибок)
7. [Конфигурация](#конфигурация)
8. [API Endpoints](#api-endpoints)
9. [Database Schema](#database-schema)
10. [Deployment](#deployment)

---

## 🏗️ Архитектура

### Высокоуровневая архитектура

```
┌─────────────────────────────────────────────────────────┐
│                    BEEM PLATFORM                        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │          Frontend (Astro SSR)                    │  │
│  │  - Image Upload                                  │  │
│  │  - Mode Selector (Template/Prompt)              │  │
│  │  - Generation Controls                          │  │
│  │  - Video Player                                 │  │
│  └──────────────────────────────────────────────────┘  │
│                        ↓                                 │
│  ┌──────────────────────────────────────────────────┐  │
│  │       Backend API (Astro API Routes)            │  │
│  │  - /api/upload-image                            │  │
│  │  - /api/generate                                │  │
│  │  - /api/status                                  │  │
│  │  - /api/payments/*                              │  │
│  │  - /minimax_callback (webhook)                  │  │
│  └──────────────────────────────────────────────────┘  │
│                        ↓                                 │
│  ┌──────────────────────────────────────────────────┐  │
│  │      Core Processing Layers                      │  │
│  │                                                  │  │
│  │  ФАЗА 1: Smart Prompt Enhancer (GPT-4o-mini)   │  │
│  │  ├─ Cinematic Expansion                        │  │
│  │  └─ Mode-aware enhancement                     │  │
│  │                                                  │  │
│  │  ФАЗА 2: Camera Prompt Compiler (GPT)          │  │
│  │  ├─ Camera command injection                    │  │
│  │  └─ Validation & sanitization                  │  │
│  │                                                  │  │
│  │  Template Router (GPT-4o-mini)                 │  │
│  │  └─ Template selection (Template Mode only)    │  │
│  └──────────────────────────────────────────────────┘  │
│                        ↓                                 │
│  ┌──────────────────────────────────────────────────┐  │
│  │      Queue Processing                            │  │
│  │  - Concurrency control (1 at a time)            │  │
│  │  - MiniMax API calls                            │  │
│  │  - Video download                               │  │
│  │  - Database updates                             │  │
│  └──────────────────────────────────────────────────┘  │
│                        ↓                                 │
│  ┌──────────────────────────────────────────────────┐  │
│  │      External Services                           │  │
│  │  - MiniMax Video API                            │  │
│  │  - OpenAI GPT-4o-mini                           │  │
│  │  - YooKassa Payments                            │  │
│  │  - Telegram Notifications                       │  │
│  │  - SQLite Database                              │  │
│  └──────────────────────────────────────────────────┘  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Слои системы

| Слой | Компоненты | Язык | Фреймворк |
|------|-----------|------|-----------|
| **Presentation** | app.astro, billing.astro | TypeScript/HTML | Astro SSR |
| **API** | /api/generate, /api/upload, /api/payments | TypeScript | Astro Routes |
| **Business Logic** | promptEnhancer, cameraPromptCompiler, templateRouter | TypeScript | Node.js |
| **Data Access** | db.ts, chargeGeneration.ts | TypeScript | better-sqlite3 |
| **External** | MiniMax, OpenAI, YooKassa, Telegram | - | REST APIs |

---

## 🎯 Функциональность

### Основные возможности

#### 1. **Двухрежимная генерация видео**

**Режим 1: Рекламный Шаблон (Template Mode)**
- ✅ AI автоматически выбирает оптимальный MiniMax Video Agent Template
- ✅ 17 предустановленных шаблонов с разными анимациями
- ✅ Минимальный ввод от пользователя
- ✅ Гарантированное качество (шаблоны протестированы)

**Режим 2: Свободный Сценарий (Prompt Mode)**
- ✅ Полный контроль над сценой и камерой
- ✅ Двухфазная обработка промптов
- ✅ Явные camera commands для MiniMax
- ✅ Кинематографическое описание

#### 2. **Двухфазный Prompt Engine**

**ФАЗА 1: Smart Prompt Enhancer**
```
User Input (RU) → GPT-4o-mini → Cinematic Expansion (EN)
```
- Перевод на английский
- Добавление кинематографических деталей
- Режимо-специфичная обработка
- max_tokens: 300 (template) / 500 (prompt)

**ФАЗА 2: Camera Prompt Compiler (только Prompt Mode)**
```
Cinematic Prompt → GPT-4o-mini → Director Prompt with Commands
```
- Инъекция camera commands
- Валидация команд (только 15 валидных)
- Санитайзация (удаление невалидных команд)
- max_tokens: 600

#### 3. **Система оплаты**

- 💳 YooKassa интеграция
- 💰 3 тарифа: Разовая покупка, Basic (50 кр), Professional (200 кр)
- 🎁 Пробный план: 3 кредита при регистрации
- 📊 Balance tracking
- 💸 Списание кредитов после успешной генерации

#### 4. **Управление генерациями**

- 📝 Upload image (любой формат, max 10MB)
- ⏱️ Duration: 6 сек или 10 сек
- 🎬 Queue processing (concurrency=1)
- 📊 Status tracking
- ⬇️ Video download
- 💾 Local storage per user

---

## 🧩 Компоненты

### Фронтенд

```
src/pages/
├── app.astro                 # Основная страница генерации
│   ├── Mode Selector        # Выбор режима (Template/Prompt)
│   ├── Image Upload         # Загрузка фото
│   ├── Prompt Input         # Ввод текста
│   ├── Duration Control     # 6 или 10 сек
│   ├── Video Player         # Плеер с результатом
│   └── UI Controls          # Кнопки, состояния
├── billing.astro            # Страница покупок
├── admin.astro              # Admin панель
└── layouts/AppLayout.astro  # Главный layout
```

### Backend

```
src/pages/api/
├── generate.ts              # POST /api/generate (основной endpoint)
├── status.ts                # GET /api/status
├── upload-image.ts          # POST /api/upload-image
├── video/current.ts         # GET /api/video/current
├── payments/                # Платежи YooKassa
│   └── yookassa/
│       ├── create.ts        # Создание платежа
│       └── check.ts         # Проверка статуса
└── /minimax_callback.ts     # POST /minimax_callback (webhook MiniMax)
```

### Обработка

```
src/lib/
├── promptEnhancer.ts                # ФАЗА 1: Smart Prompt Enhancer
├── cameraPromptCompiler.ts          # ФАЗА 2: Camera Compiler
├── telegramNotifier.ts              # Telegram notifications
├── minimax/
│   ├── callMinimaxAPI.ts            # REST запросы к MiniMax
│   ├── processor.ts                 # Queue processing
│   ├── templateRouter.ts            # Template selection
│   ├── downloadVideoFromMinimax.ts  # Download handler
│   ├── storage.ts                   # File storage
│   └── queue.ts                     # Queue management
├── billing/
│   ├── chargeGeneration.ts          # Credit charging
│   └── applyPayment.ts              # Payment application
└── db.ts                            # Database initialization
```

### Типы & Interfaces

```
src/lib/
├── auth.ts                  # Session management, OAuth
├── pricing.ts               # Тарифы и формирование цен
└── payments.ts              # Payment utilities
```

---

## 🎥 Pipeline Видео

### Поток данных при генерации

```
1. ПОЛЬЗОВАТЕЛЬ НАЖИМАЕТ "GENERATE"
   ├─ Image uploaded ✓
   ├─ Prompt entered ✓
   ├─ Duration selected ✓
   └─ Mode selected (template/prompt) ✓
                      ↓
2. FRONTEND ОТПРАВЛЯЕТ /api/generate
   {
     "prompt": "Девушка идёт вперёд...",
     "duration": 6,
     "mode": "prompt"
   }
                      ↓
3. BACKEND: ВАЛИДАЦИЯ & АУТЕНТИФИКАЦИЯ
   ├─ User session check
   ├─ Image exists
   ├─ Balance check (>= cost)
   └─ Prompt validation (3-2000 chars)
                      ↓
4. ФАЗА 1: SMART PROMPT ENHANCER
   ├─ Mode selection
   ├─ GPT call (10 sec timeout)
   ├─ Fallback if failed
   └─ Result: prompt_cinematic
                      ↓
5. ФАЗА 2: CAMERA COMPILER (если mode === "prompt")
   ├─ GPT call (12 sec timeout)
   ├─ Camera command validation
   ├─ Sanitization (удаление невалидных)
   ├─ Fallback if failed
   └─ Result: prompt_director
                      ↓
6. TEMPLATE SELECTION (если mode === "template")
   ├─ GPT call (15 sec timeout)
   ├─ Template ID selection
   ├─ Text inputs mapping
   └─ Result: templateData
                      ↓
7. СОЗДАНИЕ ЗАПОМИНАНИЯ В БД
   ├─ INSERT into generations table
   ├─ Сохранение всех промптов (original, cinematic, director)
   ├─ Status: "queued"
   └─ Result: generationId
                      ↓
8. ДОБАВЛЕНИЕ В ОЧЕРЕДЬ
   ├─ enqueueGeneration(generationId)
   ├─ processQueue() started async
   └─ Return to client: generationId, status
                      ↓
9. ОЧЕРЕДЬ ОБРАБОТКИ (асинхронная, 1 task в раз)
   ├─ CALL MINIMAX API
   │  ├─ Подготовка payload
   │  ├─ Выбор правильного промпта (director для prompt mode)
   │  ├─ Image + prompt + duration
   │  └─ Result: task_id
   │
   ├─ STATUS: "processing"
   └─ Ожидание webhook от MiniMax
                      ↓
10. WEBHOOK CALLBACK (/minimax_callback)
    ├─ MiniMax отправляет status + file_id
    │
    ├─ Если status === "success"
    │  ├─ Download video from MiniMax
    │  ├─ Save to local storage
    │  ├─ Update generation record
    │  ├─ STATUS: "success"
    │  └─ Charge credits from user
    │
    ├─ Если status === "failed"
    │  ├─ STATUS: "failed"
    │  ├─ Notify admin (Telegram)
    │  └─ No credit charge
    │
    └─ Response to MiniMax: { ok: true }
                      ↓
11. ФРОНТЕНД: POLLING STATUS
    ├─ GET /api/status?generationId=xxx
    ├─ Polling every 1 sec (60 times = 60 sec max)
    ├─ On success: download video
    └─ Update UI with result
```

### Обработка ошибок в pipeline

```
┌─────────────────────────────────────────────────────────┐
│ На каждом этапе:                                        │
│                                                          │
│ 1. TRY-CATCH блок                                       │
│ 2. Логирование ошибки                                   │
│ 3. Telegram уведомление (если critical)                │
│ 4. Graceful fallback или failure                        │
│ 5. Status update в БД                                   │
└─────────────────────────────────────────────────────────┘
```

---

## 📲 Системы Уведомлений

### Telegram Notifications System

**Назначение:** Мгновенные оповещения об ошибках администратору

**Конфигурация:**
```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=432400514
```

**Формат сообщения:**
```
⚠️ Beem Error
Stage: {STAGE}
User: {userId}
Generation: {generationId}
Error: {errorMessage}
```

### Типы Оповещений

#### Ошибки GPT

| Stage | Описание | Причины |
|-------|---------|---------|
| `GPT_ENHANCE_TEMPLATE` | Ошибка Smart Prompt Enhancer (template) | Timeout, API error, rate limit |
| `GPT_ENHANCE_PROMPT` | Ошибка Smart Prompt Enhancer (prompt) | Network error, invalid response |
| `GPT_CAMERA_COMPILER` | Ошибка Camera Prompt Compiler | JSON parsing, timeout, API down |
| `TEMPLATE_ROUTER` | Ошибка Template Router | Invalid JSON, API error, timeout |

#### Ошибки MiniMax API

| Stage | Описание | Причины |
|-------|---------|---------|
| `MINIMAX_CALL` | Ошибка при отправке запроса | HTTP error, No task_id, API down |
| `MINIMAX_CALLBACK` | Ошибка обработки webhook | Task not found, critical exception |
| `VIDEO_DOWNLOAD` | Ошибка скачивания видео | File not found, network error |
| `MINIMAX_GENERATION` | Ошибка генерации видео на MiniMax | Invalid image, timeout, model error |

#### Ошибки Системы

| Stage | Описание | Причины |
|-------|---------|---------|
| `QUEUE_PROCESSOR` | Ошибка обработки очереди | Exception during processing, fatal error |
| `STUCK_GENERATION` | Задача зависла (> 10 минут) | Timeout, network issue, MiniMax delay |

### Защита от Спама

**De-duplication Cache:**
- Максимум 1 сообщение в минуту для одной ошибки
- In-memory кеш (не требует БД)
- Ключ: `${stage}::${errorMessage}`

**Пример:**
```
[TG ALERT] Cooldown active for GPT_ENHANCE_PROMPT, skipping duplicate alert
```

### Примеры Реальных Сообщений

**Пример 1: GPT Timeout**
```
⚠️ Beem Error
Stage: GPT_ENHANCE_PROMPT
User: 105580068296651888951
Generation: gen_1737014400000_abc123
Error: timeout
```

**Пример 2: MiniMax API Error**
```
⚠️ Beem Error
Stage: MINIMAX_CALL
User: 105580068296651888951
Generation: gen_1737014400000_def456
Error: API error: Rate limit exceeded (HTTP 429)
```

**Пример 3: Stuck Generation**
```
⚠️ Beem Error
Stage: STUCK_GENERATION
User: 105580068296651888951
Generation: gen_1737014400000_ghi789
Error: Generation stuck in processing status for 15 minutes
```

**Пример 4: Video Download Error**
```
⚠️ Beem Error
Stage: VIDEO_DOWNLOAD
User: 105580068296651888951
Generation: gen_1737014400000_jkl012
Error: File not found on MiniMax servers
```

---

## ❌ Типы Ошибок

### Классификация Ошибок

#### 1. Validation Errors (400)

```typescript
// Prompt validation
- Prompt too short (< 3 chars)
- Prompt too long (> 2000 chars)
- No image uploaded
- Invalid duration (not 6 or 10)
- Invalid mode (not template or prompt)
```

#### 2. Authentication Errors (401/403)

```typescript
// Session & Auth
- No session token
- Invalid session
- User mismatch (payment owner)
- Unauthorized access
```

#### 3. Balance Errors (402)

```typescript
// Payment & Credits
- Insufficient balance
  - Required: {cost} credits
  - Current: {current} credits
```

#### 4. GPT Processing Errors

```typescript
// Smart Prompt Enhancer & Camera Compiler
- API timeout (10-12 sec)
- API rate limit exceeded
- Invalid API response
- JSON parsing error
- OpenAI API down
- Network connectivity issue
```

#### 5. Template Router Errors

```typescript
// Template selection
- API timeout (15 sec)
- Invalid template ID response
- Missing required fields
- JSON parsing error
```

#### 6. MiniMax API Errors

```typescript
// Video generation
- HTTP errors (408, 429, 500, etc)
- No task_id in response
- Invalid image format
- API rate limit
- Server error
- Request timeout
```

#### 7. Queue & Processing Errors

```typescript
// Queue handling
- Generation not found
- Image file missing
- Database error
- File system error
- Exception during processing
```

#### 8. Webhook Errors

```typescript
// Callback handling
- Task ID not found in DB
- Invalid callback payload
- Missing file_id
- Video download failed
- File processing error
```

#### 9. System Errors

```typescript
// Infrastructure
- Database connection error
- Storage directory not writable
- Out of memory
- Stuck generation (> 10 min)
```

### Error Recovery Strategy

```
┌─────────────────────────────────────┐
│ Error Occurrence                    │
└────────────┬────────────────────────┘
             │
     ┌───────▼──────────┐
     │ Is it retryable? │
     └───────┬──────────┘
             │
    ┌────────┴────────┐
    │YES           NO │
    │                │
    ▼                ▼
  RETRY        FAIL + NOTIFY
  (with        (Log + TG Alert)
   timeout)    (Update status)
    │                │
    │                │
    └────────┬───────┘
             │
      ┌──────▼──────────┐
      │ Charge credits? │
      └───────┬─────────┘
              │
    ┌─────────┴────────┐
    │   NO          YES│
    │                │
    │                ▼
    │        If success:
    │        Charge credits
    │                │
    └────────┬───────┘
             │
      ┌──────▼────────┐
      │ Return result │
      │ to client     │
      └───────────────┘
```

---

## ⚙️ Конфигурация

### Environment Variables

```bash
# === OPENAI ===
OPENAI_API_KEY=sk-proj-xxxxx          # Required for GPT prompting

# === MINIMAX ===
MINIMAX_API_KEY=your_key_here         # Required for video generation
MINIMAX_CALLBACK_URL=https://yourdomain.com/minimax_callback  # For webhooks

# === YOOKASSA (Payments) ===
YOOKASSA_SHOP_ID=xxxxx                # YooKassa merchant ID
YOOKASSA_API_KEY=your_key_here        # YooKassa API key

# === TELEGRAM (Notifications) ===
TELEGRAM_BOT_TOKEN=your_bot_token     # Telegram bot token
TELEGRAM_CHAT_ID=432400514            # Admin chat ID

# === SESSION ===
SESSION_SECRET=your_random_secret_here  # Session encryption key

# === DATABASE ===
DATABASE_URL=./beem.db                # SQLite database path

# === AUTH (OAuth) ===
OAUTH_CLIENT_ID=xxxxx                 # OAuth client ID
OAUTH_CLIENT_SECRET=xxxxx             # OAuth client secret
OAUTH_REDIRECT_URI=http://localhost:3000/auth/callback
```

### Database Setup

```bash
# Database инициализируется автоматически при первом запуске
# Создаются таблицы:
# - users
# - sessions
# - generations
# - payments
# - admin_subscriptions
```

---

## 🔌 API Endpoints

### Authentication

| Method | Endpoint | Описание |
|--------|----------|---------|
| `POST` | `/auth/login` | OAuth login redirect |
| `POST` | `/auth/callback` | OAuth callback handler |
| `POST` | `/auth/logout` | Logout |

### Image Management

| Method | Endpoint | Описание |
|--------|----------|---------|
| `POST` | `/api/upload-image` | Upload user image (10MB max) |
| `GET` | `/api/video/current` | Download latest generated video |

### Generation

| Method | Endpoint | Описание |
|--------|----------|---------|
| `POST` | `/api/generate` | Create video generation task |
| `GET` | `/api/status?generationId=xxx` | Get generation status |

### Payments

| Method | Endpoint | Описание |
|--------|----------|---------|
| `POST` | `/api/payments/yookassa/create` | Create payment order |
| `GET` | `/api/payments/yookassa/check` | Check payment status |

### Webhooks

| Method | Endpoint | Описание |
|--------|----------|---------|
| `POST` | `/minimax_callback` | MiniMax webhook (video ready) |

### Request/Response Examples

**POST /api/generate**
```json
// Request
{
  "prompt": "Девушка идёт вперёд, камера приближается",
  "duration": 6,
  "mode": "prompt"
}

// Response
{
  "success": true,
  "generationId": "gen_1737014400000_abc123def",
  "mode": "prompt",
  "cost": 1,
  "balanceBefore": 10,
  "balanceAfter": 9,
  "status": "queued",
  "queueSize": 1
}
```

**GET /api/status?generationId=gen_1737014400000_abc123def**
```json
// Response
{
  "id": "gen_1737014400000_abc123def",
  "status": "success",
  "videoUrl": "/api/video/current?t=1737014500000",
  "duration": 6,
  "createdAt": 1737014400
}
```

---

## 📊 Database Schema

### Users Table

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  image TEXT,
  plan TEXT DEFAULT 'free',
  role TEXT DEFAULT 'user',
  disabled INTEGER DEFAULT 0,
  generation_balance INTEGER DEFAULT 0,
  generation_used INTEGER DEFAULT 0,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);
```

### Sessions Table

```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expiresAt INTEGER NOT NULL,
  createdAt INTEGER NOT NULL,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);
```

### Generations Table

```sql
CREATE TABLE generations (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  status TEXT DEFAULT 'processing',
  duration INTEGER NOT NULL,
  cost INTEGER NOT NULL,
  charged INTEGER DEFAULT 0,

  -- Prompts (all stages saved)
  prompt TEXT,                     -- Original user prompt
  prompt_final TEXT,              -- Enhanced (template/cinematic)
  prompt_cinematic TEXT,          -- ФАЗА 1 result (prompt mode)
  prompt_director TEXT,           -- ФАЗА 2 result with camera commands

  -- Template data (template mode only)
  minimax_template_id TEXT,
  minimax_template_name TEXT,
  minimax_template_inputs TEXT,   -- JSON
  minimax_final_prompt TEXT,

  -- MiniMax tracking
  minimax_job_id TEXT,
  minimax_status TEXT DEFAULT 'pending',
  video_url TEXT,

  -- Mode & metadata
  generation_mode TEXT DEFAULT 'template',
  createdAt INTEGER NOT NULL,
  completedAt INTEGER,

  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);
```

### Payments Table

```sql
CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  externalPaymentId TEXT UNIQUE NOT NULL,
  amount REAL NOT NULL,
  credits INTEGER DEFAULT 0,
  currency TEXT DEFAULT 'RUB',
  status TEXT DEFAULT 'pending',
  provider TEXT DEFAULT 'yookassa',
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,

  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);
```

### Admin Subscriptions Table

```sql
CREATE TABLE admin_subscriptions (
  userId TEXT PRIMARY KEY,
  plan TEXT DEFAULT 'free',
  isPaid INTEGER DEFAULT 0,
  expiresAt INTEGER,
  provider TEXT DEFAULT 'manual',
  updatedAt INTEGER,

  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);
```

---

## 🚀 Deployment

### Prerequisites

- Node.js 18+ (LTS)
- npm or yarn
- SQLite 3
- Environment variables configured

### Local Development

```bash
# 1. Install dependencies
cd /home/user/ai/astro
npm install

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local with your API keys

# 3. Run development server
npm run dev
# Server at http://localhost:3000

# 4. Check logs
tail -f /var/log/beem/app.log  # if using systemd
```

### Production Build

```bash
# 1. Build project
npm run build

# 2. Verify build
ls -la dist/

# 3. Start production server
npm run start
# or with systemd/pm2:
pm2 start dist/server/entry.mjs --name "beem"
```

### Docker Deployment

```dockerfile
# Dockerfile example
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .
RUN npm run build

ENV NODE_ENV=production

CMD ["npm", "run", "start"]
```

### Systemd Service

```ini
# /etc/systemd/system/beem.service
[Unit]
Description=Beem Video Generation Service
After=network.target

[Service]
Type=simple
User=beem
WorkingDirectory=/home/user/ai/astro
Environment="NODE_ENV=production"
EnvironmentFile=/home/user/ai/astro/.env.production
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### Monitoring & Logging

```bash
# View logs
journalctl -u beem.service -f

# Check service status
systemctl status beem

# View database
sqlite3 ./beem.db ".tables"
sqlite3 ./beem.db "SELECT COUNT(*) FROM generations;"
```

---

## 📈 Performance Metrics

### Timeouts & Limits

| Компонент | Timeout | Max Retries |
|-----------|---------|-------------|
| Smart Prompt Enhancer | 10 sec | 1 (fallback) |
| Camera Compiler | 12 sec | 1 (fallback) |
| Template Router | 15 sec | 1 (fallback) |
| Queue Processing | N/A | 1 attempt |
| Stuck Generation Check | 10 min | Auto-fail |

### Concurrency

| Параметр | Значение |
|----------|----------|
| Queue Workers | 1 (sequential) |
| Max Users | Unlimited |
| Max Generations per User | Unlimited |
| Max Video Size | 500MB (MiniMax limit) |

### Database Performance

```sql
-- Indexes for optimization
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_generations_userId ON generations(userId);
CREATE INDEX idx_generations_status ON generations(status);
CREATE INDEX idx_payments_userId ON payments(userId);
```

---

## 🔐 Security

### Input Validation

```typescript
// Prompt validation
- Length: 3-2000 characters
- Type: non-empty string
- Sanitization: no code injection

// Image validation
- Format: jpg, png, webp
- Size: max 10MB
- Dimensions: 512x512 to 1024x1024
```

### Session Security

```typescript
// Session management
- Token: random 32-byte string
- Expiry: 7 days
- HttpOnly: true
- Secure: true (production)
- SameSite: Lax
```

### API Security

```typescript
// Rate limiting (per user)
- /api/generate: 10 req/minute
- /api/upload-image: 5 req/minute
- /api/payments: 5 req/minute

// CORS
- Allowed origins: configured in .env
- Credentials: included

// HTTPS
- Required in production
- Redirect HTTP → HTTPS
```

---

## 🐛 Troubleshooting

### Common Issues

| Проблема | Решение |
|----------|---------|
| "No task_id in response" | Проверьте MINIMAX_API_KEY, Rate limit |
| "Generation stuck" | Перезагрузите сервис, проверьте MiniMax API |
| "Insufficient balance" | Пользователь должен пополнить баланс |
| "Prompt too long" | Max 2000 characters |
| "Image too large" | Max 10MB |
| "Timeout" | Увеличьте timeout в конфигурации |

### Debug Commands

```bash
# Check database
sqlite3 beem.db "SELECT * FROM generations LIMIT 5;"

# Check recent errors
grep "\[ERROR\]" /var/log/beem/app.log | tail -20

# Test MiniMax API
curl -X POST https://api.minimax.io/v1/video_generation \
  -H "Authorization: Bearer YOUR_KEY" \
  -d "{...}"

# Test OpenAI API
curl https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer YOUR_KEY" \
  -d "{...}"
```

---

## 📚 Документация

| Документ | Описание |
|----------|---------|
| `README_MINIMAX.md` | MiniMax API интеграция |
| `MINIMAX_SETUP.md` | Настройка MiniMax |
| `PAYMENT_ARCHITECTURE.md` | Архитектура платежей |
| `PRODUCTION_DEPLOYMENT.md` | Production deployment |
| `QUICK_DIAGNOSTIC_GUIDE.md` | Диагностика проблем |

---

## 📝 Recent Changes

### Latest Commits

| Commit | Описание |
|--------|---------|
| 666ac6b | feat: добавить систему Telegram уведомлений об ошибках |
| e23b4f0 | feat: добавить валидацию camera commands |
| 0dd5a7d | feat: реализовать двухфазную систему Prompt Engine |
| c642f22 | fix: удалить карточку пробного плана со страницы /billing |
| 970f1f0 | fix: отключить [CHECK] логи при проверке статуса платежа |

---

## 📞 Support

### Getting Help

- 📧 Email: support@beem.app
- 💬 Telegram: @beem_support
- 🐛 Issues: GitHub Issues
- 📖 Wiki: Project Documentation

---

## 📄 License

All rights reserved © 2024 Beem Video SaaS Platform

---

**Last Updated:** January 12, 2025
**Version:** 2.0 (Full audit with Telegram notifications)
**Status:** Production Ready ✅
