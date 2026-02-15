/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * product-handlers.ts
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
import { createId } from '@paralleldrive/cuid2'
import { eq } from 'drizzle-orm'
import type { Stripe } from 'stripe'
import { getAuthDb, plan } from '../../db'

/**
 * Parse limit information from product metadata
 * @param productData Stripe product object
 * @returns Parsed limits object
 */
function parseProductLimits(productData: Stripe.Product): Record<string, any> {
  let parsedLimits = {}

  // Try to parse JSON format limits
  if (productData.metadata?.['limits']) {
    const [parsed, error] = tryCatch(() => JSON.parse(productData.metadata['limits'] as string))
    if (!error && parsed) {
      parsedLimits = parsed
    }
  }

  // Handle individual limit fields
  const limitsObject: Record<string, any> = { ...parsedLimits }

  // Check and handle individual project_nums field
  if (productData.metadata?.['project_nums']) {
    const projectNums = Number.parseInt(productData.metadata['project_nums'], 10)
    if (!Number.isNaN(projectNums)) {
      limitsObject['project_nums'] = projectNums
    }
  }

  // Check and handle individual ai_nums field
  if (productData.metadata?.['ai_nums']) {
    const aiNums = Number.parseInt(productData.metadata['ai_nums'], 10)
    if (!Number.isNaN(aiNums)) {
      limitsObject['ai_nums'] = aiNums
    }
  }

  // Check and handle individual seats field
  if (productData.metadata?.['seats']) {
    const seats = Number.parseInt(productData.metadata['seats'], 10)
    if (!Number.isNaN(seats)) {
      limitsObject['seats'] = seats
    }
  }

  return limitsObject
}

/**
 * Handle product creation and update events
 * @param event Stripe event object
 */
export async function handleProductCreatedOrUpdated(event: Stripe.Event) {
  const [, error] = await tryCatch(async () => {
    const productData = event.data.object as Stripe.Product

    // Parse product limit information
    const limitsObject = parseProductLimits(productData)

    const planData = {
      name: productData.name,
      description: productData.metadata?.['description'] || null,
      lookupKey: productData.metadata?.['lookup_key'] || null,
      group: productData.metadata?.['group'] || null,
      isActive: productData.active,
      limits: JSON.stringify(limitsObject), // Convert object to JSON string
      marketingFeatures: JSON.stringify(
        productData.marketing_features
          ? productData.marketing_features
              .map((feature) => feature.name || '')
              .filter((name) => name)
          : []
      ), // Convert array to JSON string
      updatedAt: new Date(),
    }

    // Check if a plan with the same name already exists
    const db = await getAuthDb()
    const existingPlan = await db.query.plan.findFirst({
      where: eq(plan.name, planData.name),
    })

    if (existingPlan) {
      // Update existing plan
      await db.update(plan).set(planData).where(eq(plan.name, planData.name))
    } else {
      // Create new plan
      await db.insert(plan).values({
        ...planData,
        id: createId(),
      })
    }
  })

  if (error) {
    console.error(`Product handling failed: ${error}`)
  }
}

/**
 * Handle product deletion event
 * @param event Stripe event object
 */
export async function handleProductDeleted(event: Stripe.Event) {
  const [, error] = await tryCatch(async () => {
    const productData = event.data.object as Stripe.Product

    // Mark product as inactive instead of deleting directly
    const db = await getAuthDb()
    await db
      .update(plan)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(plan.name, productData.name))
  })

  if (error) {
    console.error(`Product deletion handling failed: ${error}`)
  }
}
