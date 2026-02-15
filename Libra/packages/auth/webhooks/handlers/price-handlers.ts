/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * price-handlers.ts
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
import { eq, or } from 'drizzle-orm'
import type { Stripe } from 'stripe'
import { getAuthDb, plan, price } from '../../db'
import { stripeClient } from '../shared/types'

/**
 * Handle price creation and update events
 * @param event Stripe event object
 */
export async function handlePriceCreatedOrUpdated(event: Stripe.Event) {
  const [, error] = await tryCatch(async () => {
    if (!stripeClient) {
      throw new Error('Stripe client not initialized')
    }

    const priceData = event.data.object as Stripe.Price

    // Get the associated product
    const productId = typeof priceData.product === 'string' ? priceData.product : ''
    const productDetail = await stripeClient.products.retrieve(productId)

    if (!productDetail) {
      throw new Error(`Associated product not found: ${productId}`)
    }

    // Find the related plan
    const db = await getAuthDb()
    const existingPlan = await db.query.plan.findFirst({
      where: eq(plan.name, productDetail.name),
    })

    if (!existingPlan) {
      throw new Error(`Related plan not found: ${productDetail.name}`)
    }

    // Check if the price already exists
    const existingPrices = await db.select().from(price).where(eq(price.priceId, priceData.id))

    const existingPrice = existingPrices.length > 0 ? existingPrices[0] : null

    // Build the price table data
    const priceRecord = {
      priceId: priceData.id,
      planId: existingPlan.id,
      active: priceData.active,
      unitAmount: priceData.unit_amount || 0,
      currency: priceData.currency,
      priceType: priceData.type,
      pricingPlanInterval: priceData.recurring?.interval || null,
      intervalCount: priceData.recurring?.interval_count || 1,
      metadata: JSON.stringify(priceData.metadata || {}), // Convert Stripe.Metadata object to JSON string
      updatedAt: new Date(),
    }

    // Save the price information to the price table
    if (existingPrice) {
      // Update existing price record
      await db.update(price).set(priceRecord).where(eq(price.priceId, priceData.id))
    } else {
      // Create new price record
      await db.insert(price).values({
        ...priceRecord,
        id: createId(),
        createdAt: new Date(),
      })
    }

    // Update the plan's price ID based on the price interval (keep original logic for backward compatibility)
    if (
      priceData.recurring?.interval === 'year' ||
      priceData.metadata?.['billing_scheme'] === 'annual'
    ) {
      // Annual price
      await db
        .update(plan)
        .set({
          annualDiscountPriceId: priceData.id,
          annualDiscountLookupKey: priceData.lookup_key || null,
          updatedAt: new Date(),
        })
        .where(eq(plan.id, existingPlan.id))
    } else {
      // Monthly price (default)
      await db
        .update(plan)
        .set({
          priceId: priceData.id,
          lookupKey: priceData.lookup_key || null,
          updatedAt: new Date(),
        })
        .where(eq(plan.id, existingPlan.id))
    }
  })

  if (error) {
    throw error
  }
}

/**
 * Handle price deletion event
 * @param event Stripe event object
 */
export async function handlePriceDeleted(event: Stripe.Event) {
  const [, error] = await tryCatch(async () => {
    const priceData = event.data.object as Stripe.Price
    const priceId = priceData.id

    // Mark the price record as inactive
    const db = await getAuthDb()
    const existingPrices = await db.select().from(price).where(eq(price.priceId, priceId))

    if (existingPrices.length > 0) {
      await db
        .update(price)
        .set({
          active: false,
          updatedAt: new Date(),
        })
        .where(eq(price.priceId, priceId))
    }

    // Find and update plans using this price ID
    const plansWithPriceId = await db.query.plan.findMany({
      where: or(eq(plan.priceId, priceId), eq(plan.annualDiscountPriceId, priceId)),
    })

    for (const existingPlan of plansWithPriceId) {
      const updateData: {
        priceId?: null
        annualDiscountPriceId?: null
        updatedAt: Date
      } = {
        updatedAt: new Date(),
      }

      if (existingPlan.priceId === priceId) {
        updateData.priceId = null
      }

      if (existingPlan.annualDiscountPriceId === priceId) {
        updateData.annualDiscountPriceId = null
      }

      await db.update(plan).set(updateData).where(eq(plan.id, existingPlan.id))
    }
  })

  if (error) {
    throw error
  }
}
