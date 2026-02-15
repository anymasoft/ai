/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * index.ts
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

import type { TRPCRouterRecord } from '@trpc/server'
import { basicOperations } from './basic-operations'
import { containerOperations } from './container-operations'
import { deploymentOperations } from './deployment-operations'
import { historyOperations } from './history-operations'
import { specialOperations } from './special-operations'
import { statusOperations } from './status-operations'

/**
 * Project router - aggregates all project-related operations
 * 
 * This router is organized into functional modules:
 * - basicOperations: CRUD operations (create, read, update, delete, list)
 * - containerOperations: Container and preview URL management
 * - historyOperations: Screenshot and message history management
 * - deploymentOperations: Deployment status and configuration
 * - statusOperations: Project and quota status queries
 * - specialOperations: Fork and hero project creation
 */
export const projectRouter = {
  // Basic CRUD operations
  create: basicOperations.create,
  update: basicOperations.update,
  updateProjectConfig: basicOperations.updateProjectConfig,
  updateProjectVisibility: basicOperations.updateProjectVisibility,
  delete: basicOperations.delete,
  list: basicOperations.list,
  getById: basicOperations.getById,

  // Container and preview operations
  updateContainerContent: containerOperations.updateContainerContent,
  getPreviewUrl: containerOperations.getPreviewUrl,

  // History and screenshot operations
  updateHistoryWithScreenshot: historyOperations.updateHistoryWithScreenshot,

  // Deployment operations
  updateDeploymentStatus: deploymentOperations.updateDeploymentStatus,
  getDeploymentStatus: deploymentOperations.getDeploymentStatus,

  // Status and quota operations
  getProjectStatus: statusOperations.getProjectStatus,
  getQuotaStatus: statusOperations.getQuotaStatus,

  // Special operations
  heroProjectCreate: specialOperations.heroProjectCreate,
  fork: specialOperations.fork,
} satisfies TRPCRouterRecord
