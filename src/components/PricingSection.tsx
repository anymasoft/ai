import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Check, MessageSquare, Bot, Settings, Bell, MousePointer } from "lucide-react";

export default function Pricing() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Block */}
      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-4xl space-y-6 text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900">
              Автоматические ответы на отзывы маркетплейсов
            </h1>
            <p className="text-xl md:text-2xl text-gray-600">
              Экономьте время и повышайте продажи, используя AI для управления отзывами на Wildberries, Ozon и Яндекс.Маркет
            </p>
            <div className="pt-4">
              <Button asChild size="lg" className="px-8 py-4 text-lg">
                <Link href="">Попробовать бесплатно</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Problems Block */}
      <section className="py-16 bg-gray-50">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-4xl text-center space-y-8">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
              Почему это важно
            </h2>
            <div className="grid gap-6 md:grid-cols-3">
              <div className="space-y-3">
                <MessageSquare className="mx-auto h-8 w-8 text-gray-600" />
                <p className="text-lg font-medium text-gray-800">
                  Сотни отзывов в день, невозможно отвечать вручную
                </p>
              </div>
              <div className="space-y-3">
                <Bot className="mx-auto h-8 w-8 text-gray-600" />
                <p className="text-lg font-medium text-gray-800">
                  Падение рейтинга из-за медленных ответов
                </p>
              </div>
              <div className="space-y-3">
                <Settings className="mx-auto h-8 w-8 text-gray-600" />
                <p className="text-lg font-medium text-gray-800">
                  Траты на менеджеров по отзывам — 25–40 тыс руб/мес
                </p>
              </div>
            </div>
            <p className="text-lg text-gray-600 pt-4">
              Если не отвечать на отзывы оперативно, продажи падают и репутация страдает
            </p>
          </div>
        </div>
      </section>

      {/* Solution Block */}
      <section className="py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-4xl text-center space-y-8">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
              Как наш сервис решает эти проблемы
            </h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 text-left">
              <div className="space-y-3">
                <Bot className="h-8 w-8 text-blue-600" />
                <p className="text-lg font-medium text-gray-800">
                  AI-генерация уникальных ответов на отзывы
                </p>
              </div>
              <div className="space-y-3">
                <Settings className="h-8 w-8 text-blue-600" />
                <p className="text-lg font-medium text-gray-800">
                  Поддержка нескольких маркетплейсов в одном кабинете
                </p>
              </div>
              <div className="space-y-3">
                <MessageSquare className="h-8 w-8 text-blue-600" />
                <p className="text-lg font-medium text-gray-800">
                  Выбор стиля ответа, настройка промптов, ключевых слов и стоп-слов
                </p>
              </div>
              <div className="space-y-3">
                <Bell className="h-8 w-8 text-blue-600" />
                <p className="text-lg font-medium text-gray-800">
                  Оповещения в Telegram и Email о новых негативных или критических отзывах
                </p>
              </div>
              <div className="space-y-3 md:col-span-2 lg:col-span-2">
                <MousePointer className="h-8 w-8 text-blue-600" />
                <p className="text-lg font-medium text-gray-800">
                  Полуавтомат: AI предлагает варианты, вы публикуете один из них в один клик
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Block */}
      <section className="py-16 bg-gray-50">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl space-y-6 text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
              Тарифы
            </h2>
          </div>

          <div className="mt-8 grid gap-6 md:mt-20 md:grid-cols-3">
            <Card className="flex flex-col">
              <CardHeader>
                <CardTitle className="font-medium">Start</CardTitle>
                <span className="my-3 block text-2xl font-semibold">1,990 руб / мес</span>
                <CardDescription className="text-sm">Базовый тариф</CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <hr className="border-dashed" />

                <ul className="list-outside space-y-3 text-sm">
                  {[
                    "До 100 отзывов",
                    "1 маркетплейс",
                    "Базовый AI",
                  ].map((item, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <Check className="size-3" />
                      {item}
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter className="mt-auto">
                <Button asChild variant="outline" className="w-full">
                  <Link href="">Выбрать план</Link>
                </Button>
              </CardFooter>
            </Card>

            <Card className="relative">
              <span className="bg-linear-to-br/increasing absolute inset-x-0 -top-3 mx-auto flex h-6 w-fit items-center rounded-full from-purple-400 to-amber-300 px-3 py-1 text-xs font-medium text-amber-950 ring-1 ring-inset ring-white/20 ring-offset-1 ring-offset-gray-950/5">
                Популярный
              </span>

              <div className="flex flex-col">
                <CardHeader>
                  <CardTitle className="font-medium">Pro</CardTitle>
                  <span className="my-3 block text-2xl font-semibold">
                    3,990 руб / мес
                  </span>
                  <CardDescription className="text-sm">Профессиональный</CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  <hr className="border-dashed" />
                  <ul className="list-outside pb-8 space-y-3 text-sm">
                    {[
                      "До 500 отзывов",
                      "До 3 маркетплейсов",
                      "Умный AI (GPT-4)",
                      "Telegram-оповещения",
                    ].map((item, index) => (
                      <li key={index} className="flex items-center gap-2">
                        <Check className="size-3" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>

                <CardFooter>
                  <Button asChild className="w-full">
                    <Link href="">Выбрать план</Link>
                  </Button>
                </CardFooter>
              </div>
            </Card>

            <Card className="flex flex-col">
              <CardHeader>
                <CardTitle className="font-medium">Enterprise</CardTitle>
                <span className="my-3 block text-2xl font-semibold">
                  7,990 руб / мес
                </span>
                <CardDescription className="text-sm">Для крупного бизнеса</CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <hr className="border-dashed" />

                <ul className="list-outside space-y-3 text-sm">
                  {[
                    "Безлимит отзывов",
                    "Персональный менеджер",
                    "Расширенная аналитика",
                  ].map((item, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <Check className="size-3" />
                      {item}
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter className="mt-auto">
                <Button asChild variant="outline" className="w-full">
                  <Link href="">Выбрать план</Link>
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Block */}
      <section className="py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl space-y-6 text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
              Начните экономить время уже сегодня
            </h2>
            <div className="pt-4">
              <Button asChild size="lg" className="px-8 py-4 text-lg">
                <Link href="">Попробовать бесплатно</Link>
              </Button>
            </div>
            <p className="text-gray-600">
              Без риска, без необходимости нанимать менеджеров
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 bg-gray-900 text-white">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center space-y-4">
            <p className="text-sm text-gray-400">
              © 2024 AI-автоответчик. Все права защищены.
            </p>
            <div className="flex justify-center space-x-6 text-sm">
              <Link href="#" className="text-gray-400 hover:text-white">
                Политика конфиденциальности
              </Link>
              <Link href="#" className="text-gray-400 hover:text-white">
                Условия использования
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}