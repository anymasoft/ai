/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * deployment-status-badge.tsx
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

import { 
  Eye, 
  Loader2, 
  CheckCircle, 
  Globe, 
  XCircle, 
  Clock,
  type LucideIcon 
} from 'lucide-react'
import { cn } from '@libra/ui/lib/utils'
import { DeploymentStatus } from '../../types/deployment'
import * as m from '@/paraglide/messages'

interface DeploymentStatusBadgeProps {
  status: DeploymentStatus
  className?: string
  size?: 'sm' | 'md' | 'lg'
  showIcon?: boolean
  showText?: boolean
}

interface StatusConfig {
  icon: LucideIcon
  label: string
  bgColor: string
  textColor: string
  borderColor: string
  iconColor: string
  animated?: boolean
}

const getStatusConfig = (status: DeploymentStatus): StatusConfig => {
  switch (status) {
    case DeploymentStatus.PREVIEW:
      return {
        icon: Eye,
        label: m["ide.deployment.dialog.deploymentStatusPreview"](),
        bgColor: 'bg-muted/50',
        textColor: 'text-muted-foreground',
        borderColor: 'border-muted',
        iconColor: 'text-muted-foreground'
      }
    case DeploymentStatus.PREPARING:
      return {
        icon: Clock,
        label: m["ide.deployment.dialog.deploymentStatusPreparing"](),
        bgColor: 'bg-muted/50',
        textColor: 'text-muted-foreground',
        borderColor: 'border-muted',
        iconColor: 'text-muted-foreground',
        animated: true
      }
    case DeploymentStatus.DEPLOYING:
      return {
        icon: Loader2,
        label: m["ide.deployment.dialog.deploymentStatusDeploying"](),
        bgColor: 'bg-primary/10',
        textColor: 'text-primary',
        borderColor: 'border-primary/20',
        iconColor: 'text-primary',
        animated: true
      }
    case DeploymentStatus.DEPLOYED:
    case DeploymentStatus.LIVE:
      return {
        icon: CheckCircle,
        label: status === DeploymentStatus.LIVE
          ? m["ide.deployment.dialog.deploymentStatusLive"]()
          : m["ide.deployment.dialog.deploymentStatusDeployed"](),
        bgColor: 'bg-green-50 dark:bg-green-900/20',
        textColor: 'text-green-700 dark:text-green-300',
        borderColor: 'border-green-200 dark:border-green-800',
        iconColor: 'text-green-600 dark:text-green-400'
      }
    case DeploymentStatus.FAILED:
      return {
        icon: XCircle,
        label: m["ide.deployment.dialog.deploymentStatusFailed"](),
        bgColor: 'bg-destructive/10',
        textColor: 'text-destructive',
        borderColor: 'border-destructive/20',
        iconColor: 'text-destructive'
      }
    case DeploymentStatus.EXISTING:
      return {
        icon: Globe,
        label: m["ide.deployment.dialog.deploymentStatusExisting"](),
        bgColor: 'bg-green-50 dark:bg-green-900/20',
        textColor: 'text-green-700 dark:text-green-300',
        borderColor: 'border-green-200 dark:border-green-800',
        iconColor: 'text-green-600 dark:text-green-400'
      }
    default:
      return {
        icon: Eye,
        label: m["ide.deployment.dialog.deploymentStatusPreview"](),
        bgColor: 'bg-muted/50',
        textColor: 'text-muted-foreground',
        borderColor: 'border-muted',
        iconColor: 'text-muted-foreground'
      }
  }
}

const getSizeClasses = (size: 'sm' | 'md' | 'lg') => {
  switch (size) {
    case 'sm':
      return {
        container: 'px-2 py-1 text-xs',
        icon: 'h-3 w-3',
        gap: 'gap-1'
      }
    case 'lg':
      return {
        container: 'px-4 py-2 text-base',
        icon: 'h-5 w-5',
        gap: 'gap-2'
      }
    default: // md
      return {
        container: 'px-3 py-1.5 text-sm',
        icon: 'h-4 w-4',
        gap: 'gap-1.5'
      }
  }
}

export function DeploymentStatusBadge({
  status,
  className,
  size = 'md',
  showIcon = true,
  showText = true
}: DeploymentStatusBadgeProps) {
  const config = getStatusConfig(status)
  const sizeClasses = getSizeClasses(size)
  const Icon = config.icon

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full border font-medium transition-all duration-200',
        config.bgColor,
        config.textColor,
        config.borderColor,
        sizeClasses.container,
        sizeClasses.gap,
        className
      )}
      role="status"
      aria-label={config.label}
    >
      {showIcon && (
        <Icon
          className={cn(
            sizeClasses.icon,
            config.iconColor,
            config.animated && status === DeploymentStatus.DEPLOYING && 'animate-spin',
            config.animated && status === DeploymentStatus.PREPARING && 'animate-pulse'
          )}
          aria-hidden="true"
        />
      )}
      {showText && (
        <span className="font-medium">
          {config.label}
        </span>
      )}
    </div>
  )
}
