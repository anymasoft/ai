# MiniMax API Integration

## Протокол MiniMax для генерации видео

### 1. Создание задачи

**Endpoint:** `POST https://api.minimax.io/v1/video_generation`

**Headers:**
```
Authorization: Bearer {MINIMAX_API_KEY}
Content-Type: application/json
```

**Request Body:**
```json
{
  "model": "MiniMax-Hailuo-02",
  "first_frame_image": "data:image/jpeg;base64,...",
  "prompt": "Описание движения товара",
  "duration": 6,
  "resolution": "512P",
  "callback_url": "https://example.com/api/minimax_callback"
}
```

**Response (успех):**
```json
{
  "task_id": "task_12345",
  "status": "queued"
}
```

### 2. Callback от MiniMax

**Endpoint:** `POST /api/minimax_callback`

**Verification Ping (MiniMax проверяет живой ли callback):**
```json
{
  "challenge": "some_challenge_token"
}
```
**Ответ:**
```json
{
  "challenge": "some_challenge_token"
}
```

**Успешное завершение (status === "success"):**
```json
{
  "task_id": "task_12345",
  "status": "success",
  "file_id": "file_xyz789"
}
```

### 3. Получение видео

**Endpoint:** `GET https://api.minimax.io/v1/files/retrieve?file_id={file_id}`

**Headers:**
```
Authorization: Bearer {MINIMAX_API_KEY}
```

**Response:**
```json
{
  "file": {
    "file_id": "file_xyz789",
    "download_url": "https://minimax-cdn.../video.mp4",
    "size": 1024000,
    "created_at": 1234567890
  }
}
```

## Архитектура в Astrolus

### Files:
- `/src/lib/minimax/imageToBase64.ts` - конвертация изображения в base64 data URL
- `/src/lib/minimax/callMinimaxAPI.ts` - отправка задачи в MiniMax
- `/src/lib/minimax/downloadVideoFromMinimax.ts` - скачивание видео по callback'у
- `/src/pages/api/upload-image.ts` - загрузка изображения (jpg only)
- `/src/pages/api/generate.ts` - обновлено для вызова MiniMax вместо demo.mp4
- `/src/pages/api/minimax_callback.ts` - webhook для обработки callback'а от MiniMax

### Хранилище:
- `/uploads/image.jpg` - текущее загруженное изображение (перезапись)
- `/videos/output.mp4` - текущее сгенерированное видео (перезапись)

### БД (generations table):
- `minimax_job_id` - ID задачи в MiniMax
- `video_url` - URL видео после завершения
- `minimax_status` - статус обработки (pending, processing, success, failed)

## Переменные окружения

```
MINIMAX_API_KEY=sk-api-xxxxx
MINIMAX_CALLBACK_URL=https://example.com/api/minimax_callback
```

## Flow

```
1. Пользователь загружает картинку
   POST /api/upload-image → /uploads/image.jpg

2. Нажимает Generate
   POST /api/generate (prompt, duration)
   → callMinimaxAPI(prompt, duration)
   → сохранить task_id в БД
   → вернуть generationId

3. Клиент начинает polling
   GET /api/generate?generationId=...
   → status: processing

4. MiniMax обрабатывает видео (1-5 минут)

5. MiniMax отправляет callback
   POST /api/minimax_callback?generationId=...
   → downloadVideoFromMinimax(file_id)
   → сохранить в /videos/output.mp4
   → обновить БД: status=success, video_url=/videos/output.mp4
   → chargeGeneration()

6. Клиент получает videoUrl
   GET /api/generate?generationId=...
   → status: success, videoUrl: /videos/output.mp4

7. Показать видео в плеере
   videoOutput.src = /videos/output.mp4
```
