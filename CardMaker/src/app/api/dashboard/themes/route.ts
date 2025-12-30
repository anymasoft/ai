import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

interface ThemeData {
  themes: string[];
  formats: string[];
  recommendations: string[];
  summary: string;
  generatedAt: number;
  videoCount: number;
}

interface AggregatedThemes {
  topThemes: Array<{ theme: string; count: number }>;
  topFormats: Array<{ format: string; count: number }>;
  allRecommendations: string[];
  latestSummary: string | null;
  sources: {
    trendingInsights: number;
    momentumInsights: number;
  };
}

/**
 * GET /api/dashboard/themes
 * Возвращает top semantic topics из trending insights и momentum insights
 * Агрегирует темы со всех источников
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // 1. Получаем последний trending insight пользователя
    const trendingResult = await db.execute({
      sql: `
        SELECT
          summary,
          themes,
          formats,
          recommendations,
          generatedAt,
          videoCount
        FROM trending_insights
        WHERE userId = ?
        ORDER BY generatedAt DESC
        LIMIT 5
      `,
      args: [userId],
    });

    // 2. Получаем channelIds конкурентов
    const channelIdsResult = await db.execute({
      sql: `SELECT channelId FROM competitors WHERE userId = ?`,
      args: [userId],
    });

    const channelIds = channelIdsResult.rows.map(row => row.channelId as string);

    // 3. Получаем momentum insights для всех каналов пользователя
    let momentumInsights: Array<{
      hotThemes: string[];
      hotFormats: string[];
      hotIdeas: string[];
      explanation: string;
    }> = [];

    if (channelIds.length > 0) {
      const placeholders = channelIds.map(() => "?").join(",");

      const momentumResult = await db.execute({
        sql: `
          SELECT
            channelId,
            data,
            generatedAt
          FROM momentum_insights
          WHERE channelId IN (${placeholders})
          ORDER BY generatedAt DESC
        `,
        args: [...channelIds],
      });

      // Парсим JSON данные из momentum insights
      momentumInsights = momentumResult.rows
        .map(row => {
          try {
            const data = JSON.parse(row.data as string);
            return {
              hotThemes: data.hotThemes || [],
              hotFormats: data.hotFormats || [],
              hotIdeas: data.hotIdeas || [],
              explanation: data.explanation || "",
            };
          } catch {
            return null;
          }
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);
    }

    // 4. Агрегируем темы из trending insights
    const themeCountMap = new Map<string, number>();
    const formatCountMap = new Map<string, number>();
    const allRecommendations: string[] = [];
    let latestSummary: string | null = null;

    trendingResult.rows.forEach((row, index) => {
      try {
        const themes = JSON.parse(row.themes as string) as string[];
        const formats = JSON.parse(row.formats as string) as string[];
        const recommendations = JSON.parse(row.recommendations as string) as string[];

        themes.forEach(theme => {
          themeCountMap.set(theme, (themeCountMap.get(theme) || 0) + 1);
        });

        formats.forEach(format => {
          formatCountMap.set(format, (formatCountMap.get(format) || 0) + 1);
        });

        if (index === 0) {
          latestSummary = row.summary as string;
          allRecommendations.push(...recommendations);
        }
      } catch {
        // Skip malformed JSON
      }
    });

    // 5. Агрегируем темы из momentum insights
    momentumInsights.forEach(insight => {
      insight.hotThemes.forEach(theme => {
        themeCountMap.set(theme, (themeCountMap.get(theme) || 0) + 1);
      });

      insight.hotFormats.forEach(format => {
        formatCountMap.set(format, (formatCountMap.get(format) || 0) + 1);
      });

      // Добавляем hot ideas как рекомендации
      insight.hotIdeas.forEach(idea => {
        if (!allRecommendations.includes(idea)) {
          allRecommendations.push(idea);
        }
      });
    });

    // 6. Сортируем и формируем топ темы и форматы
    const topThemes = Array.from(themeCountMap.entries())
      .map(([theme, count]) => ({ theme, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const topFormats = Array.from(formatCountMap.entries())
      .map(([format, count]) => ({ format, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // 7. Ограничиваем рекомендации
    const limitedRecommendations = allRecommendations.slice(0, 10);

    const aggregatedData: AggregatedThemes = {
      topThemes,
      topFormats,
      allRecommendations: limitedRecommendations,
      latestSummary,
      sources: {
        trendingInsights: trendingResult.rows.length,
        momentumInsights: momentumInsights.length,
      },
    };

    // 8. Дополнительно возвращаем последний полный trending insight
    let latestTrendingInsight: ThemeData | null = null;

    if (trendingResult.rows.length > 0) {
      const latest = trendingResult.rows[0];
      try {
        latestTrendingInsight = {
          themes: JSON.parse(latest.themes as string),
          formats: JSON.parse(latest.formats as string),
          recommendations: JSON.parse(latest.recommendations as string),
          summary: latest.summary as string,
          generatedAt: Number(latest.generatedAt),
          videoCount: Number(latest.videoCount),
        };
      } catch {
        // Skip if parsing fails
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        aggregated: aggregatedData,
        latest: latestTrendingInsight,
        hasData: topThemes.length > 0 || topFormats.length > 0,
      },
    });
  } catch (error) {
    console.error("[Dashboard Themes] Error:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Failed to fetch themes data" },
      { status: 500 }
    );
  }
}
