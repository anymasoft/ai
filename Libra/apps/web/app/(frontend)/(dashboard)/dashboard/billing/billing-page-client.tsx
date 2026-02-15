'use client'

import { Button } from '@libra/ui/components/button'
import { Card, CardContent } from '@libra/ui/components/card'
import { Sparkles, FolderOpen, TrendingUp, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import * as m from '@/paraglide/messages'
import { useSubscription } from '@/components/marketing/price/hooks/use-subscription'
import {
  UsageCard,
  PlanOverviewCard,
} from '@/components/billing'

interface SubscriptionData {
  aiNums: number
  aiNumsLimit: number
  seats: number
  seatsLimit: number
  projectNums: number
  projectNumsLimit: number
  plan: string
  periodEnd?: string
  planDetails?: {
    paid?: {
      aiNums: number
      projectNums: number
      aiNumsLimit?: number
      projectNumsLimit?: number
    } | null
    free?: {
      aiNums: number
      projectNums: number
      aiNumsLimit?: number
      projectNumsLimit?: number
    } | null
  }
}

interface BillingPageClientProps {
  subscription: SubscriptionData
}

function getUsageStatus(used: number, total: number) {
  const percentage = total > 0 ? Math.min(Math.round((used / total) * 100), 100) : 0
  if (percentage >= 90) return 'danger'
  if (percentage >= 70) return 'warning'
  return 'normal'
}

function isPaidPlan(planName: string): boolean {
  return planName !== 'FREE' && planName !== 'free'
}

export default function BillingPageClient({ subscription }: BillingPageClientProps) {
  const { handleManageSubscription, isCreatingPortalSession } = useSubscription()
  
  const isUserPaidPlan = isPaidPlan(subscription.plan)
  
  // Calculate combined usage from both free and paid plans using planDetails
  const freeDetails = subscription.planDetails?.free
  const paidDetails = subscription.planDetails?.paid
  
  // AI Messages: Combine free + paid usage
  const freeAiUsed = freeDetails?.aiNumsLimit ? (freeDetails.aiNumsLimit - freeDetails.aiNums) : 0
  const paidAiUsed = paidDetails?.aiNumsLimit ? (paidDetails.aiNumsLimit - paidDetails.aiNums) : 0
  const totalAiUsed = freeAiUsed + paidAiUsed
  const totalAiLimit = (freeDetails?.aiNumsLimit || 0) + (paidDetails?.aiNumsLimit || 0)

  // Projects: Combine free + paid usage
  const freeProjectsUsed = freeDetails?.projectNumsLimit ? (freeDetails.projectNumsLimit - freeDetails.projectNums) : 0
  const paidProjectsUsed = paidDetails?.projectNumsLimit ? (paidDetails.projectNumsLimit - paidDetails.projectNums) : 0
  const totalProjectsUsed = freeProjectsUsed + paidProjectsUsed
  const totalProjectsLimit = (freeDetails?.projectNumsLimit || 0) + (paidDetails?.projectNumsLimit || 0)
  
  // Calculate remaining amounts for action buttons
  const totalAiRemaining = (freeDetails?.aiNums || 0) + (paidDetails?.aiNums || 0)
  const totalProjectsRemaining = (freeDetails?.projectNums || 0) + (paidDetails?.projectNums || 0)
  
  // Calculate usage statuses based on combined used/total
  const aiStatus = getUsageStatus(totalAiUsed, totalAiLimit)
  const seatsStatus = getUsageStatus(subscription.seats, subscription.seatsLimit)
  const projectsStatus = getUsageStatus(totalProjectsUsed, totalProjectsLimit)
  

  
  // Check if user has urgent issues (resources running out)
  const hasUrgentIssues = aiStatus === 'danger' || seatsStatus === 'danger' || projectsStatus === 'danger'
  
  return (
    <div className="flex flex-col gap-6 lg:gap-8 px-3 sm:px-4 lg:px-6 py-4 lg:py-6">
      {/* Plan Overview */}
      <PlanOverviewCard
        planName={subscription.plan}
        periodEnd={subscription.periodEnd ? new Date(subscription.periodEnd) : undefined}
        showUpgrade={!isPaidPlan(subscription.plan)}
      />

      {/* Usage Details */}
      <div className="flex flex-col gap-5 lg:gap-6">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 lg:h-9 lg:w-9 items-center justify-center rounded-lg bg-muted/50 shadow-sm">
            <TrendingUp className="h-4 w-4 lg:h-5 lg:w-5 text-muted-foreground" />
          </div>
          <h2 className="text-xl lg:text-2xl font-semibold tracking-tight text-foreground">
            {m['dashboard.billing.usage.title']()}
          </h2>
        </div>

        {/* Upgrade banner only for non-paid users with urgent issues */}
        {!isUserPaidPlan && hasUrgentIssues && (
          <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
            <CardContent className='p-4'>
              <div className='flex items-center justify-between gap-4'>
                <div className='flex items-center gap-3'>
                  <AlertTriangle className='h-4 w-4 text-amber-600' />
                  <div>
                    <h3 className='font-medium text-sm text-amber-900 dark:text-amber-100'>
                      {m['dashboard.billing.upgrade.title']()}
                    </h3>
                    <p className='text-xs text-amber-700 dark:text-amber-200'>
                      {m['dashboard.billing.upgrade.resourcesRunningOut']()}
                    </p>
                  </div>
                </div>
                <Button variant='outline' size='sm' asChild>
                  <Link href='/#price'>{m['dashboard.billing.upgrade.button']()}</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Usage Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-5">
          {/* AI Messages Usage */}
          <UsageCard
            icon={Sparkles}
            title={m['dashboard.billing.usage.aiMessages.title']()}
            used={totalAiUsed}
            total={totalAiLimit}
            description={
              subscription.planDetails?.paid && subscription.planDetails?.free
                ? m['dashboard.billing.usage.aiMessages.hybridDescription']({
                    paid: paidDetails?.aiNumsLimit || 0,
                    free: freeDetails?.aiNumsLimit || 0
                  })
                : m['dashboard.billing.usage.aiMessages.description']()
            }
            status={aiStatus}
            actionButton={
              totalAiRemaining <= 0 && !isUserPaidPlan ? (
                <Button variant="outline" size="sm" className="w-full text-xs" asChild>
                  <Link href="/#price">{m['dashboard.billing.usage.aiMessages.upgradeForMore']()}</Link>
                </Button>
              ) : undefined
            }
          />

          {/* Project Usage */}
          <UsageCard
            icon={FolderOpen}
            title={m['dashboard.billing.usage.projects.title']()}
            used={totalProjectsUsed}
            total={totalProjectsLimit}
            description={
              subscription.planDetails?.paid && subscription.planDetails?.free
                ? m['dashboard.billing.usage.projects.hybridDescription']({
                    paid: paidDetails?.projectNumsLimit || 0,
                    free: freeDetails?.projectNumsLimit || 0
                  })
                : m['dashboard.billing.usage.projects.description']()
            }
            status={projectsStatus}
            actionButton={
              totalProjectsRemaining <= 0 && !isUserPaidPlan ? (
                <Button variant="outline" size="sm" className="w-full text-xs" asChild>
                  <Link href="/#price">{m['dashboard.billing.usage.projects.createMore']()}</Link>
                </Button>
              ) : undefined
            }
          />
        </div>
      </div>

      {/* Plan Management for Paid Users */}
      {isUserPaidPlan && (
        <Card className="border bg-card">
          <CardContent className='p-4'>
            <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3'>
              <div>
                <h3 className='font-medium text-sm text-foreground'>
                  {m['dashboard.billing.upgrade.title']()}
                </h3>
                <p className='text-xs text-muted-foreground mt-1'>
                  {m['dashboard.billing.upgrade.description']()}
                </p>
              </div>

              <Button
                variant='outline'
                size='sm'
                onClick={handleManageSubscription}
                disabled={isCreatingPortalSession}
              >
                {isCreatingPortalSession ? m['dashboard.billing.manage.processing']() : m['dashboard.billing.manage.button']()}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* General upgrade recommendation for free users */}
      {!isUserPaidPlan && !hasUrgentIssues && (
        <Card className="border bg-card">
          <CardContent className='p-4'>
            <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3'>
              <div>
                <h3 className='font-medium text-sm text-foreground'>
                  {m['dashboard.billing.upgrade.title']()}
                </h3>
                <p className='text-xs text-muted-foreground mt-1'>
                  {m['dashboard.billing.upgrade.description']()}
                </p>
              </div>

              <Button variant='outline' size='sm' asChild>
                <Link href='/#price'>{m['dashboard.billing.upgrade.viewPlans']()}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}