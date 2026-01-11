import type { APIRoute } from 'astro';
import { getDb } from '../../lib/db';
import {
  updateGenerationStatus,
  updateGenerationVideoUrl,
  chargeGeneration,
} from '../../lib/billing/chargeGeneration';
import { downloadVideoFromMinimax } from '../../lib/minimax/downloadVideoFromMinimax';

interface CallbackPayload {
  challenge?: string;
  task_id?: string;
  status?: string;
  file_id?: string;
  error?: string;
}

/**
 * POST /api/minimax_callback
 * Webhook от MiniMax для обработки результата генерации видео
 *
 * ВАЖНО: Callback привязывается к generation через task_id (minimax_job_id),
 * а не через generationId в query. Это обеспечивает надежность.
 */
export const POST: APIRoute = async (context) => {
  try {
    // Парсим payload от MiniMax
    const payload = (await context.request.json()) as CallbackPayload;

    console.log('[CALLBACK] Received payload:', {
      task_id: payload.task_id,
      status: payload.status,
      file_id: payload.file_id,
      error: payload.error,
    });

    // ШАГ 1: Проверка verification challenge от MiniMax
    if (payload.challenge) {
      console.log('[CALLBACK] MiniMax verification challenge received');
      return new Response(
        JSON.stringify({ challenge: payload.challenge }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ШАГ 2: Получить task_id из payload
    const taskId = payload.task_id;
    if (!taskId) {
      console.error('[CALLBACK] Нет task_id в payload');
      // Возвращаем 200 чтобы MiniMax не спамил ретраями
      return new Response(
        JSON.stringify({ ok: false, error: 'Missing task_id' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ШАГ 3: Найти generation по minimax_job_id
    const db = getDb();
    const genStmt = db.prepare(
      'SELECT id, userId, cost, charged FROM generations WHERE minimax_job_id = ?'
    );
    const generation = genStmt.get(taskId) as any;

    if (!generation) {
      console.error(`[CALLBACK] Generation not found for task_id=${taskId}`);
      // Возвращаем 200 - это нормально, задача могла быть удалена
      return new Response(
        JSON.stringify({ ok: false, error: 'Generation not found' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const generationId = generation.id;
    const userId = generation.userId;

    console.log(
      `[CALLBACK] Found generation: ${generationId}, userId=${userId}`
    );

    // ШАГ 4: Обработка результата
    if (payload.status === 'success') {
      // Успешная генерация
      const fileId = payload.file_id;

      if (!fileId) {
        console.error('[CALLBACK] Нет file_id в success payload');
        updateGenerationStatus(generationId, 'failed');
        // Возвращаем 200 - callback обработан, но ошибка в данных
        return new Response(
          JSON.stringify({ ok: false, error: 'No file_id' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      console.log(
        `[CALLBACK] ✅ MiniMax success: generationId=${generationId}, fileId=${fileId}`
      );

      // Скачиваем видео в папку пользователя
      const downloadResult = await downloadVideoFromMinimax(fileId, userId);

      if (!downloadResult.success) {
        console.error('[CALLBACK] Ошибка скачивания видео:', downloadResult.error);
        updateGenerationStatus(generationId, 'failed');
        // Возвращаем 200 - callback обработан
        return new Response(
          JSON.stringify({ ok: false, error: 'Download failed' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Обновляем БД с URL видео (используем API endpoint)
      const videoUrl = '/api/video/current';
      updateGenerationVideoUrl(generationId, videoUrl);

      // Обновляем статус на success
      updateGenerationStatus(generationId, 'success');

      // Списываем кредиты
      const chargeResult = await chargeGeneration(generationId);

      if (chargeResult.success) {
        console.log(
          `[CALLBACK] ✅ Successfully charged credits for generation=${generationId}`
        );
      } else {
        console.error(
          `[CALLBACK] ❌ Failed to charge: ${chargeResult.error}`
        );
        // Статус остается 'success', но charged = 0
        // Администратор должен разобраться с этим вручную
      }

      return new Response(
        JSON.stringify({
          ok: true,
          generationId,
          videoUrl,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } else if (payload.status === 'failed') {
      // Ошибка при генерации в MiniMax
      console.error(
        `[CALLBACK] MiniMax failed for ${generationId}: ${payload.error || 'Unknown error'}`
      );

      updateGenerationStatus(generationId, 'failed');

      // Кредиты НЕ списываются при ошибке
      console.log(
        `[CALLBACK] Кредиты не списаны (ошибка генерации MiniMax)`
      );

      return new Response(
        JSON.stringify({
          ok: false,
          generationId,
          error: 'MiniMax generation failed',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } else {
      // Неизвестный статус - просто логируем
      console.warn(`[CALLBACK] Unknown status for ${generationId}: ${payload.status}`);

      return new Response(
        JSON.stringify({ ok: false, error: 'Unknown status' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[CALLBACK] Error:', errorMessage);
    // Возвращаем 200 чтобы не ломалось повторное стремление MiniMax
    return new Response(
      JSON.stringify({ ok: false, error: 'Internal server error' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
