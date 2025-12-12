"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface Payment {
  id: number
  invoiceNumber: string
  date: string
  customer: string
  email: string
  plan: string
  amount: string
  status: string
  dueDate: string
}

interface PaymentsTableProps {
  payments: Payment[]
}

export function PaymentsTable({ payments }: PaymentsTableProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "Active":
        return "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
      case "Pending":
        return "bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400"
      case "Disabled":
        return "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
      default:
        return "bg-gray-50 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400"
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Платежи</CardTitle>
        <CardDescription>
          Управление платежами и статусом счётов
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Номер счёта</TableHead>
                <TableHead>Дата</TableHead>
                <TableHead>Клиент</TableHead>
                <TableHead>План</TableHead>
                <TableHead>Сумма</TableHead>
                <TableHead>Статус платежа</TableHead>
                <TableHead>Срок</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell className="font-medium">{payment.invoiceNumber}</TableCell>
                  <TableCell>{payment.date}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{payment.customer}</div>
                      <div className="text-sm text-muted-foreground">{payment.email}</div>
                    </div>
                  </TableCell>
                  <TableCell>{payment.plan}</TableCell>
                  <TableCell className="font-medium">{payment.amount}</TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(payment.status)}>
                      {payment.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{payment.dueDate}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
