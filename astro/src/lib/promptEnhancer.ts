/**
 * Smart Prompt Enhancer - улучшает промпты через GPT-4o-mini
 *
 * Поддерживает два режима:
 * 1. Template mode (TEMPLATE): фокус на описании сцены, минимум деталей движения
 * 2. Prompt mode (PROMPT): максимум деталей движения и кинематографии
 *
 * Переводит пользовательский промпт на английский и расширяет его
 * деталями в зависимости от режима генерации
 */

import { notifyAdmin } from './telegramNotifier';

/**
 * Улучшить промпт через GPT-4o-mini ДЛЯ TEMPLATE MODE
 *
 * Для шаблонного режима фокусируемся на описании сцены и намерении,
 * минимизируем детали движения (т.к. шаблон сам контролирует движения)
 *
 * @param userPrompt - исходный промпт от пользователя
 * @returns улучшенный английский промпт для MiniMax (сцена-ориентированный)
 */
async function enhancePromptForTemplate(userPrompt: string): Promise<string> {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn('[SMART_PROMPT:TEMPLATE] OpenAI API key not configured, returning original prompt');
      return userPrompt;
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a commercial scene descriptor. Your task is to convert user input into a concise English description of a commercial scene for an AI video template.

⚠️ IMPORTANT: This is for TEMPLATE MODE
- The template will handle all camera movements and animations
- Focus ONLY on: what is in the scene, who is doing it, the mood and atmosphere
- DO NOT describe camera movement details (template controls this)
- DO NOT describe specific motion sequences (template controls this)
- DO describe: subject, clothing, environment, lighting mood, commercial intent

Guidelines:
- Translate to English if needed
- Keep description concise but vivid
- Describe the subject, setting, atmosphere, professional look
- Include commercial/advertising style elements
- Return ONLY the enhanced prompt text, nothing else
- Make it suitable for template-based video generation

Start immediately without preamble.`,
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[SMART_PROMPT:TEMPLATE] OpenAI API error:', errorData);
      console.warn('[SMART_PROMPT:TEMPLATE] Returning original prompt due to API error');
      return userPrompt;
    }

    const data = (await response.json()) as any;
    const enhancedPrompt = data.choices?.[0]?.message?.content?.trim() || userPrompt;

    console.log('[SMART_PROMPT:TEMPLATE] 🎬 Enhanced for template mode');
    console.log(`[SMART_PROMPT:TEMPLATE]   input:  "${userPrompt}"`);
    console.log(`[SMART_PROMPT:TEMPLATE]   output: "${enhancedPrompt}"`);

    return enhancedPrompt;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[SMART_PROMPT:TEMPLATE] Error enhancing prompt:', error);
    console.warn('[SMART_PROMPT:TEMPLATE] Returning original prompt due to error');
    await notifyAdmin('GPT_ENHANCE_TEMPLATE', errorMessage);
    return userPrompt;
  }
}

/**
 * Улучшить промпт через GPT-4o-mini ДЛЯ PROMPT MODE
 *
 * Для свободного режима максимизируем детали движения, кинематографии,
 * камеры и атмосферы - это даст MiniMax больше информации для генерации
 *
 * @param userPrompt - исходный промпт от пользователя
 * @returns улучшенный английский промпт для MiniMax (движение-ориентированный)
 */
async function enhancePromptForPrompt(userPrompt: string): Promise<string> {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn('[SMART_PROMPT:PROMPT] OpenAI API key not configured, returning original prompt');
      return userPrompt;
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a cinematic advertising video prompt enhancer. Your task is to convert user input into a detailed, professional English prompt for a high-quality AI-generated commercial video.

✨ IMPORTANT: This is for PROMPT MODE (free-form generation)
- User's description will be the PRIMARY control (not a template)
- Maximize all details: movements, camera work, lighting, effects
- Add cinematic techniques that enhance the scene
- Be specific about motion and camera choreography

Guidelines:
- Translate to English if needed
- Add cinematic details: camera movement, angles, speed, focus, depth-of-field
- Describe movement, actions, transitions, and atmosphere vividly
- Include lighting mood, color grading, effects, professional style
- Describe motion sequences in detail (this drives the AI generation)
- Keep the original meaning and intent from user
- Return ONLY the enhanced prompt text, nothing else (no JSON, explanations, or quotes)
- Make it specific and detailed for AI video generation

Start enhancing immediately without preamble.`,
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[SMART_PROMPT:PROMPT] OpenAI API error:', errorData);
      console.warn('[SMART_PROMPT:PROMPT] Returning original prompt due to API error');
      return userPrompt;
    }

    const data = (await response.json()) as any;
    const enhancedPrompt = data.choices?.[0]?.message?.content?.trim() || userPrompt;

    console.log('[SMART_PROMPT:PROMPT] ✏️ Enhanced for prompt mode');
    console.log(`[SMART_PROMPT:PROMPT]   input:  "${userPrompt}"`);
    console.log(`[SMART_PROMPT:PROMPT]   output: "${enhancedPrompt}"`);

    return enhancedPrompt;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[SMART_PROMPT:PROMPT] Error enhancing prompt:', error);
    console.warn('[SMART_PROMPT:PROMPT] Returning original prompt due to error');
    await notifyAdmin('GPT_ENHANCE_PROMPT', errorMessage);
    return userPrompt;
  }
}

/**
 * Главная функция для улучшения промпта
 *
 * Выбирает подходящий enhancer в зависимости от режима генерации
 *
 * @param userPrompt - исходный промпт от пользователя
 * @param mode - режим генерации: 'template' или 'prompt'
 * @returns улучшенный английский промпт для MiniMax
 */
export async function enhancePrompt(userPrompt: string, mode: 'template' | 'prompt' = 'template'): Promise<string> {
  if (mode === 'template') {
    return enhancePromptForTemplate(userPrompt);
  } else {
    return enhancePromptForPrompt(userPrompt);
  }
}
