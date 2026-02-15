/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * use-deployment.ts
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

import { useCallback, useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@libra/ui/components/sonner'
import * as m from '@/paraglide/messages'
import { useTRPC } from '@/trpc/client'
import { authClient } from '@libra/auth/auth-client'
import type {
  CustomDomainStatus,
  UseDeploymentReturn,
  DeploymentApiRequest,
  DeploymentApiResponse
} from '../types/deployment'
import { env } from '@/env.mjs'

// Define types for better type safety
interface DeploymentError {
  message: string
  code?: string
}

interface DeploymentResult {
  /** The Workers URL returned after successful deployment. */
  workerUrl: string
  /** Optional human-readable message from the API. */
  message?: string
}

// Direct deployment API call function
const deployProjectDirect = async (params: DeploymentApiRequest): Promise<DeploymentApiResponse> => {
  const deployWorkerUrl = env.NEXT_PUBLIC_DEPLOY_URL

  try {
    const response = await fetch(`${deployWorkerUrl}/deploy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(params)
    })

    if (!response.ok) {
      const errorText = await response.text()

      // Handle specific error cases
      if (response.status === 409) {
        // Concurrent deployment in progress
        let errorMessage = 'Another deployment is already in progress. Please wait for it to complete.'
        try {
          const errorData = JSON.parse(errorText)
          if (errorData.message) {
            errorMessage = errorData.message
          }
        } catch {
          // Use default message if JSON parsing fails
        }
        const error = new Error(errorMessage) as Error & { status: number; code: string }
        error.status = 409
        error.code = 'DEPLOYMENT_IN_PROGRESS'
        throw error
      }

      throw new Error(`Deployment failed: ${response.status} ${errorText}`)
    }

    const result = await response.json()
    
    // Ensure the response has the expected structure
    if (!result || typeof result !== 'object') {
      throw new Error('Invalid response format from deployment API')
    }
    
    return result as DeploymentApiResponse
  } catch (error) {
    // Handle network errors and other fetch failures
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      // This is likely a CORS or network connectivity issue
      console.error('Network error during deployment:', error)
      throw new Error('Failed to connect to deployment service. Please check your network connection and try again.')
    }
    
    // Re-throw other errors as-is
    throw error
  }
}

export function useDeployment(projectId: string): UseDeploymentReturn {
  const [isDeploying, setIsDeploying] = useState(false)
  const [deployProgress, setDeployProgress] = useState(0)
  const [deployStage, setDeployStage] = useState('')
  const [showDeployDialog, setShowDeployDialog] = useState(false)
  const [deployResult, setDeployResult] = useState<DeploymentResult | null>(null)
  const [isCustomDomainLoading, setIsCustomDomainLoading] = useState(false)
  const [previousDeploymentStatus, setPreviousDeploymentStatus] = useState<string | null>(null)

  // Frontend-driven deployment state - takes priority over backend polling
  const [frontendDeploymentActive, setFrontendDeploymentActive] = useState(false)
  const [deploymentStartTime, setDeploymentStartTime] = useState<number | null>(null)

  // Get TRPC utils and query client
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  // Mutation for updating deployment status
  const updateDeploymentStatusMutation = useMutation(
    trpc.project.updateDeploymentStatus.mutationOptions({
      onSuccess: () => {
        // Refresh project data after status update
        queryClient.invalidateQueries({
          queryKey: ['project']
        })
      },
      onError: (error) => {
        console.error('Failed to update deployment status:', error)
      }
    })
  )

  // Query project data to get existing deployment URL
  const projectQuery = useQuery(
    trpc.project.getById.queryOptions(
      { id: projectId },
      { enabled: !!projectId }
    )
  )

  // Type the project query data properly
  const projectData = projectQuery.data as { deploymentStatus?: string; productionDeployUrl?: string } | undefined

  // Determine if we should poll deployment status
  // Poll when actively deploying OR when database shows intermediate states
  // Also poll when frontend has initiated deployment (with a small delay to avoid race conditions)
  const shouldPollDeployment = isDeploying ||
    frontendDeploymentActive ||
    projectData?.deploymentStatus === 'deploying' ||
    projectData?.deploymentStatus === 'preparing'

  // Query deployment status with TanStack Query polling
  const deploymentStatusQuery = useQuery(
    trpc.project.getDeploymentStatus.queryOptions(
      { projectId },
      {
        enabled: !!projectId && shouldPollDeployment,
        refetchInterval: shouldPollDeployment ? 10000 : false, // Poll every 10 seconds
        refetchIntervalInBackground: true,
        staleTime: 0, // Always consider stale to ensure fresh data
        refetchOnWindowFocus: true,
      }
    )
  )

  // Handle deployment status query errors
  useEffect(() => {
    if (deploymentStatusQuery.isError && isDeploying) {
      console.error('Failed to fetch deployment status:', deploymentStatusQuery.error)

      // Check if project has a valid deployment URL as fallback verification
      if (projectData?.productionDeployUrl) {
        console.log('Deployment status query failed, but project has valid deployment URL:', projectData.productionDeployUrl)

        // If we have a deployment URL, consider the deployment successful
        // This handles cases where deployment succeeded but status query fails
        const result: DeploymentResult = {
          workerUrl: projectData.productionDeployUrl,
          message: 'Deployment completed successfully (verified via project URL)'
        }

        setDeployResult(result)
        setDeployProgress(100)
        setDeployStage(m["ide.deploymentHook.deploymentComplete"]())

        // Show success toast for recovered deployment status
        toast.success(m["ide.deploymentHook.deploymentSuccess"]({ url: projectData.productionDeployUrl }))

        // Update deployment status to deployed if not already
        if (projectData.deploymentStatus !== 'deployed') {
          updateDeploymentStatusMutation.mutate({
            projectId,
            deploymentStatus: 'deployed',
            productionDeployUrl: projectData.productionDeployUrl
          })
        }

        // Stop deployment UI after delay
        setTimeout(() => {
          setIsDeploying(false)
          setDeployProgress(0)
          setDeployStage('')
        }, 2000)
      } else {
        // Only show error if we don't have a fallback deployment URL
        // Don't show error toast for status polling failures during active deployment
        // The deployment might still be successful
        console.log('Deployment status query failed and no fallback URL available')
      }
    }
  }, [deploymentStatusQuery.isError, deploymentStatusQuery.error, isDeploying, projectData, projectId, updateDeploymentStatusMutation.mutate])

  // Handle deployment status changes
  useEffect(() => {
    // If status query failed but we're deploying, check for fallback verification
    if (!deploymentStatusQuery.data && isDeploying && deploymentStatusQuery.isError) {
      // This case is already handled in the error handling useEffect above
      return
    }

    if (!deploymentStatusQuery.data) return

    const status = deploymentStatusQuery.data.status
    const dbStatus = deploymentStatusQuery.data.deploymentStatus

    // Log status for debugging
    console.log('Deployment status update:', {
      status: status.status,
      dbStatus,
      isDeploying,
      hasOutput: !!status.output?.workerUrl,
      error: status.error,
      queryError: deploymentStatusQuery.isError
    })

    // Track if this is a status transition
    const isStatusTransition = previousDeploymentStatus !== null && previousDeploymentStatus !== status.status
    const isTransitioningToComplete = isStatusTransition && status.status === 'complete' && 
      (previousDeploymentStatus === 'running' || previousDeploymentStatus === 'queued')

    // Update previous status for next comparison
    setPreviousDeploymentStatus(status.status)

    // Update UI based on deployment status
    switch (status.status) {
      case 'queued':
        // Handle deployment queue phase (mapped from 'preparing' in backend)
        if (!isDeploying) {
          setIsDeploying(true)
          setDeployProgress(20)
          // Show success toast only on transition to queued (deployment started)
          if (isStatusTransition) {
            toast.success(m["ide.deploymentHook.deploymentStarted"]())
          }
        }
        setDeployStage(m["ide.deploymentHook.preparingEnvironment"]())
        break
      case 'running':
        // Only set isDeploying if we're not already in a deployment state
        if (!isDeploying) {
          setIsDeploying(true)
          setDeployProgress(50)
        } else {
          // If already deploying, just update progress more conservatively
          setDeployProgress(prev => Math.min(prev + 5, 85))
        }
        setDeployStage(m["ide.deploymentHook.deploymentInProgress"]())
        break
      case 'complete':
        // Only show success if:
        // 1. We have a valid worker URL
        // 2. We were actively deploying (isDeploying is true)
        // 3. This is a transition TO complete from running/queued (not already complete)
        if (status.output?.workerUrl && isDeploying && isTransitioningToComplete) {
          const result: DeploymentResult = {
            workerUrl: status.output.workerUrl,
            message: status.output.message
          }
          setDeployResult(result)
          setDeployProgress(100)
          setDeployStage(m["ide.deploymentHook.deploymentComplete"]())

          // Only show success toast for actual deployment completion transitions
          toast.success(m["ide.deploymentHook.deploymentSuccess"]({ url: status.output.workerUrl }))

          // Only update deployment status if it's not already 'deployed'
          if (dbStatus !== 'deployed') {
            updateDeploymentStatusMutation.mutate({
              projectId,
              deploymentStatus: 'deployed',
              productionDeployUrl: status.output.workerUrl
            })
          }

          // Clear frontend deployment state on successful completion
          setFrontendDeploymentActive(false)
          setDeploymentStartTime(null)

          // Stop deployment UI after delay but keep dialog open to show redeploy button
          setTimeout(() => {
            setIsDeploying(false)
            // Don't close the dialog - let user close it manually to see redeploy option
            // setShowDeployDialog(false)
            setDeployProgress(0)
            setDeployStage('')
          }, 2000)
        } else if (status.output?.workerUrl && !isDeploying && !isTransitioningToComplete) {
          // This is an existing deployment - don't set deployResult
          // deployResult should only be set for NEW deployments that just completed
          // The existing URL will be handled by existingDeployUrl in the return object
        }
        break
      case 'errored':
        // Handle deployment workflow errors
        // First check if this is a real deployment failure or just a status query issue
        if (projectData?.productionDeployUrl && isDeploying) {
          // We have a deployment URL, so the deployment likely succeeded
          // This might be a status query error, not a deployment failure
          console.log('Status shows errored but project has deployment URL, treating as success:', projectData.productionDeployUrl)

          const result: DeploymentResult = {
            workerUrl: projectData.productionDeployUrl,
            message: 'Deployment completed successfully (recovered from status error)'
          }

          setDeployResult(result)
          setDeployProgress(100)
          setDeployStage(m["ide.deploymentHook.deploymentComplete"]())

          // Show success toast for recovered deployment
          toast.success(m["ide.deploymentHook.deploymentSuccess"]({ url: projectData.productionDeployUrl }))

          // Update deployment status to deployed
          updateDeploymentStatusMutation.mutate({
            projectId,
            deploymentStatus: 'deployed',
            productionDeployUrl: projectData.productionDeployUrl
          })

          // Stop deployment UI after delay
          setTimeout(() => {
            setIsDeploying(false)
            setDeployProgress(0)
            setDeployStage('')
          }, 2000)
        } else {
          // This is a genuine deployment failure
          setDeployStage(m["ide.deploymentHook.deploymentFailed"]())
          setIsDeploying(false)

          // Clear frontend deployment state on failure
          setFrontendDeploymentActive(false)
          setDeploymentStartTime(null)

          // Only show error toast if we were actively deploying
          if (isDeploying) {
            toast.error(m["ide.deploymentHook.deploymentError"]({
              message: status.error || 'Deployment failed'
            }))
          }

          // Only reset deployment status if it's not already 'failed' or 'idle'
          if (dbStatus !== 'failed' && dbStatus !== 'idle') {
            updateDeploymentStatusMutation.mutate({
              projectId,
              deploymentStatus: 'failed'
            })
          }

          setTimeout(() => {
            setDeployProgress(0)
            setDeployStage('')
          }, 3000)
        }
        break
      case 'unknown':
        // For unknown status, be very conservative if frontend initiated deployment
        if (frontendDeploymentActive) {
          // If frontend initiated deployment, don't reset state on unknown status
          // This prevents race conditions where frontend sets deploying=true but backend hasn't updated yet
          console.log('Unknown status during frontend-initiated deployment, keeping state active')
          break
        }

        // For non-frontend initiated deployments, check if we should stop polling
        if (dbStatus !== 'preparing' && dbStatus !== 'deploying' && isDeploying) {
          setIsDeploying(false)
          setDeployProgress(0)
          setDeployStage('')
        }
        break
    }
  }, [deploymentStatusQuery.data, deploymentStatusQuery.isError, projectData, projectId, updateDeploymentStatusMutation.mutate, isDeploying, previousDeploymentStatus])

  // Get user session and organization info for direct API calls
  const { data: session } = authClient.useSession()
  const { data: activeOrganization } = authClient.useActiveOrganization()

  // Query custom domain status with aggressive refetch strategy
  const customDomainQuery = useQuery(
    trpc.customDomain.getCustomDomainStatus.queryOptions(
      { projectId },
      { 
        enabled: !!projectId,
        staleTime: 5 * 1000, // 5 seconds for faster updates
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      }
    )
  )

  // Deploy project mutation using direct API call
  const deployProjectMutation = useMutation({
    mutationFn: async ({ projectId, customDomain }: { projectId: string; customDomain?: string }) => {
      // Validate required data
      if (!session?.user?.id) {
        throw new Error('User session not found')
      }
      if (!activeOrganization?.id) {
        throw new Error('Active organization not found')
      }
      if (!projectQuery.data) {
        throw new Error('Project data not found')
      }
      // Prepare deployment request
      const deploymentRequest: DeploymentApiRequest = {
        projectId,
        customDomain,
        orgId: activeOrganization.id,
        userId: session.user.id
      }

      // Call deployment API directly
      return await deployProjectDirect(deploymentRequest)
    },
    onSuccess: async (data) => {
      // Log successful deployment initiation for debugging
      console.log('Deployment initiated successfully:', data)
      
      // Don't update deployment status here - the backend already set it to 'preparing'
      // Don't show success toast immediately - let polling handle status updates
      // This prevents conflicting toasts when there are deployment errors

      // Force refresh the project query to get the updated deployment status
      queryClient.invalidateQueries({
        predicate: (query) => {
          return Array.isArray(query.queryKey) && query.queryKey[0] === 'project'
        }
      })
    },
    onError: (error: Error & { status?: number; code?: string }) => {
      // Handle concurrent deployment error specifically
      if (error.status === 409 && error.code === 'DEPLOYMENT_IN_PROGRESS') {
        setDeployStage(m["ide.deploymentHook.deploymentInProgress"]())
        toast.error(error.message)
        setIsDeploying(false)

        // Don't reset deployment status for concurrent deployment errors
        // The deployment is already in progress, so keep the current status
        setTimeout(() => {
          setDeployProgress(0)
          setDeployStage('')
        }, 3000)
        return
      }

      // Handle other deployment errors (API call failures, not workflow errors)
      setDeployStage(m["ide.deploymentHook.deploymentFailed"]())
      toast.error(m["ide.deploymentHook.deploymentError"]({ message: error.message }))
      setIsDeploying(false)

      // Clear frontend deployment state on API error
      setFrontendDeploymentActive(false)
      setDeploymentStartTime(null)

      // For API call failures, reset to idle to allow immediate retry
      // This is different from workflow failures which should be marked as 'failed'
      updateDeploymentStatusMutation.mutate({
        projectId,
        deploymentStatus: 'idle'
      })

      setTimeout(() => {
        setDeployProgress(0)
        setDeployStage('')
      }, 3000)
    }
  })

  // Custom domain mutations
  const setCustomDomainMutation = useMutation(
    trpc.customDomain.setCustomDomain.mutationOptions({
      onSuccess: () => {
        toast.success(m["ide.deployment.dialog.customDomainSetSuccess"]())
        queryClient.invalidateQueries({
          predicate: (query) => {
            return Array.isArray(query.queryKey) &&
                   query.queryKey[0] === 'customDomain' &&
                   query.queryKey[1] === 'getCustomDomainStatus'
          }
        })
        queryClient.invalidateQueries({
          queryKey: ['customDomain', 'getMembershipStatus']
        })
        queryClient.invalidateQueries({
          predicate: (query) => {
            return Array.isArray(query.queryKey) &&
                   query.queryKey[0] === 'project'
          }
        })
        customDomainQuery.refetch()
      },
      onError: (error: DeploymentError) => {
        toast.error(m["ide.deployment.dialog.customDomainSetFailed"]({ message: error.message }))
      }
    })
  )

  const verifyCustomDomainMutation = useMutation(
    trpc.customDomain.verifyCustomDomain.mutationOptions({
      onSuccess: () => {
        toast.success(m["ide.deployment.dialog.customDomainVerifySuccess"]())
        queryClient.invalidateQueries({
          predicate: (query) => {
            return Array.isArray(query.queryKey) &&
                   query.queryKey[0] === 'customDomain' &&
                   query.queryKey[1] === 'getCustomDomainStatus'
          }
        })
        queryClient.invalidateQueries({
          predicate: (query) => {
            return Array.isArray(query.queryKey) &&
                   query.queryKey[0] === 'project'
          }
        })
        customDomainQuery.refetch()
      },
      onError: (error: DeploymentError) => {
        toast.error(m["ide.deployment.dialog.customDomainVerifyFailed"]({ message: error.message }))
      }
    })
  )

  const removeCustomDomainMutation = useMutation(
    trpc.customDomain.removeCustomDomain.mutationOptions({
      onSuccess: () => {
        toast.success(m["ide.deployment.dialog.customDomainRemoved"]())
        queryClient.invalidateQueries({
          predicate: (query) => {
            return Array.isArray(query.queryKey) &&
                   query.queryKey[0] === 'customDomain' &&
                   query.queryKey[1] === 'getCustomDomainStatus'
          }
        })
        queryClient.invalidateQueries({
          predicate: (query) => {
            return Array.isArray(query.queryKey) &&
                   query.queryKey[0] === 'project'
          }
        })
        customDomainQuery.refetch()
      },
      onError: (error: DeploymentError) => {
        toast.error(m["ide.deployment.dialog.customDomainRemoveFailed"]({ message: error.message }))
      }
    })
  )

  // Handle deployment button click - show confirmation dialog
  const handleDeployClick = useCallback(() => {
    if (!projectId) {
      toast.error(m["ide.deploymentHook.cannotDeployNoProjectId"]())
      return
    }
    // Don't clear deployResult here - it should persist until a new deployment starts
    // This ensures the dialog shows the complete success view with custom domain options
    // deployResult will be cleared in handleDeployConfirm when actually starting a new deployment
    setShowDeployDialog(true)
  }, [projectId])

  // Handle actual deployment after confirmation
  const handleDeployConfirm = useCallback(async () => {
    if (!projectId) {
      toast.error(m["ide.deploymentHook.cannotDeployNoProjectId"]())
      return
    }

    try {
      // Clear any previous deployment result when starting a new deployment
      // This ensures the dialog doesn't immediately show success for old deployments
      setDeployResult(null)

      // Reset previous deployment status to track new deployment transitions
      setPreviousDeploymentStatus(null)

      // FRONTEND-FIRST APPROACH: Set deployment state immediately and persistently
      setFrontendDeploymentActive(true)
      setDeploymentStartTime(Date.now())
      setIsDeploying(true)
      setDeployProgress(10)
      setDeployStage(m["ide.deploymentHook.preparingEnvironment"]())

      console.log('Frontend-initiated deployment started', {
        projectId,
        timestamp: new Date().toISOString()
      })

      // Call the deployment API directly - it will handle state validation
      await deployProjectMutation.mutateAsync({ projectId })

    } catch (error) {
      // For frontend-initiated deployments, be more conservative about resetting state
      // Only reset on non-409 errors (409 means deployment is actually proceeding)
      if ((error as Error & { status?: number; code?: string })?.status === 409) {
        console.log('409 error during frontend-initiated deployment, keeping state active', error)
        // Don't reset frontend deployment state - the deployment is actually proceeding
      } else {
        console.log('Non-409 error during frontend-initiated deployment, resetting state', error)
        setFrontendDeploymentActive(false)
        setDeploymentStartTime(null)
        setIsDeploying(false)
      }
      // Error handling is done in the mutation onError callback
      console.error('Deployment initiation failed:', error)
    }
  }, [projectId, deployProjectMutation])

  // Custom domain handlers
  const handleSetCustomDomain = useCallback(async (domain: string) => {
    setIsCustomDomainLoading(true)
    try {
      await setCustomDomainMutation.mutateAsync({ projectId, customDomain: domain })
    } finally {
      setIsCustomDomainLoading(false)
    }
  }, [projectId, setCustomDomainMutation])

  const handleVerifyCustomDomain = useCallback(async () => {
    setIsCustomDomainLoading(true)
    try {
      await verifyCustomDomainMutation.mutateAsync({ projectId })
    } finally {
      setIsCustomDomainLoading(false)
    }
  }, [projectId, verifyCustomDomainMutation])

  const handleRemoveCustomDomain = useCallback(async () => {
    setIsCustomDomainLoading(true)
    try {
      await removeCustomDomainMutation.mutateAsync({ projectId })
    } finally {
      setIsCustomDomainLoading(false)
    }
  }, [projectId, removeCustomDomainMutation])

  return {
    isDeploying,
    deployProgress,
    deployStage,
    showDeployDialog,
    setShowDeployDialog,
    handleDeployClick,
    handleDeployConfirm,
    deployResult,
    // Simplified state - no more manual polling
    workflowId: null,
    workflowStatus: deploymentStatusQuery.data?.status || null,
    isPollingStatus: shouldPollDeployment,
    pollingCount: 0,
    errorCount: 0,
    isCircuitBreakerOpen: false,
    ...(projectData?.productionDeployUrl
      ? { existingDeployUrl: projectData.productionDeployUrl }
      : {}),
    customDomainStatus: customDomainQuery.data as CustomDomainStatus,
    handleSetCustomDomain,
    handleVerifyCustomDomain,
    handleRemoveCustomDomain,
    isCustomDomainLoading,
  }
}