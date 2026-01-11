import fs from 'fs';
import path from 'path';

/**
 * Нормализация USER_KEY для безопасного использования в пути
 * Разреши только [a-zA-Z0-9_-], остальное удали
 */
export function normalizeUserKey(userId: string): string {
  return userId.replace(/[^a-zA-Z0-9_-]/g, '');
}

/**
 * Получить путь к базовой папке пользователя
 */
export function getUserStoragePath(userId: string): string {
  const normalized = normalizeUserKey(userId);
  return path.join(process.cwd(), 'storage', normalized);
}

/**
 * Получить путь к image.jpg пользователя
 */
export function getUserImagePath(userId: string): string {
  const storageDir = getUserStoragePath(userId);
  return path.join(storageDir, 'image.jpg');
}

/**
 * Получить путь к output.mp4 пользователя
 */
export function getUserVideoPath(userId: string): string {
  const storageDir = getUserStoragePath(userId);
  return path.join(storageDir, 'output.mp4');
}

/**
 * Создать папку пользователя если её нет
 */
export function ensureUserStorageDir(userId: string): void {
  const storageDir = getUserStoragePath(userId);
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }
}

/**
 * Удалить файл если существует
 */
export function deleteFileIfExists(filePath: string): void {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

/**
 * Проверить что изображение существует для пользователя
 */
export function userImageExists(userId: string): boolean {
  const imagePath = getUserImagePath(userId);
  return fs.existsSync(imagePath);
}

/**
 * Проверить что видео существует для пользователя
 */
export function userVideoExists(userId: string): boolean {
  const videoPath = getUserVideoPath(userId);
  return fs.existsSync(videoPath);
}

/**
 * Прочитать видео файл пользователя
 */
export function readUserVideo(userId: string): Buffer | null {
  const videoPath = getUserVideoPath(userId);
  if (!fs.existsSync(videoPath)) {
    return null;
  }
  return fs.readFileSync(videoPath);
}
