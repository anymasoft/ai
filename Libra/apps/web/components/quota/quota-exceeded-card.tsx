'use client'

import { AlertCircle, Zap, Clock, ArrowRight } from 'lucide-react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@libra/ui/components/card'
import { Button } from '@libra/ui/components/button'
import { Badge } from '@libra/ui/components/badge'
import { Progress } from '@libra/ui/components/progress'
import { Alert, AlertDescription } from '@libra/ui/components/alert'
import { cn } from '@libra/ui/lib/utils'

interface QuotaExceededCardProps {
  currentUsage?: number
  totalQuota?: number
  billingCycleEnd?: Date
  planName?: string
  onUpgradeClick?: () => void
  onLearnMoreClick?: () => void
  className?: string
}

export function QuotaExceededCard({
  currentUsage = 0,
  totalQuota = 100,
  billingCycleEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  planName = 'Free',
  onUpgradeClick,
  onLearnMoreClick,
  className
}: QuotaExceededCardProps) {
  const usagePercentage = (currentUsage / totalQuota) * 100
  const daysUntilReset = Math.ceil((billingCycleEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  
  return (
    <Card className={cn(
      "relative overflow-hidden border-orange-200 bg-gradient-to-br from-orange-50 via-amber-50/50 to-background",
      "dark:border-orange-900/50 dark:from-orange-950/20 dark:via-amber-950/10",
      className
    )}>
      {/* Decorative gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 via-transparent to-transparent pointer-events-none" />
      
      <CardHeader className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-orange-500/20 blur-xl rounded-full" />
              <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-lg">
                <Zap className="h-6 w-6" />
              </div>
            </div>
            <div>
              <CardTitle className="text-xl font-semibold">AI Quota Exceeded</CardTitle>
              <CardDescription className="text-sm mt-1">
                You've used all your AI credits for this billing period
              </CardDescription>
            </div>
          </div>
          <Badge variant="destructive" className="shrink-0">
            {planName} Plan
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Usage Progress */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Usage this period</span>
            <span className="font-medium text-destructive">
              {currentUsage.toLocaleString()} / {totalQuota.toLocaleString()} credits
            </span>
          </div>
          <Progress 
            value={usagePercentage} 
            className="h-2 bg-orange-100 dark:bg-orange-950"
          />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>Resets in {daysUntilReset} {daysUntilReset === 1 ? 'day' : 'days'}</span>
          </div>
        </div>
        
        {/* Options Alert */}
        <Alert variant="warning" border="left">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            To continue using AI features, you can either upgrade your plan for more credits or wait for your quota to reset next billing cycle.
          </AlertDescription>
        </Alert>
        
        {/* Alternative Actions */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="p-4 rounded-lg border border-border/50 bg-background/50 space-y-2">
            <h4 className="font-medium text-sm">Need more credits?</h4>
            <p className="text-xs text-muted-foreground">
              Upgrade to a higher plan for increased limits and premium features
            </p>
          </div>
          <div className="p-4 rounded-lg border border-border/50 bg-background/50 space-y-2">
            <h4 className="font-medium text-sm">On a budget?</h4>
            <p className="text-xs text-muted-foreground">
              Your quota will automatically reset at the start of your next billing cycle
            </p>
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="flex flex-col sm:flex-row gap-3">
        <Button 
          onClick={onUpgradeClick}
          className="w-full sm:flex-1 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-md hover:shadow-lg transition-all duration-200"
        >
          Upgrade Plan
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
        <Button 
          variant="outline" 
          onClick={onLearnMoreClick}
          className="w-full sm:w-auto"
        >
          View Usage Details
        </Button>
      </CardFooter>
    </Card>
  )
}