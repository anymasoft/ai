/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * code-explorer-top-bar.tsx
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

import {CgMenuLeft} from "react-icons/cg";
import {FaCompress, FaExpand, FaDownload, FaEdit} from "react-icons/fa";
import {useFileTreeStore} from "@/lib/hooks/use-file-tree-store";
import * as m from '@/paraglide/messages';
import { Button } from '@libra/ui/components/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@libra/ui/components/tooltip'
import { Download } from 'lucide-react'
import { toast } from '@libra/ui/components/sonner'

interface CodeExplorerTopBarProps {
    activeTab: 'code'
    isFullScreen: boolean
    isSidebarOpen: boolean
    isEditMode: boolean
    hasEditingCapability: boolean
    setActiveTab: (tab: 'code') => void
    setIsFullScreen: React.Dispatch<React.SetStateAction<boolean>>
    setIsSidebarOpen: (isOpen: boolean) => void
    setIsEditMode: (enabled: boolean) => void
}

export function CodeExplorerTopBar({
                                       activeTab,
                                       isFullScreen,
                                       isSidebarOpen,
                                       isEditMode,
                                       hasEditingCapability,
                                       setActiveTab,
                                       setIsFullScreen,
                                       setIsSidebarOpen,
                                       setIsEditMode,
                                   }: CodeExplorerTopBarProps) {
    // Get download state and methods from store
    const {
        isDownloading,
        downloadProgress,
        downloadProjectAsZip,
        fileContentMap,
        isLoading
    } = useFileTreeStore();
    // Toggle sidebar state
    const handleSidebarToggle = () => {
        setIsSidebarOpen(!isSidebarOpen);
    };

    // Handle download functionality
    const handleDownload = async () => {
        try {
            await downloadProjectAsZip()
        } catch (error) {
            toast.error(m['ide.navbar.downloadFailed']())
        }
    }

    // Toggle fullscreen state
    const handleFullScreenToggle = () => {
        const newFullScreenState = !isFullScreen;

        // Set local state
        setIsFullScreen(newFullScreenState);

        // Trigger custom event to notify layout-wrapper to update fullscreen state
        const fullScreenEvent = new CustomEvent('ide-fullscreen-change', {
            detail: { isFullScreen: newFullScreenState }
        });

        // Dispatch event globally
        window.dispatchEvent(fullScreenEvent);

        // Log the event
    };

    return (
        <div className="flex items-center border-b justify-between">
            <div className="flex items-center gap-1 px-2">
                {/* Sidebar toggle button */}
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant='ghost'
                                size='icon'
                                onClick={handleSidebarToggle}
                                className='h-8 w-8 md:h-9 md:w-9 hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors'
                                aria-label={isSidebarOpen ? m['ide.fileExplorer.hideSidebar']() : m['ide.fileExplorer.showSidebar']()}
                            >
                                <CgMenuLeft className="w-4 h-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>
                                {isSidebarOpen ? m['ide.fileExplorer.hideSidebar']() : m['ide.fileExplorer.showSidebar']()}
                            </p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
                
                {/* Code browser button - always active */}
                <button
                    type="button"
                    onClick={() => setActiveTab('code')}
                    className="px-4 py-2 text-sm font-medium transition-colors relative text-fg-default dark:text-fg-default"
                >
                    <span className="hidden sm:inline">{m['ide.fileExplorer.codeBrowser']()}</span>
                    <span className="sm:hidden">{m['ide.fileExplorer.code']()}</span>
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
                </button>
            </div>
            <div className="flex items-center gap-1 pr-2">
                {/* Download button */}
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant='ghost'
                                size='icon'
                                onClick={handleDownload}
                                disabled={isDownloading}
                                className='h-8 w-8 md:h-9 md:w-9 hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                                aria-label={m['ide.navbar.downloadAriaLabel']()}
                            >
                                <Download
                                    className={`h-3.5 w-3.5 md:h-4 md:w-4 ${isDownloading ? 'animate-pulse' : ''}`}
                                    aria-hidden='true'
                                />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>
                                {isDownloading ? m['ide.navbar.downloading']() : m['ide.navbar.download']()}
                            </p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>

                {/* Fullscreen toggle button */}
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant='ghost'
                                size='icon'
                                onClick={handleFullScreenToggle}
                                className='h-8 w-8 md:h-9 md:w-9 hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors'
                                aria-label={isFullScreen ? m['ide.fileExplorer.exitFullscreen']() : m['ide.fileExplorer.enterFullscreen']()}
                            >
                                {isFullScreen ? (
                                    <FaCompress className="w-4 h-4" />
                                ) : (
                                    <FaExpand className="w-4 h-4" />
                                )}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>
                                {isFullScreen ? m['ide.fileExplorer.exitFullscreen']() : m['ide.fileExplorer.enterFullscreen']()}
                            </p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>
        </div>
    )
}