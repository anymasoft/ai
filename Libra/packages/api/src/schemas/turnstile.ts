/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * turnstile.ts
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

/**
 * Turnstile verification request schema
 */
export const turnstileVerificationSchema = z.object({
  token: z.string().min(1, 'Turnstile token is required'),
  remoteip: z.string().regex(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/, 'Invalid IP address').optional(),
})

/**
 * Turnstile verification response schema from Cloudflare
 */
export const turnstileResponseSchema = z.object({
  success: z.boolean(),
  'error-codes': z.array(z.string()).optional(),
  challenge_ts: z.string().optional(),
  hostname: z.string().optional(),
  action: z.string().optional(),
  cdata: z.string().optional(),
})

/**
 * API response schema for Turnstile verification
 */
export const turnstileApiResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  errors: z.array(z.string()).optional(),
})

export type TurnstileVerificationRequest = z.infer<typeof turnstileVerificationSchema>
export type TurnstileResponse = z.infer<typeof turnstileResponseSchema>
export type TurnstileApiResponse = z.infer<typeof turnstileApiResponseSchema>
