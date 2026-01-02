'use server'

import { globalJobQueue } from './job-queue'
import { generateProductCard } from './ai-services/generation'

/**
 * Регистрация processor'ов для очереди задач
 * Вызывается один раз при старте сервера
 */
export function registerQueueProcessors() {
  // PROCESSOR: single_generation
  // Используется для одиночной генерации описания товара
  globalJobQueue.registerProcessor('single_generation', async (data: Record<string, unknown>) => {
    const payload = data.payload as Record<string, unknown>

    const result = await generateProductCard({
      productTitle: payload.description as string,
      productCategory: payload.category as string,
      marketplace: payload.marketplace as 'ozon' | 'wb',
      style: payload.style as 'selling' | 'expert' | 'brief',
      seoKeywords: (payload.seoKeywords as string[]) || [],
      competitors: (payload.competitors as string[]) || [],
      userId: data.userId as string,
    })

    // Если ошибка в generateProductCard - он возвращает { success: false, error }
    if (!result.success) {
      throw new Error(result.error.message)
    }

    return result.data
  })

  // PROCESSOR: batch_card_generation
  // Используется для генерации описания товара в batch операции
  globalJobQueue.registerProcessor('batch_card_generation', async (data: Record<string, unknown>) => {
    const payload = data.payload as Record<string, unknown>

    const result = await generateProductCard({
      productTitle: payload.description as string,
      productCategory: payload.category as string,
      marketplace: payload.marketplace as 'ozon' | 'wb',
      style: payload.style as 'selling' | 'expert' | 'brief',
      seoKeywords: (payload.seoKeywords as string[]) || [],
      competitors: (payload.competitors as string[]) || [],
      userId: data.userId as string,
    })

    // Если ошибка в generateProductCard - он возвращает { success: false, error }
    if (!result.success) {
      throw new Error(result.error.message)
    }

    return result.data
  })
}
