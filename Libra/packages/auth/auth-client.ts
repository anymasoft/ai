/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * auth-client.ts
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

import { cloudflareClient } from '@libra/better-auth-cloudflare'
import { stripeClient } from '@libra/better-auth-stripe/client'
import { adminClient, emailOTPClient, organizationClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'
import { emailHarmony } from 'better-auth-harmony'
import { toast } from 'sonner'

// Create auth client

export const authClient = createAuthClient({
  baseURL: '',
  plugins: [
    // admin client
    adminClient(),
    // magic code
    emailOTPClient(),
    // stripe client last
    stripeClient({
      subscription: true,
    }),
    // organization client
    organizationClient(),
    // cloudflare client
    cloudflareClient(),
    // email harmony
    emailHarmony(),
  ],
  fetchOptions: {
    onError(e) {
      if (e.error.status === 401) {
        // toast.error('Unauthorized. Please sign in again.')
        console.warn('Unauthorized. Please sign in again.')
      } else if (e.error.status === 429) {
        toast.error('Too many requests. Please try again later.')
      } else if (e.error.status === 500) {
        toast.error('Server error. Please try again later.')
      }
    },
  },
})

export const {
  signIn,
  signOut,
  signUp,
  useSession,
  updateUser,
  getSession,
  useListOrganizations,
  useActiveOrganization,
} = authClient

// Export admin methods for easy access
export const admin = authClient.admin
