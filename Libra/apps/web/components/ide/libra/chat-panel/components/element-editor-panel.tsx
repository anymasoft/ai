/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * element-editor-panel.tsx
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

import { useCallback } from 'react'
import { Button } from '@libra/ui/components/button'
import { cn } from '@libra/ui/lib/utils'
import { RotateCcw, Type, X } from 'lucide-react'
import * as m from '@/paraglide/messages'
import type { ElementEditingState, IframeInfoItem } from '../types'
import { ColorSection } from './sections/color-section'
import { ContentSection } from './sections/content-section'
import { SpacingSection } from './sections/spacing-section'
import { TypographySection } from './sections/typography-section'

interface ElementEditorPanelProps {
  editingState: ElementEditingState
  onPropertyChange: (property: string, value: string) => void
  onApplyChanges: () => void
  onCancelChanges: () => void
  onDeleteElement: () => void
  onClose: () => void
  onSubmitToAI?: (message: string, selectedItems: IframeInfoItem[]) => Promise<void>
  className?: string
}

export const ElementEditorPanel: React.FC<ElementEditorPanelProps> = ({
  editingState,
  onPropertyChange,
  onApplyChanges,
  onCancelChanges,
  onDeleteElement,
  onClose,
  onSubmitToAI,
  className,
}) => {
  const { selectedElement, currentProperties } = editingState

  const handleContentChange = useCallback(
    (value: string) => {
      onPropertyChange('content', value)
    },
    [onPropertyChange]
  )

  const handleSpacingChange = useCallback(
    (type: 'margin' | 'padding', side: string, value: string) => {
      const property = `${type}${side.charAt(0).toUpperCase() + side.slice(1)}`

      // Validate numeric value (allow empty string for reset)
      if (value !== '' && !/^\d*\.?\d*$/.test(value)) {
        return
      }

      onPropertyChange(property, value)
    },
    [onPropertyChange]
  )

  // Handle AI submission
  const handleSubmitToAI = useCallback(async () => {
    if (!onSubmitToAI || !selectedElement || !currentProperties) return

    const { generateModificationMessage, createEnhancedElement } = await import(
      './utils/ai-submission'
    )
    const message = generateModificationMessage(selectedElement, currentProperties)

    const enhancedElement = createEnhancedElement(selectedElement, currentProperties)

    // Apply local changes immediately
    onApplyChanges()

    // Close panel immediately after starting submission
    onClose()

    // Submit to AI in background (fire and forget)
    onSubmitToAI(message, [enhancedElement]).catch((_) => {})
  }, [onSubmitToAI, selectedElement, currentProperties, onApplyChanges, onClose])

  // Handle local changes application
  const handleApplyChanges = useCallback(() => {
    onApplyChanges()
    // Auto-close panel after applying local changes
    onClose()
  }, [onApplyChanges, onClose])

  if (!selectedElement || !currentProperties) {
    return null
  }

  return (
    <div
      className={cn(
        'bg-background border border-border rounded-lg shadow-lg',
        'animate-in slide-in-from-bottom-2 duration-200',
        className
      )}
    >
      {/* Header */}
      <div className='flex items-center justify-between p-3 border-b border-border'>
        <div className='flex items-center gap-2'>
          <Type className='h-4 w-4 text-accent' />
          <span className='text-sm font-medium text-fg'>
            {m['chatPanel.elementEditor.title']()}
          </span>
        </div>
        <Button variant='ghost' size='sm' onClick={onClose} className='h-6 w-6 p-0 hover:bg-muted'>
          <X className='h-3 w-3' />
        </Button>
      </div>

      {/* Content */}
      <div className='max-h-80 overflow-y-auto'>
        <ContentSection content={currentProperties.content || ''} onChange={handleContentChange} />

        <TypographySection
          fontSize={currentProperties.fontSize || ''}
          fontWeight={currentProperties.fontWeight || ''}
          onFontSizeChange={(value: string) => onPropertyChange('fontSize', value)}
          onFontWeightChange={(value: string) => onPropertyChange('fontWeight', value)}
        />

        <ColorSection
          color={currentProperties.color || ''}
          onChange={(value: string) => onPropertyChange('color', value)}
        />

        <SpacingSection
          type='margin'
          values={{
            top: currentProperties.marginTop || '',
            right: currentProperties.marginRight || '',
            bottom: currentProperties.marginBottom || '',
            left: currentProperties.marginLeft || '',
          }}
          onChange={handleSpacingChange}
        />

        <SpacingSection
          type='padding'
          values={{
            top: currentProperties.paddingTop || '',
            right: currentProperties.paddingRight || '',
            bottom: currentProperties.paddingBottom || '',
            left: currentProperties.paddingLeft || '',
          }}
          onChange={handleSpacingChange}
        />
      </div>

      {/* Footer */}
      <div className='flex items-center justify-between p-3 border-t border-border bg-muted/20'>
        <Button
          variant='ghost'
          size='sm'
          onClick={onDeleteElement}
          className='flex items-center gap-1 text-xs text-destructive hover:text-destructive/80'
        >
          <X className='h-3 w-3' />
          {m['chatPanel.elementEditor.buttons.deleteElement']()}
        </Button>
        <div className='flex items-center gap-2'>
          <Button
            variant='ghost'
            size='sm'
            onClick={onCancelChanges}
            className='flex items-center gap-1 text-xs text-fg-muted hover:text-fg'
          >
            <RotateCcw className='h-3 w-3' />
            {m['chatPanel.elementEditor.buttons.cancel']()}
          </Button>
          <Button
            variant='default'
            size='sm'
            onClick={onSubmitToAI ? handleSubmitToAI : handleApplyChanges}
            className='text-xs'
          >
            {onSubmitToAI
              ? m['chatPanel.elementEditor.buttons.submitToAI']()
              : m['chatPanel.elementEditor.buttons.applyChanges']()}
          </Button>
        </div>
      </div>
    </div>
  )
}
