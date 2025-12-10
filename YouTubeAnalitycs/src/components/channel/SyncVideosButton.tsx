"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Video } from "lucide-react";
import { toast } from "sonner";

interface SyncVideosButtonProps {
  channelId: number;
}

export function SyncVideosButton({ channelId }: SyncVideosButtonProps) {
  const [syncing, setSyncing] = useState(false);
  const router = useRouter();

  async function handleSync() {
    setSyncing(true);

    try {
      const response = await fetch(`/api/channel/${channelId}/videos/sync`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to sync videos");
        return;
      }

      const added = data.added || 0;
      const updated = data.updated || 0;
      const total = data.totalVideos || 0;

      toast.success(
        `Videos synced! ${added} new, ${updated} updated (total: ${total})`
      );

      // Обновляем данные страницы
      router.refresh();
    } catch (error) {
      toast.error("An error occurred while syncing videos");
      console.error("[SyncVideos] Error:", error);
    } finally {
      setSyncing(false);
      // Дополнительное обновление для гарантии
      router.refresh();
    }
  }

  return (
    <Button
      onClick={handleSync}
      disabled={syncing}
      variant="outline"
      size="sm"
      className="cursor-pointer"
    >
      <Video className={`h-4 w-4 mr-2 ${syncing ? "animate-pulse" : ""}`} />
      {syncing ? "Syncing..." : "Sync Top Videos"}
    </Button>
  );
}
