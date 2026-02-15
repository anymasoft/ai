/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * subscription.ts
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

import { getSubscriptionUsage, PLAN_TYPES } from '@libra/auth/utils/subscription-limits'
import { log, tryCatch } from '@libra/common'

/**
 * Check if organization has premium membership (non-free plan)
 * @param organizationId - Organization ID to check membership for
 * @returns Promise<boolean> - true if organization has premium membership
 */
export async function hasPremiumMembership(organizationId: string): Promise<boolean> {
    const [result, error] = await tryCatch(async () => {
        log.subscription('info', 'Checking premium membership', {
            organizationId,
            operation: 'hasPremiumMembership',
        });

        // Get subscription usage information
        const usage = await getSubscriptionUsage(organizationId);

        // Check if the plan is not the free plan
        const isPremium = usage.plan !== PLAN_TYPES.FREE;

        log.subscription('info', 'Premium membership check completed', {
            organizationId,
            plan: usage.plan,
            isPremium,
            operation: 'hasPremiumMembership',
        });

        return isPremium;
    });

    if (error) {
        log.subscription('error', 'Failed to check premium membership', {
            organizationId,
            operation: 'hasPremiumMembership',
        }, error instanceof Error ? error : new Error(String(error)));

        // Default to false (no premium access) on error to ensure safe fallback
        return false;
    }

    return result;
}
