"use client"

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { CardDecorator } from '@/components/ui/card-decorator'
import { Code, Palette, Layout } from 'lucide-react'

const values = [
  {
    icon: Code,
    title: 'Хотите понимать, почему у конкурентов заходят ролики?',
    description: 'Мы автоматически анализируем каналы и видео конкурентов, чтобы найти реальные паттерны роста — не на глаз, а на данных.'
  },
  {
    icon: Palette,
    title: 'Получите готовые сценарии, а не общие советы',
    description: 'AI создаёт структурированные сценарии: захват внимания → развитие → финал. Их не нужно переписывать — можно сразу снимать. Как по нотам.'
  },
  {
    icon: Layout,
    title: 'Снимайте только то, что растёт прямо сейчас',
    description: 'Вы сразу видите темы и форматы, которые набирают просмотры прямо сейчас, а не узнаёте о них постфактум.'
  }
]

export function AboutSection() {
  return (
    <section id="about" className="py-24 sm:py-32">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto max-w-4xl text-center mb-16">
          <Badge variant="outline" className="mb-4">
            О сервисе
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-6">
            Перестаньте гадать, как правильно оформить карточку товара
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Многие продавцы тратят время на правки карточек товаров, сталкиваются с отказами и не уверены, соответствует ли описание требованиям маркетплейса. Мы помогаем подготовить текст сразу в нужном формате, чтобы карточка была готова к размещению за один клик.
          </p>
        </div>

        {/* Modern Values Grid with Enhanced Design */}
        <div className="grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2 xl:grid-cols-3 justify-items-center max-w-4xl mx-auto mb-12">
          {values.map((value, index) => (
            <Card key={index} className='group shadow-xs py-2'>
              <CardContent className='p-8'>
                <div className='flex flex-col items-center text-center'>
                  <CardDecorator>
                    <value.icon className='h-6 w-6' aria-hidden />
                  </CardDecorator>
                  <h3 className='mt-6 font-medium text-balance'>{value.title}</h3>
                  <p className='text-muted-foreground mt-3 text-sm'>{value.description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Call to Action */}
        <div className="mt-16 text-center">
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="cursor-pointer bg-red-600 hover:bg-red-700 text-white" asChild>
              <a href="/sign-in">
                Получи сценарий мечты за 1 клик
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
