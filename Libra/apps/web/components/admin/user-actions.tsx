/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * user-actions.tsx
 * Copyright (C) 2025 Nextify Limited
 */

'use client'

import { useState } from 'react'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import * as m from '@/paraglide/messages'

import { Button } from '@libra/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@libra/ui/components/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@libra/ui/components/alert-dialog'
import { Input } from '@libra/ui/components/input'
import { Label } from '@libra/ui/components/label'
import { Textarea } from '@libra/ui/components/textarea'
import { Badge } from '@libra/ui/components/badge'
import { Ban, UserCheck, Loader2 } from 'lucide-react'

import { authClient } from '@libra/auth/auth-client'
import type { AdminUser, BanUserParams, UnbanUserParams } from '@/lib/types/admin'

interface UserActionsProps {
  user: AdminUser
  onSuccess?: () => void
}

export function UserActions({ user, onSuccess }: UserActionsProps) {
  const [banDialogOpen, setBanDialogOpen] = useState(false)
  const [banReason, setBanReason] = useState('')
  const [banDuration, setBanDuration] = useState('')
  const queryClient = useQueryClient()

  const banUserMutation = useMutation({
    mutationFn: async (params: BanUserParams) => {
      return await authClient.admin.banUser(params)
    },
    onSuccess: () => {
      toast.success(m["admin.actions.ban_success"]())
      setBanDialogOpen(false)
      setBanReason('')
      setBanDuration('')
      // Invalidate and refetch admin users data
      queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === 'admin-users'
      })
      onSuccess?.()
    },
    onError: (error: Error) => {
      toast.error(`${m["admin.actions.ban_failed"]()}: ${error.message || m["common.error"]()}`)
    },
  })

  const unbanUserMutation = useMutation({
    mutationFn: async (params: UnbanUserParams) => {
      return await authClient.admin.unbanUser(params)
    },
    onSuccess: () => {
      toast.success(m["admin.actions.unban_success"]())
      // Invalidate and refetch admin users data
      queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === 'admin-users'
      })
      onSuccess?.()
    },
    onError: (error: Error) => {
      toast.error(`${m["admin.actions.unban_failed"]()}: ${error.message || m["common.error"]()}`)
    },
  })

  const handleBanUser = () => {
    const params: BanUserParams = {
      userId: user.id,
      banReason: banReason.trim() || undefined,
    }

    // Convert duration to seconds if provided
    if (banDuration.trim()) {
      const days = Number.parseInt(banDuration)
      if (!Number.isNaN(days) && days > 0) {
        params.banExpiresIn = days * 24 * 60 * 60 // Convert days to seconds
      }
    }

    banUserMutation.mutate(params)
  }

  const handleUnbanUser = () => {
    unbanUserMutation.mutate({ userId: user.id })
  }

  const isBanned = user.banned
  const isLoading = banUserMutation.isPending || unbanUserMutation.isPending

  return (
    <div className="flex items-center gap-2">
      {/* User Status Badge */}
      <Badge variant={isBanned ? 'destructive' : 'secondary'}>
        {isBanned ? m["admin.user_status.banned"]() : m["admin.user_status.normal"]()}
      </Badge>

      {/* Ban/Unban Actions */}
      {isBanned ? (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={isLoading}
              className="text-green-600 hover:text-green-700"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserCheck className="h-4 w-4" />
              )}
              {m["admin.actions.unban"]()}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{m["admin.unban_dialog.title"]()}</AlertDialogTitle>
              <AlertDialogDescription>
                {m["admin.unban_dialog.description"]({ name: user.name, email: user.email })}
                {user.banReason && (
                  <div className="mt-2 p-2 bg-muted rounded text-sm">
                    <strong>{m["admin.unban_dialog.ban_reason_label"]()}:</strong> {user.banReason}
                  </div>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{m["common.cancel"]()}</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleUnbanUser}
                disabled={isLoading}
                className="bg-green-600 hover:bg-green-700"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {m["admin.actions.confirm_unban"]()}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : (
        <Dialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={isLoading}
              className="text-red-600 hover:text-red-700"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Ban className="h-4 w-4" />
              )}
              {m["admin.actions.ban"]()}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{m["admin.ban_dialog.title"]()}</DialogTitle>
              <DialogDescription>
                {m["admin.ban_dialog.description"]({ name: user.name, email: user.email })}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="banReason">{m["admin.ban_dialog.reason_optional"]()}</Label>
                <Textarea
                  id="banReason"
                  placeholder={m["admin.actions.ban_reason_placeholder"]()}
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  className="resize-none"
                  rows={3}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="banDuration">{m["admin.ban_dialog.duration_optional"]()}</Label>
                <Input
                  id="banDuration"
                  type="number"
                  placeholder={m["admin.actions.ban_duration_placeholder"]()}
                  value={banDuration}
                  onChange={(e) => setBanDuration(e.target.value)}
                  min="1"
                />
                <p className="text-xs text-muted-foreground">
                  {m["admin.actions.ban_duration_help"]()}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setBanDialogOpen(false)}
                disabled={isLoading}
              >
                {m["common.cancel"]()}
              </Button>
              <Button
                variant="destructive"
                onClick={handleBanUser}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {m["admin.actions.confirm_ban"]()}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
