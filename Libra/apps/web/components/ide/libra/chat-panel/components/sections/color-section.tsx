/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * color-section.tsx
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
import { PropertySection } from './property-section'
import { PropertyInput } from './property-input'

interface ColorSectionProps {
  color: string
  onChange: (value: string) => void
}

export const ColorSection: React.FC<ColorSectionProps> = ({ color, onChange }) => {
  return (
    <PropertySection
      title={m['chatPanel.elementEditor.sections.color']()}
      icon={<div className="h-4 w-4 rounded border border-border bg-current" />}
    >
      <PropertyInput
        label={m['chatPanel.elementEditor.fields.color']()}
        value={color || ''}
        onChange={onChange}
        type="color"
        placeholder={m['chatPanel.elementEditor.fields.colorPlaceholder']()}
      />
    </PropertySection>
  )
}
