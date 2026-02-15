/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * index.tsx
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

// Export email subjects mapping
export { emailSubjects } from './emails'

// Export all email templates
export * from './emails/cancellation-email'
export * from './emails/contact'
export * from './emails/email-verification'
export * from './emails/organization-invitation'
export * from './emails/sign-in'
export * from './emails/welcomeEmail'

// Re-export components for convenience
export * from '../components'
