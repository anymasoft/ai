import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createClient } from "@libsql/client";
import { getYoutubeChannelByHandle } from "@/lib/scrapecreators";

/**
 * POST /api/channel/[id]/sync
 * Синхронизирует метрики канала с ScrapeCreators API
 * и обновляет competitors таблицу (без сохранения исторических метрик)
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

    // ОТКЛЮЧЕНО для разработки: Проверка частоты синхронизации (раз в 6 часов)
    // const lastSyncedAt = competitor.lastSyncedAt as number | null;
    // const sixHoursMs = 6 * 60 * 60 * 1000;
    // if (lastSyncedAt && Date.now() - lastSyncedAt < sixHoursMs) {
    //   client.close();
    //   return NextResponse.json(
    //     {
    //       error: "Sync allowed once per 6 hours",
    //       nextSyncAvailable: new Date(lastSyncedAt + sixHoursMs).toISOString(),
    //     },
    //     { status: 429 }
    //   );
    // }

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

    console.log(`[Sync] Обновление competitors таблицы`);

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

    console.log(`[Sync] Канал успешно синхронизирован`);

    client.close();

    return NextResponse.json(
      {
        status: "ok",
        message: "Channel synced successfully",
        metrics: {
          subscriberCount: channelData.subscriberCount,
          videoCount: channelData.videoCount,
          viewCount: channelData.viewCount,
          lastSyncedAt: Date.now(),
        },
      },
      { status: 200 }
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
