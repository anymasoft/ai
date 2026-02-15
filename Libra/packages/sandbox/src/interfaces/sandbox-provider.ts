/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * interfaces/sandbox-provider.ts
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

import type {
  BatchFileOperationResult,
  CommandOptions,
  CommandResult,
  FileOperationResult,
  ProviderConfig,
  SandboxCleanupResult,
  SandboxConfig,
  SandboxConnectOptions,
  SandboxFile,
  SandboxInfo,
  SandboxTerminationOptions,
} from '../types'

/**
 * Abstract interface for sandbox providers
 * This interface defines the contract that all sandbox providers must implement
 */
export interface ISandboxProvider {
  /**
   * Provider type identifier
   */
  readonly providerType: string

  /**
   * Initialize the provider with configuration
   */
  initialize(config: ProviderConfig): Promise<void>

  /**
   * Create a new sandbox instance
   */
  create(config: SandboxConfig): Promise<ISandbox>

  /**
   * Connect to an existing sandbox
   */
  connect(sandboxId: string, options?: SandboxConnectOptions): Promise<ISandbox>

  /**
   * Resume a stopped sandbox
   */
  resume(sandboxId: string, options?: SandboxConnectOptions): Promise<ISandbox>

  /**
   * List all sandboxes
   */
  list(): Promise<SandboxInfo[]>

  /**
   * Terminate a sandbox
   */
  terminate(sandboxId: string, options?: SandboxTerminationOptions): Promise<SandboxCleanupResult>

  /**
   * Get sandbox information
   */
  getInfo(sandboxId: string): Promise<SandboxInfo>

  /**
   * Check if provider is available and configured
   */
  isAvailable(): Promise<boolean>
}

/**
 * Interface for sandbox instances
 */
export interface ISandbox {
  /**
   * Sandbox unique identifier
   */
  readonly id: string

  /**
   * Provider type that created this sandbox
   */
  readonly providerType: string

  /**
   * Get sandbox information
   */
  getInfo(): Promise<SandboxInfo>

  /**
   * Execute a command in the sandbox
   */
  executeCommand(command: string, options?: CommandOptions): Promise<CommandResult>

  /**
   * Write a single file to the sandbox
   */
  writeFile(file: SandboxFile): Promise<FileOperationResult>

  /**
   * Write multiple files to the sandbox
   */
  writeFiles(files: SandboxFile[]): Promise<BatchFileOperationResult>

  /**
   * Read a file from the sandbox
   */
  readFile(path: string): Promise<string>

  /**
   * List files in a directory
   */
  listFiles(path: string): Promise<string[]>

  /**
   * Delete a file from the sandbox
   */
  deleteFile(path: string): Promise<FileOperationResult>

  /**
   * Check if a file exists
   */
  fileExists(path: string): Promise<boolean>

  /**
   * Get file information
   */
  getFileInfo(path: string): Promise<{
    exists: boolean
    size?: number
    modified?: Date
    isDirectory?: boolean
  }>

  /**
   * Set environment variables
   */
  setEnvironmentVariables(env: Record<string, string>): Promise<void>

  /**
   * Get current environment variables
   */
  getEnvironmentVariables(): Promise<Record<string, string>>

  /**
   * Terminate the sandbox
   */
  terminate(options?: SandboxTerminationOptions): Promise<SandboxCleanupResult>

  /**
   * Keep the sandbox alive (heartbeat)
   */
  keepAlive(): Promise<void>

  /**
   * Get the host address for the specified sandbox port
   * This allows external access to services running inside the sandbox
   */
  getHost(port: number): string

  /**
   * Get preview information for the specified sandbox port
   * Returns URL and authentication token (if applicable) for accessing the port
   */
  getPreviewInfo(port: number): Promise<{
    url: string
    token?: string
  }>

  /**
   * Get the native provider instance for advanced operations
   * This allows access to provider-specific features when needed
   */
  getNativeInstance(): any
}

/**
 * Base abstract class for sandbox providers
 * Provides common functionality and enforces interface implementation
 */
export abstract class BaseSandboxProvider implements ISandboxProvider {
  protected config?: ProviderConfig
  protected initialized = false

  abstract readonly providerType: string

  async initialize(config: ProviderConfig): Promise<void> {
    this.config = config
    await this.doInitialize(config)
    this.initialized = true
  }

  protected abstract doInitialize(config: ProviderConfig): Promise<void>

  abstract create(config: SandboxConfig): Promise<ISandbox>
  abstract connect(sandboxId: string, options?: SandboxConnectOptions): Promise<ISandbox>
  abstract resume(sandboxId: string, options?: SandboxConnectOptions): Promise<ISandbox>
  abstract list(): Promise<SandboxInfo[]>
  abstract terminate(
    sandboxId: string,
    options?: SandboxTerminationOptions
  ): Promise<SandboxCleanupResult>
  abstract getInfo(sandboxId: string): Promise<SandboxInfo>
  abstract isAvailable(): Promise<boolean>

  protected ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error(`Provider ${this.providerType} is not initialized`)
    }
  }
}

/**
 * Base abstract class for sandbox instances
 */
export abstract class BaseSandbox implements ISandbox {
  constructor(
    public readonly id: string,
    public readonly providerType: string
  ) {}

  abstract getInfo(): Promise<SandboxInfo>
  abstract executeCommand(command: string, options?: CommandOptions): Promise<CommandResult>
  abstract writeFile(file: SandboxFile): Promise<FileOperationResult>
  abstract writeFiles(files: SandboxFile[]): Promise<BatchFileOperationResult>
  abstract readFile(path: string): Promise<string>
  abstract listFiles(path: string): Promise<string[]>
  abstract deleteFile(path: string): Promise<FileOperationResult>
  abstract fileExists(path: string): Promise<boolean>
  abstract getFileInfo(path: string): Promise<{
    exists: boolean
    size?: number
    modified?: Date
    isDirectory?: boolean
  }>
  abstract setEnvironmentVariables(env: Record<string, string>): Promise<void>
  abstract getEnvironmentVariables(): Promise<Record<string, string>>
  abstract terminate(options?: SandboxTerminationOptions): Promise<SandboxCleanupResult>
  abstract keepAlive(): Promise<void>
  abstract getHost(port: number): string
  abstract getPreviewInfo(port: number): Promise<{
    url: string
    token?: string
  }>
  abstract getNativeInstance(): any
}
