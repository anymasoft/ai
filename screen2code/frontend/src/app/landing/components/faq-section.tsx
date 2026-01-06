
import { CircleHelp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { getAppUrl } from '@/lib/utils'

type FaqItem = {
  value: string
  question: string
  answer: string
}

const faqItems: FaqItem[] = [
  {
    value: 'item-1',
    question: 'Что я получу на выходе?',
    answer:
      'Чистый, готовый к использованию код на HTML, React или Vue. Весь код содержит Tailwind CSS классы, правильную структуру и семантику. Вы получаете файл, который можно сразу вставить в проект или использовать как основу для доработки.',
  },
  {
    value: 'item-2',
    question: 'Можно ли использовать код в продакшене?',
    answer:
      'Да! Код полностью готов к использованию в реальных проектах. Это не прототип — это работающий код, который можно сразу развернуть. AI создаёт правильную структуру, добавляет нужные атрибуты доступности и оптимизирует производительность.',
  },
  {
    value: 'item-3',
    question: 'Чем отличается быстрый режим от полного?',
    answer:
      'Быстрый режим обрабатывает скриншот за несколько секунд и создаёт основную структуру страницы. Полный режим — это более детальный анализ с лучшей точностью стилизации, правильной иерархией элементов и полной воссоздание дизайна. Выбирайте в зависимости от сложности дизайна.',
  },
  {
    value: 'item-4',
    question: 'Что происходит с изображениями?',
    answer:
      'Изображения обрабатываются в зависимости от режима. AI распознаёт их место в макете и добавляет корректные теги <img> с плейсхолдерами. Вы можете легко заменить ссылки на свои изображения. Текст из картинок переводится в обычный текст для доступности.',
  },
  {
    value: 'item-5',
    question: 'Можно ли дорабатывать результат?',
    answer:
      'Конечно! Код создан так, чтобы его было легко редактировать. Используйте встроенный редактор в нашем интерфейсе или скопируйте код в свой IDE. Все стили на Tailwind — просто обновите классы. Никаких чёрных ящиков, только чистый HTML/React/Vue.',
  },
  {
    value: 'item-6',
    question: 'Где сохраняются созданные сайты?',
    answer:
      'Все созданные версии автоматически сохраняются в вашем личном кабинете. Вы можете вернуться к любой версии, сравнить результаты или скачать несколько вариантов одного дизайна. История хранится столько, сколько нужно — удаляйте только когда хотите.',
  },
]

const FaqSection = () => {
  return (
    <section id="faq" className="py-24 sm:py-32">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto max-w-2xl text-center mb-16">
          <Badge variant="outline" className="mb-4">Вопросы</Badge>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
            Часто задаваемые вопросы
          </h2>
          <p className="text-lg text-muted-foreground">
            Всё, что нужно знать о Screen2Code, выходном коде и использовании. Ещё вопросы? Напишите нам!
          </p>
        </div>

        {/* FAQ Content */}
        <div className="max-w-4xl mx-auto">
          <div className='bg-transparent'>
            <div className='p-0'>
              <Accordion type='single' collapsible className='space-y-5'>
                {faqItems.map(item => (
                  <AccordionItem key={item.value} value={item.value} className='rounded-md !border bg-transparent'>
                    <AccordionTrigger className='cursor-pointer items-center gap-4 rounded-none bg-transparent py-2 ps-3 pe-4 hover:no-underline data-[state=open]:border-b'>
                      <div className='flex items-center gap-4'>
                        <div className='bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-full'>
                          <CircleHelp className='size-5' />
                        </div>
                        <span className='text-start font-semibold'>{item.question}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className='p-4 bg-transparent'>{item.answer}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>

          {/* Contact Support CTA */}
          <div className="text-center mt-12">
            <p className="text-muted-foreground mb-4">
              Остались вопросы? Напишите нам или начните работу.
            </p>
            <Button className='cursor-pointer' asChild>
              <a href={getAppUrl("/log-in")}>
                Начать работу
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}

export { FaqSection }
