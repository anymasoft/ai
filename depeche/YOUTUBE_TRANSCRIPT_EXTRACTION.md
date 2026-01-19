# 📝 YouTube Transcripts: Полный Пайплайн Экстракции Транскриптов

**Документация технического пайплайна получения текстов субтитров/транскриптов из YouTube видео через ScrapeCreators API**

---

## 🎯 Обзор

Система YouTube Analytics использует **ScrapeCreators API** для получения:
- Текста транскриптов видео (с временными метками)
- Субтитров (если доступны)
- Метаданных видео
- Информации о канале
- Комментариев

**Ключевая задача:** Извлечь полный текст видео для анализа, кэширования и последующей обработки.

---

## 🔑 Конфигурация ScrapeCreators API

### API Ключ и Переменные Окружения

**Переменная окружения:** `SCRAPECREATORS_API_KEY`
**Источник:** `.env` файл
**Обязательное:** ДА (проверяется при каждом вызове API)

**Проверка ключа в коде:**
```typescript
// File: src/lib/scrapecreators.ts (lines 828-850)
const apiKey = process.env.SCRAPECREATORS_API_KEY;

if (!apiKey) {
  throw new Error(
    "SCRAPECREATORS_API_KEY is not configured. " +
    "Please set it in your environment variables."
  );
}
```

### API Endpoints

**Базовый URL:** `https://api.scrapecreators.com/v1`

| Endpoint | Назначение | Параметры |
|----------|-----------|-----------|
| `/youtube/channel` | Информация о канале | `channelId` или `url` |
| `/youtube/channel-videos` | Список видео канала | `channelId` |
| `/youtube/video` | Детали видео + Транскрипт | `url` (YouTube video URL) |
| `/youtube/video/comments` | Комментарии видео | `url`, `order` (top/newest) |

### Request Headers

```typescript
const headers = {
  "x-api-key": process.env.SCRAPECREATORS_API_KEY,
  "Content-Type": "application/json"
}
```

---

## 🔄 Полный Пайплайн Экстракции Транскриптов

### ЭТАП 1: YouTube Video URL → API Call

**Функция:** `getYoutubeVideoDetails(url: string)`
**Файл:** `/home/user/ai/YouTubeAnalitycs/src/lib/scrapecreators.ts`
**Строки:** 828-958

**Входные данные:**
```typescript
const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
```

**API Call:**
```typescript
const response = await fetch(
  `https://api.scrapecreators.com/v1/youtube/video?url=${encodeURIComponent(url)}`,
  {
    method: "GET",
    headers: {
      "x-api-key": process.env.SCRAPECREATORS_API_KEY,
      "Content-Type": "application/json"
    }
  }
)
```

**Time Out:** 30 секунд (стандартный fetch timeout)

---

### ЭТАП 2: ScrapeCreators API Response

**Ответ API содержит:**

```json
{
  "videoId": "dQw4w9WgXcQ",
  "title": "Rick Astley - Never Gonna Give You Up",
  "viewCount": 1234567890,
  "likeCount": 12345678,
  "commentCount": 123456,
  "publishDate": "2009-10-25T06:57:33.000Z",
  "durationMs": 212000,
  "keywords": [
    "rick astley",
    "never gonna give you up",
    "music",
    "pop",
    "80s"
  ],
  "transcript_only_text": "[00:00] We're no strangers to love\n[00:05] You know the rules and so do I...",

  "id": "dQw4w9WgXcQ",
  "name": "Rick Astley - Never Gonna Give You Up",
  "viewCountInt": 1234567890,
  "likeCountInt": 12345678,
  "commentCountInt": 123456,
  "duration": 212000
}
```

**Ключевое поле для транскриптов:**
```
transcript_only_text: string  // Полный текст транскрипта с временными метками
```

**Формат транскрипта:**
```
[00:00] Первая строка
[00:05] Вторая строка
[00:10] Третья строка
...
```

---

### ЭТАП 3: Normalization & Data Processing

**Функция:** `getYoutubeVideoDetails()` (lines 929-951)
**Процесс:** Нормализация сырого ответа API в стандартный формат приложения

**Исходные поля → Нормализованные поля:**

```typescript
const videoDetails = {
  videoId: String(data.videoId || data.id || ""),           // videoId ← videoId/id
  title: String(data.title || data.name || "Untitled Video"), // title ← title/name
  likeCount: safeNumber(data.likeCountInt, 0),              // likeCount ← likeCountInt
  commentCount: safeNumber(data.commentCountInt, 0),        // commentCount ← commentCountInt
  viewCount: safeNumber(data.viewCountInt, 0),              // viewCount ← viewCountInt
  publishDate: validatedPublishDate,                         // publishDate (ISO 8601)
  durationMs: safeNumber(data.durationMs ?? data.duration, undefined), // duration
  keywords: Array.isArray(data.keywords) ? data.keywords : undefined, // keywords array
  transcriptText: data.transcript_only_text || null          // ← ТРАНСКРИПТ
};
```

**Helper Function - safeNumber():**
```typescript
function safeNumber(value: any, defaultValue: number): number {
  const num = Number(value);
  return isNaN(num) ? defaultValue : num;
}
```

**Helper Function - Date Validation:**
```typescript
let validatedPublishDate: string | null = null;

