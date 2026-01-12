/**
 * Camera Prompt Compiler - компилирует кинематографические промпты в MiniMax-совместимые с camera commands
 *
 * Это ФАЗА 2 двухфазной системы Prompt Engine для режима "Свободный сценарий".
 *
 * Фаза 1 (Smart Prompt Enhancer):
 *   - Берет пользовательский текст
 *   - Расширяет его кинематографическими деталями
 *   - Результат: prompt_cinematic
 *
 * Фаза 2 (этот файл):
 *   - Берет prompt_cinematic из Фазы 1
 *   - Добавляет явные MiniMax camera commands: [Tracking shot], [Push in], etc.
 *   - Гарантирует что MiniMax поймет требуемые движения камеры
 *   - Результат: prompt_director (готовый для MiniMax)
 */

/**
 * Скомпилировать cinematic промпт в MiniMax-совместимый Director Prompt
 *
 * Эта функция вызывает GPT второй раз (после Smart Prompt Enhancer)
 * и добавляет явные MiniMax camera commands в правильные места
 *
 * @param cinematicPrompt - результат ФАЗЫ 1 (prompt_cinematic)
 * @returns MiniMax-совместимый промпт с camera commands (prompt_director)
 */
export async function compileCameraCommands(cinematicPrompt: string): Promise<string> {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn('[DIRECTOR] OpenAI API key not configured, returning cinematic prompt');
      return cinematicPrompt;
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
            content: `You are a cinematic camera director for MiniMax Video models.

Your job is to convert a cinematic video description into a MiniMax camera-controlled prompt.

Rules:
- You must preserve all meaning and story from the original prompt.
- You must add MiniMax camera commands using square brackets [].
- You must place camera commands exactly where the movement happens in the scene.
- You must use these commands when applicable:

[Tracking shot]
[Push in]
[Pull out]
[Pan left]
[Pan right]
[Tilt up]
[Tilt down]
[Zoom in]
[Zoom out]
[Pedestal up]
[Pedestal down]
[Shake]
[Static shot]

- Use at most 2–5 commands per moment.
- Combine commands when needed, e.g. [Pan left,Push in].
- Do not remove or rewrite story, only enhance it with camera control.
- DO NOT explain anything.
- Return ONLY the final MiniMax-ready prompt.`,
          },
          {
            role: 'user',
            content: cinematicPrompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 600,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[DIRECTOR] OpenAI API error:', errorData);
      console.warn('[DIRECTOR] Returning cinematic prompt due to API error');
      return cinematicPrompt;
    }

    const data = (await response.json()) as any;
    const directorPrompt = data.choices?.[0]?.message?.content?.trim() || cinematicPrompt;

    console.log('[DIRECTOR] 🎥 Camera commands compiled');
    console.log(`[DIRECTOR] cinematic:\n${cinematicPrompt}`);
    console.log(`[DIRECTOR] camera-enhanced:\n${directorPrompt}`);

    return directorPrompt;
  } catch (error) {
    console.error('[DIRECTOR] Error compiling camera commands:', error);
    console.warn('[DIRECTOR] Returning cinematic prompt due to error');
    return cinematicPrompt;
  }
}
