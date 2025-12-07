"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { useRouter } from "next/navigation";
import Markdown from "react-markdown";

interface ContentIntelligenceData {
  report: string;
  format: "markdown";
  generatedAt?: number;
}

interface ContentIntelligenceBlockProps {
  channelId: number;
  initialData?: ContentIntelligenceData | null;
  hasRequiredData?: boolean;
}

interface Section {
  title: string;
  content: string;
}

/**
 * Парсит markdown отчёт и разделяет его на секции
 */
function parseSections(markdown: string): Section[] {
  const sections: Section[] = [];
  const lines = markdown.split("\n");
  let currentTitle = "";
  let currentContent: string[] = [];

  for (const line of lines) {
    // Ищем заголовки вида "## Название"
    if (line.startsWith("## ")) {
      if (currentTitle) {
        sections.push({
          title: currentTitle,
          content: currentContent.join("\n").trim()
        });
      }
      currentTitle = line.replace("## ", "").trim();
      currentContent = [];
    } else if (currentTitle) {
      currentContent.push(line);
    }
  }

  // Добавляем последнюю секцию
  if (currentTitle) {
    sections.push({
      title: currentTitle,
      content: currentContent.join("\n").trim()
    });
  }

  return sections;
}

/**
 * Компонент для отображения одной секции с функцией сворачивания
 */
function CollapsibleSection({
  section,
  isOpen,
  onToggle
}: {
  section: Section;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <Card>
      <CardHeader
        className="cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex-1">{section.title}</CardTitle>
          {isOpen ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      </CardHeader>
      {isOpen && (
        <CardContent>
          <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
            <Markdown
              components={{
                p: ({ node, ...props }) => <p className="mb-3 text-sm leading-relaxed" {...props} />,
                ul: ({ node, ...props }) => <ul className="list-disc list-inside space-y-2 mb-3" {...props} />,
                ol: ({ node, ...props }) => <ol className="list-decimal list-inside space-y-2 mb-3" {...props} />,
                li: ({ node, ...props }) => <li className="text-sm leading-relaxed" {...props} />,
                h3: ({ node, ...props }) => <h3 className="font-semibold mt-3 mb-2 text-sm" {...props} />,
                h4: ({ node, ...props }) => <h4 className="font-medium mt-2 mb-1 text-sm" {...props} />,
                strong: ({ node, ...props }) => <strong className="font-semibold" {...props} />,
                code: ({ node, ...props }) => <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono" {...props} />,
              }}
            >
              {section.content}
            </Markdown>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export function ContentIntelligenceBlock({
  channelId,
  initialData,
  hasRequiredData = true
}: ContentIntelligenceBlockProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ContentIntelligenceData | null>(initialData || null);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0])); // Первая секция открыта по умолчанию

  const sections = data ? parseSections(data.report) : [];

  async function handleGenerate() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/channel/${channelId}/content-intelligence`, {
        method: "POST",
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to generate analysis");
      }

      const result = await res.json();
      setData(result);
      setExpandedSections(new Set([0])); // Открываем первую секцию при новой генерации

      // Обновляем страницу чтобы показать новые данные
      router.refresh();
    } catch (err) {
      console.error("Error generating content intelligence:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function toggleSection(index: number) {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedSections(newExpanded);
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            Content Intelligence
          </CardTitle>
          <CardDescription>
            Аналитический отчёт об особенностях контент-стратегии
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Генерируется анализ...</p>
            <p className="text-sm text-muted-foreground mt-2">Это может занять 30-60 секунд</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            Content Intelligence
          </CardTitle>
          <CardDescription>
            Аналитический отчёт об особенностях контент-стратегии
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12">
            {!hasRequiredData ? (
              <>
                <p className="text-muted-foreground mb-2 text-center">
                  Сначала синхронизируйте видео
                </p>
                <p className="text-sm text-muted-foreground mb-4 text-center">
                  Нажмите кнопку "Sync Top Videos" выше, чтобы загрузить данные.
                </p>
                <Button
                  onClick={handleGenerate}
                  className="gap-2 cursor-pointer"
                  disabled
                  title="Сначала синхронизируйте видео"
                >
                  <Sparkles className="h-4 w-4" />
                  Сгенерировать анализ
                </Button>
              </>
            ) : (
              <>
                <p className="text-muted-foreground mb-4">
                  Получите подробный анализ контент-стратегии канала с конкретными рекомендациями.
                </p>
                <Button
                  onClick={handleGenerate}
                  className="gap-2 cursor-pointer"
                >
                  <Sparkles className="h-4 w-4" />
                  Сгенерировать анализ
                </Button>
              </>
            )}
            {error && (
              <p className="text-sm text-destructive mt-4">{error}</p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            Content Intelligence
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Аналитический отчёт об особенностях контент-стратегии
          </p>
        </div>
        <Button
          onClick={handleGenerate}
          variant="outline"
          size="sm"
          className="gap-2 cursor-pointer"
        >
          <Sparkles className="h-4 w-4" />
          Обновить анализ
        </Button>
      </div>

      {/* Collapsible Sections */}
      <div className="space-y-3">
        {sections.map((section, index) => (
          <CollapsibleSection
            key={index}
            section={section}
            isOpen={expandedSections.has(index)}
            onToggle={() => toggleSection(index)}
          />
        ))}
      </div>

      {data.generatedAt && (
        <p className="text-xs text-muted-foreground text-center">
          Анализ создан: {new Date(data.generatedAt).toLocaleString("ru-RU")}
        </p>
      )}
    </div>
  );
}
