/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * organization-plugin.ts
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

import { sendOrganizationInvitation } from '../utils/email-service'
import { organization } from 'better-auth/plugins'
import { getSubscription } from '../utils/subscription-utils'

export const organizationPlugin = organization({
  async sendInvitationEmail(data: any) {
    const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL}/accept-invitation/${data.id}`
    sendOrganizationInvitation({
      email: data.email,
      invitedByUsername: data.inviter.user.name,
      invitedByEmail: data.inviter.user.email,
      teamName: data.organization.name,
      inviteLink,
    })
  },
  organizationCreation: {
    disabled: false, // Set to true to disable organization creation
    // beforeCreate: async ({ organization, user }, request) => {
    //   // Run custom logic before organization is created
    //   // Optionally modify the organization data
    //   return {
    //     data: {
    //       ...organization,
    //       metadata: {
    //         customField: 'value',
    //       },
    //     },
    //   }
    // },
    // afterCreate: async ({ organization, member, user }, request) => {
    //   // Run custom logic after organization is created
    //   // e.g., create default resources, send notifications
    //   // await setupDefaultResources(organization.id)
    // },
  },
  allowUserToCreateOrganization: async (user) => {
    const subscription = await getSubscription(user.id)
    return subscription.plan !== 'FREE'
  },
})
