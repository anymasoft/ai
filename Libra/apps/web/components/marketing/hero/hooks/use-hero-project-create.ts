/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * use-hero-project-create.ts
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

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useTRPC } from '@/trpc/client'
import { authClient } from '@libra/auth/auth-client'
import * as m from '@/paraglide/messages'

export function useHeroProjectCreate(onSuccess?: () => void) {
  const router = useRouter()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const { data: session } = authClient.useSession()

  const mutation = useMutation(
    trpc.project.heroProjectCreate.mutationOptions({
      onSuccess: async (data) => {
        toast.success(m['hero.projectCreate.success']({ name: data.name }))

        // Refresh quota status to reflect updated project count
        await queryClient.invalidateQueries(trpc.project.getQuotaStatus.pathFilter())
        await queryClient.invalidateQueries(trpc.subscription.getUsage.pathFilter())
        await queryClient.invalidateQueries(trpc.project.pathFilter())

        router.push(`/project/${data.id}`)
        // Call the reset callback after navigation starts
        onSuccess?.()
      },
      onError: (err) => {
        const code = err.data?.code
        if (code === 'UNAUTHORIZED') {
          toast.error(m['dashboard.login_required']())
          router.push('/login')
        } else if (code === 'FORBIDDEN') {
          toast.error(err.message || m['hero.projectCreate.limitExceeded']())
        } else {
          toast.error(m['dashboard.create_failed']())
        }
      },
    })
  )

  const heroProjectCreate = (initialMessage: string, attachment?: { key: string; name: string; type: string } | null, planId?: string | null) => {
    if (!session?.user) {
      router.push('/login')
      return
    }
    mutation.mutate({
      initialMessage,
      ...(attachment && { attachment }),
      ...(planId && { planId })
    })
  }

  return {
    heroProjectCreate,
    isLoading: mutation.isPending,
    error: mutation.error,
  }
} 