/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * screenshot.ts
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

// Screenshot storage request schema
export const screenshotRequestSchema = z.object({
  dataUrl: z.string().min(1, { error: 'Screenshot data URL is required' }).describe('Base64 encoded screenshot data URL'),
  planId: z.string().min(1, { error: 'Plan ID is required' }).describe('Plan ID for screenshot association'),
  format: z.enum(['png', 'jpeg']).optional().default('png').describe('Screenshot format')
}).openapi('ScreenshotRequest')

// Screenshot response schema
export const screenshotResponseSchema = z.object({
  key: z.string().describe('The generated key for the stored screenshot'),
  planId: z.string().describe('The plan ID associated with the screenshot'),
  timestamp: z.number().describe('Timestamp when the screenshot was processed')
}).openapi('ScreenshotResponse')

// Screenshot retrieval parameters schema
export const screenshotRetrieveSchema = z.object({
  planId: z.string().min(1, 'Plan ID is required').describe('The plan ID to retrieve screenshot for')
}).openapi('ScreenshotRetrieveParams')

// Error response schema
export const errorResponseSchema = z.object({
  error: z.string().describe('Error type'),
  message: z.string().describe('Error message')
}).openapi('ScreenshotErrorResponse')
