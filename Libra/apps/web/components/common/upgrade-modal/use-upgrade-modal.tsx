/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * use-upgrade-modal.tsx
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

import { useUpgradeModalContext } from './upgrade-modal-provider'
import { useMembershipStatus } from '@/hooks/use-membership-status'
import type { UpgradeModalConfig, UpgradeScenario } from './types'
import * as m from '@/paraglide/messages'

export interface UseUpgradeModalReturn {
  isOpen: boolean
  showUpgradeModal: (config: UpgradeModalConfig) => void
  hideUpgradeModal: () => void
  showEditModeUpgrade: () => void
  showAIModelUpgrade: (modelName: string) => void
  showProjectLimitUpgrade: () => void
  showPrivateProjectUpgrade: () => void
  checkFeatureAccess: (feature: 'edit-mode' | 'ai-model' | 'project-limit' | 'private-project', onSuccess?: () => void) => boolean
}

export const useUpgradeModal = (): UseUpgradeModalReturn => {
  const context = useUpgradeModalContext()
  const { isPremium, handleUpgrade } = useMembershipStatus()

  // Pre-defined upgrade scenarios
  const showEditModeUpgrade = () => {
    context.showUpgradeModal({
      scenario: 'edit-mode',
      title: 'Upgrade Required',
      description: 'Please upgrade to use this feature.',
      targetPlan: 'PRO',
      variant: 'minimal',
      onUpgrade: handleUpgrade
    })
  }

  const showAIModelUpgrade = (modelName: string) => {
    context.showUpgradeModal({
      scenario: 'ai-model',
      title: 'Upgrade Required',
      description: 'Please upgrade to use this feature.',
      targetPlan: 'PRO',
      variant: 'minimal',
      onUpgrade: handleUpgrade
    })
  }

  const showProjectLimitUpgrade = () => {
    context.showUpgradeModal({
      scenario: 'project-limit',
      title: 'Upgrade Required',
      description: 'Please upgrade to use this feature.',
      targetPlan: 'MAX',
      variant: 'minimal',
      onUpgrade: handleUpgrade
    })
  }

  const showPrivateProjectUpgrade = () => {
    context.showUpgradeModal({
      scenario: 'private-project',
      title: 'Upgrade Required',
      description: 'Please upgrade to create private projects.',
      targetPlan: 'PRO',
      variant: 'minimal',
      onUpgrade: handleUpgrade
    })
  }

  // Feature access checker
  const checkFeatureAccess = (
    feature: 'edit-mode' | 'ai-model' | 'project-limit' | 'private-project',
    onSuccess?: () => void
  ): boolean => {
    if (isPremium) {
      onSuccess?.()
      return true
    }

    // Show appropriate upgrade modal based on feature
    switch (feature) {
      case 'edit-mode':
        showEditModeUpgrade()
        break
      case 'ai-model':
        showAIModelUpgrade('Advanced Model')
        break
      case 'project-limit':
        showProjectLimitUpgrade()
        break
      case 'private-project':
        showPrivateProjectUpgrade()
        break
    }

    return false
  }

  return {
    isOpen: context.isOpen,
    showUpgradeModal: context.showUpgradeModal,
    hideUpgradeModal: context.hideUpgradeModal,
    showEditModeUpgrade,
    showAIModelUpgrade,
    showProjectLimitUpgrade,
    showPrivateProjectUpgrade,
    checkFeatureAccess,
  }
} 