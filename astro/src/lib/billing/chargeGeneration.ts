import { getDb } from '../db';
import { deductCredits } from './deductCredits';

/**
 * Результат операции начисления за генерацию
 */
export type ChargeGenerationResult =
  | { success: true; balanceBefore: number; balanceAfter: number }
  | {
      success: false;
      error:
        | 'GENERATION_NOT_FOUND'
        | 'ALREADY_CHARGED'
        | 'INSUFFICIENT_BALANCE'
        | 'USER_NOT_FOUND';
    };

/**
 * Списать кредиты за успешно сгенерированное видео
 *
 * ВАЖНО: вызывается ТОЛЬКО когда видео готово и сохранено!
 *
 * Логика:
 * 1. Найти запись генерации по ID
 * 2. Если charged = 1 → вернуть ALREADY_CHARGED (защита от двойного списания)
 * 3. Получить баланс ПЕРЕД списанием
 * 4. Вызвать deductCredits(userId, cost)
 * 5. Если успех → установить charged = 1, completedAt = now
 * 6. Вернуть баланс ДО и ПОСЛЕ
 *
 * @param generationId - ID генерации из таблицы generations
 * @returns результат с информацией о балансе до/после
 */
export async function chargeGeneration(
  generationId: string
): Promise<ChargeGenerationResult> {
  const db = getDb();

  try {
    // Шаг 1: Найти генерацию
    const genStmt = db.prepare(
      'SELECT id, userId, cost, charged FROM generations WHERE id = ?'
    );
    const generation = genStmt.get(generationId) as any;

    if (!generation) {
      console.error(`[CHARGE] Generation not found: ${generationId}`);
      return {
        success: false,
        error: 'GENERATION_NOT_FOUND',
      };
    }

    const { userId, cost, charged } = generation;

    // Шаг 2: Проверка двойного списания
    if (charged === 1) {
      console.log(
        `[CHARGE] Already charged, skip (generation: ${generationId})`
      );
      return {
        success: false,
        error: 'ALREADY_CHARGED',
      };
    }

    // Шаг 3: Получить баланс ДО списания
    const userBeforeStmt = db.prepare('SELECT generation_balance FROM users WHERE id = ?');
    const userBefore = userBeforeStmt.get(userId) as any;
    const balanceBefore = userBefore?.generation_balance ?? 0;

    // Шаг 4: Списать кредиты
    const deductResult = await deductCredits(userId, cost, 'generate');

    if (!deductResult.success) {
      console.error(
        `[CHARGE] Failed to deduct credits: ${deductResult.error} (user: ${userId}, cost: ${cost})`
      );
      return {
        success: false,
        error: deductResult.error === 'INSUFFICIENT_BALANCE' ? 'INSUFFICIENT_BALANCE' : 'USER_NOT_FOUND',
      };
    }

    // Шаг 5: Отметить, что начислено
    const now = Math.floor(Date.now() / 1000);
    const updateStmt = db.prepare(
      'UPDATE generations SET charged = 1, completedAt = ? WHERE id = ?'
    );
    updateStmt.run(now, generationId);

    // Шаг 6: Получить баланс ПОСЛЕ списания
    const userAfterStmt = db.prepare('SELECT generation_balance FROM users WHERE id = ?');
    const userAfter = userAfterStmt.get(userId) as any;
    const balanceAfter = userAfter?.generation_balance ?? 0;

    console.log(
      `[CHARGE] user=${userId} before=${balanceBefore} cost=${cost} after=${balanceAfter}`
    );

    return {
      success: true,
      balanceBefore,
      balanceAfter,
    };
  } catch (error) {
    console.error(`[CHARGE] Error:`, error);
    return {
      success: false,
      error: 'USER_NOT_FOUND',
    };
  }
}

/**
 * Создать запись генерации
 * Вызывается в НАЧАЛЕ пайплайна (до отправки в Minimax)
 *
 * @param userId - ID пользователя
 * @param duration - Длительность видео (6 или 10)
 * @returns ID генерации
 */
export function createGeneration(
  userId: string,
  duration: number
): string {
  const db = getDb();

  // Определяем стоимость по длительности
  const cost = duration === 6 ? 1 : duration === 10 ? 2 : 1;

  const generationId = `gen_${Date.now()}_${userId}`;
  const now = Math.floor(Date.now() / 1000);

  const insertStmt = db.prepare(
    `INSERT INTO generations (id, userId, status, duration, cost, charged, createdAt)
     VALUES (?, ?, 'processing', ?, ?, 0, ?)`
  );

  insertStmt.run(generationId, userId, duration, cost, now);

  console.log(
    `[GEN] created generation=${generationId} user=${userId} duration=${duration}s cost=${cost}`
  );

  return generationId;
}

/**
 * Обновить статус генерации
 *
 * @param generationId - ID генерации
 * @param status - Новый статус (processing / success / failed)
 */
export function updateGenerationStatus(
  generationId: string,
  status: 'processing' | 'success' | 'failed'
): void {
  const db = getDb();

  const updateStmt = db.prepare(
    'UPDATE generations SET status = ? WHERE id = ?'
  );

  updateStmt.run(status, generationId);

  console.log(
    `[GEN] updated generation=${generationId} status=${status}`
  );
}
