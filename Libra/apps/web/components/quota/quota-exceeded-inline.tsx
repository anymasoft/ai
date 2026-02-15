'use client'

import { Zap, Info } from 'lucide-react'
import { Button } from '@libra/ui/components/button'
import { cn } from '@libra/ui/lib/utils'

interface QuotaExceededInlineProps {
  remainingDays?: number
  onUpgradeClick?: () => void
  onLearnMoreClick?: () => void
  className?: string
}

export function QuotaExceededInline({
  remainingDays = 7,
  onUpgradeClick,
  onLearnMoreClick,
  className
}: QuotaExceededInlineProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center p-6 text-center space-y-4",
      className
    )}>
      {/* Icon with pulse animation */}
      <div className="relative">
        <div className="absolute inset-0 bg-orange-500/20 blur-2xl rounded-full animate-pulse" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-lg">
          <Zap className="h-8 w-8" />
        </div>
      </div>
      
      {/* Message */}
      <div className="space-y-2 max-w-md">
        <h3 className="text-lg font-semibold">AI Quota Exceeded</h3>
        <p className="text-sm text-muted-foreground">
          You've used all your AI credits for this period. Your quota will reset in {remainingDays} {remainingDays === 1 ? 'day' : 'days'}.
        </p>
      </div>
      
      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
        <Button 
          onClick={onUpgradeClick}
          className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-md hover:shadow-lg transition-all duration-200"
        >
          <Zap className="mr-2 h-4 w-4" />
          Upgrade Plan
        </Button>
        <Button 
          variant="outline" 
          onClick={onLearnMoreClick}
          className="flex-1"
        >
          <Info className="mr-2 h-4 w-4" />
          Learn More
        </Button>
      </div>
      
      {/* Help text */}
      <p className="text-xs text-muted-foreground max-w-md">
        Need help choosing a plan? Check our <button onClick={onLearnMoreClick} className="underline underline-offset-2 hover:text-foreground transition-colors">pricing guide</button> or contact support.
      </p>
    </div>
  )
}