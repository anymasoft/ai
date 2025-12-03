import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, competitors, users } from "@/lib/db";
import { getYoutubeChannelByHandle } from "@/lib/scrapecreators";
import { eq, and } from "drizzle-orm";
import { PLAN_LIMITS } from "@/lib/plan-limits";
import { normalizeYoutubeInput } from "@/lib/youtube/normalize";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userCompetitors = await db
      .select()
      .from(competitors)
      .where(eq(competitors.userId, session.user.id))
      .all();

    return NextResponse.json(userCompetitors);
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

    // Normalize YouTube input (поддержка URLs, @handles, Unicode)
    const normalized = normalizeYoutubeInput(handle);

    if (!normalized.normalizedHandle && !normalized.channelId) {
      return NextResponse.json(
        { error: "Invalid YouTube handle or URL" },
        { status: 400 }
      );
    }

    // Используем normalizedHandle для API запроса
    const handleToFetch = normalized.normalizedHandle || normalized.channelId || handle.trim();

    // Check current competitor count
    const currentCompetitors = await db
      .select()
      .from(competitors)
      .where(eq(competitors.userId, session.user.id))
      .all();

    // Ensure user exists in database (for FOREIGN KEY constraint)
    let user = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .get();

    // If user doesn't exist in DB, create them
    if (!user) {
      await db
        .insert(users)
        .values({
          id: String(session.user.id),
          email: String(session.user.email || ""),
          name: session.user.name || null,
          image: session.user.image || null,
          emailVerified: null,
          role: "user",
          plan: session.user.plan || "free",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        })
        .run();

      // Fetch the newly created user
      user = await db
        .select()
        .from(users)
        .where(eq(users.id, session.user.id))
        .get();
    }

    const plan = user?.plan || session.user.plan || "free";

    // Get limit based on plan
    const limit = PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS] ?? 3;

    if (currentCompetitors.length >= limit) {
      return NextResponse.json(
        {
          error: `Competitor limit reached for your plan (${limit} max). Upgrade to add more.`,
        },
        { status: 402 }
      );
    }

    // Fetch channel data from ScrapeCreators (используем нормализованный handle)
    const channelData = await getYoutubeChannelByHandle(handleToFetch);

    // Check if this channel already exists for this user
    const existing = await db
      .select()
      .from(competitors)
      .where(
        and(
          eq(competitors.userId, session.user.id),
          eq(competitors.channelId, channelData.channelId)
        )
      )
      .get();

    if (existing) {
      return NextResponse.json(
        { error: "This competitor already exists in your list" },
        { status: 409 }
      );
    }

    // Insert new competitor
    const result = await db
      .insert(competitors)
      .values({
        userId: String(session.user.id),
        platform: "youtube",
        channelId: String(channelData.channelId || ""),
        handle: String(handleToFetch), // Сохраняем нормализованный handle
        title: String(channelData.title || "Unknown Channel"),
        avatarUrl:
          typeof channelData.avatarUrl === "string" &&
          channelData.avatarUrl.trim()
            ? channelData.avatarUrl.trim()
            : null,
        subscriberCount: Number.isFinite(channelData.subscriberCount)
          ? channelData.subscriberCount
          : 0,
        videoCount: Number.isFinite(channelData.videoCount)
          ? channelData.videoCount
          : 0,
        viewCount: Number.isFinite(channelData.viewCount)
          ? channelData.viewCount
          : 0,
        lastSyncedAt: Date.now(),
        createdAt: Date.now(),
      })
      .returning()
      .get();

    return NextResponse.json(result, { status: 201 });
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
