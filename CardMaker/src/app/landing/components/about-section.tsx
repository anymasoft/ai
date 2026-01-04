"use client"

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { CardDecorator } from '@/components/ui/card-decorator'
import { Code, Palette, Layout } from 'lucide-react'

const values = [
  {
    icon: Code,
    title: 'Выявите проблемы в описании до публикации',
    description: 'Система проверяет текст по всем требованиям маркетплейсов — от грамматики до структуры. Получите точный список ошибок, которые могут привести к отклонению карточки.'
  },
  {
    icon: Palette,
    title: 'Исправьте ошибки одним кликом',
    description: 'После проверки система предложит исправить выявленные проблемы автоматически. Не нужно гадать, как изменить текст — просто примите исправления и публикуйте.'
  },
  {
    icon: Layout,
    title: 'Уверенность в соответствии требованиям маркетплейсов',
    description: 'Проверка учитывает специфику Ozon и Wildberries. Вы будете уверены, что описание соответствует требованиям и не будет отклонено модератором.'
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
            Выявляйте ошибки в описании ещё до публикации
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Многие продавцы тратят время на правки карточек товаров, сталкиваются с отказами и не уверены, соответствует ли описание требованиям маркетплейса. Система автоматически проверяет текст по всем правилам и помогает исправить проблемы прямо в интерфейсе.
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
              <a href="#free-form">
                Проверить описание бесплатно
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
