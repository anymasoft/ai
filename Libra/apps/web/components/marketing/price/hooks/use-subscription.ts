/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * use-subscription.ts
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
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useTRPC } from '@/trpc/client'
import { useMutation } from '@tanstack/react-query'
import * as m from '@/paraglide/messages'

export function useSubscription() {
  const router = useRouter()
  const { data: session } = authClient.useSession()
  const { data: activeOrganization } = authClient.useActiveOrganization()
  const trpc = useTRPC()
  
  const isAuthenticated = !!session

  // Create Portal Session mutation
  const createPortalSessionMutation = useMutation(
    trpc.stripe.createPortalSession.mutationOptions({
      onSuccess: async (data) => {
        const url = data?.data?.url || ''
        if (url) {
          router.push(url)
        } else {
          toast.error(m["common.error"]())
        }
      },
      onError: () => {
        toast.error(m["common.error"]())
      },
    })
  )

  const handleManageSubscription = async () => {
    if (!isAuthenticated) {
      router.push('/login')
      return
    }
    
    try {
      await createPortalSessionMutation.mutateAsync({})
    } catch {
      // Error is handled by the mutation's onError callback
    }
  }

  const handleUpgradeSubscription = async (planName: string, _seats: number, isYearly: boolean) => {
    if (!isAuthenticated) {
      router.push('/login')
      return
    }

    try {
      if (planName.toLowerCase().includes('free')) {
        router.push('/dashboard')
        return
      }

      const referenceId = activeOrganization?.id
      if (!referenceId) {
        toast.error(m["common.error"]())
        return
      }

      console.log('Upgrading subscription with params:', {
        plan: planName,
        annual: isYearly,
        referenceId: referenceId,
        seats: 1
      })

      const response = await authClient.subscription.upgrade({
        plan: planName,
        successUrl: "/dashboard",
        cancelUrl: "/#price",
        annual: isYearly,
        referenceId: referenceId,
        seats: 1,
        disableRedirect: false  // Ensure redirect is not disabled
      })

      if (response) {
        console.log('Subscription upgrade response:', JSON.stringify(response, null, 2))

        // Check if there is a data object and URL
        if (response.data && typeof response.data === 'object') {
          const data = response.data as Record<string, unknown>
          const url = data.url

          if (typeof url === 'string' && url) {
            console.log('Found checkout URL in data.url:', url)
            window.location.href = url
            return
          }

          const possibleUrlKeys = ['checkout_url', 'session_url', 'redirect_url']
          for (const key of possibleUrlKeys) {
            if (key in data) {
              const value = data[key]
              if (typeof value === 'string' && value) {
                console.log(`Found checkout URL in data.${key}:`, value)
                window.location.href = value
                return
              }
            }
          }

          if (data.id) {
            console.log('Subscription created with ID:', data.id)
            toast.success('Subscription created successfully!')
            router.push('/dashboard')
            return
          }
        }

        const possibleUrlKeys = ['url', 'checkout_url', 'session_url', 'redirect_url']
        for (const key of possibleUrlKeys) {
          if (key in response) {
            const value = (response as Record<string, unknown>)[key]
            if (typeof value === 'string' && value) {
              console.log(`Found checkout URL in ${key}:`, value)
              window.location.href = value
              return
            }
          }
        }

        console.log('No valid checkout URL found in response')
        toast.error(m["common.error"]())
      } else {
        console.error('No response received from subscription upgrade')
        toast.error(m["common.error"]())
      }
    } catch (error) {
      console.error('Subscription upgrade error:', error)

        if (error && typeof error === 'object') {
        console.error('Error details:', JSON.stringify(error, null, 2))

        if ('message' in error) {
          console.error('Error message:', error.message)
        }

        if ('response' in error) {
          console.error('API response error:', error.response)
        }
      }

      toast.error(m["common.error"]())
    }
  }

  return {
    isAuthenticated,
    handleUpgradeSubscription,
    handleManageSubscription,
    isCreatingPortalSession: createPortalSessionMutation.isPending
  }
}