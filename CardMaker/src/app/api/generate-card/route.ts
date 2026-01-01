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
    const { productDescription, marketplace, category, style, seoKeywords, competitors } = body

    if (!productDescription || !marketplace || !category) {
      return NextResponse.json(
        { error: "Требуются поля: productDescription, marketplace, category" },
        { status: 400 }
      )
    }

    // TODO: Реализовать реальную генерацию с OpenAI API
    // Временно возвращаем ошибку (не реализовано)
    return NextResponse.json(
      {
        error: "Функция генерации временно не доступна. Система находится в режиме разработки.",
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
