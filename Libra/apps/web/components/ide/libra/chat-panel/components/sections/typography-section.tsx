/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * typography-section.tsx
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@libra/ui/components/select'
import { Type } from 'lucide-react'
import { PropertySection } from './property-section'
import { PropertyInput } from './property-input'

interface TypographySectionProps {
  fontSize: string
  fontWeight: string
  onFontSizeChange: (value: string) => void
  onFontWeightChange: (value: string) => void
}

export const TypographySection: React.FC<TypographySectionProps> = ({ 
  fontSize, 
  fontWeight, 
  onFontSizeChange, 
  onFontWeightChange 
}) => {
  return (
    <PropertySection
      title={m['chatPanel.elementEditor.sections.typography']()}
      icon={<Type className="h-4 w-4" />}
    >
      <div className="grid grid-cols-2 gap-3">
        <PropertyInput
          label={m['chatPanel.elementEditor.fields.fontSize']()}
          value={fontSize || ''}
          onChange={onFontSizeChange}
          placeholder="20"
        />
        <div className="space-y-1">
          <Label className="text-xs text-fg-muted">{m['chatPanel.elementEditor.fields.fontWeight']()}</Label>
          <Select
            value={fontWeight || 'normal'}
            onValueChange={onFontWeightChange}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder={m['chatPanel.elementEditor.fontWeights.normal']()} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">{m['chatPanel.elementEditor.fontWeights.normal']()}</SelectItem>
              <SelectItem value="bold">{m['chatPanel.elementEditor.fontWeights.bold']()}</SelectItem>
              <SelectItem value="lighter">{m['chatPanel.elementEditor.fontWeights.lighter']()}</SelectItem>
              <SelectItem value="100">100</SelectItem>
              <SelectItem value="200">200</SelectItem>
              <SelectItem value="300">300</SelectItem>
              <SelectItem value="400">400</SelectItem>
              <SelectItem value="500">500</SelectItem>
              <SelectItem value="600">600</SelectItem>
              <SelectItem value="700">700</SelectItem>
              <SelectItem value="800">800</SelectItem>
              <SelectItem value="900">900</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </PropertySection>
  )
}
