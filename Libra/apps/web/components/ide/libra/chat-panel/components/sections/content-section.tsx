/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * content-section.tsx
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
import { Textarea } from '@libra/ui/components/textarea'
import { Type } from 'lucide-react'
import { PropertySection } from './property-section'

interface ContentSectionProps {
  content: string
  onChange: (value: string) => void
}

export const ContentSection: React.FC<ContentSectionProps> = ({ content, onChange }) => {
  return (
    <PropertySection
      title={m['chatPanel.elementEditor.sections.content']()}
      icon={<Type className="h-4 w-4" />}
      defaultExpanded={true}
    >
      <div className="space-y-1">
        <Label className="text-xs text-fg-muted">{m['chatPanel.elementEditor.fields.content']()}</Label>
        <Textarea
          value={content || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={m['chatPanel.elementEditor.fields.contentPlaceholder']()}
          className="min-h-[60px] text-xs resize-none"
        />
      </div>
    </PropertySection>
  )
}
