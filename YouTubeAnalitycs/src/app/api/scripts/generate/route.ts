type VideoForScript = {
  id: string;
  title: string;
  channelTitle: string;
  tags?: string[];
  viewCount?: number;
  viewsPerDay?: number;
  momentumScore?: number;
  publishedAt?: number;
  // любые доп. поля, которые уже есть в БД / текущем коде, но НЕ выдумывай новых
}

export type SemanticMap = {
  mergedTopics: string[];        // объединённые темы
  commonPatterns: string[];      // повторяющиеся паттерны
  conflicts: string[];           // конфликты идей / интересов
  paradoxes: string[];           // парадоксы / противоречия
  emotionalSpikes: string[];     // эмоциональные точки / триггеры
  visualMotifs: string[];        // визуальные образы / сцены
  audienceInterests: string[];   // что явно интересно аудитории
  rawSummary: string;            // общий текстовый обзор ситуации
}

export type NarrativeSkeleton = {
  coreIdea: string;
  centralParadox: string;
  mainConflict: string;
  mainQuestion: string;
  emotionalBeats: string[];    // ключевые эмоциональные моменты
  storyBeats: string[];        // последовательность крупных блоков
  visualMotifs: string[];      // можешь частично копировать/фильтровать из SemanticMap
  hookCandidates: string[];     // 2-5 вариантов хука
  endingIdeas: string[];       // 2-3 варианта концовки
}

async function collectVideoData(selectedVideoIds: string[], userId: string): Promise<VideoForScript[]> {
  // Логика для сбора данных по видео
  return []; // Временная заглушка
}

async function generateSemanticMap(videos: VideoForScript[]): Promise<SemanticMap> {
  // 1. Подготовить компактный JSON с данными по видео (id, title, metrics, tags и т.п.)
  // 2. Сформировать промпт к OpenAI
  // 3. Вызвать openai.chat.completions/create (или то, что уже используется в проекте)
  // 4. Получить строго JSON-ответ
  // 5. Распарсить в SemanticMap
  return {
    mergedTopics: [],
    commonPatterns: [],
    conflicts: [],
    paradoxes: [],
    emotionalSpikes: [],
    visualMotifs: [],
    audienceInterests: [],
    rawSummary: ''
  }; // Временная заглушка
}

async function generateNarrativeSkeleton(map: SemanticMap): Promise<NarrativeSkeleton> {
  // Логика для генерации нарративного скелета
  // Подготовить компактный JSON с SemanticMap.
  // Сформировать промпт к OpenAI.
  return {}; // Временная заглушка
}

async function generateScriptFromSkeleton(
  skeleton: NarrativeSkeleton,
  videos: VideoForScript[]
): Promise<GeneratedScript> {
  return { script: '' } as GeneratedScript; // Временная заглушка
}

// Основной handler POST
import { NextApiRequest, NextApiResponse } from 'next/types';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { selectedVideoIds, userId } = req.body as { selectedVideoIds: string[]; userId: string };

    const videos = await collectVideoData(selectedVideoIds, userId);
    const semanticMap = await generateSemanticMap(videos);
    const narrativeSkeleton = await generateNarrativeSkeleton(semanticMap);
    const generatedScript = await generateScriptFromSkeleton(narrativeSkeleton, videos);

    // Сохранение сценария в БД
    // Здесь должна быть логика для сохранения сценария в базу данных
    // Возврат ответа
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
