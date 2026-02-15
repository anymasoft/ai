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

import type { StripeOptions } from "./types";

export async function getPlans(options: StripeOptions) {
    return typeof options?.subscription?.plans === "function"
        ? await options.subscription?.plans()
        : options.subscription?.plans;
}

export async function getPlanByPriceId(
    options: StripeOptions,
    priceId: string,
) {
    return await getPlans(options).then((res) =>
        res?.find(
            (plan) =>
                plan.priceId === priceId || plan.annualDiscountPriceId === priceId,
        ),
    );
}

export async function getPlanByName(options: StripeOptions, name: string) {
    return await getPlans(options).then((res) =>
        res?.find((plan) => plan.name.toLowerCase() === name.toLowerCase()),
    );
}