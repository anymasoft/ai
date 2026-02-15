/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * step-indicator.tsx
 * Copyright (C) 2025 Nextify Limited
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 *
 */

'use client'

import { Check, Circle, Loader2 } from 'lucide-react'
import { cn } from '@libra/ui/lib/utils'

export interface Step {
  id: string
  title: string
  description?: string
  status: 'pending' | 'current' | 'completed' | 'loading'
}

interface StepIndicatorProps {
  steps: Step[]
  currentStepId: string
  className?: string
  orientation?: 'horizontal' | 'vertical'
  showDescriptions?: boolean
}

export function StepIndicator({
  steps,
  currentStepId,
  className,
  orientation = 'horizontal',
  showDescriptions = false
}: StepIndicatorProps) {
  const currentIndex = steps.findIndex(step => step.id === currentStepId)

  const getStepStatus = (index: number): Step['status'] => {
    const step = steps[index]
    if (step?.status === 'loading') return 'loading'
    if (index < currentIndex) return 'completed'
    if (index === currentIndex) return 'current'
    return 'pending'
  }

  const StepIcon = ({ status, index }: { status: Step['status']; index: number }) => {
    const baseClasses = "flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all duration-300"
    
    switch (status) {
      case 'completed':
        return (
          <div className={cn(baseClasses, "bg-primary border-primary text-primary-foreground")}>
            <Check className="w-4 h-4" aria-hidden="true" />
          </div>
        )
      case 'current':
        return (
          <div className={cn(baseClasses, "bg-primary border-primary text-primary-foreground ring-4 ring-primary/20")}>
            <span className="text-sm font-semibold">{index + 1}</span>
          </div>
        )
      case 'loading':
        return (
          <div className={cn(baseClasses, "bg-primary border-primary text-primary-foreground")}>
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          </div>
        )
      default:
        return (
          <div className={cn(baseClasses, "bg-background border-border text-muted-foreground")}>
            <span className="text-sm font-medium">{index + 1}</span>
          </div>
        )
    }
  }

  const Connector = ({ isCompleted }: { isCompleted: boolean }) => {
    const baseClasses = orientation === 'horizontal' 
      ? "flex-1 h-0.5 mx-2 transition-colors duration-300"
      : "w-0.5 h-8 mx-auto my-2 transition-colors duration-300"
    
    return (
      <div 
        className={cn(
          baseClasses,
          isCompleted ? "bg-primary" : "bg-border"
        )}
        aria-hidden="true"
      />
    )
  }

  if (orientation === 'vertical') {
    return (
      <nav 
        className={cn("flex flex-col", className)}
        aria-label="Progress steps"
      >
        {steps.map((step, index) => {
          const status = getStepStatus(index)
          const isLast = index === steps.length - 1
          
          return (
            <div key={step.id} className="flex flex-col items-start">
              <div className="flex items-center w-full">
                <StepIcon status={status} index={index} />
                <div className="ml-4 flex-1 min-w-0">
                  <h3 className={cn(
                    "text-sm font-medium transition-colors duration-300",
                    status === 'current' ? "text-foreground" : 
                    status === 'completed' ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {step.title}
                  </h3>
                  {showDescriptions && step.description && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {step.description}
                    </p>
                  )}
                </div>
              </div>
              {!isLast && (
                <div className="ml-4 mt-2">
                  <Connector isCompleted={index < currentIndex} />
                </div>
              )}
            </div>
          )
        })}
      </nav>
    )
  }

  return (
    <nav 
      className={cn("flex items-center justify-between w-full", className)}
      aria-label="Progress steps"
    >
      {steps.map((step, index) => {
        const status = getStepStatus(index)
        const isLast = index === steps.length - 1
        
        return (
          <div key={step.id} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <StepIcon status={status} index={index} />
              <div className="mt-2 text-center">
                <h3 className={cn(
                  "text-xs sm:text-sm font-medium transition-colors duration-300",
                  status === 'current' ? "text-foreground" : 
                  status === 'completed' ? "text-foreground" : "text-muted-foreground"
                )}>
                  {step.title}
                </h3>
                {showDescriptions && step.description && (
                  <p className="text-xs text-muted-foreground mt-1 hidden sm:block">
                    {step.description}
                  </p>
                )}
              </div>
            </div>
            {!isLast && <Connector isCompleted={index < currentIndex} />}
          </div>
        )
      })}
    </nav>
  )
}
