/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * sync.ts
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

import { buildFiles as buildFilesWithHistory } from '@libra/common'
import { connectToSandbox, DEPLOYMENT_CONFIG } from '../../utils/deployment'
import { isExcludedFile } from '../../utils/common'
import type { DeploymentContext, SyncResult } from '../../types'

/**
 * Sync-specific timeout configuration
 */
const SYNC_TIMEOUTS = {
  SYNC: 60000, // 1 minute
  COMMAND: 30000 // 30 seconds
}

/**
 * Sync files to sandbox
 * Migrated from original DeploymentWorkflow.syncFiles
 */
export async function syncFiles(context: DeploymentContext): Promise<SyncResult> {
  const { params, logger, state } = context
  const { projectId } = params

  // Get sandbox info from previous step
  const sandboxResult = state.stepResults.sandbox
  if (!sandboxResult?.data?.sandboxId) {
    throw new Error('Sandbox ID not found from sandbox creation step')
  }

  // Get initFiles and historyMessages from validation step
  const validationResult = state.stepResults.validation
  if (!validationResult?.data?.initFiles || !validationResult?.data?.historyMessages) {
    throw new Error('initFiles and historyMessages not found from validation step')
  }

  const sandboxId = sandboxResult.data.sandboxId
  const { initFiles, historyMessages } = validationResult.data

  logger.info('Starting file sync to sandbox', {
    sandboxId,
    projectId,
    hasInitFiles: !!initFiles,
    hasHistoryMessages: !!historyMessages,
    initFilesCount: Object.keys(initFiles).length,
    historyMessagesCount: historyMessages.length
  })

  // Connect to the sandbox
  const sandbox = await connectToSandbox(sandboxId)

  // Build files with history
  logger.info('Building files with history')
  const buildResult = buildFilesWithHistory(initFiles, historyMessages)

  if (!buildResult || !buildResult.fileMap) {
    throw new Error('No files to sync - build files returned empty result')
  }

  const { fileMap } = buildResult

  logger.info('Files built successfully', {
    fileCount: Object.keys(fileMap).length
  })

  // Prepare files for sandbox
  const filesToWrite = Object.entries(fileMap)
    .filter(([path]) => !isExcludedFile(path))
    .map(([path, fileInfo]) => ({
      path: `${DEPLOYMENT_CONFIG.PROJECT_PATH}/${path}`,
      content: fileInfo.type === 'file' && !fileInfo.isBinary
        ? fileInfo.content
        : JSON.stringify(fileInfo.content),
      isBinary: false
    }))

  logger.info('Prepared files for sync', {
    totalFiles: Object.keys(fileMap).length,
    filesToWrite: filesToWrite.length,
    excludedFiles: Object.keys(fileMap).length - filesToWrite.length
  })

  // Write files to sandbox using the abstraction layer
  const result = await sandbox.writeFiles(filesToWrite)

  // Check for errors in the result
  if (!result.success) {
    const errorDetails = result.results
      .filter((r) => !r.success)
      .map((r) => `${r.path || 'unknown'}: ${r.error || 'Unknown error'}`)
      .join(', ')
    throw new Error(`Failed to sync files: ${errorDetails}`)
  }

  const filesSynced = result.successCount
  const syncedFiles = result.results
    .filter((r) => r.success)
    .map((r) => r.path || 'unknown')

  logger.info('File sync completed', {
    filesSynced,
    totalFiles: result.totalFiles,
    successCount: result.successCount,
    errorCount: result.errorCount,
    syncedFiles: syncedFiles.slice(0, 10) // Log first 10 files
  })

  if (result.errorCount > 0) {
    logger.warn('Some files failed to sync', {
      errorCount: result.errorCount,
      errors: result.results
        .filter((r) => !r.success)
        .map((r) => ({ path: r.path || 'unknown', error: r.error }))
    })
  }

  const buildReady = result.successCount > 0

  return {
    success: true,
    duration: 0, // Will be set by workflow
    data: {
      filesSynced,
      buildReady,
      syncedFiles
    }
  }
}
