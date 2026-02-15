/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * database.ts
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
import { drizzle } from "drizzle-orm/d1"
import { schema } from "@libra/auth/db"
import type { AppContext } from './types'

/**
 * Get PostgreSQL database connection for Deploy service
 * This function provides access to the main PostgreSQL database containing
 * project data and deployment information
 * 
 * @param c Hono context from Deploy service
 * @returns Drizzle database instance with access to project table
 */
export async function getPostgresDb(c: AppContext) {
  return await getDbForHono(c)
}

/**
 * Get D1 database connection for Deploy service authentication
 * This function provides access to the D1 database for auth-related operations
 *
 * @param c Hono context from Deploy service
 * @returns Drizzle database instance with access to auth schema
 */
export async function getAuthDb(c: AppContext) {
  if (!c.env.DATABASE) {
    throw new Error('DATABASE binding is not available in Deploy service environment')
  }

  // Determine if production environment, disable logging in production, enable in other environments
  const isProduction = (process.env.ENVIRONMENT as string) === 'production'

  // Initialize Drizzle with your D1 binding (e.g., "DATABASE" from wrangler.toml)
  return drizzle(c.env.DATABASE, {
    // Ensure "DATABASE" matches your D1 binding name in wrangler.jsonc
    schema,
    logger: !isProduction,
  })
}

/**
 * Check if PostgreSQL database connection is available
 * Useful for health checks and debugging
 *
 * @param c Hono context from Deploy service
 * @returns boolean indicating if connection is available
 */
export async function isPostgresDbAvailable(c: AppContext): Promise<boolean> {
  const db = await getPostgresDb(c)
  try {
    // Simple query to test connection
    await db.execute('SELECT 1')
    return true
  } catch (error) {
    console.error('PostgreSQL database connection failed:', error)
    return false
  } finally {
    // Clean up database connection
    c.executionCtx.waitUntil(db.$client.end())
  }
}
