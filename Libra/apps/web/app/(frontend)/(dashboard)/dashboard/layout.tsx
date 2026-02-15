/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * layout.tsx
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

import { AppSidebar } from '@/components/dashboard/app-sidebar'
import { initAuth } from '@libra/auth/auth-server'
import { SidebarInset, SidebarProvider } from '@libra/ui/components/sidebar'
import { SiteHeader } from 'apps/web/components/dashboard/site-header'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type React from 'react'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const auth = await initAuth()
  // Get current session and user information
  const session = await auth.api.getSession({
    headers: await headers(),
  })
  const sessionUser = session?.user
  if (!sessionUser) {
    redirect('/')
  }

  // Add active organization ID to user data
  const userData = {
    ...sessionUser,
    image: sessionUser.image ?? null,
  }

  return (
    <SidebarProvider>
      <AppSidebar variant='inset' userData={userData} />
      <SidebarInset>
        <SiteHeader />
        <div className='flex flex-1 flex-col'>
          <div className='@container/main flex flex-1 flex-col gap-2'>
            <div className='flex flex-col gap-4 py-4 md:gap-6 md:py-6'>{children}</div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
