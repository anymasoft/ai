/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * providers/daytona-provider.ts
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

import { Daytona, type DaytonaConfig, type Sandbox } from '@daytonaio/sdk'
import { tryCatch } from '@libra/common'
import { BaseSandbox, BaseSandboxProvider, type ISandbox } from '../interfaces/sandbox-provider'
import {
  type BatchFileOperationResult,
  type CommandOptions,
  type CommandResult,
  type FileOperationResult,
  type ProviderConfig,
  type SandboxCleanupResult,
  type SandboxConfig,
  type SandboxConnectOptions,
  SandboxError,
  SandboxErrorType,
  type SandboxFile,
  type SandboxInfo,
  SandboxStatus,
  type SandboxTerminationOptions,
} from '../types'
import { Buffer } from 'node:buffer';

/**
 * Daytona sandbox provider implementation
 * Uses the official Daytona TypeScript SDK
 */
export class DaytonaSandboxProvider extends BaseSandboxProvider {
  readonly providerType = 'daytona'
  private client?: Daytona

  protected async doInitialize(config: ProviderConfig): Promise<void> {
    // Initialize Daytona client with configuration
    const daytonaConfig: DaytonaConfig = {
      apiKey: config.apiKey || process.env.DAYTONA_API_KEY,
      // apiUrl: config.apiUrl || process.env.DAYTONA_API_URL,
      // target: config.target || 'us',
    }

    this.client = new Daytona(daytonaConfig)

    if (!(await this.isAvailable())) {
      throw new SandboxError(
        SandboxErrorType.CONFIGURATION_ERROR,
        'Daytona is not available or not properly configured'
      )
    }
  }

  async create(config: SandboxConfig): Promise<ISandbox> {
    this.ensureInitialized()

    if (!this.client) {
      throw new SandboxError(SandboxErrorType.CONFIGURATION_ERROR, 'Daytona client not initialized')
    }

    const [sandbox, error] = await tryCatch(async () => {
      if (!this.client) {
        throw new Error('Client not initialized')
      }
      return this.client.create(
        {
          snapshot: config.template,
          envVars: config.env,
          public: true,
          autoDeleteInterval:0,
          autoStopInterval: config.timeoutMs ? Math.floor(config.timeoutMs / 60000) : 5, // Convert ms to minutes
          autoArchiveInterval: config.timeoutMs ? Math.floor(config.timeoutMs / 60000) + 5 : 15,
          ...(config.resources && {
            resources: {
              cpu: config.resources.cpu,
              memory: config.resources.memory,
              disk: config.resources.disk,
            },
          }),
        },
      )
    })

    if (error) {
      throw new SandboxError(
        SandboxErrorType.CREATION_FAILED,
        `Failed to create Daytona sandbox: ${error.message}`,
        undefined,
        error
      )
    }
    return new DaytonaSandbox(sandbox.id, sandbox)
  }

  async connect(sandboxId: string, _options?: SandboxConnectOptions): Promise<ISandbox> {
    this.ensureInitialized()

    if (!this.client) {
      throw new SandboxError(SandboxErrorType.CONFIGURATION_ERROR, 'Daytona client not initialized')
    }

    const [sandbox, error] = await tryCatch(async () => {
      if (!this.client) {
        throw new Error('Client not initialized')
      }
      return this.client.get(sandboxId)
    })
    console.log(`Sandbox state: ${sandbox?.state}`);

    if (error || !sandbox) {
      throw new SandboxError(
        SandboxErrorType.CONNECTION_FAILED,
        `Failed to connect to Daytona sandbox: ${error?.message || 'Sandbox not found'}`,
        sandboxId,
        error
      )
    }

    return new DaytonaSandbox(sandbox.id, sandbox)
  }

