import type { APIRoute } from 'astro';
import { getUserFromSession, isAdmin } from '../../../lib/auth';
import { getDb } from '../../../lib/db';

interface UserFinancial {
  userId: string;
  email: string;
  name: string;
  totalCreditsBought: number;
  totalCreditsUsed: number;
  currentBalance: number;
  lastPaymentDate: number | null;
  totalRevenue: number;
  avgPricePerCredit: number;
  status: 'Active' | 'At risk' | 'Dormant';
}

/**
 * GET /api/admin/financial-overview
 * Получает финансовую информацию по всем пользователям
 */
export const GET: APIRoute = async (context) => {
	try {
		// Проверяем права администратора
		const sessionToken = context.cookies.get('session_token')?.value;
		const user = sessionToken ? getUserFromSession(sessionToken) : null;

		if (!user?.email || !isAdmin(user.email)) {
			return new Response(
				JSON.stringify({ error: 'Требуются права администратора' }),
				{ status: 403, headers: { 'Content-Type': 'application/json' } }
			);
		}

		const db = getDb();
		const now = Math.floor(Date.now() / 1000);
		const twoWeeksAgo = now - 14 * 24 * 60 * 60;
		const thirtyDaysAgo = now - 30 * 24 * 60 * 60;

		// Получаем всех пользователей
		const allUsers = db.prepare(`
			SELECT id, email, name, generation_balance, generation_used, createdAt
			FROM users
			ORDER BY createdAt DESC
		`).all() as Array<{
			id: string;
			email: string;
			name: string;
			generation_balance: number;
			generation_used: number;
			createdAt: number;
		}>;

		const financialData: UserFinancial[] = allUsers.map((user) => {
			// Получаем информацию о платежах
			const paymentStats = db.prepare(`
				SELECT
					SUM(p.amount) as totalRevenue,
					MAX(p.createdAt) as lastPaymentDate,
					SUM(CASE WHEN p.status = 'succeeded' THEN pkg.generations ELSE 0 END) as creditsBought
				FROM payments p
				LEFT JOIN packages pkg ON p.packageKey = pkg.key
				WHERE p.userId = ? AND p.status = 'succeeded'
			`).get(user.id) as any;

			const totalRevenue = paymentStats?.totalRevenue || 0;
			const creditsBought = paymentStats?.creditsBought || 0;
			const lastPaymentDate = paymentStats?.lastPaymentDate || null;
			const creditsUsed = user.generation_used;
			const currentBalance = creditsBought - creditsUsed;
			const avgPricePerCredit = creditsBought > 0 ? Math.round((totalRevenue / creditsBought) * 100) / 100 : 0;

			// Определяем статус
			let status: 'Active' | 'At risk' | 'Dormant' = 'Dormant';

			if (lastPaymentDate !== null) {
				const daysSincePayment = Math.floor((now - lastPaymentDate) / (24 * 60 * 60));

				if (daysSincePayment < 14 && creditsUsed > 0) {
					status = 'Active';
				} else if (currentBalance > 0 && daysSincePayment >= 14) {
					status = 'At risk';
				} else if (currentBalance === 0 && daysSincePayment >= 30) {
					status = 'Dormant';
				}
			}

			return {
				userId: user.id,
				email: user.email,
				name: user.name,
				totalCreditsBought: creditsBought,
				totalCreditsUsed: creditsUsed,
				currentBalance,
				lastPaymentDate,
				totalRevenue,
				avgPricePerCredit,
				status
			};
		});

		return new Response(
			JSON.stringify({
				success: true,
				data: financialData
			}),
			{ status: 200, headers: { 'Content-Type': 'application/json' } }
		);
	} catch (error) {
		console.error('[FINANCIAL_OVERVIEW] Error:', error);
		return new Response(
			JSON.stringify({ error: 'Ошибка при получении финансовых данных' }),
			{ status: 500, headers: { 'Content-Type': 'application/json' } }
		);
	}
};
