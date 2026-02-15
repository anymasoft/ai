
/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * files.ts
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

import { api } from "@/trpc/server";
import {buildFileMap, type FileContentMap, type FileStructure, tryCatch} from "@libra/common";
import {buildFiles as buildFilesWithHistory} from "@libra/common";

/**
 * Build file map and tree structure.
 * Convert file structure into a map and tree for backend processing and querying.
 * @param fileStructure Original file structure data
 * @returns Object containing file map and tree structure
 */
export function buildFiles(fileStructure: FileStructure) {
  return buildFileMap(fileStructure);
}

/**
 * Convert file content map to XML format.
 * For ts and tsx files, line numbers will be added to the content.
 * @param fileContentMap File content map
 * @param projectId Project ID
 * @returns Formatted XML string
 */
export function buildFilesToXml(fileContentMap: FileContentMap, projectId: string): string {
  
  // Extract file content from the file map
  const files = Object.entries(fileContentMap).map(([filename, fileInfo]) => {
    // Check if the file is ts, tsx, js, or jsx
    const isTypeScript = filename.endsWith('.ts') || filename.endsWith('.tsx') || filename.endsWith('.js') || filename.endsWith('.jsx');
    
    // Get file content as string
    const contentStr = typeof fileInfo.content === 'string' ? fileInfo.content : '';
    
    // Add line numbers if it is a ts, tsx, js, or jsx file
    let processedContent = contentStr;
    if (isTypeScript && contentStr) {
      processedContent = contentStr
        .split('\n')
        .map((line: string, index: number) => `${index + 1}: ${line}`)
        .join('\n');
    }
    
    return {
      filename,
      content: processedContent
    };
  });
  
  // Build file XML string
  const fileXmls = files
    .map(
      (file) => `
  <file filename="${file.filename}">
    <![CDATA[
${file.content}
    ]]>
  </file>`,
    )
    .join('\n');

  // Return complete project XML
  return `
<project id="${projectId}">
${fileXmls}
</project>
  `.trim();
}

/**
 * Helper function to build XML content for a single target file
 */
export const buildSingleFileXml = (fileMap: any, targetFilename: string, projectId: string): string => {
  const fileInfo = fileMap[targetFilename]
  if (!fileInfo || !fileInfo.content) {
    return `<project id="${projectId}">
  <file path="${targetFilename}">
    <!-- File not found in project -->
  </file>
</project>`
  }

  // Extract the actual content from the file info object
  const fileContent = fileInfo.content

  // Check if the file is ts, tsx, js, or jsx and add line numbers
  const isTypeScript = targetFilename.endsWith('.ts') || targetFilename.endsWith('.tsx') ||
                      targetFilename.endsWith('.js') || targetFilename.endsWith('.jsx')

  let processedContent = fileContent
  if (isTypeScript && fileContent) {
    processedContent = fileContent
      .split('\n')
      .map((line: string, index: number) => `${index + 1}: ${line}`)
      .join('\n')
  }

  return `<project id="${projectId}">
  <file path="${targetFilename}">
    <![CDATA[
${processedContent}
    ]]>
  </file>
</project>`
}

/**
 * Merge fileMap and file differences in initialMessages to get the final content.
 * @param projectId Project ID
 * @returns Object containing the merged fileMap
 */
export async function mergeFiles(projectId: string) {
  const [result, error] = await tryCatch(async () => {
    // Get initial file structure
    const initFiles = await api.file.getFileTree();

    // Get history messages
    const initialMessages = await api.history.getAll({id: projectId});

    // Use buildFiles function from @/lib/utils to process file structure and apply history file diffs
    const { fileMap, treeContents } = buildFilesWithHistory(initFiles, initialMessages);

    return {
      fileMap
    };
  });

  if (error) {
    throw new Error(`Failed to merge files: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return result;
}