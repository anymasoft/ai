#!/usr/bin/env node

/**
 * Beem MVP Telegram Bot
 * Генерирует видео из фото и текста
 */

import 'dotenv/config';
import { Bot, InlineKeyboard, InputFile, Context } from 'grammy';
import fs from 'fs';
import path from 'path';
import { stateManager, UserState } from './state';
import {
  generateVideo,
  getGenerationStatus,
  downloadVideo,
  checkBackendHealth,
} from './api';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN) {
  throw new Error('TELEGRAM_BOT_TOKEN not set in .env');
}

const BASE_URL = process.env.BEEM_BASE_URL || 'http://localhost:4321';

// Создаём временную папку для фото и видео
const TEMP_DIR = path.join(process.cwd(), 'tmp', 'bot');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Инициализируем бота
const bot = new Bot(TOKEN);

/**
 * Логирование событий бота
 */
function logEvent(
  eventType: string,
  userId: number,
  details?: Record<string, any>
): void {
  const timestamp = new Date().toISOString();
  const msg = `[${timestamp}] [${eventType}] user=${userId}`;
  const extra = details ? ` ${JSON.stringify(details)}` : '';
  console.log(`${msg}${extra}`);
}

/**
 * Получить путь к фото пользователя
 */
function getUserPhotoPath(userId: number): string {
  return path.join(TEMP_DIR, `photo_${userId}.jpg`);
}

/**
 * Получить путь к видео пользователя
 */
function getUserVideoPath(userId: number): string {
  return path.join(TEMP_DIR, `video_${userId}.mp4`);
}

/**
 * Очистить файлы пользователя
 */
function cleanupUserFiles(userId: number): void {
  const photoPath = getUserPhotoPath(userId);
  const videoPath = getUserVideoPath(userId);

  if (fs.existsSync(photoPath)) {
    fs.unlinkSync(photoPath);
  }
  if (fs.existsSync(videoPath)) {
    fs.unlinkSync(videoPath);
  }
}

/**
 * /start - начало работы
 */
bot.command('start', async (ctx: Context) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  logEvent('BOT_START', userId);

  stateManager.resetState(userId);

  const welcomeText = `🎬 Добро пожаловать в Beem Video AI!

Я помогу тебе создать видео из фото и описания за несколько минут.

Вот как это работает:
1️⃣ Отправь фото (любое JPEG изображение)
2️⃣ Напиши, что должно происходить на видео
3️⃣ Нажми "Сгенерировать"
4️⃣ Жди готовое видео 🎥

Ограничения:
- Максимум 2000 символов в описании
- Только JPEG фото
- Генерация может занять 1-3 минуты

Начнём? 👇`;

  const keyboard = new InlineKeyboard().text('📸 Загрузить фото', 'start_photo');

  await ctx.reply(welcomeText, {
    reply_markup: keyboard,
  });
});

/**
 * Обработка кнопки "Загрузить фото"
 */
bot.callbackQuery('start_photo', async (ctx: Context) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  logEvent('BOT_PHOTO_REQUESTED', userId);

  stateManager.setState(userId, { step: 'waiting_photo' });

  await ctx.answerCallbackQuery();
  await ctx.reply('📸 Отправь мне фото в формате JPEG (можно сделать скриншот)');
});

/**
 * Обработка загрузки фото
 */
