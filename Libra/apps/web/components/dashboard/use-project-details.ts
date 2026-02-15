/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * use-project-details.ts
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

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTRPC } from '@/trpc/client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { zhCN, enUS } from 'date-fns/locale'
import { toast } from 'sonner'
import { getLocale } from '@/paraglide/runtime'

import type { FormState, TabId } from './project-details-types'
import * as m from '@/paraglide/messages'

// Format date with locale support
export const formatDate = (date: Date | string | null | undefined) => {
  if (!date) return m["dashboard.workspace.projectDetails.dateFormat.unknown"]()
  try {
    const currentLocale = getLocale()
    const dateLocale = currentLocale === 'zh' ? zhCN : enUS
    
    return formatDistanceToNow(new Date(date), {
      addSuffix: true,
      locale: dateLocale,
    })
  } catch (error) {
    return m["dashboard.workspace.projectDetails.dateFormat.invalid"]()
  }
}

/**
 * Custom hook for handling project details state and operations
 */
export function useProjectDetails(projectId: string | null, projectName: string | null) {
  const [activeTab, setActiveTab] = useState<TabId>('details')
  const [formState, setFormState] = useState<FormState>({
    name: projectName || '',
    description: '',
    knowledge: '',
    hasUnsavedChanges: false,
    hasNameChanges: false,
    hasKnowledgeChanges: false,
  })
  const [originalName, setOriginalName] = useState(projectName || '')
  const [originalKnowledge, setOriginalKnowledge] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [confirmLeaveDialogOpen, setConfirmLeaveDialogOpen] = useState(false)

  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const router = useRouter()

  // Get project details
  const projectQuery = useQuery(
    trpc.project.getById.queryOptions(
      { id: projectId ?? '' },
      { enabled: !!projectId }
    )
  )
  const project = projectQuery.data as any
  const isLoadingProject = projectQuery.isLoading
  const projectError = projectQuery.error

  // Update and delete project mutations
  const updateProject = useMutation(trpc.project.update.mutationOptions())
  const updateProjectConfig = useMutation(trpc.project.updateProjectConfig.mutationOptions())
  const deleteProject = useMutation(trpc.project.delete.mutationOptions())

  // Initialize form state when project data is loaded
  useEffect(() => {
    if (project) {
      setFormState((prev) => ({
        ...prev,
        name: project.name || prev.name,
        description: project.initialMessage || '',
        knowledge: project.knowledge || '',
      }))
      setOriginalName(project.name || '')
      setOriginalKnowledge(project.knowledge || '')
    }
  }, [project])

  // Form change handling - memoized with useCallback
  const handleFormChange = useCallback((field: 'name' | 'description' | 'knowledge', value: string) => {
    setFormState((prev) => {
      const newState = {
        ...prev,
        [field]: value,
      }

      if (field === 'name') {
        newState.hasNameChanges = value !== originalName
        newState.hasUnsavedChanges = value !== originalName || prev.hasKnowledgeChanges
      }

      if (field === 'description') {
        newState.hasUnsavedChanges = true
      }

      if (field === 'knowledge') {
        newState.hasKnowledgeChanges = value !== originalKnowledge
        newState.hasUnsavedChanges = value !== originalKnowledge || prev.hasNameChanges
      }

      return newState
    })
  }, [originalName, originalKnowledge])

  // Remove auto-save functionality - knowledge should only be saved manually

  // Save project changes
  const handleSave = async () => {
    if (!projectId) return


    try {
      // If project name or knowledge base has changed, use new updateProjectConfig API
      if (formState.hasNameChanges || formState.hasKnowledgeChanges) {
        await updateProjectConfig.mutateAsync({
          projectId: projectId,
          name: formState.hasNameChanges ? formState.name : undefined,
          knowledge: formState.hasKnowledgeChanges ? formState.knowledge : undefined,
        })
        if (formState.hasNameChanges) {
          setOriginalName(formState.name)
        }
        if (formState.hasKnowledgeChanges) {
          setOriginalKnowledge(formState.knowledge)
        }
      }

      // If project description has changed, use original update API
      if (formState.description !== (project?.initialMessage || '')) {
        await updateProject.mutateAsync({
          projectId: projectId,
          initialMessage: formState.description,
        })
      }

      setFormState((prev) => ({
        ...prev,
        hasUnsavedChanges: false,
        hasNameChanges: false,
        hasKnowledgeChanges: false,
      }))

      // Refresh project data
      await queryClient.invalidateQueries(trpc.project.getById.pathFilter())

      toast.success(m["dashboard.workspace.projectDetails.notifications.updateSuccess"](), {
        description: m["dashboard.workspace.projectDetails.notifications.updateSuccessDesc"](),
      })
    } catch (error) {
      toast.error(m["dashboard.workspace.projectDetails.notifications.saveFailed"](), {
        description: m["dashboard.workspace.projectDetails.notifications.saveFailedDesc"](),
      })
    }
  }



  // Delete project
  const handleDelete = async () => {
    if (!projectId) return


    try {
      await deleteProject.mutateAsync({ id: projectId })

      // Close all dialogs
      setDeleteDialogOpen(false)

      // Refresh project list
      await queryClient.invalidateQueries(trpc.project.list.pathFilter())

      // Refresh quota status to reflect restored project quota
      await queryClient.invalidateQueries(trpc.project.getQuotaStatus.pathFilter())
      await queryClient.invalidateQueries(trpc.subscription.getUsage.pathFilter())

      toast.success(m["dashboard.workspace.projectDetails.notifications.deleteSuccess"]())

      // Navigate to project list page
      router.push('/dashboard')

      return true
    } catch (error) {
      toast.error(m["dashboard.workspace.projectDetails.notifications.deleteFailed"](), {
        description: m["dashboard.workspace.projectDetails.notifications.deleteFailedDesc"](),
      })
      return false
    }
  }

  // Handle unsaved changes when leaving
  const handlePendingChanges = (action: () => void) => {
    if (formState.hasUnsavedChanges) {
      setConfirmLeaveDialogOpen(true)
    } else {
      action()
    }
  }

  return {
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
  }
} 