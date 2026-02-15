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
    CLOUDFLARE_ACCOUNT_ID: z.string().min(1, 'Cloudflare Account ID is required').optional(),
    CLOUDFLARE_API_TOKEN: z.string().min(1, 'Cloudflare API Token is required').optional(),
    CLOUDFLARE_SAAS_ZONE_ID: z.string().min(1, 'Cloudflare SaaS Zone ID is required').optional(),
    CUSTOMERS_ORIGIN_SERVER: z.string().min(1, 'Customers origin server is required').optional(),
    DISPATCH_NAMESPACE_NAME: z.string().min(1, 'Dispatch namespace name is required').optional(),
  },
  client: {
    NEXT_PUBLIC_CLOUDFLARE_DCV_VERIFICATION_ID: z.string().min(1, 'Cloudflare DCV Verification ID is required').optional(),
    NEXT_PUBLIC_CDN_URL: z.string().min(1, 'CDN URL is required').optional(),
    NEXT_PUBLIC_SANDBOX_DEFAULT_PROVIDER: z.string().min(1, 'Sandbox default provider is required').optional(),
  },
  runtimeEnv: {
    CLOUDFLARE_ACCOUNT_ID: process.env['CLOUDFLARE_ACCOUNT_ID'],
    CLOUDFLARE_API_TOKEN: process.env['CLOUDFLARE_API_TOKEN'],
    CLOUDFLARE_SAAS_ZONE_ID: process.env['CLOUDFLARE_SAAS_ZONE_ID'],
    NEXT_PUBLIC_CLOUDFLARE_DCV_VERIFICATION_ID: process.env['NEXT_PUBLIC_CLOUDFLARE_DCV_VERIFICATION_ID'],
    NEXT_PUBLIC_CDN_URL: process.env['NEXT_PUBLIC_CDN_URL'],
    CUSTOMERS_ORIGIN_SERVER: process.env['CUSTOMERS_ORIGIN_SERVER'],
    NEXT_PUBLIC_SANDBOX_DEFAULT_PROVIDER: process.env['NEXT_PUBLIC_SANDBOX_DEFAULT_PROVIDER'],
    DISPATCH_NAMESPACE_NAME: process.env['DISPATCH_NAMESPACE_NAME'],
  },
})
