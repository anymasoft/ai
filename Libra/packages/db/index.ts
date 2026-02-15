/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * index.ts
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

import { getCloudflareContext } from '@opennextjs/cloudflare'
import { drizzle as drizzleNode } from 'drizzle-orm/node-postgres'
import pg, {Client} from 'pg'
import { cache } from 'react'

import { env } from './env.mjs'
import { components } from './schema/components-schema'
import * as projectSchema from './schema/project-schema'


export const schema = { ...projectSchema, ...components }

export const getDbAsync = async () => {
  let connectionString: string | undefined
  if ((process.env['NODE_ENV'] as string) === 'development') {
    connectionString = env.POSTGRES_URL
  } else {
    const { env: cfEnv } = await getCloudflareContext({ async: true })
    // Type assertion for HYPERDRIVE property
    const hyperdrive = (cfEnv as any).HYPERDRIVE
    connectionString = hyperdrive?.connectionString
  }
  if (!connectionString) {
    console.error(
      'Database connection string is not available for async. Check HYPERDRIVE or PG_URL environment variables.'
    )
    throw new Error('Database connection string not found for async.')
  }
  const pool = new pg.Pool({
    connectionString: connectionString,
    maxUses: 1,
  })
  // Return Drizzle instance with $client property for connection cleanup
  return drizzleNode({ client: pool, schema: schema })
}

/**
 * Database context interface for Hono applications
 * @description Defines the required environment bindings for database operations
 */
export interface HonoDbContext {
  env: {
    NODE_ENV?: string
    POSTGRES_URL?: string
    HYPERDRIVE?: {
      connectionString: string
      host: string
      port: number
      user: string
      connect(): any
    }
  }
}

/**
 * Get database connection for Hono applications (Cloudflare Workers)
 * Supports both development (direct PostgreSQL) and production (HYPERDRIVE) environments
 * @param c Hono context containing environment bindings
 * @returns Drizzle database instance with complete schema
 */
export async function getDbForHono(c: HonoDbContext) {
  let connectionString: string | undefined
  const nodeEnv: string = c.env.NODE_ENV || 'production'

  // Development environment: prioritize direct PostgreSQL connection
  if (nodeEnv === 'development') {
    // Try multiple sources for POSTGRES_URL in development
    connectionString = c.env?.POSTGRES_URL
  } else {
    // Production environment: use HYPERDRIVE binding from Hono context
    const hyperdrive = c.env?.HYPERDRIVE
    connectionString = hyperdrive?.connectionString
  }

  if (!connectionString) {
    const error = new Error(`No database connection string available. Environment: ${nodeEnv}`)
    console.error('getDbForHono: Connection string error', {
      nodeEnv,
      hasHyperdrive: !!(c.env?.HYPERDRIVE),
      hasPostgresUrl: !!(c.env?.POSTGRES_URL)
    })
    throw error
  }

  const pool = new pg.Pool({
    connectionString: connectionString,
    maxUses: 1,
  })

  // Return Drizzle instance with $client property for connection cleanup
  return drizzleNode({ client: pool, schema: schema })
}

/**
 * Get database connection for Workflow applications (Cloudflare Workers)
 * Supports both development (direct PostgreSQL) and production (HYPERDRIVE) environments
 * @param env Workflow environment containing bindings
 * @returns Drizzle database instance with complete schema
 */
export async function getDbForWorkflow(env: any) {
  let connectionString: string | undefined
  const nodeEnv: string = env.NODE_ENV || 'production'

  // Development environment: prioritize direct PostgreSQL connection
  if (nodeEnv === 'development') {
    // Try multiple sources for POSTGRES_URL in development
    connectionString = env?.POSTGRES_URL
  } else {
    // Production environment: use HYPERDRIVE binding from environment
    const hyperdrive = env?.HYPERDRIVE
    connectionString = hyperdrive?.connectionString
  }
  const pool = new pg.Pool({
    connectionString: connectionString,
    maxUses: 1,
  })

  // Return Drizzle instance with $client property for connection cleanup
  return drizzleNode({ client: pool, schema: schema })
}


// Re-export schema components for external use
export * from './schema/project-schema'
export * from './schema/components-schema'

// Re-export custom domain query functions
export * from './custom-domain-queries'

// Re-export subscription utility functions
export * from './utils/subscription'
