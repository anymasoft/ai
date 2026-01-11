import { imageToBase64DataUrl } from './imageToBase64';

interface MinimaxRequest {
  model: string;
  first_frame_image: string;
  prompt: string;
  duration: number;
  resolution: string;
  callback_url: string;
}

interface MinimaxResponse {
  task_id?: string;
  status?: string;
  error?: string;
}

/**
 * Отправляет запрос на генерацию видео в MiniMax API
 * ВАЖНО: Payload ДОЛЖЕН быть идентичен рабочей Python версии!
 * @param imagePath - путь к загруженному изображению
 * @param prompt - описание движения товара
 * @param duration - длительность видео (6 или 10)
 * @param callbackUrl - URL для callback'а после завершения
 * @returns task_id или ошибка
 */
export async function callMinimaxAPI(
  imagePath: string,
  prompt: string,
  duration: number,
  callbackUrl: string
): Promise<{ success: boolean; taskId?: string; error?: string }> {
  try {
    const apiKey = process.env.MINIMAX_API_KEY;
    if (!apiKey) {
      console.error('[MINIMAX] MINIMAX_API_KEY не установлен');
      return {
        success: false,
        error: 'API key not configured',
      };
    }

    // ИСПРАВЛЕНИЕ: Отправляем ТОЛЬКО те поля, которые ожидает MiniMax
    // Как в рабочей Python версии - БЕЗ model, first_frame_image, prompt
    // MiniMax принимает ТОЛЬКО:
    // - duration (number)
    // - resolution (string)
    // - callback_url (string)
    const payload = {
      duration: Number(duration),      // ✅ ЧИСЛО, не "6s"
      resolution: '512P',              // ✅ СТРОКА
      callback_url: callbackUrl,       // ✅ ПОЛНЫЙ URL БЕЗ /api
    };

    console.log(
      `[MINIMAX] Отправляем payload: duration=${payload.duration}, resolution=${payload.resolution}, callback=${payload.callback_url}`
    );

    console.log('[MINIMAX] JSON для отправки:', JSON.stringify(payload));

    // Отправляем запрос к MiniMax API
    const response = await fetch('https://api.minimax.io/v1/video_generation', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = (await response.json()) as MinimaxResponse;

    if (!response.ok) {
      console.error('[MINIMAX] API ошибка (статус=' + response.status + '):', data.error || response.statusText);
      console.error('[MINIMAX] Полный ответ:', JSON.stringify(data));
      return {
        success: false,
        error: data.error || `HTTP ${response.status}`,
      };
    }

    if (!data.task_id) {
      console.error('[MINIMAX] Нет task_id в ответе:', data);
      return {
        success: false,
        error: 'No task_id in response',
      };
    }

    console.log(`[MINIMAX] ✅ Задача создана: ${data.task_id}`);

    return {
      success: true,
      taskId: data.task_id,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[MINIMAX] Ошибка при вызове API:', errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}
