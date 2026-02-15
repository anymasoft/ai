/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * spacing-section.tsx
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

import * as m from '@/paraglide/messages'
import { Label } from '@libra/ui/components/label'
import { PropertySection } from './property-section'
import { PropertyInput } from './property-input'

interface SpacingValues {
  top: string
  right: string
  bottom: string
  left: string
}

interface SpacingControlsProps {
  type: 'margin' | 'padding'
  values: SpacingValues
  onChange: (type: 'margin' | 'padding', side: string, value: string) => void
}

const SpacingControls: React.FC<SpacingControlsProps> = ({ type, values, onChange }) => {
  const label = type === 'margin' ? m['chatPanel.elementEditor.sections.margin']() : m['chatPanel.elementEditor.sections.padding']()

  return (
    <div className="space-y-2">
      <Label className="text-xs text-fg-muted">{label}</Label>
      <div className="grid grid-cols-2 gap-2">
        <PropertyInput
          label={m['chatPanel.elementEditor.fields.marginTop']()}
          value={values.top}
          onChange={(value) => onChange(type, 'top', value)}
          placeholder="0"
        />
        <PropertyInput
          label={m['chatPanel.elementEditor.fields.marginRight']()}
          value={values.right}
          onChange={(value) => onChange(type, 'right', value)}
          placeholder="0"
        />
        <PropertyInput
          label={m['chatPanel.elementEditor.fields.marginBottom']()}
          value={values.bottom}
          onChange={(value) => onChange(type, 'bottom', value)}
          placeholder="0"
        />
        <PropertyInput
          label={m['chatPanel.elementEditor.fields.marginLeft']()}
          value={values.left}
          onChange={(value) => onChange(type, 'left', value)}
          placeholder="0"
        />
      </div>
    </div>
  )
}

interface SpacingSectionProps {
  type: 'margin' | 'padding'
  values: SpacingValues
  onChange: (type: 'margin' | 'padding', side: string, value: string) => void
}

export const SpacingSection: React.FC<SpacingSectionProps> = ({ type, values, onChange }) => {
  const title = type === 'margin' ? m['chatPanel.elementEditor.sections.margin']() : m['chatPanel.elementEditor.sections.padding']()
  const icon = type === 'margin' 
    ? <div className="h-4 w-4 border-2 border-dashed border-current" />
    : <div className="h-4 w-4 border border-current bg-current/20" />

  return (
    <PropertySection title={title} icon={icon}>
      <SpacingControls type={type} values={values} onChange={onChange} />
    </PropertySection>
  )
}
