/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * file.ts
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

// File entry schema
export const fileEntrySchema = z.object({
  type: z.literal('file'),
  isBinary: z.boolean(),
  content: z.string(),
})

// Directory entry schema
export const directoryEntrySchema: z.ZodType<{
  type: 'directory'
  children: Record<string, FileEntry | DirectoryEntry>
}> = z.object({
  type: z.literal('directory'),
  children: z.record(
    z.string(),
    z.lazy(() => fileEntrySchema.or(directoryEntrySchema))
  ),
})

// Single file or directory entry
export const fileOrDirEntrySchema = fileEntrySchema.or(directoryEntrySchema)

// Complete file structure schema
export const fileStructureSchema = z.record(z.string(), fileOrDirEntrySchema)

// Input schema for file content retrieval
export const getFileContentSchema = z.object({
  path: z.string().min(1, 'File path cannot be empty'),
})

// Export type definitions
export type FileEntry = z.infer<typeof fileEntrySchema>
export type DirectoryEntry = z.infer<typeof directoryEntrySchema>
export type FileOrDirEntry = z.infer<typeof fileOrDirEntrySchema>
export type FileStructure = z.infer<typeof fileStructureSchema>
export type GetFileContentInput = z.infer<typeof getFileContentSchema>
