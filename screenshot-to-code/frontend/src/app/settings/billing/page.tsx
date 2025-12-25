"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PricingPlans } from "@/components/pricing-plans"
import { CurrentPlanCard } from "./components/current-plan-card"
import { BillingHistoryCard } from "./components/billing-history-card"
import { Loader2 } from "lucide-react"
import { fetchJSON, ApiError } from "@/lib/api"

interface BillingUsage {
  plan: string
  used: number
  limit: number
  remaining: number
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

  useEffect(() => {
    fetchBillingData()
  }, [])

  async function fetchBillingData() {
    try {
      setLoading(true)
      const data = await fetchJSON<BillingUsage>("/api/billing/usage")
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

  // Build current plan data from API response
  const getPlanName = (plan: string): string => {
    const names: Record<string, string> = {
      free: "Free",
      basic: "Basic",
      professional: "Professional",
    }
    return names[plan] || plan
  }

  const currentPlanData: CurrentPlan | null = billingUsage ? {
    planName: getPlanName(billingUsage.plan),
    price: "$0",
    nextBilling: "N/A",
    status: "Active",
    creditsTotal: billingUsage.limit,
    creditsUsed: billingUsage.used,
    creditsRemaining: billingUsage.remaining,
    progressPercentage: (billingUsage.used / billingUsage.limit) * 100,
    daysUsed: 0,
    totalDays: 30,
    remainingDays: 30,
    needsAttention: billingUsage.used >= billingUsage.limit * 0.9,
    attentionMessage: billingUsage.used >= billingUsage.limit
      ? `You've reached your ${billingUsage.plan} plan limit (${billingUsage.limit} generations)`
      : `You're using ${((billingUsage.used / billingUsage.limit) * 100).toFixed(0)}% of your limit`,
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