bot.on('message:photo', async (ctx: Context) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  logEvent('BOT_PHOTO_RECEIVED', userId);

  const photoMessage = ctx.message;
  if (!photoMessage?.photo) {
    await ctx.reply('❌ Не получилось обработать фото. Попробуй ещё раз.');
    return;
  }

  try {
    // Получаем самый большой размер фото
    const photo = photoMessage.photo[photoMessage.photo.length - 1];

    // Скачиваем файл с Telegram
    const file = await ctx.getFile();
    const fileLink = file.getUrl();

    // Сохраняем локально (используя встроенный метод)
    const photoPath = getUserPhotoPath(userId);
    const photoBuffer = await fetch(fileLink).then((r) => r.arrayBuffer());
    fs.writeFileSync(photoPath, Buffer.from(photoBuffer));

    stateManager.setState(userId, {
      step: 'waiting_prompt',
      photo_file_id: photo.file_id,
      photo_path: photoPath,
    });

    await ctx.reply(
      '✅ Фото загружено!\n\n📝 Теперь напиши, что должно происходить на видео (на русском).\n\nПримеры:\n- Красивый закат над горами с пением птиц\n- Кот прыгает по подушкам в комнате\n- Балет на сцене театра'
    );

    logEvent('BOT_PHOTO_SAVED', userId, { path: photoPath });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[BOT] Photo download error: ${msg}`);
    await ctx.reply('❌ Ошибка при загрузке фото. Попробуй ещё раз.');
  }
});

/**
 * Обработка текстового промпта
 */
bot.on('message:text', async (ctx: Context) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  const state = stateManager.getState(userId);
  const text = ctx.message?.text || '';

  // Игнорируем команды
  if (text.startsWith('/')) return;

  // Если ждём промпт
  if (state.step === 'waiting_prompt') {
    logEvent('BOT_PROMPT_RECEIVED', userId, { length: text.length });

    // Валидируем промпт
    if (text.length < 3) {
      await ctx.reply(
        '❌ Описание слишком короткое. Минимум 3 символа.'
      );
      return;
    }

    if (text.length > 2000) {
      await ctx.reply(
        '❌ Описание слишком длинное. Максимум 2000 символов.'
      );
      return;
    }

    stateManager.setState(userId, {
      step: 'confirm',
      prompt_text: text,
    });

    // Показываем confirm экран
    const summaryText = `📋 Резюме:

📸 Фото: загружено
📝 Описание: ${text}
⏱️ Длительность: 6 секунд

Всё верно?`;

    const keyboard = new InlineKeyboard()
      .text('✅ Сгенерировать', 'confirm_generate')
      .row()
      .text('✏️ Изменить текст', 'edit_prompt')
      .row()
      .text('📸 Заменить фото', 'replace_photo')
      .row()
      .text('❌ Отмена', 'cancel_generation');

    await ctx.reply(summaryText, { reply_markup: keyboard });
    return;
  }

  // Если находимся в других состояниях, игнорируем текст
  if (
    state.step !== 'waiting_photo' &&
    state.step !== 'confirm' &&
    state.step !== 'generating'
  ) {
    return;
  }
});

/**
 * Подтверждение и запуск генерации
 */
bot.callbackQuery('confirm_generate', async (ctx: Context) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  const state = stateManager.getState(userId);

  if (!state.photo_path || !state.prompt_text) {
    await ctx.answerCallbackQuery('❌ Ошибка: данные потеряны', {
      show_alert: true,
    });
    return;
  }

  logEvent('BOT_GENERATE_CLICK', userId);

  stateManager.setState(userId, { step: 'generating' });

  await ctx.answerCallbackQuery();
  const processingMsg = await ctx.reply(
    '⏳ Генерирую видео...\n\n(Это может занять 1-3 минуты)\n\n0%'
  );

  try {
    // Запускаем генерацию
    const generateResponse = await generateVideo(
      userId,
      state.photo_path,
      state.prompt_text,
      6
    );

    if (!generateResponse.success) {
      await ctx.editMessageText(
        processingMsg.message_id,
        'Отредактируй',
        'undefined',
        '❌ Ошибка при запуске генерации'
      );
      stateManager.setState(userId, { step: 'confirm' });
      return;
    }

    const generationId = generateResponse.generationId;
    stateManager.setState(userId, {
      last_generation_id: generationId,
      last_generation_status: 'queued',
    });

    logEvent('TG_GENERATE_CREATED', userId, { generation_id: generationId });

    // Начинаем polling
    let attempts = 0;
    const maxAttempts = 120; // 2 минуты * 60 / 1 сек = 120 попыток * 1 сек = 120 сек = 2 мин

    const pollStatus = async (): Promise<void> => {
      while (attempts < maxAttempts) {
        try {
          const statusResponse = await getGenerationStatus(generationId);
          const status = statusResponse.status;

          stateManager.setState(userId, {
            last_generation_status: status,
          });

          logEvent('TG_STATUS', userId, {
            generation_id: generationId,
            status,
          });

          // Обновляем прогресс
          const progress = Math.min(100, ((attempts + 1) / maxAttempts) * 100);
          try {
            await ctx.api.editMessageText(
              userId,
              processingMsg.message_id,
              `⏳ Генерирую видео...\n\n(Это может занять 1-3 минуты)\n\n${Math.floor(progress)}%`
            );
          } catch (e) {
            // Игнорируем ошибки редактирования
          }

          // Если видео готово
          if (status === 'done' && statusResponse.video_url) {
            logEvent('BOT_DONE', userId, { generation_id: generationId });

            try {
              await ctx.api.editMessageText(
                userId,
                processingMsg.message_id,
                '✅ Видео готово! Скачиваю...'
              );
            } catch (e) {
              // Игнорируем ошибки редактирования
            }

            // Скачиваем видео
            const videoPath = getUserVideoPath(userId);
            await downloadVideo(statusResponse.video_url, videoPath);

            // Отправляем видео
            const videoFile = new InputFile(videoPath);
            await ctx.replyWithVideo(videoFile, {
              caption: '🎬 Вот твоё видео!\n\nХочешь создать ещё одно?',
            });

            // Показываем кнопку для новой генерации
            const keyboard = new InlineKeyboard().text(
              '📸 Создать новое видео',
              'start_photo'
            );
            await ctx.reply('Начнём заново?', { reply_markup: keyboard });

            stateManager.resetState(userId);
            cleanupUserFiles(userId);
            return;
          }

          // Если ошибка
          if (status === 'failed') {
            logEvent('BOT_FAIL', userId, { generation_id: generationId });

            await ctx.api.editMessageText(
              userId,
              processingMsg.message_id,
              '❌ Ошибка при генерации видео. Попробуй ещё раз.'
            );

            stateManager.resetState(userId);
            cleanupUserFiles(userId);
            return;
          }

          // Ждём перед следующей попыткой
          await new Promise((resolve) => setTimeout(resolve, 1000));
          attempts++;
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          console.error(`[BOT] Status check error: ${msg}`);

          await new Promise((resolve) => setTimeout(resolve, 2000));
          attempts++;
        }
      }

      // Timeout - видео генерируется слишком долго
      logEvent('BOT_TIMEOUT', userId, { generation_id: generationId });

      await ctx.api.editMessageText(
        userId,
        processingMsg.message_id,
        '⏱️ Генерация заняла слишком много времени. Попробуй ещё раз позже.'
      );

      stateManager.resetState(userId);
      cleanupUserFiles(userId);
    };

    // Запускаем polling
    await pollStatus();
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[BOT] Generation error: ${msg}`);

    logEvent('BOT_ERROR', userId, { error: msg });

    await ctx.api.editMessageText(
      userId,
      processingMsg.message_id,
      `❌ Ошибка при генерации видео:\n\n${msg}`
    );

    stateManager.resetState(userId);
    cleanupUserFiles(userId);
  }
});

