import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, competitors, channelVideos } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { getYoutubeChannelVideos } from "@/lib/scrapecreators";

/**
 * POST /api/channel/[id]/videos/sync
 * Синхронизирует топ видео канала с ScrapeCreators API
 * и сохраняет их в channel_videos для анализа контента
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    // Проверка аутентификации
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const competitorId = parseInt(id, 10);

    if (!Number.isFinite(competitorId) || competitorId <= 0) {
      return NextResponse.json(
        { error: "Invalid competitor ID" },
        { status: 400 }
      );
    }

    console.log(`[VideoSync] Запрос синхронизации видео для competitor ID: ${competitorId}`);

    // Получаем данные канала из БД
    const competitor = await db
      .select()
      .from(competitors)
      .where(
        and(
          eq(competitors.id, competitorId),
          eq(competitors.userId, session.user.id)
        )
      )
      .get();

    // Проверяем что канал существует и принадлежит пользователю
    if (!competitor) {
      return NextResponse.json(
        { error: "Competitor not found or access denied" },
        { status: 404 }
      );
    }

    console.log(`[VideoSync] Канал найден: ${competitor.title} (${competitor.handle})`);

    // Получаем видео из ScrapeCreators с fallback на handle
    let videos;
    try {
      videos = await getYoutubeChannelVideos(competitor.channelId, competitor.handle);
    } catch (error) {
      console.error("[VideoSync] Ошибка получения видео из ScrapeCreators:", error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Failed to fetch videos from ScrapeCreators" },
        { status: 500 }
      );
    }

    console.log(`[VideoSync] Получено ${videos.length} видео из API`);

    // Сохраняем или обновляем видео в БД
    let inserted = 0;
    let updated = 0;

    for (const video of videos) {
      // Проверяем, существует ли уже такое видео
      const existing = await db
        .select()
        .from(channelVideos)
        .where(
          and(
            eq(channelVideos.channelId, competitor.channelId),
            eq(channelVideos.videoId, video.videoId)
          )
        )
        .get();

      if (existing) {
        // Обновляем существующее видео
        await db
          .update(channelVideos)
          .set({
            title: video.title,
            thumbnailUrl: video.thumbnailUrl,
            viewCount: video.viewCount,
            publishedAt: video.publishedAt,
            fetchedAt: Date.now(),
          })
          .where(eq(channelVideos.id, existing.id))
          .run();
        updated++;
      } else {
        // Вставляем новое видео
        await db
          .insert(channelVideos)
          .values({
            channelId: competitor.channelId,
            videoId: video.videoId,
            title: video.title,
            thumbnailUrl: video.thumbnailUrl,
            viewCount: video.viewCount,
            publishedAt: video.publishedAt,
            fetchedAt: Date.now(),
          })
          .run();
        inserted++;
      }
    }

    console.log(`[VideoSync] Синхронизация завершена: ${inserted} добавлено, ${updated} обновлено`);

    // Подсчитываем общее количество видео для этого канала
    const totalVideos = await db
      .select()
      .from(channelVideos)
      .where(eq(channelVideos.channelId, competitor.channelId))
      .all();

    return NextResponse.json(
      {
        status: "ok",
        added: inserted,
        updated: updated,
        totalVideos: totalVideos.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[VideoSync] Ошибка при синхронизации видео:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to sync channel videos" },
      { status: 500 }
    );
  }
}
