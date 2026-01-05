'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Zap } from "lucide-react"

interface CurrentPlanCardProps {
  balance: number
  used: number
}

export function CurrentPlanCard({
  balance,
  used,
}: CurrentPlanCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Баланс кредитов</CardTitle>
        <CardDescription>
          Ваш текущий баланс и статистика использования.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            <span className="font-semibold">Кредиты</span>
            <Badge variant="secondary">Активен</Badge>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{balance}</div>
            <div className="text-sm text-muted-foreground">осталось</div>
          </div>
        </div>

        {/* Статистика использования */}
        <div className="space-y-3 border-t pt-4">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Использовано</span>
            <span className="text-sm font-medium text-primary">{used} кредитов</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {used > 0 ? (
              <>Вы использовали {used} кредитов</>
            ) : (
              <>Статистика появится после первого использования</>
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
