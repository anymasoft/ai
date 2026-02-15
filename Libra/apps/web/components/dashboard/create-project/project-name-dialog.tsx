/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * project-name-dialog.tsx
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

import { Plus, AlertTriangle } from 'lucide-react'
import * as React from 'react'
import { useSession } from '@libra/auth/auth-client'
import { toast } from 'sonner'

import { Button } from '@libra/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@libra/ui/components/dialog'
import { Input } from '@libra/ui/components/input'
import { cn } from '@libra/ui/lib/utils'
import type { ProjectNameDialogProps } from './types'
import { useProjectCreation } from './use-project-creation'
import { useProjectQuota } from '../hooks/use-project-quota'
import * as m from '@/paraglide/messages'

export function ProjectNameDialog({ 
  open, 
  onOpenChange,
  onProjectCreated,
  isCreatingProject: externalIsCreating
}: ProjectNameDialogProps) {
  // States
  const [projectName, setProjectName] = React.useState('')
  const [isCreating, setIsCreating] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  
  // Session data
  const { data: sessionData } = useSession()
  
  // Get project creation logic
  const {
    createProjectMutation,
  } = useProjectCreation()

  // Get project quota information
  const { canCreateProject, isQuotaExhausted, quotaInfo, isLoading: isQuotaLoading } = useProjectQuota()

  // Generate quota message using internationalization
  const getQuotaMessage = (): string => {
    if (!quotaInfo) return m["dashboard.projectCreateButton.quota.loading"]()

    if (isQuotaExhausted) {
      return m["dashboard.projectCreateButton.quota.exhausted"]({
        used: quotaInfo.projectNumsLimit,
        limit: quotaInfo.projectNumsLimit
      })
    }

    return m["dashboard.projectCreateButton.quota.remaining"]({
      remaining: quotaInfo.projectNums,
      used: quotaInfo.projectNumsLimit - quotaInfo.projectNums,
      limit: quotaInfo.projectNumsLimit
    })
  }

  // Focus input when dialog opens
  React.useEffect(() => {
    if (open && inputRef.current) {
      // Short delay to ensure DOM has updated
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
    }

    // Add Escape key listener
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open && !isCreating) {
        onOpenChange(false)
        setProjectName('')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, isCreating, onOpenChange])

  // Handle project creation
  const handleCreateProject = async () => {
    if (!projectName.trim()) {
      toast.error(m["dashboard.project_name_required"]())
      return
    }

    // Check if user is logged in
    if (!sessionData?.user) {
      toast.error(m["dashboard.login_required"]())
      return
    }

    // Check project quota before creating
    if (!canCreateProject) {
      toast.error(m["dashboard.quota_exhausted"]())
      return
    }
    
    try {
      setIsCreating(true)
      // Log project creation start

      // Call tRPC to create project
      createProjectMutation.mutate(
        {
          name: projectName.trim(),
          visibility: 'private', // Default to private project
          templateType: 'default', // Default template type
        },
        {
          onSuccess: (data) => {
            // Notify parent component
            onProjectCreated(data.id, data.name)
          }
        }
      )
    } catch (error) {
      toast.error(m["dashboard.create_failed"]())
    } finally {
      setIsCreating(false)
      setProjectName('')
    }
  }

  // Determine if create is in progress
  const isBusy = isCreating || createProjectMutation.isPending || !!externalIsCreating

  // Determine if create button should be disabled
  const isCreateDisabled = isBusy || !projectName.trim() || !canCreateProject || isQuotaLoading

  return (
    <Dialog open={open} onOpenChange={(dialogOpen) => {
      if (!isBusy) {
        onOpenChange(dialogOpen)
        
        if (!dialogOpen) {
          setProjectName('')
        }
      }
    }}>
      <DialogContent className='sm:max-w-[425px]'>
        <DialogHeader>
          <DialogTitle className='text-xl font-semibold'>{m["dashboard.project_name_dialog_title"]()}</DialogTitle>
          <DialogDescription>
            {m["dashboard.project_name_dialog_description"]()}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleCreateProject()
          }}
          className='space-y-4 py-4'
        >
          <div className='space-y-2'>
            <div className='flex items-center justify-between'>
              <label htmlFor='project-name' className='text-sm font-medium'>
                {m["dashboard.project_name_label"]()}
              </label>
              <span
                className={cn(
                  'text-xs transition-colors',
                  projectName.length > 28 ? 'text-amber-500' : 'text-muted-foreground'
                )}
              >
                {m["dashboard.project_name_length"]({ current: projectName.length })}
              </span>
            </div>
            <Input
              id='project-name'
              value={projectName}
              onChange={(e) => setProjectName(e.target.value.slice(0, 32))}
              placeholder={m["dashboard.project_name_placeholder"]()}
              className={cn('w-full transition-all bg-accent', projectName.trim())}
              autoFocus
              required
              ref={inputRef}
            />
            <p className='text-xs text-muted-foreground'>
              {m["dashboard.project_name_help"]()}
            </p>

            {/* Quota status information */}
            {!isQuotaLoading && (
              <div className={cn(
                'quota-dialog-display',
                isQuotaExhausted ? 'quota-warning' : 'quota-info'
              )}>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {isQuotaExhausted && (
                    <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                  )}
                  <span className="quota-text flex-1 min-w-0 break-words">
                    {getQuotaMessage()}
                  </span>
                </div>
                {isQuotaExhausted && (
                  <div className="text-xs text-muted-foreground mt-1 sm:mt-0 sm:ml-2">
                    {m["dashboard.projectCreateButton.quota.upgradeHint"]()}
                  </div>
                )}
              </div>
            )}

          </div>

          <DialogFooter className='pt-4'>
            <Button
              variant='outline'
              onClick={() => {
                onOpenChange(false)
                setProjectName('')
              }}
              disabled={isBusy}
              className='hover:bg-muted transition-colors'
            >
              {m["dashboard.project_create_cancel"]()}
            </Button>
            <Button
              variant='default'
              disabled={isCreateDisabled}
              className={cn(
                'min-w-24 relative overflow-hidden transition-all',
                projectName.trim() && canCreateProject && 'bg-primary hover:bg-primary/90',
                isQuotaExhausted && 'opacity-50 cursor-not-allowed'
              )}
            >
              {isBusy ? (
                <>
                  <div className='mr-2 size-4 animate-spin rounded-full border-2 border-current border-t-transparent' />
                  {m["dashboard.creating"]()}
                </>
              ) : (
                <>
                  <Plus className='mr-1 size-4' />
                  {m["dashboard.project_create_button"]()}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
} 