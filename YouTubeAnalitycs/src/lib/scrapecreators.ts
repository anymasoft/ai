export interface ChannelData {
  channelId: string;
  title: string;
  avatarUrl: string;
  subscriberCount: number;
  videoCount: number;
  viewCount: number;
}

export async function getYoutubeChannelByHandle(
  handle: string
): Promise<ChannelData> {
  const apiKey = process.env.SCRAPECREATORS_API_KEY;

  if (!apiKey) {
    throw new Error("SCRAPECREATORS_API_KEY is not configured");
  }

  // Clean handle - remove @ symbol if present and any URL parts
  const cleanHandle = handle
    .replace(/^@/, "")
    .replace(/.*youtube\.com\/@?/, "")
    .replace(/.*youtube\.com\/channel\//, "")
    .split("/")[0]
    .trim();

  try {
    // ScrapeCreators YouTube Channel endpoint
    const response = await fetch(
      `https://api.scrapecreators.com/v1/youtube/channel?handle=${encodeURIComponent(cleanHandle)}`,
      {
        method: "GET",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();

      if (response.status === 400) {
        throw new Error("Invalid channel handle or URL");
      } else if (response.status === 401) {
        throw new Error("Invalid API key");
      } else if (response.status === 429) {
        throw new Error("Rate limit exceeded. Please try again later");
      } else if (response.status === 404) {
        throw new Error("Channel not found");
      } else {
        throw new Error(
          `ScrapeCreators API error: ${response.status} - ${errorText}`
        );
      }
    }

    const data = await response.json();

    // Map ScrapeCreators response to our ChannelData format
    return {
      channelId: data.channelId || data.id || "",
      title: data.title || data.name || "",
      avatarUrl: data.avatarUrl || data.thumbnail || data.avatar || "",
      subscriberCount: parseInt(data.subscriberCount || data.subscribers || "0"),
      videoCount: parseInt(data.videoCount || data.videos || "0"),
      viewCount: parseInt(data.viewCount || data.views || "0"),
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to fetch channel data");
  }
}
