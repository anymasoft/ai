"use client";

import { Loader2 } from "lucide-react";
import { CardContent } from "@/components/ui/card";

interface AnalysisLoadingStateProps {
  title: string;
  subtitle?: string;
}

/**
 * Унифицированный компонент для отображения состояния ожидания при генерации аналитики.
 *
 * Использует единый визуальный паттерн со spinner и текстами.
 *
 * @example
 * <AnalysisLoadingState
 *   title="Analyzing comments..."
 *   subtitle="This may take 15-25 seconds"
 * />
 */
export function AnalysisLoadingState({
  title,
  subtitle
}: AnalysisLoadingStateProps) {
  return (
    <CardContent className="space-y-4 pt-6">
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
        <p className="text-muted-foreground">{title}</p>
        {subtitle && (
          <p className="text-sm text-muted-foreground mt-2">{subtitle}</p>
        )}
      </div>
    </CardContent>
  );
}
