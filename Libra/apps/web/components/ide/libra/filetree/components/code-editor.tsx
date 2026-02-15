/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * code-editor.tsx
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

import type { DiffMessageType, FileDiffType } from '@libra/common'
import { tryCatch } from '@libra/common'
import { type ShikiCode, shikiCode } from '@libra/shikicode'
import { comments, hookClosingPairs, hookTab } from '@libra/shikicode/plugins'
import { Button } from '@libra/ui/components/button'
import { Switch } from '@libra/ui/components/switch'
import { createId } from '@paralleldrive/cuid2'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { FaCode, FaEdit } from 'react-icons/fa'
import { createHighlighter } from 'shiki'
import { toast } from 'sonner'
import { diffFiles } from '@/lib/diff'
import { useProjectContext } from '@/lib/hooks/use-project-id'
import * as m from '@/paraglide/messages'
import { useTRPC } from '@/trpc/client'
import { useCodeBlockTheme } from '../hooks/useCodeBlockTheme'
import { getThemeName } from '../utils/styles'

interface CodeEditorProps {
  codeContent: string
  filePath: string
  language: string
  showLineNumbers?: boolean
  isEmbedded?: boolean
  isEditMode?: boolean
  onEditModeChange?: (enabled: boolean) => void
  updateFileContent: (path: string, content: string) => boolean
  deployChanges: () => Promise<void>
  className?: string
  onHistoryUpdate?: (message: DiffMessageType) => void
}

/**
 * Code editor component with edit mode toggle
 * Integrates shikicode for syntax highlighting and editing functionality
 */
