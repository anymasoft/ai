/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * columns.tsx
 * Copyright (C) 2025 Nextify Limited
 */

'use client'

import { ColumnDef } from '@tanstack/react-table'
import { format } from 'date-fns'
import { ArrowUpDown, MoreHorizontal } from 'lucide-react'

import * as m from '@/paraglide/messages'

import { Button } from '@libra/ui/components/button'
import { Badge } from '@libra/ui/components/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@libra/ui/components/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@libra/ui/components/dropdown-menu'

import type { AdminUser } from '@/lib/types/admin'
import { UserActions } from './user-actions'

export function createColumns(refetch: () => void): ColumnDef<AdminUser>[] {
  return [
  {
    accessorKey: 'name',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-auto p-0 font-medium"
        >
          {m["admin.columns.user_info"]()}
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const user = row.original
      return (
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            {user.image ? (
              <AvatarImage src={user.image} alt={user.name} />
            ) : null}
            <AvatarFallback>
              {user.name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <div className="font-medium">{user.name || m["admin.table.no_name"]()}</div>
            <div className="text-sm text-muted-foreground">{user.email}</div>
          </div>
        </div>
      )
    },
  },
  {
    accessorKey: 'role',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-auto p-0 font-medium"
        >
          {m["admin.columns.role"]()}
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const role = row.getValue('role') as string
      const roleMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
        admin: { label: m["admin.user_roles.admin"](), variant: 'destructive' },
        superadmin: { label: m["admin.user_roles.superadmin"](), variant: 'destructive' },
        user: { label: m["admin.user_roles.user"](), variant: 'secondary' },
      }

      const roleInfo = roleMap[role] || { label: role, variant: 'outline' as const }

      return <Badge variant={roleInfo.variant}>{roleInfo.label}</Badge>
    },
  },
  {
    accessorKey: 'createdAt',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-auto p-0 font-medium"
        >
          {m["admin.columns.registration_time"]()}
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const date = row.getValue('createdAt') as string | Date
      const formattedDate = format(new Date(date), 'yyyy-MM-dd HH:mm')
      return <div className="text-sm">{formattedDate}</div>
    },
  },
  {
    accessorKey: 'emailVerified',
    header: m["admin.columns.email_verification"](),
    cell: ({ row }) => {
      const verified = row.getValue('emailVerified') as boolean
      return (
        <Badge variant={verified ? 'default' : 'outline'}>
          {verified ? m["admin.user_status.verified"]() : m["admin.user_status.unverified"]()}
        </Badge>
      )
    },
  },
  {
    accessorKey: 'banned',
    header: m["admin.columns.status"](),
    cell: ({ row }) => {
      const user = row.original
      const isBanned = user.banned

      return (
        <div className="space-y-1">
          <Badge variant={isBanned ? 'destructive' : 'default'}>
            {isBanned ? m["admin.user_status.banned"]() : m["admin.user_status.normal"]()}
          </Badge>
          {isBanned && user.banReason && (
            <div className="text-xs text-muted-foreground max-w-[200px] truncate">
              {m["admin.status.reason"]()}: {user.banReason}
            </div>
          )}
          {isBanned && user.banExpires && (
            <div className="text-xs text-muted-foreground">
              {m["admin.status.expires"]()}: {format(new Date(user.banExpires), 'yyyy-MM-dd')}
            </div>
          )}
        </div>
      )
    },
  },
  {
    id: 'actions',
    header: m["admin.columns.actions"](),
    cell: ({ row }) => {
      const user = row.original

      return (
        <div className="flex items-center gap-2">
          <UserActions user={user} onSuccess={refetch} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">{m["admin.status.open_menu"]()}</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{m["admin.status.user_actions"]()}</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => navigator.clipboard.writeText(user.id)}
              >
                {m["admin.actions.copy_user_id"]()}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigator.clipboard.writeText(user.email)}
              >
                {m["admin.actions.copy_email"]()}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-muted-foreground">
                {m["admin.actions.view_details"]()}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )
    },
  },
  ]
}

// For backward compatibility
export const columns = createColumns(() => {})
