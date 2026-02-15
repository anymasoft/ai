/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * project-details-dialog.tsx
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


import { ArrowLeft, AlertTriangle, Loader2, Save } from 'lucide-react'
import { ScrollArea } from '@libra/ui/components/scroll-area'
import { Button } from '@libra/ui/components/button'
import { Badge } from '@libra/ui/components/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@libra/ui/components/dialog'

// Import split components and hooks
import type { ProjectDetailsDialogProps } from './project-details-types'
import { useProjectDetails } from './use-project-details'
import { ProjectDetailsSidebar } from './project-details-sidebar'
import { TabContent, LoadingState } from './project-details-tabs'
import {
  DeleteConfirmDialog,
  UnsavedChangesDialog
} from './project-details-dialogs'
import * as m from '@/paraglide/messages'

/**
 * Project details dialog component
 */
export function ProjectDetailsDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
}: ProjectDetailsDialogProps) {
  // Use custom hook to manage state and operations
  const {
    activeTab,
    setActiveTab,
    formState,
    setFormState,
    handleFormChange,
    project,
    isLoadingProject,
    projectError,
    updateProject,
    updateProjectConfig,
    deleteProject,
    handleSave,
    handleDelete,
    deleteDialogOpen,
    setDeleteDialogOpen,
    confirmLeaveDialogOpen,
    setConfirmLeaveDialogOpen,
    handlePendingChanges,
  } = useProjectDetails(projectId, projectName)

  // Form initialization is handled in useProjectDetails hook

  // Handle dialog close
  const handleCloseDialog = () => {
    handlePendingChanges(() => onOpenChange(false))
  }

  // Handle confirm leave dialog
  const handleDiscardChanges = () => {
    setConfirmLeaveDialogOpen(false)
    onOpenChange(false)
  }

  // Handle delete project
  const handleProjectDelete = async (): Promise<boolean> => {
    const success = await handleDelete();
    if (success) onOpenChange(false);
    return success || false; // Ensure return boolean type
  }

  return (
    <>
      {/* Main dialog */}
      <Dialog open={open} onOpenChange={handleCloseDialog} modal>
        <DialogContent
          className='!max-w-none !w-[98vw] sm:!w-[95vw] lg:!w-[90vw] xl:!w-[85vw] !h-[90vh] !max-h-[900px] !p-0 !gap-0 sm:!rounded-xl !border-0 !shadow-xl !bg-background overflow-y-auto'
          style={{ 
            display: 'flex',
            flexDirection: 'column',
            maxWidth: '80rem',
            minWidth: '320px'
          }}
          showCloseButton={false}
          onInteractOutside={(e) => {
            if (formState.hasUnsavedChanges) {
              e.preventDefault()
              setConfirmLeaveDialogOpen(true)
            }
          }}
          onEscapeKeyDown={(e) => {
            if (formState.hasUnsavedChanges) {
              e.preventDefault()
              setConfirmLeaveDialogOpen(true)
            }
          }}
        >
          {/* Top title bar */}
          <DialogHeader className='bg-gradient-to-r from-primary/10 to-background border-b px-4 sm:px-6 py-3 sm:py-4 flex flex-row items-center flex-shrink-0'>
            <Button 
              variant='ghost' 
              size='icon' 
              className='mr-2 sm:mr-3 text-muted-foreground hover:text-foreground'
              onClick={handleCloseDialog}
            >
              <ArrowLeft className='h-4 w-4' />
              <span className="sr-only">{m["dashboard.projectDetails.dialog.backButton"]()}</span>
            </Button>
            <div className='min-w-0 flex-1'>
              <DialogTitle className='text-lg sm:text-xl font-semibold tracking-tight truncate'>
                {formState.name || m["dashboard.projectDetails.dialog.title"]()}
              </DialogTitle>
              <DialogDescription className='mt-1 text-sm hidden sm:block'>
                {m["dashboard.projectDetails.dialog.description"]()}
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className='flex-1 flex flex-col md:flex-row min-h-0'>
            {/* Sidebar navigation */}
            <ProjectDetailsSidebar activeTab={activeTab} setActiveTab={setActiveTab} showIcons={true} />

            {/* Content area - scrollable container */}
            <div className='flex-1 flex flex-col min-h-0 bg-background'>
              <ScrollArea className='flex-1 px-6 sm:px-8 lg:px-10 py-6 sm:py-8 scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent'>
                {isLoadingProject ? (
                  <LoadingState />
                ) : projectError ? (
                  <div className='flex items-center justify-center h-full py-10'>
                    <div className='text-center p-4'>
                      <AlertTriangle className='h-10 w-10 text-amber-500 mx-auto mb-2' />
                      <p className='text-lg font-medium text-red-500 mb-2'>{m["dashboard.projectDetails.errors.loadFailed"]()}</p>
                      <p className='text-sm text-muted-foreground mb-4'>{m["dashboard.projectDetails.errors.loadFailedDescription"]()}</p>
                      <Button variant='outline' onClick={() => window.location.reload()}>
                        {m["dashboard.projectDetails.errors.retry"]()}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <TabContent
                    activeTab={activeTab}
                    project={project}
                    projectId={projectId}
                    formState={formState}
                    onFormChange={handleFormChange}
                    isDeleting={deleteProject.isPending}
                    onDeleteClick={() => setDeleteDialogOpen(true)}
                    onClose={handleCloseDialog}
                  />
                )}
              </ScrollArea>
            </div>
          </div>

          {/* Bottom action bar */}
          {formState.hasUnsavedChanges && activeTab !== 'danger' && (
            <div className='border-t bg-muted/10 py-3 px-4 sm:px-6 flex flex-col sm:flex-row gap-3 sm:gap-0 sm:justify-between sm:items-center flex-shrink-0'>
              <div className='flex items-center'>
                <Badge variant='outline' className='bg-amber-50 text-amber-700 border-amber-200'>
                  {m["dashboard.projectDetails.dialog.unsaved"]()}
                </Badge>
                <span className='text-sm text-muted-foreground ml-2 hidden sm:inline'>{m["dashboard.projectDetails.dialog.unsavedChanges"]()}</span>
              </div>
              <Button onClick={handleSave} disabled={updateProject.isPending || updateProjectConfig.isPending} className='shadow-sm w-full sm:w-auto'>
                {(updateProject.isPending || updateProjectConfig.isPending) ? (
                  <>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    {m["dashboard.projectDetails.dialog.saving"]()}
                  </>
                ) : (
                  <>
                    <Save className='mr-2 h-4 w-4' />
                    {m["dashboard.projectDetails.dialog.saveChanges"]()}
                  </>
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        projectName={formState.name}
        isDeleting={deleteProject.isPending}
        onDelete={handleProjectDelete}
      />

      {/* Unsaved changes confirmation dialog */}
      <UnsavedChangesDialog
        open={confirmLeaveDialogOpen}
        onOpenChange={setConfirmLeaveDialogOpen}
        onContinue={() => setConfirmLeaveDialogOpen(false)}
        onDiscard={handleDiscardChanges}
      />
    </>
  )
}
