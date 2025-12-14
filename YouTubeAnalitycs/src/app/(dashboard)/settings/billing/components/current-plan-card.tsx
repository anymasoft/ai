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
}

export function CurrentPlanCard({
  planId,
  monthlyUsed,
  monthlyLimit,
  percentageUsed,
}: CurrentPlanCardProps) {
  const plan = getPlanInfo(planId);
  const monthlyRemaining = Math.max(0, monthlyLimit - monthlyUsed);

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
            <Badge variant="secondary">Активен</Badge>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{plan.price}</div>
            <div className="text-sm text-muted-foreground">в месяц</div>
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
