import { db } from '@/lib/db'

/**
 * Результат операции списания кредитов
 */
export type DeductCreditsResult =
  | { success: true }
  | { success: false; error: 'INSUFFICIENT_BALANCE' | 'USER_NOT_FOUND' }

/**
 * Причины списания кредитов
 */
export type DeductReason = 'validate' | 'correct' | 'generate'

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
  reason: DeductReason = 'validate'
): Promise<DeductCreditsResult> {
  // Шаг 1: Проверить, что пользователь существует и получить текущий баланс
  const userResult = await db.execute('SELECT generation_balance FROM users WHERE id = ?', [userId])

  const rows = Array.isArray(userResult) ? userResult : userResult.rows || []
  if (rows.length === 0) {
    return {
      success: false,
      error: 'USER_NOT_FOUND',
    }
  }

  const user = rows[0] as any
  const currentBalance = user.generation_balance || 0

  // Шаг 2: Проверить, достаточно ли баланса
  if (currentBalance < amount) {
    return {
      success: false,
      error: 'INSUFFICIENT_BALANCE',
    }
  }

  // Шаг 3: Атомарное обновление баланса
  // ОДНА операция UPDATE для консистентности
  await db.execute(
    'UPDATE users SET generation_balance = generation_balance - ?, generation_used = generation_used + ?, updatedAt = ? WHERE id = ?',
    [amount, amount, Math.floor(Date.now() / 1000), userId]
  )

  return {
    success: true,
  }
}
