import type { APIRoute } from 'astro';
import fs from 'fs';
import { getUserFromSession } from '../../lib/auth';
import { getUserImagePath, ensureUserStorageDir } from '../../lib/minimax/storage';

/**
 * POST /api/upload-image
 * Загружает изображение товара (jpg only)
 * Файл сохраняется как /storage/<USER_KEY>/image.jpg (перезаписывается)
 */
export const POST: APIRoute = async (context) => {
  try {
    // Проверяем аутентификацию
    const sessionToken = context.cookies.get('session_token')?.value;
    const user = sessionToken ? getUserFromSession(sessionToken) : null;

    if (!user?.id) {
      return new Response(
        JSON.stringify({ error: 'Требуется аутентификация' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Проверяем Content-Type
    const contentType = context.request.headers.get('content-type');
    if (!contentType || !contentType.includes('multipart/form-data')) {
      return new Response(
        JSON.stringify({ error: 'Content-Type должен быть multipart/form-data' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Парсим multipart форму
    const formData = await context.request.formData();
    const imageFile = formData.get('image') as File | null;

    if (!imageFile) {
      return new Response(
        JSON.stringify({ error: 'Поле image не найдено' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Проверяем MIME type
    if (!imageFile.type.startsWith('image/jpeg')) {
      return new Response(
        JSON.stringify({ error: 'Разрешены только JPEG изображения' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Проверяем размер (максимум 50 MB)
    const maxSize = 50 * 1024 * 1024; // 50 MB
    if (imageFile.size > maxSize) {
      return new Response(
        JSON.stringify({ error: 'Размер файла не должен превышать 50 MB' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Создаем папку пользователя если её нет
    ensureUserStorageDir(user.id);

    // Получаем путь сохранения (per-user)
    const imagePath = getUserImagePath(user.id);

    // Преобразуем File в Buffer
    const buffer = Buffer.from(await imageFile.arrayBuffer());

    // Сохраняем файл (перезаписываем старый)
    fs.writeFileSync(imagePath, buffer);

    console.log(
      `[UPLOAD] ✅ Изображение загружено для пользователя ${user.id}: ${imagePath} (${buffer.length} байт)`
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Изображение загружено',
        imagePath: '/storage/image.jpg',
        userId: user.id,
        size: buffer.length,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[UPLOAD] Ошибка:', errorMessage);
    return new Response(
      JSON.stringify({ error: 'Ошибка при загрузке изображения' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
