/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * index.tsx
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

'use client'

import * as React from 'react'

import type { CreateProjectDialogProps } from './types'
import { ProjectNameDialog } from './project-name-dialog'
import { ProjectRequirementsDialog } from './project-requirements-dialog'

export function CreateProjectDialog({
  open,
  onOpenChange,
  preSelectedProjectId,
  preSelectedProjectName,
  skipFirstDialog,
}: CreateProjectDialogProps) {
  // State management
  const [showRequirementsDialog, setShowRequirementsDialog] = React.useState(skipFirstDialog || false)
  const [createdProjectId, setCreatedProjectId] = React.useState<string | null>(preSelectedProjectId || null)
  const [createdProjectName, setCreatedProjectName] = React.useState<string | null>(preSelectedProjectName || null)

  // Handle project creation completion event
  const handleProjectCreated = (projectId: string, projectName: string) => {
    setCreatedProjectId(projectId)
    setCreatedProjectName(projectName)
    setShowRequirementsDialog(true)
  }

  // Reset all state
  const resetState = React.useCallback(() => {
    if (!skipFirstDialog) {
      setCreatedProjectId(null)
      setCreatedProjectName(null)
    }
    setShowRequirementsDialog(false)
  }, [skipFirstDialog]);

  // Reset state when dialog closes
  React.useEffect(() => {
    if (!open) {
      resetState()
    }
  }, [open, resetState])

  // Update state when skipFirstDialog parameter changes
  React.useEffect(() => {
    if (skipFirstDialog) {
      setShowRequirementsDialog(true)
      setCreatedProjectId(preSelectedProjectId || null)
      setCreatedProjectName(preSelectedProjectName || null)
    }
  }, [skipFirstDialog, preSelectedProjectId, preSelectedProjectName])

  return (
    <>
      {/* Project name dialog - only show when skipFirstDialog is false */}
      {!skipFirstDialog && (
        <ProjectNameDialog
          open={open && !showRequirementsDialog}
          onOpenChange={(isOpen) => {
            // Only completely close dialog when project is not created
            if (!isOpen && !createdProjectId) {
              onOpenChange(isOpen)
            }
          }}
          onProjectCreated={handleProjectCreated}
        />
      )}

      {/* Project requirements dialog */}
      <ProjectRequirementsDialog
        open={showRequirementsDialog && open}
        onOpenChange={(isOpen) => {
          // If closing requirements dialog, completely close entire dialog
          if (!isOpen) {
            setShowRequirementsDialog(isOpen)
            onOpenChange(isOpen)
          }
        }}
        projectId={createdProjectId}
        projectName={createdProjectName}
        skipFirstDialog={skipFirstDialog ?? false}
      />
    </>
  )
}