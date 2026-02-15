/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * file-utils.ts
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

/**
 * File operation utility functions
 */

/**
 * Get file extension
 * @param fileName File name
 * @returns Lowercase file extension
 */
const getFileExtension = (fileName: string): string => {
  const parts = fileName.split('.');
  return parts.length > 1 ? parts.pop()?.toLowerCase() || '' : '';
};

/**
 * Decompose file path into filename and directory
 * @param path File path
 * @returns Object containing filename and directory
 */
export const getFilePathParts = (path: string) => {
  // Ensure correct path format
  if (!path) return { fileName: '', directory: '' };
  
  const normalizedPath = path.replace(/\/+/g, '/'); // Replace multiple slashes with one
  const parts = normalizedPath.split('/');
  const fileName = parts.pop() || '';
  const directory = parts.join('/');
  
  
  return { fileName, directory };
}; 