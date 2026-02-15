/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * ai-submission.ts
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

import type { IframeInfoItem, ElementProperties } from '../../types'

export const generateModificationMessage = (
  selectedElement: IframeInfoItem | null,
  currentProperties: ElementProperties | null
): string => {
  if (!selectedElement || !currentProperties) return ''

  const changes: string[] = []

  // Check for content changes
  if (currentProperties.content) {
    changes.push(`content to "${currentProperties.content}"`)
  }

  // Check for style changes
  if (currentProperties.fontSize) {
    changes.push(`font size to ${currentProperties.fontSize}`)
  }
  if (currentProperties.fontWeight && currentProperties.fontWeight !== 'normal') {
    changes.push(`font weight to ${currentProperties.fontWeight}`)
  }
  if (currentProperties.color) {
    changes.push(`color to ${currentProperties.color}`)
  }

  // Check for spacing changes
  const spacingProps = ['marginTop', 'marginRight', 'marginBottom', 'marginLeft',
                       'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft']
  const spacingChanges = spacingProps.filter(prop => currentProperties[prop])
  if (spacingChanges.length > 0) {
    changes.push(`spacing properties (${spacingChanges.join(', ')})`)
  }

  const elementType = selectedElement.elementType || selectedElement.tagName || 'element'
  const elementLocation = selectedElement.filePath ?
    ` in ${selectedElement.filePath}${selectedElement.lineNumber ? `:${selectedElement.lineNumber}` : ''}` : ''

  if (changes.length === 0) {
    return `Apply modifications to ${elementType}${elementLocation}`
  }

  return `Apply element modifications: Update ${elementType}${elementLocation} - ${changes.join(', ')}`
}

export const createEnhancedElement = (
  selectedElement: IframeInfoItem,
  currentProperties: ElementProperties
): IframeInfoItem => {
  // Extract filename from element's data-libra-id or filePath
  const targetFilename = selectedElement.filePath || selectedElement.fileName ||
                       selectedElement['data-libra-id'] || null

  // Ensure type field is present for API validation
  const elementType = selectedElement.type || selectedElement.elementType || 'element'

  // Create enhanced element data with current properties for AI context
  return {
    ...selectedElement,
    type: elementType, // Ensure type field is always present
    modifiedProperties: currentProperties,
    isDirectModification: true,
    targetFilename: targetFilename
  }
}
