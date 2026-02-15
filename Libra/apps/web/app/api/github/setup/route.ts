/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * route.ts
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

import { getAuthDb } from '@libra/auth/db'
import { githubInstallation } from '@libra/auth/db/schema/github-schema'
import { validateAndConsumeNonce } from '@libra/auth/utils/nonce'
import { createId } from '@paralleldrive/cuid2'
import { eq } from 'drizzle-orm'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

// Handle GitHub App Setup URL callback
// This is called after a user completes the GitHub App installation
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const installationId = searchParams.get('installation_id')
    const setupAction = searchParams.get('setup_action')
    const state = searchParams.get('state')

    // Handle different setup actions
    if (setupAction === 'install' && !installationId) {
      return NextResponse.redirect(new URL('/github-error?reason=cancelled', request.url))
    }

    if (setupAction === 'update') {
      // Handle installation updates (repository selection changes, etc.)
    }

    // Validate required parameters
    if (!installationId) {
      return NextResponse.redirect(
        new URL('/github-error?reason=missing_installation_id', request.url)
      )
    }

    // Parse and validate state parameter
    let organizationId: string | null = null
    let userId: string | null = null
    let nonce: string | null = null

    if (state) {
      try {
        // Decode base64 state parameter
        const stateData = JSON.parse(Buffer.from(state, 'base64').toString())
        organizationId = stateData.organizationId
        userId = stateData.userId
        nonce = stateData.nonce

        // Validate nonce for replay protection if present
        if (nonce && organizationId) {
          const isNonceValid = await validateAndConsumeNonce(
            nonce,
            organizationId,
            userId || undefined
          )
          if (!isNonceValid) {
            return NextResponse.redirect(new URL('/github-error?reason=invalid_nonce', request.url))
          }
        }
      } catch (error) {
        return NextResponse.redirect(new URL('/github-error?reason=invalid_state', request.url))
      }
    }

    if (!organizationId) {
      return NextResponse.redirect(new URL('/github-error?reason=no_organization', request.url))
    }

    try {
      // Get installation details from GitHub API
      const GITHUB_APP_ID = process.env['GITHUB_APP_ID']
      const GITHUB_APP_PRIVATE_KEY = process.env['GITHUB_APP_PRIVATE_KEY']

      if (!GITHUB_APP_ID || !GITHUB_APP_PRIVATE_KEY) {
        throw new Error('GitHub App credentials not configured')
      }

      // Create GitHub App instance
      const { App } = await import('@octokit/app')
      const app = new App({
        appId: GITHUB_APP_ID,
        privateKey: GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, '\n'),
      })

      // Fetch installation details to verify and get account info
      const installation = await app.octokit.request('GET /app/installations/{installation_id}', {
        installation_id: Number.parseInt(installationId, 10),
      })

      const account = installation.data.account
      const accountLogin =
        account && 'login' in account ? account.login : account?.name || 'unknown'
      const accountType = account && 'type' in account ? account.type : 'Organization'

      // Store or update installation in database
      const db = await getAuthDb()

      // Check if installation already exists (from webhook or previous setup)
      const existingInstallation = await db.query.githubInstallation.findFirst({
        where: eq(githubInstallation.installationId, installation.data.id),
      })

      if (existingInstallation) {
        // Update the organization association and ensure it's active
        await db
          .update(githubInstallation)
          .set({
            organizationId: organizationId,
            isActive: true,
            permissions: JSON.stringify(installation.data.permissions || {}),
            repositorySelection: installation.data.repository_selection || 'all',
            updatedAt: new Date(),
          })
          .where(eq(githubInstallation.installationId, installation.data.id))
      } else {
        // Create new installation record
        await db.insert(githubInstallation).values({
          id: createId(),
          installationId: installation.data.id,
          organizationId: organizationId,
          githubAccountId: account?.id || 0,
          githubAccountLogin: accountLogin,
          githubAccountType: accountType,
          permissions: JSON.stringify(installation.data.permissions || {}),
          repositorySelection: installation.data.repository_selection || 'all',
          isActive: true,
          installedAt: new Date(installation.data.created_at),
        })
      }

      return NextResponse.redirect(new URL('/github-success', request.url))
    } catch (error) {
      return NextResponse.redirect(new URL('/github-error?reason=processing', request.url))
    }
  } catch (error) {
    return NextResponse.redirect(new URL('/github-error?reason=unexpected', request.url))
  }
}

// Note: Nonce storage is handled by the shared nonce store utility
// This route focuses on processing the GitHub App setup callback
