'use client'

import { useSession } from "next-auth/react"
import { useEffect, useState, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
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
  const { data: session, update: updateSession, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [scriptUsage, setScriptUsage] = useState<ScriptUsageInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirmSuccess, setConfirmSuccess] = useState(false);
  
  // Защита от повторного вызова confirm
  const confirmProcessedRef = useRef(false);
  const shouldReloadRef = useRef(false);

  const userPlan = (session?.user?.plan || "free") as PlanType;

  // DEV-only: подтверждение платежа через confirm endpoint
  // Вызывается когда пользователь возвращается с ЮKassa с success=1 в URL
  // paymentId может быть в URL или в sessionStorage (оставлено перед редиректом на ЮKassa)
  useEffect(() => {
    const confirmPayment = async () => {
      const isSuccess = searchParams.get('success') === '1';
      
      // Сначала проверяем paymentId в URL
      let paymentId = searchParams.get('paymentId');
      
      // Если paymentId нет в URL, ищем его в sessionStorage
      // (Он был сохранён перед редиректом на ЮKassa в pricing-plans.tsx)
      if (!paymentId && typeof window !== 'undefined') {
        paymentId = sessionStorage.getItem('pendingPaymentId');
        console.log('[BillingPage] Retrieved paymentId from sessionStorage:', paymentId);
      }

      // Условия для вызова confirm:
      // 1. success=1 в URL
      // 2. paymentId присутствует (из URL или sessionStorage)
      // 3. Пользователь аутентифицирован
      // 4. Confirm ещё не был обработан в этой сессии
      if (!isSuccess || !paymentId || !session?.user?.id || confirmProcessedRef.current) {
        console.log('[BillingPage] Skipping confirm:', {
          isSuccess,
          hasPaymentId: !!paymentId,
          hasUserId: !!session?.user?.id,
          alreadyProcessed: confirmProcessedRef.current
        });
        return;
      }

      // Помечаем что confirm уже был обработан - это защита от повторного вызова
      confirmProcessedRef.current = true;

      try {
        setIsConfirming(true);
        setConfirmError(null);

        console.log('[BillingPage] Starting payment confirmation, paymentId:', paymentId);

        // Вызываем dev-only confirm endpoint
        const response = await fetch(`/api/payments/yookassa/confirm?paymentId=${paymentId}`);
        const data = await response.json();

        console.log('[BillingPage] Confirm response:', data);

        if (data.ok) {
          console.log('[BillingPage] Confirm successful');

          // Успешное подтверждение
          setConfirmSuccess(true);

          // Очищаем pendingPaymentId из sessionStorage
          if (typeof window !== 'undefined') {
            sessionStorage.removeItem('pendingPaymentId');
          }

          console.log('[BillingPage] Payment confirmed successfully, reloading page to refresh session...');

          // КРИТИЧЕСКОЕ: Выполняем полную перезагрузку страницы после небольшой задержки
          // Это необходимо потому что:
          // 1. БД обновлена с новым планом (confirm endpoint это сделал)
          // 2. Но JWT токен в cookie всё ещё содержит старый план
          // 3. Полная перезагрузка заставляет NextAuth прочитать сессию заново из БД
          // 4. Новый JWT токен будет сгенерирован с обновлённой информацией о плане
          shouldReloadRef.current = true;
          setTimeout(() => {
            window.location.href = '/settings/billing';
          }, 1500);
        } else {
          setConfirmError(data.error || 'Ошибка при подтверждении платежа');
          console.error('[BillingPage] Payment confirmation failed:', data.error);
        }
      } catch (error) {
        console.error('[BillingPage] Error confirming payment:', error);
        setConfirmError('Ошибка при подтверждении платежа');
      } finally {
        setIsConfirming(false);

        // Удаляем параметры из URL только если не делаем полную перезагрузку
        // Если shouldReloadRef.current === true, то будет window.location.href перезагрузка
        if (!shouldReloadRef.current) {
          router.replace('/settings/billing');
        }
      }
    };

    confirmPayment();
  }, [searchParams, session?.user?.id, router, updateSession]);

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

  const handlePlanSelect = (planId: string) => {
    // Функция для обработки выбора плана
    // В будущем здесь будет логика оплаты
    console.log('Selected plan:', planId);
  }

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

      {/* Сообщение об ошибке подтверждения платежа */}
      {confirmError && (
        <Alert className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
          <AlertDescription className="text-red-700">
            {confirmError}
          </AlertDescription>
        </Alert>
      )}

      {/* Сообщение об успешном подтверждении платежа */}
      {confirmSuccess && (
        <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
          <AlertDescription className="text-green-700">
            Платёж успешно подтвержден! Ваш новый тариф активирован.
          </AlertDescription>
        </Alert>
      )}

      {/* Индикатор подтверждения */}
      {isConfirming && (
        <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
          <AlertDescription className="text-blue-700">
            Подтверждение платежа...
          </AlertDescription>
        </Alert>
      )}

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
              onPlanSelect={handlePlanSelect}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
