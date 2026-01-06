"use client"

import Link from "next/link"
import { ArrowRight, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DotPattern } from "@/components/dot-pattern"

export function HeroSection() {
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
              Проверка текста по 100+ правилам маркетплейсов
              <ArrowRight className="w-3 h-3 ml-2" />
            </Badge>
          </div>

          {/* Main Headline */}
          <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            <span className="block mb-2">Описание не проходит модерацию</span>
            <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              OZON или Wildberries?
            </span>
            <span className="block text-2xl sm:text-4xl lg:text-5xl mt-4 font-bold text-foreground">
              Проверьте за 10 секунд — бесплатно
            </span>
          </h1>

          {/* Subheading */}
          <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground sm:text-xl">
            Найдите ошибки в описании ещё до публикации и исправьте их. Система проверяет соответствие требованиям маркетплейсов, выявляет проблемы и помогает оптимизировать текст.
          </p>

          {/* Additional descriptive line */}
          <p className="mx-auto mb-10 max-w-2xl text-base text-muted-foreground">
            Убедитесь, что ваша карточка пройдёт модерацию. Без отклонений и переделок.
          </p>

          {/* CTA Buttons */}
          <div className="flex justify-center">
            <Button size="lg" className="text-base cursor-pointer bg-red-600 hover:bg-red-700 text-white" asChild>
              <Link href="#free-form">
                Проверить риск модерации
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
