'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Crown } from "lucide-react"
import { getPlanInfo } from "@/config/plan-limits"
import type { PlanType } from "@/config/plan-limits"

interface CurrentPlanCardProps {
  planId: PlanType
  monthlyUsed: number
  monthlyLimit: number
  percentageUsed: number
  billingCycle?: "monthly" | "yearly"
}

export function CurrentPlanCard({
  planId,
  monthlyUsed,
  monthlyLimit,
  percentageUsed,
  billingCycle = "monthly",
}: CurrentPlanCardProps) {
  const plan = getPlanInfo(planId);
  const monthlyRemaining = Math.max(0, monthlyLimit - monthlyUsed);

  // Рассчитываем стоимость в зависимости от billingCycle
  const basePriceStr = plan.price;
  const basePrice = parseInt(basePriceStr.replace(/\s/g, ''));
  const displayPrice = billingCycle === 'yearly' ? (basePrice * 10) : basePrice;
  const pricePeriod = billingCycle === 'yearly' ? 'в год' : 'в месяц';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Текущий тариф</CardTitle>
        <CardDescription>
          Вы используете план {plan.name} ({billingCycle === 'yearly' ? 'годовая' : 'месячная'} подписка).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Crown className="h-5 w-5 text-yellow-500" />
            <span className="font-semibold">{plan.name}</span>
            <Badge variant="secondary">Активен</Badge>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{displayPrice} ₽</div>
            <div className="text-sm text-muted-foreground">{pricePeriod}</div>
          </div>
        </div>

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
