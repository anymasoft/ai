/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * validate.ts
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

import { project, getDbForHono } from '@libra/db'
import { checkAndUpdateDeployUsageForWorkflow } from '../../utils/deploy-quota'
import { getDynamicDeploymentTemplate, DEPLOYMENT_CONFIG } from '@libra/sandbox'
import { templateConfigs } from '@libra/templates'
import { eq, and } from 'drizzle-orm'
import type { DeploymentContext, ValidationResult } from '../../types'

// Parse message history from JSON string
function parseMessageHistory(messageHistory: string | null) {
  try {
    return JSON.parse(messageHistory || '[]')
  } catch (error) {
    return []
  }
}

/**
 * Validation-specific timeout configuration
 */
const VALIDATION_TIMEOUT = 600000 // 10 minutes

/**
 * Validate permissions and prepare deployment configuration
 * Migrated from original DeploymentWorkflow.validateAndPrepare
 */
export async function validateAndPrepare(context: DeploymentContext): Promise<ValidationResult> {
  const { params, env, logger } = context
  const { projectId, customDomain, orgId, userId } = params

  logger.info('Starting validation and preparation', {
    projectId,
    userId,
    organizationId: orgId,
    hasCustomDomain: !!customDomain
  })

  // Validate required parameters
  if (!projectId || !orgId || !userId) {
    throw new Error('Missing required parameters: projectId, orgId, userId')
  }

  // Validate Cloudflare credentials
  if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_API_TOKEN) {
    throw new Error('Missing Cloudflare credentials')
  }

  // Check and deduct deploy quota FIRST to avoid duplicate deductions during retries
  logger.info('Checking deploy quota', {
    organizationId: orgId
  })

  const hasQuota = await checkAndUpdateDeployUsageForWorkflow(orgId, env)
  if (!hasQuota) {
    throw new Error(`Deploy quota exhausted for organization ${orgId}. Please upgrade your plan or wait for quota reset.`)
  }

  logger.info('Deploy quota deducted successfully', {
    organizationId: orgId
  })

  // Get database connection and validate project
  const db = await getDbForHono({ env })
  const projectData = await db.select().from(project)
    .where(and(eq(project.id, projectId), eq(project.organizationId, orgId)))
    .limit(1)

  if (!projectData?.[0]?.isActive) {
    throw new Error(`Project ${projectId} not found or inactive`)
  }

  logger.info('Project validation successful', {
    projectId,
    projectName: projectData[0].name
  })

  // Get template configuration
  const template = getDynamicDeploymentTemplate()
  const initFiles = templateConfigs.vite || {}

  // Parse message history from project data
  const historyMessages = parseMessageHistory(projectData[0].messageHistory)

  // Prepare deployment configuration
  const deploymentConfig = {
    projectId,
    workerName: `${projectId}-worker`,
    customDomain,
    template,
    timeout: VALIDATION_TIMEOUT
  }

  logger.info('Deployment configuration prepared', {
    workerName: deploymentConfig.workerName,
    template: deploymentConfig.template,
    timeout: deploymentConfig.timeout,
    initFilesCount: Object.keys(initFiles).length,
    historyMessagesCount: historyMessages.length
  })

  return {
    success: true,
    duration: 0, // Will be set by workflow
    data: {
      projectData: projectData[0],
      deploymentConfig,
      initFiles,
      historyMessages
    }
  }
}
