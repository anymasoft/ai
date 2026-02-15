/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * deployment-action-buttons.tsx
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
import { Button } from '@libra/ui/components/button'
import { cn } from '@libra/ui/lib/utils'
import * as m from '@/paraglide/messages'

interface DeploymentActionButtonsProps {
  onClose: () => void
  onRedeploy?: () => Promise<void>
  showRedeploy?: boolean
  className?: string
}

export function DeploymentActionButtons({
  onClose,
  onRedeploy,
  showRedeploy = false,
  className
}: DeploymentActionButtonsProps) {
  return (
    <div className={cn("space-y-4 pt-4", className)}>
      {/* Enhanced action buttons with glass effect */}
      <div className="glass-1 rounded-xl p-4 border border-border/30">
        <div className="flex gap-3">
          {showRedeploy && onRedeploy && (
            <Button
              onClick={onRedeploy}
              className="flex-1 h-12 text-sm font-semibold bg-gradient-to-r from-primary to-brand hover:from-primary/90 hover:to-brand/90 shadow-lg"
            >
              <Rocket className="mr-2 h-4 w-4" />
              {m["ide.deployment.dialog.redeploy"]()}
            </Button>
          )}
        </div>

        {/* Additional info section */}
        <div className="flex items-center justify-center gap-2 mt-4 pt-3 border-t border-border/20">
          <div className="w-1.5 h-1.5 bg-gradient-to-r from-primary to-brand rounded-full animate-pulse" />
          <span className="text-xs text-muted-foreground font-medium">
            {showRedeploy ? "可以重新部署更新" : "部署操作完成"}
          </span>
        </div>
      </div>
    </div>
  )
}
