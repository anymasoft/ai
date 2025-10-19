"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, MessageSquare, Clock, Target, Zap, Users, BarChart3, Shield } from "lucide-react";

const AIResponseLanding = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="container max-w-6xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
            Автоматические ответы на отзывы маркетплейсов
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto leading-relaxed">
            Экономьте время и повышайте продажи, используя AI для управления отзывами на Wildberries, Ozon и Яндекс.Маркет
          </p>
          <Button size="lg" className="text-lg px-8 py-6">
            Попробовать бесплатно
          </Button>
        </div>
      </section>

      {/* Problems Section */}
      <section className="py-20 px-4 bg-muted/50">
        <div className="container max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Почему это важно</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <Clock className="w-6 h-6 text-destructive" />
                <h3 className="font-semibold">Сотни отзывов в день</h3>
              </div>
              <p className="text-muted-foreground">Невозможно отвечать вручную на все отзывы покупателей</p>
            </Card>
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <BarChart3 className="w-6 h-6 text-destructive" />
                <h3 className="font-semibold">Падение рейтинга</h3>
              </div>
              <p className="text-muted-foreground">Медленные ответы снижают доверие и позиции в поиске</p>
            </Card>
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <Users className="w-6 h-6 text-destructive" />
                <h3 className="font-semibold">Дорогие менеджеры</h3>
              </div>
              <p className="text-muted-foreground">Траты на персонал — 25–40 тысяч рублей в месяц</p>
            </Card>
          </div>
          <p className="text-center text-muted-foreground text-lg">
            Если не отвечать на отзывы оперативно, продажи падают и репутация страдает
          </p>
        </div>
      </section>

      {/* Solution Section */}
      <section className="py-20 px-4">
        <div className="container max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Как наш сервис решает эти проблемы</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <Zap className="w-6 h-6 text-primary" />
                <h3 className="font-semibold">AI-генерация ответов</h3>
              </div>
              <p className="text-muted-foreground">Создание уникальных ответов на каждый отзыв с учетом контекста</p>
            </Card>
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <Target className="w-6 h-6 text-primary" />
                <h3 className="font-semibold">Единый кабинет</h3>
              </div>
              <p className="text-muted-foreground">Управление отзывами с нескольких маркетплейсов в одном месте</p>
            </Card>
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <MessageSquare className="w-6 h-6 text-primary" />
                <h3 className="font-semibold">Настройка стиля</h3>
              </div>
              <p className="text-muted-foreground">Выбор тона ответов, промптов, ключевых и стоп-слов</p>
            </Card>
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <Shield className="w-6 h-6 text-primary" />
                <h3 className="font-semibold">Умные уведомления</h3>
              </div>
              <p className="text-muted-foreground">Оповещения в Telegram и Email о новых критических отзывах</p>
            </Card>
          </div>
          <Card className="mt-8 p-6 border-primary/20">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle className="w-6 h-6 text-primary" />
              <h3 className="font-semibold">Полуавтомат режим</h3>
            </div>
            <p className="text-muted-foreground">AI предлагает варианты ответов, вы выбираете и публикуете в один клик</p>
          </Card>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 px-4 bg-muted/50">
        <div className="container max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Тарифы</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="relative">
              <CardHeader>
                <CardTitle className="text-xl">Start</CardTitle>
                <CardDescription>Для начинающих селлеров</CardDescription>
                <div className="text-3xl font-bold">1,990 ₽<span className="text-base font-normal text-muted-foreground">/мес</span></div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-primary" />
                  <span className="text-sm">До 100 отзывов</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-primary" />
                  <span className="text-sm">1 маркетплейс</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-primary" />
                  <span className="text-sm">Базовый AI</span>
                </div>
              </CardContent>
              <CardFooter>
                <Button className="w-full" variant="outline">Выбрать план</Button>
              </CardFooter>
            </Card>

            <Card className="relative border-primary">
              <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2">Популярный</Badge>
              <CardHeader>
                <CardTitle className="text-xl">Pro</CardTitle>
                <CardDescription>Для растущего бизнеса</CardDescription>
                <div className="text-3xl font-bold">3,990 ₽<span className="text-base font-normal text-muted-foreground">/мес</span></div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-primary" />
                  <span className="text-sm">До 500 отзывов</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-primary" />
                  <span className="text-sm">До 3 маркетплейсов</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-primary" />
                  <span className="text-sm">Умный AI (GPT-4)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-primary" />
                  <span className="text-sm">Telegram-оповещения</span>
                </div>
              </CardContent>
              <CardFooter>
                <Button className="w-full">Выбрать план</Button>
              </CardFooter>
            </Card>

            <Card className="relative">
              <CardHeader>
                <CardTitle className="text-xl">Enterprise</CardTitle>
                <CardDescription>Для крупного бизнеса</CardDescription>
                <div className="text-3xl font-bold">7,990 ₽<span className="text-base font-normal text-muted-foreground">/мес</span></div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-primary" />
                  <span className="text-sm">Безлимит отзывов</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-primary" />
                  <span className="text-sm">Все маркетплейсы</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-primary" />
                  <span className="text-sm">Персональный менеджер</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-primary" />
                  <span className="text-sm">Расширенная аналитика</span>
                </div>
              </CardContent>
              <CardFooter>
                <Button className="w-full" variant="outline">Выбрать план</Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="container max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Начните экономить время уже сегодня</h2>
          <Button size="lg" className="text-lg px-8 py-6 mb-4">
            Попробовать бесплатно
          </Button>
          <p className="text-muted-foreground">
            Без риска, без необходимости нанимать менеджеров
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t bg-muted/50">
        <div className="container max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <h3 className="font-semibold mb-4">Контакты</h3>
              <p className="text-muted-foreground text-sm">support@airesponse.ru</p>
              <p className="text-muted-foreground text-sm">+7 (999) 123-45-67</p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Документы</h3>
              <a href="#" className="text-muted-foreground text-sm hover:text-foreground block mb-2">
                Политика конфиденциальности
              </a>
              <a href="#" className="text-muted-foreground text-sm hover:text-foreground block">
                Условия использования
              </a>
            </div>
            <div>
              <h3 className="font-semibold mb-4">О сервисе</h3>
              <p className="text-muted-foreground text-sm">
                AI-автоответчик для маркетплейсов
              </p>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t text-center">
            <p className="text-muted-foreground text-sm">
              © 2024 AI Response. Все права защищены.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export { AIResponseLanding };
export { AIResponseLanding as Testimonial9 };