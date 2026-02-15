/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * checkout-handlers.ts
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

import { tryCatch } from '@libra/common'
import { sendWelcomeEmail } from '@libra/email'
import { eq } from 'drizzle-orm'
import type { Stripe } from 'stripe'
import { getAuthDb, plan } from '../../db'
import { subscription } from '../../db/schema/auth-schema'
import { createOrUpdateSubscriptionLimit } from '../../utils/subscription-limits'
import type { CustomLimits } from '../shared/types'

/**
 * Parse plan limit configuration and extract custom limits
 * @param planRecord Plan record
 * @returns Custom limits object or undefined
 */
function parseCustomLimits(planRecord: any): CustomLimits | undefined {
  if (!planRecord.limits) {
    return undefined
  }

  // Convert limits to Record type for safe access
  let limitsObj: Record<string, any>

  // If limits is a string, try to parse JSON
  if (typeof planRecord.limits === 'string') {
    const [parsed, error] = tryCatch(() => JSON.parse(planRecord.limits))
    if (error) {
      limitsObj = {}
    } else {
      limitsObj = parsed || {}
    }
  } else {
    // If not a string, it may already be an object
    limitsObj = planRecord.limits as Record<string, any>
  }

  // Extract custom limits
  const aiNums = limitsObj.ai_nums ? Number.parseInt(String(limitsObj.ai_nums), 10) : undefined
  const seats = limitsObj.seats ? Number.parseInt(String(limitsObj.seats), 10) : undefined
  const projectNums = limitsObj.project_nums
    ? Number.parseInt(String(limitsObj.project_nums), 10)
    : undefined

  // Only set custom limits if successfully parsed
  if (aiNums !== undefined || seats !== undefined || projectNums !== undefined) {
    const customLimits: CustomLimits = {
      aiNums: !Number.isNaN(aiNums) ? aiNums : undefined,
      seats: !Number.isNaN(seats) ? seats : undefined,
      projectNums: !Number.isNaN(projectNums) ? projectNums : undefined,
    }

    return customLimits
  }

  return undefined
}
