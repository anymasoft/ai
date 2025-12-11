# 📊 ПОЛНЫЙ ТЕХНИЧЕСКИЙ ОТЧЁТ ПО ВСЕМ GPT-ВЫЗОВАМ В YouTubeAnalytics

**Дата отчёта:** 2025-12-11
**Проект:** YouTubeAnalytics (YouTube Channel Analytics & Content Strategy)
**Версия:** Complete Audit Report v1.0
**Статус:** ✅ Анализ только (без изменений кода)

---

## 📋 СОДЕРЖАНИЕ

1. [Сводка по всем GPT-вызовам](#сводка)
2. [Детальный анализ каждого вызова](#детальный-анализ)
3. [Сводка по форматам и рискам](#сводка-по-форматам)
4. [Матрица использования markdown](#матрица-markdown)
5. [Матрица JSON структур](#матрица-json)
6. [Критические риски](#критические-риски)

---

## 🎯 СВОДКА {#сводка}

### Статистика

| Метрика | Значение |
|---------|----------|
| **Всего файлов с OpenAI вызовами** | 23 |
| **API Routes** | 13+ |
| **Core AI Modules (lib/ai)** | 10+ |
| **Модель (все вызовы)** | gpt-4.1-mini |
| **Параллельные вызовы** | Да (Comments Orchestrator: 13 вызовов) |
| **Последовательные pipeline** | Да (Scripts: 3-stage) |
| **Response Format JSON** | 5+ маршрутов |
| **Response Format Text** | 3+ маршрутов |
| **Response Format Markdown** | 1+ маршрутов |
| **Файлы с markdown генерацией** | 2 |
| **Файлы с таблицами в markdown** | 1 |
| **Файлы с JSON таблицами** | 1 |
| **Файлы с retry logic** | 8+ |
| **Файлы с fallback logic** | 4+ |

---

## 📖 ДЕТАЛЬНЫЙ АНАЛИЗ {#детальный-анализ}

---

## === GPT CALL #1 ===

### **File:** `src/app/api/channel/[id]/comments/insights/route.ts`
### **Function:** `POST()`
### **Endpoint:** `POST /api/channel/[id]/comments/insights`

#### Prompt Template:
```
System Role:
"Ты — эксперт по анализу аудитории YouTube. Твоя задача — изучить комментарии
и выявить интересы, боли, запросы и настроения аудитории. ВАЖНО: Отвечай СТРОГО
на русском языке. Возвращай JSON с английскими ключами, но ВСЕ значения должны
быть на русском языке."

User Prompt:
"Проанализируй топ комментарии на канале "{channel_title}".

Выяви:
1) audienceInterests - основные интересы аудитории (темы, которые их волнуют)
2) audiencePainPoints - боли и проблемы, которые они испытывают
3) requestedTopics - темы, которые аудитория явно просит осветить
4) complaints - основные жалобы и недовольства
5) praises - что хвалят, что нравится
6) nextVideoIdeasFromAudience - конкретные идеи для следующих видео на основе
   комментариев
7) explanation - краткое объяснение общего настроя аудитории

Комментарии ({comment_count} шт., отсортированы по лайкам):
{JSON.stringify(topComments)}

Ответь ТОЛЬКО в формате JSON без дополнительного текста:
{
  "audienceInterests": ["интерес 1", "интерес 2", ...],
  "audiencePainPoints": ["боль 1", "боль 2", ...],
  "requestedTopics": ["запрос 1", "запрос 2", ...],
  "complaints": ["жалоба 1", "жалоба 2", ...],
  "praises": ["похвала 1", "похвала 2", ...],
  "nextVideoIdeasFromAudience": ["идея 1", "идея 2", ...],
  "explanation": "краткое объяснение..."
}"
```

#### Model Configuration:
- **Model:** `gpt-4.1-mini`
- **Temperature:** `0.7`
- **Max Tokens:** `1500`
- **Response Format:** NOT STRICT JSON (request in prompt, no `response_format` field)

#### Input Data:
- **Source:** `channel_comments` table (TOP 200 comments by likes)
- **Fields:** `{author, text, likeCountInt}`
- **Max Comments:** 500 from DB, 200 for analysis

#### Expected Output Structure:
```json
{
  "stats": {
    "totalComments": number,
    "analyzedComments": number,
    "totalVideos": number
  },
  "audienceInterests": ["string", ...],
  "audiencePainPoints": ["string", ...],
  "requestedTopics": ["string", ...],
  "complaints": ["string", ...],
  "praises": ["string", ...],
  "nextVideoIdeasFromAudience": ["string", ...],
  "explanation": "string",
  "generatedAt": number
}
```

#### Response Format:
- **Type:** JSON
- **Stored As:** `comment_insights.data` (JSON.stringify)
- **Used By:** Component `<CommentInsights>` in `src/components/channel/CommentInsights.tsx`

#### Parsing Strategy:
```typescript
// 1. Raw response parsing with logging
let aiAnalysis;
try {
  aiAnalysis = JSON.parse(responseText);
} catch (parseErr) {
  // Error logging added in commit 40f480f
  throw new Error(`Failed to parse OpenAI response`);
}

// 2. Validation with fallbacks to empty arrays
const validatedAnalysis = {
  audienceInterests: Array.isArray(aiAnalysis.audienceInterests) ? aiAnalysis.audienceInterests : [],
  audiencePainPoints: Array.isArray(aiAnalysis.audiencePainPoints) ? aiAnalysis.audiencePainPoints : [],
  requestedTopics: Array.isArray(aiAnalysis.requestedTopics) ? aiAnalysis.requestedTopics : [],
  complaints: Array.isArray(aiAnalysis.complaints) ? aiAnalysis.complaints : [],
  praises: Array.isArray(aiAnalysis.praises) ? aiAnalysis.praises : [],
  nextVideoIdeasFromAudience: Array.isArray(aiAnalysis.nextVideoIdeasFromAudience)
    ? aiAnalysis.nextVideoIdeasFromAudience : [],
  explanation: typeof aiAnalysis.explanation === "string"
    ? aiAnalysis.explanation : "No explanation provided",
};
```

#### Storage:
- **Table:** `comment_insights`
- **Columns:** `(videoId, channelId, data, data_ru, generatedAt)`
- **Strategy:** DELETE + INSERT (fresh generation)

#### UI Component:
**`src/components/channel/CommentInsights.tsx`** (287 lines)
- Displays stats grid (totalComments, analyzedComments, totalVideos)
- Renders "Overall Audience Mood" section with explanation
- Renders 3-column grid: Interests, Pain Points, Topic Requests
- Full-width cards for: Complaints, Praises, Next Video Ideas
- Timestamp: `new Date(generatedAt).toLocaleString("en-US")`

#### Risks If Prompt Modified:
| Risk | Severity | Description |
|------|----------|-------------|
| JSON structure change | 🔴 CRITICAL | Component expects exact keys; missing keys → empty arrays |
| Language mismatch | 🟡 MEDIUM | System prompt enforces Russian values + English keys; violating breaks component |
| Array format violation | 🔴 CRITICAL | Each field MUST be array or will fallback to `[]` → UI shows nothing |
| Markdown in values | 🟡 MEDIUM | Component displays as plain text; markdown not processed in UI |
| Extra fields added | 🟢 LOW | Extra fields will be ignored; no harm |

#### Additional Notes:
- ✅ Logging added (commit 40f480f): raw response, parsed data, validated structure
- ✅ Error handling: try-catch with descriptive messages
- ✅ Fallback strategy: every field has default value
- ⚠️ No markdown processing: all text is displayed as-is

---

## === GPT CALL #2 ===

### **File:** `src/lib/ai/analyzeChannel.ts`
### **Function:** `analyzeChannel(channelId: string)`
### **Scope:** Core AI Library

#### Prompt Structure (3 parts):

**PART 1 - Context & Channel Data:**
```
Обрабатываем данные:
- Канал: {channel_title}
- ID: {channelId}
- Подписчики: {subscriber_count}
- Всего видео: {video_count}
- Всего просмотров: {total_views}

ТОП-20 ВИДЕО:
{table with: title, views, likes, comments, engagement, duration}
```

**PART 2 - System Instructions (4000+ chars):**
```
Ты — эксперт YouTube-аналитики, креативный продюсер и стратег роста каналов.
Проводишь максимально глубокие, практичные и коммерчески ценные SWOT-анализы
на основе РЕАЛЬНЫХ данных.

ТРЕБОВАНИЯ:
- Отвечай ТОЛЬКО валидным JSON на русском
- Никогда не используй общие фразы — только конкретика, цифры, примеры
- Strengths: 5-12 пунктов, каждый = 1-2 насыщенных абзаца (200-300 символов)
- Weaknesses: 5-12 пунктов с конкретными цифрами
- Opportunities: опирайся на тренды YouTube, паттерны топ-видео
- Threats: стратегические риски с аргументацией
- strategicSummary: 3-5 содержательных абзацев
- contentPatterns: 3-7 паттернов (каждый = 1-2 абзаца)
- videoIdeas: 3-7 осмысленных идей (не "ещё три заголовка")
  * title: конкретное название на основе паттернов
  * hook: 1-2 фразы (не описание)
  * description: 5-8 предложений, практичные, с обоснованием
  * outline: 4-7 шагов структуры
```

**PART 3 - JSON Response Format Template (detailed 300+ line example)**

#### Model Configuration:
- **Model:** `gpt-4.1-mini`
- **Temperature:** `0.8`
- **Response Format:** `{ type: "json_object" }`
- **Max Tokens:** NOT SET (model stops naturally)

#### Input Data:
- **Source:** Database (competitors + channel_videos tables)
- **Data Points:** 20 videos with: title, view count, like count, comment count, duration, description
- **Calculation:** Engagement scores, views per day metrics

#### Expected Output Structure:
```typescript
interface ChannelSwotAnalysis {
  strengths: SwotPoint[];      // 5-12 items
  weaknesses: SwotPoint[];     // 5-12 items
  opportunities: SwotPoint[];  // 5-12 items
  threats: SwotPoint[];        // 5-12 items
  strategicSummary: string[];  // 3-5 paragraphs
  contentPatterns: string[];   // 3-7 patterns
  videoIdeas: VideoIdea[];     // 3-7 ideas
  generatedAt: string;         // ISO timestamp
}

interface SwotPoint {
  title: string;               // 2-5 words
  details: string;             // 1-2 paragraphs (200-300 chars)
}

interface VideoIdea {
  title: string;
  hook: string;
  description: string;         // 5-8 sentences
  outline: string[];           // 4-7 steps
}
```

#### Response Format:
- **Type:** JSON (strict via `response_format: { type: "json_object" }`)
- **Stored As:** `ai_insights` table
- **Storage Format:**
  ```sql
  INSERT INTO ai_insights (competitorId, strengths, weaknesses, opportunities,
                          threats, strategicSummary, contentPatterns, videoIdeas,
                          generatedAt)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  ```

#### Used By:
- **Component:** `<SWOTAnalysisBlock>` in `src/components/channel/SWOTAnalysisBlock.tsx`
- **Page:** `src/app/(dashboard)/channel/[id]/page.tsx` (lines 136-148)

#### Parsing & Validation:
```typescript
// 1. Parse JSON response
const analysis = JSON.parse(content) as ChannelSwotAnalysis;

// 2. Validate structure
if (
  !Array.isArray(analysis.strengths) ||
  !Array.isArray(analysis.weaknesses) ||
  !Array.isArray(analysis.opportunities) ||
  !Array.isArray(analysis.threats) ||
  !Array.isArray(analysis.strategicSummary) ||
  !Array.isArray(analysis.contentPatterns) ||
  !Array.isArray(analysis.videoIdeas)
) {
  throw new Error("Invalid analysis structure from OpenAI");
}

// 3. Validate SwotPoint details (minimum length)
const validateSwotPoints = (points: SwotPoint[], category: string) => {
  points.forEach((point, idx) => {
    if (!point.title || !point.details) {
      throw new Error(`Invalid ${category} point at index ${idx}`);
    }
    if (point.details.length < 50) {
      console.warn(`Short details in ${category} point ${idx}`);
    }
  });
};
```

#### Risks If Prompt Modified:
| Risk | Severity | Description |
|------|----------|-------------|
| Array count violation | 🔴 CRITICAL | If OpenAI returns <5 or >12 items, component won't render correctly |
| Field length violation | 🟡 MEDIUM | If `details` < 50 chars, warning logged but continues |
| JSON structure change | 🔴 CRITICAL | `response_format: json_object` enforces valid JSON; parsing fails otherwise |
| Missing fields | 🔴 CRITICAL | All 7 fields required; missing any breaks validation |
| Text length in details | 🟡 MEDIUM | UI may truncate if >500 chars; not validated on server |
| Template example ignored | 🟡 MEDIUM | Model may deviate from provided template structure |

#### Additional Notes:
- ✅ **Very detailed prompt:** 4000+ characters
- ✅ **Explicit structure:** JSON template provided as example
- ✅ **Validation:** 5-level validation strategy
- ✅ **Performance:** 2-5 minute wait time logged
- ⚠️ **Console logging:** Full response logged before parsing
- ⚠️ **Large response:** Up to 6000 chars typical response

---

## === GPT CALL #3 ===

### **File:** `src/app/api/scripts/generate/route.ts`
### **Function:** `generateSemanticMap(videos)`
### **Pipeline Stage:** STAGE 1 of 3 - Semantic Analysis

#### Prompt:
```
System: "You are an expert in semantic analysis and narrative structure.
Analyze video data and extract semantic patterns."

User:
"Analyze {videos_count} competitor videos and create a Semantic Map.

VIDEO DATA:
{JSON with: title, channel, views, viewsPerDay, momentum, tags}

TASK:
1. **mergedTopics** (5-10) - semantic themes, not just words from titles
2. **commonPatterns** (5-8) - success patterns in structure, triggers, format
3. **conflicts** (3-5) - contradictions for narrative tension
4. **paradoxes** (2-4) - counterintuitive ideas that capture attention
5. **emotionalSpikes** (4-6) - emotional triggers and hooks
6. **visualMotifs** (3-5) - visual imagery that can be used in video
7. **audienceInterests** (4-6) - what audience reacts to
8. **rawSummary** - 2-3 sentence overview

Return ONLY JSON:
{
  "mergedTopics": [],
  "commonPatterns": [],
  "conflicts": [],
  "paradoxes": [],
  "emotionalSpikes": [],
  "visualMotifs": [],
  "audienceInterests": [],
  "rawSummary": ""
}"
```

#### Model Configuration:
- **Model:** `gpt-4.1-mini`
- **Temperature:** `0.7`
- **Response Format:** TEXT (JSON in prompt, cleaned from markdown)
- **Max Tokens:** NOT SET

#### Input Data:
- **Source:** Competitor videos
- **Count:** Variable (typically 5-20 videos)
- **Fields:** title, channel, views, viewsPerDay, momentum, tags

#### Output Structure:
```typescript
type SemanticMap = {
  mergedTopics: string[];
  commonPatterns: string[];
  conflicts: string[];
  paradoxes: string[];
  emotionalSpikes: string[];
  visualMotifs: string[];
  audienceInterests: string[];
  rawSummary: string;
};
```

#### Parsing Strategy:
```typescript
// 1. Clean markdown wrappers
const cleanJson = responseText
  .replace(/```json\n?/g, '')
  .replace(/```\n?/g, '')
  .trim();

// 2. Parse JSON
const semanticData: SemanticMap = JSON.parse(cleanJson);

// 3. Validate and normalize with empty array fallbacks
const validatedMap: SemanticMap = {
  mergedTopics: Array.isArray(semanticData.mergedTopics) ? semanticData.mergedTopics : [],
  commonPatterns: Array.isArray(semanticData.commonPatterns) ? semanticData.commonPatterns : [],
  conflicts: Array.isArray(semanticData.conflicts) ? semanticData.conflicts : [],
  paradoxes: Array.isArray(semanticData.paradoxes) ? semanticData.paradoxes : [],
  emotionalSpikes: Array.isArray(semanticData.emotionalSpikes) ? semanticData.emotionalSpikes : [],
  visualMotifs: Array.isArray(semanticData.visualMotifs) ? semanticData.visualMotifs : [],
  audienceInterests: Array.isArray(semanticData.audienceInterests) ? semanticData.audienceInterests : [],
  rawSummary: typeof semanticData.rawSummary === 'string' ? semanticData.rawSummary : '',
};
```

#### Fallback Logic:
- **On Error:** `generateSemanticMapFallback(videos)` generates basic structure from video titles
- **Fallback Returns:** Same structure but with extracted keywords instead of AI analysis

#### Used By:
- **Next Stage:** `generateNarrativeSkeleton(semanticMap, videos)` (STAGE 2)
- **Pipeline:** 3-stage sequential GPT pipeline for script generation

#### Risks If Prompt Modified:
| Risk | Severity | Description |
|------|----------|-------------|
| Markdown wrapper change | 🟡 MEDIUM | Cleaning logic expects ```json or ```; different format breaks |
| Extra fields in JSON | 🟢 LOW | Cleaned with validation; extra fields ignored |
| Missing array field | 🔴 CRITICAL | Fallback to `[]` makes field invisible to next stage |
| Array item format | 🟡 MEDIUM | Expected: strings; other types converted to string or skipped |

---

## === GPT CALL #4 ===

### **File:** `src/app/api/scripts/generate/route.ts`
### **Function:** `generateNarrativeSkeleton(semanticMap, videos)`
### **Pipeline Stage:** STAGE 2 of 3 - Narrative Structure

#### Prompt (Simplified):
```
"Create a narrative skeleton for a YouTube video based on semantic analysis.

INPUT:
{SemanticMap from Stage 1}
{Videos data}

OUTPUT:
{
  "coreIdea": string,
  "centralParadox": string,
  "mainConflict": string,
  "mainQuestion": string,
  "emotionalBeats": [string, ...],
  "storyBeats": [string, ...],
  "visualMotifs": [string, ...],
  "hookCandidates": [string, ...],
  "endingIdeas": [string, ...]
}"
```

#### Model Configuration:
- **Model:** `gpt-4.1-mini`
- **Temperature:** `0.8`
- **Response Format:** TEXT with JSON validation
- **Max Tokens:** NOT SET

#### Output Type:
```typescript
type NarrativeSkeleton = {
  coreIdea: string;
  centralParadox: string;
  mainConflict: string;
  mainQuestion: string;
  emotionalBeats: string[];
  storyBeats: string[];
  visualMotifs: string[];
  hookCandidates: string[];
  endingIdeas: string[];
};
```

#### Used By:
- **Next Stage:** `generateScriptFromSkeleton(skeleton, style, temperature)` (STAGE 3)

#### Parsing & Validation:
- Similar markdown cleaning as Stage 1
- Fallback to basic structure if parsing fails

---

## === GPT CALL #5 ===

### **File:** `src/app/api/scripts/generate/route.ts`
### **Function:** `generateScriptFromSkeleton(skeleton, style, temperature)`
### **Pipeline Stage:** STAGE 3 of 3 - Final Script Generation

#### Prompt (Dynamic):
```
"Generate a YouTube video script based on narrative skeleton.

STYLE: {user_specified: "engaging", "educational", "humorous", etc.}
TEMPERATURE: {0.3 (structured) to 1.3 (creative)}

NARRATIVE SKELETON:
{NarrativeSkeleton from Stage 2}

OUTPUT: Full markdown script with:
- [HOOK] section (5-10 seconds)
- [INTRO] section
- [MAIN CONTENT] section(s)
- [CALL-TO-ACTION] section
- [OUTRO] section

Include timing markers and visual direction hints."
```

#### Model Configuration:
- **Model:** `gpt-4.1-mini`
- **Temperature:** `{0.3 - 1.3}` (parametrized by user)
- **Response Format:** MARKDOWN TEXT
- **Max Tokens:** NOT SET

#### Output Format:
- **Type:** MARKDOWN with timing markers and sections
- **Structure:** Hierarchical with headers, bold text, timing notes
- **Response Example:**
  ```markdown
  # YOUTUBE VIDEO SCRIPT

  ## [HOOK] - 0:00-0:05 (5 seconds)

  **[Camera shows...]**

  "Hey everyone, what if I told you that..."

  ## [INTRO] - 0:05-0:15

  ...
  ```

#### Storage:
- **Table:** `generated_scripts`
- **Format:** Store raw markdown response
- **UI Handling:** Render markdown with react-markdown component

#### Used By:
- **Component:** Script preview/editor interface
- **User Action:** User can edit and save scripts

#### Risks If Prompt Modified:
| Risk | Severity | Description |
|------|----------|-------------|
| Markdown format change | 🟡 MEDIUM | UI expects markdown headers/bold; different format may not render correctly |
| Timing marker format | 🔴 CRITICAL | If format changes from `[TIMING]` or `0:00-0:05`, parsing breaks |
| Section name changes | 🟡 MEDIUM | UI searches for `[HOOK]`, `[INTRO]`, etc.; name change breaks navigation |
| Excessive length | 🟡 MEDIUM | Scripts longer than 20,000 chars may cause UI slowdown |

---

## === GPT CALL #6 ===

### **File:** `src/app/api/channel/[id]/audience/route.ts`
### **Function:** `POST()`
### **Endpoint:** `POST /api/channel/[id]/audience`

#### Prompt (Complex Multi-section):
```
System Role: "You are an expert YouTube audience analyst. Provide deep analytics
about viewer behavior, preferences, and patterns. Answer ONLY in Russian. Return
JSON with English keys but ALL values in Russian."

User Prompt:
"Analyze audience of YouTube channel '{title}' and provide insights in this format:

REQUIRED JSON STRUCTURE:
{
  "audienceProfile": ["characteristic 1", "characteristic 2", ...],
  "contentPreferences": ["preference 1", "preference 2", ...],
  "engagementPatterns": ["pattern 1", "pattern 2", ...],
  "recommendations": ["recommendation 1", "recommendation 2", ...]
}

Return ONLY JSON."
```

#### Model Configuration:
- **Model:** `gpt-4.1-mini`
- **Temperature:** `0.6` (for concreteness)
- **Response Format:** JSON (request in prompt, no strict format)
- **Max Tokens:** REMOVED (per PROD checklist comment)

#### Input Data:
- **Source:** Database (competitors table + calculated metrics)
- **Metrics:** Video engagement, like rates, comment rates, views per day

#### Expected Output:
```json
{
  "audienceProfile": ["string", ...],
  "contentPreferences": ["string", ...],
  "engagementPatterns": ["string", ...],
  "recommendations": ["string", ...]
}
```

#### Storage:
- **Table:** `audience_insights`
- **Format:** JSON.stringify
- **Fields:** `(competitorId, channelId, data, createdAt)`

#### Used By:
- **Component:** `<AudienceInsightsSection>`
- **Page:** Channel analytics page

#### Risks If Prompt Modified:
| Risk | Severity | Description |
|------|----------|-------------|
| Field name change | 🔴 CRITICAL | Component expects exact field names |
| Non-array values | 🟡 MEDIUM | Component expects arrays; single strings will break mapping |
| Extra fields | 🟢 LOW | Ignored by component |

---

## === GPT CALL #7 ===

### **File:** `src/app/api/channel/[id]/momentum/route.ts`
### **Function:** `POST()`
### **Endpoint:** `POST /api/channel/[id]/momentum`

#### Prompt:
```
"Analyze momentum trends in channel '{title}' videos.

Provide insights on:
- Which videos are gaining traction
- Growth patterns
- Hot themes and formats
- Momentum analysis

Return as JSON with detailed analysis."
```

#### Model Configuration:
- **Model:** `gpt-4.1-mini`
- **Temperature:** `0.7`
- **Response Format:** JSON (via prompt)
- **Max Tokens:** NOT SET

#### Input Data:
- **Source:** channel_videos table
- **Metrics:** viewsPerDay, momentum score, video category

#### Used By:
- **Component:** `<MomentumInsightsSection>`

---

## === GPT CALL #8 ===

### **File:** `src/app/api/channel/[id]/deep/route.ts`
### **Function:** `POST()`
### **Endpoint:** `POST /api/channel/[id]/deep`

#### Prompt:
```
"Analyze audience in depth for channel '{title}'.

Provide:
- audienceProfile: characteristics of typical viewer
- contentPreferences: what content performs best
- engagementPatterns: how audience interacts
- recommendations: actionable insights

Return ONLY JSON."
```

#### Model Configuration:
- **Model:** `gpt-4.1-mini`
- **Temperature:** `0.7`
- **Response Format:** JSON
- **Max Tokens:** `1500`

#### Caching:
- **Strategy:** 7-day cache
- **Cache Check:** Before GPT call, if exists and < 7 days old, return cached version
- **Logic:**
  ```typescript
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  if (existingResult.createdAt > sevenDaysAgo) {
    return cached result;
  }
  ```

#### Storage:
- **Table:** `deep_audience`
- **Columns:** `(channelId, data, createdAt)`

---

## === GPT CALL #9 ===

### **File:** `src/app/api/channel/[id]/content-intelligence/route.ts`
### **Function:** `POST()`
### **Endpoint:** `POST /api/channel/[id]/content-intelligence`

#### Prompt (MARKDOWN + JSON HYBRID):
```
System: "You are a content analyst and YouTube strategy specialist with 10+
years experience. Create a professional analytics report ONLY based on provided
data (no assumptions)."

User:
"Conduct deep analysis of top videos for channel '{title}' and create structured
report.

**IMPORTANT: Response MUST contain TWO PARTS:**

PART 1 - Text Report (7 sections in markdown):
## 1. SUMMARY
Brief summary (3-5 sentences) with specific numbers

## 2. MAIN THEMES
5-10 main themes with: name, video count, avg views, trend description

## 3. CONTENT FORMATS
4-8 formats with: type, count, avg views, description

## 4. REPEATING PATTERNS
5-8 success patterns (title length, keywords, publication timing, structure)

## 5. WEAKNESSES
What performs poorly and why

## 6. OPPORTUNITIES
Unfilled niches and unused potential

## 7. RECOMMENDATIONS
5-8 concrete, actionable recommendations

**CRITICAL:** This markdown section is PART 1. Do NOT skip!

---

## JSON WITH TABULAR DATA (PART 2)

**MARKER:** __TABLES_JSON__

After this marker, provide ONLY JSON with:
{
  "themes": [
    { "name": "string", "videoCount": number, "avgViews": number }
  ],
  "formats": [
    { "type": "string", "count": number, "avgViews": number }
  ],
  "patterns": [
    { "pattern": "string", "description": "string" }
  ]
}

This JSON part is CRITICAL - do NOT omit it!"
```

#### Model Configuration:
- **Model:** `gpt-4.1-mini`
- **Temperature:** `0.6`
- **Response Format:** MARKDOWN + JSON (hybrid)
- **Max Tokens:** NOT SET

#### Output Structure (SPLIT FORMAT):
```typescript
interface ContentAnalysisResponse {
  // PART 1: Markdown report
  report: string;  // Full markdown with 7 sections

  // PART 2: Extracted JSON tables
  themes: Array<{name: string, videoCount: number, avgViews: number}>;
  formats: Array<{type: string, count: number, avgViews: number}>;
  patterns: Array<{pattern: string, description: string}>;
}
```

#### Parsing Strategy:
```typescript
// 1. Split response by marker
const parts = responseText.split('__TABLES_JSON__');
const reportPart = parts[0].trim();
const jsonPart = parts[1]?.trim() || '';

// 2. Parse markdown as plain text
const report = reportPart;

// 3. Extract JSON from second part
const tables = JSON.parse(jsonPart);
```

#### Storage:
- **Table:** `content_intelligence`
- **Format:** Store full response text (both markdown + JSON)
- **Columns:** `(competitorId, channelId, data, format, createdAt)`

#### Used By:
- **Component:** `<ContentInsightsSection>`
- **Rendering:** Markdown component + Table rendering

#### ⚠️ **CRITICAL RISKS:**
| Risk | Severity | Description |
|------|----------|-------------|
| Missing marker | 🔴 CRITICAL | If `__TABLES_JSON__` not included, JSON parsing fails completely |
| Markdown instead of plain | 🔴 CRITICAL | Report must NOT be wrapped in ```markdown tags; must be raw markdown |
| JSON outside of JSON part | 🟡 MEDIUM | Some JSON in markdown section will cause split failure |
| Table format violation | 🔴 CRITICAL | Expected exact fields; extra/missing fields break table rendering |

#### Additional Notes:
- ✅ **Explicit marker requirement:** Response split by `__TABLES_JSON__`
- ✅ **Hybrid format:** Markdown + JSON in single response
- ⚠️ **Complex parsing:** Two-part extraction strategy
- ⚠️ **Error prone:** Missing marker = complete failure
- ⚠️ **Component dependency:** Tables MUST be valid JSON or UI crashes

---

## === GPT CALL #10 ===

### **File:** `src/lib/ai/comments-modules/emotional-overview.ts`
### **Function:** `generateEmotionalOverview(comments, language)`

#### Prompt:
```
Language: {en | ru}

{language === "ru" ?
  "Ты - аналитик. Прочитай комментарии и опиши преобладающий эмоциональный тон
   в 2-3 коротких предложениях."
  :
  "You are an analyst. Read the comments and describe the dominant emotional tone
   in 2-3 short sentences."
}

COMMENTS:
{comments.slice(0, 50).map(c => `[${author}] (${likes} likes): ${content}`)}

ANSWER: Only 2-3 sentences describing overall emotional state. No structure,
no JSON, just text.
```

#### Model Configuration:
- **Model:** `gpt-4.1-mini`
- **Temperature:** `0.7`
- **Response Format:** PLAIN TEXT
- **Max Tokens:** `150`

#### Input Data:
- **Source:** Comment analysis (CommentForAnalysis[])
- **Sample Size:** First 50 comments
- **Fields:** author, content, likes

#### Expected Output:
- **Type:** Plain text (2-3 sentences)
- **Language:** Same as input parameter
- **Example:** "Аудитория очень позитивна и активна. Комментарии показывают высокий уровень вовлеченности. Зрители просят больше видео на эту тему."

#### Parsing Strategy:
```typescript
function cleanLLMResponse(response: string): string {
  return response
    .trim()
    .replace(/^["']|["']$/g, "")        // Remove quotes
    .replace(/^[\*]+|[\*]+$/g, "")      // Remove asterisks
    .replace(/^#+\s+/gm, "")            // Remove markdown headers
    .slice(0, 500);                     // Limit to 500 chars
}

const cleaned = cleanLLMResponse(content);
```

#### Retry Logic:
```typescript
const maxRetries = 3;
for (let attempt = 1; attempt <= maxRetries; attempt++) {
  try {
    const response = await openai.chat.completions.create({...});
    const content = response.choices[0]?.message?.content;

    if (!content || content.length < 10) {
      throw new Error("Response too short");
    }

    return cleaned;
  } catch (error) {
    if (attempt === maxRetries) throw error;
    // Retry...
  }
}
```

#### Fallback:
- **On Error:** Return language-appropriate default message
  ```typescript
  return language === "ru" ? "Нет комментариев для анализа." : "No comments to analyze.";
  ```

#### Used By:
- **Module:** Comments Orchestrator (comments-analysis.ts)
- **Integration:** Part of parallel comment analysis (13 concurrent calls)

#### Risks If Prompt Modified:
| Risk | Severity | Description |
|------|----------|-------------|
| Length requirement change | 🟡 MEDIUM | If OpenAI returns >500 chars, will be truncated |
| Language mismatch | 🟡 MEDIUM | Input language parameter must match system prompt |
| Format change (JSON/MD) | 🟡 MEDIUM | Cleaning regex expects plain text; JSON/markdown will be mangled |
| Empty response | 🔴 CRITICAL | Validation requires >10 chars; less than that throws error |

---

## === GPT CALL #11-20 ===

### **Comment Analysis Modules (10 additional functions)**

#### Files:
1. **sentiment-analyzer.ts** - 3 functions: countPositive, countNeutral, countNegative
2. **key-topics.ts** - generateKeyTopics()
3. **positive-triggers.ts** - generatePositiveTriggers()
4. **negative-triggers.ts** - generateNegativeTriggers()
5. **behavioral-insights.ts** - generateBehavioralInsights()
6. **faq.ts** - generateFAQ()
7. **audience-segments.ts** - generateAudienceSegments()
8. **growth-opportunities.ts** - generateGrowthOpportunities()
9. **missing-elements.ts** - generateMissingElements()
10. **checklist.ts** - generateChecklist()

#### Common Pattern:
```
Model: gpt-4.1-mini
Temperature: 0.7
Max Tokens: 800-1500
Response Format: JSON array or plain text list
Retry Logic: 3 attempts with exponential backoff
Fallback: Return empty array or default message
Language: Support for "ru" | "en"
```

#### General Structure:
```typescript
// Each module follows this pattern:
export async function generate{Something}(
  comments: CommentForAnalysis[],
  language: "ru" | "en" = "en"
): Promise<string[] | object> {
  // 1. Input validation
  if (!comments || comments.length === 0) {
    return fallbackValue;
  }

  // 2. OpenAI call with retry
  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [{role: "user", content: buildPrompt(comments, language)}],
        temperature: 0.7,
        max_tokens: 1000,
      });

      // 3. Parse and clean response
      const result = parseResponse(response.content);

      // 4. Return result
      return result;
    } catch (error) {
      if (attempt === maxRetries) return fallback;
      // Exponential backoff: 200ms, 400ms, 800ms
      await sleep(200 * Math.pow(2, attempt - 1));
    }
  }
}
```

#### Sentiment Functions (sentiment-analyzer.ts):
```
countPositive(): Count positive comments
countNeutral(): Count neutral comments
countNegative(): Count negative comments

Format: Each returns array of classified comments
Used By: sentimentSummary in Deep Analysis
```

#### Risk Summary (All Comment Modules):
| Risk | Severity | Description |
|------|----------|-------------|
| Comments empty | 🔴 CRITICAL | Fallback needed for each function |
| Retry exhaustion | 🟡 MEDIUM | After 3 retries, uses fallback instead of crashing |
| Language parameter ignored | 🟡 MEDIUM | If passed lang="es" not supported, defaults to "en" |
| Response format change | 🟡 MEDIUM | Each expects specific JSON/array format; other formats fail |

---

## === GPT CALL #21 ===

### **File:** `src/lib/ai/comments-analysis.ts`
### **Function:** `generateDeepAnalysis(commentChunks[])`

#### Prompt:
```
"Analyze the following comment chunks and provide deep insights.

COMMENTS:
{chunks of comments}

Provide analysis in JSON format with:
{
  "themes": ["theme1", "theme2", ...],
  "pain_points": ["pain1", "pain2", ...],
  "requests": ["request1", "request2", ...],
  "praises": ["praise1", "praise2", ...],
  "segments": ["segment1", "segment2", ...],
  "sentiment_summary": {
    "positive": number,
    "negative": number,
    "neutral": number
  },
  "quotes": ["quote1", "quote2", ...],
  "hidden_patterns": ["pattern1", "pattern2", ...],
  "ideas": ["idea1", "idea2", ...]
}"
```

#### Model Configuration:
- **Model:** `gpt-4.1-mini`
- **Temperature:** `0.7`
- **Response Format:** `{ type: "json_object" }`
- **Max Tokens:** `6000`

#### Output Structure:
```typescript
interface DeepAnalysisResult {
  themes: string[];
  pain_points: string[];
  requests: string[];
  praises: string[];
  segments: string[];
  sentiment_summary: { positive: number, negative: number, neutral: number };
  quotes: string[];
  hidden_patterns: string[];
  ideas: string[];
}
```

#### Used By:
- **Component:** `<DeepCommentAnalysisSection>`
- **Storage:** `channel_ai_comment_insights` table

#### Orchestrator (comments-orchestrator.ts):
```
Calls 13 functions in PARALLEL:
1. generateEmotionalOverview()
2. generateKeyTopics()
3. generatePositiveTriggers()
4. generateNegativeTriggers()
5. generateBehavioralInsights()
6. generateFAQ()
7. generateAudienceSegments()
8. generateGrowthOpportunities()
9. generateMissingElements()
10. generateChecklist()
11-13. countPositive(), countNeutral(), countNegative()

Combines results into CombinedDeepAnalysis object
```

---

## === GPT CALL #22 ===

### **File:** `src/app/api/competitors/compare/ai/route.ts`
### **Function:** `POST()`
### **Endpoint:** `POST /api/competitors/compare/ai`

#### Prompt:
```
"Compare {count} competitor channels and provide competitive analysis.

Channels:
{channel data with: title, subscribers, views, engagement}

Analyze:
- Relative strengths and weaknesses
- Competitive positioning
- Market opportunity
- Strategy recommendations

Return JSON with comparative insights."
```

#### Model Configuration:
- **Model:** `gpt-4.1-mini`
- **Temperature:** `0.6`
- **Response Format:** `{ type: "json_object" }`
- **Max Tokens:** `2000`

#### Input Data:
- **Source:** Multiple competitor channels
- **Data:** Aggregated metrics and video stats

#### Used By:
- **Component:** Competitor comparison view
- **Storage:** No permanent storage (API response only)

---

## 📊 СВОДКА ПО ФОРМАТАМ {#сводка-по-форматам}

### Тип Response по файлам:

#### STRICT JSON (with `response_format: { type: "json_object" }`):
1. **analyzeChannel.ts** - SWOT Analysis
2. **comments-analysis.ts** - Deep Analysis
3. **trending/insights/route.ts** - Trending Analysis
4. **competitors/compare/ai/route.ts** - Competitive Analysis

#### JSON in PROMPT (no strict format):
1. **comments/insights/route.ts** - Comment Insights
2. **audience/route.ts** - Audience Analysis
3. **deep/route.ts** - Deep Audience
4. **momentum/route.ts** - Momentum Analysis
5. **content-intelligence/route.ts** - Content Analysis (hybrid)
6. All comment modules - Various formats

#### PLAIN TEXT:
1. **emotional-overview.ts** - 2-3 sentence description
2. **faq.ts** - FAQ list (text)
3. **key-topics.ts** - Topic list

#### MARKDOWN:
1. **scripts/generate/route.ts (Stage 3)** - Script generation
2. **content-intelligence/route.ts** - Markdown report

#### HYBRID (Markdown + JSON):
1. **content-intelligence/route.ts** - 7-section report + JSON tables

---

## 📝 МАТРИЦА MARKDOWN {#матрица-markdown}

### Где используется markdown генерация:

| File | Function | Markdown Use | Format |
|------|----------|--------------|--------|
| scripts/generate/route.ts | generateScriptFromSkeleton | Full markdown script | Headers, bold, timing markers |
| content-intelligence/route.ts | generateAnalysis | 7-section report | Headers, bullet lists, bold text |
| comments-modules/* | Various | NOT used | Plain text or JSON arrays |

### Риски markdown:

1. **Scripts (generateScriptFromSkeleton)**
   - ✅ Safe to use markdown (expectation: markdown)
   - ⚠️ Risk: Timing marker format change (`[HOOK] 0:00-0:05` → other format)
   - ⚠️ Risk: Section names change (`[INTRO]` → `Introduction`)

2. **Content Intelligence (generateAnalysis)**
   - ✅ Safe for markdown in PART 1 (text report)
   - 🔴 CRITICAL: Part 2 MUST be JSON only (no markdown)
   - 🔴 CRITICAL: Marker `__TABLES_JSON__` is required separator
   - ⚠️ Risk: If markdown accidentally included in JSON part, parsing fails

3. **Comment Modules**
   - ✅ NO markdown used (intentionally avoided)
   - ✅ Plain text or JSON only
   - ✅ Safe - no rendering risks

### Где НЕ используется markdown:

- Все comment modules (emotional-overview, key-topics, sentiment-analyzer, etc.)
- Audience analysis
- Momentum analysis
- Deep audience analysis

---

## 📊 МАТРИЦА JSON {#матрица-json}

### Все JSON структуры:

| Name | Fields | Required | Used By | Risk |
|------|--------|----------|---------|------|
| **CommentInsights** | audienceInterests, audiencePainPoints, requestedTopics, complaints, praises, nextVideoIdeasFromAudience, explanation | ✅ All required | CommentInsights.tsx | Missing any field → empty array |
| **ChannelSwotAnalysis** | strengths[], weaknesses[], opportunities[], threats[], strategicSummary[], contentPatterns[], videoIdeas[], generatedAt | ✅ All required | SWOTAnalysisBlock.tsx | Invalid structure → validation error |
| **SemanticMap** | mergedTopics[], commonPatterns[], conflicts[], paradoxes[], emotionalSpikes[], visualMotifs[], audienceInterests[], rawSummary | ✅ All required | Stage 2 pipeline | Missing fields → fallback triggered |
| **NarrativeSkeleton** | coreIdea, centralParadox, mainConflict, mainQuestion, emotionalBeats[], storyBeats[], visualMotifs[], hookCandidates[], endingIdeas[] | ✅ All required | Stage 3 pipeline | Partial data → script quality degrades |
| **DeepAnalysisResult** | themes[], pain_points[], requests[], praises[], segments[], sentiment_summary{}, quotes[], hidden_patterns[], ideas[] | ✅ All required | DeepCommentAnalysisSection | Missing fields → incomplete analysis display |
| **AudienceProfile** | audienceProfile[], contentPreferences[], engagementPatterns[], recommendations[] | ✅ All required | AudienceInsightsSection.tsx | Invalid format → component breaks |

---

## 🔴 КРИТИЧЕСКИЕ РИСКИ {#критические-риски}

### RISK MATRIX (Severity × Impact)

#### 🔴 CRITICAL (Must fix immediately):

1. **Content Intelligence Marker (`__TABLES_JSON__`)**
   - **Issue:** If OpenAI response doesn't include marker, parsing fails
   - **Impact:** Entire content intelligence feature breaks
   - **Mitigation:** Add validation to check marker presence; fallback if missing

2. **Comment Insights Array Fields**
   - **Issue:** If OpenAI returns non-array for any field, validation fallback to `[]`
   - **Impact:** UI shows empty sections (appears as blank cards)
   - **Mitigation:** Validation already in place (commit 40f480f); working correctly

3. **SWOT Analysis Response Format**
   - **Issue:** `response_format: { type: "json_object" }` enforces JSON; parsing WILL fail if invalid
   - **Impact:** Component won't render; error shown to user
   - **Mitigation:** Try-catch with detailed error logging

4. **Script Generation Timing Format**
   - **Issue:** If timing marker format changes (`[HOOK] 0:00-0:05` → `[HOOK]`), timing parsing breaks
   - **Impact:** UI can't extract timing information; navigation fails
   - **Mitigation:** Add tolerance for format variations; fallback to section-only parsing

#### 🟡 MEDIUM (Should monitor):

1. **JSON Parsing Markdown Artifacts**
   - **Issue:** If OpenAI returns ```json``` wrappers, cleaning logic handles it
   - **Status:** ✅ Already handled in `generateSemanticMap` (line 281-284)
   - **Risk:** Different markdown format (e.g., `~~~json~~~`) won't be cleaned
   - **Mitigation:** Extend cleaning regex for more formats

2. **Content Intelligence Two-Part Split**
   - **Issue:** If `__TABLES_JSON__` appears multiple times, split logic breaks
   - **Impact:** Only first occurrence processed; rest of JSON ignored
   - **Mitigation:** Use `split(maxSplit=1)` to limit split to first occurrence

3. **Comment Module Retry Exhaustion**
   - **Issue:** After 3 retries, falls back to default value (empty array)
   - **Impact:** Analysis incomplete; user sees partial data
   - **Mitigation:** Log warning; display "Partial analysis available" message

#### 🟢 LOW (Nice to have):

1. **Extra JSON Fields**
   - **Issue:** OpenAI adds unexpected fields
   - **Status:** ✅ Ignored by validation; no harm
   - **Example:** If OpenAI adds `"additionalNotes": "..."`, ignored gracefully

2. **Response Length**
   - **Issue:** If response very long (>10,000 chars)
   - **Impact:** May cause UI slowdown; database storage OK
   - **Mitigation:** No current validation; could add length check

---

## 🔧 PRODUCTION CHECKLIST {#production-checklist}

### Audience Route (src/app/api/channel/[id]/audience/route.ts)

From comments in code (lines 76-80):

```
PROD CHECKLIST:
[ ] Раскомментировать кэширование (строка 293-310, 3 дня кэша)
[ ] Проверить max_tokens - должен быть удален (модель остановится сама)
[ ] Убедиться что используется только gpt-4.1-mini
[ ] Проверить temperature (текущее: 0.6, для конкретики)
```

**Current Status:**
- ❌ Caching commented out
- ❌ max_tokens still set to specific value (not ideal)
- ✅ Using gpt-4.1-mini
- ✅ Temperature: 0.6 (appropriate)

### General Recommendations:

1. **All Routes:** Review max_tokens settings
   - Some: `NOT SET` (correct - model stops naturally)
   - Some: Specific values like `1500`, `2000`, `6000`
   - Consider: Remove explicit max_tokens for most flexible responses

2. **All Routes:** Add caching for read-heavy endpoints
   - **Current:** Only `deep/route.ts` has 7-day cache
   - **Suggested:** Add 3-7 day cache to:
     - audience/route.ts
     - momentum/route.ts
     - content-intelligence/route.ts

3. **Script Generation:** Add cost tracking
   - **Current:** No tracking of tokens used
   - **Issue:** 3-stage pipeline uses lots of tokens
   - **Suggestion:** Log token usage at each stage

---

## 📈 PERFORMANCE NOTES {#performance-notes}

### Slow Operations:

1. **analyzeChannel.ts**
   - **Wait time:** 2-5 minutes logged in code
   - **Reason:** Large prompt (~4000 chars) + detailed response expected
   - **Optimization:** None needed (expected behavior)

2. **scripts/generate/route.ts (3-stage pipeline)**
   - **Wait time:** Unknown (sum of 3 sequential calls)
   - **Recommendation:** Consider parallel execution for stages 1-2 if independent

3. **comments-orchestrator.ts (parallel calls)**
   - **Calls:** 13 concurrent OpenAI requests
   - **Risk:** Rate limiting potential
   - **Mitigation:** No explicit rate limiting in code; depends on OpenAI API limits

---

## 🔐 SECURITY NOTES {#security-notes}

### API Key Handling:

All files use consistent pattern:
```typescript
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
```

**Status:** ✅ Environment variable (not hardcoded)

### User Data in Prompts:

**Risk:** Channel titles, video data, comment content sent to OpenAI

**Mitigation:**
- All API calls require auth (`getServerSession`)
- User isolation: Each user sees only their channels
- Channel data marked as non-sensitive (publicly available YouTube data)

**⚠️ Note:** Comments are user-generated content; may include private thoughts; sent to OpenAI third-party API

---

## 🎯 SUMMARY TABLE {#summary-table}

### All 22+ GPT Calls Quick Reference:

| # | File | Function | Model | Format | Risks | Status |
|---|------|----------|-------|--------|-------|--------|
| 1 | comments/insights/route.ts | POST | gpt-4.1-mini | JSON | Array fallback | ✅ Logging |
| 2 | analyzeChannel.ts | analyzeChannel | gpt-4.1-mini | JSON (strict) | Structure validation | ✅ Complete |
| 3 | scripts/generate/route.ts | generateSemanticMap | gpt-4.1-mini | JSON | Markdown cleaning | ✅ Fallback |
| 4 | scripts/generate/route.ts | generateNarrativeSkeleton | gpt-4.1-mini | JSON | Parsing errors | ✅ Fallback |
| 5 | scripts/generate/route.ts | generateScriptFromSkeleton | gpt-4.1-mini | Markdown | Timing format | ⚠️ Monitor |
| 6 | audience/route.ts | POST | gpt-4.1-mini | JSON | Field names | ✅ Validation |
| 7 | momentum/route.ts | POST | gpt-4.1-mini | JSON | Array format | ✅ Standard |
| 8 | deep/route.ts | POST | gpt-4.1-mini | JSON | Cached 7d | ✅ Caching |
| 9 | content-intelligence/route.ts | POST | gpt-4.1-mini | Hybrid | Marker split | 🔴 CRITICAL |
| 10 | emotional-overview.ts | generateEmotionalOverview | gpt-4.1-mini | Text | Length <500 | ✅ Retry 3x |
| 11-20 | comments-modules/*.ts | Various | gpt-4.1-mini | JSON/Text | Fallbacks | ✅ All have |
| 21 | comments-analysis.ts | generateDeepAnalysis | gpt-4.1-mini | JSON (strict) | Structure | ✅ Type safety |
| 22 | competitors/compare/ai/route.ts | POST | gpt-4.1-mini | JSON (strict) | Field names | ✅ Standard |

---

## 📌 KEY FINDINGS {#key-findings}

### ✅ What's Working Well:

1. **Consistent Model:** All calls use gpt-4.1-mini (no version fragmentation)
2. **Validation Strategy:** Most calls have fallback mechanisms
3. **Error Handling:** Try-catch blocks in critical paths
4. **Logging:** Detailed console logs for debugging
5. **Retry Logic:** Comment modules have exponential backoff (3 attempts)
6. **Type Safety:** TypeScript interfaces for most structures
7. **Authentication:** All routes protected with session validation

### ⚠️ Areas to Monitor:

1. **Content Intelligence Marker:** `__TABLES_JSON__` is fragile separator
2. **Parallel Execution:** 13 concurrent calls may hit rate limits
3. **Long Prompts:** analyzeChannel.ts is 4000+ chars
4. **Markdown Parsing:** Script generation relies on specific format
5. **Cache Expiry:** Only deep/route.ts has caching; others regenerate every call

### 🔴 Critical Improvements Needed:

1. **Content Intelligence:** Add fallback if marker missing
2. **Script Generation:** Make timing format more flexible
3. **Rate Limiting:** Add explicit rate limit handling for parallel calls
4. **Monitoring:** Add token usage tracking for cost management

---

## 📚 REFERENCES {#references}

### Related Files (not detailed above):

- `src/lib/ai/comments-orchestrator.ts` - Orchestrates 13 parallel analyses
- `src/types/scripts.ts` - TypeScript definitions for script types
- `src/components/channel/SWOTAnalysisBlock.tsx` - SWOT display component
- `src/components/channel/DeepCommentAnalysisSection.tsx` - Deep analysis display

### API Documentation:

- OpenAI Chat Completions: https://platform.openai.com/docs/api-reference/chat/create
- Response Format: JSON mode requires `response_format: { type: "json_object" }`
- Model: gpt-4.1-mini is deprecated; consider migration to latest

---

**Report Generated:** 2025-12-11
**Status:** ANALYSIS ONLY - NO CODE CHANGES
**Recommendation:** Review critical risks section before production deployment
