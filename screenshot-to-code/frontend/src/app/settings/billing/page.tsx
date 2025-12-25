"use client"

import { useEffect, useState } from "react"
import { useLocation } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PricingPlans } from "@/components/pricing-plans"
import { CurrentPlanCard } from "./components/current-plan-card"
import { BillingHistoryCard } from "./components/billing-history-card"
import { Loader2 } from "lucide-react"
import { fetchJSON, ApiError } from "@/lib/api"

interface BillingUsage {
  credits: number
  is_free: boolean
}

interface CurrentPlan {
  planName: string
  price: string
  nextBilling: string
  status: string
  creditsTotal: number
  creditsUsed: number
  creditsRemaining: number
  progressPercentage: number
  daysUsed: number
  totalDays: number
  remainingDays: number
  needsAttention: boolean
  attentionMessage: string
}

// Mock billing history (no real data yet)
const billingHistoryData: Array<{id: number; month: string; plan: string; amount: string; status: string}> = []

export default function BillingSettings() {
  const [billingUsage, setBillingUsage] = useState<BillingUsage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [purchasing, setPurchasing] = useState<string | null>(null)

  const location = useLocation()
  const searchParams = new URLSearchParams(location.search)
  const isReturningFromPayment = searchParams.get('success') === '1'

  console.error("[BILLING] BillingSettings component mounted. isReturningFromPayment:", isReturningFromPayment)

  useEffect(() => {
    console.error("[BILLING] BillingSettings useEffect - fetching billing data")
    if (isReturningFromPayment) {
      // Returning from payment - poll until credits are actually added
      console.error("[BILLING] User returning from payment, will poll for credits")
      pollForCredits()
    } else {
      // Normal page load
      fetchBillingData()
    }
  }, [isReturningFromPayment])

  async function fetchBillingData() {
    try {
      console.error("[BILLING] fetching GET /api/billing/usage")
      setLoading(true)
      const data = await fetchJSON<BillingUsage>("/api/billing/usage")
      console.error("[BILLING] GET /api/billing/usage response:", JSON.stringify(data))
      setBillingUsage(data)
      setError(null)
    } catch (err) {
      console.error("Error fetching billing data:", err)
      setError("Failed to load billing information")
    } finally {
      setLoading(false)
    }
  }

  async function pollForCredits() {
    let pollCount = 0
    const maxPolls = 24 // 60 seconds (2.5s per poll)

    const poll = async () => {
      try {
        console.error(`[BILLING] polling for credits (${pollCount + 1}/${maxPolls})`)
        const data = await fetchJSON<BillingUsage>("/api/billing/usage")
        console.error("[BILLING] GET /api/billing/usage response:", JSON.stringify(data))

        if (data.credits > 0) {
          // Credits are here! Payment was successful
          console.error("[BILLING] ✓ Credits detected:", data.credits)
          setBillingUsage(data)
          setError(null)
          setLoading(false)
          return true // Stop polling
        }

        pollCount++
        if (pollCount >= maxPolls) {
          console.error("[BILLING] Timeout waiting for credits")
          // Timeout - load whatever we have
          setBillingUsage(data)
          setLoading(false)
          return true // Stop polling
        }

        return false // Continue polling
      } catch (err) {
        console.error("[BILLING] Error polling for credits:", err)
        pollCount++
        if (pollCount >= maxPolls) {
          setLoading(false)
          return true // Stop polling
        }
        return false // Continue polling
      }
    }

    // Poll immediately
    if (await poll()) return

    // Poll every 2.5 seconds
    const interval = setInterval(async () => {
      if (await poll()) {
        clearInterval(interval)
      }
    }, 2500)
  }

  const handlePlanSelect = async (planId: string) => {
    // Map planId to package name for API
    const packageMap: Record<string, string> = {
      basic: "basic",
      professional: "professional",
      free: "free",
    }

    const packageName = packageMap[planId]
    if (!packageName || packageName === "free") {
      console.log("Free plan selected - no action needed")
      return
    }

    try {
      setPurchasing(packageName)

      const response = await fetchJSON<{ confirmation_url: string }>("/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ package: packageName }),
      })

      if (response.confirmation_url) {
        // Redirect to YooKassa payment page
        window.location.href = response.confirmation_url
      }
    } catch (err) {
      console.error("Error creating payment:", err)
      alert("Ошибка при создании платежа. Попробуйте позже.")
    } finally {
      setPurchasing(null)
    }
  }

  // Build current plan data from API response
  const currentPlanData: CurrentPlan | null = billingUsage ? {
    planName: billingUsage.is_free ? "Free" : "Paid",
    price: "$0",
    nextBilling: "N/A",
    status: "Active",
    creditsTotal: billingUsage.credits,
    creditsUsed: 0,
    creditsRemaining: billingUsage.credits,
    progressPercentage: 0,
    daysUsed: 0,
    totalDays: 30,
    remainingDays: 30,
    needsAttention: false,
    attentionMessage: billingUsage.is_free
      ? "Вы в Free плане. У вас 3 генерации. Купите пакет для большего количества."
      : `У вас ${billingUsage.credits} генераций. Купите еще пакет для большего количества.`,
  } : null

  return (
    <>
      <div className="space-y-6 px-4 lg:px-6">
        <div>
          <h1 className="text-3xl font-bold">Тарифы и биллинг</h1>
          <p className="text-muted-foreground">
            Управляйте вашей подпиской и информацией об оплате.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <p className="text-destructive">{error}</p>
            </CardContent>
          </Card>
        ) : currentPlanData ? (
          <>
            <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
              <CurrentPlanCard plan={currentPlanData} />
              <BillingHistoryCard history={billingHistoryData} />
            </div>

            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Доступные пакеты</CardTitle>
                  <CardDescription>
                    Выберите пакет, который вам подходит.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <PricingPlans
                    mode="billing"
                    currentPlanId={billingUsage?.is_free ? "free" : "paid"}
                    onPlanSelect={handlePlanSelect}
                  />
                </CardContent>
              </Card>
            </div>
          </>
        ) : null}
      </div>
    </>
  )
}
