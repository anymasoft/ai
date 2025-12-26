
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { CardDecorator } from '@/components/ui/card-decorator'
import { Code, Eye, Zap } from 'lucide-react'
import { getAppUrl } from '@/lib/utils'

const values = [
  {
    icon: Code,
    title: 'Из скриншота в код',
    description: 'Загрузите скриншот любого сайта и получите готовую верстку в HTML, React или Vue за считанные секунды.'
  },
  {
    icon: Eye,
    title: 'Живой предпросмотр',
    description: 'Видите результат сразу в браузере. Редактируйте код в реальном времени и тестируйте изменения без перезагрузки.'
  },
  {
    icon: Zap,
    title: 'Подходит для разработки и продакшна',
    description: 'Используйте для прототипирования, перевода макетов в код или ускорения разработки полноценных приложений.'
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
            Хватит вручную верстать то, что уже существует
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Сайты уже созданы. Дизайны есть везде. Зачем повторять вручную то, что можно получить автоматически?
            Загрузите скриншот — получите готовый, рабочий код.
          </p>
        </div>

        {/* Modern Values Grid with Enhanced Design */}
        <div className="grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2 xl:grid-cols-3 mb-12">
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
              <a href={getAppUrl("/log-in")}>
                Попробовать на своём сайте
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
