/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * render-filetree.tsx
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

import type {GitHubFileNode} from "@/lib/file";
import * as m from '@/paraglide/messages'

function getMarginLeft(depth: number) {
    return `${depth * 16 + 4}px`
}

const getFileIconPath = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase() || ''

    switch (ext) {
        case 'ts':
            return '/images/file-icons/typescript.svg'
        case 'tsx':
            return '/images/file-icons/react.svg'
        case 'js':
        case 'jsx':
            return '/images/file-icons/javascript.svg'
        case 'css':
            return '/images/file-icons/css.svg'
        case 'html':
            return '/images/file-icons/html.svg'
        case 'json':
            return '/images/file-icons/json.svg'
        case 'svelte':
            return '/images/file-icons/svelte.svg'
        case 'vue':
            return '/images/file-icons/vue.svg'
        case 'md':
            return '/images/file-icons/markdown.svg'
        default:
            return '/images/file-icons/txt.svg'
    }
}

const FolderIcon = ({isOpen}: { isOpen: boolean }) => (
    <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        xmlns="http://www.w3.org/2000/svg"
        className="inline-block flex-shrink-0"
        aria-hidden="true"
    >
        {isOpen ? (
            // Open folder - with visible opening and perspective
            <>
                <path
                    d="M1.5 2h5l1 2h7a1.5 1.5 0 0 1 1.5 1.5V4.5h-14v-2A1.5 1.5 0 0 1 1.5 2z"
                    fill="#FFA000"
                />
                <path
                    d="M0 5l2 7.5a1 1 0 0 0 1 .5h12a1 1 0 0 0 1-.5l2-7.5H0z"
                    fill="#FFCA28"
                />
            </>
        ) : (
            // Closed folder - lighter color and simpler shape
            <path
                d="M.5 3a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5h13a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5H7l-1-2H.5z"
                fill="#FFC107"
            />
        )}
    </svg>
)

const FileIcon = ({filename}: { filename: string }) => {
    return (
        <img
            src={getFileIconPath(filename)}
            alt={m["ide.fileTree.fileIcon.alt"]({ filename })}
            width={16}
            height={16}
            className="inline-block flex-shrink-0"
            aria-hidden="true"
        />
    )
}

// Truncate file name helper function, keep file extension
const getTruncatedFileName = (filename: string, maxLength = 24) => {
    if (filename.length <= maxLength) return filename;
    
    const lastDotIndex = filename.lastIndexOf('.');
    // If no extension or hidden file
    if (lastDotIndex <= 0) {
        return `${filename.slice(0, maxLength - 3)}...`;
    }
    
    const extension = filename.slice(lastDotIndex);
    const nameWithoutExt = filename.slice(0, lastDotIndex);
    
    // Ensure at least 3 characters + ... + extension are displayed
    if (maxLength < extension.length + 6) {
        return `${nameWithoutExt.slice(0, 3)}...${extension}`;
    }
    
    const truncatedLength = maxLength - extension.length - 3;
    return `${nameWithoutExt.slice(0, truncatedLength)}...${extension}`;
};

export const RenderFileTree = (props: {
    files: GitHubFileNode[] | undefined
    toggleFolder: (path: string) => void
    prefetchFileContent: (file: string) => void
    expandedFolders: Set<string>
    currentPath: string | null
    setCurrentPath: (file: string) => void
}) => {
    if (!props.files) return null;
    
    
    return (
        <ul className="flex flex-col  file-tree space-y-0.5 p-0 m-0">
            {props.files.map((file) => (
                <li key={file.path} className="relative  p-0 m-0 before:content-none">
                    {/* Tree connector lines */}
                    {file.depth > 0 && (
                        <>
                            {/* Vertical connector line */}
                            <div
                                className="absolute w-px bg-gray-300 dark:bg-gray-600"
                                style={{
                                    left: `${file.depth * 16 - 8}px`,
                                    top: 0,
                                    bottom: 0,
                                    zIndex: 1
                                }}
                            />
                            {/* Horizontal connector line */}
                            <div
                                className="absolute h-px bg-gray-300 dark:bg-gray-600"
                                style={{
                                    left: `${file.depth * 16 - 8}px`,
                                    width: '8px',
                                    top: '50%',
                                    zIndex: 1
                                }}
                            />
                        </>
                    )}
                    <div style={{paddingLeft: getMarginLeft(file.depth)}}>
                        <button
                            type="button"
                            onClick={() => {
                                // Record file path
                                
                                // Check if path contains duplicate directory segments, e.g., src/src
                                const checkPath = (path: string): string => {
                                    if (path.includes('/')) {
                                        const pathParts = path.split('/');
                                        for (let i = 0; i < pathParts.length - 1; i++) {
                                            if (pathParts[i] === pathParts[i + 1]) {
                                                // Found duplicate directory, remove duplicate part
                                                const correctedParts = pathParts.filter(
                                                    (part, index) => !(index === i + 1 && part === pathParts[i])
                                                );
                                                const correctedPath = correctedParts.join('/');
                                                return correctedPath;
                                            }
                                        }
                                    }
                                    return path;
                                };
                                
                                const checkedPath = checkPath(file.path);
                                
                                if (file.type === 'dir') {
                                    props.toggleFolder(checkedPath)
                                } else {
                                    props.prefetchFileContent(checkedPath)
                                    props.setCurrentPath(checkedPath)
                                }
                            }}
                            aria-label={file.type === 'dir' ? m["ide.fileTree.accessibility.folderLabel"]({ name: file.name }) : m["ide.fileTree.accessibility.fileLabel"]({ name: file.name })}
                            className={`px-2 py-1.5 text-left w-full flex items-center gap-2 text-sm rounded transition-colors duration-200 min-w-0 ${
                                props.currentPath === file.path
                                    //                  ? 'bg-accent bg-opacity-15 text-fg-default dark:text-white font-medium shadow-sm '
                                    //                                     : 'hover:-subtle dark:hover:bg-gray-700 text-fg-default dark:text-gray-200'
                                    ? `${'bg-cyan-500'.replace(
                                        'bg-',
                                        'bg-opacity-20 bg-'
                                    )} text-gray-900 dark:text-white shadow-sm`
                                    : 'hover:-subtle dark:hover:bg-gray-700 text-fg-default dark:text-gray-200'
                            }`}
                        >
                            <span className="flex-shrink-0 select-none">
                                {file.type === 'dir' ? (
                                    <FolderIcon isOpen={props.expandedFolders.has(file.path)}/>
                                ) : (
                                    <FileIcon filename={file.name}/>
                                )}
                            </span>
                            <span 
                                className="truncate select-none"
                                title={file.name} // Add full file name tooltip
                            >
                                {getTruncatedFileName(file.name)}
                            </span>
                        </button>
                    </div>
                    {file.children && props.expandedFolders.has(file.path) && (
                        <RenderFileTree {...props} files={file.children}/>
                    )}
                </li>
            ))}
        </ul>
    )
}
