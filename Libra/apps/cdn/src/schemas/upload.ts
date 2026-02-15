/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * upload.ts
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

// Upload request schema
export const uploadRequestSchema = z.object({
  image: z.instanceof(File, { error: 'Image file is required' }),
  width: z.string().optional().describe('Optional width for image resizing'),
  height: z.string().optional().describe('Optional height for image resizing'),
  planId: z.string().min(1, { error: 'PlanId is required' }).describe('Plan ID for file replacement tracking')
}).openapi('UploadRequest')

// Upload response schema
export const uploadResponseSchema = z.object({
  key: z.string().describe('The generated key for the uploaded image')
}).openapi('UploadResponse')

// Error response schema
export const errorResponseSchema = z.object({
  error: z.string().describe('Error type'),
  message: z.string().describe('Error message')
}).openapi('ErrorResponse')

// Upload route types
export type UploadRequest = z.infer<typeof uploadRequestSchema>
export type UploadResponse = z.infer<typeof uploadResponseSchema>
export type ErrorResponse = z.infer<typeof errorResponseSchema>
