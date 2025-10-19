"use client";

import { Bot, MessageSquare, Clock, Target, Zap } from "lucide-react";

import { cn } from "@/lib/utils";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const DATA = [
  {
    title: "Проблемы селлеров",
    description:
      "Сотни отзывов в день требуют постоянного внимания и быстрых ответов",
    icon: Clock,
    problems: [
      "Сотни отзывов в день, невозможно отвечать вручную",  
      "Падение рейтинга из-за медленных ответов",
      "Траты на менеджеров по отзывам — 25–40 тыс руб/мес"
    ],
    subtitle: "Если не отвечать на отзывы оперативно, продажи падают и репутация страдает"
  },
  {
    title: "Наше решение",
    description: "AI-автоответчик решает все проблемы с отзывами автоматически",
    icon: Bot,
    solutions: [
      "AI-генерация уникальных ответов на отзывы",
      "Поддержка нескольких маркетплейсов в одном кабинете", 
      "Выбор стиля ответа, настройка промптов, ключевых слов и стоп-слов",
      "Оповещения в Telegram и Email о новых негативных отзывах",
      "Полуавтомат: AI предлагает варианты, вы публикуете в один клик"
    ],
    reverse: true,
  },
];

const PRICING = [
  {
    name: "Start",
    price: "1,990",
    features: [
      "До 100 отзывов в месяц",
      "1 маркетплейс", 
      "Базовый AI",
      "Email поддержка"
    ]
  },
  {
    name: "Pro", 
    price: "3,990",
    popular: true,
    features: [
      "До 500 отзывов в месяц",
      "До 3 маркетплейсов",
      "Умный AI (GPT-4)",
      "Telegram-оповещения",
      "Приоритетная поддержка"
    ]
  },
  {
    name: "Enterprise",
    price: "7,990", 
    features: [
      "Безлимит отзывов",
      "Все маркетплейсы",
      "Персональный менеджер",
      "Расширенная аналитика",
      "API интеграция"
    ]
  }
];

const TimelineSection = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="py-20 lg:py-32">
        <div className="border-y">
          <div className="container max-w-7xl mx-auto px-6 flex flex-col gap-6 border-x py-8 lg:py-16">
            <Badge
              variant="outline"
              className="w-fit gap-1 bg-card px-3 text-sm font-normal tracking-tight shadow-sm"
            >
              <Bot className="size-4" />
              <span>AI Автоответчик</span>
            </Badge>
            <h1 className="text-4xl leading-tight tracking-tight md:text-5xl lg:text-7xl font-bold">
              Автоматические ответы на отзывы маркетплейсов
            </h1>
            <p className="max-w-[700px] text-lg tracking-[-0.32px] text-muted-foreground">
              Экономьте время и повышайте продажи, используя AI для управления отзывами на Wildberries, Ozon и Яндекс.Маркет
            </p>
            <div className="flex gap-4 pt-4">
              <Button size="lg" className="px-8">
                Попробовать бесплатно
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Problems & Solutions */}
      <div className="container mx-auto overflow-hidden border-x pb-20">
        {DATA.map((item, index) => (
          <div key={index} className="relative flex">
            <div
              className={`flex w-full justify-center px-1 py-16 text-center md:gap-6 lg:gap-10 ${
                item?.reverse ? "lg:flex-row-reverse lg:text-start" : ""
              } `}
            >
              <div className="flex-1 max-lg:hidden">
                <h2 className="text-3xl font-bold tracking-[-0.96px] mb-4">
                  {index === 0 ? "Почему это важно" : "Как наш сервис решает эти проблемы"}
                </h2>
                <div className={`max-w-[400px] ${item?.reverse ? "" : "ml-auto"}`}>
                  {index === 0 ? (
                    <div className="space-y-4">
                      {item.problems?.map((problem, i) => (
                        <div key={i} className="text-left p-4 bg-muted/50 rounded-lg border">
                          <p className="text-sm text-muted-foreground">{problem}</p>
                        </div>
                      ))}
                      <p className="text-sm text-muted-foreground italic pt-2">{item.subtitle}</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {item.solutions?.map((solution, i) => (
                        <div key={i} className="flex items-start gap-3 text-left">
                          <Zap className="size-4 text-primary mt-1 shrink-0" />
                          <p className="text-sm">{solution}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="z-10 size-fit bg-background p-4">
                <div className="rounded-[10px] border bg-card p-[5px] shadow-md">
                  <div className="size-fit rounded-md border bg-muted p-3">
                    <item.icon className="size-6 shrink-0" />
                  </div>
                </div>
              </div>
              <div className="flex-1">
                <div className="text-center lg:hidden mb-8">
                  <h2 className="text-2xl font-bold tracking-[-0.96px] mb-4">
                    {index === 0 ? "Почему это важно" : "Как наш сервис решает эти проблемы"}
                  </h2>
                  {index === 0 ? (
                    <div className="space-y-4">
                      {item.problems?.map((problem, i) => (
                        <div key={i} className="text-left p-4 bg-muted/50 rounded-lg border">
                          <p className="text-sm text-muted-foreground">{problem}</p>
                        </div>
                      ))}
                      <p className="text-sm text-muted-foreground italic pt-2">{item.subtitle}</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {item.solutions?.map((solution, i) => (
                        <div key={i} className="flex items-start gap-3 text-left">
                          <Zap className="size-4 text-primary mt-1 shrink-0" />
                          <p className="text-sm">{solution}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pricing Section */}
      <section className="py-20 bg-muted/30">
        <div className="container max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl mb-4">
              Тарифы
            </h2>
            <p className="text-lg text-muted-foreground max-w-[600px] mx-auto">
              Выберите подходящий тариф для вашего бизнеса
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {PRICING.map((plan, index) => (
              <Card key={index} className={`relative ${plan.popular ? 'border-primary shadow-lg scale-105' : ''}`}>
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary">
                    Популярный
                  </Badge>
                )}
                <CardHeader className="text-center pb-2">
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <div className="flex items-center justify-center gap-1">
                    <span className="text-3xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">₽/мес</span>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <Target className="size-4 text-primary shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button 
                    className="w-full" 
                    variant={plan.popular ? "default" : "outline"}
                  >
                    Выбрать тариф
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl mb-6">
            Начните экономить время уже сегодня
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-[600px] mx-auto">
            Без риска, без необходимости нанимать менеджеров
          </p>
          <Button size="lg" className="px-12">
            Попробовать бесплатно
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12 bg-muted/20">
        <div className="container max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <Bot className="size-6" />
              <span className="font-semibold">AI Автоответчик</span>
            </div>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">
                Политика конфиденциальности
              </a>
              <a href="#" className="hover:text-foreground transition-colors">
                Условия использования
              </a>
              <a href="#" className="hover:text-foreground transition-colors">
                Контакты
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export { TimelineSection };