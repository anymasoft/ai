/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * use-project-creation.ts
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

import { authClient } from '@libra/auth/auth-client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import * as m from '@/paraglide/messages'
import { useTRPC } from '@/trpc/client'

/**
 * Custom hook for project creation logic
 */
export function useProjectCreation() {
  const router = useRouter()
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  // Get current active organization ID
  // @ts-ignore
  const { data: activeOrganization } = authClient.useActiveOrganization()
  const organizationId = activeOrganization?.id

  // Query current organization's project list
  const projectsQuery = useQuery({
    ...trpc.project.list.queryOptions({}),
    enabled: !!organizationId,
  })
  const currentProjectCount = projectsQuery.data?.length || 0

  // Create project tRPC mutation
  const createProjectMutation = useMutation(
    trpc.project.create.mutationOptions({
      onSuccess: async (data) => {
        // Log success

        // Refresh subscription limit data

        // Refresh project list query
        await queryClient.invalidateQueries(trpc.project.pathFilter())

        // Refresh quota status to reflect updated project count
        await queryClient.invalidateQueries(trpc.project.getQuotaStatus.pathFilter())
        await queryClient.invalidateQueries(trpc.subscription.getUsage.pathFilter())

        // Show success notification
        toast.success(
          m['dashboard.createProject.notifications.success']({ projectName: data.name }),
          {
            description: m['dashboard.createProject.notifications.successDescription'](),
            action: {
              label: m['dashboard.createProject.notifications.viewNow'](),
              onClick: () => router.push(`/project/${data.id}`),
            },
          }
        )
      },
      onError: (err) => {
        // Handle error cases

        toast.error(
          err.data?.code === 'UNAUTHORIZED'
            ? m['dashboard.login_required']()
            : m['dashboard.create_failed']()
        )
      },
    })
  )

  // Update project tRPC mutation
  const updateProjectMutation = useMutation(
    trpc.project.update.mutationOptions({
      onSuccess: async (data) => {
        // Refresh project list query
        await queryClient.invalidateQueries(trpc.project.pathFilter())

        // Refresh quota status in case project updates affect quota
        await queryClient.invalidateQueries(trpc.project.getQuotaStatus.pathFilter())
        await queryClient.invalidateQueries(trpc.subscription.getUsage.pathFilter())
      },
      onError: (err) => {
        toast.error('Failed to update project requirements, but app generation will continue')
      },
    })
  )

  return {
    createProjectMutation,
    updateProjectMutation,
    projectsQuery,
    currentProjectCount,
    router,
  }
}
