/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * deploy-quota.ts
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

import { getDbForHono, getDbForWorkflow } from '@libra/db'
import { subscriptionLimit } from '@libra/db/schema/project-schema'
import { and, eq, sql } from 'drizzle-orm'
import { log, tryCatch } from '@libra/common'
import type { AppContext, Bindings } from '../types'

// Plan types for quota management
const PLAN_TYPES = {
  FREE: 'FREE',
} as const

type SubscriptionLimitRecord = {
  id: string
  organizationId: string
  stripeCustomerId: string | null
  planName: string
  planId: string
  aiNums: number
  enhanceNums: number
  uploadLimit: number
  seats: number
  projectNums: number
  deployLimit: number
  isActive: boolean
  periodStart: string
  periodEnd: string
  createdAt: string | null
  updatedAt: string | null
}

/**
 * Deduct deploy quota for an organization (Workflow-specific version)
 * Priority: FREE plan first, then paid plan
 * This version uses getDbForWorkflow for use in Cloudflare Workflows
 *
 * @param organizationId - The organization ID to deduct quota from
 * @param env - Workflow environment bindings
 * @returns Promise<boolean> - true if deduction successful, false if no quota available
 */
export async function checkAndUpdateDeployUsageForWorkflow(
  organizationId: string,
  env: Bindings
): Promise<boolean> {
  const db = await getDbForWorkflow(env)

  try {
    log.subscription('info', 'Deploy quota deduction started (workflow)', {
      organizationId,
      operation: 'deploy_quota_deduction_workflow'
    })

    // Get current time from database to ensure UTC consistency across all operations
    const { rows } = await db.execute(sql`SELECT NOW() as "dbNow"`)
    const [{ dbNow }] = rows as [{ dbNow: string | Date }]
    const now = typeof dbNow === 'string' ? new Date(dbNow) : dbNow

    // PRIORITY PATH: Try FREE plan deduction first
    // Users should consume their free quota before paid quota
    const freeDeductionResult = await handleFreePlanDeployDeduction(db, organizationId, now)
    if (freeDeductionResult) {
      log.subscription('info', 'Deploy quota deducted from FREE plan (workflow)', {
        organizationId,
        operation: 'deploy_quota_deduction_workflow'
      })
      return true
    }

    // FALLBACK PATH: Try paid plan deduction only if FREE plan exhausted
    // This ensures paid users can continue deploying after free quota is used
    const paidDeductionResult = await attemptPaidPlanDeployDeduction(db, organizationId, now)
    if (paidDeductionResult.success) {
      log.subscription('info', 'Deploy quota deducted from paid plan (workflow)', {
        organizationId,
        planName: paidDeductionResult.planName,
        remaining: paidDeductionResult.remaining,
        operation: 'deploy_quota_deduction_workflow'
      })
      return true
    }

    // No quota available in either FREE or paid plans
    log.subscription('warn', 'Deploy quota exhausted in all plans (workflow)', {
      organizationId,
      operation: 'deploy_quota_deduction_workflow'
    })
    return false
  } finally {
    // Clean up database connection for workflow
    await db.$client.end()
  }
}

/**
 * Deduct deploy quota for an organization (Hono-specific version)
 * Priority: FREE plan first, then paid plan
 * This version uses getDbForHono instead of getDbAsync to avoid getCloudflareContext issues
 *
 * @param organizationId - The organization ID to deduct quota from
 * @param c - Hono context for database access
 * @returns Promise<boolean> - true if deduction successful, false if no quota available
 */
export async function checkAndUpdateDeployUsageForHono(
  organizationId: string,
  c: AppContext
): Promise<boolean> {
  const db = await getDbForHono(c)
  
  try {
    log.subscription('info', 'Deploy quota deduction started', {
      organizationId,
      operation: 'deploy_quota_deduction'
    })

    // Get current time from database to ensure UTC consistency across all operations
    const { rows } = await db.execute(sql`SELECT NOW() as "dbNow"`)
    const [{ dbNow }] = rows as [{ dbNow: string | Date }]
    const now = typeof dbNow === 'string' ? new Date(dbNow) : dbNow

    // PRIORITY PATH: Try FREE plan deduction first
    // Users should consume their free quota before paid quota
    const freeDeductionResult = await handleFreePlanDeployDeduction(db, organizationId, now)
    if (freeDeductionResult) {
      log.subscription('info', 'Deploy quota deducted from FREE plan', {
        organizationId,
        operation: 'deploy_quota_deduction'
      })
      return true
    }

    // FALLBACK PATH: Try paid plan deduction only if FREE plan exhausted
    // This ensures paid users can continue deploying after free quota is used
    const paidDeductionResult = await attemptPaidPlanDeployDeduction(db, organizationId, now)
    if (paidDeductionResult.success) {
      log.subscription('info', 'Deploy quota deducted from paid plan', {
        organizationId,
        planName: paidDeductionResult.planName,
        remaining: paidDeductionResult.remaining,
        operation: 'deploy_quota_deduction'
      })
      return true
    }

    // No quota available in either FREE or paid plans
    log.subscription('warn', 'Deploy quota exhausted in all plans', {
      organizationId,
      operation: 'deploy_quota_deduction'
    })
    return false
  } finally {
    // Clean up database connection for Hono apps
    c.executionCtx.waitUntil(db.$client.end())
  }
}

