/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * factory/sandbox-factory.ts
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

import type { ISandbox, ISandboxProvider } from '../interfaces/sandbox-provider'
import { DaytonaSandboxProvider } from '../providers/daytona-provider'
import { E2BSandboxProvider } from '../providers/e2b-provider'
import {
  type ProviderConfig,
  type SandboxConnectOptions,
  type SandboxCreateOptions,
  SandboxError,
  SandboxErrorType,
  type SandboxFactoryConfig,
  type SandboxProviderType,
} from '../types'

/**
 * Sandbox factory for creating and managing sandbox providers
 */
export class SandboxFactory {
  private providers = new Map<SandboxProviderType, ISandboxProvider>()
  private config: SandboxFactoryConfig

  constructor(config: SandboxFactoryConfig) {
    this.config = config
  }

  /**
   * Initialize the factory with providers
   */
  async initialize(): Promise<void> {
    // Initialize E2B provider if configured
    if (this.config.providers.e2b) {
      const e2bProvider = new E2BSandboxProvider()
      await e2bProvider.initialize(this.config.providers.e2b)
      this.providers.set('e2b', e2bProvider)
    }

    // Initialize Daytona provider if configured
    if (this.config.providers.daytona) {
      const daytonaProvider = new DaytonaSandboxProvider()
      await daytonaProvider.initialize(this.config.providers.daytona)
      this.providers.set('daytona', daytonaProvider)
    }

    // Ensure at least one provider is available
    if (this.providers.size === 0) {
      throw new SandboxError(
        SandboxErrorType.CONFIGURATION_ERROR,
        'No sandbox providers configured'
      )
    }

    // Validate default provider
    if (!this.providers.has(this.config.defaultProvider)) {
      throw new SandboxError(
        SandboxErrorType.CONFIGURATION_ERROR,
        `Default provider '${this.config.defaultProvider}' is not configured`
      )
    }
  }

  /**
   * Create a sandbox using the specified or default provider
   */
  async createSandbox(options: SandboxCreateOptions): Promise<ISandbox> {
    const provider = this.getProvider(options.provider)
    return provider.create(options)
  }

  /**
   * Connect to an existing sandbox
   */
  async connectToSandbox(
    sandboxId: string,
    providerType?: SandboxProviderType,
    options?: SandboxConnectOptions
  ): Promise<ISandbox> {
    const provider = this.getProvider(providerType || this.config.defaultProvider)
    return provider.connect(sandboxId, options)
  }

  /**
   * Resume a stopped sandbox
   */
  async resumeSandbox(
    sandboxId: string,
    providerType?: SandboxProviderType,
    options?: SandboxConnectOptions
  ): Promise<ISandbox> {
    const provider = this.getProvider(providerType || this.config.defaultProvider)
    return provider.resume(sandboxId, options)
  }

  /**
   * Get a specific provider instance
   */
  getProvider(providerType: SandboxProviderType): ISandboxProvider {
    const provider = this.providers.get(providerType)
    if (!provider) {
      throw new SandboxError(
        SandboxErrorType.CONFIGURATION_ERROR,
        `Provider '${providerType}' is not configured or initialized`
      )
    }
    return provider
  }

  /**
   * Get all available providers
   */
  getAvailableProviders(): SandboxProviderType[] {
    return Array.from(this.providers.keys())
  }

  /**
   * Check if a provider is available
   */
  isProviderAvailable(providerType: SandboxProviderType): boolean {
    return this.providers.has(providerType)
  }

  /**
   * Get the default provider
   */
  getDefaultProvider(): ISandboxProvider {
    return this.getProvider(this.config.defaultProvider)
  }

  /**
   * Update provider configuration
   */
  async updateProviderConfig(
    providerType: SandboxProviderType,
    config: ProviderConfig
  ): Promise<void> {
    const provider = this.getProvider(providerType)
    await provider.initialize(config)
  }

  /**
   * Add a new provider at runtime
   */
  async addProvider(providerType: SandboxProviderType, config: ProviderConfig): Promise<void> {
    let provider: ISandboxProvider

    switch (providerType) {
      case 'e2b':
        provider = new E2BSandboxProvider()
        break
      case 'daytona':
        provider = new DaytonaSandboxProvider()
        break
      default:
        throw new SandboxError(
          SandboxErrorType.CONFIGURATION_ERROR,
          `Unknown provider type: ${providerType}`
        )
    }

    await provider.initialize(config)
    this.providers.set(providerType, provider)
  }

