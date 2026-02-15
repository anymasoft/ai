/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * use-github-integration.ts
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

'use client'

import { useState, useCallback, useEffect } from 'react'
import { toast } from '@libra/ui/components/sonner'
import { useTRPC } from '@/trpc/client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  GitHubIntegrationState,
  GitHubRepository,
  GitHubUser,
  PushToRepositoryRequest,
  ProjectRepositoryInfo,
  CreateProjectRepositoryRequest
} from './types'
import * as m from '@/paraglide/messages'

// Temporary flag to disable force push functionality (sync is still available)
const FORCE_PUSH_DISABLED = true

// Helper function to create a centered popup window
const createCenteredPopup = (url: string, name: string, width: number, height: number) => {
  const left = (window.screen.width / 2) - (width / 2)
  const top = (window.screen.height / 2) - (height / 2)

  return window.open(
    url,
    name,
    `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes,status=yes,location=yes,toolbar=no,menubar=no`
  )
}

export function useGitHubIntegration() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const [state, setState] = useState<GitHubIntegrationState>({
    auth: {
      isAuthenticated: false,
      user: null,
      isLoading: false,
      error: null
    },
    installation: null,
    repositories: [],
    selectedRepository: null,
    isCreatingRepository: false,
    isPushing: false,
    pushError: null,
    pushSuccess: false,
    isCheckingInstallation: false,
    forcePush: false
  })

  // Check GitHub installation status
  const {
    data: installationStatus,
    isLoading: isCheckingInstallation,
    refetch: refetchInstallationStatus
  } = useQuery({
    ...trpc.github.getInstallationStatus.queryOptions({}),
  })

  // Check GitHub connection status and load user data
  const {
    data: connectionStatus,
    isLoading: isCheckingConnection
  } = useQuery({
    ...trpc.github.getConnectionStatus.queryOptions({}),
  })

  const {
    data: githubUser,
    isLoading: isLoadingUser,
    error: userError
  } = useQuery({
    ...trpc.github.getUser.queryOptions({}),
    enabled: !!(connectionStatus && typeof connectionStatus === 'object' && 'isConnected' in connectionStatus && connectionStatus.isConnected === true),
    retry: false,
    throwOnError: false,
    meta: {
      // Suppress error logging for expected authentication failures
      suppressErrorLogging: true
    }
  })

  const {
    data: repositories,
    refetch: refetchRepositories
  } = useQuery({
    ...trpc.github.getRepositories.queryOptions({}),
    enabled: !!(connectionStatus && typeof connectionStatus === 'object' && 'isConnected' in connectionStatus && connectionStatus.isConnected === true),
    retry: false,
    throwOnError: false,
    meta: {
      // Suppress error logging for expected authentication failures
      suppressErrorLogging: true
    }
  })

  // Update state based on tRPC queries
  useEffect(() => {
    // Only show user-facing errors for non-authentication issues
    const getDisplayError = (error: unknown) => {
      if (!error) return null

      // Don't show authentication errors as they're expected when GitHub App isn't installed
      if (error && typeof error === 'object' && 'data' in error) {
        const errorData = error.data as { code?: string }
        if (errorData?.code === 'UNAUTHORIZED') {
          return null
        }
      }

      // Show other errors to the user
      const errorMessage = error && typeof error === 'object' && 'message' in error
        ? (error.message as string)
        : 'An error occurred'
      return errorMessage
    }

    // Type-safe connection status checking
    const isConnected = !!(
      connectionStatus &&
      typeof connectionStatus === 'object' &&
      'isConnected' in connectionStatus &&
      connectionStatus.isConnected === true
    )

    const currentUser = githubUser || null
    const currentRepos = Array.isArray(repositories) ? repositories : []
    const currentInstallation = installationStatus || null

    console.log('[GitHub Integration] State update:', {
      isConnected,
      hasUser: !!currentUser,
      repoCount: currentRepos.length,
      installation: currentInstallation,
      isCheckingConnection,
      isCheckingInstallation,
      isLoadingUser,
      userError: userError?.message
    })

    setState(prev => ({
      ...prev,
      auth: {
        isAuthenticated: isConnected,
        user: currentUser as GitHubUser | null,
        isLoading: isCheckingConnection || isLoadingUser,
        error: getDisplayError(userError)
      },
      installation: currentInstallation,
      repositories: currentRepos as GitHubRepository[],
      isCheckingInstallation
    }))
  }, [connectionStatus, githubUser, repositories, installationStatus, isCheckingConnection, isCheckingInstallation, isLoadingUser, userError])

  const pushCodeMutation = useMutation(
    trpc.github.pushCode.mutationOptions({
      onSuccess: (result: any) => {
        setState(prev => ({
          ...prev,
          isPushing: false,
          pushSuccess: true,
          pushError: null
        }))
        toast.success(result.message)
      },
      onError: (error: any) => {
        setState(prev => ({
          ...prev,
          isPushing: false,
          pushError: error.message || m['dashboard.integrations.github.messages.push_failed']()
        }))
        toast.error(error.message || m['dashboard.integrations.github.messages.push_failed']())
      }
    })
  )

  // Add mutations for installation and OAuth URLs
  const getInstallationUrlMutation = useMutation(trpc.github.getInstallationUrl.mutationOptions())
  const getOAuthUrlMutation = useMutation(trpc.github.getOAuthUrl.mutationOptions())

  const authenticateWithGitHub = useCallback(async () => {
    try {
      setState(prev => ({
        ...prev,
        auth: { ...prev.auth, isLoading: true, error: null }
      }))

      // For GitHub App, we need to open installation page in a popup
      // First get the installation URL using mutation
      const installationUrlResult = await getInstallationUrlMutation.mutateAsync({})

      // Open GitHub App installation in a centered popup window
      const popup = createCenteredPopup(
        installationUrlResult.installUrl,
        'github-app-install',
        600,
        700
      )

      if (!popup) {
        throw new Error(m['dashboard.integrations.github.messages.popup_blocked']())
      }

      // Focus the popup window
      popup.focus()

      // Monitor popup for completion
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed)

          // Give a moment for any potential redirects to complete
          setTimeout(async () => {
            try {
              console.log('[GitHub Integration] Popup closed, checking installation status...')

              // Invalidate and refetch both connection and installation status
              await queryClient.invalidateQueries({
                queryKey: trpc.github.getConnectionStatus.queryOptions({}).queryKey
              })
              await queryClient.invalidateQueries({
                queryKey: trpc.github.getInstallationStatus.queryOptions({}).queryKey
              })

              // Fetch fresh statuses
              const newConnectionStatus = await queryClient.fetchQuery(
                trpc.github.getConnectionStatus.queryOptions({})
              )
              await refetchInstallationStatus()

              console.log('[GitHub Integration] New connection status:', newConnectionStatus)

              // Check installation status instead of connection status
              const newInstallationStatus = await queryClient.fetchQuery(
                trpc.github.getInstallationStatus.queryOptions({})
              )

              console.log('[GitHub Integration] New installation status:', newInstallationStatus)

              if (newInstallationStatus?.isInstalled) {
                if (newInstallationStatus.requiresOAuth) {
                  console.log('[GitHub Integration] GitHub App installed, OAuth required for personal account')
                  toast.success('GitHub App 安装成功！正在进行仓库访问授权...')

                  // For personal accounts, show message that OAuth is required
                  console.log('[GitHub Integration] GitHub App installed, OAuth required for personal account')
                  toast.success('GitHub App 安装成功！个人账户需要点击"需要仓库访问权限"按钮进行额外授权。')
                } else {
                  console.log('[GitHub Integration] Installation successful!')
                  toast.success(m['dashboard.integrations.github.messages.installation_success']())

                  // Invalidate all GitHub-related queries to refresh data
                  await queryClient.invalidateQueries({
                    queryKey: ['github']
                  })

                  // Refresh repositories data
                  try {
                    await refetchRepositories()
                  } catch (error) {
                    // Ignore refetch errors as the main installation was successful
                    console.log('Repository refetch after installation:', error)
                  }
                }
              } else {
                console.log('[GitHub Integration] Installation not detected')
                toast.info(m['dashboard.integrations.github.messages.installation_cancelled']())
              }
            } catch (error) {
              console.error('Error checking installation status:', error)
              toast.info(m['dashboard.integrations.github.messages.installation_check_failed']())
            }

            setState(prev => ({
              ...prev,
              auth: { ...prev.auth, isLoading: false }
            }))
          }, 2000) // Increased timeout to give more time for GitHub's redirect
        }
      }, 1000)

      // Fallback timeout to prevent infinite loading
      setTimeout(() => {
        if (!popup.closed) {
          clearInterval(checkClosed)
          setState(prev => ({
            ...prev,
            auth: { ...prev.auth, isLoading: false }
          }))
        }
      }, 300000) // 5 minutes timeout

    } catch (error) {
      console.error('GitHub App installation error:', error)
      setState(prev => ({
        ...prev,
        auth: {
          ...prev.auth,
          isLoading: false,
          error: error instanceof Error ? error.message : m['dashboard.integrations.github.messages.installation_failed']()
        }
      }))
      toast.error(error instanceof Error ? error.message : m['dashboard.integrations.github.messages.installation_failed']())
    }
  }, [getInstallationUrlMutation, queryClient, refetchRepositories, refetchInstallationStatus, trpc.github.getConnectionStatus.queryOptions, trpc.github.getInstallationStatus.queryOptions])

  const authorizeUserAccess = useCallback(async () => {
    try {
      setState(prev => ({
        ...prev,
        auth: { ...prev.auth, isLoading: true, error: null }
      }))

      // Get the OAuth authorization URL using mutation
      const oauthUrlResult = await getOAuthUrlMutation.mutateAsync({})

      // Open GitHub OAuth authorization in a centered popup window
      const popup = createCenteredPopup(
        oauthUrlResult.oauthUrl,
        'github-oauth-auth',
        600,
        700
      )

      if (!popup) {
        throw new Error(m['dashboard.integrations.github.messages.popup_blocked']())
      }

      // Focus the popup window
      popup.focus()

      // Monitor popup for completion
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed)

          // Give a moment for any potential redirects to complete
          setTimeout(async () => {
            try {
              console.log('[GitHub OAuth] Popup closed, checking authorization status...')

              // Invalidate and refetch both connection and installation status
              await queryClient.invalidateQueries({
                queryKey: trpc.github.getConnectionStatus.queryOptions({}).queryKey
              })
              await queryClient.invalidateQueries({
                queryKey: trpc.github.getInstallationStatus.queryOptions({}).queryKey
              })

              // Fetch fresh statuses
              const newConnectionStatus = await queryClient.fetchQuery(
                trpc.github.getConnectionStatus.queryOptions({})
              )
              await refetchInstallationStatus()

              console.log('[GitHub OAuth] New connection status:', newConnectionStatus)

              if ((newConnectionStatus as any)?.isConnected) {
                console.log('[GitHub OAuth] Authorization successful!')
                toast.success(m['dashboard.integrations.github.messages.oauth_success']())

                // Invalidate all GitHub-related queries to refresh data
                await queryClient.invalidateQueries({
                  queryKey: ['github']
                })

                // Refresh repositories data
                try {
                  await refetchRepositories()
                } catch (error) {
                  // Ignore refetch errors as the main authorization was successful
                  console.log('Repository refetch after authorization:', error)
                }
              } else {
                console.log('[GitHub OAuth] Authorization not detected')
                toast.info(m['dashboard.integrations.github.messages.oauth_cancelled']())
              }
            } catch (error) {
              console.error('Error checking authorization status:', error)
              toast.info(m['dashboard.integrations.github.messages.oauth_check_failed']())
            }

            setState(prev => ({
              ...prev,
              auth: { ...prev.auth, isLoading: false }
            }))
          }, 2000) // Increased timeout to give more time for GitHub's redirect
        }
      }, 1000)

      // Fallback timeout to prevent infinite loading
      setTimeout(() => {
        if (!popup.closed) {
          clearInterval(checkClosed)
          setState(prev => ({
            ...prev,
            auth: { ...prev.auth, isLoading: false }
          }))
        }
      }, 300000) // 5 minutes timeout

    } catch (error) {
      console.error('GitHub OAuth authorization error:', error)
      setState(prev => ({
        ...prev,
        auth: {
          ...prev.auth,
          isLoading: false,
          error: error instanceof Error ? error.message : m['dashboard.integrations.github.messages.oauth_failed']()
        }
      }))

      // Handle specific error for organizations (OAuth not needed)
      if (error instanceof Error && error.message.includes('Organizations use installation tokens')) {
        toast.info(m['dashboard.integrations.github.messages.oauth_not_required']())
      } else {
        toast.error(error instanceof Error ? error.message : m['dashboard.integrations.github.messages.oauth_failed']())
      }
    }
  }, [getOAuthUrlMutation, queryClient, refetchRepositories, refetchInstallationStatus, trpc.github.getConnectionStatus.queryOptions, trpc.github.getInstallationStatus.queryOptions])



  const selectRepository = useCallback((repository: GitHubRepository) => {
    setState(prev => ({
      ...prev,
      selectedRepository: repository
    }))
  }, [])

  const pushToRepository = useCallback(async (request: PushToRepositoryRequest) => {
    console.log('[GitHub] pushToRepository called', {
      repositoryId: request.repository.id,
      repositoryName: request.repository.name,
      projectId: request.projectId,
      forcePush: request.forcePush,
      isAuthenticated: state.auth.isAuthenticated
    })

    if (!state.auth.isAuthenticated) {
      console.log('[GitHub] Not authenticated, aborting push')
      toast.error(m['dashboard.integrations.github.messages.not_authenticated']())
      return false
    }

    setState(prev => ({
      ...prev,
      isPushing: true,
      pushError: null,
      pushSuccess: false
    }))

    try {
      const pushParams = {
        repositoryId: request.repository.id,
        projectId: request.projectId,
        commitMessage: request.commitMessage,
        branch: request.branch || 'main',
        forcePush: FORCE_PUSH_DISABLED ? false : (request.forcePush || false),
        // If virtual repository (ID is -1), pass full_name
        ...(request.repository.id === -1 && { repositoryFullName: request.repository.full_name })
      }

      console.log('[GitHub] Calling pushCodeMutation with:', {
        repositoryId: pushParams.repositoryId,
        repositoryFullName: pushParams.repositoryFullName,
        projectId: pushParams.projectId,
        commitMessage: pushParams.commitMessage,
        branch: pushParams.branch,
        forcePush: pushParams.forcePush
      })

      await (pushCodeMutation.mutateAsync as any)(pushParams)
      console.log('[GitHub] pushCodeMutation completed successfully')
      return true
    } catch (error) {
      console.error('[GitHub] pushCodeMutation failed:', error)
      // Error handling is done in the mutation's onError callback
      return false
    }
  }, [state.auth.isAuthenticated, pushCodeMutation])

  const resetState = useCallback(() => {
    setState({
      auth: {
        isAuthenticated: false,
        user: null,
        isLoading: false,
        error: null
      },
      installation: null,
      repositories: [],
      selectedRepository: null,
      isCreatingRepository: false,
      isPushing: false,
      pushError: null,
      pushSuccess: false,
      isCheckingInstallation: false,
      forcePush: false
    })
  }, [])

  const refreshData = useCallback(async () => {
    // Type-safe connection status checking
    const isConnected = !!(
      connectionStatus &&
      typeof connectionStatus === 'object' &&
      'isConnected' in connectionStatus &&
      connectionStatus.isConnected === true
    )

    if (isConnected) {
      try {
        await refetchRepositories()
      } catch (error: unknown) {
        // Only show user-facing errors for non-authentication issues
        const isUnauthorized = error &&
          typeof error === 'object' &&
          'data' in error &&
          error.data &&
          typeof error.data === 'object' &&
          'code' in error.data &&
          error.data.code === 'UNAUTHORIZED'

        if (!isUnauthorized) {
          console.error('Failed to refresh repositories:', error)
          toast.error(m['dashboard.integrations.github.messages.refresh_failed']())
        }
      }
    }
  }, [connectionStatus, refetchRepositories])

  const checkInstallationStatus = useCallback(async () => {
    try {
      await refetchInstallationStatus()
    } catch (error) {
      console.error('Failed to check installation status:', error)
    }
  }, [refetchInstallationStatus])

  // Project-specific mutations
  const createProjectRepositoryMutation = useMutation(
    trpc.github.createProjectRepository.mutationOptions({
      onSuccess: (result: any) => {
        if (result.alreadyLinked) {
          toast.info(result.message)
        } else {
          toast.success(result.message)
        }
        // Refresh repositories list if a new repository was created
        if (result.projectUpdated) {
          refetchRepositories()
        }
      },
      onError: (error: any) => {
        toast.error(error.message || m['dashboard.integrations.github.messages.create_repo_failed']())
      }
    })
  )

  // Project-specific functions
  const getProjectRepository = useCallback(async (projectId: string): Promise<ProjectRepositoryInfo | null> => {
    try {
      const result = await queryClient.fetchQuery(
        trpc.github.getProjectRepository.queryOptions({ projectId })
      )
      return result as ProjectRepositoryInfo
    } catch (error) {
      console.error('Failed to get project repository:', error)
      return null
    }
  }, [queryClient, trpc.github.getProjectRepository])

  const createProjectRepository = useCallback(async (request: CreateProjectRepositoryRequest) => {
    if (!state.auth.isAuthenticated) {
      toast.error(m['dashboard.integrations.github.messages.not_authenticated']())
      return null
    }

    try {
      const result = await createProjectRepositoryMutation.mutateAsync(request)
      return result
    } catch (error) {
      // Error handling is done in the mutation's onError callback
      return null
    }
  }, [state.auth.isAuthenticated, createProjectRepositoryMutation])

  const setForcePush = useCallback((forcePush: boolean) => {
    // Prevent force push changes when force push is disabled
    if (FORCE_PUSH_DISABLED) {
      return
    }

    setState(prev => ({
      ...prev,
      forcePush
    }))
  }, [])

  return {
    state,
    authenticateWithGitHub,
    authorizeUserAccess,
    checkInstallationStatus,
    loadRepositories: refreshData,
    selectRepository,
    pushToRepository,
    resetState,
    setForcePush,
    // Project-specific functions
    getProjectRepository,
    createProjectRepository
  }
}
