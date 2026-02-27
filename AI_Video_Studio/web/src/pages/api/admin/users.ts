/**
 * API для работы с пользователями (admin only)
 * GET /api/admin/users - получить список пользователей
 * PATCH /api/admin/users - обновить данные пользователя
 */

import type { APIRoute } from 'astro';
import { getUserFromSession, isAdmin } from '../../../lib/auth';
import { getDb } from '../../../lib/db';

async function verifyAdmin(context: any) {
  const sessionToken = context.cookies.get('session_token')?.value;
  const user = sessionToken ? getUserFromSession(sessionToken) : null;

  if (!user?.id) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ error: 'Требуется аутентификация' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      ),
    };
  }

  if (!isAdmin(user.email)) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ error: 'Доступ запрещен' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      ),
    };
  }

  return { ok: true, user };
}

export const GET: APIRoute = async (context) => {
  const auth = await verifyAdmin(context);
  if (!auth.ok) return auth.response;

  try {
    const db = getDb();
    const stmt = db.prepare(
      `SELECT
        id,
        email,
        name,
        createdAt,
        COALESCE(disabled, 0) as disabled,
        COALESCE(generation_balance, 0) as generation_balance,
        COALESCE(generation_used, 0) as generation_used
      FROM users
      ORDER BY createdAt DESC
      LIMIT 500`
    );

    const rows = stmt.all() as any[];
    console.log(`[GET /api/admin/users] Loaded ${rows.length} users`);

    const users = rows.map((row: any) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      createdAt: row.createdAt || 0,
      disabled: row.disabled === 1,
      generation_balance: row.generation_balance || 0,
      generation_used: row.generation_used || 0,
    }));

    return new Response(JSON.stringify({ users }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[GET /api/admin/users] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch users' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const PATCH: APIRoute = async (context) => {
  const auth = await verifyAdmin(context);
  if (!auth.ok) return auth.response;

  try {
    const body = (await context.request.json()) as any;
    const { userId, generation_balance, generation_used } = body;

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Требуется userId' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const db = getDb();

    // Проверить существование пользователя
    const userStmt = db.prepare('SELECT id FROM users WHERE id = ?');
    const user = userStmt.get(userId);

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Пользователь не найден' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const now = Math.floor(Date.now() / 1000);

    if (typeof generation_balance === 'number') {
      const updateStmt = db.prepare(
        'UPDATE users SET generation_balance = ?, updatedAt = ? WHERE id = ?'
      );
      updateStmt.run(generation_balance, now, userId);
      console.log(`[Admin] User generation_balance updated to ${generation_balance} for ${userId}`);
    }

    if (typeof generation_used === 'number') {
      const updateStmt = db.prepare(
        'UPDATE users SET generation_used = ?, updatedAt = ? WHERE id = ?'
      );
      updateStmt.run(generation_used, now, userId);
      console.log(`[Admin] User generation_used updated to ${generation_used} for ${userId}`);
    }

    if (typeof generation_balance !== 'number' && typeof generation_used !== 'number') {
      return new Response(
        JSON.stringify({ error: 'Требуется generation_balance или generation_used' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Пользователь обновлен' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[PATCH /api/admin/users] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Ошибка при обновлении пользователя' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
