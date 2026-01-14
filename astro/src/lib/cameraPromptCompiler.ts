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
 *   - Добавляет только ВАЛИДНЫЕ MiniMax camera commands
 *   - Гарантирует что MiniMax поймет требуемые движения камеры
 *   - Результат: prompt_director (готовый для MiniMax)
 *   - Постобработка: sanitizeCameraCommands() удаляет невалидные команды
 */

import { notifyAdmin } from './telegramNotifier';

/**
 * Валидный список MiniMax camera commands (15 команд)
 */
const VALID_CAMERA_COMMANDS = [
  'Truck left',
  'Truck right',
  'Pan left',
  'Pan right',
  'Push in',
  'Pull out',
  'Pedestal up',
  'Pedestal down',
  'Tilt up',
  'Tilt down',
  'Zoom in',
  'Zoom out',
  'Shake',
  'Tracking shot',
  'Static shot',
];

/**
 * Санитайзер команд камеры - удаляет невалидные команды
 * Проверяет каждую команду в квадратных скобках против белого списка
 *
 * @param text - промпт с возможно невалидными командами
 * @returns промпт с только валидными командами
 */
function sanitizeCameraCommands(text: string): {
  sanitized: string;
  removedCommands: string[];
} {
  const removedCommands: string[] = [];

  // Регулярное выражение для поиска всех [...] блоков
  const commandRegex = /\[([^\]]+)\]/g;
  let sanitized = text;
  const matches = Array.from(text.matchAll(commandRegex));

  for (const match of matches) {
    const fullCommand = match[0]; // вся команда с скобками: "[Pan left]"
    const innerText = match[1]; // текст внутри: "Pan left"

    // Проверяем, является ли это комбинацией команд через запятую
    const parts = innerText.split(',').map(p => p.trim());
    const validParts = parts.filter(part => VALID_CAMERA_COMMANDS.includes(part));

    if (validParts.length === 0) {
      // Ни одна часть не валидна - удаляем всю команду
      removedCommands.push(fullCommand);
      sanitized = sanitized.replace(fullCommand, '');
    } else if (validParts.length < parts.length) {
      // Некоторые части невалидны - заменяем на только валидные части
      const newCommand = `[${validParts.join(',')}]`;
      const invalidParts = parts.filter(part => !VALID_CAMERA_COMMANDS.includes(part));
      removedCommands.push(...invalidParts.map(p => `[${p}]`));
      sanitized = sanitized.replace(fullCommand, newCommand);
    }
    // Если все части валидны - оставляем как есть
  }

  // Очищаем лишние пробелы
  sanitized = sanitized.replace(/\s+/g, ' ').trim();

  return { sanitized, removedCommands };
}

/**
 * Скомпилировать cinematic промпт в MiniMax-совместимый Director Prompt
 *
 * Эта функция вызывает GPT второй раз (после Smart Prompt Enhancer)
 * и добавляет только ВАЛИДНЫЕ MiniMax camera commands
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
            content: `You are a camera-control compiler for MiniMax Video.

You MUST output a single English prompt enhanced with MiniMax camera commands.

CRITICAL: You may use ONLY the following camera commands (exact spelling):
[Truck left], [Truck right],
[Pan left], [Pan right],
[Push in], [Pull out],
[Pedestal up], [Pedestal down],
[Tilt up], [Tilt down],
[Zoom in], [Zoom out],
[Shake],
[Tracking shot],
[Static shot]

⚠️ CRITICAL PRESERVATION RULES:
If the input contains a "PRESERVE: ..." section, you MUST:
- Copy it VERBATIM to the final output
- Keep it at the VERY END of the prompt (after all camera commands)
- DO NOT modify, translate, rephrase, or split it
- DO NOT insert camera commands inside or near the PRESERVE section
- DO NOT remove or shorten it

Example:
Input: "Professional scene with dynamic lighting. PRESERVE: all text elements unchanged, background stable"
Output: "[Static shot] Professional scene with dynamic lighting and commercial atmosphere, [Push in] highlighting key details. PRESERVE: all text elements unchanged, background stable"

FORBIDDEN when PRESERVE section exists:
- Removing the PRESERVE section
- Modifying any part of "PRESERVE: ..." text
- Adding camera commands that contradict preservation (e.g., [Shake] when "background stable" is preserved)
- Translating or rephrasing constraints

Valid camera commands rules:
- Insert camera commands inline exactly where motion happens
- Use 2–6 total commands per prompt (not more)
- Combine at most 3 commands in one bracket (e.g. [Pan right,Push in])
- Prefer explicit commands over plain language camera descriptions

Forbidden:
- Any other bracket commands
- Film terminology like [Close-up], [Mid-shot], [Low-angle], [Slow motion], [Soft focus]
- Any explanation text

Rules:
- Preserve the original meaning and sequence of events
- If input has "PRESERVE: ...", copy it unchanged to the end
- Return ONLY the final prompt text

Return ONLY the final prompt text.`,
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
    const directorPromptRaw = data.choices?.[0]?.message?.content?.trim() || cinematicPrompt;

    // ПОСТОБРАБОТКА: Санитайзер удаляет невалидные команды
    const { sanitized: directorPrompt, removedCommands } = sanitizeCameraCommands(directorPromptRaw);

    console.log('[DIRECTOR] 🎥 Camera commands compiled');
    console.log(`[DIRECTOR] cinematic:\n${cinematicPrompt}`);
    console.log(`[DIRECTOR] camera-enhanced (raw):\n${directorPromptRaw}`);

    if (removedCommands.length > 0) {
      console.log(`[DIRECTOR] sanitize: removed_invalid=[${removedCommands.join(', ')}]`);
    } else {
      console.log('[DIRECTOR] sanitize: no invalid commands found');
    }

    console.log(`[DIRECTOR] final_prompt_to_minimax:\n${directorPrompt}`);

    return directorPrompt;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[DIRECTOR] Error compiling camera commands:', error);
    console.warn('[DIRECTOR] Returning cinematic prompt due to error');
    await notifyAdmin('GPT_CAMERA_COMPILER', errorMessage);
    return cinematicPrompt;
  }
}
