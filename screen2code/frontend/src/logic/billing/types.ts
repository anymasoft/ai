// Billing Types для ЮKassa интеграции

export interface SubscriptionPlan {
  id: 'free' | 'basic' | 'professional'
  name: string
  price: number  // в рублях
  creditsPerMonth: number
  features: string[]
}

export interface CreditPackage {
  id: 'starter' | 'standard' | 'premium'
  credits: number
  price: number  // в рублях
  costPerCredit: number
}

export interface PaymentRequest {
  type: 'subscription' | 'topup'
  planId?: string
  packageId?: string
}

export interface PaymentResponse {
  paymentId: string
  paymentUrl: string
  status: 'pending' | 'processing'
}

export interface PaymentStatus {
  paymentId: string
  status: 'pending' | 'succeeded' | 'cancelled' | 'failed'
  amount: number
  createdAt: string
  completedAt?: string
}

export interface Subscription {
  id: string
  userId: string
  planId: 'free' | 'basic' | 'professional'
  status: 'active' | 'cancelled' | 'past_due'
  currentPeriodStart: string
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
}

// TODO: Заполнить реальными ценами после настройки ЮKassa
export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    creditsPerMonth: 500,
    features: ['HTML + Tailwind', 'HTML + CSS', 'Email support'],
  },
  {
    id: 'basic',
    name: 'Basic',
    price: 2490,  // 2,490₽
    creditsPerMonth: 5000,
    features: ['All formats', 'API access', 'Priority support'],
  },
  {
    id: 'professional',
    name: 'Professional',
    price: 8490,  // 8,490₽
    creditsPerMonth: 25000,
    features: ['Priority queue', 'Webhooks', '24h support'],
  },
]

export const CREDIT_PACKAGES: CreditPackage[] = [
  {
    id: 'starter',
    credits: 1000,
    price: 990,
    costPerCredit: 0.99,
  },
  {
    id: 'standard',
    credits: 5000,
    price: 4490,
    costPerCredit: 0.90,
  },
  {
    id: 'premium',
    credits: 15000,
    price: 11990,
    costPerCredit: 0.80,
  },
]
