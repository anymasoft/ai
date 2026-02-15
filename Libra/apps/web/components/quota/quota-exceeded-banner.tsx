'use client'

import { Zap, X } from 'lucide-react'
import { Button } from '@libra/ui/components/button'
import { cn } from '@libra/ui/lib/utils'
import { useState } from 'react'

interface QuotaExceededBannerProps {
  onUpgradeClick?: () => void
  onDismiss?: () => void
  className?: string
  compact?: boolean
}

export function QuotaExceededBanner({
  onUpgradeClick,
  onDismiss,
  className,
  compact = false
}: QuotaExceededBannerProps) {
  const [isVisible, setIsVisible] = useState(true)

  const handleDismiss = () => {
    setIsVisible(false)
    onDismiss?.()
  }

  if (!isVisible) return null

  if (compact) {
    return (
      <div className={cn(
        "flex items-center justify-between gap-3 p-3 bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-200 dark:border-orange-900/50 rounded-lg",
        className
      )}>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Zap className="h-4 w-4 text-orange-500 shrink-0" />
          <p className="text-sm font-medium truncate">AI quota exceeded</p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="text-orange-600 hover:text-orange-700 hover:bg-orange-100/50 dark:text-orange-400 dark:hover:text-orange-300 dark:hover:bg-orange-900/50"
          onClick={onUpgradeClick}
        >
          Upgrade
        </Button>
      </div>
    )
  }

  return (
    <div className={cn(
      "relative overflow-hidden rounded-lg border border-orange-200 bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50 p-4 dark:border-orange-900/50 dark:from-orange-950/30 dark:via-amber-950/20 dark:to-orange-950/30",
      className
    )}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-md">
          <Zap className="h-5 w-5" />
        </div>
        
        <div className="flex-1 space-y-1">
          <h3 className="font-semibold text-base">You've reached your AI usage limit</h3>
          <p className="text-sm text-muted-foreground">
            Upgrade your plan to continue using AI features or wait for the next billing cycle.
          </p>
          
          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              size="sm"
              onClick={onUpgradeClick}
              className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-sm hover:shadow-md transition-all duration-200"
            >
              Upgrade Plan
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDismiss}
              className="text-muted-foreground hover:text-foreground"
            >
              Dismiss
            </Button>
          </div>
        </div>
        
        <Button
          size="icon"
          variant="ghost"
          onClick={handleDismiss}
          className="h-8 w-8 rounded-full hover:bg-orange-100 dark:hover:bg-orange-900/50"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Dismiss</span>
        </Button>
      </div>
    </div>
  )
}