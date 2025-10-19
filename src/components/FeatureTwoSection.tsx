"use client";
import { ArrowRight, BadgeCheck, MessageSquare, Users, Shield, BarChart3, Star, Clock, DollarSign, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

interface FeatureItem {
  title: string;
  description: string;
  image: string;
  icon: React.ReactNode;
}

const FEATURES: FeatureItem[] = [
  {
    title: "AI-генерация уникальных ответов на отзывы",
    description:
      "Наш ИИ создаёт персонализированные ответы для каждого отзыва на основе контекста.",
    image:
      "https://cdn.cosmos.so/229ff492-90b9-41a1-95c6-1a569d650e08?format=jpeg",
    icon: <MessageSquare className="size-6" />,
  },
  {
    title: "Поддержка нескольких маркетплейсов в одном кабинете",
    description:
      "Управляйте отзывами с Wildberries, Ozon и Яндекс.Маркет из единого интерфейса.",
    image:
      "https://cdn.cosmos.so/b8c1820e-5f13-41c5-976e-70a143176618?format=jpeg",
    icon: <Users className="size-6" />,
  },
  {
    title: "Полуавтомат с настройками под ваш бренд",
    description:
      "ИИ предлагает варианты ответов с учётом стиля, промптов и ключевых слов бренда.",
    image:
      "https://cdn.cosmos.so/d28cd781-acd2-44a7-95bb-dce7ff011305?format=jpeg",
    icon: <Shield className="size-6" />,
  },
];

interface PricingTier {
  name: string;
  price: string;
  description: string;
  features: string[];
  popular?: boolean;
}

const PRICING_TIERS: PricingTier[] = [
  {
    name: "Start",
    price: "1,990 руб/мес",
    description: "Для небольших магазинов",
    features: [
      "До 100 отзывов в месяц",
      "1 маркетплейс",
      "Базовый AI",
      "Email-поддержка"
    ]
  },
  {
    name: "Pro",
    price: "3,990 руб/мес",
    description: "Оптимальный выбор для большинства",
    popular: true,
    features: [
      "До 500 отзывов в месяц",
      "До 3 маркетплейсов",
      "Умный AI (GPT-4)",
      "Telegram-оповещения",
      "Настройка промптов"
    ]
  },
  {
    name: "Enterprise",
    price: "7,990 руб/мес",
    description: "Для крупного бизнеса",
    features: [
      "Безлимитные отзывы",
      "Все маркетплейсы",
      "Персональный менеджер",
      "Расширенная аналитика",
      "Приоритетная поддержка"
    ]
  }
];

const FeatureSectionTwo = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="py-24">
        <div className="container max-w-7xl mx-auto text-center">
          <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-6xl">
            Автоматические ответы на отзывы маркетплейсов
          </h1>
          <p className="mb-8 text-xl text-muted-foreground max-w-3xl mx-auto">
            Экономьте время и повышайте продажи, используя AI для управления отзывами на Wildberries, Ozon и Яндекс.Маркет
          </p>
          <Button size="lg" className="text-lg px-8 py-4">
            Попробовать бесплатно <ArrowRight className="size-5 ml-2" />
          </Button>
        </div>
      </section>

      {/* Problems Section */}
      <section className="py-16 bg-muted/50">
        <div className="container max-w-7xl mx-auto">
          <h2 className="mb-12 text-3xl font-bold text-center">Почему это важно</h2>
          <div className="grid gap-8 md:grid-cols-3 mb-8">
            <Card>
              <CardHeader>
                <Clock className="size-8 mb-2 text-destructive" />
                <CardTitle className="text-lg">Сотни отзывов в день</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Невозможно отвечать вручную на все отзывы оперативно
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <Star className="size-8 mb-2 text-destructive" />
                <CardTitle className="text-lg">Падение рейтинга</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Из-за медленных ответов теряете позиции в поиске
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <DollarSign className="size-8 mb-2 text-destructive" />
                <CardTitle className="text-lg">Высокие затраты</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Менеджеры по отзывам — 25–40 тыс руб/мес
                </p>
              </CardContent>
            </Card>
          </div>
          <p className="text-center text-lg text-muted-foreground max-w-2xl mx-auto">
            Если не отвечать на отзывы оперативно, продажи падают и репутация страдает
          </p>
        </div>
      </section>

      {/* Solution Section */}
      <section className="py-32">
        <div className="container max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="mb-6 text-3xl font-bold">Как наш сервис решает эти проблемы</h2>
            <div className="flex flex-col justify-center gap-4 sm:flex-row">
              <Button className="w-full sm:w-auto">
                Посмотреть возможности <ArrowRight className="size-4" />
              </Button>
              <Button variant="outline" className="w-full shadow-sm sm:w-auto">
                Начать работу <BadgeCheck className="size-4" />
              </Button>
            </div>
          </div>

          <div className="mt-20 grid gap-6 sm:gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
            {FEATURES.map((feature, index) => (
              <div key={index} className="flex flex-col">
                <img
                  src={feature.image}
                  alt={feature.title}
                  className="h-64 w-full rounded-lg object-cover"
                />
                <p className="mt-4 mb-2 text-xl font-bold">{feature.title}</p>
                <p className="mb-6 text-sm text-muted-foreground">
                  {feature.description}
                </p>
                <div className="w-fit rounded-lg border p-2 shadow-sm">
                  {feature.icon}
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-16 grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <BarChart3 className="size-6 mb-2" />
                <CardTitle>Telegram и Email оповещения</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Получайте уведомления о новых негативных или критических отзывах мгновенно
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <Shield className="size-6 mb-2" />
                <CardTitle>Настройка стиля и промптов</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Выберите стиль ответа, настройте ключевые слова и стоп-слова под ваш бренд
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-16 bg-muted/50">
        <div className="container max-w-7xl mx-auto">
          <h2 className="mb-12 text-3xl font-bold text-center">Тарифы</h2>
          <div className="grid gap-8 md:grid-cols-3">
            {PRICING_TIERS.map((tier, index) => (
              <Card key={index} className={tier.popular ? "border-primary shadow-lg" : ""}>
                <CardHeader>
                  {tier.popular && (
                    <div className="text-xs font-semibold text-primary bg-primary/10 px-2 py-1 rounded-full w-fit mb-2">
                      Популярный
                    </div>
                  )}
                  <CardTitle className="text-2xl">{tier.name}</CardTitle>
                  <CardDescription>{tier.description}</CardDescription>
                  <div className="text-3xl font-bold mt-4">{tier.price}</div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {tier.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-center">
                        <Check className="size-4 text-primary mr-2 flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button 
                    className="w-full" 
                    variant={tier.popular ? "default" : "outline"}
                  >
                    Выбрать тариф
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="container max-w-7xl mx-auto text-center">
          <h2 className="mb-6 text-3xl font-bold">
            Начните экономить время уже сегодня
          </h2>
          <p className="mb-8 text-lg text-muted-foreground">
            Без риска, без необходимости нанимать менеджеров
          </p>
          <Button size="lg" className="text-lg px-8 py-4">
            Попробовать бесплатно <ArrowRight className="size-5 ml-2" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-muted/30">
        <div className="container max-w-7xl mx-auto">
          <div className="grid gap-8 md:grid-cols-3">
            <div>
              <h3 className="font-bold mb-4">AI Автоответчик</h3>
              <p className="text-sm text-muted-foreground">
                Автоматизация ответов на отзывы для маркетплейсов
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Контакты</h4>
              <p className="text-sm text-muted-foreground mb-2">
                Email: support@ai-responder.ru
              </p>
              <p className="text-sm text-muted-foreground">
                Telegram: @ai_responder_bot
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Правовая информация</h4>
              <div className="space-y-2">
                <a href="#" className="text-sm text-muted-foreground hover:text-primary block">
                  Политика конфиденциальности
                </a>
                <a href="#" className="text-sm text-muted-foreground hover:text-primary block">
                  Условия использования
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export { FeatureSectionTwo };