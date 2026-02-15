/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * types.ts
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

// Type definitions - adjust according to actual organization member types
export type Member = {
  id: string
  userId: string
  organizationId: string
  role: string
  createdAt: Date | string
  user?: { 
    id: string
    name?: string
    email: string
    image?: string
  }
}

export type Invitation = {
  id: string
  email: string
  role: string
  status: string 
  expiresAt: Date | string
  organizationId: string
  inviterId: string
  teamId?: string
}

// Status definitions
export type MemberStatus = 'active' | 'inactive' | 'pending' | 'blocked';
export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'canceled' | 'rejected';

// Form parameter types
export type handleInviteMemberParams = {
  email: string;
  role: string;
};

// Component property types
export interface InviteFormProps {
  onInvite: (params: handleInviteMemberParams) => Promise<void>;
  isLoading: boolean;
}

export interface MemberTableProps {
  members: Member[];
  isLoading: boolean;
  organizationId: string;
  onUpdateRole: (memberId: string, role: string) => Promise<void>;
  onRemoveMember: (memberId: string, organizationId: string, name?: string, email?: string) => Promise<void>;
}

export interface InvitationTableProps {
  invitations: Invitation[];
  isLoading: boolean;
  onCancelInvitation: (invitationId: string, email: string) => Promise<void>;
} 