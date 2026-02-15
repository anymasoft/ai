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

// Export configuration
export {
  // Configuration builders and factories
  createConfigBuilder,
  createConfigFromEnvironment,
  createDefaultConfig,
  SandboxConfigBuilder,

  // Default configurations
  DEFAULT_PROVIDER_CONFIGS,
  DEFAULT_SANDBOX_CONFIGS,

  // New unified configuration constants
  CONTAINER_TIMEOUTS,
  DEPLOYMENT_CONFIG,
  TEMPLATE_MAPPINGS,

  // Configuration utilities
  getSandboxConfigForTemplate,
  mergeSandboxConfig,
  validateFactoryConfig,
  validateSandboxConfig,

  // New utility functions
  getTimeoutForUserTier,
  getDeploymentTemplate,
  getBuilderDefaultProvider,
  getDynamicDeploymentTemplate,
  isExcludedFile,
  getDeploymentTimeout,
} from './config'
// Export factory
/**
 * Default export: Factory creation function
 */
export {
  connectToSandbox,
  createDefaultSandboxFactory,
  createDefaultSandboxFactory as default,
  createSandbox,
  createSandboxFactoryFromEnv,
  getSandboxFactory,
  initializeSandboxFactory,
  resumeSandbox,
  SandboxFactory,
} from './factory/sandbox-factory'
// Re-export interfaces
export type {
  ISandbox,
  ISandboxProvider,
} from './interfaces/sandbox-provider'
// Export interfaces
export * from './interfaces/sandbox-provider'
export { DaytonaSandbox, DaytonaSandboxProvider } from './providers/daytona-provider'
// Export providers
export { E2BSandbox, E2BSandboxProvider } from './providers/e2b-provider'
// Re-export common types for convenience
export type {
  CommandOptions,
  CommandResult,
  ProviderConfig,
  SandboxConfig,
  SandboxConnectOptions,
  SandboxCreateOptions,
  SandboxFactoryConfig,
  SandboxFile,
  SandboxInfo,
  SandboxProviderType,
} from './types'
// Export all types
export * from './types'
// Export utilities
export {
  calculateRetryDelay,
  checkSandboxHealth,
  createSandboxLogger,
  createTimeoutPromise,
  debounce,
  executeCommandWithRetry,
  formatFileSize,
  generateSandboxId,
  isRetryableError,
  parseEnvironmentVariables,
  // Legacy compatibility functions
  retryWithBackoff,
  sanitizeFilePath,
  terminateLegacySandbox,
  throttle,
  validateCommand,
  waitForSandboxReady,
  writeFilesWithRetry,
} from './utils'
