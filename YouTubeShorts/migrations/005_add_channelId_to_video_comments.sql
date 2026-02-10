-- Миграция для добавления колонки channelId в таблицу video_comments
-- Исправляет ошибку: SQLITE_ERROR: table video_comments has no column named channelId

-- 1. Добавить колонку channelId в таблицу video_comments
ALTER TABLE video_comments ADD COLUMN channelId TEXT;

-- 2. Обновить существующие записи (опционально, можно оставить NULL)
-- UPDATE video_comments SET channelId = (SELECT channelId FROM channel_videos WHERE videoId = video_comments.videoId LIMIT 1);

-- 3. Создать индекс для быстрого поиска комментариев по каналу
CREATE INDEX IF NOT EXISTS idx_video_comments_channelId
ON video_comments(channelId);

-- 4. Создать индекс для поиска комментариев по видео и каналу
CREATE INDEX IF NOT EXISTS idx_video_comments_videoId_channelId
ON video_comments(videoId, channelId);
