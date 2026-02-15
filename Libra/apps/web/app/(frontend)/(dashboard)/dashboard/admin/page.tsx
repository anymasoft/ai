/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * page.tsx
 * Copyright (C) 2025 Nextify Limited
 */

'use client'

import { Shield, Users } from 'lucide-react'

import { Alert, AlertDescription } from '@libra/ui/components/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@libra/ui/components/card'
import { Skeleton } from '@libra/ui/components/skeleton'

import { UserManagementTable } from '@/components/admin/user-management-table'
import { useAdminPermissions } from '@/lib/hooks/use-admin-permissions'
import * as m from '@/paraglide/messages'

export default function AdminPage() {
  const { isPending, user } = useAdminPermissions()

  // Show loading state
  if (isPending) {
    return (
      <div className="container mx-auto py-8 space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Array.from({ length: 5 }, (_, i) => {
                const skeletonId = `admin-skeleton-${Date.now()}-${i}`
                return (
                  <div key={skeletonId} className="flex items-center space-x-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <Skeleton className="h-8 w-20" />
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Page Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">{m["admin.title"]()}</h1>
        </div>
        <p className="text-muted-foreground">
          {m["admin.description"]()}
        </p>
      </div>

      {/* Admin Info */}
      <Alert>
        <Users className="h-4 w-4" />
        <AlertDescription>
          {m["admin.current_admin"]()}: <strong>{user?.name || user?.email}</strong> ({user?.role})
        </AlertDescription>
      </Alert>

      {/* User Management Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {m["admin.user_management"]()}
          </CardTitle>
          <CardDescription>
            {m["admin.user_management_description"]()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UserManagementTable />
        </CardContent>
      </Card>
    </div>
  )
}