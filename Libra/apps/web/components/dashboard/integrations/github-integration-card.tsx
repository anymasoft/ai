/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * github-integration-card.tsx
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

import { useState } from 'react'
import * as m from '@/paraglide/messages'
import { useTRPC } from '@/trpc/client'
import { useQuery, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@libra/ui/components/card'
import { Button } from '@libra/ui/components/button'
import { Badge } from '@libra/ui/components/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@libra/ui/components/avatar'
import {
  AlertCircle,
  CheckCircle,
  ExternalLink,
  Loader2,
  User
} from 'lucide-react'
import { Alert, AlertDescription } from '@libra/ui/components/alert'

// Helper function to create centered popup window
function createCenteredPopup(url: string, name: string, width: number, height: number) {
  const left = (window.screen.width / 2) - (width / 2)
  const top = (window.screen.height / 2) - (height / 2)
  
  return window.open(
    url,
    name,
    `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
  )
}

// Simple GitHub icon component
function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.867 8.166 6.839 9.489.5.092.682-.217.682-.483 0-.237-.009-.868-.014-1.703-2.782.604-3.369-1.342-3.369-1.342-.454-1.153-1.11-1.461-1.11-1.461-.908-.62.069-.608.069-.608 1.004.07 1.532 1.032 1.532 1.032.892 1.529 2.341 1.088 2.91.832.092-.646.35-1.088.636-1.339-2.221-.253-4.555-1.111-4.555-4.945 0-1.092.39-1.987 1.029-2.686-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.025A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.295 2.748-1.025 2.748-1.025.546 1.378.202 2.397.1 2.65.64.699 1.028 1.594 1.028 2.686 0 3.842-2.337 4.688-4.566 4.937.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.744 0 .268.18.579.688.481C19.135 20.162 22 16.418 22 12c0-5.523-4.477-10-10-10z"
        clipRule="evenodd"
      />
    </svg>
  )
}

export function GitHubIntegrationCard() {
  const trpc = useTRPC()
  const [isAuthenticating, setIsAuthenticating] = useState(false)

  // Check GitHub connection status
  const {
    data: connectionStatus,
    isLoading: isCheckingConnection,
    error: connectionError,
    refetch: refetchConnection
  } = useQuery({
    ...trpc.github.getConnectionStatus.queryOptions({}),
    retry: false,
  })

  // Get GitHub user info when connected - only enable when connected and handle errors gracefully
  const {
    data: githubUser,
    isLoading: isLoadingUser,
    error: userError
  } = useQuery({
    ...trpc.github.getUser.queryOptions({}),
    enabled: !!(connectionStatus && typeof connectionStatus === 'object' && 'isConnected' in connectionStatus && connectionStatus.isConnected === true),
    retry: false,
    // Don't throw on error - handle gracefully since UNAUTHORIZED is expected when not connected
    throwOnError: false,
    meta: {
      // Suppress error logging for expected authentication failures
      suppressErrorLogging: true
    }
  })

  // GitHub OAuth mutation
  const getOAuthUrlMutation = useMutation(
    trpc.github.getOAuthUrl.mutationOptions({
      onSuccess: (data) => {
        // Open OAuth flow in popup
        const popup = createCenteredPopup(
          data.oauthUrl,
          'github-oauth',
          600,
          700
        )

        if (!popup) {
          setIsAuthenticating(false)
          throw new Error(m['dashboard.integrations.github.messages.popup_blocked']())
        }

        popup.focus()

        // Monitor popup for completion
        const checkClosed = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkClosed)
            setIsAuthenticating(false)
            
            // Refetch connection status after OAuth completion
            setTimeout(() => {
              refetchConnection()
            }, 1000)
          }
        }, 1000)

        // Cleanup interval after 5 minutes
        setTimeout(() => {
          clearInterval(checkClosed)
          setIsAuthenticating(false)
        }, 5 * 60 * 1000)
      },
      onError: (error) => {
        toast.error(error.message || m['dashboard.integrations.github.messages.oauth_failed']())
        setIsAuthenticating(false)
      }
    })
  )

  // Handle GitHub OAuth authentication
  const handleGitHubAuth = async () => {
    try {
      setIsAuthenticating(true)
      getOAuthUrlMutation.mutate({})
    } catch (error) {
      toast.error(error instanceof Error ? error.message : m['dashboard.integrations.github.messages.oauth_failed']())
      setIsAuthenticating(false)
    }
  }

  const isConnected = connectionStatus?.isConnected
  const isLoading = isCheckingConnection || isLoadingUser || isAuthenticating
  
  // Only show connection errors, not user fetch errors (which are expected when not connected)
  const shouldShowError = connectionError && !isLoading
  // Only show user errors if we're connected but still getting errors (unexpected errors)
  const shouldShowUserError = userError && isConnected && userError?.data?.code !== 'UNAUTHORIZED'

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <GitHubIcon className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              {m['dashboard.integrations.github.title']()}
              {isConnected && (
                <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {m['dashboard.integrations.github.connected']()}
                </Badge>
              )}
              {!isConnected && !isLoading && (
                <Badge variant="outline">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {m['dashboard.integrations.github.not_connected']()}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {m['dashboard.integrations.github.description']()}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">
              {isAuthenticating ? m['dashboard.integrations.github.authenticating']() : m['dashboard.integrations.github.checking_connection']()}
            </span>
          </div>
        )}

        {/* Error State - only show unexpected errors */}
        {(shouldShowError || shouldShowUserError) && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {connectionError?.message || (shouldShowUserError ? userError?.message : '') || m['dashboard.integrations.github.connection_failed']()}
            </AlertDescription>
          </Alert>
        )}

        {/* Connected State */}
        {isConnected && githubUser && !isLoading && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
              <Avatar className="h-12 w-12">
                <AvatarImage src={githubUser.avatar_url} alt={githubUser.login} />
                <AvatarFallback>
                  <User className="h-6 w-6" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="font-medium">{githubUser.name || githubUser.login}</div>
                <div className="text-sm text-muted-foreground">@{githubUser.login}</div>
                {githubUser.email && (
                  <div className="text-sm text-muted-foreground">{githubUser.email}</div>
                )}
              </div>
              <Button variant="outline" size="sm" asChild>
                <a 
                  href={githubUser.html_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2"
                >
                  {m['dashboard.integrations.github.view_profile']()}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            </div>
            
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-3 bg-muted/30 rounded-lg">
                <div className="font-semibold">{githubUser.public_repos}</div>
                <div className="text-sm text-muted-foreground">{m['dashboard.integrations.github.repositories']()}</div>
              </div>
              <div className="p-3 bg-muted/30 rounded-lg">
                <div className="font-semibold">{githubUser.followers}</div>
                <div className="text-sm text-muted-foreground">{m['dashboard.integrations.github.followers']()}</div>
              </div>
              <div className="p-3 bg-muted/30 rounded-lg">
                <div className="font-semibold">{githubUser.following}</div>
                <div className="text-sm text-muted-foreground">{m['dashboard.integrations.github.following']()}</div>
              </div>
            </div>
          </div>
        )}

        {/* Not Connected State */}
        {!isConnected && !isLoading && (
          <div className="space-y-4">
            <div className="p-4 bg-muted/50 rounded-lg">
              <h4 className="font-medium mb-2">{m['dashboard.integrations.github.connect_account_title']()}</h4>
              <p className="text-sm text-muted-foreground mb-4">
                {m['dashboard.integrations.github.connect_account_description']()}
              </p>
              <Button 
                onClick={handleGitHubAuth}
                disabled={isAuthenticating}
                className="flex items-center gap-2"
              >
                {isAuthenticating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <GitHubIcon className="h-4 w-4" />
                )}
                {m['dashboard.integrations.github.connect_github']()}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
