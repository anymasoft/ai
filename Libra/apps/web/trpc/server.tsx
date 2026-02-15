/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * server.tsx
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

import 'server-only'
import { createHydrationHelpers } from '@trpc/react-query/rsc'
import { type AppRouter, createCaller, createTRPCContext } from '@libra/api'
import { headers } from 'next/headers'
import { cache } from 'react'

import { createQueryClient } from './query-client'

/**
 * This wraps the `createTRPCContext` helper and provides the required context for the tRPC API when
 * handling a tRPC call from a React Server Component.
 */
const createContext = cache(async () => {
  const heads = new Headers(await headers())
  heads.set('x-trpc-source', 'rsc')

  return createTRPCContext({
    headers: heads,
  })
})

const getQueryClient = createQueryClient
const caller = createCaller(createContext)


export const { trpc: api,  } = createHydrationHelpers<AppRouter>(
  caller,
  getQueryClient
)
