/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * page.tsx
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

'use client'
import { GitHubIntegrationCard } from '@/components/dashboard/integrations/github-integration-card'
import * as m from '@/paraglide/messages'

export default function IntegrationsPage() {
  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">{m['dashboard.integrations.title']()}</h1>
        <p className="text-muted-foreground mt-2">
          {m['dashboard.integrations.subtitle']()}
        </p>
      </div>

      <div className="grid gap-6">
        <GitHubIntegrationCard />

        {/* Placeholder for future integrations */}
        <div className="opacity-60">
          <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
            <div className="flex flex-col space-y-1.5 p-6">
              <h3 className="text-2xl font-semibold leading-none tracking-tight text-muted-foreground">
                {m['dashboard.integrations.coming_soon.title']()}
              </h3>
              <p className="text-sm text-muted-foreground">
                {m['dashboard.integrations.coming_soon.description']()}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}