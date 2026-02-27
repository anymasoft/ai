import type { APIRoute } from 'astro';
import { getUserFromSession } from '../../lib/auth';
import { getDb } from '../../lib/db';

/**
 * GET /api/generations
 * Возвращает список последних генераций пользователя (для панели истории)
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

    const db = getDb();
    const generations = db.prepare(`
      SELECT id, status, duration, cost, prompt, video_url, createdAt
      FROM generations
      WHERE userId = ?
      ORDER BY createdAt DESC
      LIMIT 20
    `).all(user.id) as Array<{
      id: string;
      status: string;
      duration: number;
      cost: number;
      prompt: string | null;
      video_url: string | null;
      createdAt: number;
    }>;

    return new Response(
      JSON.stringify({ generations }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[GENERATIONS] Ошибка:', errorMessage);
    return new Response(
      JSON.stringify({ error: 'Внутренняя ошибка сервера' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
