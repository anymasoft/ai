/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * github-schema.ts
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
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { organization } from './auth-schema'

// GitHub App installations table
export const githubInstallation = sqliteTable(
  'github_installation',
  {
    id: text('id').$defaultFn(() => createId()).primaryKey(),
    // GitHub installation ID
    installationId: integer('installation_id').notNull().unique(),
    // Organization that owns this GitHub App installation
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    // GitHub account where the app is installed (could be user or organization)
    githubAccountId: integer('github_account_id').notNull(),
    githubAccountLogin: text('github_account_login').notNull(),
    githubAccountType: text('github_account_type').notNull(), // 'User' or 'Organization'
    // Installation permissions and settings
    permissions: text('permissions').notNull().default('{}'), // JSON string
    repositorySelection: text('repository_selection').notNull(), // 'all' or 'selected'
    // Installation status
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    // Timestamps
    installedAt: integer('installed_at', { mode: 'timestamp' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    // Index for organization lookups - find all installations for an organization
    index('github_installation_organization_id_idx').on(table.organizationId),
    // Index for installation ID lookups - find installation by GitHub installation ID
    index('github_installation_installation_id_idx').on(table.installationId),
    // Index for GitHub account lookups - find installations by GitHub account
    index('github_installation_github_account_idx').on(table.githubAccountId),
    // Composite index for active installations by organization
    index('github_installation_org_active_idx').on(table.organizationId, table.isActive),
  ]
)

// GitHub App user access tokens (for repository creation on user accounts)
export const githubUserToken = sqliteTable(
  'github_user_token',
  {
    id: text('id').$defaultFn(() => createId()).primaryKey(),
    // Link to the organization that owns this token
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    // GitHub user information
    githubUserId: integer('github_user_id').notNull(),
    githubUsername: text('github_username').notNull(),
    githubEmail: text('github_email'),
    // GitHub user access token (OAuth token for the user)
    accessToken: text('access_token').notNull(),
    refreshToken: text('refresh_token'),
    // Token metadata
    scope: text('scope').notNull(),
    tokenType: text('token_type').notNull().default('bearer'),
    expiresAt: integer('expires_at', { mode: 'timestamp' }),
    refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp' }),
    // Timestamps
    createdAt: integer('created_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    // Index for organization lookups
    index('github_user_token_organization_idx').on(table.organizationId),
    // Index for GitHub user lookups
    index('github_user_token_github_user_idx').on(table.githubUserId),
    // Index for GitHub username lookups
    index('github_user_token_github_username_idx').on(table.githubUsername),
  ]
)
