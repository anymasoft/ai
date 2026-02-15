/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * success-actions.tsx
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

import { Rocket } from 'lucide-react'
import { ActionButton } from '../atoms'
import * as m from '@/paraglide/messages'

interface SuccessActionsProps {
  onRedeploy?: () => Promise<void>
  onClose: () => void
  showRedeployButton?: boolean
  redeployLoading?: boolean
  className?: string
}

export function SuccessActions({
  onRedeploy,
  onClose,
  showRedeployButton = false,
  redeployLoading = false,
  className
}: SuccessActionsProps) {
  return (
    <div className={`flex gap-3 pt-4 ${className || ''}`}>
      {showRedeployButton && onRedeploy && (
        <ActionButton
          intent="primary"
          onClick={onRedeploy}
          loading={redeployLoading}
          icon={Rocket}
          className="flex-1"
        >
          {m["ide.deployment.success.redeploy"]()}
        </ActionButton>
      )}
      <ActionButton
        intent="secondary"
        onClick={onClose}
        className="flex-1"
      >
        {m["ide.deployment.success.complete"]()}
      </ActionButton>
    </div>
  )
}
