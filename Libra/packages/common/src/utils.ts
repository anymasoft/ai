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

import type { FileContentMap, TFile, TFolder, TreeNode } from './types'

/**
 * Creates an exponential smoothing easing function for Framer Motion animations.
 * This implements exponential smoothing as described in https://lisyarus.github.io/blog/posts/exponential-smoothing.html
 * where the position approaches the target value smoothly with a speed factor.
 * @param {number} speed - The speed factor that determines how quickly the value approaches the target (default: 10)
 * @returns {(t: number) => number} An easing function that takes a progress value between 0 and 1 and returns a smoothed value
 */
export const exponentialSmoothing =
  (speed = 10) =>
  (t: number): number => {
    // For Framer Motion, we want to map t from [0,1] to a smoothed value
    // Using exponential smoothing formula: 1 - exp(-speed * t)
    return 1 - Math.exp(-speed * t)
  }

/**
 * Debounce function
 * @param func The function to debounce
 * @param wait The wait time in milliseconds
 * @returns The debounced function
 */
export function debounce<T extends (...args: any[]) => void>(func: T, wait: number): T {
  let timeout: NodeJS.Timeout | null = null
  return ((...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(() => func(...args), wait)
  }) as T
}

/**
 * Deeply merge two objects
 * @param target The target object
 * @param source The source object
 * @returns The merged object
 */
export const deepMerge = (target: any, source: any) => {
  const output = { ...target }
  if (isObject(target) && isObject(source)) {
    for (const key of Object.keys(source)) {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] })
        } else {
          output[key] = deepMerge(target[key], source[key])
        }
      } else {
        Object.assign(output, { [key]: source[key] })
      }
    }
  }
  return output
}

/**
 * Check if the item is an object
 * @param item The item to check
 * @returns Whether it is an object
 */
const isObject = (item: any) => {
  return item && typeof item === 'object' && !Array.isArray(item)
}

/**
 * Sort file explorer items
 * @param items The array of items to sort
 * @returns The sorted array
 */
export function sortFileExplorer(items: (TFile | TFolder)[]): (TFile | TFolder)[] {
  return items
    .sort((a, b) => {
      // First, sort by type (folders before files)
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1
      }

      // Then, sort alphabetically by name
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    })
    .map((item) => {
      // If it's a folder, recursively sort its children
      if (item.type === 'folder') {
        return {
          ...item,
          children: sortFileExplorer(item.children),
        }
      }
      return item
    })
}

/**
 * Check if data is of file type
 * @param data The data to check
 * @returns Whether it is a file type
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
 * Check if data is of directory type
 * @param data The data to check
 * @returns Whether it is a directory type
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
 * Create a flat file content map
 * @param fileStructure The file structure object
 * @returns The file content map
 */
