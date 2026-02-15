/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * upgrade-modal-provider.tsx
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

import React, { createContext, useContext, useState, useCallback } from 'react'
import type { UpgradeModalConfig, UpgradeModalContextValue } from './types'
import { UpgradeModal } from './upgrade-modal'

const UpgradeModalContext = createContext<UpgradeModalContextValue | null>(null)

interface UpgradeModalProviderProps {
  children: React.ReactNode
}

export const UpgradeModalProvider = ({ children }: UpgradeModalProviderProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [config, setConfig] = useState<UpgradeModalConfig | null>(null)

  const showUpgradeModal = useCallback((modalConfig: UpgradeModalConfig) => {
    setConfig(modalConfig)
    setIsOpen(true)
  }, [])

  const hideUpgradeModal = useCallback(() => {
    setIsOpen(false)
    // Delay clearing config to allow for exit animations
    setTimeout(() => setConfig(null), 200)
  }, [])

  const contextValue: UpgradeModalContextValue = {
    isOpen,
    config,
    showUpgradeModal,
    hideUpgradeModal,
  }

  return (
    <UpgradeModalContext.Provider value={contextValue}>
      {children}
      <UpgradeModal />
    </UpgradeModalContext.Provider>
  )
}

export const useUpgradeModalContext = () => {
  const context = useContext(UpgradeModalContext)
  if (!context) {
    throw new Error('useUpgradeModalContext must be used within an UpgradeModalProvider')
  }
  return context
} 