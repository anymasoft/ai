"use client"

import { TrendingUp, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

export function CTASection() {
  return (
    <section className='py-16 lg:py-24 bg-muted/80'>
      <div className='container mx-auto px-4 lg:px-8'>
        <div className='mx-auto max-w-4xl'>
          <div className='text-center'>
            <div className='space-y-8'>
              {/* Badge and Stats */}
              <div className='flex flex-col items-center gap-4'>
                <Badge variant='outline' className='flex items-center gap-2'>
                  <TrendingUp className='size-3' />
                  Набор производительности
                </Badge>

                <div className='text-muted-foreground flex items-center gap-4 text-sm'>
                  <span className='flex items-center gap-1'>
                    <div className='size-2 rounded-full bg-green-500' />
                    150+ блоков
                  </span>
                  <Separator orientation='vertical' className='!h-4' />
                  <span>25K+ загрузок</span>
                  <Separator orientation='vertical' className='!h-4' />
                  <span>4.9★ оценка</span>
                </div>
              </div>

              {/* Main Content */}
              <div className='space-y-6'>
                <h1 className='text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl'>
                  Проверьте карточку перед модерацией маркетплейса.
                </h1>

                <p className='text-muted-foreground mx-auto max-w-2xl text-balance lg:text-xl'>
                  Beem находит критические ошибки, стоп-слова и проблемы с форматированием до публикации на Ozon и Wildberries. Сэкономьте время на переделку отклоненных карточек.
                </p>
              </div>

              {/* CTA Buttons */}
              <div className='flex flex-col justify-center gap-4 sm:flex-row sm:gap-6'>
                <Button size='lg' className='cursor-pointer px-8 py-6 text-lg font-medium' asChild>
                  <a href='/sign-in'>
                    <Package className='me-2 size-5' />
                    Попробовать бесплатно
                  </a>
                </Button>
              </div>

              {/* Trust Indicators */}
              <div className='text-muted-foreground flex flex-wrap items-center justify-center gap-6 text-sm'>
                <div className='flex items-center gap-2'>
                    <div className='size-2 rounded-full bg-green-600 dark:bg-green-400 me-1' />

                  <span>Бесплатные компоненты доступны</span>
                </div>
                <div className='flex items-center gap-2'>
                    <div className='size-2 rounded-full bg-blue-600 dark:bg-blue-400 me-1' />

                  <span>Коммерческая лицензия включена</span>
                </div>
                <div className='flex items-center gap-2'>
                    <div className='size-2 rounded-full bg-purple-600 dark:bg-purple-400 me-1' />

                  <span>Регулярные обновления и поддержка</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
