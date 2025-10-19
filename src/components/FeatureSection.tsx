"use client";

import { Bot, MessageSquare, Zap, Shield, Target, Clock } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Hero Section
const HeroSection = () => {
  return (
    <section className="py-12 md:py-24 lg:py-32">
      <div className="container mx-auto px-4">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            Автоматические ответы на отзывы маркетплейсов
          </h1>
          <p className="text-muted-foreground mx-auto mt-6 max-w-3xl text-lg md:text-xl">
            Экономьте время и повышайте продажи, используя AI для управления отзывами на Wildberries, Ozon и Яндекс.Маркет
          </p>
          <Button size="lg" className="mt-8">
            Попробовать бесплатно
          </Button>
        </div>
      </div>
    </section>
  );
};

// Problems Section
const ProblemsSection = () => {
  const problems = [
    {
      icon: Clock,
      text: "Сотни отзывов в день, невозможно отвечать вручную"
    },
    {
      icon: Target,
      text: "Падение рейтинга из-за медленных ответов"
    },
    {
      icon: Shield,
      text: "Траты на менеджеров по отзывам — 25–40 тыс руб/мес"
    }
  ];

  return (
    <section className="py-12 md:py-24 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold">Почему это важно</h2>
          <p className="text-muted-foreground mt-4 max-w-2xl mx-auto">
            Если не отвечать на отзывы оперативно, продажи падают и репутация страдает
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {problems.map((problem, i) => (
            <Card key={i} className="text-center">
              <CardContent className="pt-6">
                <div className="bg-destructive/10 text-destructive flex aspect-square w-12 mx-auto mb-4 items-center justify-center rounded-lg">
                  <problem.icon className="size-6" />
                </div>
                <p className="text-sm">{problem.text}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

// Solution Section
const SolutionSection = () => {
  const solutions = [
    {
      icon: Bot,
      title: "AI-генерация уникальных ответов",
      description: "Автоматическое создание персонализированных ответов на отзывы"
    },
    {
      icon: MessageSquare,
      title: "Поддержка нескольких маркетплейсов",
      description: "Управление отзывами на Wildberries, Ozon и Яндекс.Маркет в одном кабинете"
    },
    {
      icon: Zap,
      title: "Настройка стиля и промптов",
      description: "Выбор стиля ответа, настройка ключевых слов и стоп-слов"
    },
    {
      icon: Shield,
      title: "Уведомления в реальном времени",
      description: "Оповещения в Telegram и Email о новых негативных отзывах"
    },
    {
      icon: Target,
      title: "Полуавтоматический режим",
      description: "AI предлагает варианты, вы публикуете один из них в один клик"
    }
  ];

  return (
    <section className="py-12 md:py-24">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold">Как наш сервис решает эти проблемы</h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {solutions.map((solution, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="bg-primary text-primary-foreground flex aspect-square w-10 mb-2 items-center justify-center rounded-lg">
                  <solution.icon className="size-5" />
                </div>
                <CardTitle className="text-lg">{solution.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">{solution.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

// Pricing Section
const PricingSection = () => {
  const plans = [
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
        "Безлимитные отзывы",
        "Все маркетплейсы",
        "Персональный менеджер",
        "Расширенная аналитика",
        "API интеграция"
      ]
    }
  ];

  return (
    <section className="py-12 md:py-24 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold">Тарифы</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((plan, i) => (
            <Card key={i} className={`relative ${plan.popular ? 'border-primary' : ''}`}>
              {plan.popular && (
                <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  Популярный
                </Badge>
              )}
              <CardHeader className="text-center">
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <div className="mt-4">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground"> руб/мес</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, j) => (
                    <li key={j} className="text-sm flex items-center">
                      <div className="bg-primary/10 text-primary w-4 h-4 rounded-full flex items-center justify-center mr-3">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                      </div>
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button className="w-full" variant={plan.popular ? "default" : "outline"}>
                  Выбрать план
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

// CTA Section
const CTASection = () => {
  return (
    <section className="py-12 md:py-24">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold mb-4">
            Начните экономить время уже сегодня
          </h2>
          <p className="text-muted-foreground mb-8">
            Без риска, без необходимости нанимать менеджеров
          </p>
          <Button size="lg">
            Попробовать бесплатно
          </Button>
        </div>
      </div>
    </section>
  );
};

// Footer
const Footer = () => {
  return (
    <footer className="py-8 border-t bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center text-sm text-muted-foreground">
          <p className="mb-2">© 2024 AI Автоответчик. Все права защищены.</p>
          <div className="flex justify-center gap-4">
            <a href="#" className="hover:text-foreground">Политика конфиденциальности</a>
            <a href="#" className="hover:text-foreground">Условия использования</a>
            <a href="#" className="hover:text-foreground">Контакты</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

// Main Landing Page Component
const LandingPage = () => {
  return (
    <div>
      <HeroSection />
      <ProblemsSection />
      <SolutionSection />
      <PricingSection />
      <CTASection />
      <Footer />
    </div>
  );
};

export { LandingPage as FeatureSection };