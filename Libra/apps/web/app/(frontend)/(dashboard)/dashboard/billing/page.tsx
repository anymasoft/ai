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

import { initAuth } from "packages/auth/auth-server"
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { api } from "@/trpc/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@libra/ui/components/card'
import { Button } from '@libra/ui/components/button'
import { CreditCard } from 'lucide-react'
import Link from 'next/link'
import * as m from '@/paraglide/messages'
import BillingPageClient from './billing-page-client'

export default async function BillingPage() {
    const auth = await initAuth()
    const headersList = await headers()
    const sessionData = await auth.api.getSession({
      headers: headersList,
    })
    const user = sessionData?.user
  
    if (!user) {
      redirect('/')
    }
    
    try {
      const subscription = await api.subscription.getUsage({})
      return <BillingPageClient subscription={subscription} />
    } catch {
      return (
        <div className="flex flex-col gap-4 lg:gap-6 px-3 sm:px-4 lg:px-6 py-4 lg:py-6">
          <div className="flex items-center gap-2 lg:gap-3">
            <CreditCard className="h-5 w-5 lg:h-6 lg:w-6 text-primary" />
            <div>
              <h1 className="text-xl lg:text-2xl font-bold tracking-tight">{m['dashboard.billing.title']()}</h1>
              <p className="text-sm lg:text-base text-muted-foreground">{m['dashboard.billing.subtitle']()}</p>
            </div>
          </div>
          
          <Card className="glass-1 border-red-200 shadow-lg">
            <CardHeader className="p-4 lg:p-6">
              <CardTitle className="text-red-600 text-base lg:text-lg">{m['dashboard.billing.loadError.title']()}</CardTitle>
              <CardDescription className="text-xs lg:text-sm mt-1">
                {m['dashboard.billing.loadError.description']()}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 lg:p-6 pt-0">
              <Button variant="outline" asChild>
                <Link href="/dashboard">{m['dashboard.billing.loadError.backToDashboard']()}</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      )
    }
}