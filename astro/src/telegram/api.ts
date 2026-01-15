/**
 * API клиент для общения с Beem backend
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.BEEM_BASE_URL || 'http://localhost:4321';

interface GenerateResponse {
  success: boolean;
  generationId: string;
  status: string;
  cost: number;
  error?: string;
}

interface StatusResponse {
  success: boolean;
  generationId: string;
  status: string;
  video_url?: string;
  error?: string;
}

/**
 * Запустить генерацию видео
 * @param telegramUserId ID Telegram пользователя
 * @param photoPath Путь к локальному JPEG файлу
 * @param prompt Текстовый промпт
 * @param duration Длительность видео (6 или 10)
 */
export async function generateVideo(
  telegramUserId: number,
  photoPath: string,
  prompt: string,
  duration: number = 6
): Promise<GenerateResponse> {
  try {
    // Проверяем что файл существует
    if (!fs.existsSync(photoPath)) {
      throw new Error(`Photo file not found: ${photoPath}`);
    }

    // Читаем файл
    const photoBuffer = fs.readFileSync(photoPath);

    // Создаём FormData
    const formData = new FormData();
    formData.append(
      'photo',
      new Blob([photoBuffer], { type: 'image/jpeg' }),
      'photo.jpg'
    );
    formData.append('telegram_user_id', String(telegramUserId));
    formData.append('prompt', prompt);
    formData.append('duration', String(duration));

    // Отправляем запрос
    const response = await axios.post<GenerateResponse>(
      `${BASE_URL}/api/telegram/generate`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000,
      }
    );

    console.log(`[TELEGRAM-API] Generation started: ${response.data.generationId}`);
    return response.data;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[TELEGRAM-API] Generate error: ${message}`);
    throw error;
  }
}

/**
 * Получить статус генерации
 * @param generationId ID генерации
 */
export async function getGenerationStatus(
  generationId: string
): Promise<StatusResponse> {
  try {
    const response = await axios.get<StatusResponse>(
      `${BASE_URL}/api/telegram/status`,
      {
        params: { generation_id: generationId },
        timeout: 10000,
      }
    );

    return response.data;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[TELEGRAM-API] Status error: ${message}`);
    throw error;
  }
}

/**
 * Скачать видео по URL
 * @param videoUrl URL видео
 * @param outputPath Путь для сохранения
 */
export async function downloadVideo(
  videoUrl: string,
  outputPath: string
): Promise<void> {
  try {
    // Если URL локальный путь (начинается с /storage), читаем файл напрямую
    if (videoUrl.startsWith('/storage')) {
      const filePath = videoUrl.replace(/^\/storage/, path.join(process.cwd(), 'storage'));
      if (fs.existsSync(filePath)) {
        fs.copyFileSync(filePath, outputPath);
        console.log(`[TELEGRAM-API] Video copied from local path: ${filePath}`);
        return;
      }
    }

    // Иначе скачиваем по HTTP
    const response = await axios.get(videoUrl, {
      responseType: 'arraybuffer',
      timeout: 60000,
    });

    // Создаём папку если её нет
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Сохраняем файл
    fs.writeFileSync(outputPath, response.data);
    console.log(`[TELEGRAM-API] Video downloaded: ${outputPath}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[TELEGRAM-API] Download error: ${message}`);
    throw error;
  }
}

/**
 * Проверить доступность backend'а
 */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    await axios.get(`${BASE_URL}/`, { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}
