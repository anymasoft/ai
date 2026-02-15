/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * plan-schema.ts
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

// Subscription plan table schema for SQLite
export const plan = sqliteTable('plan', {
  id: text('id').$defaultFn(() => createId()).primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  priceId: text('price_id'),
  lookupKey: text('lookup_key'),
  annualDiscountPriceId: text('annual_discount_price_id'),
  annualDiscountLookupKey: text('annual_discount_lookup_key'),
  limits: text('limits').notNull().default('{}'),
  marketingFeatures: text('marketing_features').notNull().default('[]'),
  group: text('group'),
  isActive: integer('is_active', {mode: 'boolean'}).notNull().default(true),
  createdAt: integer('created_at', {mode: 'timestamp'}).$defaultFn(() => /* @__PURE__ */ new Date()).notNull(),
  updatedAt: integer('updated_at', {mode: 'timestamp'}).$defaultFn(() => /* @__PURE__ */ new Date()).notNull(),
});
