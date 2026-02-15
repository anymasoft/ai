/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * useLibraHandlers.ts
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

import { useCallback } from 'react'
import { toast } from 'sonner'
import type { ImperativePanelHandle } from '../ui/resizable'

interface UseLibraHandlersProps {
  updateFileContent?: (path: string, content: string) => boolean
  currentPath: string | null
  handleFileSelect: (path: string) => void
  setCurrentPath: (path: string) => void
  isChatOpen: boolean
  setIsChatOpen: (open: boolean) => void
  browserPanelRef: React.RefObject<ImperativePanelHandle | null>
  setActiveTab: (tab: 'code') => void
}

export function useLibraHandlers({
  updateFileContent,
  currentPath,
  handleFileSelect,
  setCurrentPath,
  isChatOpen,
  setIsChatOpen,
  browserPanelRef,
  setActiveTab,
}: UseLibraHandlersProps) {
  const handleUpdateFileContent = useCallback(
    (path: string, content: string) => {

      if (updateFileContent) {
        const success = updateFileContent(path, content)

        if (currentPath === path) {
        } else {
          // toast.success(`File ${path} has been automatically updated`)
        }

        if (success) {
        }
      }
    },
    [updateFileContent, currentPath]
  )

  const toggleChat = useCallback(() => {
    if (isChatOpen && browserPanelRef.current) {
      browserPanelRef.current.resize(100)
    }
    setIsChatOpen(!isChatOpen)
  }, [isChatOpen, browserPanelRef, setIsChatOpen])

  const handleSetActiveTab = useCallback(
    (tab: 'code') => {
      if (currentPath) {
        handleFileSelect(currentPath)
      }
      setActiveTab(tab)
    },
    [currentPath, handleFileSelect, setActiveTab]
  )

  const handleChatFileClick = useCallback(
    (path: string) => {
      setCurrentPath(path)
      handleFileSelect(path)
    },
    [setCurrentPath, handleFileSelect]
  )

  return {
    handleUpdateFileContent,
    toggleChat,
    handleSetActiveTab,
    handleChatFileClick,
  }
} 