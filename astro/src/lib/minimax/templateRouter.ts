/**
 * Template Router - выбирает оптимальный MiniMax Video Agent Template
 * Использует GPT-4o-mini для анализа prompt'а и картинки
 */

import { notifyAdmin } from '../telegramNotifier';

interface TemplateRouterResult {
  template_id: string;
  template_name: string;
  text_inputs: Record<string, string>;
  final_prompt: string;
}

/**
 * Вызывает OpenAI GPT-4o-mini для выбора шаблона
 */
export async function routeToTemplate(
  userPrompt: string,
  imageDescription: string
): Promise<TemplateRouterResult> {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('[TEMPLATE_ROUTER] OPENAI_API_KEY не установлен');
      throw new Error('OpenAI API key not configured');
    }

    const systemPrompt = `You are MiniMax Video Template Router.

Your job is to select the best MiniMax Video Agent Template
for a given user request and image.

You must always choose ONE template.
Never return "none".
If no template is perfect, choose the closest and safest one.

You receive:
1) user_prompt (string)
2) image_description (short caption of what is in the image)

You must output ONLY valid JSON in this exact format:

{
  "template_id": "string",
  "template_name": "string",
  "reason": "short explanation",
  "text_inputs": {
     "...": "..."
  },
  "final_prompt": "English cinematic instruction for the video"
}

RULES:

You must choose from this list ONLY:

Diving → 392747428568649728
Run for Life → 393769180141805569
Transformers → 397087679467597833
Still Rings → 393881433990066176
Weightlifting → 393498001241890824
Climbing → 393488336655310850
Anime Life Sim → 394514820878671878
McDonald's Delivery Pet → 393879757702918151
Pet Pilot → 397017167949312007
Miniature Set Ad → 394176968202485769
Male Model Try-On → 393876118804459526
Female Model Try-On → 393866076583718914
Art Fonts → 394875727173492739
Drinkfall → 394220989629177861
E-commerce Display → 393853165953970178
3D Character Product → 401431836934868999

Selection logic:

- If image is clothing → Male or Female Try-On
- If product → Miniature Set, Drinkfall, E-commerce Display
- If animal → Pet templates
- If person → sport / model / action
- If car → Transformers
- If creative / anime / fictional → Anime Life Sim or 3D Character

The goal is always to produce the MOST VISUALLY ATTRACTIVE video.

Never mention MiniMax in final_prompt.
Write final_prompt in cinematic English.

Do not include markdown.
Return JSON only.`;

    const userMessage = `user_prompt: "${userPrompt}"
image_description: "${imageDescription}"`;

    console.log('[TEMPLATE_ROUTER] Calling OpenAI GPT-4o-mini...');
    console.log('[TEMPLATE_ROUTER] user_prompt:', userPrompt);
    console.log('[TEMPLATE_ROUTER] image_description:', imageDescription);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: userMessage,
          },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[TEMPLATE_ROUTER] OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = (await response.json()) as any;
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error('[TEMPLATE_ROUTER] No content in OpenAI response:', data);
      throw new Error('No content in OpenAI response');
    }

    console.log('[TEMPLATE_ROUTER] OpenAI response:', content);

    // Парсим JSON из ответа
    let result: TemplateRouterResult;
    try {
      result = JSON.parse(content);
    } catch (parseError) {
      console.error('[TEMPLATE_ROUTER] Failed to parse JSON:', content);
      throw new Error('Failed to parse template router response');
    }

    // Валидируем результат
    if (!result.template_id || !result.template_name || !result.final_prompt) {
      console.error('[TEMPLATE_ROUTER] Invalid result structure:', result);
      throw new Error('Invalid template router result');
    }

    console.log('[TEMPLATE_ROUTER] ✅ Template selected:', result.template_name, `(${result.template_id})`);

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[TEMPLATE_ROUTER] Error:', errorMessage);
    await notifyAdmin('TEMPLATE_ROUTER', errorMessage);
    throw error;
  }
}
