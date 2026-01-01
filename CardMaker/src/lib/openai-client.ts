import { OpenAI } from 'openai'

// Инициализация OpenAI клиента с проверкой API ключа
const createOpenAIClient = () => {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error(
      'OPENAI_API_KEY не установлен. Добавь переменную окружения в .env.local'
    )
  }

  return new OpenAI({
    apiKey: apiKey,
  })
}

// Создаём глобальный экземпляр клиента (кэшируется)
let openaiClient: OpenAI | null = null

export const getOpenAIClient = (): OpenAI => {
  if (!openaiClient) {
    openaiClient = createOpenAIClient()
  }
  return openaiClient
}

/**
 * Получить модель OpenAI из переменной окружения OPENAI_MODEL
 * По умолчанию используется gpt-4.1-mini
 */
export const getOpenAIModel = (): string => {
  return process.env.OPENAI_MODEL || 'gpt-4.1-mini'
}

// Типы для ответов OpenAI
export type OpenAIModel = string

export interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatCompletionResponse {
  content: string
  usage?: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
  }
}

/**
 * Вспомогательная функция для вызова OpenAI API
 * Обрабатывает ошибки и возвращает структурированный ответ
 */
export const callOpenAI = async (
  messages: ChatCompletionMessage[],
  model?: OpenAIModel,
  temperature: number = 0.7,
  maxTokens: number = 2000
): Promise<ChatCompletionResponse> => {
  try {
    const client = getOpenAIClient()
    const resolvedModel = model || getOpenAIModel()

    const response = await client.chat.completions.create({
      model: resolvedModel,
      messages: messages as any,
      temperature,
      max_tokens: maxTokens,
    })

    const content = response.choices[0]?.message?.content || ''

    return {
      content,
      usage: response.usage
        ? {
            inputTokens: response.usage.prompt_tokens,
            outputTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined,
    }
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      console.error(`[OpenAI API Error] ${error.status}: ${error.message}`)
      throw new Error(`OpenAI API ошибка: ${error.message}`)
    }
    throw error
  }
}
