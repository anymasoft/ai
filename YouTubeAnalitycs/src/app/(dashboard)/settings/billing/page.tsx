'use client'

import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { PricingPlans } from "@/components/pricing-plans"
import { CurrentPlanCard } from "./components/current-plan-card"
import { BillingHistoryCard } from "./components/billing-history-card"
import type { PlanType } from "@/config/plan-limits"

interface ScriptUsageInfo {
  monthlyLimit: number
  monthlyUsed: number
  percentageUsed: number
}

export default function BillingSettings() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const [scriptUsage, setScriptUsage] = useState<ScriptUsageInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const userPlan = (session?.user?.plan || "free") as PlanType;

  // Webhook обновляет БД. После возврата с YooKassa просто reload страницу
  useEffect(() => {
    const isSuccess = searchParams.get('success') === '1';
    if (isSuccess) {
      console.log('[BillingPage] Возврат с YooKassa, перезагружаю страницу');
      setTimeout(() => {
        window.location.href = '/settings/billing';
      }, 1000);
    }
  }, [searchParams]);

  // Получаем информацию об использовании сценариев
  const fetchUsage = async () => {
    try {
      const response = await fetch("/api/billing/script-usage", {
        cache: "no-store",
      });
      if (response.ok) {
        const data = await response.json();
        setScriptUsage(data);
      } else {
        // При ошибке используем нулевые значения
        setScriptUsage({
          monthlyLimit: 0,
          monthlyUsed: 0,
          percentageUsed: 0,
        });
      }
    } catch (error) {
      console.error("[BillingPage] Ошибка при получении usage:", error);
      // При ошибке сети используем нулевые значения
      setScriptUsage({
        monthlyLimit: 0,
        monthlyUsed: 0,
        percentageUsed: 0,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Инициальная загрузка usage при маунте
  useEffect(() => {
    if (!session?.user?.id) {
      setIsLoading(false);
      return;
    }

    // Fetch при маунте
    fetchUsage();

    // Fetch при возврате в активное окно (получение фокуса)
    window.addEventListener("focus", fetchUsage);

    // Cleanup: удалить listener при размонтировании
    return () => {
      window.removeEventListener("focus", fetchUsage);
    };
  }, [session?.user?.id]);

  // Если данные ещё загружаются, показываем прогресс
  if (isLoading) {
    return (
      <div className="space-y-6 px-4 lg:px-6">
        <div>
          <h1 className="text-3xl font-bold">Тарифы и биллинг</h1>
          <p className="text-muted-foreground">
            Управляйте своей подпиской и информацией о биллинге.
          </p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Загрузка...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-4 lg:px-6">
      <div>
        <h1 className="text-3xl font-bold">Тарифы и биллинг</h1>
        <p className="text-muted-foreground">
          Управляйте своей подпиской и информацией о биллинге.
        </p>
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <CurrentPlanCard
          planId={userPlan}
          monthlyUsed={scriptUsage?.monthlyUsed || 0}
          monthlyLimit={scriptUsage?.monthlyLimit || 0}
          percentageUsed={scriptUsage?.percentageUsed || 0}
        />
        <BillingHistoryCard />
      </div>

      {/* Информация о бесплатном доступе */}
      {userPlan !== 'free' && (
        <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
          <CardTitle className="text-base mb-2">Free</CardTitle>
          <AlertDescription className="space-y-2">
            <p>
              Free — для знакомства с сервисом.
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>До 3 AI-сценариев в месяц</li>
              <li>Генерация по YouTube-ссылке</li>
              <li>Без кнопок «Обновить» в аналитике</li>
              <li>Без повторной генерации</li>
            </ul>
            <p className="pt-2">
              Чтобы использовать регулярно — выберите платный тариф.
            </p>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Доступные тарифы</CardTitle>
            <CardDescription>
              Выберите тариф, который вам подойдёт.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PricingPlans
              mode="billing"
              currentPlanId={userPlan}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
