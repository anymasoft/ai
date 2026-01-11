/**
 * Smart Prompt Enhancer - улучшает промпты через GPT-4o-mini
 *
 * Переводит пользовательский промпт на английский,
 * расширяет его кинематографическими деталями
 * и возвращает финальный промпт для MiniMax
 */

/**
 * Улучшить промпт через GPT-4o-mini
 *
 * @param userPrompt - исходный промпт от пользователя (может быть на любом языке)
 * @returns улучшенный английский промпт для MiniMax
 */
export async function enhancePrompt(userPrompt: string): Promise<string> {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn('[SMART_PROMPT] OpenAI API key not configured, returning original prompt');
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
            content: `You are a cinematic advertising video prompt enhancer. Your task is to convert user input into a detailed, professional English prompt for a high-quality commercial video.

Guidelines:
- Translate to English if needed
- Add cinematic details: camera movement, lighting, colors, mood
- Include professional commercial/advertising style elements
- Describe movement, actions, and atmosphere vividly
- Keep the original meaning and intent
- Return ONLY the enhanced prompt text, nothing else (no JSON, no explanations, no quotes)
- Make it suitable for AI video generation

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
      console.error('[SMART_PROMPT] OpenAI API error:', errorData);
      console.warn('[SMART_PROMPT] Returning original prompt due to API error');
      return userPrompt;
    }

    const data = (await response.json()) as any;
    const enhancedPrompt = data.choices?.[0]?.message?.content?.trim() || userPrompt;

    console.log('[SMART_PROMPT] Enhanced: input="${userPrompt}" → output="${enhancedPrompt}"');

    return enhancedPrompt;
  } catch (error) {
    console.error('[SMART_PROMPT] Error enhancing prompt:', error);
    console.warn('[SMART_PROMPT] Returning original prompt due to error');
    return userPrompt;
  }
}
