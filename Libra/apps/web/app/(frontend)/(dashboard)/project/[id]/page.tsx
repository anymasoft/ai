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

import Index from '@/components/ide'
import LayoutWrapper from '@/components/ide/layout-wrapper'
import { api } from '@/trpc/server'
import { initAuth } from '@libra/auth/auth-server'
import type { HistoryType } from '@libra/common'
import { TooltipProvider } from '@libra/ui/components/tooltip'
import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'

export default async function ProjectPage({
  params,
}: {
  params: Promise<{
    id: string
  }>
}) {
  const auth = await initAuth()
  const headersList = await headers()
  const session = await auth.api.getSession({
    headers: headersList,
  })
  const user = session?.user
  const projectId = (await params).id

  if (!user) {
    redirect('/')
  }

  // Check project status
  try {
    const projectStatus = await api.project.getProjectStatus({ projectId })

    if (!projectStatus.hasAccess) {
      redirect('/dashboard')
    }

    if (!projectStatus.isActive) {
      redirect('/dashboard')
    }

  } catch (statusError) {
    redirect('/dashboard')
  }

  try {
    // Retrieve historical messages and add error handling
    let initialMessages: HistoryType = []
    try {
      initialMessages = (await api.history.getAll({ id: projectId })) || []

      // Check if it's empty, and if so, add a test message
      if (!initialMessages || initialMessages.length === 0) {
        // No messages
      }

    } catch (historyError) {
    }

    return (
      <TooltipProvider>
        <LayoutWrapper codePreviewActive={true}>
          <Index codePreviewActive={true} initialMessages={initialMessages} />
        </LayoutWrapper>
      </TooltipProvider>
    )
  } catch (error) {
    return notFound()
  }
}
