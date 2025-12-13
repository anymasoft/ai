"use client"

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { CardDecorator } from '@/components/ui/card-decorator'
import { Code, Palette, Layout } from 'lucide-react'

const values = [
  {
    icon: Code,
    title: 'AI-анализ конкурентов',
    description: 'Глубокая аналитика YouTube-каналов конкурентов с автоматическим сбором данных и выявлением успешных паттернов.'
  },
  {
    icon: Palette,
    title: 'Генерация сценариев',
    description: 'AI создает готовые идеи и сценарии на основе того, что работает в вашей нише прямо сейчас.'
  },
  {
    icon: Layout,
    title: 'Тренды и инсайты',
    description: 'Отслеживание трендов, анализ динамики роста и рекомендации "Что снимать завтра".'
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
            AI-платформа для YouTube авторов
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Анализируйте конкурентов, находите успешные паттерны и получайте готовые идеи для сценариев.
            Наша цель — помочь вам создавать контент, который работает, основываясь на реальных данных.
          </p>
        </div>

        {/* Modern Values Grid with Enhanced Design */}
        <div className="grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2 xl:grid-cols-4 mb-12">
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
            <Button size="lg" className="cursor-pointer" asChild>
              <a href="/sign-in">
                Sign in
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
