/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * project-requirements-dialog.tsx
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

import { AnimatePresence, motion } from 'framer-motion'
import { Wand2 } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import { Button } from '@libra/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@libra/ui/components/dialog'
import { Textarea } from '@libra/ui/components/textarea'
import { cn } from '@libra/ui/lib/utils'
import type { ProjectRequirementsDialogProps } from './types'
import { useProjectCreation } from './use-project-creation'
import * as m from '@/paraglide/messages'

export function ProjectRequirementsDialog({ 
  open, 
  onOpenChange, 
  projectId, 
  projectName, 
  skipFirstDialog 
}: ProjectRequirementsDialogProps) {
  // States
  const [requirements, setRequirements] = React.useState('')
  const [addUserLogin, setAddUserLogin] = React.useState(false)
  const [addDatabase, setAddDatabase] = React.useState(false)
  const [isGenerating, setIsGenerating] = React.useState(false)

  // Get project creation logic
  const { updateProjectMutation, router } = useProjectCreation()

  // Handle app generation
  const handleGenerateApp = async () => {
    if (!requirements.trim()) {
      toast.error(m["dashboard.createProject.requirements.describeProject"]())
      return
    }

    try {
      setIsGenerating(true)

      // Create a requirements string with all options
      const fullRequirements = `${requirements}${
        addUserLogin ? '\n\nRequires user login and authentication functionality' : ''
      }${addDatabase ? '\n\nRequires database connection' : ''}`

      // Show generation in progress notification
      const toastId = toast.loading(m["dashboard.createProject.notifications.generating"]({ projectName: projectName || 'New Project' }), {
        description: m["dashboard.createProject.notifications.generatingDescription"](),
      })

      // Update project's initial message if project ID exists - wait for database update completion
      if (projectId) {
        try {
          await updateProjectMutation.mutateAsync({
            projectId: projectId,
            initialMessage: fullRequirements,
          })
        } catch (updateError) {
          toast.dismiss(toastId)
          toast.error(m["dashboard.createProject.notifications.updateFailed"]())
          return // If database update fails, don't continue with subsequent operations
        }
      }

      // Simulate app generation (in a real app, this would be a real process)
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Update notification status
      toast.dismiss(toastId)

      // Show success notification
      toast.success(m["dashboard.createProject.notifications.success"]({ projectName: projectName || 'New Project' }), {
        description: m["dashboard.createProject.notifications.successDescription"](),
        action: {
          label: m["dashboard.createProject.notifications.viewNow"](),
          onClick: () => router.push(`/project/${projectId}`),
        },
      })

      // Close dialog
      onOpenChange(false)

      // Reset form
      setRequirements('')
      setAddUserLogin(false)
      setAddDatabase(false)

      // Navigate to project page - ensure navigation after data update completion
      if (projectId) {
        router.push(`/project/${projectId}`)
      } else {
        router.refresh()
      }
    } catch (error) {
      toast.error(m["dashboard.createProject.notifications.generateFailed"]())
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(dialogOpen) => {
        if (!isGenerating) {
          onOpenChange(dialogOpen)
          
          if (!dialogOpen) {
            setRequirements('')
            setAddUserLogin(false)
            setAddDatabase(false)
          }
        }
      }}
    >
      <DialogContent className='sm:max-w-[600px]'>
        <DialogHeader>
          <DialogTitle className='text-2xl font-bold text-center mb-2'>
            {m["dashboard.createProject.requirements.title"]()}
          </DialogTitle>
          {projectName && (
            <p className='text-center text-primary font-medium'>
              {m["dashboard.createProject.requirements.subtitle"]({ projectName })}
            </p>
          )}
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleGenerateApp()
          }}
          className='space-y-6 py-4 '
        >
          <Textarea
            value={requirements}
            onChange={(e) => setRequirements(e.target.value)}
            placeholder={m["dashboard.createProject.requirements.placeholder"]()}
            className='min-h-32 bg-accent'
            required
            autoFocus={skipFirstDialog}
          />

          {requirements.length === 0 && (
            <p className='text-destructive text-sm font-medium'>{m["dashboard.createProject.requirements.required"]()}</p>
          )}

          <DialogFooter className='pt-6'>
            <AnimatePresence mode='wait'>
              <motion.div
                key={requirements.trim() ? 'active' : 'inactive'}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.2 }}
                className='w-full'
              >
                <Button
                  type='submit'
                  disabled={isGenerating || !requirements.trim()}
                  className={cn(
                    'w-full py-6 text-lg font-medium relative overflow-hidden transition-all',
                    requirements.trim() && 'bg-primary hover:bg-primary/90'
                  )}
                >
                  {isGenerating ? (
                    <>
                      <div className='mr-2 size-5 animate-spin rounded-full border-2 border-current border-t-transparent' />
                      {m["dashboard.createProject.requirements.generating"]()}
                    </>
                  ) : (
                    <>
                      <Wand2 className='mr-2 size-5' />
                      {m["dashboard.createProject.requirements.generateButton"]()}
                    </>
                  )}
                </Button>
              </motion.div>
            </AnimatePresence>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
} 