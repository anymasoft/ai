"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
  const [isOpen, setIsOpen] = useState(true)

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
    <div className="space-y-4">
      {/* Header with toggle */}
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
          {insight && (
            <p className="text-sm text-muted-foreground mt-2">
              Сгенерировано: {new Date(insight.generatedAt).toLocaleDateString('ru-RU', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          )}
        </CardHeader>

        {isOpen && (
          <CardContent className="pt-0">
            <div className="mt-4 flex justify-end">
              <GenerateSwotButton channelId={channelId} variant="outline" size="sm" isUpdate={true} />
            </div>
          </CardContent>
        )}
      </Card>

      {/* Content - only shown when open */}
      {isOpen && (
        <div className="space-y-6">
          {/* Strategic Summary */}
          {insight.strategicSummary && insight.strategicSummary.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  Стратегическое резюме
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {insight.strategicSummary.map((paragraph, idx) => (
                  <p key={idx} className="text-muted-foreground leading-relaxed">
                    {paragraph}
                  </p>
                ))}
              </CardContent>
            </Card>
          )}

          {/* SWOT Matrix */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Strengths */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg text-green-600 dark:text-green-500">
                  Сильные стороны
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {insight.strengths.map((strength, idx) => (
                  <div key={idx} className="space-y-1">
                    <h4 className="font-semibold text-sm">{strength.title}</h4>
                    <p className="text-sm text-muted-foreground">{strength.details}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Weaknesses */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg text-red-600 dark:text-red-500">
                  Слабые стороны
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {insight.weaknesses.map((weakness, idx) => (
                  <div key={idx} className="space-y-1">
                    <h4 className="font-semibold text-sm">{weakness.title}</h4>
                    <p className="text-sm text-muted-foreground">{weakness.details}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Opportunities */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg text-blue-600 dark:text-blue-500">
                  Возможности
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {insight.opportunities.map((opportunity, idx) => (
                  <div key={idx} className="space-y-1">
                    <h4 className="font-semibold text-sm">{opportunity.title}</h4>
                    <p className="text-sm text-muted-foreground">{opportunity.details}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Threats */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg text-orange-600 dark:text-orange-500">
                  Угрозы
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {insight.threats.map((threat, idx) => (
                  <div key={idx} className="space-y-1">
                    <h4 className="font-semibold text-sm">{threat.title}</h4>
                    <p className="text-sm text-muted-foreground">{threat.details}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Content Patterns */}
          {insight.contentPatterns && insight.contentPatterns.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Паттерны успешного контента
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {insight.contentPatterns.map((pattern, idx) => (
                  <div key={idx} className="flex gap-3">
                    <Badge variant="secondary" className="shrink-0">{idx + 1}</Badge>
                    <p className="text-sm text-muted-foreground">{pattern}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Video Ideas */}
          {insight.videoIdeas && insight.videoIdeas.length > 0 && (
            <div>
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-primary" />
                Идеи для новых видео
              </h3>
              <div className="grid grid-cols-1 gap-4">
                {insight.videoIdeas.map((idea, idx) => (
                  <Card key={idx} className="overflow-hidden">
                    <CardHeader className="bg-muted/30">
                      <div className="flex items-start gap-3">
                        <Badge variant="default" className="shrink-0">Идея {idx + 1}</Badge>
                        <div className="space-y-1 flex-1">
                          <CardTitle className="text-lg">{idea.title}</CardTitle>
                          <CardDescription className="italic">"{idea.hook}"</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                      <div>
                        <h4 className="font-semibold text-sm mb-2">Описание:</h4>
                        <p className="text-sm text-muted-foreground">{idea.description}</p>
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm mb-2">План сценария:</h4>
                        <ol className="list-decimal list-inside space-y-1">
                          {idea.outline.map((step, stepIdx) => (
                            <li key={stepIdx} className="text-sm text-muted-foreground">
                              {step}
                            </li>
                          ))}
                        </ol>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
