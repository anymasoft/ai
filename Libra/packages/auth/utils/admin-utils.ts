/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * admin-utils.ts
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

import { eq, and } from 'drizzle-orm'
import { getAuthDb } from '../db'
import { user, member } from '../db/schema/auth-schema'
import { log } from '@libra/common'

/**
 * Admin permission types
 */
export type AdminPermission = 
  | 'user:create'
  | 'user:list'
  | 'user:ban'
  | 'user:unban'
  | 'user:delete'
  | 'user:impersonate'
  | 'user:set-role'
  | 'session:list'
  | 'session:revoke'
  | 'organization:manage'

/**
 * User role types
 */
export type UserRole = 'user' | 'admin' | 'superadmin'

/**
 * Organization role types (existing)
 */
export type OrganizationRole = 'owner' | 'admin' | 'member'

/**
 * Check if a user has global admin permissions
 * @param userId - The user ID to check
 * @returns Promise<boolean> - Whether the user is a global admin
 */
export async function isGlobalAdmin(userId: string): Promise<boolean> {
  try {
    const db = await getAuthDb()
    
    const userData = await db.query.user.findFirst({
      where: eq(user.id, userId),
      columns: {
        id: true,
        role: true,
        banned: true,
      },
    })

    if (!userData || userData.banned) {
      return false
    }

    // Check if user has admin or superadmin role
    return userData.role === 'admin' || userData.role === 'superadmin'
  } catch (error) {
    log.auth('error', 'Failed to check global admin status', {
      userId,
      operation: 'is_global_admin',
    }, error as Error)
    return false
  }
}

/**
 * Check if a user has organization admin permissions
 * @param userId - The user ID to check
 * @param organizationId - The organization ID to check
 * @returns Promise<boolean> - Whether the user is an organization admin
 */
export async function isOrganizationAdmin(userId: string, organizationId: string): Promise<boolean> {
  try {
    const db = await getAuthDb()
    
    const membership = await db.query.member.findFirst({
      where: and(
        eq(member.userId, userId),
        eq(member.organizationId, organizationId)
      ),
      columns: {
        role: true,
      },
    })

    if (!membership) {
      return false
    }

    // Check if user has owner or admin role in the organization
    return membership.role === 'owner' || membership.role === 'admin'
  } catch (error) {
    log.auth('error', 'Failed to check organization admin status', {
      userId,
      organizationId,
      operation: 'is_organization_admin',
    }, error as Error)
    return false
  }
}

/**
 * Check if a user has a specific admin permission
 * @param userId - The user ID to check
 * @param permission - The permission to check
 * @param organizationId - Optional organization ID for organization-specific permissions
 * @returns Promise<boolean> - Whether the user has the permission
 */
export async function hasAdminPermission(
  userId: string, 
  permission: AdminPermission, 
  organizationId?: string
): Promise<boolean> {
  try {
    // First check if user is a global admin
    const isGlobal = await isGlobalAdmin(userId)
    if (isGlobal) {
      return true // Global admins have all permissions
    }

    // For organization-specific permissions, check organization admin status
    if (organizationId && permission.startsWith('organization:')) {
      return await isOrganizationAdmin(userId, organizationId)
    }

    // For user management permissions, only global admins are allowed
    if (permission.startsWith('user:') || permission.startsWith('session:')) {
      return false // Only global admins can manage users and sessions
    }

    return false
  } catch (error) {
    log.auth('error', 'Failed to check admin permission', {
      userId,
      permission,
      organizationId,
      operation: 'has_admin_permission',
    }, error as Error)
    return false
  }
}

/**
 * Get user's effective role (considering both global and organization roles)
 * @param userId - The user ID
 * @param organizationId - Optional organization ID
 * @returns Promise<{globalRole: UserRole, organizationRole?: OrganizationRole}> - User's roles
 */
export async function getUserRoles(userId: string, organizationId?: string): Promise<{
  globalRole: UserRole
  organizationRole?: OrganizationRole
}> {
  try {
    const db = await getAuthDb()
    
    // Get global role
    const userData = await db.query.user.findFirst({
      where: eq(user.id, userId),
      columns: {
        role: true,
      },
    })

    const globalRole = (userData?.role as UserRole) || 'user'
    
    let organizationRole: OrganizationRole | undefined

    // Get organization role if organizationId is provided
    if (organizationId) {
      const membership = await db.query.member.findFirst({
        where: and(
          eq(member.userId, userId),
          eq(member.organizationId, organizationId)
        ),
        columns: {
          role: true,
        },
      })
      
      organizationRole = membership?.role as OrganizationRole
    }

    return {
      globalRole,
      organizationRole,
    }
  } catch (error) {
    log.auth('error', 'Failed to get user roles', {
      userId,
      organizationId,
      operation: 'get_user_roles',
    }, error as Error)
    
    return {
      globalRole: 'user',
      organizationRole: undefined,
    }
  }
}

/**
 * Check if a user can perform an action on another user
 * @param actorUserId - The user performing the action
 * @param targetUserId - The user being acted upon
 * @param action - The action being performed
 * @returns Promise<boolean> - Whether the action is allowed
 */
export async function canActOnUser(
  actorUserId: string, 
  targetUserId: string, 
  action: AdminPermission
): Promise<boolean> {
  try {
    // Users cannot act on themselves for certain actions
    if (actorUserId === targetUserId && ['user:ban', 'user:delete'].includes(action)) {
      return false
    }

    // Check if actor has the required permission
    const hasPermission = await hasAdminPermission(actorUserId, action)
    if (!hasPermission) {
      return false
    }

    // Additional checks for role hierarchy
    const actorRoles = await getUserRoles(actorUserId)
    const targetRoles = await getUserRoles(targetUserId)

    // Superadmins can act on anyone except other superadmins
    if (actorRoles.globalRole === 'superadmin') {
      return targetRoles.globalRole !== 'superadmin' || actorUserId === targetUserId
    }

    // Regular admins cannot act on other admins or superadmins
    if (actorRoles.globalRole === 'admin') {
      return targetRoles.globalRole === 'user'
    }

    return false
  } catch (error) {
    log.auth('error', 'Failed to check user action permission', {
      actorUserId,
      targetUserId,
      action,
      operation: 'can_act_on_user',
    }, error as Error)
    return false
  }
}
