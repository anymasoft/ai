/**
 * API для управления балансом пользователя
 * PATCH /api/admin/user-balance - изменить баланс пользователя
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

  if (!isAdmin(user)) {
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

export const PATCH: APIRoute = async (context) => {
  const auth = await verifyAdmin(context);
  if (!auth.ok) return auth.response;

  try {
    const body = (await context.request.json()) as any;
    const { userId, balanceDelta, resetBalance } = body;

    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Требуется userId' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const db = getDb();

    // Проверяем, что пользователь существует
    const userStmt = db.prepare('SELECT generation_balance FROM users WHERE id = ?');
    const user = userStmt.get(userId) as any;

    if (!user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Пользователь не найден' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const now = Math.floor(Date.now() / 1000);

    if (resetBalance === true) {
      // Сброс баланса на 0
      const resetStmt = db.prepare(
        'UPDATE users SET generation_balance = 0, updatedAt = ? WHERE id = ?'
      );
      resetStmt.run(now, userId);
      console.log(`[Admin] User balance reset for ${userId}`);
    } else if (typeof balanceDelta === 'number') {
      // Изменение баланса на определенное значение
      const updateStmt = db.prepare(
        'UPDATE users SET generation_balance = generation_balance + ?, updatedAt = ? WHERE id = ?'
      );
      updateStmt.run(balanceDelta, now, userId);
      console.log(`[Admin] User balance changed by ${balanceDelta} for ${userId}`);
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Требуется balanceDelta или resetBalance',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Баланс обновлен' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[API] Error updating user balance:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Ошибка при обновлении баланса' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
