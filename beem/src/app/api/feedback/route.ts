import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { randomUUID } from "crypto"

interface FeedbackData {
  message: string
}

export async function POST(request: NextRequest) {
  try {
    const body: FeedbackData = await request.json()
    const { message } = body

    // Валидация
    if (!message || message.trim().length === 0) {
      return NextResponse.json(
        { error: "Сообщение обязательно" },
        { status: 400 }
      )
    }

    // Получаем текущего пользователя
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Требуется авторизация" },
        { status: 401 }
      )
    }

    // Извлекаем данные пользователя из сессии
    const email = session.user.email
    const name = session.user.name || "Unknown User"
    const [firstName, ...lastNameParts] = name.split(" ")
    const lastName = lastNameParts.join(" ") || ""

    // Генерируем тему из первых 50 символов сообщения
    const subject = message.substring(0, 50) + (message.length > 50 ? "..." : "")

    // Получаем ID пользователя если он авторизован
    const userResult = await db.execute(
      "SELECT id FROM users WHERE email = ?",
      [email]
    )
    const userId = userResult.rows?.[0]?.id || null

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
