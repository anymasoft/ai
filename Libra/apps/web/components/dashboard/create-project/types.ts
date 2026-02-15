/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * types.ts
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

// Type definitions for project creation components

// Props for the main CreateProjectDialog component
export interface CreateProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  preSelectedProjectId?: string
  preSelectedProjectName?: string | null
  skipFirstDialog?: boolean
}

// Props for ProjectNameDialog component
export interface ProjectNameDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onProjectCreated: (projectId: string, projectName: string) => void
  isCreatingProject?: boolean
}

// Props for ProjectRequirementsDialog component
export interface ProjectRequirementsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string | null
  projectName: string | null
  skipFirstDialog?: boolean
} 