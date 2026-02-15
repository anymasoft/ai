/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * feature-status-bar.tsx
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

import React, { useMemo } from 'react'
import { Shield, Zap, RefreshCw } from 'lucide-react'
import { cn } from '@libra/ui/lib/utils'
import * as m from '@/paraglide/messages'

interface FeatureStatus {
  label: string
  color: 'neutral' | 'green' | 'blue' | 'purple' | 'orange'
  active: boolean
  icon?: React.ComponentType<{ className?: string }>
}

interface FeatureStatusBarProps {
  features?: FeatureStatus[]
  className?: string
}

// Simplified default features with neutral colors
const getDefaultFeatures = (): FeatureStatus[] => [
  { label: m["ide.deployment.features.sslEnabled"](), color: 'neutral', active: true, icon: Shield },
  { label: m["ide.deployment.features.cdnAccelerated"](), color: 'neutral', active: true, icon: Zap },
  { label: m["ide.deployment.features.realTimeSync"](), color: 'neutral', active: true, icon: RefreshCw }
]

const colorMap = {
  neutral: 'bg-muted-foreground/60',
  green: 'bg-green-500',
  blue: 'bg-blue-500',
  purple: 'bg-purple-500',
  orange: 'bg-orange-500'
}

// Memoized feature item component for better performance
const FeatureItem = React.memo<{
  feature: FeatureStatus
  index: number
}>(({ feature, index }) => {
  const IconComponent = feature.icon

  return (
    <div key={`feature-${feature.label}-${index}`} className="flex items-center gap-2">
      {IconComponent ? (
        <IconComponent
          className={cn(
            'w-4 h-4',
            feature.active ? colorMap[feature.color].replace('bg-', 'text-') : 'text-muted'
          )}
          aria-hidden="true"
        />
      ) : (
        <div
          className={cn(
            'w-2 h-2 rounded-full',
            feature.active ? colorMap[feature.color] : 'bg-muted'
          )}
          aria-hidden="true"
        />
      )}
      <span className={cn(
        'text-muted-foreground',
        feature.active && 'text-foreground'
      )}>
        {feature.label}
      </span>
    </div>
  )
})

FeatureItem.displayName = 'FeatureItem'

export const FeatureStatusBar = React.memo<FeatureStatusBarProps>(({
  features,
  className
}) => {
  // Memoize default features to prevent recreation
  const defaultFeatures = useMemo(() => getDefaultFeatures(), [])
  const finalFeatures = features || defaultFeatures

  return (
    <div className={cn('deployment-card p-4', className)}>
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-4 flex-wrap">
          {finalFeatures.map((feature, index) => (
            <FeatureItem
              key={`feature-${feature.label}-${index}`}
              feature={feature}
              index={index}
            />
          ))}
        </div>
      </div>
    </div>
  )
})

FeatureStatusBar.displayName = 'FeatureStatusBar'
