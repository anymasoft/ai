/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * admin-utils.test.ts
 * Copyright (C) 2025 Nextify Limited
 */

import { describe, it, expect } from 'vitest'
import type { AdminPermission, UserRole, OrganizationRole } from '../admin-utils'

describe('Admin Utils Types', () => {
  it('should have correct AdminPermission types', () => {
    const permissions: AdminPermission[] = [
      'user:create',
      'user:list',
      'user:ban',
      'user:unban',
      'user:delete',
      'user:impersonate',
      'user:set-role',
      'session:list',
      'session:revoke',
      'organization:manage',
    ]

    expect(permissions).toHaveLength(10)
  })

  it('should have correct UserRole types', () => {
    const roles: UserRole[] = ['user', 'admin', 'superadmin']
    expect(roles).toHaveLength(3)
  })

  it('should have correct OrganizationRole types', () => {
    const orgRoles: OrganizationRole[] = ['owner', 'admin', 'member']
    expect(orgRoles).toHaveLength(3)
  })
})
