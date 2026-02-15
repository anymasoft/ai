/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * env.ts
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

import { z } from 'zod/v4'
import { tryCatch } from '@libra/common'

// Simplified environment validation for dispatcher
// Only validates essential variables needed for dispatcher functionality
export const dispatcherEnvSchema = z.object({
  // GitHub OAuth (required for auth)
  BETTER_GITHUB_CLIENT_ID: z.string().min(1),
  BETTER_GITHUB_CLIENT_SECRET: z.string().min(1),
  
  // Cloudflare settings (required for dispatcher operations)
  CLOUDFLARE_ACCOUNT_ID: z.string().min(1),
  DATABASE_ID: z.string().min(1),
  CLOUDFLARE_API_TOKEN: z.string().min(1),
  
  // Security (required for auth)
  TURNSTILE_SECRET_KEY: z.string().min(1),
  
  // Optional variables
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
})

export type DispatcherEnv = z.infer<typeof dispatcherEnvSchema>

// Validate environment variables for Cloudflare Workers
export function validateDispatcherEnv(env: Record<string, unknown>): DispatcherEnv {
  const [result, error] = tryCatch(() => {
    return dispatcherEnvSchema.parse(env)
  })

  if (error) {
    throw new Error('Invalid environment variables for dispatcher')
  }

  return result
}

// Get environment variables from Cloudflare Workers context
export function getDispatcherEnv(c: any): DispatcherEnv {
  // In Cloudflare Workers, environment variables are available via c.env
  const env = {
    BETTER_GITHUB_CLIENT_ID: c.env.BETTER_GITHUB_CLIENT_ID,
    BETTER_GITHUB_CLIENT_SECRET: c.env.BETTER_GITHUB_CLIENT_SECRET,
    CLOUDFLARE_ACCOUNT_ID: c.env.CLOUDFLARE_ACCOUNT_ID,
    DATABASE_ID: c.env.DATABASE_ID,
    CLOUDFLARE_API_TOKEN: c.env.CLOUDFLARE_API_TOKEN,
    TURNSTILE_SECRET_KEY: c.env.TURNSTILE_SECRET_KEY,
    STRIPE_SECRET_KEY: c.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: c.env.STRIPE_WEBHOOK_SECRET,
  }
  
  return validateDispatcherEnv(env)
}
