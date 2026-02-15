/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * env.mjs
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

import { createEnv } from '@t3-oss/env-nextjs'
import { z } from 'zod'

export const env = createEnv({
  server: {
    BETTER_GITHUB_CLIENT_ID: z.string().min(1),
    BETTER_GITHUB_CLIENT_SECRET: z.string().min(1),
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    CLOUDFLARE_ACCOUNT_ID: z.string().min(1),
    DATABASE_ID: z.string().min(1),
    CLOUDFLARE_API_TOKEN: z.string().min(1),
    TURNSTILE_SECRET_KEY: z.string().min(1),
    ADMIN_USER_IDS: z.string().optional(),
  },
  runtimeEnv: {
    BETTER_GITHUB_CLIENT_ID: process.env['BETTER_GITHUB_CLIENT_ID'],
    BETTER_GITHUB_CLIENT_SECRET: process.env['BETTER_GITHUB_CLIENT_SECRET'],
    STRIPE_SECRET_KEY: process.env['STRIPE_SECRET_KEY'],
    STRIPE_WEBHOOK_SECRET: process.env['STRIPE_WEBHOOK_SECRET'],
    CLOUDFLARE_ACCOUNT_ID: process.env['CLOUDFLARE_ACCOUNT_ID'],
    DATABASE_ID: process.env['DATABASE_ID'],
    CLOUDFLARE_API_TOKEN: process.env['CLOUDFLARE_API_TOKEN'],
    TURNSTILE_SECRET_KEY: process.env['TURNSTILE_SECRET_KEY'],
    ADMIN_USER_IDS: process.env['ADMIN_USER_IDS'],
  },
})

/**
 * Parse comma-separated admin user IDs from environment variable
 * @returns {string[]} Array of admin user IDs
 */
export function getAdminUserIds() {
  if (!env.ADMIN_USER_IDS) {
    return []
  }

  return env.ADMIN_USER_IDS
    .split(',')
    .map(id => id.trim())
    .filter(id => id.length > 0)
}
