"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ChevronDown, ChevronUp, Target, BarChart3, Lightbulb } from "lucide-react"
import { GenerateSwotButton } from "@/components/channel/GenerateSwotButton"
import type { SwotPoint, VideoIdea } from "@/lib/ai/analyzeChannel"

interface SWOTAnalysisBlockProps {
  channelId: number
  insight: {
    strengths: SwotPoint[]
    weaknesses: SwotPoint[]
    opportunities: SwotPoint[]
    threats: SwotPoint[]
    strategicSummary?: string[]
    contentPatterns?: string[]
    videoIdeas?: VideoIdea[]
    generatedAt: string
  } | null
}

export function SWOTAnalysisBlock({
  channelId,
  insight,
}: SWOTAnalysisBlockProps) {
  const [isOpen, setIsOpen] = useState(false)

  if (!insight) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Lightbulb className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">SWOT-анализ не сгенерирован</h3>
          <p className="text-sm text-muted-foreground mb-6 text-center max-w-md">
            Получите детальный AI-анализ канала с рекомендациями и идеями для новых видео
          </p>
          <GenerateSwotButton channelId={channelId} />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader
        className="cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">AI SWOT-анализ канала</h2>
          {isOpen ? (
            <ChevronUp className="h-6 w-6 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-6 w-6 text-muted-foreground" />
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          Сгенерировано: {new Date(insight.generatedAt).toLocaleDateString('ru-RU', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </p>
      </CardHeader>

      {isOpen && (
        <CardContent className="space-y-6">
          <div className="flex justify-end">
            <GenerateSwotButton channelId={channelId} variant="outline" size="sm" isUpdate={true} />
          </div>

          {/* Strategic Summary */}
          {insight.strategicSummary && insight.strategicSummary.length > 0 && (
            <div>
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                Стратегическое резюме
              </h3>
              <div className="space-y-3">
                {insight.strategicSummary.map((paragraph, idx) => (
                  <p key={idx} className="text-sm text-muted-foreground leading-relaxed">
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* SWOT Matrix */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Strengths */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-green-600 dark:text-green-500">Сильные стороны</h3>
              <div className="space-y-3">
                {insight.strengths.map((strength, idx) => (
                  <div key={idx} className="text-sm">
                    <h4 className="font-semibold">{strength.title}</h4>
                    <p className="text-xs text-muted-foreground">{strength.details}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Weaknesses */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-red-600 dark:text-red-500">Слабые стороны</h3>
              <div className="space-y-3">
                {insight.weaknesses.map((weakness, idx) => (
                  <div key={idx} className="text-sm">
                    <h4 className="font-semibold">{weakness.title}</h4>
                    <p className="text-xs text-muted-foreground">{weakness.details}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Opportunities */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-blue-600 dark:text-blue-500">Возможности</h3>
              <div className="space-y-3">
                {insight.opportunities.map((opportunity, idx) => (
                  <div key={idx} className="text-sm">
                    <h4 className="font-semibold">{opportunity.title}</h4>
                    <p className="text-xs text-muted-foreground">{opportunity.details}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Threats */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-orange-600 dark:text-orange-500">Угрозы</h3>
              <div className="space-y-3">
                {insight.threats.map((threat, idx) => (
                  <div key={idx} className="text-sm">
                    <h4 className="font-semibold">{threat.title}</h4>
                    <p className="text-xs text-muted-foreground">{threat.details}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Content Patterns */}
          {insight.contentPatterns && insight.contentPatterns.length > 0 && (
            <div>
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Паттерны успешного контента
              </h3>
              <div className="space-y-2">
                {insight.contentPatterns.map((pattern, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Badge variant="secondary" className="shrink-0 text-xs">{idx + 1}</Badge>
                    <p className="text-xs text-muted-foreground">{pattern}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Video Ideas */}
          {insight.videoIdeas && insight.videoIdeas.length > 0 && (
            <div>
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-primary" />
                Идеи для новых видео
              </h3>
              <div className="space-y-3">
                {insight.videoIdeas.map((idea, idx) => (
                  <div key={idx} className="border rounded-lg p-3 bg-muted/20">
                    <div className="flex items-start gap-2 mb-2">
                      <Badge variant="default" className="shrink-0 text-xs">Идея {idx + 1}</Badge>
                      <div className="flex-1">
                        <h4 className="font-semibold text-sm">{idea.title}</h4>
                        <p className="text-xs text-muted-foreground italic">"{idea.hook}"</p>
                      </div>
                    </div>
                    <div className="space-y-2 text-xs text-muted-foreground">
                      <div>
                        <p className="font-semibold">Описание:</p>
                        <p>{idea.description}</p>
                      </div>
                      <div>
                        <p className="font-semibold">План сценария:</p>
                        <ol className="list-decimal list-inside space-y-1">
                          {idea.outline.map((step, stepIdx) => (
                            <li key={stepIdx}>{step}</li>
                          ))}
                        </ol>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}
