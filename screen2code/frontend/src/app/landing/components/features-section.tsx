
import {
  BarChart3,
  Zap,
  Users,
  ArrowRight,
  Database,
  Package,
  Crown,
  Layout,
  Palette
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Image3D } from '@/components/image-3d'

const mainFeatures = [
  {
    icon: Package,
    title: 'Клонирование UI по скриншоту или URL',
    description: 'Загрузите изображение или скопируйте ссылку на сайт — AI автоматически распознает структуру и создаст код.'
  },
  {
    icon: Layout,
    title: 'HTML, React, Vue на выбор',
    description: 'Выберите фреймворк прямо в результатах. Один скриншот — несколько вариантов выходного кода.'
  },
  {
    icon: Palette,
    title: 'Tailwind CSS классы',
    description: 'Весь код использует готовые Tailwind классы. Быстро адаптируйте стили под вашу дизайн-систему.'
  },
  {
    icon: Zap,
    title: 'Быстрый и полный режим',
    description: 'Быстрый режим за секунды, полный режим со всеми деталями. Выбирайте скорость или качество.'
  },
  {
    icon: Database,
    title: 'Скачивание результата',
    description: 'Экспортируйте код как файл, скопируйте в буфер обмена или используйте прямо в браузере.'
  },
  {
    icon: BarChart3,
    title: 'История версий',
    description: 'Все созданные версии сохраняются. Легко вернуться к предыдущему варианту или сравнить результаты.'
  }
]

export function FeaturesSection() {
  return (
    <section id="features" className="py-24 sm:py-32 bg-muted/30">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto max-w-2xl text-center mb-16">
          <Badge variant="outline" className="mb-4">Возможности</Badge>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
            Один инструмент вместо копирования и ручной верстки
          </h2>
          <p className="text-lg text-muted-foreground">
            Загружайте скриншоты реальных сайтов, получайте код в реальном времени и сразу начинайте разработку.
            AI делает рутину за вас.
          </p>
        </div>

        {/* Features Grid */}
        <div className="mx-auto max-w-6xl">
          <ul className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {mainFeatures.map((feature, index) => (
              <li key={index} className="group hover:bg-accent/5 flex items-start gap-4 p-6 rounded-lg border transition-colors">
                <div className="mt-0.5 flex shrink-0 items-center justify-center">
                  <feature.icon className="size-6 text-primary" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-foreground font-semibold text-lg">{feature.title}</h3>
                  <p className="text-muted-foreground mt-2 text-sm">{feature.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
