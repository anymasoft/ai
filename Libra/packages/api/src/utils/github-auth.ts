/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * github-auth.ts
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

import { githubInstallation, githubUserToken } from '@libra/auth/db/schema/github-schema'
import { TRPCError } from '@trpc/server'
import { and, eq } from 'drizzle-orm'

// Types for GitHub authentication
export interface GitHubAuthResult {
  token: string
  type: 'user' | 'installation'
  expiresAt?: Date | null
}

export interface GitHubTokenRefreshResult {
  accessToken: string
  refreshToken?: string | null
  expiresAt?: Date | null
  refreshTokenExpiresAt?: Date | null
}

// Type for database instance
type DatabaseInstance = Awaited<ReturnType<typeof import('@libra/auth/db').getAuthDb>>

/**
 * Refresh a GitHub user access token using the refresh token
 */
export async function refreshGitHubUserToken(
  db: DatabaseInstance,
  userToken: typeof githubUserToken.$inferSelect
): Promise<GitHubTokenRefreshResult> {
  if (!userToken.refreshToken) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'No refresh token available. Please re-authorize your GitHub account.',
    })
  }

  // Check if refresh token is expired
  if (userToken.refreshTokenExpiresAt && userToken.refreshTokenExpiresAt < new Date()) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Refresh token has expired. Please re-authorize your GitHub account.',
    })
  }

  // Use GITHUB_OAUTH_CLIENT_ID for personal user OAuth (OAuth App)
  // This function only handles OAuth App token refresh, not GitHub App
  const GITHUB_CLIENT_ID = process.env['GITHUB_OAUTH_CLIENT_ID']
  const GITHUB_CLIENT_SECRET = process.env['GITHUB_OAUTH_CLIENT_SECRET']

  if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'GitHub OAuth credentials not configured',
    })
  }

  try {
    const refreshResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: userToken.refreshToken,
      }),
    })

    if (!refreshResponse.ok) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Failed to refresh GitHub token. Please re-authorize your GitHub account.',
      })
    }

    const tokenData = await refreshResponse.json()

    if ((tokenData as any).error) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: `GitHub token refresh failed: ${(tokenData as any).error_description || (tokenData as any).error}`,
      })
    }

    const newExpiresAt = (tokenData as any).expires_in
      ? new Date(Date.now() + (tokenData as any).expires_in * 1000)
      : null

    const newRefreshTokenExpiresAt = (tokenData as any).refresh_token_expires_in
      ? new Date(Date.now() + (tokenData as any).refresh_token_expires_in * 1000)
      : null

    // Update the token in the database
    await db
      .update(githubUserToken)
      .set({
        accessToken: (tokenData as any).access_token,
        refreshToken: (tokenData as any).refresh_token || userToken.refreshToken,
        expiresAt: newExpiresAt,
        refreshTokenExpiresAt: newRefreshTokenExpiresAt,
        updatedAt: new Date(),
      })
      .where(eq(githubUserToken.id, userToken.id))

    return {
      accessToken: (tokenData as any).access_token,
      refreshToken: (tokenData as any).refresh_token || userToken.refreshToken,
      expiresAt: newExpiresAt,
      refreshTokenExpiresAt: newRefreshTokenExpiresAt,
    }
  } catch (error) {
    if (error instanceof TRPCError) {
      throw error
    }
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to refresh GitHub token',
    })
  }
}

/**
 * Generate an installation access token for a GitHub App installation
 */
export async function generateInstallationToken(installationId: number): Promise<string> {
  const GITHUB_APP_ID = process.env['GITHUB_APP_ID']
  const GITHUB_APP_PRIVATE_KEY = process.env['GITHUB_APP_PRIVATE_KEY']

  if (!GITHUB_APP_ID || !GITHUB_APP_PRIVATE_KEY) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'GitHub App credentials not configured',
    })
  }

  try {
    // Create GitHub App instance
    const { App } = await import('@octokit/app')
    const app = new App({
      appId: GITHUB_APP_ID,
      privateKey: GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, '\n'),
    })

    // Generate installation access token
    const installationOctokit = await app.getInstallationOctokit(installationId)
    const { data } = await installationOctokit.request(
      'POST /app/installations/{installation_id}/access_tokens',
      {
        installation_id: installationId,
      }
    )

    return data.token
  } catch {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to generate GitHub installation token',
    })
  }
}

/**
 * Get the appropriate GitHub authentication token for an organization
 * This function determines whether to use a user token or installation token
 * based on the GitHub installation type and handles token refresh if needed
 */
export async function getGitHubAuthToken(
  db: DatabaseInstance,
  organizationId: string
): Promise<GitHubAuthResult> {
  try {
    // First, check if there's a GitHub installation for this organization
    const installation = await db.query.githubInstallation.findFirst({
      where: and(
        eq(githubInstallation.organizationId, organizationId),
        eq(githubInstallation.isActive, true)
      ),
    })

    if (installation) {
      // For GitHub App installations, check the account type
      if (installation.githubAccountType === 'User') {
        // Personal user installation - use user token
        const userToken = await db.query.githubUserToken.findFirst({
          where: eq(githubUserToken.organizationId, organizationId),
        })

        if (!userToken) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'GitHub user token not found. Please complete the OAuth authorization.',
          })
        }

        // Check if token is expired and refresh if needed
        if (userToken.expiresAt && userToken.expiresAt < new Date()) {
          const refreshResult = await refreshGitHubUserToken(db, userToken)
          return {
            token: refreshResult.accessToken,
            type: 'user' as const,
            expiresAt: refreshResult.expiresAt ?? null,
          }
        }

        return {
          token: userToken.accessToken,
          type: 'user',
          expiresAt: userToken.expiresAt,
        }
      }
      // Organization installation - use installation token
      const installationToken = await generateInstallationToken(installation.installationId)
      return {
        token: installationToken,
        type: 'installation',
        // Installation tokens expire after 1 hour
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      }
    }

    // No installation found - check for user token as fallback
    const userToken = await db.query.githubUserToken.findFirst({
      where: eq(githubUserToken.organizationId, organizationId),
    })

    if (!userToken) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message:
          'GitHub not connected. Please install the GitHub App or complete OAuth authorization.',
      })
    }

    // Check if token is expired and refresh if needed
    if (userToken.expiresAt && userToken.expiresAt < new Date()) {
      const refreshResult = await refreshGitHubUserToken(db, userToken)
      return {
        token: refreshResult.accessToken,
        type: 'user' as const,
        expiresAt: refreshResult.expiresAt ?? null,
      }
    }

    return {
      token: userToken.accessToken,
      type: 'user',
      expiresAt: userToken.expiresAt,
    }
  } catch (error) {
    // Don't log UNAUTHORIZED errors as they are expected when GitHub is not connected
    if (error instanceof TRPCError && error.code === 'UNAUTHORIZED') {
      throw error
    }

    if (error instanceof TRPCError) {
      throw error
    }
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to get GitHub authentication token',
    })
  }
}
