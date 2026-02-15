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

import { tryCatch } from '@libra/common'
import { templateConfigs } from '@libra/templates'
import { TRPCError } from '@trpc/server'
import type { FileEntry, FileStructure, getFileContentSchema } from '../schemas/file'
import { createTRPCRouter, protectedProcedure } from '../trpc'

// flat file tree info
export const fileRouter = createTRPCRouter({
  // Fetch file list
  getFileTree: protectedProcedure.query(async () => {
    const [fileStructure, error] = tryCatch(() => {
      // Get vite-shadcn-template data from templates module
      const fileStructure = templateConfigs.vite as FileStructure

      if (!fileStructure) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'File template data not found',
        })
      }

      // Return file structure directly without transformation
      return fileStructure
    })

    if (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch file list',
      })
    }

    return fileStructure
  }),
})
