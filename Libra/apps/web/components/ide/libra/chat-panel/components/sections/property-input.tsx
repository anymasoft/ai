/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * property-input.tsx
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

import { Input } from '@libra/ui/components/input'
import { Label } from '@libra/ui/components/label'

interface PropertyInputProps {
  label: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'number' | 'color'
  placeholder?: string
  suffix?: string
}

export const PropertyInput: React.FC<PropertyInputProps> = ({ 
  label, 
  value, 
  onChange, 
  type = 'text',
  placeholder,
  suffix 
}) => {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-fg-muted">{label}</Label>
      <div className="flex items-center gap-1">
        <Input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-8 text-xs"
        />
        {suffix && (
          <span className="text-xs text-fg-muted min-w-fit">{suffix}</span>
        )}
      </div>
    </div>
  )
}
