import type { APIRoute } from 'astro';
import { getDb } from '../lib/db';
import {
  updateGenerationStatus,
  updateGenerationVideoUrl,
  chargeGeneration,
} from '../lib/billing/chargeGeneration';
import { downloadVideoFromMinimax } from '../lib/minimax/downloadVideoFromMinimax';

interface CallbackPayload {
  challenge?: string;
  task_id?: string;
  status?: string;
  file_id?: string;
  error?: string;
}

/**
 * POST /minimax_callback
 * Webhook для MiniMax - публичный, без авторизации
 *
 * КРИТИЧНО:
 * - ВСЕГДА возвращает JSON
 * - Обрабатывает challenge верно
 * - БЕЗ редиректов, БЕЗ HTML
 * - Доступен для MiniMax (внешний сервис)
 */
export const POST: APIRoute = async (context) => {
  const request = context.request;
  try {
    console.log('[MINIMAX_CALLBACK] Получен запрос');

    // Парсим JSON от MiniMax
    let payload: CallbackPayload;
    try {
      payload = await request.json();
    } catch (e) {
      console.error('[MINIMAX_CALLBACK] Ошибка парсинга JSON');
      return new Response(
        JSON.stringify({ error: 'Invalid JSON' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('[MINIMAX_CALLBACK] Payload:', {
      challenge: payload.challenge ? '***' : undefined,
      task_id: payload.task_id,
      status: payload.status,
      file_id: payload.file_id,
    });

    // ШАГ 1: КРИТИЧНО - challenge verification
    if (payload.challenge) {
      console.log('[MINIMAX_CALLBACK] ✅ Challenge от MiniMax получен, отправляем ответ');
      const response = new Response(
        JSON.stringify({ challenge: payload.challenge }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          },
        }
      );
      console.log('[MINIMAX_CALLBACK] ✅ Challenge ответ отправлен');
      return response;
    }

    // ШАГ 2: Обработка реального callback'а
    const taskId = payload.task_id;
    if (!taskId) {
      console.error('[MINIMAX_CALLBACK] Нет task_id в payload');
      return new Response(
        JSON.stringify({ ok: false, error: 'Missing task_id' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Логирование типа task_id
    console.log(`[MINIMAX_CALLBACK] Received task_id: "${taskId}", type: ${typeof taskId}`);

    // ШАГ 3: Найти generation по task_id
    const db = getDb();

    // Гарантируем что taskId - строка (может быть число)
    const taskIdString = String(taskId);
    console.log(`[MINIMAX_CALLBACK] Converted task_id to string: "${taskIdString}"`);

    // ДЕБаг: перед SELECT показываем что ищем
    console.log(`[MINIMAX_CALLBACK] About to SELECT from DB`);
    console.log(`[MINIMAX_CALLBACK] SQL: SELECT id, userId FROM generations WHERE minimax_job_id = ?`);
    console.log(`[MINIMAX_CALLBACK] params: ["${taskIdString}"]`);
    console.log(`[MINIMAX_CALLBACK] Looking for minimax_job_id type: ${typeof taskIdString}`);

    const genStmt = db.prepare(
      'SELECT id, userId FROM generations WHERE minimax_job_id = ?'
    );
    const generation = genStmt.get(taskIdString) as any;

    // ДЕБаг: результат запроса
    console.log(`[MINIMAX_CALLBACK] SELECT result:`, generation ? 'FOUND' : 'NOT FOUND');
    if (generation) {
      console.log(`[MINIMAX_CALLBACK] Found generation id: ${generation.id}`);
    }

    if (!generation) {
      console.error(`[MINIMAX_CALLBACK] Generation не найдена для task_id="${taskIdString}"`);

      // Дебаг: посмотрим что есть в БД
      const allTaskIds = db.prepare(
        'SELECT id, minimax_job_id FROM generations WHERE minimax_job_id IS NOT NULL LIMIT 5'
      ).all();
      console.error(`[MINIMAX_CALLBACK] All task IDs in DB:`, allTaskIds);

      // ДЕБаг: попробуем найти типы
      const typeCheck = db.prepare(
        'SELECT minimax_job_id, typeof(minimax_job_id) as type FROM generations WHERE minimax_job_id IS NOT NULL LIMIT 3'
      ).all();
      console.error(`[MINIMAX_CALLBACK] Task ID types in DB:`, typeCheck);

      return new Response(
        JSON.stringify({ ok: false }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const generationId = generation.id;
    const userId = generation.userId;

    console.log(`[MINIMAX_CALLBACK] Найдена генерация: ${generationId}`);

    // ШАГ 4: Обработка успеха
    if (payload.status === 'success') {
      const fileId = payload.file_id;

      if (!fileId) {
        console.error('[MINIMAX_CALLBACK] Нет file_id');
        updateGenerationStatus(generationId, 'failed');
        return new Response(
          JSON.stringify({ ok: false }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Гарантируем что fileId - строка (может быть число от MiniMax)
      const fileIdString = String(fileId);
      console.log(`[MINIMAX_CALLBACK] Received file_id: "${fileIdString}", type: ${typeof fileId}`);
      console.log(`[MINIMAX_CALLBACK] Скачиваем видео: fileId=${fileIdString}`);

      // Скачиваем видео
      const downloadResult = await downloadVideoFromMinimax(fileIdString, userId);

      if (!downloadResult.success) {
        console.error('[MINIMAX_CALLBACK] Ошибка скачивания видео');
        updateGenerationStatus(generationId, 'failed');
        return new Response(
          JSON.stringify({ ok: false }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Обновляем БД
      updateGenerationVideoUrl(generationId, '/api/video/current');
      updateGenerationStatus(generationId, 'success');

      // Списываем кредиты
      const chargeResult = await chargeGeneration(generationId);
      if (chargeResult.success) {
        console.log(`[MINIMAX_CALLBACK] ✅ Кредиты списаны для ${generationId}`);
      }

      return new Response(
        JSON.stringify({ ok: true }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } else if (payload.status === 'failed') {
      console.error(`[MINIMAX_CALLBACK] MiniMax вернул ошибку`);
      updateGenerationStatus(generationId, 'failed');
      return new Response(
        JSON.stringify({ ok: false }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Неизвестный статус
    console.warn(`[MINIMAX_CALLBACK] Неизвестный статус: ${payload.status}`);
    return new Response(
      JSON.stringify({ ok: false }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[MINIMAX_CALLBACK] Критическая ошибка:', errorMessage);
    return new Response(
      JSON.stringify({ ok: false }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