  /**
   * Remove a provider
   */
  removeProvider(providerType: SandboxProviderType): void {
    if (providerType === this.config.defaultProvider) {
      throw new SandboxError(
        SandboxErrorType.CONFIGURATION_ERROR,
        'Cannot remove the default provider'
      )
    }
    this.providers.delete(providerType)
  }

  /**
   * Set the default provider
   */
  setDefaultProvider(providerType: SandboxProviderType): void {
    if (!this.providers.has(providerType)) {
      throw new SandboxError(
        SandboxErrorType.CONFIGURATION_ERROR,
        `Provider '${providerType}' is not available`
      )
    }
    this.config.defaultProvider = providerType
  }

  /**
   * Get factory configuration
   */
  getConfig(): SandboxFactoryConfig {
    return { ...this.config }
  }
}

/**
 * Global sandbox factory instance
 */
let globalFactory: SandboxFactory | null = null

/**
 * Initialize the global sandbox factory
 */
export async function initializeSandboxFactory(
  config: SandboxFactoryConfig
): Promise<SandboxFactory> {
  globalFactory = new SandboxFactory(config)
  await globalFactory.initialize()
  return globalFactory
}

/**
 * Get the global sandbox factory instance
 */
export function getSandboxFactory(): SandboxFactory {
  if (!globalFactory) {
    throw new SandboxError(
      SandboxErrorType.CONFIGURATION_ERROR,
      'Sandbox factory not initialized. Call initializeSandboxFactory() first.'
    )
  }
  return globalFactory
}

/**
 * Convenience function to create a sandbox using the global factory
 */
export async function createSandbox(options: SandboxCreateOptions): Promise<ISandbox> {
  const factory = getSandboxFactory()
  return factory.createSandbox(options)
}

/**
 * Convenience function to connect to a sandbox using the global factory
 */
export async function connectToSandbox(
  sandboxId: string,
  providerType?: SandboxProviderType,
  options?: SandboxConnectOptions
): Promise<ISandbox> {
  const factory = getSandboxFactory()
  return factory.connectToSandbox(sandboxId, providerType, options)
}

/**
 * Convenience function to resume a sandbox using the global factory
 */
export async function resumeSandbox(
  sandboxId: string,
  providerType?: SandboxProviderType,
  options?: SandboxConnectOptions
): Promise<ISandbox> {
  const factory = getSandboxFactory()
  return factory.resumeSandbox(sandboxId, providerType, options)
}

/**
 * Create a sandbox factory with default configuration
 */
export function createDefaultSandboxFactory(): SandboxFactory {
  const config: SandboxFactoryConfig = {
    defaultProvider: 'e2b',
    providers: {
      e2b: {
        type: 'e2b',
      },
    },
  }

  return new SandboxFactory(config)
}

/**
 * Create a sandbox factory from environment variables
 */
export function createSandboxFactoryFromEnv(): SandboxFactory {
  const defaultProvider = (process.env.NEXT_PUBLIC_SANDBOX_DEFAULT_PROVIDER as SandboxProviderType) || 'e2b'

  const config: SandboxFactoryConfig = {
    defaultProvider,
    providers: {},
  }

  // Configure E2B if available
  if (process.env.E2B_API_KEY || defaultProvider === 'e2b') {
    config.providers.e2b = {
      type: 'e2b',
      apiKey: process.env.E2B_API_KEY,
      timeout: process.env.E2B_TIMEOUT ? Number.parseInt(process.env.E2B_TIMEOUT) : undefined,
    }
  }

  // Configure Daytona if available
  if (process.env.DAYTONA_API_KEY || process.env.DAYTONA_API_URL || defaultProvider === 'daytona') {
    config.providers.daytona = {
      type: 'daytona',
      apiKey: process.env.DAYTONA_API_KEY,
      apiUrl: process.env.DAYTONA_API_URL,
      target: process.env.DAYTONA_TARGET,
      timeout: process.env.DAYTONA_TIMEOUT
        ? Number.parseInt(process.env.DAYTONA_TIMEOUT)
        : undefined,
    }
  }

  return new SandboxFactory(config)
}