  async resume(sandboxId: string, _options?: SandboxConnectOptions): Promise<ISandbox> {
    this.ensureInitialized()

    if (!this.client) {
      throw new SandboxError(SandboxErrorType.CONFIGURATION_ERROR, 'Daytona client not initialized')
    }

    const [sandbox, error] = await tryCatch(async () => {
      if (!this.client) {
        throw new Error('Client not initialized')
      }

      // Use findOne to get the sandbox instance (following Daytona SDK best practices)
      const sandbox = await this.client.findOne({ id: sandboxId })

      if (!sandbox) {
        throw new Error(`Sandbox with ID ${sandboxId} not found`)
      }

      // Check if sandbox is in a valid state for resuming
      if (sandbox.state === 'build_failed' || sandbox.state === 'destroyed' || sandbox.state === 'destroying') {
        throw new Error(`Sandbox is in invalid state: ${sandbox.state}`)
      }

      // Only try to start if the sandbox is not already running
      // Use the sandbox instance method instead of client method (following SDK example)
      if (sandbox.state !== 'started') {
        await sandbox.start()
      }

      return sandbox
    })

    if (error || !sandbox) {
      // Provide more specific error information for debugging
      const errorMessage = error?.message || 'Sandbox not found'
      console.error(`Daytona resume failed for sandbox ${sandboxId}:`, {
        error: errorMessage,
        sandboxId,
        originalError: error
      })

      throw new SandboxError(
        SandboxErrorType.CONNECTION_FAILED,
        `Failed to resume Daytona sandbox: ${errorMessage}`,
        sandboxId,
        error
      )
    }

    return new DaytonaSandbox(sandbox.id, sandbox)
  }

  async list(): Promise<SandboxInfo[]> {
    this.ensureInitialized()

    if (!this.client) {
      throw new SandboxError(SandboxErrorType.CONFIGURATION_ERROR, 'Daytona client not initialized')
    }

    const [sandboxes, error] = await tryCatch(async () => {
      if (!this.client) {
        throw new Error('Client not initialized')
      }
      return this.client.list()
    })

    if (error) {
      throw new SandboxError(
        SandboxErrorType.PROVIDER_ERROR,
        `Failed to list Daytona sandboxes: ${error.message}`,
        undefined,
        error
      )
    }

    return sandboxes.map((sandbox) => ({
      id: sandbox.id,
      status: this.mapDaytonaStatus(sandbox.state),
      template: sandbox.snapshot || 'unknown',
      createdAt: new Date(sandbox.createdAt || Date.now()),
      lastActiveAt: sandbox.updatedAt ? new Date(sandbox.updatedAt) : undefined,
      resources: {
        cpu: sandbox.cpu,
        memory: sandbox.memory,
        disk: sandbox.disk,
      },
      metadata: sandbox.labels || {},
    }))
  }

  async terminate(
    sandboxId: string,
    _options?: SandboxTerminationOptions
  ): Promise<SandboxCleanupResult> {
    this.ensureInitialized()

    if (!this.client) {
      throw new SandboxError(SandboxErrorType.CONFIGURATION_ERROR, 'Daytona client not initialized')
    }

    const [, error] = await tryCatch(async () => {
      if (!this.client) {
        throw new Error('Client not initialized')
      }
      const sandbox = await this.client.findOne({ id: sandboxId })
      if (!sandbox) {
        throw new Error(`Sandbox with ID ${sandboxId} not found`)
      }
      // Use sandbox instance method for deletion
      await sandbox.delete()
    })

    if (error) {
      return {
        success: false,
        sandboxId,
        error: error.message || 'Unknown termination error',
      }
    }

    return {
      success: true,
      sandboxId,
    }
  }

  async getInfo(sandboxId: string): Promise<SandboxInfo> {
    this.ensureInitialized()

    if (!this.client) {
      throw new SandboxError(SandboxErrorType.CONFIGURATION_ERROR, 'Daytona client not initialized')
    }

    const [sandbox, error] = await tryCatch(async () => {
      if (!this.client) {
        throw new Error('Client not initialized')
      }
      return this.client.findOne({ id: sandboxId })
    })

    if (error) {
      throw new SandboxError(
        SandboxErrorType.PROVIDER_ERROR,
        `Sandbox ${sandboxId} not found: ${error.message}`,
        sandboxId,
        error
      )
    }

    return {
      id: sandbox.id,
      status: this.mapDaytonaStatus(sandbox.state),
      template: sandbox.snapshot || 'unknown',
      createdAt: new Date(sandbox.createdAt || Date.now()),
      lastActiveAt: sandbox.updatedAt ? new Date(sandbox.updatedAt) : undefined,
      resources: {
        cpu: sandbox.cpu,
        memory: sandbox.memory,
        disk: sandbox.disk,
      },
      metadata: sandbox.labels || {},
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      if (!this.client) return false
      // Try to list sandboxes to check if Daytona is available
      await this.client.list()
      return true
    } catch {
      return false
    }
  }

