/**
 * Обработчик очереди генераций MiniMax
 * Этот модуль отвечает за асинхронную обработку очереди с concurrency=1
 */

import { getDb } from '../db';
import {
  peekQueue,
  dequeueGeneration,
  setQueueRunning,
  isQueueRunning,
} from './queue';
import { updateGenerationStatus, updateMinimaxJobId } from '../billing/chargeGeneration';
import { callMinimaxAPI } from './callMinimaxAPI';
import { getUserImagePath } from './storage';

/**
 * Обработать очередь генераций
 * Берет следующую из очереди и запускает обработку
 * Рекурсивно вызывает себя для обработки всей очереди
 */
export async function processQueue(): Promise<void> {
  try {
    // Если уже работаем — не запускаем еще один воркер
    if (isQueueRunning()) {
      console.log('[PROCESSOR] Queue already running, skipping');
      return;
    }

    // Получаем первую генерацию из очереди (без удаления)
    const item = peekQueue();
    if (!item) {
      console.log('[PROCESSOR] Queue is empty');
      return;
    }

    const generationId = item.generationId;

    // Помечаем что обработка началась
    setQueueRunning(true);

    console.log(`[PROCESSOR] Processing generation: ${generationId}`);

    try {
      // Получаем данные генерации из БД (включая данные шаблона и режим)
      const db = getDb();
      const genStmt = db.prepare(
        `SELECT id, userId, status, prompt, prompt_final, duration,
                minimax_template_id, minimax_template_name, minimax_template_inputs, minimax_final_prompt,
                generation_mode
         FROM generations WHERE id = ?`
      );
      const generation = genStmt.get(generationId) as any;

      if (!generation) {
        console.error(`[PROCESSOR] Generation not found: ${generationId}`);
        // Удалить из очереди
        dequeueGeneration();
        // Продолжить обработку следующей
        setQueueRunning(false);
        processQueue();
        return;
      }

      // Получить путь к картинке пользователя
      const userId = generation.userId;
      const imagePath = getUserImagePath(userId);

      // Выставить статус на processing
      updateGenerationStatus(generationId, 'processing');

      // Сформировать callback URL (БЕЗ /api, только /minimax_callback как ожидает MiniMax)
      const callbackBase = (process.env.MINIMAX_CALLBACK_URL || 'http://localhost:3000').replace(/\/$/, '');
      const callbackUrl = `${callbackBase}/minimax_callback`;

      const generationMode = generation.generation_mode || 'template';
      console.log(
        `[PROCESSOR] Calling MiniMax: generation=${generationId}, userId=${userId}, mode=${generationMode}, callback=${callbackUrl}`
      );
      console.log(`[PROCESSOR] Mode: ${generationMode === 'template' ? '🎬 TEMPLATE' : '✏️ PROMPT'}`);

      // Подготавливаем данные для MiniMax API
      const finalPrompt = generation.minimax_final_prompt || generation.prompt_final || generation.prompt;
      const templateId = generation.minimax_template_id || null;
      const templateInputs = generation.minimax_template_inputs
        ? JSON.parse(generation.minimax_template_inputs)
        : null;

      console.log('[PROCESSOR] Template info:', {
        templateId,
        templateName: generation.minimax_template_name,
        hasInputs: !!templateInputs,
      });

      // Вызвать MiniMax API с поддержкой шаблонов
      const minimaxResult = await callMinimaxAPI(
        imagePath,
        finalPrompt,
        generation.duration,
        callbackUrl,
        templateId,
        templateInputs
      );

      if (!minimaxResult.success) {
        console.error(
          `[PROCESSOR] MiniMax API failed: ${minimaxResult.error}`
        );
        updateGenerationStatus(generationId, 'failed');
        // Удалить из очереди
        dequeueGeneration();
        // Продолжить обработку следующей
        setQueueRunning(false);
        processQueue();
        return;
      }

      // Сохранить task_id в БД
      const taskId = minimaxResult.taskId;
      console.log(`[PROCESSOR] ✅ Task created: ${taskId}`);
      console.log(`[PROCESSOR] Task ID type: ${typeof taskId}, value: "${taskId}"`);

      // Гарантируем что taskId - это строка (т.к. может быть число от MiniMax)
      const taskIdString = String(taskId);
      console.log(`[PROCESSOR] Task ID converted to string: "${taskIdString}"`);

      // ДЕБаг: перед сохранением показываем что будем обновлять
      console.log(`[PROCESSOR] About to UPDATE minimax_job_id in DB`);
      console.log(`[PROCESSOR] SQL: UPDATE generations SET minimax_job_id = ? WHERE id = ?`);
      console.log(`[PROCESSOR] params: ["${taskIdString}", "${generationId}"]`);

      updateMinimaxJobId(generationId, taskIdString);

      // Удалить из очереди — задача успешно отправлена в MiniMax
      dequeueGeneration();

      console.log(`[PROCESSOR] Generation queued successfully, waiting for MiniMax callback`);

      // Завершить обработку и перейти к следующей
      setQueueRunning(false);

      // Рекурсивно обработать следующую задачу из очереди
      processQueue();

    } catch (error) {
      console.error(`[PROCESSOR] Error processing generation:`, error);
      updateGenerationStatus(generationId, 'failed');
      // Удалить из очереди
      dequeueGeneration();
      // Завершить флаг и перейти к следующей
      setQueueRunning(false);
      processQueue();
    }
  } catch (error) {
    console.error('[PROCESSOR] Queue processor error:', error);
    setQueueRunning(false);
  }
}
