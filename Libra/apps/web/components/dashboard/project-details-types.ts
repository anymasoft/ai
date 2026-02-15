/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * project-details-types.ts
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

import { type ComponentType } from 'react'

// Tab configuration type
type TabItem = {
  id: string
  label: string
  icon: ComponentType<{ className?: string }>
  comingSoon?: boolean
}

// Tab configuration structure
export const TAB_GROUPS = {
  project: [
    { id: 'details', comingSoon: false },
  ],
  content: [
    { id: 'knowledge', comingSoon: false },
    { id: 'assets', comingSoon: true },
    { id: 'analytics', comingSoon: true },
  ],
  dangerZone: [
    { id: 'danger', comingSoon: false }
  ],
} as const

// Form state type
export interface FormState {
  name: string
  description: string
  knowledge: string
  hasUnsavedChanges: boolean
  hasNameChanges: boolean
  hasKnowledgeChanges: boolean
}

// Main component props type
export interface ProjectDetailsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string | null
  projectName: string | null
}

// Tab ID type
export type TabId = 'details' | 'knowledge' | 'assets' | 'analytics' | 'danger'

// Danger Tab specific types
export type DangerTabStep = 'warning' | 'confirmation' | 'final-confirmation'

export interface DangerTabState {
  currentStep: DangerTabStep
  confirmationInput: string
  isValidInput: boolean
}

export interface DangerTabProps {
  isDeleting: boolean
  onDeleteClick: () => void
  onClose?: () => void
  projectName?: string
}