/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * types.ts
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

export type FileType = {
  type: 'file'
  modified: string
  original: string | null
  path: string
  basename: string
  dirname: string
  description: string
  isNew?: boolean
}
/**
 * File and directory structure type definition
 */
export type TFolder = {
  id: string
  type: 'folder'
  name: string
  children: (TFile | TFolder)[]
}

export type TFile = {
  id: string
  type: 'file'
  name: string
}

export type TTab = TFile & {
  saved: boolean
}

/**
 * File content mapping type
 */
export type FileContentMap = {
  [path: string]: {
    content: string
    isBinary: boolean
    type: string
    parentPath?: string | null
  }
}

/**
 * Tree node type definition
 */
export type TreeNode = {
  name: string
  path: string
  type: 'file' | 'dir'
  _links: { self: string }
  depth: number
  parentPath: string | null
  children?: TreeNode[]
  content?: string
}

/**
 * File structure type definition
 */
export type FileEntry = {
  type: 'file'
  isBinary: boolean
  content: string
}

export type DirectoryEntry = {
  type: 'directory'
  children: Record<string, FileEntry | DirectoryEntry>
}

export type FileOrDirEntry = FileEntry | DirectoryEntry

export type FileStructure = Record<string, FileOrDirEntry>

export type GetFileContentInput = {
  path: string
}
