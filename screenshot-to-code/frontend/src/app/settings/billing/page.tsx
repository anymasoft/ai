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

  const handlePlanSelect = (planId: string) => {
    console.log('Plan selected:', planId)
    // Handle plan selection logic here
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
          <h1 className="text-3xl font-bold">Plans & Billing</h1>
          <p className="text-muted-foreground">
            Manage your subscription and billing information.
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
                  <CardTitle>Available Plans</CardTitle>
                  <CardDescription>
                    Choose a plan that works best for you.
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
