import fs from 'fs';
import { getUserVideoPath, getGenerationVideoPath, ensureUserStorageDir } from './storage';

interface FileMetadata {
  file?: {
    download_url?: string;
  };
  download_url?: string;
}

/**
 * Получает метаданные файла и скачивает видео из MiniMax
 * @param fileId - ID файла от MiniMax
 * @param userId - ID пользователя (для определения пути)
 * @returns { success: boolean; filePath?: string; error?: string }
 */
export async function downloadVideoFromMinimax(
  fileId: string,
  userId: string,
  generationId?: string
): Promise<{ success: boolean; filePath?: string; error?: string }> {
  try {
    const apiKey = process.env.MINIMAX_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        error: 'API key not configured',
      };
    }

    console.log(
      `[DOWNLOAD] Получаем метаданные для file_id=${fileId}, userId=${userId}`
    );

    // Шаг 1: Получить метаданные файла
    const metaResponse = await fetch(
      `https://api.minimax.io/v1/files/retrieve?file_id=${fileId}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      }
    );

    const metaData = (await metaResponse.json()) as FileMetadata;

    if (!metaResponse.ok) {
      console.error('[DOWNLOAD] Ошибка получения метаданных:', metaData);
      return {
        success: false,
        error: `Failed to get file metadata: ${metaResponse.statusText}`,
      };
    }

    // Шаг 2: Найти download_url
    let downloadUrl: string | undefined;

    if (metaData.file?.download_url) {
      downloadUrl = metaData.file.download_url;
    } else if (metaData.download_url) {
      downloadUrl = metaData.download_url;
    }

    if (!downloadUrl) {
      console.error('[DOWNLOAD] Нет download_url в метаданных:', metaData);
      return {
        success: false,
        error: 'No download_url found',
      };
    }

    console.log(`[DOWNLOAD] Скачиваем видео с: ${downloadUrl}`);

    // Шаг 3: Скачать видео
    const videoResponse = await fetch(downloadUrl);

    if (!videoResponse.ok) {
      console.error(
        '[DOWNLOAD] Ошибка скачивания видео:',
        videoResponse.statusText
      );
      return {
        success: false,
        error: `Failed to download video: ${videoResponse.statusText}`,
      };
    }

    // Шаг 4: Сохранить видео в папку пользователя
    const videoBuffer = await videoResponse.arrayBuffer();

    // Создаем директорию пользователя если её нет
    ensureUserStorageDir(userId);

    // Получаем путь сохранения (per-user)
    const outputPath = getUserVideoPath(userId);

    // Сохраняем как output.mp4 (текущее видео пользователя)
    fs.writeFileSync(outputPath, Buffer.from(videoBuffer));

    // Сохраняем по ID генерации для истории
    if (generationId) {
      const genPath = getGenerationVideoPath(userId, generationId);
      fs.writeFileSync(genPath, Buffer.from(videoBuffer));
      console.log(`[DOWNLOAD] ✅ Видео сохранено: ${genPath} (${videoBuffer.byteLength} байт)`);
    } else {
      console.log(`[DOWNLOAD] ✅ Видео сохранено: ${outputPath} (${videoBuffer.byteLength} байт)`);
    }

    return {
      success: true,
      filePath: outputPath,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[DOWNLOAD] Ошибка:', errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}
