/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * build.ts
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

import { connectToSandbox, executeCommand, DEPLOYMENT_CONFIG } from '../../utils/deployment'
import type { DeploymentContext, BuildResult } from '../../types'

/**
 * Build-specific timeout configuration
 */
const BUILD_TIMEOUTS = {
  BUILD: 300000, // 5 minutes
  COMMAND: 30000 // 30 seconds
}

/**
 * Build project in sandbox
 * Migrated from original DeploymentWorkflow.buildProject
 */
export async function buildProject(context: DeploymentContext): Promise<BuildResult> {
  const { logger, state } = context

  // Get sandbox info from previous step
  const sandboxResult = state.stepResults.sandbox
  if (!sandboxResult?.data?.sandboxId) {
    throw new Error('Sandbox ID not found from sandbox creation step')
  }

  const sandboxId = sandboxResult.data.sandboxId

  logger.info('Starting project build', {
    sandboxId,
    projectPath: DEPLOYMENT_CONFIG.PROJECT_PATH
  })

  // Connect to the sandbox
  const container = await connectToSandbox(sandboxId)

  // Install dependencies
  logger.info('Installing dependencies')
  const installResult = await executeCommand(
    container,
    `cd ${DEPLOYMENT_CONFIG.PROJECT_PATH} && bun install`,
    BUILD_TIMEOUTS.BUILD,
    'Build'
  )

  logger.info('Dependencies installed successfully', {
    output: (installResult.stdout || '').slice(-200) // Log last 200 chars
  })

  // Build the project
  logger.info('Building project')
  const buildResult = await executeCommand(
    container,
    `cd ${DEPLOYMENT_CONFIG.PROJECT_PATH} && bun run build`,
    BUILD_TIMEOUTS.BUILD,
    'Build'
  )

  logger.info('Project built successfully', {
    output: (buildResult.stdout || '').slice(-200) // Log last 200 chars
  })

  // Verify build artifacts
  const distCheckResult = await executeCommand(
    container,
    `cd ${DEPLOYMENT_CONFIG.PROJECT_PATH} && ls -la dist/ || ls -la build/ || ls -la .next/ || echo "No standard build directory found"`,
    BUILD_TIMEOUTS.COMMAND,
    'Build'
  )

  logger.info('Build artifacts verification', {
    distCheck: (distCheckResult.stdout || '').slice(-300) // Log last 300 chars
  })

  // Check for wrangler.jsonc, wrangler.toml or package.json to ensure it's a valid project
  const projectCheckResult = await executeCommand(
    container,
    `cd ${DEPLOYMENT_CONFIG.PROJECT_PATH} && (ls wrangler.jsonc || ls wrangler.toml || ls package.json || echo "No project files found")`,
    BUILD_TIMEOUTS.COMMAND,
    'Build'
  )

  const buildOutput = buildResult.stdout || ''
  const projectCheckOutput = projectCheckResult.stdout || ''

  const buildSuccess = !buildOutput.toLowerCase().includes('error') &&
                      !buildOutput.toLowerCase().includes('failed') &&
                      (projectCheckOutput.includes('package.json') ||
                       projectCheckOutput.includes('wrangler.jsonc') ||
                       projectCheckOutput.includes('wrangler.toml'))

  if (!buildSuccess) {
    throw new Error(`Build failed. Output: ${buildOutput}`)
  }

  // Get list of build artifacts
  const artifacts: string[] = []
  try {
    const artifactsResult = await executeCommand(
      container,
      `cd ${DEPLOYMENT_CONFIG.PROJECT_PATH} && find . -name "*.js" -o -name "*.ts" -o -name "*.json" | head -20`,
      BUILD_TIMEOUTS.COMMAND,
      'Build'
    )
    const artifactsList = artifactsResult.stdout || ''
    artifacts.push(...artifactsList.split('\n').filter((line: string) => line.trim()))
  } catch (error) {
    logger.warn('Could not list build artifacts', {
      error: error instanceof Error ? error.message : String(error)
    })
  }

  logger.info('Build completed successfully', {
    buildSuccess,
    artifactCount: artifacts.length,
    artifacts: artifacts.slice(0, 10) // Log first 10 artifacts
  })

  return {
    success: true,
    duration: 0, // Will be set by workflow
    data: {
      buildSuccess,
      buildOutput,
      artifacts
    }
  }
}
