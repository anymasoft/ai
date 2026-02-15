/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * deploy.ts
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

/**
 * Schema for deployment request body
 */
export const deploymentRequestSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  customDomain: z.string().optional(),
  orgId: z.string().min(1, 'Organization ID is required'),
  userId: z.string().min(1, 'User ID is required'),
  initFiles: z.any().optional(),
  historyMessages: z.any().optional()
}).openapi('DeploymentRequest')

/**
 * Schema for deployment response
 */
export const deploymentResponseSchema = z.object({
  success: z.boolean(),
  id: z.string().optional(),
  details: z.any().optional(),
  error: z.string().optional(),
  message: z.string().optional()
}).openapi('DeploymentResponse')

/**
 * Schema for deployment status query parameters
 */
export const deploymentStatusQuerySchema = z.object({
  instanceId: z.string().min(1, 'Instance ID is required')
}).openapi('DeploymentStatusQuery')

/**
 * Schema for deployment status response
 */
export const deploymentStatusResponseSchema = z.object({
  status: z.any(),
  error: z.string().optional()
}).openapi('DeploymentStatusResponse')

/**
 * Schema for health check response
 */
export const healthResponseSchema = z.object({
  status: z.string(),
  timestamp: z.string(),
  service: z.string().optional(),
  version: z.string().optional()
}).openapi('HealthResponse')

/**
 * Schema for service info response
 */
export const serviceInfoResponseSchema = z.object({
  message: z.string(),
  endpoints: z.array(z.string()),
  timestamp: z.string(),
  service: z.string().optional(),
  version: z.string().optional()
}).openapi('ServiceInfoResponse')

/**
 * Schema for error responses
 */
export const errorResponseSchema = z.object({
  success: z.boolean(),
  error: z.string(),
  message: z.string(),
  details: z.string().optional(),
  requestId: z.string().optional(),
  timestamp: z.string().optional()
}).openapi('ErrorResponse')

/**
 * Schema for workflow instance query parameters
 */
export const workflowInstanceQuerySchema = z.object({
  instanceId: z.string().optional()
}).openapi('WorkflowInstanceQuery')

// Type exports for use in handlers
export type DeploymentRequest = z.infer<typeof deploymentRequestSchema>
export type DeploymentResponse = z.infer<typeof deploymentResponseSchema>
export type DeploymentStatusQuery = z.infer<typeof deploymentStatusQuerySchema>
export type DeploymentStatusResponse = z.infer<typeof deploymentStatusResponseSchema>
export type HealthResponse = z.infer<typeof healthResponseSchema>
export type ServiceInfoResponse = z.infer<typeof serviceInfoResponseSchema>
export type ErrorResponse = z.infer<typeof errorResponseSchema>
export type WorkflowInstanceQuery = z.infer<typeof workflowInstanceQuerySchema>
