/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * utils.ts
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

import type { FileStructure } from '@libra/common'
import type { FileContentMap, TreeNode } from './types'

/**
 * Type guard: Check if it's a file type
 */
export function isFileType(
  data: any
): data is { type: 'file'; content: string; isBinary: boolean } {
  return (
    data &&
    typeof data === 'object' &&
    data.type === 'file' &&
    typeof data.content === 'string' &&
    typeof data.isBinary === 'boolean'
  )
}

/**
 * Type guard: Check if it's a directory type
 */
export function isDirectoryType(
  data: any
): data is { type: 'directory'; children: Record<string, any> } {
  return (
    data &&
    typeof data === 'object' &&
    data.type === 'directory' &&
    data.children &&
    typeof data.children === 'object'
  )
}

/**
 * Create flat file mapping table
 */
export function createFileContentMap(fileStructure: FileStructure): FileContentMap {

  const fileMap: FileContentMap = {}

  // Recursively process file structure
  function processStructure(structure: any, basePath: string): void {
    if (!structure || typeof structure !== 'object') {
      return
    }

    // Process each entry in the top-level object
    for (const [key, entry] of Object.entries(structure)) {
      if (!entry || typeof entry !== 'object') continue

      // Build complete path
      const path = basePath ? (key.includes('/') ? key : `${basePath}/${key}`) : key

      // Handle file type
      if (isFileType(entry)) {
        fileMap[path] = {
          content: entry.content || '',
          isBinary: entry.isBinary,
          type: entry.type,
          parentPath: basePath || null,
        }
      }
      // Handle directory type
      else if (isDirectoryType(entry)) {
        // If directory has children, process recursively
        if (entry.children && typeof entry.children === 'object') {
          processStructure(entry.children, path)
        }
      }
      // Handle special case: JSON directly contains file content
      else if (key === 'json' && typeof entry === 'object') {
        processStructure(entry, basePath)
      }
      // Handle other potentially nested objects
      else if (typeof entry === 'object') {
        // Check if it contains type field to determine if it's a file or directory structure
        if ('type' in entry) {
          const typedEntry = entry as any
          if (typedEntry.type === 'file' && 'content' in typedEntry) {
            fileMap[path] = {
              content: typedEntry.content || '',
              isBinary: typedEntry.isBinary !== undefined ? typedEntry.isBinary : false,
              type: 'file',
              parentPath: basePath || null,
            }
          } else if (typedEntry.type === 'directory' && typedEntry.children) {
            processStructure(typedEntry.children, path)
          }
        } else {
          // Possibly a nested object, continue recursion
          processStructure(entry, path)
        }
      }
    }
  }

  processStructure(fileStructure, '')
  return fileMap
}

/**
 * Convert file structure to tree structure
 */
export function convertToTreeStructure(fileStructure: FileStructure): TreeNode[] {

  if (!fileStructure || typeof fileStructure !== 'object') {
    return []
  }

  const fileCount = Object.keys(fileStructure).length

  // Store results
  const rootItems: TreeNode[] = []

  // Recursively process directories and files
  function processEntry(
    path: string,
    entry: any,
    depth = 0,
    parentPath: string | null = null
  ): TreeNode | null {
    if (!entry || typeof entry !== 'object') {
      return null
    }

    const pathParts = path.split('/')
    const name = pathParts[pathParts.length - 1]


    if (entry.type === 'file') {
      // Handle file
      const fileNode: TreeNode = {
        name: name || '',
        path,
        type: 'file',
        _links: { self: path },
        depth,
        parentPath,
        content: entry.content,
      }
      return fileNode
    }

    if (entry.type === 'directory') {
      // Handle directory
      const dirNode: TreeNode = {
        name: name || '',
        path,
        type: 'dir',
        _links: { self: path },
        depth,
        parentPath,
        children: [],
      }

      // Process child items
      if (entry.children && typeof entry.children === 'object') {

        // Iterate through child items
        for (const [childPath, childEntry] of Object.entries(entry.children)) {
          // Extract child path name
          const childPathParts = childPath.split('/')
          const childName = childPathParts[childPathParts.length - 1]

          // Create correct path
          const fullChildPath = childPath.includes('/') ? childPath : `${path}/${childName}`

          const childNode = processEntry(fullChildPath, childEntry, depth + 1, path)
          if (childNode) {
            dirNode.children?.push(childNode)
          }
        }

        // Sort child items in directory: first by type (directories first), then by name alphabetically
        if (dirNode.children && dirNode.children.length > 0) {
          dirNode.children.sort((a: TreeNode, b: TreeNode) => {
            // First sort by type (directories first)
            if (a.type === 'dir' && b.type === 'file') return -1
            if (a.type === 'file' && b.type === 'dir') return 1

            // If types are the same, sort alphabetically by name (case-insensitive)
            return a.name.toLowerCase().localeCompare(b.name.toLowerCase())
          })
        }
      }

      return dirNode
    }

    return null
  }

  // Process all top-level items
  for (const [path, entry] of Object.entries(fileStructure)) {
    const node = processEntry(path, entry)
    if (node) {
      rootItems.push(node)
    }
  }

  // Sort root nodes
  rootItems.sort((a: TreeNode, b: TreeNode) => {
    if (a.type === 'dir' && b.type === 'file') return -1
    if (a.type === 'file' && b.type === 'dir') return 1
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase())
  })

  return rootItems
}
