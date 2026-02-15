/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * project-create-button.tsx
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

import { useState } from 'react'
import { Button } from '@libra/ui/components/button'
import { Plus } from 'lucide-react'
import { motion } from 'motion/react'
import { useProjectQuota } from '../hooks/use-project-quota'
import { cn } from '@libra/ui/lib/utils'
import * as m from '@/paraglide/messages'
import { QuotaTooltip } from '@/components/common/quota-tooltip'

export function ProjectCreateButton({ onClick }: { onClick: () => void }) {
  const [isHovered, setIsHovered] = useState(false)
  const { canCreateProject, isQuotaExhausted, quotaInfo, isLoading } = useProjectQuota()

  // Generate quota message using internationalization
  const getQuotaMessage = (): string => {
    if (!quotaInfo) return m["dashboard.projectCreateButton.quota.loading"]()

    if (isQuotaExhausted) {
      return m["dashboard.projectCreateButton.quota.exhausted"]({
        used: quotaInfo.projectNumsLimit,
        limit: quotaInfo.projectNumsLimit
      })
    }

    return m["dashboard.projectCreateButton.quota.remaining"]({
      remaining: quotaInfo.projectNums,
      used: quotaInfo.projectNumsLimit - quotaInfo.projectNums,
      limit: quotaInfo.projectNumsLimit
    })
  }

  return (
    <QuotaTooltip
      message={isQuotaExhausted ? getQuotaMessage() : ''}
      isExhausted={isQuotaExhausted}
      disabled={!isQuotaExhausted}
      side="bottom"
      align="center"
      className="quota-message-container"
    >
      <Button
        size='sm'
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={onClick}
        disabled={!canCreateProject || isLoading}
        className={cn(
          'quota-button',
          isQuotaExhausted && 'quota-button-disabled'
        )}
      >
        <motion.div
          animate={{
            rotate: isHovered ? 90 : 0,
            scale: isHovered ? 1.1 : 1,
          }}
          transition={{
            duration: 0.3,
            ease: 'easeInOut',
          }}
        >
          <Plus className='size-4' />
        </motion.div>
        <span className='text-sm font-medium'>{m["dashboard.create_project"]()}</span>
      </Button>
    </QuotaTooltip>
  )
} 