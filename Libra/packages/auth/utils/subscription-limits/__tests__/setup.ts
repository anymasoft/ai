/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * setup.ts
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

// Mock environment variables FIRST, before any imports
process.env.POSTGRES_URL = 'postgresql://test:test@localhost:5432/test'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
process.env.NODE_ENV = 'test'
process.env.ENVIRONMENT = 'test'

import { vi, beforeEach, afterEach } from 'vitest'

// Mock the entire @libra/db module to prevent environment validation
vi.mock('@libra/db', async () => {
  return {
    getDbAsync: vi.fn(),
    getDb: vi.fn(),
  }
})

// Mock the env module specifically
vi.mock('@libra/db/env.mjs', () => ({
  env: {
    POSTGRES_URL: 'postgresql://test:test@localhost:5432/test'
  }
}))



// Mock @opennextjs/cloudflare
vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: vi.fn().mockResolvedValue({
    env: {
      DATABASE: {},
      HYPERDRIVE: { connectionString: 'postgresql://test:test@localhost:5432/test' }
    }
  })
}))

// Mock better-auth
vi.mock('better-auth', () => ({
  betterAuth: vi.fn(),
}))

// Mock drizzle-orm
vi.mock('drizzle-orm', () => ({
  and: vi.fn(),
  eq: vi.fn(),
  sql: vi.fn(),
}))

// Mock drizzle schema
vi.mock('@libra/db/schema/project-schema', () => ({
  subscriptionLimit: {
    id: 'id',
    organizationId: 'organizationId',
    planName: 'planName',
    isActive: 'isActive',
    aiNums: 'aiNums',
    periodEnd: 'periodEnd',
    periodStart: 'periodStart',
  }
}))

// Global test setup
beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})
