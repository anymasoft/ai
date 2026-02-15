/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * deployment-status-header.tsx
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

import { CheckCircle } from 'lucide-react'
import * as m from '@/paraglide/messages'

interface DeploymentStatusHeaderProps {
  isExistingDeployment?: boolean
  className?: string
}

export function DeploymentStatusHeader({
  isExistingDeployment = false,
  className
}: DeploymentStatusHeaderProps) {
  return (
    <div
      className={`text-center space-y-4 px-2 sm:px-0 ${className || ''}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-center gap-3">
        <div
          className="h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center"
          aria-hidden="true"
        >
          <CheckCircle className="h-6 w-6 sm:h-7 sm:w-7 text-green-600 dark:text-green-400" />
        </div>
      </div>
      <div className="space-y-3">
        <h3
          className="text-lg sm:text-xl lg:text-2xl font-semibold text-foreground"
          id="deployment-status-title"
        >
          {isExistingDeployment ? m["ide.deployment.dialog.projectDeployedTitle"]() : m["ide.deployment.dialog.deploymentSuccessTitle"]()}
        </h3>
        <p
          className="text-muted-foreground text-sm sm:text-base max-w-md lg:max-w-lg mx-auto leading-relaxed"
          id="deployment-status-description"
        >
          {isExistingDeployment
            ? m["ide.deployment.dialog.projectDeployedDescription"]()
            : m["ide.deployment.dialog.deploymentSuccessDescription"]()
          }
        </p>
      </div>
    </div>
  )
}
