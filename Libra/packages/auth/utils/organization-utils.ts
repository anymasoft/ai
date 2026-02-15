/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * organization-utils.ts
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

import { createId } from '@paralleldrive/cuid2'
import { eq } from 'drizzle-orm'
import {
  getAuthDb,
  member,
  organization as organizationTable,
  user,
} from '../db'

/**
 * Get the user's active organization.
 * If the user doesn't have an organization, create a default one.
 */
export async function getActiveOrganization(userId: string) {
  const db = await getAuthDb()
  const userMembers = await db.query.member.findMany({
    where: eq(member.userId, userId),
  })

  if (!userMembers || userMembers.length === 0) {

    const userData = await db.query.user.findFirst({
      where: eq(user.id, userId),
    })
    if (!userData) {
      throw new Error(`User not found: ${userId}`)
    }

    let orgName = 'My Organization'
    if (userData.email) {
      const emailPrefix = userData.email.split('@')[0]
      orgName = `${emailPrefix}'s Organization`
    } else if (userData.name) {
      orgName = `${userData.name}'s Organization`
    }

    const orgId = createId()
    await db.insert(organizationTable).values({
      id: orgId,
      name: orgName,
      slug: `${userId}-org`,
      createdAt: new Date(),
    })
    await db.insert(member).values({
      id: createId(),
      organizationId: orgId,
      userId: userId,
      role: 'owner',
      createdAt: new Date(),
    })

    return { id: orgId, stripeCustomerId: userData.stripeCustomerId }
  }

  const firstMember = userMembers[0]
  if (!firstMember) {
    throw new Error('Could not retrieve organization membership')
  }

  return { id: firstMember.organizationId }
}
