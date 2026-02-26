import type { APIRoute } from 'astro';
import { getUserFromSession, isAdmin } from '../../../lib/auth';
import { getDb } from '../../../lib/db';

/**
 * GET /api/admin/stats
 * Получает актуальную статистику по всем пользователям
 * Требует прав администратора
 */
export const GET: APIRoute = async (context) => {
	try {
		// Проверяем аутентификацию и права администратора
		const sessionToken = context.cookies.get('session_token')?.value;
		const user = sessionToken ? getUserFromSession(sessionToken) : null;

		if (!user || !isAdmin(user)) {
			return new Response(
				JSON.stringify({ error: 'Требуются права администратора' }),
				{ status: 403, headers: { 'Content-Type': 'application/json' } }
			);
		}

		const db = getDb();

		// Получаем все пользователей для статистики
		const allUsers = db.prepare(`
			SELECT id, generation_balance, generation_used
			FROM users
		`).all() as Array<{ id: string; generation_balance: number; generation_used: number }>;

		const totalUsers = allUsers.length;
		const totalGenerationCredits = allUsers.reduce((sum, u) => sum + (u.generation_balance + u.generation_used), 0);
		const totalBalance = allUsers.reduce((sum, u) => sum + u.generation_balance, 0);

		return new Response(
			JSON.stringify({
				success: true,
				totalUsers,
				totalGenerationCredits,
				totalBalance,
			}),
			{ status: 200, headers: { 'Content-Type': 'application/json' } }
		);
	} catch (error) {
		console.error('[ADMIN_STATS] Error:', error);
		return new Response(
			JSON.stringify({ error: 'Ошибка при получении статистики' }),
			{ status: 500, headers: { 'Content-Type': 'application/json' } }
		);
	}
};
