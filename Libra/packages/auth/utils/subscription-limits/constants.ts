/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * constants.ts
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

import { getAuthDb } from '@libra/auth/db'
import { PLAN_TYPES, type PlanType, type PlanLimits } from './types'
import {fetchPlanLimits, fetchPlanLimitsWithCache} from './utils'

/**
 * Retrieve limits for a single plan from the database.
 * @throws Error if plan limits cannot be fetched.
 */
export async function getPlanLimits(
  planType: PlanType
): Promise<{ limits: PlanLimits; source: 'DB' | 'CONST' }> {
  const authDb = await getAuthDb()
  return fetchPlanLimitsWithCache(planType, authDb)
}

/**
 * Retrieve limits for all plans from the database.
 * @throws Error if any plan limits cannot be fetched.
 */
export async function getAllPlanLimits(): Promise<Record<PlanType, { limits: PlanLimits; source: 'DB' | 'CONST' }>> {
  const authDb = await getAuthDb()
  const entries = await Promise.all(
    Object.values(PLAN_TYPES).map(async (planType) => {
      const result = await fetchPlanLimitsWithCache(planType, authDb)
      return [planType, result] as const
    })
  )
  return Object.fromEntries(entries) as Record<PlanType, { limits: PlanLimits; source: 'DB' | 'CONST' }>
}

/**
 * Retrieve limits for a single plan from the database using a Hono-compatible database connection.
 * This function is designed for use in Cloudflare Workers environments (like CDN service)
 * where Next.js-specific database connection methods are not available.
 *
 * @param planType The plan type to retrieve limits for
 * @param authDb Hono-compatible database connection instance
 * @returns Promise resolving to plan limits and source information
 * @throws Error if plan limits cannot be fetched.
 */
export async function getPlanLimitsForHono(
  planType: PlanType,
  authDb: any
): Promise<{ limits: PlanLimits; source: 'DB' | 'CONST' }> {
  return fetchPlanLimits(planType, authDb)
}