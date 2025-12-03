"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/providers/I18nProvider";

interface SyncAllDataButtonProps {
  channelId: number;
}

type SyncStep = "metrics" | "videos" | "comments" | "idle";

export function SyncAllDataButton({ channelId }: SyncAllDataButtonProps) {
  const [syncing, setSyncing] = useState(false);
  const [currentStep, setCurrentStep] = useState<SyncStep>("idle");
  const router = useRouter();
  const { dict } = useI18n();

  async function handleSyncAll() {
    setSyncing(true);

    try {
      // Step 1: Sync Metrics
      setCurrentStep("metrics");
      const metricsResponse = await fetch(`/api/channel/${channelId}/sync`, {
        method: "POST",
      });

      const metricsData = await metricsResponse.json();

      if (!metricsResponse.ok) {
        toast.error(`Metrics sync failed: ${metricsData.error || "Unknown error"}`);
        return;
      }

      if (metricsData.status === "exists") {
        toast.info("Syncing 1/3: Metrics already up to date");
      } else {
        const dataPoints = metricsData.totalDataPoints || 0;
        toast.success(`Syncing 1/3: Metrics synced (${dataPoints} data points)`);
      }

      // Step 2: Sync Videos
      setCurrentStep("videos");
      const videosResponse = await fetch(`/api/channel/${channelId}/videos/sync`, {
        method: "POST",
      });

      const videosData = await videosResponse.json();

      if (!videosResponse.ok) {
        toast.error(`Videos sync failed: ${videosData.error || "Unknown error"}`);
        return;
      }

      const added = videosData.added || 0;
      const updated = videosData.updated || 0;
      const total = videosData.totalVideos || 0;
      toast.success(`Syncing 2/3: Videos synced (${added} new, ${updated} updated, total: ${total})`);

      // Step 3: Sync Comments
      setCurrentStep("comments");
      const commentsResponse = await fetch(`/api/channel/${channelId}/comments/sync`, {
        method: "POST",
      });

      const commentsData = await commentsResponse.json();

      if (!commentsResponse.ok) {
        // Special handling for insufficient credits (402)
        if (commentsResponse.status === 402 || commentsData.insufficientCredits) {
          const synced = commentsData.synced || 0;
          const totalComments = commentsData.totalComments || 0;

          if (synced > 0) {
            toast.warning(
              `Syncing 3/3: Partially synced ${synced} videos (${totalComments} comments). ${commentsData.error}`,
              { duration: 8000 }
            );
          } else {
            toast.error(`Comments sync failed: ${commentsData.error || "Insufficient credits"}`, {
              duration: 8000,
            });
          }

          // Refresh page even with partial sync
          router.refresh();
          return;
        }

        toast.error(`Comments sync failed: ${commentsData.error || "Unknown error"}`);
        return;
      }

      const synced = commentsData.synced || 0;
      const skipped = commentsData.skipped || 0;
      const totalComments = commentsData.totalComments || 0;
      toast.success(
        `Syncing 3/3: Comments synced (${synced} videos, ${skipped} skipped, ${totalComments} comments)`
      );

      // All steps completed successfully
      toast.success("All data synced successfully!", { duration: 5000 });
      router.refresh();
    } catch (error) {
      toast.error("An error occurred during sync");
      console.error("[SyncAllData] Error:", error);
    } finally {
      setSyncing(false);
      setCurrentStep("idle");
    }
  }

  // Generate button text based on current step
  const getButtonText = () => {
    if (!syncing) return dict.syncAll;

    switch (currentStep) {
      case "metrics":
        return `${dict.syncing} 1/3: ${dict.syncMetrics}...`;
      case "videos":
        return `${dict.syncing} 2/3: ${dict.syncVideos}...`;
      case "comments":
        return `${dict.syncing} 3/3: ${dict.syncComments}...`;
      default:
        return `${dict.syncing}...`;
    }
  };

  return (
    <Button
      onClick={handleSyncAll}
      disabled={syncing}
      variant="default"
      size="sm"
      className="cursor-pointer"
    >
      <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
      {getButtonText()}
    </Button>
  );
}