if (data.publishDate) {
  try {
    const date = new Date(data.publishDate);
    if (!isNaN(date.getTime())) {
      validatedPublishDate = date.toISOString();
    }
  } catch (e) {
    // Invalid date format - skip
  }
}
```

**Вывод этапа 3:**
```typescript
interface VideoDetails {
  videoId: string;
  title: string;
  likeCount: number;
  commentCount: number;
  viewCount: number;
  publishDate: string | null;
  durationMs: number | null;
  keywords: string[] | null;
  transcriptText: string | null;     // ← ПОЛНЫЙ ТРАНСКРИПТ
}
```

---

### ЭТАП 4: Truncation для Storage

**Функция:** Enrichment Endpoint
**Файл:** `/home/user/ai/YouTubeAnalitycs/src/app/api/channel/[id]/videos/enrich/route.ts`
**Строки:** 109-114

**Процесс:**
```typescript
// Получить полный транскрипт
const details = await getYoutubeVideoDetails(videoUrl);

// Сокращение до первых 4000 символов для хранения в video_details
const transcriptShort = details.transcriptText
  ? details.transcriptText.slice(0, 4000)
  : null;
```

**Почему 4000 символов?**
- Оптимальный размер для быстрого поиска в БД
- Достаточно для анализа первого блока контента
- Экономит место в базе данных
- Полный транскрипт остаётся в `videos_cache`

---

### ЭТАП 5: Database Storage

**Два уровня хранения:**

#### 1. Полный Транскрипт: videos_cache

**Таблица:** `videos_cache`
**Файл:** `/home/user/ai/YouTubeAnalitycs/src/lib/db.ts` (lines 472-483)

```sql
CREATE TABLE IF NOT EXISTS videos_cache (
  videoId TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  viewCount INTEGER DEFAULT 0,
  likeCount INTEGER DEFAULT 0,
  commentCount INTEGER DEFAULT 0,
  publishDate TEXT,
  durationMs INTEGER,
  keywords TEXT,                    -- JSON array: ["keyword1", "keyword2"]
  transcriptText TEXT,              -- ← ПОЛНЫЙ ТРАНСКРИПТ (не ограничен)
  lastUpdated INTEGER NOT NULL      -- Unix timestamp for cache invalidation
);
```

**Использование:**
- Основное хранилище полного транскрипта
- Кэширование на 7 дней
- Быстрый доступ по videoId

#### 2. Сокращённый Транскрипт: video_details

**Таблица:** `video_details`
**Файл:** `/home/user/ai/YouTubeAnalitycs/src/lib/db.ts` (lines 293-304)

```sql
CREATE TABLE IF NOT EXISTS video_details (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  videoId TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL,
  likeCount INTEGER NOT NULL DEFAULT 0,
  commentCount INTEGER NOT NULL DEFAULT 0,
  viewCount INTEGER NOT NULL DEFAULT 0,
  durationMs INTEGER,
  keywordsJson TEXT,
  transcriptShort TEXT,             -- ← СОКРАЩЁННЫЙ (первые 4000 символов)
  updatedAt INTEGER NOT NULL        -- Unix timestamp
);
```

**Использование:**
- Быстрый поиск и фильтрация
- Отображение в UI
- Меньше памяти

---

### ЭТАП 6: Database Insert/Update

**Функция:** Enrichment Endpoint (lines 116-161)
**Процесс:** INSERT OR REPLACE (upsert)

```typescript
await client.execute({
  sql: `UPDATE video_details SET
    url = ?,
    likeCount = ?,
    commentCount = ?,
    viewCount = ?,
    duration_ms = ?,
    keywords_json = ?,
    transcript_short = ?,           -- ← СОКРАЩЁННЫЙ ТРАНСКРИПТ
    updatedAt = ?
    WHERE videoId = ?`,
  args: [
    videoUrl,
    details.likeCount,
    details.commentCount,
    details.viewCount,
    details.durationMs || null,
    details.keywords ? JSON.stringify(details.keywords) : null,
    transcriptShort,                -- First 4000 chars or null
    Date.now(),
    video.videoId,
  ],
});
```

**В videos_cache (полный транскрипт):**
```typescript
await saveVideoDetailsToCache({
  videoId: details.videoId,
  title: details.title,
  viewCount: details.viewCount,
  likeCount: details.likeCount,
  commentCount: details.commentCount,
  publishDate: details.publishDate,
  durationMs: details.durationMs,
  keywords: details.keywords,
  transcriptText: details.transcriptText  // ← ПОЛНЫЙ ТЕКСТ
});
```

---

## 💾 Система Кэширования Транскриптов

### Cache Module

**Файл:** `/home/user/ai/YouTubeAnalitycs/src/lib/cache/youtube-cache.ts`

### Интерфейс Кэшированных Данных

```typescript
interface CachedVideoDetails {
  videoId: string;
  title: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  publishDate: string | null;
  durationMs: number | null;
  keywords: string[] | null;
  transcriptText: string | null;    // ← ТРАНСКРИПТ В КЭШЕ
}
```

### Получение Транскрипта из Кэша

**Функция:** `getCachedVideo(videoId: string)`
**Файл:** `/home/user/ai/YouTubeAnalitycs/src/lib/cache/youtube-cache.ts`
**Строки:** 165-207

```typescript
export async function getCachedVideo(videoId: string): Promise<CachedVideoDetails | null> {
  const client = await db;

  // SQL Query
  const result = await client.execute(
    `SELECT
      videoId, title, viewCount, likeCount, commentCount,
      publishDate, durationMs, keywords, transcriptText
     FROM videos_cache
     WHERE videoId = ?`,
    [videoId]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0] as any;

  // Parse keywords from JSON
  let keywords: string[] | null = null;
  if (row.keywords) {
    try {
      keywords = JSON.parse(row.keywords);
    } catch (e) {
      console.warn(`Failed to parse keywords for ${videoId}:`, e);
      keywords = null;
    }
  }

  return {
    videoId: row.videoId,
    title: row.title,
    viewCount: row.viewCount || 0,
    likeCount: row.likeCount || 0,
    commentCount: row.commentCount || 0,
    publishDate: row.publishDate || null,
    durationMs: row.durationMs || null,
    keywords,
    transcriptText: row.transcriptText || null,  // ← ПОЛНЫЙ ТРАНСКРИПТ
  };
}
```

### Сохранение Транскрипта в Кэш

**Функция:** `saveVideoDetailsToCache()`
**Файл:** `/home/user/ai/YouTubeAnalitycs/src/lib/cache/youtube-cache.ts`
**Строки:** 213-261

```typescript
export async function saveVideoDetailsToCache(details: {
  videoId: string;
  title: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  publishDate?: string | null;
  durationMs?: number | null;
  keywords?: string[] | null;
  transcriptText?: string | null;  // ← ПАРАМЕТР ТРАНСКРИПТА
}): Promise<void> {
  const client = await db;
  const now = Date.now();

  // Serialize keywords
  let keywordsJson: string | null = null;
  if (details.keywords && Array.isArray(details.keywords)) {
    try {
      keywordsJson = JSON.stringify(details.keywords);
    } catch (e) {
      console.warn(`Failed to serialize keywords for ${details.videoId}:`, e);
    }
  }

  // Upsert (insert or replace)
  await client.execute(
    `INSERT OR REPLACE INTO videos_cache
     (videoId, title, viewCount, likeCount, commentCount,
      publishDate, durationMs, keywords, transcriptText, lastUpdated)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      details.videoId,
      details.title,
      details.viewCount,
      details.likeCount,
      details.commentCount,
      details.publishDate || null,
      details.durationMs || null,
      keywordsJson,
      details.transcriptText || null,  // ← СОХРАНИТЬ ПОЛНЫЙ ТРАНСКРИПТ
      now,
    ]
  );
}
```

### Инвалидация Кэша

**Логика валидности:** 7 дней

```typescript
// Проверка перед использованием
const CACHE_VALIDITY_MS = 7 * 24 * 60 * 60 * 1000; // 7 дней

if (Date.now() - lastUpdated > CACHE_VALIDITY_MS) {
  // Кэш устарел, нужно переполучить
  return await getYoutubeVideoDetails(url);
}

// Кэш свежий, использовать
return cachedVideo;
```

---

## ⚙️ Rate Limiting

### 500ms Delay Between Requests

**Файл:** `/home/user/ai/YouTubeAnalitycs/src/app/api/channel/[id]/videos/enrich/route.ts`
**Строки:** 166-167

```typescript
// Обработка 30 видео с 500ms задержкой между запросами
for (const video of topVideos) {
  await getYoutubeVideoDetails(videoUrl);

  // Delay to avoid rate limiting
  await new Promise((resolve) => setTimeout(resolve, 500));
}
```

**Причины:**
- Избежать рейт-лимитинга ScrapeCreators API
- Соблюдение terms of service
- Стабильность API

**Расчёт:** 30 видео × 500ms = 15 секунд на обогащение канала

### Retry Logic

**Exponential Backoff:** [200ms, 400ms, 800ms]

```typescript
const delays = [200, 400, 800];

for (let attempt = 0; attempt < delays.length; attempt++) {
  try {
    return await fetch(url, options);
  } catch (e) {
    if (attempt < delays.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delays[attempt]));
    } else {
      throw e;
    }
  }
}
```

---

## 🚨 Обработка Ошибок

### Error Handling Strategy

**Файл:** `/home/user/ai/YouTubeAnalitycs/src/lib/scrapecreators.ts`
**Строки:** 876-894

```typescript
if (!response.ok) {
  console.error("[ScrapeCreators] API error:", {
    status: response.status,
    data
  });

  // Специфичная обработка по HTTP статусам
  if (response.status === 404) {
    throw new Error("Video not found.");

  } else if (response.status === 401) {
    throw new Error("Invalid API key. Check SCRAPECREATORS_API_KEY.");

  } else if (response.status === 429) {
    // Too Many Requests
    throw new Error(
      "ScrapeCreators rate limit exceeded. Please try again later."
    );

  } else if (response.status >= 500) {
    // Server Error
    throw new Error(
      `ScrapeCreators server error (${response.status}). ` +
      `The service may be temporarily unavailable.`
    );

  } else {
    throw new Error(
      `ScrapeCreators API error: ${response.status} - ` +
      `${JSON.stringify(data).slice(0, 200)}`
    );
  }
}
```

### Error Recovery

**Try-Catch в Enrichment Endpoint:**
```typescript
try {
  const details = await getYoutubeVideoDetails(videoUrl);
  // Process and store
} catch (error) {
  console.error(`Failed to fetch details for ${videoUrl}:`, error);
  // Continue with next video (graceful degradation)
}
```

---

## 📊 Data Flow Diagram

```
YouTube Video
    ↓
┌─────────────────────────────────────────┐
│  Input URL                               │
│  https://youtube.com/watch?v=xxx         │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│  Check Cache                            │
│  getCachedVideo(videoId)                │
│  ├─ Hit (< 7 days) → Return cached     │
│  └─ Miss or Stale → Continue            │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│  Call ScrapeCreators API                │
│  GET /v1/youtube/video?url=xxx          │
│  Headers: x-api-key: $SCRAPECREATORS... │
│  Timeout: 30 seconds                    │
│  Rate: 500ms between requests           │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│  API Response                           │
│  {                                      │
│    videoId: "xxx",                      │
│    title: "...",                        │
│    transcript_only_text: "[00:00]...",  │
│    viewCount: 123,                      │
│    ... other fields                     │
│  }                                      │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│  Normalization                          │
│  - Parse transcript_only_text           │
│  - Validate dates                       │
│ - Convert numbers (safeNumber)          │
│  - Parse keywords array                 │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│  Storage Decision                       │
├─ Full transcript → videos_cache         │
└─ Truncated (4000 chars) → video_details│
    ↓
┌─────────────────────────────────────────┐
│  Database Insert/Update                 │
│  INSERT OR REPLACE INTO videos_cache    │
│  UPDATE video_details                   │
│  - Save full transcript                 │
│  - Save first 4000 chars                │
│  - Update timestamp                     │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│  Cache Layer                            │
│  saveVideoDetailsToCache()              │
│  - Store in memory cache               │
│  - Set 7-day expiration                 │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│  Ready for Use                          │
│  - Retrieve via getCachedVideo()        │
│  - Use in analysis pipeline             │
│  - Display in UI                        │
└─────────────────────────────────────────┘
```

---

## 🔗 Точки Интеграции Транскриптов

### 1. Enrichment Endpoint (Где Загружаются Транскрипты)

**URL:** `POST /api/channel/[id]/videos/enrich`
**Файл:** `/home/user/ai/YouTubeAnalitycs/src/app/api/channel/[id]/videos/enrich/route.ts`
**Процесс:**
1. Получить top 30 видео канала
2. Для каждого видео: вызвать `getYoutubeVideoDetails()`
3. Сохранить транскрипт в БД
4. Сокращение до 4000 символов для video_details

### 2. Video Details Lookup (Где Получаются Транскрипты)

**Функция:** `getYoutubeVideoDetails(url: string)`
**Файл:** `/home/user/ai/YouTubeAnalitycs/src/lib/scrapecreators.ts`
**Вызывается из:**
- Enrichment endpoint
- Cache retrieval
- Direct API access

### 3. Cache Layer (Где Кэшируются Транскрипты)

**Функции:**
- `getCachedVideo(videoId)` - Получить из кэша
- `saveVideoDetailsToCache()` - Сохранить в кэш

**Файл:** `/home/user/ai/YouTubeAnalitycs/src/lib/cache/youtube-cache.ts`

---

## 📋 Type Definitions

### Complete Transcript Data Structure

```typescript
// === RAW API RESPONSE ===
interface ScrapeCreatorsVideoResponse {
  videoId: string;
  title: string;
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
  publishDate?: string;                    // ISO 8601
  durationMs?: number;
  keywords?: string[];
  transcript_only_text?: string;           // ← RAW TRANSCRIPT

  // Alternative field names
  id?: string;
  name?: string;
  viewCountInt?: number;
  likeCountInt?: number;
  commentCountInt?: number;
  duration?: number;
}

// === NORMALIZED IN APPLICATION ===
interface VideoDetails {
  videoId: string;
  title: string;
  likeCount: number;
  commentCount: number;
  viewCount: number;
  publishDate: string | null;
  durationMs: number | null;
  keywords: string[] | null;
  transcriptText: string | null;          // ← NORMALIZED TRANSCRIPT
}

// === IN DATABASE (FULL) ===
interface VideoCacheRow {
  videoId: string;
  title: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  publishDate: string | null;
  durationMs: number | null;
  keywords: string;                       // JSON stringified
  transcriptText: string;                 // ← FULL TRANSCRIPT (unlimited)
  lastUpdated: number;                    // Unix timestamp
}

// === IN DATABASE (SHORTENED) ===
interface VideoDetailsRow {
  id: number;
  videoId: string;
  url: string;
  likeCount: number;
  commentCount: number;
  viewCount: number;
  durationMs: number | null;
  keywordsJson: string | null;
  transcriptShort: string;                // ← SHORTENED (first 4000 chars)
  updatedAt: number;                      // Unix timestamp
}

// === CACHED DATA ===
interface CachedVideoDetails {
  videoId: string;
  title: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  publishDate: string | null;
  durationMs: number | null;
  keywords: string[] | null;
  transcriptText: string | null;          // ← IN MEMORY CACHE
}

// === FOR ANALYSIS ===
interface VideoForAnalysis {
  videoId: string;
  title: string;
  channelTitle: string;
  viewCount: number;
  likeCount?: number;
  commentCount?: number;
  publishDate: string;
  viewsPerDay?: number;
  momentumScore?: number;
  transcript?: string;                    // ← AVAILABLE BUT NOT USED YET
  keywords?: string[];
}
```

---

## 📈 Текущее Использование Транскриптов

### Что Используется В Генерации Сценариев

**Текущее состояние:** Транскрипты НЕ используются в pipeline генерации Netflix-сценариев

**Используется:**
- ✅ Названия видео (title)
- ✅ Метрики (views, likes, comments)
- ✅ Ключевые слова (keywords/tags)
- ✅ Дата публикации (publishDate)
- ❌ Транскрипты (NOT USED)

**Почему транскрипты не используются:**
- Pipeline работает с семантическими закономерностями (patterns)
- Не требуется полный текст видео
- Анализ на уровне метаданных эффективнее для масштабирования
- Транскрипты используются в других модулях (future expansion)

### Потенциальное Использование В Будущем

**Возможные применения транскриптов:**
1. **Sentiment Analysis** - Анализ тона речи в видео
2. **Key Phrases Extraction** - Автоматическое извлечение ключевых фраз
3. **Content Clustering** - Группировка видео по похожему контенту
4. **Audience Analysis** - Анализ того, о чём говорят создатели
5. **Script Plagiarism Check** - Проверка на заимствования

---

## 🔍 Database Indexes для Быстрого Доступа

```sql
-- Быстрый поиск по videoId в видео-кэше
CREATE INDEX idx_videos_cache_lookup ON videos_cache(videoId);

-- Быстрый поиск по videoId в деталях
CREATE INDEX idx_video_details_lookup ON video_details(videoId);

-- Быстрый поиск по URL
CREATE INDEX idx_video_details_url ON video_details(url);
```

---

## ⏱️ Performance Characteristics

| Операция | Время | Примечание |
|----------|-------|-----------|
| getYoutubeVideoDetails() | 2-5 сек | API call to ScrapeCreators |
| getCachedVideo() | 10-50 мс | DB query + JSON parse |
| saveVideoDetailsToCache() | 50-200 мс | DB insert/replace |
| Batch enrichment (30 видео) | 15-30 сек | 500ms delay × 30 videos |
| Cache hit retrieval | < 10 мс | In-memory lookup |

**Оптимизации:**
- 7-дневный кэш значительно снижает API calls
- Indexing на videoId обеспечивает O(1) lookup
- Сокращение транскриптов до 4000 символов экономит bandwidth

---

## 🚀 Configuration & Environment

### Required Environment Variables

```bash
# ScrapeCreators API Key
SCRAPECREATORS_API_KEY=your_api_key_here

# Database URL (if using remote DB)
DATABASE_URL=turso://...
```

### Optional Configuration

```typescript
// Default cache validity
const CACHE_VALIDITY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Rate limiting delay
const RATE_LIMIT_DELAY_MS = 500;

// Transcript truncation size
const TRANSCRIPT_MAX_CHARS = 4000;

// API timeout
const FETCH_TIMEOUT_MS = 30000; // 30 seconds
```

---

## 📝 Summary

**Полный пайплайн экстракции транскриптов:**

1. **Input:** YouTube Video URL
2. **API Call:** ScrapeCreators `/youtube/video` endpoint
3. **Rate Limiting:** 500ms между запросами
4. **Response:** API возвращает `transcript_only_text`
5. **Normalization:** Парсинг и валидация данных
6. **Storage:**
   - Полный транскрипт → `videos_cache`
   - Сокращённый (4000 chars) → `video_details`
7. **Caching:** 7-дневная валидность с automatic refresh
8. **Retrieval:** getCachedVideo() для быстрого доступа
9. **Usage:** Доступно для анализа, но НЕ используется в текущем pipeline

**Ключевые компоненты:**
- ✅ ScrapeCreators API интеграция
- ✅ Двойной уровень хранения (full + truncated)
- ✅ Intelligent caching с 7-дневной валидностью
- ✅ Rate limiting и retry logic
- ✅ Comprehensive error handling
- ✅ Type-safe TypeScript interface

**Файлы:**
- `/home/user/ai/YouTubeAnalitycs/src/lib/scrapecreators.ts` - API integration
- `/home/user/ai/YouTubeAnalitycs/src/lib/cache/youtube-cache.ts` - Caching layer
- `/home/user/ai/YouTubeAnalitycs/src/lib/db.ts` - Database schema
- `/home/user/ai/YouTubeAnalitycs/src/app/api/channel/[id]/videos/enrich/route.ts` - Enrichment

---

**Документация составлена:** 2026-01-19
**Версия:** 1.0
**Актуальна для:** YouTubeAnalitycs v1.x with ScrapeCreators API
