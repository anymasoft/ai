/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * session.ts
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

import { session } from '@libra/auth/db/schema/auth-schema'
import { tryCatch } from '@libra/common'
import type { TRPCRouterRecord } from '@trpc/server'
import { TRPCError } from '@trpc/server'
import { desc, eq } from 'drizzle-orm'
import { organizationProcedure } from '../trpc'

export const sessionRouter = {
  list: organizationProcedure.query(async ({ input, ctx }) => {
    const orgId = ctx.orgId
    if (!orgId) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Organization ID is missing' })
    }

    const [sessions, error] = await tryCatch(async () => {
      return await ctx.db
        .select()
        .from(session)
        .where(eq(session.activeOrganizationId, orgId))
        .orderBy(desc(session.createdAt))
    })

    if (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching the session list',
        cause: error,
      })
    }

    return sessions
  }),
} satisfies TRPCRouterRecord
