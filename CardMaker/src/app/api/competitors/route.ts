import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getYoutubeChannelByHandle } from "@/lib/scrapecreators";
import { syncChannelTopVideos } from "@/lib/sync-channel-videos";
import { syncChannelComments } from "@/lib/sync-channel-comments";
import { normalizeYoutubeInput } from "@/lib/youtube/normalize";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await db.execute({
      sql: `SELECT id, userId, platform, channelId, handle, title,
             avatarUrl, subscriberCount, videoCount, viewCount,
             lastSyncedAt, createdAt
             FROM competitors WHERE userId = ?`,
      args: [session.user.id],
    });

    console.log("[Competitors GET] Fetched competitors:", {
      count: result.rows.length,
      competitors: result.rows.map((r: any) => ({
        id: r.id,
        title: r.title,
        avatarUrl: r.avatarUrl,
        hasAvatarUrl: r.avatarUrl !== null && r.avatarUrl !== undefined,
      })),
    });

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error("Error fetching competitors:", error);
    return NextResponse.json(
      { error: "Failed to fetch competitors" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { handle } = body;

    if (!handle || typeof handle !== "string" || !handle.trim()) {
      return NextResponse.json(
        { error: "Handle is required" },
        { status: 400 }
      );
    }

    const normalized = normalizeYoutubeInput(handle);

    if (!normalized.normalizedHandle && !normalized.channelId) {
      return NextResponse.json(
        { error: "Invalid YouTube handle or URL" },
        { status: 400 }
      );
    }

    const handleToFetch = normalized.normalizedHandle || normalized.channelId || handle.trim();

    // Ensure user exists
    const userResult = await db.execute({
      sql: "SELECT * FROM users WHERE id = ?",
      args: [session.user.id],
    });

    if (userResult.rows.length === 0) {
      await db.execute({
        sql: `INSERT INTO users (id, email, name, image, emailVerified, role, plan, createdAt, updatedAt)
              VALUES (?, ?, ?, ?, ?, 'user', ?, ?, ?)`,
        args: [
          String(session.user.id),
          String(session.user.email || ""),
          session.user.name || null,
          session.user.image || null,
          null,
          (session.user as any).plan || "free",
          Date.now(),
          Date.now(),
        ],
      });
    }

    // Fetch channel data
    const channelData = await getYoutubeChannelByHandle(handleToFetch);

    console.log("[Competitors POST] Channel data received:", {
      channelId: channelData.channelId,
      title: channelData.title,
      avatarUrl: channelData.avatarUrl,
      subscriberCount: channelData.subscriberCount,
    });

    // Check if exists
    const existingResult = await db.execute({
      sql: "SELECT * FROM competitors WHERE userId = ? AND channelId = ?",
      args: [session.user.id, channelData.channelId],
    });

    if (existingResult.rows.length > 0) {
      return NextResponse.json(
        { error: "This competitor already exists in your list" },
        { status: 409 }
      );
    }

    // Prepare avatar URL
    const avatarUrlForDb = typeof channelData.avatarUrl === "string" && channelData.avatarUrl.trim()
      ? channelData.avatarUrl.trim()
      : null;

    console.log("[Competitors POST] Inserting with avatar URL:", {
      avatarUrl: avatarUrlForDb,
      isNull: avatarUrlForDb === null,
    });

    // Insert new competitor
    const insertResult = await db.execute({
      sql: `INSERT INTO competitors
            (userId, platform, channelId, handle, title, avatarUrl, subscriberCount, videoCount, viewCount, lastSyncedAt, createdAt)
            VALUES (?, 'youtube', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        String(session.user.id),
        String(channelData.channelId || ""),
        String(handleToFetch),
        String(channelData.title || "Unknown Channel"),
        avatarUrlForDb,
        Number.isFinite(channelData.subscriberCount) ? channelData.subscriberCount : 0,
        Number.isFinite(channelData.videoCount) ? channelData.videoCount : 0,
        Number.isFinite(channelData.viewCount) ? channelData.viewCount : 0,
        Date.now(),
        Date.now(),
      ],
    });

    // Get inserted record
    const newResult = await db.execute({
      sql: "SELECT * FROM competitors WHERE id = last_insert_rowid()",
      args: [],
    });

    console.log("[Competitors POST] Inserted record:", {
      id: newResult.rows[0]?.id,
      title: newResult.rows[0]?.title,
      avatarUrl: newResult.rows[0]?.avatarUrl,
      avatarUrlIsNull: newResult.rows[0]?.avatarUrl === null,
    });

    const newCompetitor = newResult.rows[0] as any;

    // Автоматическая синхронизация видео и комментариев после добавления конкурента
    if (newCompetitor && newCompetitor.channelId) {
      try {
        const syncResult = await syncChannelTopVideos(
          newCompetitor.channelId as string,
          newCompetitor.handle as string
        );

        if (!syncResult.success || syncResult.totalVideos === 0) {
          console.warn("[Competitors POST] Видео не получены, конкурент остается в БД");
        } else {
          // Синхронизировать комментарии только если видео успешно получены
          try {
            await syncChannelComments(newCompetitor.channelId as string);
          } catch (commentsError) {
            console.warn("[Competitors POST] Ошибка синхронизации комментариев (non-critical):", commentsError);
            // Не прерываем процесс добавления конкурента если синхронизация комментариев упала
          }
        }
      } catch (syncError) {
        console.error("[Competitors POST] Ошибка синхронизации видео:", syncError);
        // Не удаляем конкурента - он уже добавлен
        // Ошибка синхронизации не критична, видео загрузятся позже через retry
      }
    }

    return NextResponse.json(newCompetitor, { status: 201 });
  } catch (error) {
    console.error("Error adding competitor:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to add competitor" },
      { status: 500 }
    );
  }
}
