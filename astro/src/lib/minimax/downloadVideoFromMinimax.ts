import fs from 'fs';
import path from 'path';

interface FileMetadata {
  file?: {
    download_url?: string;
  };
  download_url?: string;
}

/**
 * Получает метаданные файла и скачивает видео из MiniMax
 * @param fileId - ID файла от MiniMax
 * @param outputPath - путь где сохранить видео
 * @returns { success: boolean; filePath?: string; error?: string }
 */
export async function downloadVideoFromMinimax(
  fileId: string,
  outputPath: string = './videos/output.mp4'
): Promise<{ success: boolean; filePath?: string; error?: string }> {
  try {
    const apiKey = process.env.MINIMAX_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        error: 'API key not configured',
      };
    }

    console.log(`[DOWNLOAD] Получаем метаданные для file_id=${fileId}`);

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
      console.error('[DOWNLOAD] Ошибка скачивания видео:', videoResponse.statusText);
      return {
        success: false,
        error: `Failed to download video: ${videoResponse.statusText}`,
      };
    }

    // Шаг 4: Сохранить видео на диск
    const videoBuffer = await videoResponse.arrayBuffer();

    // Создаем директорию если её нет
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`[DOWNLOAD] Создана папка: ${dir}`);
    }

    // Сохраняем видео (перезаписываем старый файл)
    fs.writeFileSync(outputPath, Buffer.from(videoBuffer));

    console.log(`[DOWNLOAD] ✅ Видео сохранено: ${outputPath} (${videoBuffer.byteLength} байт)`);

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
