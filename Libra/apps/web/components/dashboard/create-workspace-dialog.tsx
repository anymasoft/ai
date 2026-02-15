/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * create-workspace-dialog.tsx
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

import { authClient } from '@libra/auth/auth-client'
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
import { Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import * as React from 'react'
import { toast } from 'sonner'
import * as m from '@/paraglide/messages'
import { WorkspaceSlugEditor } from './workspace-slug-editor'
import { useWorkspaceSlug } from './workspace-utils'

interface CreateWorkspaceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateWorkspaceDialog({ open, onOpenChange }: CreateWorkspaceDialogProps) {
  const router = useRouter()
  const [newWorkspaceName, setNewWorkspaceName] = React.useState('')
  const [isCreating, setIsCreating] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const slugInputRef = React.useRef<HTMLInputElement>(null)

  // Use custom hook to manage slug state
  const {
    customSlug,
    setCustomSlug,
    isEditingSlug,
    setIsEditingSlug,
    currentSlug,
    slugValidation,
    isCheckingSlug,
    resetSlug,
  } = useWorkspaceSlug(newWorkspaceName)

  // Focus on input when dialog opens
  React.useEffect(() => {
    if (open && inputRef.current) {
      // Short delay to ensure DOM is updated
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
    }

    // Add Escape key listener
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open && !isCreating) {
        onOpenChange(false)
        setNewWorkspaceName('')
        setCustomSlug('')
        setIsEditingSlug(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, isCreating, onOpenChange, setCustomSlug, setIsEditingSlug])

  // Handle workspace creation
  const handleCreateWorkspace = async () => {
    if (!newWorkspaceName.trim()) {
      toast.error(m['dashboard.workspace.create.nameRequired']())
      return
    }

    // Validate slug
    if (!slugValidation.valid) {
      toast.error(slugValidation.message)
      return
    }

    try {
      setIsCreating(true)
      // Log workspace creation start

      // Use authClient to create organization
      const result = await authClient.organization.create({
        name: newWorkspaceName.trim(),
        slug: currentSlug, // Use current selected or auto-generated slug
      })

      // Show success message
      toast.success(m['dashboard.workspace.create.createSuccess']({ name: newWorkspaceName }))

      // Close dialog and reset form
      onOpenChange(false)
      setNewWorkspaceName('')
      setCustomSlug('')
      setIsEditingSlug(false)

      // Refresh page to get newly created workspace
      router.refresh()
    } catch (error) {
      console.error('Failed to create workspace:', error)

      // Check specific error types and provide more specific error messages
      if (error && typeof error === 'object' && 'code' in error) {
        if (error.code === 'SLUG_IS_TAKEN') {
          toast.error(m['dashboard.workspace.create.slugTaken']())
        } else {
          // Safely check message property
          const errorMessage =
            'message' in error && typeof error.message === 'string'
              ? error.message
              : m['dashboard.workspace.create.retryMessage']()
          toast.error(
            m['dashboard.workspace.create.createFailedWithMessage']({ message: errorMessage })
          )
        }
      } else {
        toast.error(m['dashboard.workspace.create.createFailed']())
      }
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (!isCreating) {
          onOpenChange(open)
          if (!open) setNewWorkspaceName('')
        }
      }}
    >
      <DialogContent className='sm:max-w-[425px]'>
        <DialogHeader>
          <DialogTitle className='text-xl font-semibold'>
            {m['dashboard.workspace.create.title']()}
          </DialogTitle>
          <DialogDescription>{m['dashboard.workspace.create.description']()}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleCreateWorkspace()
          }}
          className='space-y-4 py-4'
        >
          <div className='space-y-2'>
            <div className='flex items-center justify-between'>
              <label htmlFor='workspace-name' className='text-sm font-medium'>
                {m['dashboard.workspace.create.nameLabel']()}
              </label>
              <span className='text-xs text-muted-foreground'>{newWorkspaceName.length}/32</span>
            </div>
            {/** biome-ignore lint/nursery/useUniqueElementIds: <explanation> */}
            <Input
              id='workspace-name'
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value.slice(0, 32))}
              placeholder={m['dashboard.workspace.create.namePlaceholder']()}
              className={cn('w-full transition-all', newWorkspaceName.trim() && 'border-primary')}
              autoFocus
              required
              ref={inputRef}
            />
            <p className='text-xs text-muted-foreground'>
              {m['dashboard.workspace.create.nameHelp']()}
            </p>
          </div>

          {/* Use split workspace identifier editor component */}
          <WorkspaceSlugEditor
            currentSlug={currentSlug}
            isEditingSlug={isEditingSlug}
            setIsEditingSlug={setIsEditingSlug}
            customSlug={customSlug}
            setCustomSlug={setCustomSlug}
            slugValidation={slugValidation}
            workspaceName={newWorkspaceName}
            resetSlug={resetSlug}
            slugInputRef={slugInputRef as React.RefObject<HTMLInputElement>}
            isCheckingSlug={isCheckingSlug}
          />

          <DialogFooter className='pt-4'>
            <Button
              type='button'
              variant='outline'
              onClick={() => {
                onOpenChange(false)
                setNewWorkspaceName('')
              }}
              disabled={isCreating}
              className='hover:bg-muted transition-colors'
            >
              {m['dashboard.workspace.create.cancel']()}
            </Button>
            <Button
              type='submit'
              disabled={isCreating || !newWorkspaceName.trim() || !slugValidation.valid}
              className={cn(
                'min-w-24 relative overflow-hidden transition-all',
                newWorkspaceName.trim() && slugValidation.valid && 'bg-primary hover:bg-primary/90'
              )}
            >
              {isCreating ? (
                <>
                  <div className='mr-2 size-4 animate-spin rounded-full border-2 border-current border-t-transparent' />
                  {m['dashboard.workspace.create.creating']()}
                </>
              ) : (
                <>
                  <Plus className='mr-1 size-4' />
                  {m['dashboard.workspace.create.createButton']()}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
