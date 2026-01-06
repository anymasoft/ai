"use client"

import { Badge } from '@/components/ui/badge'

export function FeaturesSection() {
  return (
    <section id="features" className="py-24 sm:py-32 bg-muted/30">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto max-w-2xl text-center mb-16">
          <Badge variant="outline" className="mb-4">Возможности платформы</Badge>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
            Один инструмент вместо десятков правок и догадок
          </h2>
          <p className="text-lg text-muted-foreground">
            Больше не нужно вручную переписывать тексты, сверяться с требованиями и переживать за отклонения. Сервис помогает подготовить описание товара в нужном формате с первого раза.
          </p>
        </div>
      </div>
    </section>
  )
}