  private mapDaytonaStatus(status: any): SandboxStatus {
    // Map Daytona status to our standard status
    // This will need to be adjusted based on Daytona's actual status values
    switch (status) {
      case 'running':
      case 'active':
        return SandboxStatus.RUNNING
      case 'stopped':
      case 'inactive':
        return SandboxStatus.STOPPED
      case 'creating':
        return SandboxStatus.CREATING
      case 'error':
      case 'failed':
        return SandboxStatus.ERROR
      default:
        return SandboxStatus.RUNNING
    }
  }
}

/**
 * Daytona sandbox instance implementation
 */
export class DaytonaSandbox extends BaseSandbox {
  constructor(
    id: string,
    private sandbox: Sandbox
  ) {
    super(id, 'daytona')
  }

  async getInfo(): Promise<SandboxInfo> {
    // Refresh sandbox data to get latest state
    await this.sandbox.refreshData()

    return {
      id: this.sandbox.id,
      status: this.mapDaytonaStatus(this.sandbox.state),
      template: this.sandbox.snapshot || 'unknown',
      createdAt: new Date(this.sandbox.createdAt || Date.now()),
      lastActiveAt: this.sandbox.updatedAt ? new Date(this.sandbox.updatedAt) : undefined,
      resources: {
        cpu: this.sandbox.cpu,
        memory: this.sandbox.memory,
        disk: this.sandbox.disk,
      },
      metadata: this.sandbox.labels || {},
    }
  }

  private mapDaytonaStatus(status: any): SandboxStatus {
    // Map Daytona status to our standard status
    switch (status) {
      case 'started':
      case 'running':
        return SandboxStatus.RUNNING
      case 'stopped':
        return SandboxStatus.STOPPED
      case 'creating':
        return SandboxStatus.CREATING
      case 'error':
      case 'failed':
        return SandboxStatus.ERROR
      default:
        return SandboxStatus.RUNNING
    }
  }

  async executeCommand(command: string, options?: CommandOptions): Promise<CommandResult> {
    const [result, error] = await tryCatch(async () =>
      this.sandbox.process.executeCommand(
        command,
        options?.workingDirectory,
        options?.env,
        options?.timeoutMs ? Math.floor(options.timeoutMs / 1000) : undefined // Convert ms to seconds
      )
    )

    if (error) {
      throw new SandboxError(
        SandboxErrorType.COMMAND_FAILED,
        `Command execution failed: ${error.message}`,
        this.id,
        error
      )
    }

    return {
      stdout: result.artifacts?.stdout || result.result || '',
      stderr: '', // Daytona SDK doesn't separate stderr in ExecuteResponse
      exitCode: result.exitCode || 0,
    }
  }

  async writeFile(file: SandboxFile): Promise<FileOperationResult> {
    const [, error] = await tryCatch(async () => {
      const buffer = Buffer.from(file.content, (file.encoding as BufferEncoding) || 'utf8')
      await this.sandbox.fs.uploadFile(buffer, file.path)
    })

    if (error) {
      return {
        success: false,
        path: file.path,
        error: error.message,
      }
    }

    return {
      success: true,
      path: file.path,
    }
  }

  async writeFiles(files: SandboxFile[]): Promise<BatchFileOperationResult> {
    const fileUploads = files.map((file) => ({
      source: Buffer.from(file.content),
      destination: file.path,
    }))
    // const fileUploads = [
    //   {
    //     source: Buffer.from('Content of file 1'),
    //     destination: '/tmp/file1.txt'
    //   },
    //
    // ]
    const [, error] = await tryCatch(async () =>  this.sandbox.fs.uploadFiles(fileUploads))

    if (error) {
      // Log error for debugging but don't expose in response
      console.error('Daytona uploadFiles error:', error.message)
      return {
        success: false,
        results: files.map((file) => ({
          success: false,
          path: file.path,
          error: error.message,
        })),
        totalFiles: files.length,
        successCount: 0,
        errorCount: files.length,
      }
    }

    return {
      success: true,
      results: files.map((file) => ({
        success: true,
        path: file.path,
      })),
      totalFiles: files.length,
      successCount: files.length,
      errorCount: 0,
    }
  }

