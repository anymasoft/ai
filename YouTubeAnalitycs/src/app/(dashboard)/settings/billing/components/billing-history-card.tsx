import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"

interface BillingHistoryCardProps {
  isEmpty?: boolean
}

export function BillingHistoryCard({ isEmpty = true }: BillingHistoryCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>История платежей</CardTitle>
        <CardDescription>
          Просмотрите свои прошлые счёта и платежи.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm font-medium">История платежей пока пуста</p>
            <p className="text-xs text-muted-foreground mt-1">
              История платежей появится после вашего первого платежа.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Здесь будет список платежей, когда интегрируется реальная платёжная система */}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
