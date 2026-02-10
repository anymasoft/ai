'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Crown, AlertTriangle, Clock } from "lucide-react"
import { getPlanInfo } from "@/config/plan-limits"
import type { PlanType } from "@/config/plan-limits"

interface CurrentPlanCardProps {
  planId: PlanType
  monthlyUsed: number
  monthlyLimit: number
  percentageUsed: number
  expiresAt: number | null
}

export function CurrentPlanCard({
  planId,
  monthlyUsed,
  monthlyLimit,
  percentageUsed,
  expiresAt,
}: CurrentPlanCardProps) {
  const plan = getPlanInfo(planId);
  const monthlyRemaining = Math.max(0, monthlyLimit - monthlyUsed);

  // Вычисляем информацию об истечении
  const now = Math.floor(Date.now() / 1000);
  const isExpired = expiresAt && expiresAt < now;
  const daysRemaining = expiresAt ? Math.ceil((expiresAt - now) / (24 * 60 * 60)) : null;
  const expirationDate = expiresAt ? new Date(expiresAt * 1000).toLocaleDateString("ru-RU") : null;
  const isExpiringSoon = daysRemaining && daysRemaining <= 3 && daysRemaining > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Текущий тариф</CardTitle>
        <CardDescription>
          Вы используете план {plan.name}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Crown className="h-5 w-5 text-yellow-500" />
            <span className="font-semibold">{plan.name}</span>
            {isExpired ? (
              <Badge variant="destructive">Истёк</Badge>
            ) : isExpiringSoon ? (
              <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300">Заканчивается</Badge>
            ) : (
              <Badge variant="secondary">Активен</Badge>
            )}
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{plan.price}</div>
            <div className="text-sm text-muted-foreground">в месяц</div>
          </div>
        </div>

        {/* Информация об истечении */}
        {expiresAt && (
          <div className="border-t pt-4 space-y-3">
            {isExpired ? (
              <Alert className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800 dark:text-red-200">
                  <strong>Тариф истёк</strong> — {expirationDate}.
                  Ваша подписка завершена. Выберите новый тариф, чтобы продолжить.
                </AlertDescription>
              </Alert>
            ) : isExpiringSoon ? (
              <Alert className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
                <Clock className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-orange-800 dark:text-orange-200">
                  <strong>Тариф заканчивается через {daysRemaining} {daysRemaining === 1 ? "день" : "дней"}</strong> — {expirationDate}.
                  Пора выбрать новый тариф.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Действителен до {expirationDate} ({daysRemaining} {daysRemaining === 1 ? "день" : "дней"})</span>
              </div>
            )}
          </div>
        )}

        {/* Сценарии в этом месяце */}
        <div className="space-y-3 border-t pt-4">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Сценарии в этом месяце</span>
            <span className="text-sm font-medium text-primary">{monthlyRemaining} осталось из {monthlyLimit}</span>
          </div>
          <Progress value={percentageUsed} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {monthlyUsed > 0 ? (
              <>Использовано {monthlyUsed} сценариев ({percentageUsed}%)</>
            ) : (
              <>Статистика появится после первой генерации</>
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
