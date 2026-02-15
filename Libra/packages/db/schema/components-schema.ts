/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * components-schema.ts
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

import { boolean, json, pgTable, primaryKey, integer, text, timestamp } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const components = pgTable('components', {
  id: integer('id').primaryKey().notNull(),
  name: text('name').notNull(),
  component_slug: text('component_slug').notNull().unique(),
  code: text('code'),
  compiled_css: text('compiled_css'),
  component_names: json('component_names').notNull(),
  demo_code: text('demo_code'),
  demo_dependencies: json('demo_dependencies'),
  demo_direct_registry_dependencies: json('demo_direct_registry_dependencies'),
  dependencies: json('dependencies'),
  direct_registry_dependencies: json('direct_registry_dependencies'),
  description: text('description'),
  global_css_extension: text('global_css_extension'),
  tailwind_config_extension: text('tailwind_config_extension'),
  downloads_count: integer('downloads_count').default(0),
  likes_count: integer('likes_count').default(0),
  is_public: boolean('is_public').default(false),
  is_paid: boolean('is_paid').default(false),
  payment_url: text('payment_url'),
  preview_url: text('preview_url').notNull(),
  created_at: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
  updated_at: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP`),
})

export type Component = typeof components.$inferSelect
export type InsertComponent = typeof components.$inferInsert
