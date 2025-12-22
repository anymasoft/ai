import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Loader2 } from "lucide-react";
import { useState } from "react";

const plans = [
  {
    id: "free",
    name: "Free",
    description: "Для знакомства с сервисом",
    price: 0,
    features: [
      "10 генераций в месяц",
      "Базовые AI модели",
      "История всех генераций",
      "Поддержка по email",
    ],
    current: true,
  },
  {
    id: "pro",
    name: "Pro",
    description: "Для активных разработчиков",
    price: 2990,
    features: [
      "100 генераций в месяц",
      "Все AI модели",
      "Приоритетная поддержка",
      "API доступ",
    ],
    popular: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "Для команд и студий",
    price: 9990,
    features: [
      "Неограниченные генерации",
      "Все AI модели",
      "Выделенная поддержка",
      "Team management",
    ],
  },
];

export function BillingPage() {
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);

  const handleSelectPlan = async (planId: string) => {
    setLoadingPlanId(planId);
    // Simulate payment processing
    setTimeout(() => {
      setLoadingPlanId(null);
    }, 1000);
  };

  const currentPlan = "free";

  return (
    <div className="px-4 py-4 md:py-6 lg:px-6">
      <div className="mx-auto w-full max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h2 className="font-semibold leading-none">Тарифы и биллинг</h2>
        <p className="text-muted-foreground text-sm">
          Выберите тариф, который подходит вам лучше всего
        </p>
      </div>

      {/* Current Plan Info */}
      <Card>
        <CardHeader>
          <CardTitle>Текущий тариф</CardTitle>
          <CardDescription>Ваша текущая подписка</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">Free</p>
              <p className="text-sm text-muted-foreground">10 генераций в месяц</p>
            </div>
            <span className="text-xl font-bold">Бесплатно</span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Использовано этот месяц</span>
              <span className="font-medium">0 / 10</span>
            </div>
            <div className="w-full bg-secondary rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full"
                style={{ width: "0%" }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pricing Plans */}
      <Card>
        <CardHeader>
          <CardTitle>Доступные тарифы</CardTitle>
          <CardDescription>
            Выберите тариф, который вам подойдёт
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
            {plans.map((plan) => (
              <Card
                key={plan.id}
                className={`flex flex-col ${
                  plan.popular ? "border-primary relative lg:scale-105" : ""
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-0 right-0 flex justify-center">
                    <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                      Самый популярный
                    </span>
                  </div>
                )}
                <CardHeader className={plan.popular ? "pt-6" : ""}>
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-between space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold">
                        {plan.price === 0 ? "Бесплатно" : `${(plan.price / 100).toLocaleString("ru-RU")} ₽`}
                      </span>
                      {plan.price > 0 && (
                        <span className="text-muted-foreground">/месяц</span>
                      )}
                    </div>

                    <ul className="space-y-2">
                      {plan.features.map((feature, idx) => (
                        <li key={idx} className="flex gap-2 text-sm">
                          <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                          <span className="text-muted-foreground">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <Button
                    disabled={currentPlan === plan.id}
                    onClick={() => handleSelectPlan(plan.id)}
                    variant={currentPlan === plan.id ? "outline" : plan.popular ? "default" : "outline"}
                    className="w-full"
                  >
                    {loadingPlanId === plan.id && (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    )}
                    {currentPlan === plan.id
                      ? "Текущий тариф"
                      : plan.id === "free"
                      ? "Использовать"
                      : "Выбрать"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* FAQ or Info */}
      <Card>
        <CardHeader>
          <CardTitle>Нужна помощь?</CardTitle>
          <CardDescription>Свяжитесь с нами по любым вопросам</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Если у вас есть вопросы о тарифах или нужна дополнительная информация,
            пожалуйста, свяжитесь с нашей командой поддержки.
          </p>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
