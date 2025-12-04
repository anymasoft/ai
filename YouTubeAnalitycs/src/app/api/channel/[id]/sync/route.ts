import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createClient } from "@libsql/client";
import { getYoutubeChannelByHandle } from "@/lib/scrapecreators";

/**
 * POST /api/channel/[id]/sync
 * Синхронизирует метрики канала с ScrapeCreators API
 * и сохраняет их в channel_metrics для построения графиков
 */
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

    // Проверка аутентификации
    if (!session?.user?.id) {
      client.close();
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const competitorId = parseInt(id, 10);

    if (!Number.isFinite(competitorId) || competitorId <= 0) {
      client.close();
      return NextResponse.json(
        { error: "Invalid competitor ID" },
        { status: 400 }
      );
    }

    console.log(`[Sync] Запрос синхронизации для competitor ID: ${competitorId}`);

    // Получаем данные канала из БД
    const competitorResult = await client.execute({
      sql: "SELECT * FROM competitors WHERE id = ? AND userId = ?",
      args: [competitorId, session.user.id],
    });

    // Проверяем что канал существует и принадлежит пользователю
    if (competitorResult.rows.length === 0) {
      client.close();
      return NextResponse.json(
        { error: "Competitor not found or access denied" },
        { status: 404 }
      );
    }

    const competitor = competitorResult.rows[0];

    console.log(`[Sync] Канал найден: ${competitor.title} (${competitor.handle})`);

    // Получаем актуальные данные из ScrapeCreators
    let channelData;
    try {
      channelData = await getYoutubeChannelByHandle(competitor.handle as string);
    } catch (error) {
      console.error("[Sync] Ошибка получения данных из ScrapeCreators:", error);
      client.close();
      return NextResponse.json(
        { error: "Failed to fetch channel data from ScrapeCreators" },
        { status: 500 }
      );
    }

    // Формируем сегодняшнюю дату в формате YYYY-MM-DD
    const today = new Date().toISOString().split("T")[0];

    console.log(`[Sync] Проверка наличия записи за ${today}`);

    // Проверяем, есть ли уже запись за сегодня
    const existingMetricsResult = await client.execute({
      sql: "SELECT * FROM channel_metrics WHERE channelId = ? AND date = ?",
      args: [competitor.channelId, today],
    });

    // TEMPORARY: Allow multiple syncs per day for testing (max 10)
    // In production, uncomment the check below to allow only 1 sync per day
    if (existingMetricsResult.rows.length >= 10) {
      console.log("[Sync] Maximum syncs per day reached (10)");
      client.close();
      return NextResponse.json({
        status: "exists",
        message: "Maximum syncs per day reached (10). Try again tomorrow.",
        date: today,
      });
    }

    // Production check (currently disabled for testing):
    // if (existingMetricsResult.rows.length > 0) {
    //   console.log("[Sync] Запись за сегодня уже существует");
    //   client.close();
    //   return NextResponse.json({
    //     status: "exists",
    //     message: "Metrics for today already exist. Try again tomorrow.",
    //     date: today,
    //   });
    // }

    console.log(`[Sync] Создаём запись (${existingMetricsResult.rows.length + 1}/10 за сегодня)`);

    // Вставляем новую запись в channel_metrics
    const newMetricResult = await client.execute({
      sql: `INSERT INTO channel_metrics (
        userId, channelId, subscriberCount, videoCount, viewCount, date, fetchedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        session.user.id,
        competitor.channelId,
        channelData.subscriberCount,
        channelData.videoCount,
        channelData.viewCount,
        today,
        Date.now(),
      ],
    });

    // Обновляем данные в таблице competitors
    await client.execute({
      sql: `UPDATE competitors SET
        subscriberCount = ?,
        videoCount = ?,
        viewCount = ?,
        lastSyncedAt = ?
        WHERE id = ?`,
      args: [
        channelData.subscriberCount,
        channelData.videoCount,
        channelData.viewCount,
        Date.now(),
        competitorId,
      ],
    });

    console.log(`[Sync] Метрики успешно синхронизированы (ID: ${newMetricResult.lastInsertRowid})`);

    // Count total metrics for this channel
    const totalMetricsResult = await client.execute({
      sql: "SELECT * FROM channel_metrics WHERE channelId = ?",
      args: [competitor.channelId],
    });

    client.close();

    return NextResponse.json(
      {
        status: "ok",
        message: `Metrics synced successfully (${totalMetricsResult.rows.length} data points)`,
        metrics: {
          id: Number(newMetricResult.lastInsertRowid),
          subscriberCount: channelData.subscriberCount,
          videoCount: channelData.videoCount,
          viewCount: channelData.viewCount,
          date: today,
          fetchedAt: Date.now(),
        },
        totalDataPoints: totalMetricsResult.rows.length,
      },
      { status: 201 }
    );
  } catch (error) {
    client.close();
    console.error("[Sync] Ошибка при синхронизации метрик:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to sync channel metrics" },
      { status: 500 }
    );
  }
}
