/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * common.ts
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

import {
  log,
  getRequestId as getRequestIdCommon,
  validateIdentifier,
  sanitizeIdentifier
} from '@libra/common'
import type { AppContext } from '../types'

// Re-export common utility functions for convenience
export {
  isValidUrl,
  isValidCustomDomain,
  retryWithBackoff,
  safeJsonParse,
  safeJsonStringify,
  truncateString,
  formatBytes,
  formatDuration,
  sleep,
  isDevelopment,
  isProduction,
  getEnvironment
} from '@libra/common'

/**
 * Generate a unique request ID if not provided
 * Uses the common implementation from @libra/common
 */
export function getRequestId(c: AppContext): string {
  return getRequestIdCommon(c)
}

/**
 * Get user session from context with validation
 */
export function getUserSession(c: AppContext) {
  const session = c.get('userSession')
  if (!session) {
    throw new Error('User session not found in context')
  }
  return session
}

/**
 * Get user ID from context
 */
export function getUserId(c: AppContext): string {
  const session = getUserSession(c)
  return session.session.userId || session.user.id
}

/**
 * Get organization ID from context
 */
export function getOrganizationId(c: AppContext): string | null {
  const session = getUserSession(c)
  return session.session.activeOrganizationId || null
}

/**
 * Validate project ID format
 * Uses the common validateIdentifier function
 */
export function validateProjectId(projectId: string): boolean {
  const result = validateIdentifier(projectId, {
    minLength: 3,
    maxLength: 63,
    allowUnderscore: true,
    allowHyphen: true
  })
  return result.valid
}

/**
 * Sanitize project name for deployment
 * Uses the common sanitizeIdentifier function
 */
export function sanitizeProjectName(name: string): string {
  return sanitizeIdentifier(name, {
    maxLength: 63,
    replacement: '-',
    toLowerCase: true
  })
}

/**
 * Generate worker name for deployment
 */
export function generateWorkerName(projectId: string, userId: string): string {
  const sanitizedProjectId = sanitizeProjectName(projectId)
  const userHash = userId.substring(0, 8)
  return `${sanitizedProjectId}-${userHash}`
}


const excludedFiles = new Set([
  'tailwind.config.ts',
  'tsconfig.app.json',
  'tsconfig.json',
  'tsconfig.node.json',
  'components.json',
  'src/hooks/use-toast.ts',
  'src/lib/utils.ts',
  'src/assets/react.svg',
  'READEME.md',
  'READEME-ZH.md',
  'components.json',
  '.gitignore',
  'src/components/ui/accordion.tsx',
  'src/components/ui/alert-dialog.tsx',
  'src/components/ui/alert.tsx',
  'src/components/ui/aspect-ratio.tsx',
  'src/components/ui/avatar.tsx',
  'src/components/ui/badge.tsx',
  'src/components/ui/breadcrumb.tsx',
  'src/components/ui/button.tsx',
  'src/components/ui/calendar.tsx',
  'src/components/ui/card.tsx',
  'src/components/ui/carousel.tsx',
  'src/components/ui/chart.tsx',
  'src/components/ui/checkbox.tsx',
  'src/components/ui/collapsible.tsx',
  'src/components/ui/command.tsx',
  'src/components/ui/context-menu.tsx',
  'src/components/ui/dialog.tsx',
  'src/components/ui/drawer.tsx',
  'src/components/ui/dropdown-menu.tsx',
  'src/components/ui/form.tsx',
  'src/components/ui/hover-card.tsx',
  'src/components/ui/input-otp.tsx',
  'src/components/ui/input.tsx',
  'src/components/ui/label.tsx',
  'src/components/ui/menubar.tsx',
  'src/components/ui/navigation-menu.tsx',
  'src/components/ui/pagination.tsx',
  'src/components/ui/popover.tsx',
  'src/components/ui/progress.tsx',
  'src/components/ui/radio-group.tsx',
  'src/components/ui/resizable.tsx',
  'src/components/ui/scroll-area.tsx',
  'src/components/ui/select.tsx',
  'src/components/ui/separator.tsx',
  'src/components/ui/sheet.tsx',
  'src/components/ui/skeleton.tsx',
  'src/components/ui/slider.tsx',
  'src/components/ui/sonner.tsx',
  'src/components/ui/switch.tsx',
  'src/components/ui/table.tsx',
  'src/components/ui/tabs.tsx',
  'src/components/ui/textarea.tsx',
  'src/components/ui/toast.tsx',
  'src/components/ui/toaster.tsx',
  'src/components/ui/toggle-group.tsx',
  'src/components/ui/toggle.tsx',
  'src/components/ui/tooltip.tsx',
  'src/components/ui/use-toast.ts',
])

export function isExcludedFile(path: string): boolean {
  return excludedFiles.has(path) || path.startsWith('public/')
}