  async readFile(path: string): Promise<string> {
    const [content, error] = await tryCatch(async () => {
      const buffer = await this.sandbox.fs.downloadFile(path)
      return buffer.toString('utf8')
    })

    if (error) {
      throw new SandboxError(
        SandboxErrorType.FILE_OPERATION_FAILED,
        `Failed to read file ${path}: ${error.message}`,
        this.id,
        error
      )
    }

    return content
  }

  async listFiles(path: string): Promise<string[]> {
    const [files, error] = await tryCatch(async () => {
      const fileInfos = await this.sandbox.fs.listFiles(path)
      return fileInfos.map((info) => info.name)
    })

    if (error) {
      throw new SandboxError(
        SandboxErrorType.FILE_OPERATION_FAILED,
        `Failed to list files in ${path}: ${error.message}`,
        this.id,
        error
      )
    }

    return files || []
  }

  async deleteFile(path: string): Promise<FileOperationResult> {
    const [, error] = await tryCatch(async () => this.sandbox.fs.deleteFile(path))

    if (error) {
      return {
        success: false,
        path,
        error: error.message,
      }
    }

    return {
      success: true,
      path,
    }
  }

  async fileExists(path: string): Promise<boolean> {
    try {
      await this.sandbox.fs.getFileDetails(path)
      return true
    } catch {
      return false
    }
  }

  async getFileInfo(path: string): Promise<{
    exists: boolean
    size?: number
    modified?: Date
    isDirectory?: boolean
  }> {
    try {
      const fileInfo = await this.sandbox.fs.getFileDetails(path)
      return {
        exists: true,
        size: fileInfo.size,
        modified: fileInfo.modTime ? new Date(fileInfo.modTime) : undefined,
        isDirectory: fileInfo.isDir,
      }
    } catch {
      return { exists: false }
    }
  }

  async setEnvironmentVariables(_env: Record<string, string>): Promise<void> {
    // Daytona doesn't support runtime environment variable changes
    // Environment variables need to be set during sandbox creation
    throw new SandboxError(
      SandboxErrorType.PROVIDER_ERROR,
      'Daytona does not support runtime environment variable changes',
      this.id
    )
  }

  async getEnvironmentVariables(): Promise<Record<string, string>> {
    // Return the environment variables from the sandbox
    return this.sandbox.env || {}
  }

  async terminate(_options?: SandboxTerminationOptions): Promise<SandboxCleanupResult> {
    const [, error] = await tryCatch(async () => this.sandbox.delete())

    if (error) {
      return {
        success: false,
        sandboxId: this.id,
        error: error.message,
      }
    }

    return {
      success: true,
      sandboxId: this.id,
    }
  }

  async keepAlive(): Promise<void> {
    // Daytona sandboxes have auto-stop intervals that can be configured
    // We can refresh the sandbox data to keep it active
    await this.sandbox.refreshData()
  }

  getHost(port: number): string {
    // Daytona implementation for getting host address
    // Use the documented URL format: https://port-sandbox-id.runner.daytona.work
    try {
      const sandboxId = this.sandbox.id || this.id
      // Extract runner ID from sandbox data if available, otherwise use a placeholder
      const runnerId = (this.sandbox as any).runnerId || 'runner'
      const url = `https://${port}-${sandboxId}.${runnerId}.daytona.work`
      console.debug(`Constructed Daytona host URL: ${url}`)
      return url
    } catch (error) {
      console.error(`Failed to construct Daytona host URL for port ${port}:`, error)
      // Fallback to a basic URL format
      return `https://${port}-${this.id}.runner.daytona.work`
    }
  }

  async getPreviewInfo(port: number): Promise<{ url: string; token?: string }> {
    const [previewInfo, error] = await tryCatch(async () => {
      // Use the official Daytona SDK method to get preview link
      return await this.sandbox.getPreviewLink(port)
    })

    if (error) {
      console.warn(`Failed to get preview info for port ${port}, falling back to constructed URL:`, error)
      // Fallback to constructed URL if SDK method fails
      return {
        url: this.getHost(port),
        token: undefined,
      }
    }

    console.log("previewInfo:", previewInfo)
    return {
      url: previewInfo?.url,
      token: previewInfo?.token,
    }
  }

  getNativeInstance(): any {
    return this.sandbox
  }
}