/**
 * Attempt paid plan deploy deduction with atomic operation
 * Fast path that tries to deduct from any active paid plan
 */
async function attemptPaidPlanDeployDeduction(
  db: any,
  organizationId: string,
  now: Date
): Promise<{ success: boolean; planName?: string; remaining?: number }> {
  const [result, error] = await tryCatch(async () => {
    // Atomic deduction: decrement deployLimit by 1 where conditions are met
    const paidUpdated = (await db
      .update(subscriptionLimit)
      .set({
        deployLimit: sql`${subscriptionLimit.deployLimit} - 1`,
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(subscriptionLimit.organizationId, organizationId),
          sql`${subscriptionLimit.planName} != ${PLAN_TYPES.FREE}`,
          eq(subscriptionLimit.isActive, true),
          sql`(${subscriptionLimit.deployLimit}) > 0`,
          sql`${subscriptionLimit.periodEnd} >= ${new Date(now).toISOString()}` // Ensure plan hasn't expired
        )
      )
      .returning({
        remaining: subscriptionLimit.deployLimit,
        planName: subscriptionLimit.planName,
      })) as { remaining: number; planName: string }[]

    if (paidUpdated.length > 0) {
      const result = paidUpdated[0]
      return {
        success: true,
        planName: result?.planName || 'unknown',
        remaining: result?.remaining || 0,
      }
    }

    return { success: false }
  })

  if (error) {
    log.subscription('error', 'Paid plan deploy deduction failed', {
      organizationId,
      error: error.message,
      operation: 'deploy_quota_deduction'
    })
    return { success: false }
  }

  return result || { success: false }
}

/**
 * Handle FREE plan deploy deduction with transaction for data consistency
 * Slow path that ensures atomic deduction
 */
async function handleFreePlanDeployDeduction(
  db: any,
  organizationId: string,
  now: Date
): Promise<boolean> {
  const [result, error] = await tryCatch(async () => {
    // Fetch the FREE plan record outside transaction
    const freeLimit = (await db
      .select()
      .from(subscriptionLimit)
      .where(
        and(
          eq(subscriptionLimit.organizationId, organizationId),
          eq(subscriptionLimit.planName, PLAN_TYPES.FREE),
          eq(subscriptionLimit.isActive, true)
        )
      )
      .limit(1)
      .then((rows: any[]) => rows[0])) as SubscriptionLimitRecord | undefined

    if (!freeLimit) {
      return false
    }

    return await db.transaction(async (tx: any) => {
      // Check if plan has expired
      const periodEnd = new Date(freeLimit.periodEnd)
      const nowTimestamp = now.getTime()
      const periodEndTimestamp = periodEnd.getTime()

      if (nowTimestamp > periodEndTimestamp) {
        log.subscription('warn', 'FREE plan expired, cannot deduct deploy quota', {
          organizationId,
          periodEnd: freeLimit.periodEnd,
          now: now.toISOString(),
          operation: 'deploy_quota_deduction'
        })
        return false
      }

      // Check if there's available quota
      if (freeLimit.deployLimit <= 0) {
        log.subscription('warn', 'No deploy quota available in FREE plan', {
          organizationId,
          remaining: freeLimit.deployLimit,
          operation: 'deploy_quota_deduction'
        })
        return false
      }

      // Perform atomic deduction within transaction
      const updated = await tx
        .update(subscriptionLimit)
        .set({
          deployLimit: freeLimit.deployLimit - 1,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(subscriptionLimit.id, freeLimit.id))
        .returning({ remaining: subscriptionLimit.deployLimit })

      return updated.length > 0
    })
  })

  if (error) {
    log.subscription('error', 'FREE plan deploy deduction failed', {
      organizationId,
      error: error.message,
      operation: 'deploy_quota_deduction'
    })
    return false
  }

  return result || false
}
