import type { APIRoute } from 'astro';
import path from 'path';
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
 * POST /api/minimax_callback?generationId=...
 * Webhook от MiniMax для обработки результата генерации видео
 *
 * MiniMax отправляет callback с результатом обработки видео.
 * Если успешно (status === 'success'), скачиваем видео и списываем кредиты.
 */
export const POST: APIRoute = async (context) => {
  try {
    // Получаем generationId из query параметров
    const url = new URL(context.request.url);
    const generationId = url.searchParams.get('generationId');

    if (!generationId) {
      console.error('[CALLBACK] Нет generationId в query');
      return new Response(
        JSON.stringify({ error: 'Missing generationId' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Парсим payload от MiniMax
    const payload = (await context.request.json()) as CallbackPayload;

    console.log(`[CALLBACK] generationId=${generationId}, payload:`, payload);

    // ШАГ 1: Проверка verification ping от MiniMax
    if (payload.challenge) {
      console.log('[CALLBACK] MiniMax verification challenge received');
      return new Response(
        JSON.stringify({ challenge: payload.challenge }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ШАГ 2: Получаем генерацию из БД
    const db = getDb();
    const genStmt = db.prepare(
      'SELECT id, userId, cost FROM generations WHERE id = ?'
    );
    const generation = genStmt.get(generationId) as any;

    if (!generation) {
      console.error(`[CALLBACK] Generation not found: ${generationId}`);
      return new Response(
        JSON.stringify({ error: 'Generation not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ШАГ 3: Обработка результата
    if (payload.status === 'success') {
      // Успешная генерация
      const fileId = payload.file_id;

      if (!fileId) {
        console.error('[CALLBACK] Нет file_id в ответе');
        updateGenerationStatus(generationId, 'failed');
        return new Response(
          JSON.stringify({ error: 'No file_id in success response' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      console.log(
        `[CALLBACK] ✅ MiniMax success: generationId=${generationId}, fileId=${fileId}`
      );

      // Скачиваем видео
      const outputPath = path.join(process.cwd(), 'videos', 'output.mp4');
      const downloadResult = await downloadVideoFromMinimax(fileId, outputPath);

      if (!downloadResult.success) {
        console.error('[CALLBACK] Ошибка скачивания видео:', downloadResult.error);
        updateGenerationStatus(generationId, 'failed');
        return new Response(
          JSON.stringify({ error: downloadResult.error || 'Failed to download video' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Обновляем БД с URL видео
      const videoUrl = '/videos/output.mp4';
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
      console.error(`[CALLBACK] MiniMax failed: ${payload.error || 'Unknown error'}`);

      updateGenerationStatus(generationId, 'failed');

      // Кредиты НЕ списываются при ошибке
      console.log(`[CALLBACK] Кредиты не списаны (ошибка генерации)`);

      return new Response(
        JSON.stringify({
          ok: false,
          error: 'MiniMax generation failed',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } else {
      // Неизвестный статус
      console.warn(
        `[CALLBACK] Unknown status: ${payload.status}`
      );

      return new Response(
        JSON.stringify({ error: 'Unknown status' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[CALLBACK] Error:', errorMessage);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
