import type { APIRoute } from 'astro';
import fs from 'fs';
import path from 'path';
import { getDb } from '../../../lib/db';
import { enhancePrompt } from '../../../lib/promptEnhancer';
import { compileCameraCommands } from '../../../lib/cameraPromptCompiler';
import { enqueueGeneration } from '../../../lib/minimax/queue';
import { processQueue } from '../../../lib/minimax/processor';
import { notifyAdmin } from '../../../lib/telegramNotifier';

/**
 * Генерирует ID пользователя на основе telegram user_id для изоляции данных
 */
function getTelegramUserId(telegramUserId: number | string): string {
  return `tg_${telegramUserId}`;
}

/**
 * Получить путь к papke Telegram пользователя
 */
function getTelegramUserStoragePath(telegramUserId: number | string): string {
  const userId = getTelegramUserId(telegramUserId);
  return path.join(process.cwd(), 'storage', userId);
}

/**
 * Получить путь к image.jpg для Telegram пользователя
 */
function getTelegramUserImagePath(telegramUserId: number | string): string {
  const storageDir = getTelegramUserStoragePath(telegramUserId);
  return path.join(storageDir, 'image.jpg');
}

/**
 * Создать папку пользователя если её нет
 */
function ensureTelegramUserStorageDir(telegramUserId: number | string): void {
  const storageDir = getTelegramUserStoragePath(telegramUserId);
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }
}

/**
 * Создает запись генерации для Telegram юзера
 */
function createTelegramGeneration(
  telegramUserId: number | string,
  duration: number,
  promptUser: string,
  promptFinal: string
): string {
  const db = getDb();
  const userId = getTelegramUserId(telegramUserId);
  const cost = duration === 6 ? 1 : 2;
  const generationId = `tg_gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = Math.floor(Date.now() / 1000);

  const insertStmt = db.prepare(
    `INSERT INTO generations (
      id, userId, status, duration, cost, charged,
      prompt, prompt_final, minimax_status, createdAt,
      generation_mode, prompt_cinematic
    ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, 'pending', ?, ?, ?)`
  );

  insertStmt.run(
    generationId,
    userId,
    'queued',
    duration,
    cost,
    promptUser,
    promptFinal,
    now,
    'prompt',
    promptFinal
  );

  console.log(
    `[TG] Generation created: ${generationId} for telegram_user=${telegramUserId}`
  );

  return generationId;
}

/**
 * POST /api/telegram/generate
 * Генерирует видео для Telegram юзера
 *
 * Ожидаемые параметры multipart/form-data:
 * - telegram_user_id (number/string) - ID Telegram пользователя
 * - photo (File) - JPEG изображение
 * - prompt (string) - Текстовый промпт на русском
 * - duration (number, опционально) - 6 или 10, по умолчанию 6
 */
export const POST: APIRoute = async (context) => {
  try {
    const contentType = context.request.headers.get('content-type');
    if (!contentType || !contentType.includes('multipart/form-data')) {
      return new Response(
        JSON.stringify({ error: 'Content-Type должен быть multipart/form-data' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Парсим multipart форму
    const formData = await context.request.formData();
    const telegramUserId = formData.get('telegram_user_id');
    const photoFile = formData.get('photo') as File | null;
    let prompt = (formData.get('prompt') as string) || '';
    let duration = parseInt((formData.get('duration') as string) || '6', 10);

    // Валидируем параметры
    if (!telegramUserId) {
      return new Response(
        JSON.stringify({ error: 'Требуется telegram_user_id' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!photoFile) {
      return new Response(
        JSON.stringify({ error: 'Требуется фото' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!photoFile.type.startsWith('image/jpeg')) {
      return new Response(
        JSON.stringify({ error: 'Только JPEG изображения' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!prompt || prompt.length < 3) {
      return new Response(
        JSON.stringify({ error: 'Промпт слишком короткий (минимум 3 символа)' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (prompt.length > 2000) {
      return new Response(
        JSON.stringify({ error: 'Промпт слишком длинный (максимум 2000 символов)' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (![6, 10].includes(duration)) {
      duration = 6;
    }

    // Сохраняем фото
    ensureTelegramUserStorageDir(telegramUserId);
    const imagePath = getTelegramUserImagePath(telegramUserId);
    const photoBuffer = Buffer.from(await photoFile.arrayBuffer());
    fs.writeFileSync(imagePath, photoBuffer);

    console.log(
      `[TG_GEN] Photo saved for telegram_user=${telegramUserId}, size=${photoBuffer.length}`
    );

    // Улучшаем промпт (ТОЛЬКО PROMPT MODE для Telegram)
    let promptFinal = prompt;
    try {
      const enhancePromise = enhancePrompt(prompt, 'prompt');
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 10000)
      );
      promptFinal = await Promise.race([enhancePromise, timeoutPromise]) as string;
      console.log(`[TG_GEN] Prompt enhanced`);
    } catch (e) {
      console.warn(`[TG_GEN] Prompt enhancement failed, using original`);
      promptFinal = prompt;
    }

    // Компилируем camera commands
    try {
      const cameraPromise = compileCameraCommands(promptFinal);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 12000)
      );
      promptFinal = await Promise.race([cameraPromise, timeoutPromise]) as string;
      console.log(`[TG_GEN] Camera commands compiled`);
    } catch (e) {
      console.warn(`[TG_GEN] Camera compilation failed, using enhanced prompt`);
    }

    // Создаем запись генерации
    const generationId = createTelegramGeneration(
      telegramUserId,
      duration,
      prompt,
      promptFinal
    );

    // Добавляем в очередь
    enqueueGeneration(generationId);

    // Запускаем обработку асинхронно
    processQueue().catch((err) => {
      console.error('[TG_GEN] Queue processor error:', err);
      notifyAdmin(
        'TG_GENERATION_ERROR',
        `Error processing Telegram generation ${generationId}`,
        `tg_${telegramUserId}`,
        generationId
      ).catch(() => {});
    });

    console.log(
      `[TG_GEN_START] telegram_user=${telegramUserId}, generation_id=${generationId}, prompt_len=${prompt.length}`
    );

    return new Response(
      JSON.stringify({
        success: true,
        generationId,
        status: 'queued',
        cost: duration === 6 ? 1 : 2,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[TG_GEN] Error:', errorMessage);
    return new Response(
      JSON.stringify({ error: 'Ошибка при генерации видео' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