export function CodeEditor({
  codeContent,
  filePath,
  language,
  showLineNumbers = true,
  isEmbedded = false,
  isEditMode: externalIsEditMode,
  onEditModeChange,
  updateFileContent,
  deployChanges,
  className,
  onHistoryUpdate,
}: CodeEditorProps) {
  // Generate unique IDs for accessibility
  const editModeId = useId()
  const editorId = useId()

  // Theme management
  const { isDarkMode } = useCodeBlockTheme()

  // Project context and tRPC
  const { projectId } = useProjectContext()
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  // Additional state for deployment tracking
  const [isDeploying, setIsDeploying] = useState(false)
  const [deployError, setDeployError] = useState<string | null>(null)

  // Mutation for updating history
  const updateHistoryMutation = useMutation(
    trpc.history.appendHistory.mutationOptions({
      onSuccess: async () => {
        // Immediately refresh the history queries to update chat panel
        await queryClient.invalidateQueries(trpc.history.getAll.pathFilter())
      },
      onError: () => {},
    })
  )

  // State management - use external state if provided, otherwise internal state
  const [internalIsEditMode, setInternalIsEditMode] = useState(false)
  const isEditMode = externalIsEditMode !== undefined ? externalIsEditMode : internalIsEditMode
  const setIsEditMode = onEditModeChange || setInternalIsEditMode
  const [originalContent, setOriginalContent] = useState(codeContent)
  const [currentContent, setCurrentContent] = useState(codeContent)
  const [hasChanges, setHasChanges] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const [lastFilePath, setLastFilePath] = useState(filePath)

  // Refs
  const containerRef = useRef<HTMLDivElement>(null)
  const editorInstanceRef = useRef<ShikiCode | null>(null)
  const originalContentRef = useRef<string>(codeContent)

  // Handle file path changes - reset editor state when switching files
  useEffect(() => {
    if (filePath !== lastFilePath) {
      // Reset all editor state when file path changes
      setOriginalContent(codeContent)
      originalContentRef.current = codeContent // Also update ref
      setCurrentContent(codeContent)
      setHasChanges(false)
      setIsEditMode(false)
      setLastFilePath(filePath)

      // Update editor content if editor is initialized
      if (editorInstanceRef.current) {
        editorInstanceRef.current.value = codeContent
      }
    }
  }, [filePath, lastFilePath, codeContent, setIsEditMode])

  // Update content when props change (but not when file path changes)
  useEffect(() => {
    if (codeContent !== originalContent && !hasChanges) {
      setOriginalContent(codeContent)
      setCurrentContent(codeContent)
      if (editorInstanceRef.current && !isEditMode) {
        editorInstanceRef.current.value = codeContent
      }
    }
  }, [codeContent, originalContent, hasChanges, isEditMode])

  // Initialize shikicode editor
  useEffect(() => {
    let mounted = true
    let cleanup: (() => void) | undefined

    const initializeEditor = async () => {
      if (!containerRef.current) return

      // Clear any existing content
      containerRef.current.innerHTML = ''

      const [, error] = await tryCatch(async () => {
        // Get theme name
        const theme = getThemeName(isDarkMode)

        // Create highlighter
        const highlighter = await createHighlighter({
          langs: [language, 'typescript', 'javascript', 'tsx', 'jsx'],
          themes: [theme],
        })

        if (!mounted) return

        // Create a wrapper div for shikicode to properly handle padding
        const wrapper = document.createElement('div')
        wrapper.style.position = 'relative'
        wrapper.style.width = '100%'
        wrapper.style.height = '100%'
        wrapper.style.minHeight = '100%'
        if (containerRef.current) {
          containerRef.current.appendChild(wrapper)
        }

        // Create editor instance
        const editor = shikiCode()
          .withOptions({
            readOnly: !isEditMode,
            lineNumbers: showLineNumbers ? 'on' : 'off',
            theme: theme,
            language: language,
          })
          .withPlugins(
            comments({ language: language, lineComment: '//' }),
            hookClosingPairs(),
            hookTab
          )
          .create(wrapper, highlighter, {
            value: currentContent,
            language: language,
            theme: theme,
          })

        if (!mounted) return

        // Store editor instance
        editorInstanceRef.current = editor

        // Listen for content changes
        const handleInput = () => {
          if (editorInstanceRef.current) {
            const newContent = editorInstanceRef.current.value
            setCurrentContent(newContent)
            // Use originalContentRef to compare changes
            const hasChangesNow = newContent !== originalContentRef.current
            setHasChanges(hasChangesNow)
            // Clear deploy error when user starts editing again
            if (deployError) {
              setDeployError(null)
            }
          }
        }

        editor.input.addEventListener('input', handleInput)

        setIsInitialized(true)

        // Setup cleanup function
        cleanup = () => {
          editor.input.removeEventListener('input', handleInput)
          editor.dispose()
          wrapper.remove()
        }
      })

      // Handle errors silently (preserving original behavior)
      if (error) {
        // Original catch block was empty, so we maintain the same behavior
        // by not doing anything with the error
      }
    }

    initializeEditor()

    return () => {
      mounted = false
      if (cleanup) {
        cleanup()
      }
      if (editorInstanceRef.current) {
        editorInstanceRef.current.dispose()
        editorInstanceRef.current = null
      }
      setIsInitialized(false)
    }
  }, [language, isDarkMode, showLineNumbers, currentContent, deployError, isEditMode])

  // Update editor content when props change
  useEffect(() => {
    if (editorInstanceRef.current && isInitialized && !isEditMode) {
      editorInstanceRef.current.value = currentContent
    }
  }, [currentContent, isInitialized, isEditMode])

  // Update editor read-only state when edit mode changes
  useEffect(() => {
    if (editorInstanceRef.current && isInitialized) {
      editorInstanceRef.current.updateOptions({
        readOnly: !isEditMode,
      })
    }
  }, [isEditMode, isInitialized])

  // Handle edit mode toggle
  const handleEditModeToggle = useCallback(
    (checked: boolean) => {
      // Use external control if available, otherwise use internal state
      setIsEditMode(checked)
      if (checked) {
        // Entering edit mode - capture original content
        setOriginalContent(currentContent)
        originalContentRef.current = currentContent // Update ref simultaneously
        setHasChanges(false)
      } else {
        // Exiting edit mode - reset if there are unsaved changes
        if (hasChanges) {
          setCurrentContent(originalContent)
          setHasChanges(false)
          if (editorInstanceRef.current) {
            editorInstanceRef.current.value = originalContent
          }
        }
      }
    },
    [currentContent, originalContent, hasChanges, setIsEditMode]
  )

  // Handle cancel action
  const handleCancel = useCallback(() => {
    setCurrentContent(originalContent)
    setHasChanges(false)
    setIsEditMode(false)
    setDeployError(null) // Clear any deployment errors
    if (editorInstanceRef.current) {
      editorInstanceRef.current.value = originalContent
    }
  }, [originalContent, setIsEditMode])

  // Handle submit action
  const handleSubmit = useCallback(async () => {
    if (!hasChanges || isSubmitting || isDeploying) return

    setIsSubmitting(true)
    setDeployError(null)

    try {
      // Update file content
      const success = updateFileContent(filePath, currentContent)

      if (success) {
        // Update original content and clear changes, but keep edit mode during deployment
        setOriginalContent(currentContent)
        setHasChanges(false)

        // Add file modification to project history
        let diffMessage: DiffMessageType | null = null
        try {
          const planId = createId()
          const { additions, deletions } = diffFiles(originalContent, currentContent)

          // Extract file path components
          const pathParts = filePath.split('/')
          const basename = pathParts[pathParts.length - 1] || filePath
          const dirname = pathParts.length > 1 ? pathParts.slice(0, -1).join('/') : ''

          const fileDiff: FileDiffType = {
            modified: currentContent,
            original: originalContent,
            basename,
            dirname,
            path: filePath,
            additions,
            deletions,
            type: 'edit',
          }

          diffMessage = {
            type: 'diff',
            planId,
            diff: [fileDiff],
          }

          await updateHistoryMutation.mutateAsync({
            id: projectId,
            messages: diffMessage,
          })
        } catch {
          // Don't fail the entire operation if history update fails
        }

        // Start deployment phase
        setIsDeploying(true)
        try {
          await deployChanges()
          // Deployment successful - exit edit mode
          setIsEditMode(false)
          toast.success(m['ide.codeEditor.deploySuccess']())

          // Invalidate project messages cache to refresh content
          try {
            await queryClient.invalidateQueries(trpc.history.getAll.pathFilter())
          } catch (cacheError) {
            // Silent error handling - cache invalidation failure shouldn't affect user experience
            console.warn('Failed to invalidate project messages cache:', cacheError)
          }

          // Update local history state for immediate UI update
          if (onHistoryUpdate && diffMessage) {
            try {
              onHistoryUpdate(diffMessage)
            } catch (localUpdateError) {
              console.warn('Failed to update local history state:', localUpdateError)
            }
          }
        } catch (deployError) {
          setDeployError(
            deployError instanceof Error
              ? deployError.message
              : m['ide.codeEditor.deployFailedRetry']()
          )
          toast.error(m['ide.codeEditor.deployFailedRetry']())
          // Keep edit mode on deployment failure
        } finally {
          setIsDeploying(false)
        }
      } else {
        console.error('Failed to update file content')
        toast.error(m['ide.codeEditor.fileUpdateFailed']())
      }
    } catch {
      toast.error(m['ide.codeEditor.submitFailed']())
    } finally {
      setIsSubmitting(false)
    }
  }, [
    hasChanges,
    isSubmitting,
    isDeploying,
    updateFileContent,
    filePath,
    currentContent,
    originalContent,
    deployChanges,
    projectId,
    updateHistoryMutation,
    onHistoryUpdate,
    queryClient.invalidateQueries,
    trpc.history.getAll.pathFilter,
    setIsEditMode,
  ])

  return (
    <div className={`w-full max-w-full relative not-prose flex flex-col ${className || ''}`}>
      {/* File path display area */}
      {isEmbedded && (
        <div className='flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-sm flex-shrink-0'>
          <div className='flex items-center'>
            <FaCode className='mr-2 text-gray-500' />
            <span className='font-mono text-gray-700 dark:text-gray-300 truncate'>{filePath}</span>
          </div>

          {/* Edit mode toggle */}
          <div className='flex items-center gap-2'>
            <FaEdit className='text-gray-500 text-xs' />
            <label htmlFor={editModeId} className='text-xs text-gray-600 dark:text-gray-400'>
              {m['ide.codeEditor.editMode']()}
            </label>
            <Switch
              id={editModeId}
              checked={isEditMode}
              onCheckedChange={handleEditModeToggle}
              aria-label={m['ide.codeEditor.toggleEditMode']()}
            />
          </div>
        </div>
      )}

      {/* Editor container */}
      <div
        ref={containerRef}
        id={editorId}
        className={`${isEmbedded ? 'flex-1' : 'min-h-[400px]'} w-full relative overflow-auto`}
        style={{
          fontFamily: 'var(--font-family, monospace)',
          fontSize: '14px',
          lineHeight: '1.7',
          padding: '1rem',
          backgroundColor: isDarkMode ? '#1e1e1e' : '#ffffff',
        }}
      />

      {/* Action buttons - show when in edit mode and has changes, during submission/deployment, or when there's a deployment error */}
      {(isEditMode && hasChanges) || isSubmitting || isDeploying || deployError ? (
        <div className='flex flex-col gap-2 p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex-shrink-0'>
          {/* Error message */}
          {deployError && (
            <div className='text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded border border-red-200 dark:border-red-800'>
              {m['ide.codeEditor.deployFailedPrefix']()}
              {deployError}
            </div>
          )}

          {/* Button row */}
          <div className='flex items-center justify-end gap-2'>
            <Button
              variant='outline'
              size='sm'
              onClick={handleCancel}
              disabled={isSubmitting || isDeploying}
            >
              {m['ide.codeEditor.cancel']()}
            </Button>
            <Button
              size='sm'
              onClick={handleSubmit}
              disabled={isSubmitting || isDeploying || (!hasChanges && !deployError)}
            >
              {isSubmitting
                ? m['ide.codeEditor.submitting']()
                : isDeploying
                  ? m['ide.codeEditor.deploying']()
                  : deployError
                    ? m['ide.codeEditor.retry']()
                    : m['ide.codeEditor.submit']()}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
