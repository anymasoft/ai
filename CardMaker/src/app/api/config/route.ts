import { NextRequest, NextResponse } from "next/server"

// TODO: Заменить на реальное хранилище конфигов (БД)
const defaultConfig = {
  prompts: {
    gen_base: "",
    validate_base: "",
  },
  styles: [
    {
      id: "selling",
      name: "Продающий",
      prompt: "", // будет заполнено из БД
    },
    {
      id: "expert",
      name: "Экспертный",
      prompt: "", // будет заполнено из БД
    },
    {
      id: "brief",
      name: "Краткий",
      prompt: "", // будет заполнено из БД
    },
  ],
  marketplaceRules: {
    ozon: "", // будет заполнено из БД
    wildberries: "", // будет заполнено из БД
  },
  stopWords: [], // будет заполнено из БД
}

// GET /api/config - получить конфигурацию
export async function GET(request: NextRequest) {
  try {
    // TODO: Загрузить конфиги из БД
    // Пока возвращаем структуру с пустыми значениями
    return NextResponse.json(defaultConfig)
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load config" },
      { status: 500 }
    )
  }
}
