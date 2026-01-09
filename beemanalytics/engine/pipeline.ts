/**
 * AI Engine Pipeline
 * Трёхэтапный pipeline для генерации контента
 * Stage 1: Text → Semantic Map (анализ)
 * Stage 2: Semantic Map → Narrative Skeleton (структура)
 * Stage 3: Skeleton → Generated Script (финальный контент)
 */

import OpenAI from "openai";
import {
  SemanticMap,
  NarrativeSkeleton,
  GeneratedScript,
  PipelineInput,
  PipelineOutput,
  OpenAIConfig,
} from "./types";
import {
  SEMANTIC_MAP_SYSTEM_PROMPT,
  SEMANTIC_MAP_USER_PROMPT,
  NARRATIVE_SKELETON_SYSTEM_PROMPT,
  NARRATIVE_SKELETON_USER_PROMPT,
  SCRIPT_GENERATOR_SYSTEM_PROMPT,
  SCRIPT_GENERATOR_USER_PROMPT,
} from "./prompts";

/**
 * Чистит JSON из markdown-обёрток и парсит
 */
function parseJSON<T>(responseText: string): T {
  const cleanJson = responseText
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  return JSON.parse(cleanJson);
}

/**
 * STAGE 1: Генерация Semantic Map
 * Input: текст
 * Output: структурированная семантическая карта
 */
async function stage1_generateSemanticMap(
  text: string,
  openai: OpenAI
): Promise<SemanticMap> {
  console.log("[Stage 1] Генерируем Semantic Map...");

  const completion = await openai.chat.completions.create({
    model: "gpt-4-mini",
    messages: [
      { role: "system", content: SEMANTIC_MAP_SYSTEM_PROMPT },
      { role: "user", content: SEMANTIC_MAP_USER_PROMPT(text) },
    ],
    temperature: 0.7,
  });

  const responseText = completion.choices[0]?.message?.content;
  if (!responseText) {
    throw new Error("Empty response from OpenAI at Stage 1");
  }

  const semanticMap = parseJSON<SemanticMap>(responseText);

  // Валидируем структуру
  const validated: SemanticMap = {
    mergedTopics: Array.isArray(semanticMap.mergedTopics)
      ? semanticMap.mergedTopics
      : [],
    commonPatterns: Array.isArray(semanticMap.commonPatterns)
      ? semanticMap.commonPatterns
      : [],
    conflicts: Array.isArray(semanticMap.conflicts) ? semanticMap.conflicts : [],
    paradoxes: Array.isArray(semanticMap.paradoxes) ? semanticMap.paradoxes : [],
    emotionalSpikes: Array.isArray(semanticMap.emotionalSpikes)
      ? semanticMap.emotionalSpikes
      : [],
    visualMotifs: Array.isArray(semanticMap.visualMotifs)
      ? semanticMap.visualMotifs
      : [],
    audienceInterests: Array.isArray(semanticMap.audienceInterests)
      ? semanticMap.audienceInterests
      : [],
    rawSummary: typeof semanticMap.rawSummary === "string" ? semanticMap.rawSummary : "",
  };

  console.log(`[Stage 1] ✓ Semantic Map создана`);
  return validated;
}

/**
 * STAGE 2: Генерация Narrative Skeleton
 * Input: Semantic Map
 * Output: каркас сценария
 */
async function stage2_generateNarrativeSkeleton(
  semanticMap: SemanticMap,
  openai: OpenAI
): Promise<NarrativeSkeleton> {
  console.log("[Stage 2] Генерируем Narrative Skeleton...");

  const completion = await openai.chat.completions.create({
    model: "gpt-4-mini",
    messages: [
      { role: "system", content: NARRATIVE_SKELETON_SYSTEM_PROMPT },
      { role: "user", content: NARRATIVE_SKELETON_USER_PROMPT(semanticMap) },
    ],
    temperature: 0.8,
  });

  const responseText = completion.choices[0]?.message?.content;
  if (!responseText) {
    throw new Error("Empty response from OpenAI at Stage 2");
  }

  const skeleton = parseJSON<NarrativeSkeleton>(responseText);

  // Валидируем структуру
  const validated: NarrativeSkeleton = {
    coreIdea: typeof skeleton.coreIdea === "string" ? skeleton.coreIdea : "",
    centralParadox:
      typeof skeleton.centralParadox === "string" ? skeleton.centralParadox : "",
    mainConflict:
      typeof skeleton.mainConflict === "string" ? skeleton.mainConflict : "",
    mainQuestion:
      typeof skeleton.mainQuestion === "string" ? skeleton.mainQuestion : "",
    emotionalBeats: Array.isArray(skeleton.emotionalBeats)
      ? skeleton.emotionalBeats
      : [],
    storyBeats: Array.isArray(skeleton.storyBeats) ? skeleton.storyBeats : [],
    visualMotifs: Array.isArray(skeleton.visualMotifs)
      ? skeleton.visualMotifs
      : semanticMap.visualMotifs,
    hookCandidates: Array.isArray(skeleton.hookCandidates)
      ? skeleton.hookCandidates
      : [],
    endingIdeas: Array.isArray(skeleton.endingIdeas) ? skeleton.endingIdeas : [],
  };

  console.log(`[Stage 2] ✓ Narrative Skeleton создан`);
  return validated;
}

