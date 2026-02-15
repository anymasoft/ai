/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * trpc.ts
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

import { initAuth } from '@libra/auth/auth-server'
import { getAuthDb } from '@libra/auth/db'
import { requirePremiumMembership } from './utils/membership-validation'
/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1).
 * 2. You want to create a new middleware or type of procedure (see Part 3).
 *
 * TL;DR - This is where all the tRPC server stuff is created and plugged in. The pieces you will
 * need to use are documented accordingly near the end.
 */
import { initTRPC, TRPCError } from '@trpc/server'
import superjson from 'superjson'
import { ZodError, z } from 'zod/v4'

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow you to access things when processing a request, like the database, the session, etc.
 *
 * This helper generates the "internals" for a tRPC context. The API handler and RSC clients each
 * wrap this and provides the required context.
 *
 * @see https://trpc.io/docs/server/context
 */
export const createTRPCContext = async (opts: { headers: Headers }) => {
  const auth = await initAuth()
  // Fetch user session
  const session = await auth.api.getSession({ headers: opts.headers })
  // Obtain database connection using async Cloudflare context
  const db = await getAuthDb()
  return { db, session, ...opts }
}

/**
 * 2. INITIALIZATION
 *
 * This is where the tRPC API is initialized, connecting the context and transformer. We also parse
 * ZodErrors so that you get type safe on the frontend if your procedure fails due to validation
 * errors on the backend.
 */
const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? z.treeifyError(error.cause) : null,
      },
    }
  },
})

/**
 * Create a server-side caller.
 *
 * @see https://trpc.io/docs/server/server-side-calls
 */
export const createCallerFactory = t.createCallerFactory

/**
 * 3. ROUTER & PROCEDURE (THE IMPORTANT BIT)
 *
 * These are the pieces you use to build your tRPC API. You should import these a lot in the
 * "/src/server/api/routers" directory.
 */

/**
 * This is how you create new routers and sub-routers in your tRPC API.
 *
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router

/**
 * Public (unauthenticated) procedure
 *
 * This is the base piece you use to build new queries and mutations on your tRPC API. It does not
 * guarantee that a user querying is authorized, but you can still access user session data if they
 * are logged in.
 */
export const publicProcedure = t.procedure

/**
 * Protected (authenticated) procedure
 *
 * If you want a query or mutation to ONLY be accessible to logged in users, use this. It verifies
 * the session is valid and guarantees `ctx.session.user` is not null.
 *
 * @see https://trpc.io/docs/procedures
 */
export const protectedProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }
  return next({
    ctx: {
      // infers the `session` as non-nullable
      session: { ...ctx.session, user: ctx.session.user },
    },
  })
})

// Define the organization schema for input validation
const orgSchema = z.object({
  orgId: z.string().optional(),
})

export const organizationProcedure = protectedProcedure.input(orgSchema).use(({ ctx, next }) => {
  // @ts-ignore
  const activeOrganizationId = ctx.session?.session?.activeOrganizationId
  const orgId = activeOrganizationId
  // Validate organization ID
  if (!orgId) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Organization ID is required',
    })
  }

  return next({
    ctx: {
      ...ctx,
      orgId,
      session: ctx.session,
    },
  })
})

/**
 * Member (premium membership) procedure
 *
 * This procedure extends organizationProcedure to ensure the user has a valid premium membership.
 * It verifies that the user is logged in, has an organization, and has premium membership status.
 * If the user doesn't have premium membership, it throws a FORBIDDEN error.
 *
 * @see https://trpc.io/docs/procedures
 */
export const memberProcedure = organizationProcedure.use(async ({ ctx, next }) => {
  const orgId = ctx.orgId

  // Check premium membership status
  await requirePremiumMembership(orgId, 'this feature')

  return next({
    ctx: {
      ...ctx,
      // orgId and session are already available from organizationProcedure
    },
  })
})
