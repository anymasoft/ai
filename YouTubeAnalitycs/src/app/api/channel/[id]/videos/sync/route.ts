import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createClient } from "@libsql/client";
import { syncChannelTopVideos } from "@/lib/sync-channel-videos";
import { getUserPlan } from "@/lib/user-plan";

/**
 * POST /api/channel/[id]/videos/sync
 *
 * Новая архитектура TOP-12 ONLY:
 * 1. id = channelId (строка)
 * 2. Проверяем авторизацию (пользователь должен иметь доступ к этому каналу)
 * 3. Вызываем syncChannelTopVideos() которая:
 *    - Проверяет есть ли уже 12 видео в БД
 *    - Если нет → идет в ScrapeCreators, получает TOP-12
 *    - Сохраняет в БД (глобально, без привязки к пользователю)
 * 4. Возвращаем результат с видео
 */

function normalizeVideoForResponse(video: any) {
  return {
    id: video.id,
    channelId: video.channelId,
    videoId: video.videoId,
    title: video.title ?? "Untitled",
    thumbnailUrl: video.thumbnailUrl ?? null,
    viewCountInt: typeof video.viewCountInt === "number" && Number.isFinite(video.viewCountInt) ? video.viewCountInt : 0,
    likeCountInt: typeof video.likeCountInt === "number" && Number.isFinite(video.likeCountInt) ? video.likeCountInt : 0,
    commentCountInt: typeof video.commentCountInt === "number" && Number.isFinite(video.commentCountInt) ? video.commentCountInt : 0,
    publishDate: video.publishDate ?? null,
    durationSeconds: video.durationSeconds ?? null,
    fetchedAt: video.fetchedAt ?? Date.now(),
    updatedAt: video.updatedAt ?? Date.now(),
  };
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const dbPath = process.env.DATABASE_URL || "file:sqlite.db";
  const client = createClient({
    url: dbPath.startsWith("file:") ? dbPath : `file:${dbPath}`,
  });

  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      client.close();
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    // Защита: id должен быть непустой строкой (это channelId)
    if (!id || typeof id !== "string" || id.trim() === "" || id === "undefined") {
      client.close();
      return NextResponse.json({ success: false, error: "channelId is missing or invalid" }, { status: 400 });
    }

    const channelId = id;
    console.log(`[Sync] Начало синхронизации для channelId: ${channelId}`);

    // Проверяем авторизацию: пользователь должен иметь этот канал в конкурентах
    const competitorResult = await client.execute({
      sql: "SELECT id, title, handle FROM competitors WHERE channelId = ? AND userId = ?",
      args: [channelId, session.user.id],
    });

    if (competitorResult.rows.length === 0) {
      client.close();
      return NextResponse.json({ success: false, error: "Channel not found or not authorized" }, { status: 404 });
    }

    const competitor = competitorResult.rows[0] as any;
    console.log(`[Sync] Авторизирован. Канал: ${competitor.title}`);

    // Вызываем функцию синхронизации
    const syncResult = await syncChannelTopVideos(channelId, competitor.handle);

    if (!syncResult.success) {
      client.close();
      return NextResponse.json(
        { success: false, error: "Failed to sync videos" },
        { status: 500 }
      );
    }

    // Получаем видео из БД для ответа
    const videosResult = await client.execute({
      sql: `SELECT id, channelId, videoId, title, thumbnailUrl, viewCountInt, likeCountInt, commentCountInt,
             publishDate, durationSeconds, fetchedAt, updatedAt
             FROM channel_videos
             WHERE channelId = ?
             ORDER BY viewCountInt DESC
             LIMIT 12`,
      args: [channelId],
    });

    const videos = (videosResult.rows || []).map(normalizeVideoForResponse);
    const totalCount = videos.length;

    console.log(`[Sync] Возвращаем ${totalCount} видео для channelId: ${channelId}`);

    client.close();

    return NextResponse.json({
      success: true,
      videos,
      totalVideos: totalCount,
      source: syncResult.source,
      plan: getUserPlan(session),
      videoLimit: 12,
    });
  } catch (error) {
    client.close();
    const errorMessage = error instanceof Error ? error.message : "Sync failed";
    console.error("[Sync] Ошибка:", error);
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
