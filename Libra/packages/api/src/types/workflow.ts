/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * workflow.ts
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

/**
 * Deployment parameters passed to the workflow
 */
export interface DeploymentParams {
  projectId: string;
  customDomain?: string;
  orgId: string;
  userId: string;
  initFiles: any;
  historyMessages: any;
}

/**
 * Step result types for state persistence
 */
export interface ValidationResult {
  projectData: any;
  deploymentConfig: {
    projectId: string;
    workerName: string;
    customDomain?: string;
    template: string;
    timeout: number;
  };
}

export interface SandboxResult {
  sandboxId: string;
  sandboxInfo: any;
}

export interface SyncResult {
  filesSynced: number;
  buildReady: boolean;
}

export interface BuildResult {
  buildSuccess: boolean;
  buildOutput: string;
}

export interface DeployResult {
  workerUrl: string;
  deploymentSuccess: boolean;
}

export interface CleanupResult {
  databaseUpdated: boolean;
  sandboxCleaned: boolean;
}

/**
 * Workflow status types
 */
export type WorkflowStatus = 
  | "queued"
  | "running"
  | "paused"
  | "errored"
  | "terminated"
  | "complete"
  | "waiting"
  | "waitingForPause"
  | "unknown";

export interface WorkflowInstanceStatus {
  status: WorkflowStatus;
  error?: string;
  output?: object;
}

/**
 * Deployment workflow result
 */
export interface DeploymentWorkflowResult {
  success: boolean;
  workerUrl: string;
  message: string;
}
