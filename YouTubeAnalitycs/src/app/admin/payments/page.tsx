import { PaymentsTable } from "./components/payments-table"
import paymentsData from "./data/payments.json"

export const metadata = {
  title: "Платежи - Админ панель",
  description: "Управление платежами и статусом счётов",
}

export default function PaymentsPage() {
  return (
    <div className="space-y-6 px-4 lg:px-6">
      <div>
        <h1 className="text-3xl font-bold">Платежи</h1>
        <p className="text-muted-foreground mt-2">
          Управление платежами, счётами и статусами подписок
        </p>
      </div>

      <PaymentsTable payments={paymentsData} />
    </div>
  )
}
