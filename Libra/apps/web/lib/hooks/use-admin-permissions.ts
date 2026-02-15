/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * use-admin-permissions.ts
 * Copyright (C) 2025 Nextify Limited
 */

'use client'

import { useSession } from '@libra/auth/auth-client'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

/**
 * Hook for checking admin permissions and handling redirects
 */
export function useAdminPermissions() {
  const { data: session, isPending } = useSession()
  const router = useRouter()

  // Check if user is admin
  const isAdmin = session?.user?.role === 'admin' || session?.user?.role === 'superadmin'

  // Redirect non-admin users
  useEffect(() => {
    if (!isPending && !isAdmin) {
      router.push('/dashboard')
    }
  }, [isPending, isAdmin, router])

  return {
    session,
    isAdmin,
    isPending,
    user: session?.user,
  }
}

/**
 * Hook for checking if current user can perform admin actions
 */
export function useCanPerformAdminActions() {
  const { isAdmin, isPending } = useAdminPermissions()

  return {
    canBanUser: isAdmin && !isPending,
    canUnbanUser: isAdmin && !isPending,
    canListUsers: isAdmin && !isPending,
    canManageUsers: isAdmin && !isPending,
    isLoading: isPending,
  }
}
