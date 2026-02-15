/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * price-schema.ts
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

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { createId } from '@paralleldrive/cuid2';
import { plan } from './plan-schema';

// Price table schema for SQLite
export const price = sqliteTable('price', {
  id: text('id').$defaultFn(() => createId()).primaryKey(),
  // Stripe price ID, e.g., price_1234
  priceId: text('price_id').unique(),
  // Reference to plan table, not product
  planId: text('plan_id').references(() => plan.id, { onDelete: 'cascade' }),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  // Amount in the smallest currency unit (e.g., $1.00 = 100 cents, ¥100 = 100)
  unitAmount: integer('unit_amount'),
  // Three-letter ISO currency code, lowercase
  currency: text('currency'),
  // Price type: 'one_time' or 'recurring'
  priceType: text('price_type'),
  // Subscription billing interval: 'day', 'week', 'month', or 'year'
  pricingPlanInterval: text('pricing_plan_interval'),
  intervalCount: integer('interval_count'),
  // Metadata as JSON, stored as TEXT
  metadata: text('metadata').notNull().default('{}'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
});
