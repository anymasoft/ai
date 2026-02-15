/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * github.ts
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

import { z } from "zod/v4";

// Type definitions (placed before schemas for v4 compatibility)
export type GithubNodeBase = z.infer<typeof githubNodeBaseSchema>;
export type GitHubFileNode = z.infer<typeof githubFileNodeSchema>;
export type GetFileContentInput = z.infer<typeof getFileContentSchema>;

// Basic schema for GitHub file/directory structure
export const githubNodeBaseSchema = z.object({
  name: z.string(),
  path: z.string(),
  type: z.enum(["file", "dir"]),
  _links: z.object({ self: z.string() }),
  depth: z.number(),
  parentPath: z.string().optional(),
});

// Define recursive type to support directory hierarchy
// In Zod 4, recursive types need to be defined differently
export const githubFileNodeSchema: z.ZodType<any> = z.lazy(() =>
  githubNodeBaseSchema.extend({
    children: z.array(githubFileNodeSchema).optional(),
  })
);

// File content retrieval input schema
export const getFileContentSchema = z.object({
  path: z.string().min(1, "File path cannot be empty"),
});