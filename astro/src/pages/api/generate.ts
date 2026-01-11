import type { APIRoute } from 'astro';
import path from 'path';
import fs from 'fs';
import { getUserFromSession } from '../../lib/auth';
import {
  createGeneration,
  updateGenerationStatus,
  chargeGeneration,
  updateMinimaxJobId,
} from '../../lib/billing/chargeGeneration';
import { getDb } from '../../lib/db';
import { callMinimaxAPI } from '../../lib/minimax/callMinimaxAPI';

interface GenerateRequest {
  prompt: string;
  duration: number;
}

/**
 * POST /api/generate
 * Генерирует видео из фото и описания
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
    const { prompt, duration } = body;

    // Валидируем параметры
    if (!prompt || !duration) {
      return new Response(
        JSON.stringify({ error: 'Требуются prompt и duration' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Проверяем наличие загруженного изображения
    const imagePath = path.join(process.cwd(), 'uploads', 'image.jpg');
    if (!fs.existsSync(imagePath)) {
      return new Response(
        JSON.stringify({ error: 'Изображение не загружено' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (![6, 10].includes(duration)) {
      return new Response(
        JSON.stringify({ error: 'Duration должна быть 6 или 10' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ШАГ 1: Проверяем баланс
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

    // ШАГ 2: Создаем запись генерации
    const generationId = createGeneration(user.id, duration);

    // ШАГ 3: Отправляем в MiniMax (фоновая обработка)
    // Callback от MiniMax будет обрабатываться в /api/minimax_callback

    setTimeout(async () => {
      try {
        updateGenerationStatus(generationId, 'processing');

        // Генерируем callback URL (пример)
        const callbackUrl = `${process.env.MINIMAX_CALLBACK_URL || 'http://localhost:3000'}/api/minimax_callback?generationId=${generationId}`;

        console.log(
          `[GEN] Отправляем в MiniMax: generation=${generationId}, callback=${callbackUrl}`
        );

        // Вызываем MiniMax API
        const minimaxResult = await callMinimaxAPI(
          imagePath,
          prompt,
          duration,
          callbackUrl
        );

        if (!minimaxResult.success) {
          console.error(
            `[GEN] ❌ MiniMax API failed: ${minimaxResult.error}`
          );
          updateGenerationStatus(generationId, 'failed');
          return;
        }

        // Сохраняем task_id от MiniMax
        const taskId = minimaxResult.taskId;
        console.log(`[GEN] ✅ Task created: ${taskId}`);

        updateMinimaxJobId(generationId, taskId);

        // Теперь ждем callback от MiniMax
        // После получения callback'а произойдет:
        // 1. Скачивание видео
        // 2. Сохранение в /videos/output.mp4
        // 3. Обновление status на 'success'
        // 4. Списание кредитов

      } catch (error) {
        console.error(`[GEN] Error processing generation:`, error);
        updateGenerationStatus(generationId, 'failed');
      }
    }, 1000);

    console.log(
      `[GEN] task=${generationId} user=${user.id} status=processing`
    );

    return new Response(
      JSON.stringify({
        success: true,
        generationId,
        cost,
        balanceBefore: balance,
        balanceAfter: balance - cost, // будет списано через 3 сек
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
        videoUrl: generation.video_url, // Новое поле
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
