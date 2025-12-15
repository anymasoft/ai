import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { randomUUID } from "crypto"

interface FeedbackData {
  firstName: string
  lastName: string
  email: string
  subject: string
  message: string
}

export async function POST(request: NextRequest) {
  try {
    const body: FeedbackData = await request.json()
    const { firstName, lastName, email, subject, message } = body

    // Валидация
    if (!firstName || !lastName || !email || !subject || !message) {
      return NextResponse.json(
        { error: "Все поля обязательны" },
        { status: 400 }
      )
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Некорректный формат email" },
        { status: 400 }
      )
    }

    // Получаем текущего пользователя если он авторизован
    const session = await getServerSession(authOptions)
    const userId = session?.user?.email ? (await db.execute("SELECT id FROM users WHERE email = ?", [session.user.email])).rows[0]?.id : null

    // Сохраняем в БД
    const id = randomUUID()
    const createdAt = Math.floor(Date.now() / 1000)

    await db.execute(
      `INSERT INTO admin_messages (id, email, firstName, lastName, subject, message, userId, createdAt, isRead)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [id, email, firstName, lastName, subject, message, userId, createdAt]
    )

    return NextResponse.json(
      { success: true },
      { status: 200 }
    )
  } catch (error) {
    console.error("Feedback error:", error)
    return NextResponse.json(
      { error: "Ошибка при сохранении сообщения" },
      { status: 500 }
    )
  }
}
