import { getDb } from '../db';

/**
 * Результат операции списания кредитов
 */
export type DeductCreditsResult =
  | { success: true }
  | { success: false; error: 'INSUFFICIENT_BALANCE' | 'USER_NOT_FOUND' };

/**
 * Причины списания кредитов
 */
export type DeductReason = 'generate' | 'validate' | 'other';

/**
 * Списать кредиты пользователя с проверкой баланса
 *
 * КЛЮЧЕВЫЕ ПРАВИЛА:
 * 1. Вызывается ТОЛЬКО ПОСЛЕ успешного завершения операции
 * 2. Проверить баланс ДО UPDATE
 * 3. Если баланс < amount → вернуть INSUFFICIENT_BALANCE
 * 4. Атомарное обновление БД (одна транзакция)
 * 5. Обновлять generation_balance, generation_used и updatedAt одновременно
 *
 * @param userId - ID пользователя
 * @param amount - Количество кредитов к списанию (по умолчанию 1)
 * @param reason - Причина списания (для аудита)
 * @returns { success: true } или { success: false, error: 'INSUFFICIENT_BALANCE' }
 */
export async function deductCredits(
  userId: string,
  amount: number = 1,
  reason: DeductReason = 'generate'
): Promise<DeductCreditsResult> {
  const db = getDb();

  // Шаг 1: Проверить, что пользователь существует и получить текущий баланс
  const userStmt = db.prepare('SELECT generation_balance FROM users WHERE id = ?');
  const user = userStmt.get(userId) as any;

  if (!user) {
    console.error(`[deductCredits] User not found: ${userId}`);
    return {
      success: false,
      error: 'USER_NOT_FOUND',
    };
  }

  const currentBalance = user.generation_balance || 0;

  // Шаг 2: Проверить, достаточно ли баланса
  if (currentBalance < amount) {
    console.log(
      `[deductCredits] Insufficient balance for user ${userId}: current=${currentBalance}, requested=${amount}`
    );
    return {
      success: false,
      error: 'INSUFFICIENT_BALANCE',
    };
  }

  // Шаг 3: Атомарное обновление баланса
  // ОДНА операция UPDATE для консистентности
  const updateStmt = db.prepare(
    'UPDATE users SET generation_balance = generation_balance - ?, generation_used = generation_used + ?, updatedAt = ? WHERE id = ?'
  );

  const now = Math.floor(Date.now() / 1000);
  updateStmt.run(amount, amount, now, userId);

  console.log(
    `[deductCredits] ✅ Successfully deducted ${amount} credits from user ${userId} (reason: ${reason})`
  );

  return {
    success: true,
  };
}
