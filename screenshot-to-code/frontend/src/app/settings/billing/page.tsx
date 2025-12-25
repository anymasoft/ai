"use client"

import { useEffect, useState } from "react"
import { useLocation, useSearchParams } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PricingPlans } from "@/components/pricing-plans"
import { CurrentPlanCard } from "./components/current-plan-card"
import { BillingHistoryCard } from "./components/billing-history-card"
import { Loader2 } from "lucide-react"
import { fetchJSON, ApiError } from "@/lib/api"

interface BillingUsage {
  plan: string  // "free", "basic", или "professional"
  credits: number
}

interface PaymentStatusResponse {
  status: "pending" | "succeeded" | "canceled"
  credits?: number
  message: string
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
  const [searchParams] = useSearchParams()
  const paymentId = searchParams.get("payment_id")

  const [billingUsage, setBillingUsage] = useState<BillingUsage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [purchasing, setPurchasing] = useState<string | null>(null)

  useEffect(() => {
    console.error("[BILLING] ========== useEffect CALLED ==========")
    console.error("[BILLING] BillingSettings component mounted")
    console.error("[BILLING] searchParams:", Object.fromEntries(searchParams))
    console.error("[BILLING] paymentId from URL:", paymentId)

    // If returning from payment, first process the payment status
    if (paymentId) {
      console.error("[BILLING] ✓ Payment ID FOUND! Processing payment:", paymentId)
      processPaymentAndFetchData()
    } else {
      console.error("[BILLING] ✗ No payment ID found, just fetching billing data")
      fetchBillingData()
    }
  }, [paymentId])

  async function processPaymentAndFetchData() {
    try {
      console.error("[BILLING] processPaymentAndFetchData() STARTED with paymentId:", paymentId)
      setLoading(true)

      // Poll for payment status with retries (like the old /billing page did)
      let statusResponse: PaymentStatusResponse | null = null
      let pollAttempt = 0
      const maxPolls = 60 // Try for 2.5 minutes (60 * 2.5s)

      while (pollAttempt < maxPolls) {
        try {
          console.error(`[BILLING] Polling payment status (attempt ${pollAttempt + 1}/${maxPolls})`)
          const url = `/api/billing/status?payment_id=${paymentId}`
          statusResponse = await fetchJSON<PaymentStatusResponse>(url)
          console.error("[BILLING] Payment status response:", JSON.stringify(statusResponse))

          if (statusResponse.status === "succeeded" || statusResponse.status === "canceled") {
            console.error(`[BILLING] ✓ Payment ${statusResponse.status}! Stopping poll`)
            break
          }

          // If pending, wait before next poll
          if (statusResponse.status === "pending") {
            console.error("[BILLING] Payment still pending, waiting 2.5s before next poll...")
            await new Promise(resolve => setTimeout(resolve, 2500))
            pollAttempt++
          }
        } catch (pollErr) {
          console.error(`[BILLING] Error during poll (attempt ${pollAttempt + 1}):`, pollErr)
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 2500))
          pollAttempt++
        }
      }

      if (!statusResponse) {
        throw new Error("Failed to get payment status after polling")
      }

      // Clear payment_id from URL to avoid re-processing
      console.error("[BILLING] Clearing payment_id from URL")
      window.history.replaceState({}, document.title, "/settings/billing")
      console.error("[BILLING] URL cleaned")

      // Then fetch the updated billing data
      console.error("[BILLING] Calling fetchBillingData() after payment processing")
      await fetchBillingData()
      console.error("[BILLING] ✓ processPaymentAndFetchData() completed successfully")
    } catch (err) {
      console.error("[BILLING] ✗ Error processing payment:", err)
      // Even if payment processing fails, try to load billing data
      console.error("[BILLING] Attempting fetchBillingData() despite error")
      await fetchBillingData()
      console.error("[BILLING] fetchBillingData() completed after error")
    }
  }

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

  // Map plan codes to display names
  const planDisplayNames: Record<string, string> = {
    free: "Free",
    basic: "Basic",
    professional: "Professional",
  }

  const planAttentionMessages: Record<string, string> = {
    free: "Вы в Free плане. У вас 3 генерации. Купите пакет для большего количества.",
    basic: `У вас ${billingUsage?.credits || 0} генераций (Basic). Купите еще пакет для большего количества.`,
    professional: `У вас ${billingUsage?.credits || 0} генераций (Professional). Купите еще пакет для большего количества.`,
  }

  // Build current plan data from API response
  const currentPlanData: CurrentPlan | null = billingUsage ? {
    planName: planDisplayNames[billingUsage.plan] || "Free",
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
    attentionMessage: planAttentionMessages[billingUsage.plan] || planAttentionMessages.free,
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
                    currentPlanId={billingUsage?.plan || "free"}
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