export function createFileContentMap(fileStructure: any): FileContentMap {
  const fileMap: FileContentMap = {}

  // Recursively process file structure
  function processStructure(structure: any, basePath: string): void {
    if (!structure || typeof structure !== 'object') {
      return
    }

    // Process each entry of the top-level object
    for (const [key, entry] of Object.entries(structure)) {
      if (!entry || typeof entry !== 'object') continue

      // Construct full path
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
      // Handle possibly nested other objects
      else if (typeof entry === 'object') {
        // Check if contains type field to determine if file or directory structure
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
          // Possibly nested object, continue recursion
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
 * @param fileStructure The file structure object
 * @param fileMap Optional file map to override original structure for tree generation
 * @returns Array of tree nodes
 */
export function convertToTreeStructure(fileStructure: any, fileMap?: FileContentMap): TreeNode[] {
  // logPrefix and related logs have been removed

  if (fileMap && Object.keys(fileMap).length > 0) {
    // If fileMap is provided, use fileMap to generate tree structure
    return buildTreeFromFileMap(fileMap)
  }

  if (!fileStructure || typeof fileStructure !== 'object') {
    // logPrefix related logs have been removed
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

      // Handle children
      if (entry.children && typeof entry.children === 'object') {
        // logPrefix related logs have been removed

        // Iterate children
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

        // Sort children in directory: first by type (dirs first), then by name alphabetically
        if (dirNode.children && dirNode.children.length > 0) {
          dirNode.children.sort((a, b) => {
            // Sort by type first (dirs first)
            if (a.type === 'dir' && b.type === 'file') return -1
            if (a.type === 'file' && b.type === 'dir') return 1
      
            // If same type, sort alphabetically by name (case-insensitive)
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
  rootItems.sort((a, b) => {
    if (a.type === 'dir' && b.type === 'file') return -1
    if (a.type === 'file' && b.type === 'dir') return 1
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase())
  })

  return rootItems
}

/**
 * Build tree structure from file map
 * @param fileMap File content map
 * @returns Array of tree structure nodes
 */
function buildTreeFromFileMap(fileMap: FileContentMap): TreeNode[] {
  // logPrefix and related logs have been removed

  // Create directory map
  const directoryMap: Record<string, TreeNode> = {}
  // Store results
  const rootItems: TreeNode[] = []

  // Sort by path to ensure parent directories processed first
  const paths = Object.keys(fileMap).sort()

  // First create all required directory structures
  for (const path of paths) {
    const fileInfo = fileMap[path]
    if (!fileInfo) continue

    const pathParts = path.split('/')
    const fileName = pathParts.pop() || ''
    let currentPath = ''
    let parentPath: string | null = null

    // Create and ensure all directories in path exist
    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i]
      if (!part) continue // Skip empty path segments

      const prevPath = currentPath

      // Build current path
      currentPath = currentPath ? `${currentPath}/${part}` : part

      // If directory does not exist, create it
      if (!directoryMap[currentPath]) {
        const dirNode: TreeNode = {
          name: part,
          path: currentPath,
          type: 'dir',
          _links: { self: currentPath },
          depth: i,
          parentPath: prevPath || null,
          children: [],
        }

        directoryMap[currentPath] = dirNode

        // If top-level directory, add to root items
        if (i === 0) {
          rootItems.push(dirNode)
        }
        // Otherwise, add directory to its parent's children
        else if (prevPath && directoryMap[prevPath]) {
          directoryMap[prevPath]?.children?.push(dirNode)
        }
      }

      parentPath = currentPath
    }

    // Handle file node
    if (fileInfo.type === 'file') {
      const fileNode: TreeNode = {
        name: fileName,
        path,
        type: 'file',
        _links: { self: path },
        depth: pathParts.length,
        parentPath,
        content: fileInfo.content,
      }

      // Add file to its parent directory
      if (parentPath && directoryMap[parentPath]) {
        directoryMap[parentPath]?.children?.push(fileNode)
      } else {
        // If no parent directory (top-level file), add to root items
        rootItems.push(fileNode)
      }
    }
  }

  // Sort children in all directories
  for (const dirPath in directoryMap) {
    const children = directoryMap[dirPath]?.children
    if (children && children.length > 0) {
      children.sort((a, b) => {
        // Sort by type first (dirs first)
        if (a.type === 'dir' && b.type === 'file') return -1
        if (a.type === 'file' && b.type === 'dir') return 1

        // If same type, sort alphabetically by name
        return a.name.toLowerCase().localeCompare(b.name.toLowerCase())
      })
    }
  }

  // Sort root nodes
  rootItems.sort((a, b) => {
    if (a.type === 'dir' && b.type === 'file') return -1
    if (a.type === 'file' && b.type === 'dir') return 1
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase())
  })

  return rootItems
}

/**
 * Build file map and tree structure
 * Convert file structure to map and tree, suitable for frontend and backend processing
 * @param fileStructure Original file structure data
 * @param initialMessages Historical messages, may contain file diffs
 * @returns Object containing file map and tree structure
 */
export function buildFiles(fileStructure: any, initialMessages?: any[]) {
  // logPrefix and related logs have been removed

  // Validate input
  if (!fileStructure || typeof fileStructure !== 'object') {
    return {
      fileMap: {},
      treeContents: [],
    }
  }

  try {
    // Create file content map
    const fileMap = createFileContentMap(fileStructure)

    // Apply incremental file diffs (if any)
    if (initialMessages && Array.isArray(initialMessages) && initialMessages.length > 0) {
      applyFileDiffs(fileMap, initialMessages)
    }

    // Generate tree structure
    const treeContents = convertToTreeStructure(fileStructure, fileMap)

    return {
      fileMap,
      treeContents,
    }
  } catch (error) {
    return {
      fileMap: {},
      treeContents: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Apply file diffs to file content map
 * @param fileMap File content map
 * @param messages Array of messages containing file diffs
 */
function applyFileDiffs(fileMap: FileContentMap, messages: any[]): void {
  // logPrefix and related logs have been removed

  // Filter messages containing file diffs
  const diffMessages = messages.filter((msg) => msg?.type === 'diff' && Array.isArray(msg.diff))

  if (diffMessages.length === 0) {
    return
  }


  // Process each diff message
  for (const diffMsg of diffMessages) {

    // Process each file's diff
    for (const fileDiff of diffMsg.diff) {
      const { path, type, modified, original } = fileDiff

      if (!path) {
        continue
      }


      switch (type) {
        case 'create':
          // Create new file
          fileMap[path] = {
            content: modified || '',
            isBinary: false, // Assume new files are text files
            type: 'file',
            parentPath: path.includes('/') ? path.split('/').slice(0, -1).join('/') : null,
          }
          break

        case 'edit':
          // Edit existing file
          if (fileMap[path]) {
            fileMap[path].content = modified || ''
          } else {
            // If file does not exist, create it
            fileMap[path] = {
              content: modified || '',
              isBinary: false,
              type: 'file',
              parentPath: path.includes('/') ? path.split('/').slice(0, -1).join('/') : null,
            }
          }
          break

        case 'delete':
          // Delete file
          if (fileMap[path]) {
            delete fileMap[path]
          } else {
          }
          break

        default:
      }
    }
  }
}

/**
 * Get file content
 * Retrieve file content from file content map by specified path, suitable for frontend and backend processing
 * @param fileMap File content map
 * @param path File path
 * @returns File content or null (if not found)
 */
export function getFileContent(fileMap: FileContentMap, path: string): string | null {
  // logPrefix and related logs have been removed

  if (!path || !fileMap) {
    return null
  }

  // Directly lookup path
  if (fileMap[path]) {
    const file = fileMap[path]
    if (file && file.type === 'file' && !file.isBinary) {
      return file.content
    }
    return null
  }

  // Try to find matching path
  const allPaths = Object.keys(fileMap)
  const matchingPath = allPaths.find((p) => {
    // Exact match
    if (p === path) return true

    // Match path ending
    if (path.includes('/')) {
      const fileName = path.split('/').pop()
      return p.endsWith(`/${fileName}`)
    }

    // Simple filename match
    return p === path || p.endsWith(`/${path}`)
  })

  if (matchingPath) {
    const file = fileMap[matchingPath]
    if (file && file.type === 'file' && !file.isBinary) {
      return file.content
    }
  }

  return null
}

/**
 * Build only file content map, without tree structure
 * @param fileStructure Original file structure data
 * @returns File content map
 */
export function buildFileMap(fileStructure: any): FileContentMap {
  // logPrefix and related logs have been removed

  // Validate input
  if (!fileStructure || typeof fileStructure !== 'object') {
    return {}
  }

  try {
    // Create file content map
    const fileMap = createFileContentMap(fileStructure)

    return fileMap
  } catch (error) {
    return {}
  }
}

// ============================================================================
// SHARED UTILITY FUNCTIONS FOR CLOUDFLARE WORKERS SERVICES
// ============================================================================

/**
 * Generate a unique request ID if not provided
 * Used across CDN, Deploy, and Dispatcher services
 */
export function getRequestId(c: any): string {
  return c?.get?.('requestId') || c?.req?.header?.('x-request-id') || crypto.randomUUID()
}

/**
 * Sleep for a specified number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Parse JSON safely with error handling
 */
export function safeJsonParse<T = unknown>(json: string, defaultValue?: T): T | null {
  try {
    return JSON.parse(json)
  } catch {
    return defaultValue ?? null
  }
}

/**
 * Stringify JSON safely with error handling
 */
export function safeJsonStringify(obj: unknown, defaultValue: string = '{}'): string {
  try {
    return JSON.stringify(obj)
  } catch {
    return defaultValue
  }
}

/**
 * Truncate string to specified length with ellipsis
 */
export function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str
  }
  return str.substring(0, maxLength - 3) + '...'
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number, decimals  = 2): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

/**
 * Format duration in milliseconds to human readable string
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`
  } else if (ms < 3600000) {
    return `${(ms / 60000).toFixed(1)}m`
  } else {
    return `${(ms / 3600000).toFixed(1)}h`
  }
}

/**
 * Check if running in development environment
 */
export function isDevelopment(): boolean {
  return (process.env.NODE_ENV as string) === 'development' || (process.env.ENVIRONMENT as string) === 'development'
}

/**
 * Check if running in production environment
 */
export function isProduction(): boolean {
  return (process.env.NODE_ENV as string) === 'production' || (process.env.ENVIRONMENT as string) === 'production'
}

/**
 * Get environment name
 */
export function getEnvironment(): string {
  return process.env.ENVIRONMENT || process.env.NODE_ENV || 'development'
}

/**
 * Check if a string is a valid URL
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

/**
 * Retry a function with exponential backoff
 * Unified implementation for all services
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number
    baseDelay?: number
    maxDelay?: number
    factor?: number
    onRetry?: (attempt: number, error: Error) => void
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    factor = 2,
    onRetry
  } = options

  let lastError: Error

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (attempt === maxRetries) {
        throw lastError
      }

      if (onRetry) {
        onRetry(attempt + 1, lastError)
      }

      const delay = Math.min(baseDelay * Math.pow(factor, attempt), maxDelay)
      await sleep(delay)
    }
  }

  throw lastError!
}



/**
 * Validate identifier format (for project IDs, worker names, etc.)
 * Supports UUID format or alphanumeric with hyphens/underscores
 */
export function validateIdentifier(
  identifier: string,
  options: {
    minLength?: number
    maxLength?: number
    allowUnderscore?: boolean
    allowHyphen?: boolean
  } = {}
): { valid: boolean; error?: string } {
  const {
    minLength = 3,
    maxLength = 63,
    allowUnderscore = true,
    allowHyphen = true
  } = options

  if (!identifier || identifier.length === 0) {
    return { valid: false, error: 'Identifier cannot be empty' }
  }

  if (identifier.length < minLength) {
    return { valid: false, error: `Identifier must be at least ${minLength} characters` }
  }

  if (identifier.length > maxLength) {
    return { valid: false, error: `Identifier cannot exceed ${maxLength} characters` }
  }

  // Check for UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  if (uuidRegex.test(identifier)) {
    return { valid: true }
  }

  // Build regex based on options
  let pattern = '^[a-zA-Z0-9]'
  const allowedChars = ['a-zA-Z0-9']

  if (allowHyphen) allowedChars.push('-')
  if (allowUnderscore) allowedChars.push('_')

  if (allowedChars.length > 1) {
    pattern += `([${allowedChars.join('')}]*[a-zA-Z0-9])?`
  }
  pattern += '$'

  const regex = new RegExp(pattern)
  if (!regex.test(identifier)) {
    const allowedStr = [
      'alphanumeric characters',
      ...(allowHyphen ? ['hyphens'] : []),
      ...(allowUnderscore ? ['underscores'] : [])
    ].join(', ')

    return {
      valid: false,
      error: `Identifier must contain only ${allowedStr} and cannot start or end with special characters`
    }
  }

  return { valid: true }
}

/**
 * Sanitize identifier for use in URLs, worker names, etc.
 */
export function sanitizeIdentifier(
  name: string,
  options: {
    maxLength?: number
    replacement?: string
    toLowerCase?: boolean
  } = {}
): string {
  const {
    maxLength = 63,
    replacement = '-',
    toLowerCase = true
  } = options

  let sanitized = name

  if (toLowerCase) {
    sanitized = sanitized.toLowerCase()
  }

  // Replace invalid characters with replacement
  sanitized = sanitized.replace(/[^a-zA-Z0-9_-]/g, replacement)

  // Remove consecutive replacements
  if (replacement) {
    const replacementRegex = new RegExp(`\\${replacement}+`, 'g')
    sanitized = sanitized.replace(replacementRegex, replacement)
  }

  // Remove leading/trailing replacements
  if (replacement) {
    const trimRegex = new RegExp(`^\\${replacement}|\\${replacement}$`, 'g')
    sanitized = sanitized.replace(trimRegex, '')
  }

  // Truncate to max length
  return sanitized.substring(0, maxLength)
}

/**
 * Check if a domain is valid for custom deployment
 */
export function isValidCustomDomain(domain: string): boolean {
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
  return domainRegex.test(domain) && domain.length <= 253
}
