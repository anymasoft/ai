"use client";

import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAnalysisProgressStore } from "@/store/analysisProgressStore";

interface GenerateSwotButtonProps {
  competitorId: number;
  channelId: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
  isUpdate?: boolean;
}

export function GenerateSwotButton({
  competitorId,
  channelId,
  variant = "default",
  size = "lg",
  isUpdate = false,
}: GenerateSwotButtonProps) {
  const { start, finish, isGenerating } = useAnalysisProgressStore();
  const isGeneratingSWOT = isGenerating(channelId, 'swot');
  const router = useRouter();

  const handleGenerate = async () => {
    start(channelId, 'swot');

    try {
      const response = await fetch(`/api/channel/${competitorId}/summary`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate SWOT analysis");
      }

      const data = await response.json();

      toast(isUpdate ? "AI-анализ обновлён!" : "AI-анализ готов!", {
        description: isUpdate
          ? "SWOT-анализ успешно обновлён с актуальными данными."
          : "SWOT-анализ успешно сгенерирован. Страница обновляется...",
        duration: 3000,
      });

      // Перезагружаем страницу для отображения нового анализа
      router.refresh();
    } catch (error) {
      console.error("Error generating SWOT analysis:", error);

      toast.error("Ошибка генерации", {
        description:
          error instanceof Error
            ? error.message
            : "Не удалось сгенерировать AI-анализ. Попробуйте позже.",
        duration: 4000,
      });
    } finally {
      finish(channelId, 'swot');
    }
  };

  return (
    <Button
      onClick={handleGenerate}
      disabled={isGeneratingSWOT}
      className="cursor-pointer"
      size={size}
      variant={variant}
    >
      {isGeneratingSWOT ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {isUpdate ? "Обновляется..." : "Генерируется..."}
        </>
      ) : (
        <>
          <Sparkles className="mr-2 h-4 w-4" />
          {isUpdate ? "Обновить анализ" : "Сгенерировать AI SWOT-анализ"}
        </>
      )}
    </Button>
  );
}
