"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";
import { toast } from "sonner";

interface SyncCommentsButtonProps {
  channelId: number;
}

export function SyncCommentsButton({ channelId }: SyncCommentsButtonProps) {
  const [syncing, setSyncing] = useState(false);
  const router = useRouter();

  async function handleSync() {
    setSyncing(true);

    try {
      const response = await fetch(`/api/channel/${channelId}/comments/sync`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        // Специальная обработка для ошибки отсутствия кредитов
        if (response.status === 402 || data.insufficientCredits) {
          const synced = data.synced || 0;
          const totalComments = data.totalComments || 0;

          if (synced > 0) {
            toast.warning(
              `Частично синхронизировано: ${synced} видео (${totalComments} комментариев). ${data.error}`,
              { duration: 8000 }
            );
          } else {
            toast.error(data.error || "Закончились кредиты ScrapeCreators API", {
              duration: 8000,
            });
          }

          // Обновляем страницу даже при частичной синхронизации
          router.refresh();
          return;
        }

        toast.error(data.error || "Failed to sync comments");
        return;
      }

      const synced = data.synced || 0;
      const skipped = data.skipped || 0;
      const totalComments = data.totalComments || 0;

      toast.success(
        `Comments synced! ${synced} videos synced, ${skipped} skipped (total comments: ${totalComments})`
      );

      // Обновляем данные страницы
      router.refresh();
    } catch (error) {
      toast.error("An error occurred while syncing comments");
      console.error("[SyncComments] Error:", error);
    } finally {
      setSyncing(false);
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
      <MessageSquare className={`h-4 w-4 mr-2 ${syncing ? "animate-pulse" : ""}`} />
      {syncing ? "Syncing..." : "Sync Comments"}
    </Button>
  );
}
