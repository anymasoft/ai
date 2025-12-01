"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface SyncMetricsButtonProps {
  channelId: number;
}

export function SyncMetricsButton({ channelId }: SyncMetricsButtonProps) {
  const [syncing, setSyncing] = useState(false);
  const router = useRouter();

  async function handleSync() {
    setSyncing(true);

    try {
      const response = await fetch(`/api/channel/${channelId}/sync`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to sync metrics");
        return;
      }

      if (data.status === "exists") {
        toast.info(data.message || "Metrics for today already exist");
      } else {
        const dataPoints = data.totalDataPoints || 0;
        toast.success(
          data.message ||
          `Metrics synced successfully! (${dataPoints} data point${dataPoints !== 1 ? "s" : ""})`
        );
        // Refresh server component data
        router.refresh();
      }
    } catch (error) {
      toast.error("An error occurred while syncing metrics");
      console.error("[Sync] Error:", error);
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
      <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
      {syncing ? "Syncing..." : "Sync Metrics"}
    </Button>
  );
}
