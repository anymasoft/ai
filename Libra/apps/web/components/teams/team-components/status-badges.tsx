/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * status-badges.tsx
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

import { Badge } from '@libra/ui/components/badge'
import {
  ShieldIcon,
  UserIcon,
  CheckIcon,
  ClockIcon,
  XCircleIcon,
  BanIcon,
  InboxIcon
} from "lucide-react"
import * as m from '@/paraglide/messages'

import type { MemberStatus, InvitationStatus } from './types'

// Render member role badge
export function RoleBadge({ role }: { role: string }) {
  switch (role) {
    case 'owner':
      return (
        <Badge className="bg-primary text-primary-foreground">
          <ShieldIcon className="h-3 w-3 mr-1" />
          {m['dashboard.teams.inviteForm.roleOwner']()}
        </Badge>
      )
    case 'admin':
      return (
        <Badge className="bg-amber-500/20 text-amber-700 dark:bg-amber-500/30 dark:text-amber-300">
          <ShieldIcon className="h-3 w-3 mr-1" />
          {m['dashboard.teams.inviteForm.roleAdmin']()}
        </Badge>
      )
    default:
      return (
        <Badge variant="outline">
          {m['dashboard.teams.inviteForm.roleMember']()}
        </Badge>
      )
  }
}

// Get member status - simulated status logic, should be based on real data in production
export function getMemberStatus(role: string): MemberStatus {
  // This is simulated status logic, should be based on real data in production
  if (role === 'owner') return 'active';
  
  // Return random status for demo, please use real logic in production
  const statuses: MemberStatus[] = ['active', 'inactive', 'pending', 'blocked'];
  const randomIndex = Math.floor(Math.random() * 10) % 4;
  
  // Ensure valid status value is returned, never undefined
  return statuses[randomIndex] || 'active';
}

// Render member status badge
function MemberStatusBadge({ status }: { status: MemberStatus }) {
  switch (status) {
    case 'active':
      return (
        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200 dark:border-green-900 dark:bg-green-900/20 dark:text-green-400">
          <CheckIcon className="h-3 w-3 mr-1" />
          {m['dashboard.teams.memberTable.status.active']()}
        </Badge>
      );
    case 'inactive':
      return (
        <Badge variant="outline" className="bg-gray-300/30 text-gray-600 border-gray-200 dark:border-gray-700 dark:bg-gray-800/40 dark:text-gray-400">
          <ClockIcon className="h-3 w-3 mr-1" />
          {m['dashboard.teams.memberTable.status.inactive']()}
        </Badge>
      );
    case 'pending':
      return (
        <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-900 dark:bg-blue-900/20 dark:text-blue-400">
          <ClockIcon className="h-3 w-3 mr-1" />
          {m['dashboard.teams.memberTable.status.pending']()}
        </Badge>
      );
    case 'blocked':
      return (
        <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-200 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400">
          <BanIcon className="h-3 w-3 mr-1" />
          {m['dashboard.teams.memberTable.status.blocked']()}
        </Badge>
      );
    default:
      // Return default badge instead of null to avoid type errors
      return (
        <Badge variant="outline" className="bg-gray-300/30 text-gray-600 border-gray-200">
          <UserIcon className="h-3 w-3 mr-1" />
          {m['dashboard.teams.memberTable.status.unknown']()}
        </Badge>
      );
  }
}

// Get invitation status - may be based on expiration time or status field
export function getInvitationStatus(invitation: { status: string, expiresAt: Date | string }): InvitationStatus {
  // Check if expired
  const now = new Date();
  const expiresAt = new Date(invitation.expiresAt);
  
  if (now > expiresAt) {
    return 'expired';
  }
  
  // Use status field from invitation object if it exists
  if (invitation.status === 'accepted') return 'accepted';
  if (invitation.status === 'canceled') return 'canceled';
  if (invitation.status === 'rejected') return 'rejected';
  
  // Default to pending
  return 'pending';
}

// Render invitation status badge
export function InvitationStatusBadge({ status }: { status: InvitationStatus }) {
  switch (status) {
    case 'pending':
      return (
        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-400">
          <InboxIcon className="h-3 w-3 mr-1" />
          {m['dashboard.teams.invitationTable.status.pending']()}
        </Badge>
      );
    case 'accepted':
      return (
        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200 dark:border-green-900 dark:bg-green-900/20 dark:text-green-400">
          <CheckIcon className="h-3 w-3 mr-1" />
          {m['dashboard.teams.invitationTable.status.accepted']()}
        </Badge>
      );
    case 'expired':
      return (
        <Badge variant="outline" className="bg-gray-300/30 text-gray-600 border-gray-200 dark:border-gray-700 dark:bg-gray-800/40 dark:text-gray-400">
          <XCircleIcon className="h-3 w-3 mr-1" />
          {m['dashboard.teams.invitationTable.status.expired']()}
        </Badge>
      );
    case 'canceled':
      return (
        <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-200 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400">
          <XCircleIcon className="h-3 w-3 mr-1" />
          {m['dashboard.teams.invitationTable.status.canceled']()}
        </Badge>
      );
    case 'rejected':
      return (
        <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-200 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400">
          <XCircleIcon className="h-3 w-3 mr-1" />
          {m['dashboard.teams.invitationTable.status.rejected']()}
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="bg-gray-300/30 text-gray-600 border-gray-200">
          <UserIcon className="h-3 w-3 mr-1" />
          {m['dashboard.teams.invitationTable.status.unknown']()}
        </Badge>
      );
  }
} 