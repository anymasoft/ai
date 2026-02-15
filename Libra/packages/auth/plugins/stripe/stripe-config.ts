/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * stripe-config.ts
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

import type { GenericEndpointContext, Session, User } from 'better-auth'
import type { Subscription } from '@libra/better-auth-stripe'
import { eq } from 'drizzle-orm'
import { getAuthDb, member, plan } from '../../db'
import {
  handlePriceCreatedOrUpdated,
  handlePriceDeleted,
  handleProductCreatedOrUpdated,
  handleProductDeleted,
} from '../../webhooks/stripe-handler'

export const getCheckoutSessionParams = async (
  data: {
    user: User & Record<string, any>
    session: Session & Record<string, any>
    plan: any
    subscription: Subscription
  },
  _ctx: GenericEndpointContext
) => {
  return {
    params: {
      allow_promotion_codes: true,
      tax_id_collection: {
        enabled: true,
      },
      billing_address_collection: 'required' as const,
      custom_text: {
        submit: {
          message: "We'll start your subscription right away",
        },
      },
      metadata: {
        planType: data?.plan?.name,
        referralCode: data?.user.metadata?.referralCode,
      },
    },
    options: {
      idempotencyKey: `sub_${data?.user.id}_${data?.plan.name}_${Date.now()}`,
    },
  }
}

export const getPlans = async () => {
  const db = await getAuthDb() // Get database instance
  // Query the plan table using db.select().from()
  const plans = await db.select().from(plan).where(eq(plan.isActive, true))

  return plans.map((planItem: any) => ({
    name: planItem.name,
    priceId: planItem.priceId || '', // Ensure priceId is not null, convert to empty string
    annualDiscountPriceId: planItem.annualDiscountPriceId || '',
    limits: planItem.limits as Record<string, number>, // Use limits from planItem and specify correct type
  }))
}

export const authorizeReference = async ({ user, session: _session, referenceId, action }: any) => {
  const db = await getAuthDb() // Get database instance
  // Check if the user has permission to manage subscriptions for this reference
  if (
    action === 'upgrade-subscription' ||
    action === 'cancel-subscription' ||
    action === 'restore-subscription'
  ) {
    const org = await db.query.member.findFirst({
      where: (fields: any) => {
        return eq(fields.organizationId, referenceId) && eq(fields.userId, user.id)
      },
    })
    return org?.role === 'owner'
  }
  return true
}

export const onEvent = async (event: any) => {
  // Handle any Stripe event
  switch (event.type) {
    case 'product.created':
    case 'product.updated':
      // Call the handler in stripe-handler
      await handleProductCreatedOrUpdated(event)
      break
    case 'product.deleted':
      // Call the handler in stripe-handler
      await handleProductDeleted(event)
      break
    case 'price.created':
    case 'price.updated':
      // Call the handler in stripe-handler
      await handlePriceCreatedOrUpdated(event)
      break
    case 'price.deleted':
      // Call the handler in stripe-handler
      await handlePriceDeleted(event)
      break
  }
}
