/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * subscription-analysis.ts
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

import { VALID_RENEWAL_STATUSES, PERIOD_TIME_TOLERANCE } from '../shared/constants'

/**
 * Accurately determine whether a subscription update is a renewal
 *
 * Core criteria for renewal:
 * 1. Time continuity: new period start time = old period end time (allow ≤1s error)
 * 2. Price consistency: subscription price ID remains unchanged
 * 3. Status validity: subscription status must be active
 * 4. Period extension: new period end time > old period end time
 *
 * @param stripeSubscription Stripe subscription object
 * @param dbSubscription Subscription record in the database
 * @returns Whether it is a renewal update
 */
export function isSubscriptionRenewal(stripeSubscription: any, dbSubscription: any): boolean {
  // === Basic data validation ===
  if (!stripeSubscription || !dbSubscription) {
    return false
  }
  
  // === Status validity check ===
  if (!VALID_RENEWAL_STATUSES.includes(stripeSubscription.status)) {
    return false
  }
  
  // === Price consistency check ===
  // Get price ID from Stripe subscription
  const stripePriceId = stripeSubscription.items?.data?.[0]?.price?.id
  if (!stripePriceId) {
    return false
  }
  
  // If the database stores a price ID, it must match
  if (dbSubscription.priceId && dbSubscription.priceId !== stripePriceId) {
    return false
  }
  
  // === Period time validation ===
  if (!dbSubscription.periodEnd) {
    return false
  }

  const newPeriodEnd = new Date(stripeSubscription.current_period_end * 1000)
  const oldPeriodEnd = dbSubscription.periodEnd
  
  // === Period extension check ===
  // New period end time must be greater than old period end time
  if (newPeriodEnd.getTime() <= oldPeriodEnd.getTime()) {
    return false
  }
  
  // === Renewal confirmation ===
  return true
}

/**
 * Accurately determine the type of subscription update
 *
 * This function is used to classify non-renewal types of subscription updates, helping business logic make corresponding decisions
 *
 * @param stripeSubscription Stripe subscription object
 * @param dbSubscription Subscription record in the database
 * @returns Update type string, used for logging and business logic handling
 */
export function determineUpdateType(stripeSubscription: any, dbSubscription: any): string {
  if (!stripeSubscription || !dbSubscription) {
    return 'invalid_data'
  }
  
  // === Status change detection ===
  if (stripeSubscription.status !== dbSubscription.status) {
    const oldStatus = dbSubscription.status
    const newStatus = stripeSubscription.status
    
    // Specific status change classification
    switch (newStatus) {
      case 'active':
        return oldStatus === 'past_due' ? 'payment_recovered' : `status_activated_from_${oldStatus}`
      case 'past_due':
        return 'payment_failed'
      case 'canceled':
        return 'subscription_canceled'
      case 'unpaid':
        return 'payment_overdue'
      case 'paused':
        return 'subscription_paused'
      case 'incomplete':
        return 'setup_incomplete'
      default:
        return `status_change_to_${newStatus}`
    }
  }
  
  // === Cancellation status change detection ===
  if (stripeSubscription.cancel_at_period_end !== dbSubscription.cancelAtPeriodEnd) {
    if (stripeSubscription.cancel_at_period_end) {
      return 'cancel_scheduled' // User scheduled cancellation at end of period
    }
    return 'cancel_removed'   // User revoked cancellation
  }
  
  // === Price/plan change detection ===
  const stripePriceId = stripeSubscription.items?.data?.[0]?.price?.id
  if (stripePriceId && dbSubscription.priceId && stripePriceId !== dbSubscription.priceId) {
    return 'plan_changed' // Upgrade or downgrade
  }
  
  // === Period time change analysis ===
  if (dbSubscription.periodEnd) {
    const newPeriodEnd = new Date(stripeSubscription.current_period_end * 1000)
    const oldPeriodEnd = dbSubscription.periodEnd
    
    if (newPeriodEnd.getTime() > oldPeriodEnd.getTime()) {
      // Check if it is a manual extension (not a natural renewal)
      const newPeriodStart = new Date(stripeSubscription.current_period_start * 1000)
      const timeDiff = Math.abs(newPeriodStart.getTime() - oldPeriodEnd.getTime())
      
      if (timeDiff > PERIOD_TIME_TOLERANCE) { // More than 1s difference, may be manual adjustment
        return 'period_extended_manually'
      }
      return 'period_extended_naturally' // This is usually a renewal, but excluded by other conditions
    }
    
    if (newPeriodEnd.getTime() < oldPeriodEnd.getTime()) {
      return 'period_shortened' // Period shortened, may be refund or adjustment
    }
  }
  
  // === Billing anchor change detection ===
  if (stripeSubscription.billing_cycle_anchor) {
    const anchorTime = stripeSubscription.billing_cycle_anchor * 1000
    const periodStartTime = stripeSubscription.current_period_start * 1000
    
    if (Math.abs(anchorTime - periodStartTime) > PERIOD_TIME_TOLERANCE) {
      return 'billing_anchor_adjusted' // Billing cycle anchor manually adjusted
    }
  }
  
  // === Seat number change detection ===
  if (stripeSubscription.quantity && dbSubscription.seats && stripeSubscription.quantity !== dbSubscription.seats) {
    return stripeSubscription.quantity > dbSubscription.seats ? 'seats_increased' : 'seats_decreased'
  }
  
  // === Default classification ===
  return 'metadata_update' // Other minor changes, such as metadata updates, etc.
}