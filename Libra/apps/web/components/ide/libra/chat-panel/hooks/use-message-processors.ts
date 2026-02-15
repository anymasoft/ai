/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * use-message-processors.ts
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

import { diffFiles } from '@/lib/diff'
import type {
  CommandMessageType,
  DiffMessageType,
  FileDiffType,
  FileType,
  HistoryType,
} from '@libra/common'
import { useCallback } from 'react'

/**
 * Message processor Hook
 */
export const useMessageProcessors = (
  setMessages: React.Dispatch<React.SetStateAction<HistoryType>>,
  setHistory: React.Dispatch<React.SetStateAction<HistoryType>>,
  setFileDiffs: React.Dispatch<React.SetStateAction<FileDiffType[]>>,
  updateHistoryMutation: any,
  projectId: string,
  saveAccumulatedContent: (planId: string) => Promise<void>,
) => {
  /**
   * Handle command messages
   */
  const handleCommandMessage = useCallback(
    async (message: any, planId: string) => {
      // Save accumulated content before processing command message
      await saveAccumulatedContent(planId)
      
      const commandMessage = {
        type: 'command',
        command: message.data?.command,
        packages: message.data?.packages,
        description: message.data?.description,
        planId,
      } as CommandMessageType

      setMessages((prev) => [...prev, commandMessage])
      setHistory((prevHistory) => [...prevHistory, commandMessage])
      await updateHistoryMutation.mutateAsync({
        id: projectId,
        messages: [commandMessage],
      })
    },
    [projectId, setHistory, setMessages, updateHistoryMutation, saveAccumulatedContent]
  )

  /**
   * Handle file updates
   */
  const handleFileUpdates = useCallback(
    async (fileUpdates: FileType[], planId: string) => {
      // Calculate file differences
      const newFileDiffs: FileDiffType[] = fileUpdates.map((file: FileType) => {
        const { additions, deletions } = diffFiles(file.original ?? '', file.modified)

        // First check if there's an explicit isNew flag
        // Next check if original is null as a basis for judgment
        let fileType: 'edit' | 'create' = 'edit'
        if (file.isNew) {
          fileType = 'create'
        } else if (file.original === null) {
          fileType = 'create'
        }



        return {
          modified: file.modified,
          original: file.original,
          basename: file.basename,
          dirname: file.dirname,
          path: file.path,
          additions,
          deletions,
          type: fileType,
        }
      })

      // Update message, accumulate file differences instead of replacing
      setMessages((prev) => {
        // Check if diff message for this planId already exists
        const existingDiffIndex = prev.findIndex(
          (msg) => msg.type === 'diff' && msg.planId === planId
        )

        if (existingDiffIndex >= 0) {
          // If exists, accumulate file differences
          const updatedMessages = [...prev]
          const existingDiff = updatedMessages[existingDiffIndex] as DiffMessageType
          updatedMessages[existingDiffIndex] = {
            ...existingDiff,
            diff: [...(existingDiff.diff || []), ...newFileDiffs]
          } as DiffMessageType
          return updatedMessages
        }
          // If not exists, create new diff message
          const diffMessage = { type: 'diff', diff: newFileDiffs, planId } as DiffMessageType
          return [...prev, diffMessage]
      })

      // Also update history
      setHistory((prevHistory) => {
        const existingDiffIndex = prevHistory.findIndex(
          (msg) => msg.type === 'diff' && msg.planId === planId
        )

        if (existingDiffIndex >= 0) {
          const updatedHistory = [...prevHistory]
          const existingDiff = updatedHistory[existingDiffIndex] as DiffMessageType
          updatedHistory[existingDiffIndex] = {
            ...existingDiff,
            diff: [...(existingDiff.diff || []), ...newFileDiffs]
          } as DiffMessageType
          return updatedHistory
        }
          const diffMessage = { type: 'diff', diff: newFileDiffs, planId } as DiffMessageType
          return [...prevHistory, diffMessage]
      })

      // Accumulate file differences
      setFileDiffs((prevDiffs) => [...prevDiffs, ...newFileDiffs])

      // Note: Don't clean accumulator data and deploy here, wait until all files are processed
    },
    [
      setHistory,
      setMessages,
      setFileDiffs,
    ]
  )

  return {
    handleCommandMessage,
    handleFileUpdates,
  }
} 