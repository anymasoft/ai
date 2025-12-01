import OpenAI from "openai";

/**
 * Интерфейс данных канала для анализа
 */
export interface ChannelAnalysisInput {
  title: string;
  handle: string;
  subscriberCount: number;
  videoCount: number;
  viewCount: number;
}

/**
 * Результат AI-анализа канала
 */
export interface ChannelAnalysisResult {
  summary: string; // Краткая сводка
  strengths: string[]; // Сильные стороны
  weaknesses: string[]; // Слабые стороны
  opportunities: string[]; // Возможности
  threats: string[]; // Угрозы
  recommendations: string[]; // Рекомендации
}

/**
 * Создаёт OpenAI клиент с API ключом из переменных окружения
 */
function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured in environment variables");
  }

  return new OpenAI({ apiKey });
}

/**
 * Форматирует числа для читаемости (1000000 → 1M)
 */
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}

/**
 * Анализирует YouTube канал с помощью OpenAI GPT-4
 * Использует методологию SWOT для структурированного анализа
 */
export async function analyzeChannel(
  channelData: ChannelAnalysisInput
): Promise<ChannelAnalysisResult> {
  const client = getOpenAIClient();

  // Формируем промпт для анализа на русском языке
  const prompt = `
Проанализируй YouTube канал и предоставь детальный SWOT-анализ.

**Данные канала:**
- Название: ${channelData.title}
- Handle: @${channelData.handle}
- Подписчиков: ${formatNumber(channelData.subscriberCount)}
- Видео: ${channelData.videoCount}
- Просмотров: ${formatNumber(channelData.viewCount)}

**Задача:**
Проведи SWOT-анализ этого канала и верни результат в формате JSON:

\`\`\`json
{
  "summary": "краткая сводка о канале (2-3 предложения)",
  "strengths": ["сильная сторона 1", "сильная сторона 2", "сильная сторона 3"],
  "weaknesses": ["слабая сторона 1", "слабая сторона 2", "слабая сторона 3"],
  "opportunities": ["возможность 1", "возможность 2", "возможность 3"],
  "threats": ["угроза 1", "угроза 2", "угроза 3"],
  "recommendations": ["рекомендация 1", "рекомендация 2", "рекомендация 3"]
}
\`\`\`

**Требования:**
- Анализируй на основе доступных метрик
- Для strengths: анализируй соотношение подписчиков/просмотров, количество видео, активность
- Для weaknesses: выявляй низкую конверсию, малую частоту публикаций
- Для opportunities: предлагай стратегии роста, новые форматы
- Для threats: конкуренция, изменения алгоритмов YouTube
- Для recommendations: конкретные действия для улучшения метрик
- Отвечай ТОЛЬКО валидным JSON, без дополнительного текста
`;

  console.log("[AI] Отправка запроса к OpenAI для анализа канала:", channelData.handle);

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini", // Используем быструю и недорогую модель
      messages: [
        {
          role: "system",
          content:
            "Ты — эксперт по YouTube аналитике. Анализируешь каналы и даёшь структурированные рекомендации в формате SWOT. Всегда отвечаешь валидным JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 1500,
      response_format: { type: "json_object" }, // Требуем JSON ответ
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      throw new Error("OpenAI returned empty response");
    }

    console.log("[AI] Получен ответ от OpenAI, парсинг JSON...");

    // Парсим JSON ответ
    const analysis: ChannelAnalysisResult = JSON.parse(content);

    // Валидация структуры ответа
    if (
      !analysis.summary ||
      !Array.isArray(analysis.strengths) ||
      !Array.isArray(analysis.weaknesses) ||
      !Array.isArray(analysis.opportunities) ||
      !Array.isArray(analysis.threats) ||
      !Array.isArray(analysis.recommendations)
    ) {
      throw new Error("Invalid analysis structure from OpenAI");
    }

    console.log("[AI] Анализ успешно завершён:", {
      summary: analysis.summary.slice(0, 50) + "...",
      itemsCount: {
        strengths: analysis.strengths.length,
        weaknesses: analysis.weaknesses.length,
        opportunities: analysis.opportunities.length,
        threats: analysis.threats.length,
        recommendations: analysis.recommendations.length,
      },
    });

    return analysis;
  } catch (error) {
    console.error("[AI] Ошибка при анализе канала:", error);

    if (error instanceof Error) {
      throw new Error(`AI analysis failed: ${error.message}`);
    }

    throw new Error("AI analysis failed with unknown error");
  }
}
