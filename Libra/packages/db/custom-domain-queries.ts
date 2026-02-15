/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * custom-domain-queries.ts
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

import { eq, and, or } from 'drizzle-orm'
import { tryCatch } from '@libra/common'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { project } from './schema/project-schema'
import type { schema } from './index'

// Type for the database instance (using node-postgres only)
type DatabaseInstance = NodePgDatabase<typeof schema>

// Custom domain project type based on actual schema
export interface CustomDomainProject {
  id: string
  name: string
  customDomain: string | null
  customDomainStatus: 'pending' | 'verified' | 'active' | 'failed' | null
  productionDeployUrl: string | null
  isActive: boolean
}

export interface DatabaseQueryResult {
  success: boolean
  project?: CustomDomainProject
  error?: string
}

/**
 * Get project information by custom domain using Drizzle ORM
 * @param db Drizzle database instance
 * @param customDomain The custom domain to search for
 * @returns Project information if found and verified
 */
export async function getProjectByCustomDomain(
  db: DatabaseInstance,
  customDomain: string
): Promise<DatabaseQueryResult> {
  console.log(`[DB Query] Starting Drizzle ORM query for custom domain: ${customDomain}`)

  const [result, error] = await tryCatch(async () => {
    console.log(`[DB Query] Executing Drizzle query with domain: ${customDomain}`)

    // Use Drizzle ORM to query the project table
    const projectResults = await db
      .select({
        id: project.id,
        name: project.name,
        customDomain: project.customDomain,
        customDomainStatus: project.customDomainStatus,
        productionDeployUrl: project.productionDeployUrl,
        isActive: project.isActive,
      })
      .from(project)
      .where(
        and(
          eq(project.customDomain, customDomain),
          eq(project.isActive, true),
          // Only return verified or active domains
          or(
            eq(project.customDomainStatus, 'verified'),
            eq(project.customDomainStatus, 'active')
          )
        )
      )
      .limit(1)

    console.log('[DB Query] Drizzle ORM query result:', {
      found: projectResults.length > 0,
      resultCount: projectResults.length,
      projectData: projectResults[0] || null
    })

    if (projectResults.length === 0) {
      return {
        success: false,
        error: 'Custom domain not found or not verified'
      }
    }

    const projectRecord = projectResults[0]!
    
    // Map result to our interface
    const projectResult: CustomDomainProject = {
      id: projectRecord.id,
      name: projectRecord.name,
      customDomain: projectRecord.customDomain || '',
      customDomainStatus: projectRecord.customDomainStatus || 'pending',
      productionDeployUrl: projectRecord.productionDeployUrl || '',
      isActive: projectRecord.isActive,
    }

    // Validate required fields
    if (!projectResult.productionDeployUrl) {
      return {
        success: false,
        error: 'Project production deploy URL not configured'
      }
    }

    return {
      success: true,
      project: projectResult
    }
  })

  if (error) {
    console.error('[DB Query] Error querying custom domain with Drizzle ORM:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Database query failed'
    }
  }

  return result
}

/**
 * Validate if a custom domain is properly configured and verified
 * @param project Project data from database
 * @returns Validation result
 */
export function validateCustomDomainProject(project: CustomDomainProject): {
  valid: boolean
  error?: string
} {
  // Check if project is active
  if (!project.isActive) {
    return {
      valid: false,
      error: 'Project is not active'
    }
  }
  
  // Check if custom domain status is verified or active
  if (!project.customDomainStatus || !['verified', 'active'].includes(project.customDomainStatus)) {
    return {
      valid: false,
      error: 'Custom domain is not verified'
    }
  }
  
  // Check if production deploy URL is configured
  if (!project.productionDeployUrl) {
    return {
      valid: false,
      error: 'Production deploy URL not configured'
    }
  }
  
  // Validate production deploy URL format
  try {
    new URL(project.productionDeployUrl)
  } catch {
    return {
      valid: false,
      error: 'Invalid production deploy URL format'
    }
  }
  
  return { valid: true }
} 