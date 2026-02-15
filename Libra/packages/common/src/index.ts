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

// Export all types
export type {
  FileType,
  TFile,
  TFolder,
  TTab,
  FileContentMap,
  TreeNode,
  // File structure related types
  FileEntry,
  DirectoryEntry,
  FileOrDirEntry,
  FileStructure,
  GetFileContentInput,
} from './types'

// Export extended message types
export type {
  UserMessageType,
  CommandMessageType,
  DiffMessageType,
  PlanMessageType,
  ThinkingMessageType,
  ScreenshotMessageType,
  TimingMessageType,
  MessageType,
  HistoryType,
  FileDiffType,
  ContentType,
} from './message-types'

// Export all utility functions
export {
  exponentialSmoothing,
  debounce,
  deepMerge,
  sortFileExplorer,
  isFileType,
  isDirectoryType,
  createFileContentMap,
  convertToTreeStructure,
  buildFiles,
  getFileContent,
  buildFileMap,
  // Shared utility functions for Cloudflare Workers services
  getRequestId,
  sleep,
  safeJsonParse,
  safeJsonStringify,
  truncateString,
  formatBytes,
  formatDuration,
  isDevelopment,
  isProduction,
  getEnvironment,
  isValidUrl,
  retryWithBackoff,
  validateIdentifier,
  sanitizeIdentifier,
  isValidCustomDomain,
} from './utils'

export { tryCatch } from './error'

// Export database error handling utilities
export {
  DatabaseError,
  DatabaseErrorType,
  DB_ERROR_MESSAGES,
  classifyDatabaseError,
  transformDatabaseError,
  isDatabaseError,
  withDatabaseErrorHandling,
} from './db-error-handler'

// Export logging utilities
export { logger, log, LogLevel } from './logger'
export type { LogContext } from './logger'

// Export CDN utilities
export {
  CDNUtils,
  getCdnUrl,
  getCdnImageUrl,
  getCdnFileUrl,
  getCdnUploadUrl,
  getCdnScreenshotUrl,
  getCdnScreenshotUploadUrl,
  getCdnStaticAssetUrl,
} from './cdn-utils'

// Export configuration (commented out due to module resolution issues)
// export { LIMITS, LIMIT_MESSAGES } from './config/limits'
// export type { LimitConfig } from './config/limits'
