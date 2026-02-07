/**
 * Централизованный AI-конфиг.
 *
 * Все вызовы AI проходят через функцию callAI().
 * Контроллеры НЕ обращаются к openai напрямую.
 */
import openai from "./openai.js";
import "dotenv/config";

// ---------------------------------------------------------------------------
// Конфигурация
// ---------------------------------------------------------------------------
const AI_MODEL         = process.env.OPENAI_MODEL         || "gpt-4o-mini";
const AI_MODEL_HQ      = process.env.OPENAI_MODEL_HQ      || AI_MODEL;
const HIGH_QUALITY      = process.env.HIGH_QUALITY === "true";
const AI_MAX_TOKENS     = parseInt(process.env.AI_MAX_TOKENS || "8192", 10);
const AI_TEMPERATURE    = parseFloat(process.env.AI_TEMPERATURE || "0.5");

export interface AICallOptions {
    system: string;
    user: string;
    highQuality?: boolean;
    maxTokens?: number;
    temperature?: number;
    /** Ожидаемый формат: "html" — будет strip markdown fences, "json" — JSON.parse, "text" — raw */
    format?: "html" | "json" | "text";
}

/**
 * Единая точка вызова AI. Все контроллеры используют ТОЛЬКО эту функцию.
 */
export async function callAI(opts: AICallOptions): Promise<string> {
    const useHQ = opts.highQuality ?? HIGH_QUALITY;
    const model = useHQ ? AI_MODEL_HQ : AI_MODEL;
    const maxTokens = opts.maxTokens ?? AI_MAX_TOKENS;
    const temperature = opts.temperature ?? AI_TEMPERATURE;

    console.log(`[AI] model=${model} hq=${useHQ} max_tokens=${maxTokens} temp=${temperature}`);

    const response = await openai.chat.completions.create({
        model,
        max_tokens: maxTokens,
        temperature,
        messages: [
            { role: "system", content: opts.system },
            { role: "user", content: opts.user },
        ],
    });

    let content = response.choices[0]?.message?.content || "";

    // Очистка markdown code fences
    if (opts.format === "html" || opts.format === "json") {
        content = content
            .replace(/^```[a-z]*\n?/gi, "")
            .replace(/\n?```$/g, "")
            .trim();
    }

    return content;
}

/**
 * Вызов AI с ожиданием JSON-ответа. Парсит и возвращает объект.
 * При ошибке парсинга — возвращает null.
 */
export async function callAIJSON<T = any>(opts: Omit<AICallOptions, "format">): Promise<T | null> {
    const raw = await callAI({ ...opts, format: "json" });
    try {
        // Извлечь JSON из ответа, даже если AI добавил текст вокруг
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return null;
        return JSON.parse(jsonMatch[0]) as T;
    } catch {
        console.error("[AI] JSON parse error, raw:", raw.substring(0, 200));
        return null;
    }
}

export { AI_MODEL, AI_MODEL_HQ, HIGH_QUALITY };
