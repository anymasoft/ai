import { Bot, MessageCircle, Settings, TrendingUp, Clock, Users } from "lucide-react";
import React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

const PROBLEMS_DATA = [
  {
    title: "Сотни отзывов в день",
    description: "Невозможно отвечать вручную на все отзывы клиентов",
    icon: Clock,
  },
  {
    title: "Падение рейтинга",
    description: "Медленные ответы снижают доверие покупателей",
    icon: TrendingUp,
  },
  {
    title: "Высокие затраты",
    description: "Траты на менеджеров по отзывам — 25–40 тыс руб/мес",
    icon: Users,
  },
];

const SOLUTIONS_DATA = [
  {
    title: "AI-генерация ответов",
    description: "Уникальные персонализированные ответы на каждый отзыв",
    icon: Bot,
  },
  {
    title: "Все маркетплейсы",
    description: "Wildberries, Ozon, Яндекс.Маркет в одном кабинете",
    icon: Settings,
  },
  {
    title: "Умные оповещения",
    description: "Telegram и Email уведомления о критических отзывах",
    icon: MessageCircle,
  },
];

const PRICING_DATA = [
  {
    name: "Start",
    price: "1,990",
    features: [
      "До 100 отзывов в месяц",
      "1 маркетплейс",
      "Базовый AI",
      "Email поддержка",
    ],
  },
  {
    name: "Pro",
    price: "3,990",
    features: [
      "До 500 отзывов в месяц", 
      "До 3 маркетплейсов",
      "Умный AI (GPT-4)",
      "Telegram оповещения",
    ],
    popular: true,
  },
  {
    name: "Enterprise", 
    price: "7,990",
    features: [
      "Безлимит отзывов",
      "Персональный менеджер",
      "Расширенная аналитика",
      "Приоритетная поддержка",
    ],
  },
];

const FeatureSectionThree = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="py-20 max-w-7xl mx-auto">
        <div className="container text-center">
          <h1 className="text-4xl font-bold tracking-tight lg:text-6xl mb-6">
            Автоматические ответы на отзывы маркетплейсов
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            Экономьте время и повышайте продажи, используя AI для управления отзывами на Wildberries, Ozon и Яндекс.Маркет
          </p>
          <Button size="lg" className="text-lg px-8 py-6">
            Попробовать бесплатно
          </Button>
        </div>
      </section>

      {/* Problems Section */}
      <section className="py-20 bg-muted/30">
        <div className="container max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight lg:text-4xl mb-4">
              Почему это важно
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Если не отвечать на отзывы оперативно, продажи падают и репутация страдает
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {PROBLEMS_DATA.map((problem, index) => (
              <Card key={index} className="text-center">
                <CardHeader>
                  <problem.icon className="size-12 mx-auto text-destructive mb-4" />
                  <CardTitle className="text-xl">{problem.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">{problem.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Solutions Section */}
      <section className="py-20">
        <div className="container max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight lg:text-4xl mb-4">
              Как наш сервис решает эти проблемы
            </h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            {SOLUTIONS_DATA.map((solution, index) => (
              <Card key={index} className="text-center">
                <CardHeader>
                  <solution.icon className="size-12 mx-auto text-primary mb-4" />
                  <CardTitle className="text-xl">{solution.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">{solution.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="bg-card p-8 rounded-lg border">
            <h3 className="text-xl font-semibold mb-4">Дополнительные возможности:</h3>
            <ul className="space-y-3 text-muted-foreground">
              <li className="flex items-start gap-3">
                <div className="size-2 rounded-full bg-primary mt-2 flex-shrink-0"></div>
                <span>Выбор стиля ответа, настройка промптов, ключевых слов и стоп-слов</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="size-2 rounded-full bg-primary mt-2 flex-shrink-0"></div>
                <span>Полуавтомат: AI предлагает варианты, вы публикуете один из них в один клик</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 bg-muted/30">
        <div className="container max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight lg:text-4xl mb-4">
              Тарифы
            </h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {PRICING_DATA.map((plan, index) => (
              <Card key={index} className={`relative ${plan.popular ? 'border-primary' : ''}`}>
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    Популярный
                  </Badge>
                )}
                <CardHeader className="text-center">
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <CardDescription className="text-3xl font-bold text-foreground">
                    {plan.price} руб<span className="text-sm font-normal text-muted-foreground">/мес</span>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-start gap-3">
                        <div className="size-2 rounded-full bg-primary mt-2 flex-shrink-0"></div>
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button className="w-full" variant={plan.popular ? 'default' : 'outline'}>
                    Выбрать тариф
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold tracking-tight lg:text-4xl mb-4">
            Начните экономить время уже сегодня
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Без риска, без необходимости нанимать менеджеров
          </p>
          <Button size="lg" className="text-lg px-8 py-6">
            Попробовать бесплатно
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t bg-muted/30">
        <div className="container max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8 text-center md:text-left">
            <div>
              <h3 className="font-semibold mb-4">Контакты</h3>
              <p className="text-sm text-muted-foreground">support@aireviews.ru</p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Документы</h3>
              <p className="text-sm text-muted-foreground">Политика конфиденциальности</p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Правовая информация</h3>
              <p className="text-sm text-muted-foreground">Условия использования</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export { FeatureSectionThree };