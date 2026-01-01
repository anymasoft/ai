import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json(
      { error: "Требуется авторизация" },
      { status: 401 }
    )
  }

  try {
    const body = await request.json()
    const { text, marketplace } = body

    if (!text || !marketplace) {
      return NextResponse.json(
        { error: "Требуются поля: text, marketplace" },
        { status: 400 }
      )
    }

    // TODO: Реализовать реальную валидацию с LLM/промптом
    // Временно возвращаем пусто (не реализовано)
    return NextResponse.json(
      {
        error: "Функция валидации временно не доступна. Система находится в режиме разработки.",
        isValid: false,
        issues: [],
        bannedWordsFound: [],
      },
      { status: 501 } // 501 Not Implemented
    )
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to parse request" },
      { status: 400 }
    )
  }
}
