/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * image-render.tsx
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

import React from 'react'
import * as m from '@/paraglide/messages'

interface ImageRendererProps {
  codeContent: string
  fullPath: string
}

/**
 * Image file rendering component
 */
export function ImageRender({ codeContent, fullPath }: ImageRendererProps) {
  // Check if it's an SVG file
  const isSvgFile = fullPath.toLowerCase().endsWith('.svg')
  
  // Check if content is an image URL or Base64
  if (codeContent && (codeContent.startsWith('http') || codeContent.startsWith('data:'))) {
    // If it's URL or Base64, use directly as src
    return (
      <div className='flex items-center justify-center h-full w-full p-4 overflow-auto scrollable-container'>
        <img
          src={codeContent}
          alt={`Image: ${fullPath}`}
          className='max-w-full max-h-full object-contain'
        />
      </div>
    )
  }
  if (isSvgFile && codeContent && codeContent.trim().startsWith('<svg')) {
    // If it's an SVG file and content contains SVG tags, render SVG content directly
    return (
      <div
        className='flex items-center justify-center h-full w-full p-4 overflow-auto scrollable-container'
        dangerouslySetInnerHTML={{ __html: codeContent }}
      />
    )
  }
  // For other images, display content area directly
  return (
    <div className='flex flex-col items-center justify-center h-full w-full p-4 overflow-auto scrollable-container'>
      <div className='text-gray-800 dark:text-gray-200 text-center mb-4'>
        {isSvgFile ? m["ide.fileTree.imageRender.svgFile"]() : m["ide.fileTree.imageRender.imageFile"]()}: {fullPath}
      </div>
      <div className='bg-gray-100 dark:bg-gray-800 p-4 rounded-md w-full overflow-auto'>
        <pre className='whitespace-pre-wrap text-xs'>{codeContent}</pre>
      </div>
    </div>
  )
}
