/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * project-schema.ts
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

import { z } from 'zod/v4'

// Define limits locally to avoid module resolution issues
const PROJECT_LIMITS = {
  NAME_MAX_LENGTH: 100,
  KNOWLEDGE_MAX_LENGTH: 500,
  MESSAGE_MAX_LENGTH: 2000, // Backend message length limit
} as const

const PROJECT_LIMIT_MESSAGES = {
  NAME_TOO_LONG: `Project name cannot exceed ${PROJECT_LIMITS.NAME_MAX_LENGTH} characters`,
  KNOWLEDGE_TOO_LONG: `Knowledge content cannot exceed ${PROJECT_LIMITS.KNOWLEDGE_MAX_LENGTH} characters`,
  MESSAGE_TOO_LONG: `Message cannot exceed ${PROJECT_LIMITS.MESSAGE_MAX_LENGTH} characters`,
} as const

// Git URL validation regex - supports GitHub, GitLab, Bitbucket, and generic Git URLs
const GIT_URL_REGEX = /^(https?:\/\/)?([\w.-]+@)?([\w.-]+)(:\d+)?(\/[\w.-]+)*\.git$/i
const GITHUB_URL_REGEX = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\.git$/i

// Git branch name validation - follows Git naming conventions
const GIT_BRANCH_REGEX = /^[a-zA-Z0-9]([a-zA-Z0-9._/-]*[a-zA-Z0-9])?$/

// Domain name validation regex - supports standard domain formats
const DOMAIN_REGEX = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/

export const projectSchema = z.object({
  name: z.string().optional(),
  initialMessage: z.string().optional(),
  visibility: z.enum(['public', 'private']).optional(),
  templateType: z.string().optional(),
  attachment: z
    .object({
      key: z.string(),
      name: z.string(),
      type: z.string(),
    })
    .optional(),
  planId: z.string().optional(),
})

export const updateSchema = z.object({
  projectId: z.string().min(1),
  initialMessage: z.string().optional(),
})

export const updateProjectConfigSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  name: z.string().min(1, 'Project name is required').max(PROJECT_LIMITS.NAME_MAX_LENGTH, PROJECT_LIMIT_MESSAGES.NAME_TOO_LONG).optional(),
  // Knowledge base with character limit
  knowledge: z.string().max(PROJECT_LIMITS.KNOWLEDGE_MAX_LENGTH, PROJECT_LIMIT_MESSAGES.KNOWLEDGE_TOO_LONG).optional(),
})

export const updateProjectVisibilitySchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  visibility: z.union([z.literal('public'), z.literal('private')], {
    error: 'Visibility must be either public or private',
  }),
})

export const updateDeploymentStatusSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  deploymentStatus: z.enum(['idle', 'preparing', 'deploying', 'deployed', 'failed']).optional(),
  productionDeployUrl: z.string().optional(),
})

export const gitInfoSchema = z.object({
  gitUrl: z
    .string()
    .url('Invalid URL format')
    .regex(GIT_URL_REGEX, 'Invalid Git repository URL format')
    .optional(),
  gitBranch: z
    .string()
    .min(1, 'Branch name cannot be empty')
    .max(250, 'Branch name too long')
    .regex(GIT_BRANCH_REGEX, 'Invalid branch name format')
    .optional(),
})

export const githubRepoInfoSchema = z.object({
  gitUrl: z
    .string()
    .url('Invalid GitHub URL format')
    .regex(GITHUB_URL_REGEX, 'Must be a valid GitHub repository URL')
    .optional(),
  gitBranch: z
    .string()
    .min(1, 'Branch name cannot be empty')
    .max(250, 'Branch name too long')
    .regex(GIT_BRANCH_REGEX, 'Invalid branch name format')
    .default('main'),
})

export const updateHistoryWithScreenshotSchema = z.object({
  projectId: z.string().min(1),
  planId: z.string().min(1),
  screenshotKey: z.string().min(1),
  previewUrl: z.url(),
})

export const deployProjectSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  customDomain: z
    .string()
    .regex(DOMAIN_REGEX, 'Invalid domain name format')
    .optional(),
})

export const customDomainSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  customDomain: z
    .string()
    .min(1, 'Domain name is required')
    .regex(DOMAIN_REGEX, 'Invalid domain name format'),
})

export const removeCustomDomainSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
})

export const getDeploymentStatusSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  workflowInstanceId: z.string().min(1, 'Workflow instance ID is required').optional(),
})

export const verifyCustomDomainSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
})

// AI message validation schema
export const aiMessageSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty').max(PROJECT_LIMITS.MESSAGE_MAX_LENGTH, PROJECT_LIMIT_MESSAGES.MESSAGE_TOO_LONG),
  planId: z.string().min(1, 'Plan ID is required'),
  projectId: z.string().min(1, 'Project ID is required'),
  selectedItems: z.array(z.object({
    id: z.string(),
    type: z.string(),
    content: z.string().optional(),
  })).optional(),
  attachment: z.object({
    key: z.string(),
    name: z.string(),
    type: z.string(),
  }).optional(),
  selectedModelId: z.string().optional(),
  isDirectModification: z.boolean().optional(),
  targetFilename: z.string().optional(),
})