/**
 * STAGE 3: Генерация финального сценария
 * Input: Skeleton + Semantic Map
 * Output: готовый контент
 */
async function stage3_generateScript(
  skeleton: NarrativeSkeleton,
  semanticMap: SemanticMap,
  openai: OpenAI
): Promise<GeneratedScript> {
  console.log("[Stage 3] Генерируем финальный сценарий...");

  const completion = await openai.chat.completions.create({
    model: "gpt-4-mini",
    messages: [
      { role: "system", content: SCRIPT_GENERATOR_SYSTEM_PROMPT },
      {
        role: "user",
        content: SCRIPT_GENERATOR_USER_PROMPT(skeleton, semanticMap),
      },
    ],
    temperature: 0.85,
  });

  const responseText = completion.choices[0]?.message?.content;
  if (!responseText) {
    throw new Error("Empty response from OpenAI at Stage 3");
  }

  const script = parseJSON<GeneratedScript>(responseText);

  // Валидируем обязательные поля
  if (!script.title || !script.hook || !script.outline || !script.scriptText) {
    throw new Error("Incomplete script: missing required fields");
  }

  const validated: GeneratedScript = {
    title: typeof script.title === "string" ? script.title : "",
    hook: typeof script.hook === "string" ? script.hook : "",
    outline: Array.isArray(script.outline) ? script.outline : [],
    scriptText: typeof script.scriptText === "string" ? script.scriptText : "",
    whyItShouldWork:
      typeof script.whyItShouldWork === "string"
        ? script.whyItShouldWork
        : "Script based on semantic analysis",
  };

  console.log(`[Stage 3] ✓ Финальный сценарий создан`);
  return validated;
}

/**
 * ГЛАВНАЯ ФУНКЦИЯ: Запуск полного pipeline
 * Input: текст (транскрипт, статья, идея)
 * Output: полный результат (3 стадии + метаданные)
 */
export async function runPipeline(
  input: PipelineInput,
  config: OpenAIConfig
): Promise<PipelineOutput> {
  const startTime = Date.now();

  console.log("\n════════════════════════════════════════════════════════════");
  console.log("🚀 CONTENT GENERATION ENGINE STARTED");
  console.log("════════════════════════════════════════════════════════════\n");

  const openai = new OpenAI({ apiKey: config.apiKey });

  try {
    // Stage 1
    console.log(`📝 Input length: ${input.text.length} characters\n`);
    const semanticMap = await stage1_generateSemanticMap(input.text, openai);

    // Stage 2
    console.log();
    const narrativeSkeleton = await stage2_generateNarrativeSkeleton(
      semanticMap,
      openai
    );

    // Stage 3
    console.log();
    const generatedScript = await stage3_generateScript(
      narrativeSkeleton,
      semanticMap,
      openai
    );

    const totalTime = Date.now() - startTime;

    console.log("\n════════════════════════════════════════════════════════════");
    console.log("✅ PIPELINE COMPLETED SUCCESSFULLY");
    console.log(`⏱️  Total time: ${(totalTime / 1000).toFixed(2)}s`);
    console.log("════════════════════════════════════════════════════════════\n");

    return {
      input: {
        text: input.text.substring(0, 200) + (input.text.length > 200 ? "..." : ""),
        length: input.text.length,
      },
      stages: {
        semanticMap,
        narrativeSkeleton,
        generatedScript,
      },
      metadata: {
        timestamp: Date.now(),
        model: config.model,
        totalTime,
      },
    };
  } catch (error) {
    console.error("\n❌ PIPELINE FAILED");
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Standalone функции для отдельных стадий (если нужно)
 */
export async function generateSemanticMapOnly(
  text: string,
  apiKey: string
): Promise<SemanticMap> {
  const openai = new OpenAI({ apiKey });
  return stage1_generateSemanticMap(text, openai);
}

export async function generateSkeletonOnly(
  semanticMap: SemanticMap,
  apiKey: string
): Promise<NarrativeSkeleton> {
  const openai = new OpenAI({ apiKey });
  return stage2_generateNarrativeSkeleton(semanticMap, openai);
}

export async function generateScriptOnly(
  skeleton: NarrativeSkeleton,
  semanticMap: SemanticMap,
  apiKey: string
): Promise<GeneratedScript> {
  const openai = new OpenAI({ apiKey });
  return stage3_generateScript(skeleton, semanticMap, openai);
}
