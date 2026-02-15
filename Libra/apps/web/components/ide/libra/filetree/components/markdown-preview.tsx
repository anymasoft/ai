/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * markdown-preview.tsx
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
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MarkdownPreviewProps {
  codeContent: string
  isDarkMode: boolean
}

/**
 * Markdown preview component
 */
export function MarkdownPreview({ codeContent, isDarkMode }: MarkdownPreviewProps) {
  const bgColor = isDarkMode ? '#1a1b26' : '#ffffff'
  
  return (
    <div
      className='h-full w-full p-4 overflow-auto scrollable-container prose prose-sm max-w-none dark:prose-invert'
      style={{ backgroundColor: bgColor }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Custom component styles to match theme
          h1: ({ children }: any) => <h1 className='text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100'>{children}</h1>,
          h2: ({ children }: any) => <h2 className='text-xl font-semibold mb-3 text-gray-900 dark:text-gray-100'>{children}</h2>,
          h3: ({ children }: any) => <h3 className='text-lg font-medium mb-2 text-gray-900 dark:text-gray-100'>{children}</h3>,
          p: ({ children }: any) => <p className='mb-3 text-gray-800 dark:text-gray-200 leading-relaxed'>{children}</p>,
          code: ({ children }: any) => <code className='bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm font-mono text-gray-900 dark:text-gray-100'>{children}</code>,
          pre: ({ children }: any) => <pre className='bg-gray-100 dark:bg-gray-800 p-3 rounded-md overflow-x-auto text-sm font-mono text-gray-900 dark:text-gray-100'>{children}</pre>,
          blockquote: ({ children }: any) => <blockquote className='border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic text-gray-700 dark:text-gray-300'>{children}</blockquote>,
          ul: ({ children }: any) => <ul className='list-disc list-inside mb-3 text-gray-800 dark:text-gray-200'>{children}</ul>,
          ol: ({ children }: any) => <ol className='list-decimal list-inside mb-3 text-gray-800 dark:text-gray-200'>{children}</ol>,
          li: ({ children }: any) => <li className='mb-1'>{children}</li>,
          a: ({ href, children }: any) => <a href={href} className='text-blue-600 dark:text-blue-400 hover:underline'>{children}</a>,
          table: ({ children }: any) => <table className='min-w-full border-collapse border border-gray-300 dark:border-gray-600 mb-4'>{children}</table>,
          th: ({ children }: any) => <th className='border border-gray-300 dark:border-gray-600 px-3 py-2 bg-gray-100 dark:bg-gray-800 font-semibold text-gray-900 dark:text-gray-100'>{children}</th>,
          td: ({ children }: any) => <td className='border border-gray-300 dark:border-gray-600 px-3 py-2 text-gray-800 dark:text-gray-200'>{children}</td>,
        }}
      >
        {codeContent}
      </ReactMarkdown>
    </div>
  )
}
