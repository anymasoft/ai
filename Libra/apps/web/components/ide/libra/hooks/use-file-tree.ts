/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * use-file-tree.ts
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

import { useFileTreeStore } from "@/lib/hooks/use-file-tree-store";
import { useProjectContext } from '@/lib/hooks/use-project-id';
import { useTRPC } from '@/trpc/client';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { FileStructure, HistoryType } from "@libra/common";
import { buildFiles } from "@libra/common";
import { useCallback, useEffect } from "react";
import { toast } from "sonner";
import type { UseFileTreeReturn } from "../../types";
import { usePreviewStore } from './use-preview-store';
import { loadDefaultFile } from "./file-tree-handlers";
import { triggerDeploymentScreenshot } from "@/lib/utils/screenshot-client";
import { authClient } from "@libra/auth/auth-client";

/**
 * Hook for handling file tree loading, transformation and file selection
 */
export function useFileTree(initialMessages: HistoryType): UseFileTreeReturn {
  // Use Zustand store instead of useState
  const {
    isLoading: isLoadingFileTree,
    setIsLoading: setIsLoadingFileTree,
    fileStructure,
    setFileStructure,
    treeContents,
    setTreeContents,
    fileContentMap,
    setFileContentMap,
    currentPath,
    setCurrentPath,
    currentCode,
    setCurrentCode,
    error,
    setError,
    handleFileSelect: storeHandleFileSelect,
    updateFileContent: storeUpdateFileContent
  } = useFileTreeStore();

  // Use context and API
  const trpc = useTRPC();
  const { projectId } = useProjectContext();

  // Get user session and organization info for screenshot service
  const { data: session } = authClient.useSession();
  const { data: activeOrganization } = authClient.useActiveOrganization();

  // Use preview Store instead of Context
  const setPreviewURL = usePreviewStore(state => state.setPreviewURL);
  const setIsPreviewVisible = usePreviewStore(state => state.setIsPreviewVisible);

  // Get file tree structure
  const fileTreeQuery = useQuery(
    trpc.file.getFileTree.queryOptions()
  );

  // Mutation for updating container content
  const updateContainerMutation = useMutation(
    trpc.project.updateContainerContent.mutationOptions({
      onSuccess: async (data) => {
        if (data.success && data.previewURL) {
          // Update preview URL and show preview
          setPreviewURL(data.previewURL);
          setIsPreviewVisible(true);
          // toast.success('Project deployed successfully');

          // Trigger screenshot service after successful deployment
          if (session?.user?.id && activeOrganization?.id && projectId) {
            try {
              // Generate a simple planId for deployment screenshots
              const deploymentPlanId = `deployment-${Date.now()}`;

              console.log('Triggering screenshot after successful deployment', {
                projectId,
                planId: deploymentPlanId,
                orgId: activeOrganization.id,
                userId: session.user.id,
                previewURL: data.previewURL
              });

              const screenshotResult = await triggerDeploymentScreenshot(
                projectId,
                deploymentPlanId,
                activeOrganization.id,
                session.user.id,
                data.previewURL
              );

              if (screenshotResult.success) {
                console.log('Screenshot triggered successfully after deployment');
              } else {
                console.warn('Screenshot trigger failed after deployment:', screenshotResult.error);
              }
            } catch (error) {
              // Don't show error to user as screenshot is not critical for deployment
              console.error('Failed to trigger screenshot after deployment:', error);
            }
          } else {
            console.warn('Missing required data for screenshot trigger:', {
              hasUserId: !!session?.user?.id,
              hasOrgId: !!activeOrganization?.id,
              hasProjectId: !!projectId
            });
          }
        } else {
          toast.error('Deployment successful, but unable to get preview URL');
        }
      },
      onError: () => {
        toast.error('Deployment failed, please try again later');
      },
    })
  );

  // File selection handler function
  const handleFileSelect = useCallback((path: string) => {
    storeHandleFileSelect(path);
  }, [storeHandleFileSelect]);

  // File prefetch function
  const prefetchFileContent = useCallback((path: string) => {
    if (!path) {
      return;
    }

    if (path === currentPath) {
      return;
    }

    handleFileSelect(path);
  }, [currentPath, handleFileSelect]);

  // Handle file tree query results
  useEffect(() => {
    if (fileTreeQuery.isLoading) {
      setIsLoadingFileTree(true);
      return;
    }

    if (fileTreeQuery.isSuccess && fileTreeQuery.data) {
      try {
        const data = fileTreeQuery.data as FileStructure;

        if (!data || typeof data !== 'object') {
          toast.error("Invalid file structure received, please refresh and try again");
          setIsLoadingFileTree(false);
          return;
        }

        // Save original file structure
        setFileStructure(data);

        // Process file structure, apply file differences from history messages to file structure
        const { fileMap, treeContents } = buildFiles(data, initialMessages);

        // Set state
        setFileContentMap(fileMap);
        setTreeContents(treeContents);
        setIsLoadingFileTree(false);

      } catch (error) {
        toast.error("Error occurred while processing file structure");
        setIsLoadingFileTree(false);
        setError(error instanceof Error ? error : new Error("Unknown error"));
      }
    }

    if (fileTreeQuery.isError) {
      toast.error("Failed to get file structure");
      setIsLoadingFileTree(false);
      setError(fileTreeQuery.error instanceof Error ? fileTreeQuery.error : new Error("Failed to get file structure"));
    }
  }, [fileTreeQuery.data, fileTreeQuery.error, fileTreeQuery.isLoading, fileTreeQuery.isSuccess, fileTreeQuery.isError, initialMessages, setError, setFileContentMap, setFileStructure, setIsLoadingFileTree, setTreeContents]);

  // Load default file
  useEffect(() => {
    // Only try to load default file when file map has content but no current path
    if (Object.keys(fileContentMap).length > 0 && !currentPath) {
      const defaultFileResult = loadDefaultFile(fileContentMap);

      if (defaultFileResult) {
        setCurrentCode(defaultFileResult.content);
        setCurrentPath(defaultFileResult.path);
      }
    }
  }, [fileContentMap, currentPath, setCurrentCode, setCurrentPath]);

  /**
   * Deploy project changes
   * Call this function after file updates to trigger deployment and set URL
   */
  const deployChanges = useCallback(async () => {
    if (!projectId) {
      toast.error("Cannot deploy: Project ID does not exist");
      return;
    }

    try {
      await updateContainerMutation.mutateAsync({
        id: projectId
      });
      // After successful deployment, URL will be set in mutation's onSuccess callback
    } catch {
      toast.error("Deployment failed, please try again later");
    }
  }, [projectId, updateContainerMutation]);

  /**
   * Update file content
   * Used to update AI-modified file content to fileContentMap
   */
  const updateFileContent = useCallback((path: string, content: string) => {
    if (!path || content == null) {
      return false;
    }

    // Use store's update method
    const success = storeUpdateFileContent(path, content);

    if (!success) {
      // Trigger deployment after successful file update
      console.error("Failed to update file content");
      return success
    }

    return success;
  }, [storeUpdateFileContent]);

  return {
    isLoadingFileTree,
    fileStructure,
    treeContents,
    fileContentMap,
    currentPath,
    currentCode,
    handleFileSelect,
    prefetchFileContent,
    setCurrentPath,
    error,
    updateFileContent,
    deployChanges // Export deployment function for manual triggering when needed
  };
} 
