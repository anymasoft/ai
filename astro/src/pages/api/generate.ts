import type { APIRoute } from 'astro';
import { getUserFromSession } from '../../lib/auth';
import { getDb } from '../../lib/db';
import {
  getUserImagePath,
  userImageExists,
  ensureUserStorageDir,
} from '../../lib/minimax/storage';
import { enqueueGeneration, getQueueSize } from '../../lib/minimax/queue';
import { processQueue } from '../../lib/minimax/processor';
import { enhancePrompt } from '../../lib/promptEnhancer';
import { routeToTemplate } from '../../lib/minimax/templateRouter';

interface GenerateRequest {
  prompt: string;
  duration: number;
  mode?: 'template' | 'prompt';
}

/**
 * Создает запись генерации с промптом и статусом 'queued'
 * Сохраняет оба промпта: пользовательский и улучшенный
 * Также сохраняет данные Template Router (шаблон)
 * Сохраняет режим генерации (template или prompt)
 */
function createGenerationWithPrompts(
  userId: string,
  duration: number,
  promptUser: string,
  promptFinal: string,
  mode: 'template' | 'prompt' = 'template',
  templateData?: {
    template_id: string;
    template_name: string;
    text_inputs: Record<string, string>;
    final_prompt: string;
  }
): string {
  const db = getDb();
  const cost = duration === 6 ? 1 : 2;
  const generationId = `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = Math.floor(Date.now() / 1000);

  const insertStmt = db.prepare(
    `INSERT INTO generations (
      id, userId, status, duration, cost, charged,
      prompt, prompt_final, minimax_status, createdAt,
      minimax_template_id, minimax_template_name, minimax_template_inputs, minimax_final_prompt,
      generation_mode
    ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, 'pending', ?,
              ?, ?, ?, ?, ?)`
  );

  insertStmt.run(
    generationId,
    userId,
    'queued',
    duration,
    cost,
    promptUser,
    promptFinal,
    now,
    templateData?.template_id || null,
    templateData?.template_name || null,
    templateData?.text_inputs ? JSON.stringify(templateData.text_inputs) : null,
    templateData?.final_prompt || null,
    mode
  );

  return generationId;
}

/**
 * POST /api/generate
 * Генерирует видео из фото и описания
 * Добавляет задачу в глобальную очередь с concurrency=1
 * Не блокирует ответ - обработка идет асинхронно через очередь
 */
export const POST: APIRoute = async (context) => {
  try {
    // Проверяем аутентификацию
    const sessionToken = context.cookies.get('session_token')?.value;
    const user = sessionToken ? getUserFromSession(sessionToken) : null;

    if (!user?.id) {
      return new Response(
        JSON.stringify({ error: 'Требуется аутентификация' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = (await context.request.json()) as GenerateRequest;
    let { prompt, duration } = body;
    let mode: 'template' | 'prompt' = (body.mode as any) || 'template';

    console.log(`[GEN] Request received: mode=${mode}, duration=${duration}, prompt="${prompt.substring(0, 50)}..."`);
    console.log(`[GEN] Mode: ${mode === 'template' ? '🎬 TEMPLATE (using MiniMax Video Agent Templates)' : '✏️ PROMPT (using free-form prompt)'}`);

    // Валидируем параметры
    if (!prompt || !duration) {
      return new Response(
        JSON.stringify({ error: 'Требуются prompt и duration' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Валидируем длину промпта
    if (prompt.length < 3) {
      return new Response(
        JSON.stringify({ error: 'Промпт слишком короткий (минимум 3 символа)' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (prompt.length > 2000) {
      return new Response(
        JSON.stringify({ error: 'Промпт слишком длинный (максимум 2000 символов)' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (![6, 10].includes(duration)) {
      return new Response(
        JSON.stringify({ error: 'Duration должна быть 6 или 10' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Валидируем режим
    if (mode !== 'template' && mode !== 'prompt') {
      console.warn(`[GEN] Invalid mode: ${mode}, defaulting to 'template'`);
      mode = 'template';
    }

    // ШАГ 1: Проверяем наличие загруженного изображения (per-user)
    ensureUserStorageDir(user.id);
    if (!userImageExists(user.id)) {
      return new Response(
        JSON.stringify({ error: 'Изображение не загружено' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ШАГ 2: Проверяем баланс
    const db = getDb();
    const userStmt = db.prepare(
      'SELECT generation_balance FROM users WHERE id = ?'
    );
    const userData = userStmt.get(user.id) as any;

    const cost = duration === 6 ? 1 : 2;
    const balance = userData?.generation_balance ?? 0;

    if (balance < cost) {
      console.log(
        `[GEN] Insufficient balance: user=${user.id}, balance=${balance}, cost=${cost}`
      );
      return new Response(
        JSON.stringify({
          error: 'Недостаточно кредитов',
          required: cost,
          current: balance,
        }),
        { status: 402, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ШАГ 3: Улучшаем промпт через Smart Prompt Engine (с timeout)
    let promptFinal = prompt;
    try {
      // Применяем timeout в 10 секунд для enhancePrompt
      const enhancePromise = enhancePrompt(prompt, mode);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Prompt enhancement timeout')), 10000)
      );
      promptFinal = await Promise.race([enhancePromise, timeoutPromise]) as string;
      console.log(`[GEN] ✅ Prompt enhanced (${mode} mode)`);
    } catch (enhanceError) {
      console.warn('[GEN] ⚠️ Prompt enhancement failed or timed out, using original prompt:', enhanceError);
      promptFinal = prompt;
    }

    // ШАГ 3.5: Выбираем оптимальный MiniMax Template через Template Router (ТОЛЬКО ДЛЯ TEMPLATE MODE)
    let templateData;
    if (mode === 'template') {
      console.log('[GEN] Template mode: selecting best MiniMax Video Agent Template...');
      try {
        // Применяем timeout в 15 секунд для Template Router
        const imageDescription = 'uploaded image'; // Краткое описание картинки
        const routerPromise = routeToTemplate(prompt, imageDescription);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Template Router timeout')), 15000)
        );
        templateData = await Promise.race([routerPromise, timeoutPromise]) as any;
        console.log('[GEN] ✅ Template selected:', templateData.template_name, `(${templateData.template_id})`);
      } catch (templateError) {
        // Fallback: если Template Router fails, продолжаем без шаблона
        console.warn('[GEN] ⚠️ Template Router failed or timed out, continuing without template:', templateError);
        templateData = undefined;
      }
    } else {
      console.log('[GEN] Prompt mode: skipping Template Router, will use free-form prompt');
      templateData = undefined;
    }

    // ШАГ 4: Создаем запись генерации со статусом 'queued'
    // Оба промпта и данные шаблона сохраняются в БД
    // Режим (template/prompt) также сохраняется для логирования и аудита
    const generationId = createGenerationWithPrompts(user.id, duration, prompt, promptFinal, mode, templateData);
    console.log(`[GEN] Generation record created: ${generationId} (mode=${mode})`);

    // ШАГ 5: Добавляем в глобальную очередь (concurrency=1)
    enqueueGeneration(generationId);

    // ШАГ 6: Запускаем обработку очереди асинхронно (не блокируем ответ)
    // Используем .catch() чтобы обработать потенциальные ошибки процессора
    processQueue().catch((err) => {
      console.error('[GEN] Queue processor error:', err);
    });

    console.log(
      `[GEN] task=${generationId} user=${user.id} status=queued, queueSize=${getQueueSize()}`
    );

    // ШАГ 7: Возвращаем generationId и информацию о состоянии очереди
    return new Response(
      JSON.stringify({
        success: true,
        generationId,
        mode,
        cost,
        balanceBefore: balance,
        balanceAfter: balance - cost,
        status: 'queued', // Статус = queued (в очереди), не processing
        queueSize: getQueueSize(), // Размер очереди для информации клиенту
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[GEN] Error:', errorMessage);
    return new Response(
      JSON.stringify({ error: 'Ошибка при генерации видео' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

/**
 * GET /api/generate?generationId=...
 * Получает статус генерации
 * Кроме статуса, возвращает videoUrl для скачивания результата
 */
export const GET: APIRoute = async (context) => {
  try {
    const sessionToken = context.cookies.get('session_token')?.value;
    const user = sessionToken ? getUserFromSession(sessionToken) : null;

    if (!user?.id) {
      return new Response(
        JSON.stringify({ error: 'Требуется аутентификация' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(context.request.url);
    const generationId = url.searchParams.get('generationId');

    if (!generationId) {
      return new Response(
        JSON.stringify({ error: 'Требуется generationId' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const db = getDb();
    const genStmt = db.prepare(
      'SELECT id, userId, status, duration, cost, charged, video_url, createdAt FROM generations WHERE id = ?'
    );
    const generation = genStmt.get(generationId) as any;

    if (!generation) {
      return new Response(
        JSON.stringify({ error: 'Generation not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Проверяем, что это генерация текущего пользователя
    if (generation.userId !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        generationId,
        status: generation.status,
        duration: generation.duration,
        cost: generation.cost,
        charged: generation.charged === 1,
        videoUrl: generation.video_url, // URL для скачивания видео
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[GEN] Error:', errorMessage);
    return new Response(
      JSON.stringify({ error: 'Внутренняя ошибка сервера' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
