import type { APIRoute } from 'astro';
import { getUserFromSession } from '../../lib/auth';
import {
  createGeneration,
  updateGenerationStatus,
  chargeGeneration,
} from '../../lib/billing/chargeGeneration';
import { getDb } from '../../lib/db';

interface GenerateRequest {
  prompt: string;
  duration: number;
  imageBase64: string;
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
    const { prompt, duration, imageBase64 } = body;

    // Валидируем параметры
    if (!prompt || !duration || !imageBase64) {
      return new Response(
        JSON.stringify({ error: 'Требуются prompt, duration и image' }),
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

    // ШАГ 3: В реальности - отправляем в Minimax
    // Сейчас - имитируем обработку с 3-секундной задержкой
    // В production это будет асинхронное задание через очередь

    // Для демо-целей: запускаем обработку в фоне через setTimeout
    // (в production нужна очередь задач!)
    setTimeout(async () => {
      try {
        // Имитируем обработку Minimax
        console.log(
          `[GEN] Processing generation=${generationId} (simulated)`
        );

        updateGenerationStatus(generationId, 'processing');

        // Имитируем успешную генерацию
        // В reality: сохранили бы видео на диск/облако
        updateGenerationStatus(generationId, 'success');

        // ШАГ 4: Списываем кредиты (ТОЛЬКО когда видео готово!)
        const chargeResult = await chargeGeneration(generationId);

        if (chargeResult.success) {
          console.log(
            `[GEN] ✅ Successfully charged for generation=${generationId}`
          );
        } else {
          console.error(
            `[GEN] ❌ Failed to charge: ${chargeResult.error}`
          );
          // Можно откатить генерацию или отправить уведомление админу
        }
      } catch (error) {
        console.error(`[GEN] Error processing generation:`, error);
        updateGenerationStatus(generationId, 'failed');
      }
    }, 3000);

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
      'SELECT id, userId, status, duration, cost, charged, createdAt FROM generations WHERE id = ?'
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
