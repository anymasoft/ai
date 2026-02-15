/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * types/index.ts
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
 * Supported sandbox providers
 */
export type SandboxProviderType = 'e2b' | 'daytona'

/**
 * Sandbox status enumeration
 */
export enum SandboxStatus {
  CREATING = 'creating',
  RUNNING = 'running',
  STOPPED = 'stopped',
  ERROR = 'error',
  TERMINATED = 'terminated',
}

/**
 * File information for sandbox operations
 */
export interface SandboxFile {
  path: string
  content: string
  isBinary?: boolean
  encoding?: 'utf8' | 'base64'
}

/**
 * Command execution result
 */
export interface CommandResult {
  stdout: string
  stderr: string
  exitCode: number
  duration?: number
}

/**
 * Command execution options
 */
export interface CommandOptions {
  timeoutMs?: number
  workingDirectory?: string
  env?: Record<string, string>
  onStdout?: (data: string) => void
  onStderr?: (data: string) => void
}

/**
 * Sandbox configuration
 */
export interface SandboxConfig {
  template: string
  timeoutMs?: number
  env?: Record<string, string>
  resources?: {
    memory?: number // MB
    cpu?: number
    disk?: number // MB
  }
  network?: {
    enabled?: boolean
    allowedDomains?: string[]
    blockedPorts?: number[]
  }
}

/**
 * Sandbox creation options
 */
export interface SandboxCreateOptions extends SandboxConfig {
  provider: SandboxProviderType
}

/**
 * Sandbox connection options
 */
export interface SandboxConnectOptions {
  timeoutMs?: number
  retryCount?: number
  maxRetries?: number
}

/**
 * Sandbox information
 */
export interface SandboxInfo {
  id: string
  status: SandboxStatus
  template: string
  createdAt: Date
  lastActiveAt?: Date
  resources?: {
    memory: number
    cpu: number
    disk: number
  }
  metadata?: Record<string, any>
}

/**
 * Sandbox termination options
 */
export interface SandboxTerminationOptions {
  timeoutMs?: number
  retryCount?: number
  maxRetries?: number
  force?: boolean
}

/**
 * Sandbox cleanup result
 */
export interface SandboxCleanupResult {
  success: boolean
  sandboxId: string
  error?: string
}

/**
 * File system operation result
 */
export interface FileOperationResult {
  success: boolean
  path?: string
  error?: string
}

/**
 * Batch file operation result
 */
export interface BatchFileOperationResult {
  success: boolean
  results: FileOperationResult[]
  totalFiles: number
  successCount: number
  errorCount: number
}

/**
 * Provider configuration
 */
export interface ProviderConfig {
  type: SandboxProviderType
  apiKey?: string
  apiUrl?: string
  timeout?: number
  retries?: number
  [key: string]: any
}

/**
 * Sandbox factory configuration
 */
export interface SandboxFactoryConfig {
  defaultProvider: SandboxProviderType
  providers: {
    e2b?: ProviderConfig
    daytona?: ProviderConfig
  }
}

/**
 * Error types for sandbox operations
 */
export enum SandboxErrorType {
  CREATION_FAILED = 'creation_failed',
  CONNECTION_FAILED = 'connection_failed',
  COMMAND_FAILED = 'command_failed',
  FILE_OPERATION_FAILED = 'file_operation_failed',
  TERMINATION_FAILED = 'termination_failed',
  TIMEOUT = 'timeout',
  PROVIDER_ERROR = 'provider_error',
  CONFIGURATION_ERROR = 'configuration_error',
}

/**
 * Sandbox operation error
 */
export class SandboxError extends Error {
  constructor(
    public type: SandboxErrorType,
    message: string,
    public sandboxId?: string,
    public originalError?: Error
  ) {
    super(message)
    this.name = 'SandboxError'
  }
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxRetries: number
  delay: number
  backoff: 'linear' | 'exponential'
  retryableErrors?: SandboxErrorType[]
}
