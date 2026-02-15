/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * delete.ts
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

// Schema for delete file request parameters
export const deleteParamsSchema = z.object({
  planId: z.string().min(1, 'Plan ID is required').describe('The plan ID associated with the file to delete')
}).openapi('DeleteParams')

// Schema for successful delete response
export const deleteResponseSchema = z.object({
  success: z.boolean().describe('Whether the deletion was successful'),
  message: z.string().describe('Success message'),
  fileKey: z.string().optional().describe('The key of the deleted file')
}).openapi('DeleteResponse')

// Schema for error responses
export const deleteErrorResponseSchema = z.object({
  error: z.string().describe('Error type'),
  message: z.string().describe('Error message')
}).openapi('DeleteErrorResponse')
