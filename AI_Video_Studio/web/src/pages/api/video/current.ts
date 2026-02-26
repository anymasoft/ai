import type { APIRoute } from 'astro';
import { getUserFromSession } from '../../../lib/auth';
import { readUserVideo } from '../../../lib/minimax/storage';

/**
 * GET /api/video/current
 * Возвращает текущее видео для пользователя (output.mp4)
 */
export const GET: APIRoute = async (context) => {
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

    // Читаем видео файл пользователя
    const videoBuffer = readUserVideo(user.id);

    if (!videoBuffer) {
      return new Response(
        JSON.stringify({ error: 'Видео не найдено' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(
      `[VIDEO] Отдаем видео пользователю ${user.id} (${videoBuffer.length} байт)`
    );

    // Возвращаем видео с правильным Content-Type
    return new Response(videoBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': videoBuffer.length.toString(),
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[VIDEO] Ошибка:', errorMessage);
    return new Response(
      JSON.stringify({ error: 'Ошибка при получении видео' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
