/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * db-postgres.ts
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

import { getDbForHono } from '@libra/db'
import type { Context } from 'hono'
import type { CloudflareBindings, ContextVariables } from './types'

// Define the Hono context type for Dispatcher service
type DispatcherContext = Context<{
  Bindings: CloudflareBindings
  Variables: ContextVariables
}>

/**
 * Get PostgreSQL database connection for Dispatcher service
 * This function provides access to the main PostgreSQL database containing
 * project data and custom domain configurations
 * 
 * @param c Hono context from Dispatcher service
 * @returns Drizzle database instance with access to project table
 */
export async function getPostgresDb(c: DispatcherContext) {
  return await getDbForHono(c)
}