/**
 * Изменить текст промпта
 */
bot.callbackQuery('edit_prompt', async (ctx: Context) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  logEvent('BOT_EDIT_PROMPT', userId);

  stateManager.setState(userId, { step: 'waiting_prompt' });

  await ctx.answerCallbackQuery();
  await ctx.reply('✏️ Напиши новое описание:');
});

/**
 * Заменить фото
 */
bot.callbackQuery('replace_photo', async (ctx: Context) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  logEvent('BOT_REPLACE_PHOTO', userId);

  stateManager.setState(userId, { step: 'waiting_photo' });

  await ctx.answerCallbackQuery();
  await ctx.reply('📸 Отправь новое фото:');
});

/**
 * Отмена
 */
bot.callbackQuery('cancel_generation', async (ctx: Context) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  logEvent('BOT_CANCEL', userId);

  stateManager.resetState(userId);
  cleanupUserFiles(userId);

  await ctx.answerCallbackQuery();

  const keyboard = new InlineKeyboard().text('📸 Загрузить фото', 'start_photo');
  await ctx.reply('❌ Отменено. Начнём сначала?', {
    reply_markup: keyboard,
  });
});

/**
 * Обработка ошибок
 */
bot.catch((err) => {
  console.error('[BOT] Unhandled error:', err);
});

/**
 * Запуск бота
 */
async function main() {
  console.log('🤖 Starting Beem Telegram Bot...');

  // Проверяем backend
  console.log(`📡 Checking backend at ${BASE_URL}...`);
  const isHealthy = await checkBackendHealth();
  if (!isHealthy) {
    console.warn(`⚠️  Backend may not be available at ${BASE_URL}`);
    console.warn('   Make sure Astro is running: npm run dev (in /astro)');
  } else {
    console.log('✅ Backend is available');
  }

  console.log('✅ Bot is running!');
  console.log(`📱 Send /start to @${bot.botInfo?.username || 'bot'} to begin`);

  await bot.start({
    onStart: (botInfo) => {
      console.log(`✅ Logged in as @${botInfo.username}`);
    },
  });
}

main().catch((err) => {
  console.error('Failed to start bot:', err);
  process.exit(1);
});
