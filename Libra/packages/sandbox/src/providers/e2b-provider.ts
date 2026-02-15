/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * providers/e2b-provider.ts
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

import { tryCatch } from '@libra/common'
import Sandbox from 'e2b'
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

/**
 * E2B sandbox provider implementation
 */
export class E2BSandboxProvider extends BaseSandboxProvider {
  readonly providerType = 'e2b'

  protected async doInitialize(config: ProviderConfig): Promise<void> {
    // E2B initialization is handled through environment variables
    // Validate that E2B is available
    if (!(await this.isAvailable())) {
      throw new SandboxError(
        SandboxErrorType.CONFIGURATION_ERROR,
        'E2B is not available or not properly configured'
      )
    }
  }

  async create(config: SandboxConfig): Promise<ISandbox> {
    this.ensureInitialized()

    const [container, error] = await tryCatch(async () =>
      Sandbox.create(config.template, {
        timeoutMs: config.timeoutMs,
        envs: config.env,
      })
    )

    if (error) {
      throw new SandboxError(
        SandboxErrorType.CREATION_FAILED,
        `Failed to create E2B sandbox: ${error.message}`,
        undefined,
        error
      )
    }

    return new E2BSandbox(container.sandboxId, container)
  }

  async connect(sandboxId: string, options?: SandboxConnectOptions): Promise<ISandbox> {
    this.ensureInitialized()

    const [container, error] = await tryCatch(async () => Sandbox.connect(sandboxId))

    if (error) {
      throw new SandboxError(
        SandboxErrorType.CONNECTION_FAILED,
        `Failed to connect to E2B sandbox: ${error.message}`,
        sandboxId,
        error
      )
    }

    return new E2BSandbox(sandboxId, container)
  }

  async resume(sandboxId: string, options?: SandboxConnectOptions): Promise<ISandbox> {
    this.ensureInitialized()

    const [container, error] = await tryCatch(async () =>
      Sandbox.resume(sandboxId, {
        timeoutMs: options?.timeoutMs,
      })
    )

    if (error) {
      throw new SandboxError(
        SandboxErrorType.CONNECTION_FAILED,
        `Failed to resume E2B sandbox: ${error.message}`,
        sandboxId,
        error
      )
    }

    return new E2BSandbox(sandboxId, container)
  }

  async list(): Promise<SandboxInfo[]> {
    this.ensureInitialized()

    const [paginator, error] = await tryCatch(async () => Sandbox.list())

    if (error) {
      throw new SandboxError(
        SandboxErrorType.PROVIDER_ERROR,
        `Failed to list E2B sandboxes: ${error.message}`,
        undefined,
        error
      )
    }

    const sandboxes: any[] = []
    for await (const sandbox of paginator as any) {
      sandboxes.push({
        id: sandbox.id,
        status: this.mapE2BStatus(sandbox.status),
        template: sandbox.template || 'unknown',
        createdAt: new Date(sandbox.createdAt || Date.now()),
        lastActiveAt: sandbox.lastActiveAt ? new Date(sandbox.lastActiveAt) : undefined,
        metadata: sandbox.metadata,
      })
    }

    return sandboxes
  }

  async terminate(
    sandboxId: string,
    options?: SandboxTerminationOptions
  ): Promise<SandboxCleanupResult> {
    this.ensureInitialized()

    if (!sandboxId || sandboxId.startsWith('pending-')) {
      return {
        success: true,
        sandboxId,
        error: 'Placeholder container ID, no actual sandbox to terminate',
      }
    }

    const [result, error] = await tryCatch(async () =>
      Sandbox.kill(sandboxId, {
        requestTimeoutMs: options?.timeoutMs || 30_000,
      })
    )

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

    const sandboxes = await this.list()
    const sandbox = sandboxes.find((s) => s.id === sandboxId)

    if (!sandbox) {
      throw new SandboxError(
        SandboxErrorType.PROVIDER_ERROR,
        `Sandbox ${sandboxId} not found`,
        sandboxId
      )
    }

    return sandbox
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Try to list sandboxes to check if E2B is available
      await Sandbox.list({ requestTimeoutMs: 5000 })
      return true
    } catch {
      return false
    }
  }

  private mapE2BStatus(status: any): SandboxStatus {
    // Map E2B status to our standard status
    switch (status) {
      case 'running':
        return SandboxStatus.RUNNING
      case 'stopped':
        return SandboxStatus.STOPPED
      case 'error':
        return SandboxStatus.ERROR
      default:
        return SandboxStatus.RUNNING
    }
  }
}

/**
 * E2B sandbox instance implementation
 */
export class E2BSandbox extends BaseSandbox {
  constructor(
    id: string,
    private container: any
  ) {
    super(id, 'e2b')
  }

  async getInfo(): Promise<SandboxInfo> {
    return {
      id: this.id,
      status: SandboxStatus.RUNNING, // E2B connected instances are typically running
      template: 'unknown', // E2B doesn't expose template info on instance
      createdAt: new Date(), // Approximate
      metadata: {},
    }
  }

  async executeCommand(command: string, options?: CommandOptions): Promise<CommandResult> {
    const [result, error] = await tryCatch(async () =>
      this.container.commands.run(command, {
        onStderr: options?.onStderr,
        timeoutMs: options?.timeoutMs,
        cwd: options?.workingDirectory,
      })
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
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      exitCode: result.exitCode || 0,
    }
  }

  async writeFile(file: SandboxFile): Promise<FileOperationResult> {
    const [, error] = await tryCatch(async () =>
      this.container.files.write([
        {
          path: file.path,
          data: file.content,
        },
      ])
    )

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
    const fileData = files.map((file) => ({
      path: file.path,
      data: file.content,
    }))

    const [, error] = await tryCatch(async () => this.container.files.write(fileData))

    if (error) {
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
    const [content, error] = await tryCatch(async () => this.container.files.read(path))

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
    const [files, error] = await tryCatch(async () => this.container.files.list(path))

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
    const [, error] = await tryCatch(async () => this.container.files.remove(path))

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
      await this.container.files.read(path)
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
    const exists = await this.fileExists(path)
    return { exists }
  }

  async setEnvironmentVariables(env: Record<string, string>): Promise<void> {
    // E2B doesn't support runtime environment variable changes
    // This would need to be set during sandbox creation
    throw new SandboxError(
      SandboxErrorType.PROVIDER_ERROR,
      'E2B does not support runtime environment variable changes',
      this.id
    )
  }

  async getEnvironmentVariables(): Promise<Record<string, string>> {
    // E2B doesn't expose environment variables
    return {}
  }

  async terminate(options?: SandboxTerminationOptions): Promise<SandboxCleanupResult> {
    const [, error] = await tryCatch(async () => this.container.kill())

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
    // E2B handles keep-alive automatically
    // This is a no-op for E2B
  }

  getHost(port: number): string {
    // Delegate to the native E2B container instance
    return this.container.getHost(port)
  }

  async getPreviewInfo(port: number): Promise<{ url: string; token?: string }> {
    // E2B doesn't require authentication tokens for preview URLs
    // Just return the host URL from the native getHost method
    return {
      url: this.getHost(port),
      token: undefined,
    }
  }

  getNativeInstance(): any {
    return this.container
  }
}
