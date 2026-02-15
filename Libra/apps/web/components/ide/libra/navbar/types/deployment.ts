/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * deployment.ts
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

export interface DeploymentStage {
  stage: string
  duration: number
}

export interface DeploymentCheck {
  name: string
  status: 'pending' | 'checking' | 'success' | 'warning' | 'error'
  message?: string
}

// Enhanced deployment status for better UX
export enum DeploymentStatus {
  PREVIEW = 'preview',           // URL is generated but not deployed yet
  PREPARING = 'preparing',       // Deployment is being prepared
  DEPLOYING = 'deploying',       // Deployment is in progress
  DEPLOYED = 'deployed',         // Deployment completed successfully
  LIVE = 'live',                 // URL is verified to be accessible
  FAILED = 'failed',             // Deployment failed
  EXISTING = 'existing'          // Project has existing deployment
}

export interface DeploymentStatusInfo {
  status: DeploymentStatus
  message?: string
  timestamp?: string
  isAccessible?: boolean
}

export interface DeploymentProgress {
  progress: number
  stage: string
  isDeploying: boolean
}

export interface DeploymentConfig {
  stages: DeploymentStage[]
  checkTimeout?: number
  progressUpdateInterval?: number
}

export interface UseDeploymentReturn {
  isDeploying: boolean
  deployProgress: number
  deployStage: string
  showDeployDialog: boolean
  setShowDeployDialog: (show: boolean) => void
  handleDeployClick: () => void
  handleDeployConfirm: () => Promise<void>
  deployResult: { workerUrl?: string; message?: string } | null
  existingDeployUrl?: string
  customDomainStatus?: CustomDomainStatus
  handleSetCustomDomain: (domain: string) => Promise<void>
  handleVerifyCustomDomain: () => Promise<void>
  handleRemoveCustomDomain: () => Promise<void>
  isCustomDomainLoading: boolean
  // Workflow-related fields
  workflowId: string | null
  workflowStatus: WorkflowInstanceStatus | null
  isPollingStatus: boolean
  pollingCount: number
  errorCount: number
  isCircuitBreakerOpen: boolean
}

/**
 * Enhanced deployment result with better type safety
 */
export interface DeploymentResult {
  workerUrl?: string
  message?: string
  deploymentId?: string
  timestamp?: string
  duration?: number
}

/**
 * Deployment error with structured information
 */
export interface DeploymentError {
  name: string
  message: string
  code?: string
  details?: Record<string, unknown>
  timestamp?: string
  recoverable?: boolean
}

/**
 * Enhanced deployment dialog props with better type safety
 */
export interface DeployConfirmationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => Promise<void>
  projectId: string
  isDeploying: boolean
  deployProgress?: number
  deployStage?: string
  deployResult?: DeploymentResult | null
  existingUrl?: string
  customDomainStatus?: CustomDomainStatus
  onSetCustomDomain?: (domain: string) => Promise<void>
  onVerifyCustomDomain?: () => Promise<void>
  onRemoveCustomDomain?: () => Promise<void>
  isCustomDomainLoading?: boolean
  // Enhanced status support
  deploymentStatus?: DeploymentStatusInfo
  // Error handling
  error?: DeploymentError | null
  onErrorDismiss?: () => void
}

export interface OwnershipVerification {
  type: string
  name: string
  value: string
}

export interface CustomDomainStatus {
  customDomain?: string | null
  status?: 'pending' | 'verified' | 'active' | 'failed' | null
  verifiedAt?: string | null
  customHostnameId?: string | null
  dcvVerificationId?: string | null
  ownershipVerification?: OwnershipVerification | null
  sslStatus?: 'pending' | 'pending_validation' | 'active' | 'failed' | null
}

// Direct API deployment types
export interface DeploymentApiRequest {
  projectId: string
  customDomain?: string
  orgId: string
  userId: string
}

export interface DeploymentApiResponse {
  success: boolean
  workerUrl?: string
  message?: string
  error?: string
  // Workflow-specific fields
  id?: string // Workflow instance ID
  details?: WorkflowInstanceStatus
}

// Cloudflare Workflow types (matching worker-configuration.d.ts InstanceStatus)
export interface WorkflowInstanceStatus {
  status: 'queued' | 'running' | 'paused' | 'errored' | 'terminated' | 'complete' | 'waiting' | 'waitingForPause' | 'unknown'
  error?: string
  output?: {
    workerUrl?: string
    message?: string
    [key: string]: any
  }
}

export interface WorkflowStatusResponse {
  status: WorkflowInstanceStatus
  error?: string
}
