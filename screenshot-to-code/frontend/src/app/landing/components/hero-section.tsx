
import { ArrowRight, Play, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DotPattern } from '@/components/dot-pattern'
import { assetUrl, getAppUrl } from "@/lib/utils"
import { useState, useEffect } from 'react'

export function HeroSection() {
  const [showCode, setShowCode] = useState(false)
  const [htmlCode, setHtmlCode] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Загрузить содержимое demo.html для режима Code
    fetch('/demo.html')
      .then(res => res.text())
      .then(html => {
        setHtmlCode(html)
        setLoading(false)
      })
      .catch(err => {
        console.error('Error loading demo.html:', err)
        setLoading(false)
      })
  }, [])

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-background to-background/80 pt-20 sm:pt-32 pb-16">
      {/* Background Pattern */}
      <div className="absolute inset-0">
        {/* Dot pattern overlay using reusable component */}
        <DotPattern className="opacity-100" size="md" fadeStyle="ellipse" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="mx-auto max-w-4xl text-center">
          {/* Announcement Badge */}
          <div className="mb-8 flex justify-center">
            <Badge variant="outline" className="px-4 py-2 border-foreground">
              <Star className="w-3 h-3 mr-2 fill-current" />
              Сайт из скриншота за минуты
              <ArrowRight className="w-3 h-3 ml-2" />
            </Badge>
          </div>

          {/* Main Headline */}
          <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
            Превратите скриншот сайта
            <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              {" "}в рабочий код{" "}
            </span>
          </h1>

          {/* Subheading */}
          <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground sm:text-xl">
            Загрузите изображение или вставьте ссылку — получите готовую верстку в формате HTML, React или Vue.
          </p>

          {/* Additional descriptive line */}
          <p className="mx-auto mb-10 max-w-2xl text-base text-muted-foreground">
            Без ручной верстки, копирования и догадок. Результат появляется сразу, в реальном времени.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Button size="lg" className="text-base cursor-pointer" asChild>
              <a href={getAppUrl("/log-in")}>
                Создать сайт
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="text-base cursor-pointer hidden"
              asChild
            >
              <a href="#">
                <Play className="mr-2 h-4 w-4" />
                Смотреть демо
              </a>
            </Button>
          </div>
        </div>

        {/* Hero Demo Block - Preview / Code */}
        <div className="mx-auto mt-20 max-w-6xl">
          <div className="relative group">
            {/* Top background glow effect */}
            <div className="absolute top-2 lg:-top-8 left-1/2 transform -translate-x-1/2 w-[90%] mx-auto h-24 lg:h-80 bg-primary/50 rounded-full blur-3xl"></div>

            <div className="relative rounded-xl border bg-card shadow-2xl overflow-hidden">
              {/* Preview / Code Toggle - Top Right */}
              <div className="absolute top-3 right-4 z-10 flex gap-1 bg-background/95 rounded-lg border border-border p-1 backdrop-blur-sm">
                <button
                  onClick={() => setShowCode(false)}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                    !showCode
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  Preview
                </button>
                <button
                  onClick={() => setShowCode(true)}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                    showCode
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  Code
                </button>
              </div>

              {/* Explanatory text above iframe */}
              <p className="text-center text-lg font-semibold text-foreground pt-6 pb-4">
                Это не изображение. Это реальный HTML-код.
              </p>

              {/* Preview Mode - iframe */}
              {!showCode && (
                <div className="bg-background">
                  <iframe
                    src="/demo.html"
                    title="Screen2Code Demo"
                    className="w-full border-0"
                    style={{ height: '600px' }}
                    sandbox="allow-same-origin allow-scripts"
                  />
                </div>
              )}

              {/* Code Mode - HTML Source */}
              {showCode && (
                <div className="bg-background p-4 overflow-auto max-h-[600px]">
                  {loading ? (
                    <div className="flex items-center justify-center h-[600px] text-muted-foreground">
                      Загрузка кода...
                    </div>
                  ) : htmlCode ? (
                    <pre className="text-xs text-muted-foreground font-mono whitespace-pre-wrap break-words">
                      <code>{htmlCode}</code>
                    </pre>
                  ) : (
                    <div className="text-muted-foreground">
                      Не удалось загрузить код
                    </div>
                  )}
                </div>
              )}

              {/* Bottom fade effect */}
              <div className="absolute bottom-0 left-0 w-full h-12 bg-gradient-to-t from-background to-background/0 pointer-events-none"></div>
            </div>
          </div>

          {/* Small caption */}
          <p className="text-center text-xs text-muted-foreground mt-4 hidden">
            Это не изображение. Это реальный HTML-код.
          </p>
        </div>
      </div>
    </section>
  )
}
