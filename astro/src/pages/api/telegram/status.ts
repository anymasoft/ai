import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/db';

/**
 * GET /api/telegram/status?generation_id=...
 * Получает статус генерации видео для Telegram
 *
 * Возвращает:
 * - status: 'queued' | 'processing' | 'done' | 'failed'
 * - video_url?: строка с путём к видео (если done)
 * - error?: строка с ошибкой (если failed)
 */
export const GET: APIRoute = async (context) => {
  try {
    const url = new URL(context.request.url);
    const generationId = url.searchParams.get('generation_id');

    if (!generationId) {
      return new Response(
        JSON.stringify({ error: 'Требуется generation_id' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const db = getDb();
    const genStmt = db.prepare(
      'SELECT id, userId, status, duration, cost, video_url, createdAt FROM generations WHERE id = ?'
    );
    const generation = genStmt.get(generationId) as any;

    if (!generation) {
      return new Response(
        JSON.stringify({ error: 'Generation not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Проверяем что это Telegram генерация (userId должен начинаться с tg_)
    if (!generation.userId.startsWith('tg_')) {
      return new Response(
        JSON.stringify({ error: 'Invalid generation' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const responseData: any = {
      success: true,
      generationId,
      status: generation.status,
    };

    // Если видео готово, добавляем URL
    if (generation.status === 'done' && generation.video_url) {
      responseData.video_url = generation.video_url;
    }

    // Логируем статус
    console.log(
      `[TG_STATUS] generation_id=${generationId}, status=${generation.status}`
    );

    return new Response(
      JSON.stringify(responseData),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[TG_STATUS] Error:', errorMessage);
    return new Response(
      JSON.stringify({ error: 'Внутренняя ошибка сервера' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
