import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createClient } from "@libsql/client";
import { getYoutubeVideoDetails } from "@/lib/scrapecreators";

/**
 * POST /api/video/[videoId]/refresh-date
 *
 * Обновляет publishDate для одного видео.
 * Используется кнопкой ⟳ в UI когда publishDate = null.
 *
 * Логика:
 * 1. Делает 3 попытки получения publishDate (200ms → 400ms → 800ms)
 * 2. Если успех → сохраняет в БД
 * 3. Если не удалось → возвращает success: false, БД не меняет
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ videoId: string }> }
) {
  const dbPath = process.env.DATABASE_URL || "file:sqlite.db";
  const client = createClient({
    url: dbPath.startsWith("file:") ? dbPath : `file:${dbPath}`,
  });

  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      client.close();
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { videoId } = await context.params;

    if (!videoId) {
      client.close();
      return NextResponse.json({ error: "Video ID required" }, { status: 400 });
    }

    console.log(`[RefreshDate] Запрос обновления даты для ${videoId}`);

    // Проверяем что видео существует и принадлежит пользователю
    const videoResult = await client.execute({
      sql: `SELECT cv.id, cv.videoId, cv.publishDate
            FROM channel_videos cv
            JOIN competitors c ON cv.channelId = c.channelId
            WHERE cv.videoId = ? AND c.userId = ?`,
      args: [videoId, session.user.id],
    });

    if (videoResult.rows.length === 0) {
      client.close();
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    const video = videoResult.rows[0];

    // Получаем publishDate с retry
    const delays = [200, 400, 800];
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    let publishDate: string | null = null;

    for (let attempt = 0; attempt < delays.length; attempt++) {
      try {
        const details = await getYoutubeVideoDetails(videoUrl);

        if (details.publishDate) {
          publishDate = details.publishDate;
          console.log(`[RefreshDate] ${videoId}: получена дата ${publishDate}`);
          break;
        }

        console.log(`[RefreshDate] ${videoId}: API не вернул дату (попытка ${attempt + 1})`);
      } catch (err) {
        console.warn(`[RefreshDate] ${videoId}: ошибка (попытка ${attempt + 1}):`, err instanceof Error ? err.message : err);
      }

      if (attempt < delays.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delays[attempt]));
      }
    }

    if (!publishDate) {
      client.close();
      console.log(`[RefreshDate] ${videoId}: не удалось получить дату`);
      return NextResponse.json({
        success: false,
        message: "Не удалось получить дату публикации",
      });
    }

    // Сохраняем в БД
    await client.execute({
      sql: "UPDATE channel_videos SET publishDate = ? WHERE id = ?",
      args: [publishDate, video.id],
    });

    console.log(`[RefreshDate] ${videoId}: дата сохранена в БД`);

    client.close();

    return NextResponse.json({
      success: true,
      publishDate,
    });
  } catch (error) {
    client.close();
    console.error("[RefreshDate] Ошибка:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to refresh date" },
      { status: 500 }
    );
  }
}
