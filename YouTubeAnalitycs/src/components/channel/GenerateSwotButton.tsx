"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

interface GenerateSwotButtonProps {
  channelId: number;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
  isUpdate?: boolean;
}

export function GenerateSwotButton({
  channelId,
  variant = "default",
  size = "lg",
  isUpdate = false,
}: GenerateSwotButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleGenerate = async () => {
    setIsGenerating(true);

    try {
      const response = await fetch(`/api/channel/${channelId}/summary`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate SWOT analysis");
      }

      const data = await response.json();

      toast({
        title: isUpdate ? "AI-анализ обновлён!" : "AI-анализ готов!",
        description: isUpdate
          ? "SWOT-анализ успешно обновлён с актуальными данными."
          : "SWOT-анализ успешно сгенерирован. Страница обновляется...",
      });

      // Перезагружаем страницу для отображения нового анализа
      router.refresh();
    } catch (error) {
      console.error("Error generating SWOT analysis:", error);

      toast({
        title: "Ошибка генерации",
        description:
          error instanceof Error
            ? error.message
            : "Не удалось сгенерировать AI-анализ. Попробуйте позже.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button
      onClick={handleGenerate}
      disabled={isGenerating}
      className="cursor-pointer"
      size={size}
      variant={variant}
    >
      {isGenerating ? (
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
