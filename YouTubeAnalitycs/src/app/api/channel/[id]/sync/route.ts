import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, competitors, channelMetrics } from "@/lib/db";
import { eq, and } from "drizzle-orm";
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

    console.log(`[Sync] Запрос синхронизации для competitor ID: ${competitorId}`);

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

    console.log(`[Sync] Канал найден: ${competitor.title} (${competitor.handle})`);

    // Получаем актуальные данные из ScrapeCreators
    let channelData;
    try {
      channelData = await getYoutubeChannelByHandle(competitor.handle);
    } catch (error) {
      console.error("[Sync] Ошибка получения данных из ScrapeCreators:", error);
      return NextResponse.json(
        { error: "Failed to fetch channel data from ScrapeCreators" },
        { status: 500 }
      );
    }

    // Формируем сегодняшнюю дату в формате YYYY-MM-DD
    const today = new Date().toISOString().split("T")[0];

    console.log(`[Sync] Проверка наличия записи за ${today}`);

    // Проверяем, есть ли уже запись за сегодня
    const existingMetric = await db
      .select()
      .from(channelMetrics)
      .where(
        and(
          eq(channelMetrics.channelId, competitor.channelId),
          eq(channelMetrics.date, today)
        )
      )
      .get();

    if (existingMetric) {
      console.log("[Sync] Запись за сегодня уже существует, пропускаем");
      return NextResponse.json({
        status: "exists",
        message: "Metrics for today already exist",
        date: today,
      });
    }

    console.log("[Sync] Записи за сегодня нет, создаём новую");

    // Вставляем новую запись в channel_metrics
    const newMetric = await db
      .insert(channelMetrics)
      .values({
        userId: session.user.id,
        channelId: competitor.channelId,
        subscriberCount: channelData.subscriberCount,
        videoCount: channelData.videoCount,
        viewCount: channelData.viewCount,
        date: today,
        fetchedAt: Date.now(),
      })
      .returning()
      .get();

    // Обновляем данные в таблице competitors
    await db
      .update(competitors)
      .set({
        subscriberCount: channelData.subscriberCount,
        videoCount: channelData.videoCount,
        viewCount: channelData.viewCount,
        lastSyncedAt: Date.now(),
      })
      .where(eq(competitors.id, competitorId))
      .run();

    console.log(`[Sync] Метрики успешно синхронизированы (ID: ${newMetric.id})`);

    return NextResponse.json(
      {
        status: "ok",
        message: "Metrics synced successfully",
        metrics: {
          id: newMetric.id,
          subscriberCount: newMetric.subscriberCount,
          videoCount: newMetric.videoCount,
          viewCount: newMetric.viewCount,
          date: newMetric.date,
          fetchedAt: newMetric.fetchedAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
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
