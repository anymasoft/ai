# AI Content Generation Engine

Чистый, изолированный AI pipeline для генерации контента из текста.

**Input**: Текст (транскрипт, статья, идея)
**Output**: Готовый сценарий (title, hook, outline, scriptText)

## Pipeline (3 Stages)

```
Stage 1: Text → Semantic Map
  Анализ текста, выделение тем, конфликтов, парадоксов, триггеров

Stage 2: Semantic Map → Narrative Skeleton
  Построение каркаса: структура, эмоциональные точки, хуки, концовки

Stage 3: Skeleton → Generated Script
  Создание финального контента: название, хук, план, полный текст
```

## Структура

```
engine/
├── types.ts         # Типы (SemanticMap, NarrativeSkeleton, GeneratedScript)
├── prompts.ts       # Все GPT промпты
├── pipeline.ts      # Основной двигатель (runPipeline + standalone функции)
├── runner.ts        # CLI entry point
├── examples/
│   ├── input.txt                # Пример входного текста
│   └── output_example.json      # Пример результата
└── README.md        # Этот файл
```

## Использование

### 1. Как модуль (в другом проекте)

```typescript
import { runPipeline } from "./pipeline";
import { PipelineInput, OpenAIConfig } from "./types";

const input: PipelineInput = {
  text: "Ваш текст здесь...",
  metadata: { topic: "самоулучшение" }
};

const config: OpenAIConfig = {
  apiKey: process.env.OPENAI_API_KEY,
  model: "gpt-4-mini",
  temperatureMap: 0.7,
  temperatureSkeleton: 0.8,
  temperatureScript: 0.85,
};

const result = await runPipeline(input, config);
console.log(result.stages.generatedScript.title);
console.log(result.stages.generatedScript.scriptText);
```

### 2. Как CLI

```bash
# Из файла
npx tsx runner.ts input.txt

# Из stdin
cat input.txt | npx tsx runner.ts

# Экспортировать из stdout
npx tsx runner.ts input.txt > result.json
```

Результат:
- `output_TIMESTAMP.json` — полный результат (3 стадии)
- `output_TIMESTAMP.md` — финальный сценарий в Markdown

### 3. Отдельные стадии

```typescript
import {
  generateSemanticMapOnly,
  generateSkeletonOnly,
  generateScriptOnly,
} from "./pipeline";

const map = await generateSemanticMapOnly(text, apiKey);
const skeleton = await generateSkeletonOnly(map, apiKey);
const script = await generateScriptOnly(skeleton, map, apiKey);
```

## Типы данных

### Input
```typescript
type PipelineInput = {
  text: string;
  metadata?: {
    language?: string;
    topic?: string;
    targetAudience?: string;
  };
};
```

### Output (каждая стадия)
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

type GeneratedScript = {
  title: string;
  hook: string;
  outline: string[];
  scriptText: string;
  whyItShouldWork: string;
};
```

## Примеры

Смотри папку `examples/`:
- `input.txt` — реальный пример текста (о смене карьеры)
- `output_example.json` — ожидаемый выход

Запусти:
```bash
npm install typescript tsx openai
npx tsx runner.ts examples/input.txt
```

## Переносимость

Этот engine специально разработан для переноса в Python:

1. **Нет зависимостей от видео/БД** — только текст
2. **Чистые типы данных** — легко конвертировать в Python classes
3. **Все промпты в отдельном файле** — просто переводите в Python
4. **Три независимые функции** — легко переписать для OpenAI API в Python

### Python порт

Структура будет аналогична:

```python
from types import SemanticMap, NarrativeSkeleton, GeneratedScript
from prompts import (
    SEMANTIC_MAP_SYSTEM_PROMPT,
    NARRATIVE_SKELETON_SYSTEM_PROMPT,
    SCRIPT_GENERATOR_SYSTEM_PROMPT
)
from pipeline import runPipeline, generateSemanticMapOnly

# Использование
result = runPipeline(text, api_key)
print(result['stages']['generatedScript']['title'])
```

## Требования

- Node.js 18+
- OpenAI API key (GPT-4 Mini или выше)
- `openai` пакет (`npm install openai`)

## Переменные окружения

```bash
export OPENAI_API_KEY="sk-..."
```

## Производительность

- **Stage 1** (Semantic Map): ~10-15 сек (temperature 0.7)
- **Stage 2** (Skeleton): ~15-20 сек (temperature 0.8)
- **Stage 3** (Script): ~15-25 сек (temperature 0.85)
- **Total**: ~45-60 сек

Время зависит от длины текста и нагрузки на OpenAI API.

## Customization

### Изменить промпты
Отредактируй файл `prompts.ts` и перезагрузи pipeline.

### Изменить температуры
```typescript
const config: OpenAIConfig = {
  temperatureMap: 0.5,        // Более консервативный анализ
  temperatureSkeleton: 1.0,   // Более творческий скелет
  temperatureScript: 0.9,     // Более сбалансированный скрипт
};
```

### Изменить модель
```typescript
model: "gpt-4"  // Для более качественного выхода
model: "gpt-3.5-turbo"  // Для более быстрого, дешевого выхода
```

## Отладка

```bash
DEBUG=* npx tsx runner.ts input.txt
```

Смотри консоль для деталей каждой стадии.

## Лицензия

MIT

---

**Создано из**: BeeManAnalytics Script Generator Engine
**Очищено от**: UI, Auth, Billing, Video Analytics, Database dependencies
**Готово для**: Portability, Research, Integration
