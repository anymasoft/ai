"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { useRouter } from "next/navigation";
import Markdown from "react-markdown";

interface TableTheme {
  name: string;
  videoCount: number;
  avgViews: number;
  trend: string;
}

interface TableFormat {
  name: string;
  videoCount: number;
  avgViews: number;
  features: string;
}

interface TablesJson {
  themes?: TableTheme[];
  formats?: TableFormat[];
}

interface ContentIntelligenceData {
  report?: string;
  format?: "markdown";
  tables?: TablesJson;
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
  tableKey?: "themes" | "formats"; // Если секция имеет структурированные данные
}

/**
 * Компонент для отображения красивой таблицы тем
 */
function ThemesTable({ themes }: { themes: TableTheme[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b-2 border-border">
            <th className="text-left px-4 py-3 font-semibold bg-muted/50">Тема</th>
            <th className="text-center px-4 py-3 font-semibold bg-muted/50">Видео</th>
            <th className="text-center px-4 py-3 font-semibold bg-muted/50">Просмотры</th>
            <th className="text-left px-4 py-3 font-semibold bg-muted/50">Тренд</th>
          </tr>
        </thead>
        <tbody>
          {themes.map((theme, idx) => (
            <tr key={idx} className="border-b border-border hover:bg-muted/30 transition-colors">
              <td className="px-4 py-3 text-left">{theme.name}</td>
              <td className="px-4 py-3 text-center font-medium">{theme.videoCount}</td>
              <td className="px-4 py-3 text-center font-medium">{theme.avgViews.toLocaleString("ru-RU")}</td>
              <td className="px-4 py-3 text-left text-sm text-muted-foreground">{theme.trend}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Компонент для отображения красивой таблицы форматов
 */
function FormatsTable({ formats }: { formats: TableFormat[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b-2 border-border">
            <th className="text-left px-4 py-3 font-semibold bg-muted/50">Формат</th>
            <th className="text-center px-4 py-3 font-semibold bg-muted/50">Видео</th>
            <th className="text-center px-4 py-3 font-semibold bg-muted/50">Просмотры</th>
            <th className="text-left px-4 py-3 font-semibold bg-muted/50">Особенности</th>
          </tr>
        </thead>
        <tbody>
          {formats.map((format, idx) => (
            <tr key={idx} className="border-b border-border hover:bg-muted/30 transition-colors">
              <td className="px-4 py-3 text-left">{format.name}</td>
              <td className="px-4 py-3 text-center font-medium">{format.videoCount}</td>
              <td className="px-4 py-3 text-center font-medium">{format.avgViews.toLocaleString("ru-RU")}</td>
              <td className="px-4 py-3 text-left text-sm text-muted-foreground">{format.features}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Безопасное разделение строки, защита от undefined/null
 */
function safeSplit(value: unknown, delimiter: string): string[] {
  if (typeof value !== "string") {
    if (value !== undefined && value !== null) {
      console.warn("[ContentIntelligence] Invalid content type, expected string but got:", typeof value);
    } else {
      console.warn("[ContentIntelligence] Missing or invalid content field");
    }
    return [];
  }
  if (value.trim() === "") {
    console.warn("[ContentIntelligence] Empty content field");
    return [];
  }
  return value.split(delimiter);
}

/**
 * Парсит markdown отчёт и разделяет его на секции
 * Также определяет, есть ли структурированные данные для таблиц
 */
function parseSections(markdown: unknown, tables?: TablesJson): Section[] {
  const sections: Section[] = [];
  const lines = safeSplit(markdown, "\n");

  // Если контент пустой, возвращаем пустой массив
  if (lines.length === 0) {
    return [];
  }

  let currentTitle = "";
  let currentContent: string[] = [];

  for (const line of lines) {
    // Ищем заголовки вида "## Название"
    if (line.startsWith("## ")) {
      if (currentTitle) {
        sections.push({
          title: currentTitle,
          content: currentContent.join("\n").trim(),
          tableKey: getTableKeyForTitle(currentTitle, tables)
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
      content: currentContent.join("\n").trim(),
      tableKey: getTableKeyForTitle(currentTitle, tables)
    });
  }

  return sections;
}

/**
 * Определяет, есть ли структурированные данные для этого раздела
 */
function getTableKeyForTitle(title: string, tables?: TablesJson): "themes" | "formats" | undefined {
  if (!tables) return undefined;

  const lowerTitle = title.toLowerCase();
  if (lowerTitle.includes("тема") && tables.themes) {
    return "themes";
  }
  if (lowerTitle.includes("формат") && tables.formats) {
    return "formats";
  }
  return undefined;
}

/**
 * Компонент для отображения одной секции с функцией сворачивания
 */
function CollapsibleSection({
  section,
  isOpen,
  onToggle,
  tablesData
}: {
  section: Section;
  isOpen: boolean;
  onToggle: () => void;
  tablesData?: TablesJson;
}) {
  // Если есть структурированные данные для таблицы, выводим красивый компонент
  const hasStructuredData = section.tableKey && tablesData;
  // Проверяем валидность контента
  const hasContent = section.content && section.content.trim().length > 0;

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
          {/* Если есть структурированные данные для таблицы - выводим её */}
          {hasStructuredData && section.tableKey === "themes" && tablesData.themes && (
            <div className="mb-4">
              <ThemesTable themes={tablesData.themes} />
            </div>
          )}
          {hasStructuredData && section.tableKey === "formats" && tablesData.formats && (
            <div className="mb-4">
              <FormatsTable formats={tablesData.formats} />
            </div>
          )}

          {/* Markdown контент секции (описание) */}
          {hasContent ? (
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
          ) : (
            <p className="text-sm text-muted-foreground">No content available</p>
          )}
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

  // Безопасное получение секций с защитой от undefined данных
  const sections = data && data.report
    ? parseSections(data.report, data.tables)
    : [];

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
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Генерируется анализ...</p>
          <p className="text-sm text-muted-foreground mt-2">Это может занять 30-60 секунд</p>
        </div>
      </CardContent>
    );
  }

  // Проверяем, нет ли данных или они пусты
  const hasValidData = data && data.report && data.report.trim().length > 0;

  if (!hasValidData) {
    return (
      <CardContent className="space-y-4 pt-6">
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
    );
  }

  return (
    <CardContent className="space-y-4 pt-6">
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
            tablesData={data?.tables}
          />
        ))}
      </div>

      {data.generatedAt && (
        <p className="text-xs text-muted-foreground text-center">
          Анализ создан: {new Date(data.generatedAt).toLocaleString("ru-RU")}
        </p>
      )}
    </CardContent>
  );
}
