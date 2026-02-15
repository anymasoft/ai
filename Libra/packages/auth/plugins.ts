/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * plugins.ts
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

import {captchaPlugin} from './plugins/captcha-plugin'
import {emailOTPPlugin} from './plugins/email-otp-plugin'
import {stripePlugin} from './plugins/stripe-plugin'
import {organizationPlugin} from './plugins/organization-plugin'
import {emailHarmony} from "better-auth-harmony";
import {admin, bearer} from "better-auth/plugins";
import {getAdminUserIds} from './env.mjs';

// Re-export utility functions for backward compatibility
export {getActiveOrganization} from './utils/organization-utils'

// Export plugins array with emailOTP as first priority
export const plugins = [
    admin({
        defaultRole: 'user',
        adminRoles: ["admin", "superadmin"],
        adminUserIds: getAdminUserIds(), // Configured via ADMIN_USER_IDS environment variable
    }),
    captchaPlugin,
    emailOTPPlugin,
    ...stripePlugin,
    organizationPlugin,
    emailHarmony(),
    bearer(),
]
