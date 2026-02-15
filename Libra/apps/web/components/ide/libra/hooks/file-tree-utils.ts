/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * file-tree-utils.ts
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

import type { TreeNode } from "@libra/common";

/**
 * Update node at specific path in tree
 *
 * @param nodes Current tree node array
 * @param targetPath Target file path
 * @param newContent New file content
 * @returns Updated tree node array
 */
export const updateNodeInTree = (nodes: TreeNode[], targetPath: string, newContent: string): TreeNode[] => {
  return nodes.map(node => {
    // Find matching file node
    if (node.type === 'file' && node.path === targetPath) {
      return { ...node, content: newContent };
    }
    
    // If it's a directory with child nodes, recursively update
    if (node.type === 'dir' && node.children && node.children.length > 0) {
      // Check if this directory is the parent directory of the target path
      if (targetPath.startsWith(node.path + '/')) {
        return { ...node, children: updateNodeInTree(node.children, targetPath, newContent) };
      }
    }
    
    return node;
  });
};

/**
 * Add new file to tree
 *
 * @param nodes Current tree node array
 * @param filePath File path
 * @param content File content
 * @returns Updated tree node array
 */
export const addFileToTree = (nodes: TreeNode[], filePath: string, content: string): TreeNode[] => {
  // Parse file path
  const pathParts = filePath.split('/');
  const fileName = pathParts[pathParts.length - 1];
  const parentPath = pathParts.length > 1 ? pathParts.slice(0, -1).join('/') : null;
  
  // If it's a root level file
  if (!parentPath) {
    // Check if file already exists
    const existingFileIndex = nodes.findIndex(node => 
      node.type === 'file' && (node.path === filePath || node.name === fileName)
    );
    
    if (existingFileIndex >= 0) {
      // Update existing file
      const newNodes = [...nodes];
      newNodes[existingFileIndex] = {
        ...newNodes[existingFileIndex],
        content,
        path: filePath
      } as TreeNode;
      return newNodes;
    }
     
    // Add new file to root level
    return [
      ...nodes,
      {
        name: fileName || filePath.split('/').pop() || "Untitled file",
        path: filePath,
        type: 'file' as const,
        _links: { self: filePath },
        depth: 0,
        parentPath: null,
        content
      } as TreeNode
    ];
  }
  
  // If it's a nested file, need to find or create parent directory
  const parentDirIndex = nodes.findIndex(node => 
    node.type === 'dir' && node.path === parentPath
  );
  
  // If parent directory doesn't exist at current level
  if (parentDirIndex < 0) {
    // Need to recursively create parent directory structure
    const parentParts = parentPath.split('/').filter(Boolean);
    let currentPath = '';
    let currentNodes = nodes;
    
    // Recursively create directory structure
    for (let i = 0; i < parentParts.length; i++) {
      const part = parentParts[i];
      if (!part) continue;
      
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      
      const dirIndex = currentNodes.findIndex(n => n.type === 'dir' && n.path === currentPath);
      
      if (dirIndex < 0) {
        // Create new directory
        const newDir: TreeNode = {
          name: part,
          path: currentPath,
          type: 'dir',
          _links: { self: currentPath },
          depth: i,
          parentPath: i > 0 ? parentParts.slice(0, i).join('/') : null,
          children: []
        };
        
        currentNodes.push(newDir);
        currentNodes = newDir.children || [];
      } else if (currentNodes[dirIndex]) {
        // Ensure children property exists
        const dirNode = currentNodes[dirIndex];
        if (!dirNode.children) {
          dirNode.children = [];
        }
        currentNodes = dirNode.children;
      } else {
        // Handle exceptional cases
        break;
      }
    }
    
    // Add file to the final directory
    currentNodes.push({
      name: fileName || filePath.split('/').pop() || "Untitled file",
      path: filePath,
      type: 'file' as const,
      _links: { self: filePath },
      depth: parentParts.length,
      parentPath,
      content
    } as TreeNode);
    
    return [...nodes];
  }
  
  // Parent directory exists, add file to parent directory
  const newNodes = [...nodes];
  const parentNode = newNodes[parentDirIndex];
  
  // Ensure parent node and children property exist
  if (!parentNode) {
    return nodes; // Return original nodes without changes
  }
  
  // Ensure children property exists
  if (!parentNode.children) {
    parentNode.children = [];
  }
  
  const children = parentNode.children;
  
  // Check if file already exists in parent directory
  const existingFileIndex = children.findIndex(node => 
    node.type === 'file' && (node.path === filePath || node.name === fileName)
  );
  
  // File already exists: update file content
  if (existingFileIndex >= 0) {
    const existingNode = children[existingFileIndex];
    if (existingNode) {
      children[existingFileIndex] = {
        ...existingNode,
        content,
        path: filePath
      } as TreeNode;
    }
  }
  
  // File doesn't exist: add new file
  if (existingFileIndex < 0) {
    children.push({
      name: fileName || filePath.split('/').pop() || "Untitled file",
      path: filePath,
      type: 'file' as const,
      _links: { self: filePath },
      depth: (parentNode.depth ?? 0) + 1,
      parentPath,
      content
    } as TreeNode);
  }
  
  // Update parent node
  newNodes[parentDirIndex] = {
    ...parentNode,
    children
  } as TreeNode;
  
  return newNodes;
};

/**
 * Check if file already exists in tree
 *
 * @param nodes Tree node array
 * @param targetPath Target file path
 * @returns Whether file exists
 */
export const findNodeInTree = (nodes: TreeNode[], targetPath: string): boolean => {
  for (const node of nodes) {
    if (node.path === targetPath) {
      return true;
    }
    
    if (node.type === 'dir' && node.children && node.children.length > 0) {
      if (findNodeInTree(node.children, targetPath)) {
        return true;
      }
    }
  }
  
  return false;
};

/**
 * Detect if file is binary
 *
 * @param filePath File path
 * @returns Whether file is binary
 */
export const isBinaryFile = (filePath: string): boolean => {
  const fileExtension = filePath.split('.').pop()?.toLowerCase() || '';
  return [
    'jpg', 'jpeg', 'png', 'gif', 'bmp', 'ico', 'svg', 
    'webp', 'mp3', 'mp4', 'wav', 'ogg', 'pdf', 'zip', 
    'gz', 'tar', 'rar'
  ].includes(fileExtension);
}; 