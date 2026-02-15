/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * schema.ts
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

import type { AuthPluginSchema } from "better-auth";
import type { StripeOptions } from "./types";
import { mergeSchema } from "better-auth/db";

export const subscriptions = {
    subscription: {
        fields: {
            plan: {
                type: "string",
                required: true,
            },
            referenceId: {
                type: "string",
                required: true,
            },
            stripeCustomerId: {
                type: "string",
                required: false,
            },
            stripeSubscriptionId: {
                type: "string",
                required: false,
            },
            status: {
                type: "string",
                defaultValue: "incomplete",
            },
            periodStart: {
                type: "date",
                required: false,
            },
            periodEnd: {
                type: "date",
                required: false,
            },
            cancelAtPeriodEnd: {
                type: "boolean",
                required: false,
                defaultValue: false,
            },
            seats: {
                type: "number",
                required: false,
            },
        },
    },
} satisfies AuthPluginSchema;

export const user = {
    user: {
        fields: {
            stripeCustomerId: {
                type: "string",
                required: false,
            },
        },
    },
} satisfies AuthPluginSchema;

export const getSchema = (options: StripeOptions) => {
    if (
        options.schema &&
        !options.subscription?.enabled &&
        "subscription" in options.schema
    ) {
        delete options.schema.subscription;
    }
    return mergeSchema(
        {
            ...(options.subscription?.enabled ? subscriptions : {}),
            ...user,
        },
        options.schema,
    );
};