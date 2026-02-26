import fs from 'fs';
import path from 'path';

/**
 * Конвертирует изображение в data URL (base64)
 * @param imagePath - путь к файлу изображения
 * @returns data URL вида "data:image/jpeg;base64,..."
 */
export async function imageToBase64DataUrl(
  imagePath: string
): Promise<string> {
  try {
    // Убедимся, что путь безопасен
    const absolutePath = path.resolve(imagePath);

    // Проверим, существует ли файл
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`Image not found: ${imagePath}`);
    }

    // Прочитаем файл
    const imageBuffer = fs.readFileSync(absolutePath);

    // Конвертируем в base64
    const base64String = imageBuffer.toString('base64');

    // Возвращаем data URL
    return `data:image/jpeg;base64,${base64String}`;
  } catch (error) {
    console.error('[BASE64] Error converting image:', error);
    throw error;
  }
}
