/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * share-project-modal.tsx
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

import { useState, useEffect } from 'react'
import { Copy, X, AlertCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@libra/ui/components/dialog'
import { Button } from '@libra/ui/components/button'
import { Switch } from '@libra/ui/components/switch'
import { Input } from '@libra/ui/components/input'
import { Separator } from '@libra/ui/components/separator'
import { toast } from '@libra/ui/components/sonner'
import { cn } from '@libra/ui/lib/utils'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTRPC } from '@/trpc/client'
import { useMembershipStatus } from '@/hooks/use-membership-status'
import { useUpgradeModal } from '@/components/common/upgrade-modal'
import * as m from '@/paraglide/messages'

// Import social media logos
import XformerlyTwitter from '@/components/logos/twitter'
import Facebook from '@/components/logos/facebook'
import LinkedIn from '@/components/logos/linkedln'
import Reddit from '@/components/logos/reddit'

interface ShareProjectModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
}

export function ShareProjectModal({ open, onOpenChange, projectId }: ShareProjectModalProps) {
  const [isPublic, setIsPublic] = useState(true)

  // Get TRPC client and query client
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  // Get membership status and upgrade modal
  const { canCreatePrivateProjects, isLoading: membershipLoading } = useMembershipStatus()
  const { checkFeatureAccess } = useUpgradeModal()

  // Query project data to get production deploy URL
  const projectQuery = useQuery(
    trpc.project.getById.queryOptions(
      { id: projectId },
      { enabled: !!projectId && open }
    )
  )
  
  // Get project URL from deployment data
  const projectData = projectQuery.data as { productionDeployUrl?: string; visibility?: 'public' | 'private' } | undefined
  const projectUrl = projectData?.productionDeployUrl
  const isProjectDeployed = !!projectUrl

  // Project visibility update mutation
  const updateVisibilityMutation = useMutation(
    trpc.project.updateProjectVisibility.mutationOptions({
      onSuccess: async () => {
        // Refresh project data
        await queryClient.invalidateQueries(trpc.project.getById.pathFilter())
        toast.success(m['dashboard.share.modal.states.visibilityUpdateSuccess']())
      },
      onError: (error) => {
        // Reset the toggle state on error
        setIsPublic(projectData?.visibility === 'public')
        toast.error(error.message || m['dashboard.share.modal.states.visibilityUpdateFailed']())
      },
    })
  )

  // Initialize isPublic state based on project data
  useEffect(() => {
    if (projectData?.visibility) {
      setIsPublic(projectData.visibility === 'public')
    }
  }, [projectData?.visibility])

  // Handle visibility toggle
  const handleVisibilityChange = (newIsPublic: boolean) => {
    // If trying to make project private, check premium access
    if (!newIsPublic) {
      checkFeatureAccess('private-project', () => {
        // If user has access, proceed with the change
        setIsPublic(newIsPublic)
        updateVisibilityMutation.mutate({
          projectId,
          visibility: 'private'
        })
      })

      // If no access, the upgrade modal will be shown and we don't change the state
      return
    }

    // Making project public is always allowed
    setIsPublic(newIsPublic)
    updateVisibilityMutation.mutate({
      projectId,
      visibility: 'public'
    })
  }

  // Determine if the switch should be disabled
  const isSwitchDisabled = membershipLoading || updateVisibilityMutation.isPending || projectQuery.isLoading
  
  // Social media share functions
  const shareOnTwitter = () => {
    if (!projectUrl) return
    const text = m["dashboard.share.modal.share_text.twitter"]()
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(projectUrl)}`
    window.open(url, '_blank', 'width=600,height=400')
  }

  const shareOnFacebook = () => {
    if (!projectUrl) return
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(projectUrl)}`
    window.open(url, '_blank', 'width=600,height=400')
  }

  const shareOnLinkedIn = () => {
    if (!projectUrl) return
    const title = m["dashboard.share.modal.share_text.linkedin_title"]()
    const summary = m["dashboard.share.modal.share_text.linkedin_summary"]()
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(projectUrl)}&title=${encodeURIComponent(title)}&summary=${encodeURIComponent(summary)}`
    window.open(url, '_blank', 'width=600,height=400')
  }

  const shareOnReddit = () => {
    if (!projectUrl) return
    const title = m["dashboard.share.modal.share_text.reddit_title"]()
    const url = `https://reddit.com/submit?url=${encodeURIComponent(projectUrl)}&title=${encodeURIComponent(title)}`
    window.open(url, '_blank', 'width=600,height=400')
  }

  const copyToClipboard = async () => {
    if (!projectUrl) return
    try {
      await navigator.clipboard.writeText(projectUrl)
      toast.success(m["dashboard.share.modal.states.copy_success"]())
    } catch {
      toast.error(m["dashboard.share.modal.states.copy_failed"]())
    }
  }

  const socialButtons = [
    {
      icon: XformerlyTwitter,
      label: m["dashboard.share.modal.social.share_on_x"](),
      onClick: shareOnTwitter,
      className: 'hover:bg-accent hover:text-accent-foreground'
    },
    {
      icon: Facebook,
      label: m["dashboard.share.modal.social.share_on_facebook"](),
      onClick: shareOnFacebook,
      className: 'hover:bg-accent hover:text-accent-foreground'
    },
    {
      icon: LinkedIn,
      label: m["dashboard.share.modal.social.share_on_linkedin"](),
      onClick: shareOnLinkedIn,
      className: 'hover:bg-accent hover:text-accent-foreground'
    },
    {
      icon: Reddit,
      label: m["dashboard.share.modal.social.share_on_reddit"](),
      onClick: shareOnReddit,
      className: 'hover:bg-accent hover:text-accent-foreground'
    }
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] sm:max-w-lg" showCloseButton={false}>
        {/* Close Button - Positioned absolutely */}
        <div className="absolute top-4 right-4 z-10">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={m["dashboard.share.modal.close"]()}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Header */}
        <DialogHeader className="space-y-3 pb-6">
          <DialogTitle className="text-xl font-semibold tracking-tight">
            {m["dashboard.share.modal.title"]()}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {isProjectDeployed 
              ? m["dashboard.share.modal.description"]()
              : m["dashboard.share.modal.description_not_deployed"]()
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Project Visibility Toggle */}
          <div className="flex items-center justify-between py-2">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">{m["dashboard.share.modal.visibility.title"]()}</p>
              <p className="text-xs text-muted-foreground">
                {isPublic
                  ? m["dashboard.share.modal.visibility.description"]()
                  : canCreatePrivateProjects
                    ? m["dashboard.share.modal.visibility.privateProjectDescription"]()
                    : m["dashboard.share.modal.visibility.upgradeForPrivateProjects"]()
                }
              </p>
            </div>
            <Switch
              checked={isPublic}
              onCheckedChange={handleVisibilityChange}
              disabled={isSwitchDisabled}
              className="ml-4"
            />
          </div>

          <Separator />

          {/* Social Media Share Buttons */}
          <div className="space-y-2">
            {socialButtons.map((social) => {
              const IconComponent = social.icon
              return (
                <Button
                  key={social.label}
                  variant="ghost"
                  onClick={social.onClick}
                  disabled={!isProjectDeployed}
                  className={cn(
                    "w-full justify-start h-11 px-4 text-sm font-normal transition-colors",
                    social.className,
                    !isProjectDeployed && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <IconComponent className="h-4 w-4 mr-3 flex-shrink-0" />
                  {social.label}
                </Button>
              )
            })}
          </div>

          <Separator />

          {/* Copy Link Section */}
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-foreground mb-1">
                {m["dashboard.share.modal.copy_link.title"]()}
              </p>
              <p className="text-xs text-muted-foreground">
                {m["dashboard.share.modal.copy_link.description"]()}
              </p>
            </div>
            
            {isProjectDeployed ? (
              <div className="flex items-center gap-2">
                <Input
                  value={projectUrl}
                  readOnly
                  className="flex-1 bg-muted/50 text-sm font-mono text-muted-foreground border-muted-foreground/20 focus-visible:ring-1 focus-visible:ring-ring"
                />
                <Button
                  onClick={copyToClipboard}
                  className="px-4 h-10 shrink-0"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  {m["dashboard.share.modal.copy_link.copy_button"]()}
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-4 bg-muted/20 rounded-lg border border-muted-foreground/20">
                <AlertCircle className="h-4 w-4 text-orange-500 shrink-0" />
                <div className="text-sm text-muted-foreground">
                  {projectQuery.isLoading ? (
                    m["dashboard.share.modal.states.loading"]()
                  ) : (
                    m["dashboard.share.modal.states.not_deployed"]()
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
} 