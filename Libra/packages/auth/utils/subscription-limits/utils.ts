/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * utils.ts
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

import {PLAN_TYPES, type PlanLimits, type SubscriptionLimitRecord, type PlanDetails, type PlanType} from './types'
import { plan } from "@libra/auth/db"
import { eq } from 'drizzle-orm'
import { getCache } from '@libra/auth/db'
import { tryCatch } from '@libra/common'

/**
 * Parse plan limits from a JSON string
 */
function parsePlanLimits(limitsJson: string): PlanLimits | null {
  const [parsed, error] = tryCatch(() => JSON.parse(limitsJson))
  
  if (error) {
    console.warn('Failed to parse plan limits JSON:', limitsJson, error);
    return null;
  }
  
  if (parsed) {
    return {
      aiNums: Number.parseInt(parsed.ai_nums ?? '0', 10),
      seats: Number.parseInt(parsed.seats ?? '1', 10),
      projectNums: Number.parseInt(parsed.project_nums ?? '1', 10),
    };
  }
  
  return null;
}

/**
 * Get plan limits from the database with caching mechanism
 */
export async function fetchPlanLimitsWithCache(
  planName: string,
  authDb: any
): Promise<{ limits: PlanLimits; source: 'DB' | 'CONST' }> {
  const cache = await getCache()
  const cacheKey = `planLimits:${planName}`

  // Try to get from KV cache
  const [cached, cacheError] = await tryCatch(async () => cache.get(cacheKey))
  
  if (!cacheError && cached) {
    const [parsed, parseError] = tryCatch(() => JSON.parse(cached))
    if (!parseError && parsed) {
      const result: { limits: PlanLimits; source: 'DB' | 'CONST' } = parsed
      return result
    }
  }
  
  if (cacheError) {
    console.error(`Error fetching plan limits from KV cache for ${planName}:`, cacheError)
  }

  // Get plan limits from the database, no longer fallback to constants
  const planRecord = await authDb
    .select()
    .from(plan)
    .where(eq(plan.name, planName))
    .limit(1)
    .then((rows: any) => rows[0])

  if (!planRecord?.limits) {
    throw new Error(`Plan ${planName} not found in database.`)
  }

  const parsedLimits = parsePlanLimits(planRecord.limits)
  if (!parsedLimits) {
    throw new Error(`Failed to parse limits for plan ${planName}.`)
  }

  const planLimits = parsedLimits
  const source = 'DB' as const

  // Write to KV cache, set to expire in 24 hours
  const [, putError] = await tryCatch(async () => 
    cache.put(cacheKey, JSON.stringify({ limits: planLimits, source }), { expirationTtl:  24 * 3600 })
  )
  
  if (putError) {
    console.error(`Error writing plan limits to KV cache for ${planName}:`, putError)
  }

  return { limits: planLimits, source }
}

export async function fetchPlanLimits(
    planName: string,
    authDb: any
): Promise<{ limits: PlanLimits; source: 'DB' | 'CONST' }> {

  // Get plan limits from the database, no longer fallback to constants
  const planRecord = await authDb
      .select()
      .from(plan)
      .where(eq(plan.name, planName))
      .limit(1)
      .then((rows: any) => rows[0])

  if (!planRecord?.limits) {
    throw new Error(`Plan ${planName} not found in database.`)
  }

  const parsedLimits = parsePlanLimits(planRecord.limits)
  if (!parsedLimits) {
    throw new Error(`Failed to parse limits for plan ${planName}.`)
  }

  const planLimits = parsedLimits
  const source = 'DB' as const

  return { limits: planLimits, source }
}
/**
 * Get the latest active limit record (sorted by periodEnd)
 */
export function getLatestActiveLimit(
  limits: SubscriptionLimitRecord[],
  planType: 'free' | 'paid'
): SubscriptionLimitRecord | null {
  const filtered = limits.filter(limit => {
    if (planType === 'free') {
      return limit.planName === PLAN_TYPES.FREE
    }
    return limit.planName !== PLAN_TYPES.FREE
  })
  
  if (filtered.length === 0) return null
  
  // Sort by periodEnd descending, take the latest
  return filtered.sort((a, b) =>
    new Date(b.periodEnd).getTime() - new Date(a.periodEnd).getTime()
  )[0] || null;
}

/**
 * Create plan details object
 */
export function createPlanDetails(
  limit: SubscriptionLimitRecord,
  planLimits: PlanLimits,
  source: 'DB' | 'CONST'
): PlanDetails {
  return {
    aiNums: limit.aiNums,
    aiNumsLimit: planLimits.aiNums,
    seats: limit.seats,
    seatsLimit: planLimits.seats,
    projectNums: limit.projectNums,
    projectNumsLimit: planLimits.projectNums,
    plan: limit.planName,
    periodEnd: limit.periodEnd,
    source
  }
}

/**
 * Clear plan limit cache (mainly for testing or reset)
 */
export async function clearPlanLimitCache(): Promise<void> {
  const cache = await getCache()
  // Delete all cache items with planLimits prefix
  const list = await cache.list({ prefix: 'planLimits:' })
  await Promise.all(list.keys.map((k: any) => cache.delete(k.name)))
}