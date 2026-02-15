/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * url-status-indicator.tsx
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

import { AlertTriangle } from 'lucide-react'
import { cn } from '@libra/ui/lib/utils'
import { DeploymentStatus } from '../../types/deployment'
import { DeploymentStatusBadge } from './deployment-status-badge'
import * as m from '@/paraglide/messages'

interface UrlStatusIndicatorProps {
  status: DeploymentStatus
  className?: string
  showWarning?: boolean
  showStatusBadge?: boolean
}

const getStatusMessage = (status: DeploymentStatus): string => {
  switch (status) {
    case DeploymentStatus.PREVIEW:
      return m["ide.deployment.dialog.urlNotAccessibleYet"]()
    case DeploymentStatus.PREPARING:
    case DeploymentStatus.DEPLOYING:
      return m["ide.deployment.dialog.urlNotAccessibleYet"]()
    case DeploymentStatus.DEPLOYED:
    case DeploymentStatus.LIVE:
    case DeploymentStatus.EXISTING:
      return m["ide.deployment.dialog.urlAccessibleNow"]()
    case DeploymentStatus.FAILED:
      return m["ide.deployment.dialog.deploymentFailedUrlNotAccessible"]()
    default:
      return m["ide.deployment.dialog.urlNotAccessibleYet"]()
  }
}



const isUrlAccessible = (status: DeploymentStatus): boolean => {
  return [
    DeploymentStatus.DEPLOYED,
    DeploymentStatus.LIVE,
    DeploymentStatus.EXISTING
  ].includes(status)
}

export function UrlStatusIndicator({
  status,
  className,
  showWarning = true,
  showStatusBadge = false
}: UrlStatusIndicatorProps) {
  const statusMessage = getStatusMessage(status)
  const accessible = isUrlAccessible(status)

  // Simplified: only show for non-accessible states
  if (accessible && !showStatusBadge) {
    return null
  }

  return (
    <div className={cn('space-y-2', className)}>
      {/* Simplified Status Badge */}
      {showStatusBadge && (
        <DeploymentStatusBadge status={status} size="sm" />
      )}

      {/* Simplified Warning Message */}
      {showWarning && !accessible && (
        <div className="flex items-center gap-2 p-2 rounded border bg-muted/50 text-muted-foreground text-xs">
          <AlertTriangle className="h-3 w-3 flex-shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}
    </div>
  )
}
