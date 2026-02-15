/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * loading-card.tsx
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

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@libra/ui/components/card'
import * as m from '@/paraglide/messages'

export function LoadingCard() {
  return (
    <div className="container mx-auto p-6">
      <Card className="border-border/40">
        <CardHeader>
          <CardTitle className="text-xl">{m['dashboard.teams.title']()}</CardTitle>
          <CardDescription>{m['dashboard.teams.subtitle']()}</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center py-12">
          <div className="flex flex-col items-center gap-2">
            <div className="animate-pulse h-8 w-8 rounded-full bg-muted" />
            <p className="text-muted-foreground">{m['dashboard.teams.loadingOrganizationData']()}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 