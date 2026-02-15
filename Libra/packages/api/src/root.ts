/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * root.ts
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

import { aiRouter } from './router/ai'
import { customDomainRouter } from './router/custom-domain'
import { fileRouter } from './router/file'
import { githubRouter } from './router/github'
import { helloRouter } from './router/hello'
import { historyRouter } from './router/history'
import { projectRouter } from './router/project'
import { sessionRouter } from './router/session'
import { stripeRouter } from './router/stripe'
import { subscriptionRouter } from './router/subscription'
import { createTRPCRouter } from './trpc'

export const appRouter = createTRPCRouter({
  ai: aiRouter,
  customDomain: customDomainRouter,
  hello: helloRouter,
  project: projectRouter,
  history: historyRouter,
  file: fileRouter,
  stripe: stripeRouter,
  subscription: subscriptionRouter,
  session: sessionRouter,
  github: githubRouter,
})

// export type definition of API
export type AppRouter = typeof appRouter
