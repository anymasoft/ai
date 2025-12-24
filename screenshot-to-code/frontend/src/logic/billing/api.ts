// Billing API Client для ЮKassa

import { PaymentRequest, PaymentResponse, PaymentStatus, Subscription } from './types'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:7001'

// TODO: Получать токен из auth context
function getAuthToken(): string {
  return localStorage.getItem('auth_token') || ''
}

/**
 * Создать подписку
 * TODO: Подключить реальный endpoint /api/billing/subscribe
 */
export async function subscribe(planId: string): Promise<PaymentResponse> {
  // Placeholder implementation
  console.warn('[BILLING] subscribe() - TODO: implement')

  // const response = await fetch(`${API_BASE}/api/billing/subscribe`, {
  //   method: 'POST',
  //   headers: {
  //     'Content-Type': 'application/json',
  //     'Authorization': `Bearer ${getAuthToken()}`,
  //   },
  //   body: JSON.stringify({ plan_id: planId }),
  // })

  // if (!response.ok) {
  //   throw new Error('Failed to create subscription')
  // }

  // return response.json()

  // Mock response
  return {
    paymentId: 'mock_payment_' + Date.now(),
    paymentUrl: 'https://yoomoney.ru/checkout/payments/mock',
    status: 'pending',
  }
}

/**
 * Купить credits
 * TODO: Подключить реальный endpoint /api/billing/buy-credits
 */
export async function buyCredits(packageId: string): Promise<PaymentResponse> {
  console.warn('[BILLING] buyCredits() - TODO: implement')

  // const response = await fetch(`${API_BASE}/api/billing/buy-credits`, {
  //   method: 'POST',
  //   headers: {
  //     'Content-Type': 'application/json',
  //     'Authorization': `Bearer ${getAuthToken()}`,
  //   },
  //   body: JSON.stringify({ package_id: packageId }),
  // })

  // if (!response.ok) {
  //   throw new Error('Failed to purchase credits')
  // }

  // return response.json()

  // Mock response
  return {
    paymentId: 'mock_payment_' + Date.now(),
    paymentUrl: 'https://yoomoney.ru/checkout/payments/mock',
    status: 'pending',
  }
}

/**
 * Получить статус платежа
 * TODO: Подключить реальный endpoint /api/billing/payment/:id
 */
export async function getPaymentStatus(paymentId: string): Promise<PaymentStatus> {
  console.warn('[BILLING] getPaymentStatus() - TODO: implement')

  // const response = await fetch(`${API_BASE}/api/billing/payment/${paymentId}`, {
  //   headers: {
  //     'Authorization': `Bearer ${getAuthToken()}`,
  //   },
  // })

  // if (!response.ok) {
  //   throw new Error('Failed to get payment status')
  // }

  // return response.json()

  // Mock response
  return {
    paymentId,
    status: 'succeeded',
    amount: 2490,
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  }
}

/**
 * Отменить подписку
 * TODO: Подключить реальный endpoint /api/billing/cancel-subscription
 */
export async function cancelSubscription(): Promise<void> {
  console.warn('[BILLING] cancelSubscription() - TODO: implement')

  // const response = await fetch(`${API_BASE}/api/billing/cancel-subscription`, {
  //   method: 'POST',
  //   headers: {
  //     'Authorization': `Bearer ${getAuthToken()}`,
  //   },
  // })

  // if (!response.ok) {
  //   throw new Error('Failed to cancel subscription')
  // }
}

/**
 * Получить текущую подписку
 * TODO: Подключить реальный endpoint /api/billing/subscription
 */
export async function getCurrentSubscription(): Promise<Subscription | null> {
  console.warn('[BILLING] getCurrentSubscription() - TODO: implement')

  // const response = await fetch(`${API_BASE}/api/billing/subscription`, {
  //   headers: {
  //     'Authorization': `Bearer ${getAuthToken()}`,
  //   },
  // })

  // if (response.status === 404) {
  //   return null
  // }

  // if (!response.ok) {
  //   throw new Error('Failed to get subscription')
  // }

  // return response.json()

  // Mock response
  return null
}
