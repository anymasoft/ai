import type { APIRoute } from 'astro';
import { getUserFromSession } from '../../../lib/auth';
import { getDb } from '../../../lib/db';
import { readGenerationVideo } from '../../../lib/minimax/storage';

/**
 * GET /api/video/[id]
 * Возвращает видео конкретной генерации по ID
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

    const { id } = context.params;
    if (!id) {
      return new Response(
        JSON.stringify({ error: 'Требуется ID генерации' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Проверяем что генерация принадлежит этому пользователю
    const db = getDb();
    const generation = db.prepare(
      'SELECT id, userId FROM generations WHERE id = ?'
    ).get(id) as { id: string; userId: string } | undefined;

    if (!generation || generation.userId !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Видео не найдено' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const videoBuffer = readGenerationVideo(user.id, id);

    if (!videoBuffer) {
      return new Response(
        JSON.stringify({ error: 'Видео файл не найден' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(videoBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': videoBuffer.length.toString(),
        'Cache-Control': 'private, max-age=86400',
        'Accept-Ranges': 'bytes',
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[VIDEO/ID] Ошибка:', errorMessage);
    return new Response(
      JSON.stringify({ error: 'Ошибка при получении видео' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
