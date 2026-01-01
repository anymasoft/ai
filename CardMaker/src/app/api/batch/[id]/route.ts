import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json(
      { error: "Требуется авторизация" },
      { status: 401 }
    )
  }

  try {
    const { id } = params

    if (!id) {
      return NextResponse.json(
        { error: "Требуется batch ID" },
        { status: 400 }
      )
    }

    // TODO: Реализовать получение статуса батча из БД/очереди
    // Временно возвращаем ошибку (не реализовано)
    return NextResponse.json(
      {
        error: "Функция получения статуса батча временно не доступна. Система находится в режиме разработки.",
      },
      { status: 501 } // 501 Not Implemented
    )
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 400 }
    )
  }
}
