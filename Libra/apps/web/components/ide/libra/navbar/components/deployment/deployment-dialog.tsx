/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * deployment-dialog.tsx
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

import {useMemo} from 'react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@libra/ui/components/dialog'
import { Globe } from 'lucide-react'
import { cn } from '@libra/ui/lib/utils'
import type {DeployConfirmationDialogProps} from '../../types/deployment'
import * as m from '@/paraglide/messages'
import {DeploymentConfirmation} from './deployment-confirmation'
import {DeploymentProgress} from './deployment-progress'
import {DeploymentSuccess} from './deployment-success'
import {getStageConfig, useDeploymentState} from './hooks/use-deployment-state'
import {DeploymentErrorBoundary, ErrorDisplay} from './error-boundary'
import {useFocusManagement, useKeyboardNavigation, useAriaAnnouncer} from './accessibility-helpers'

/**
 * Deployment stage enumeration for better type safety
 */
export type DeploymentStage = 'confirmation' | 'progress' | 'success' | 'existing'


export function DeploymentDialog({
                                     open,
                                     onOpenChange,
                                     onConfirm,
                                     projectId,
                                     isDeploying,
                                     deployProgress = 0,
                                     deployStage = '',
                                     deployResult,
                                     existingUrl,
                                     customDomainStatus,
                                     onSetCustomDomain,
                                     onVerifyCustomDomain,
                                     onRemoveCustomDomain,
                                     isCustomDomainLoading = false,
                                     error,
                                     onErrorDismiss
                                 }: DeployConfirmationDialogProps) {
    // Use centralized state management
    const {currentStage} = useDeploymentState({
        isDeploying,
        deployResult,
        existingUrl,
        open
    })

    // Enhanced accessibility features
    const modalRef = useFocusManagement(open)
    const { announce, AnnouncerComponent } = useAriaAnnouncer()

    // Keyboard navigation for the modal - use the same ref but cast it properly
    useKeyboardNavigation(modalRef as React.RefObject<HTMLElement>, {
        enableTabTrapping: true,
        onEscape: onOpenChange ? () => onOpenChange(false) : undefined,
        autoFocus: true
    })

    // Get stage configuration with memoization for performance
    const stageConfig = useMemo(() => getStageConfig(currentStage), [currentStage])

    // Get localized title and description
    const dialogTitle = useMemo(() => {
        const titleMap = {
            confirmation: m['ide.deployment.dialog.titles.confirmation'](),
            progress: m['ide.deployment.dialog.titles.progress'](),
            success: m['ide.deployment.dialog.titles.success'](),
            existing: m['ide.deployment.dialog.titles.existing']()
        }
        return titleMap[currentStage] || m['ide.deployment.dialog.titles.default']()
    }, [currentStage])

    const dialogDescription = useMemo(() => {
        const descriptionMap = {
            confirmation: m['ide.deployment.dialog.descriptions.confirmation'](),
            progress: m['ide.deployment.dialog.descriptions.progress'](),
            success: m['ide.deployment.dialog.descriptions.success'](),
            existing: m['ide.deployment.dialog.descriptions.existing']()
        }
        return descriptionMap[currentStage] || m['ide.deployment.dialog.descriptions.default']()
    }, [currentStage])

    // Announce stage changes for screen readers
    useMemo(() => {
        if (open && currentStage) {
            const stageMessages = {
                confirmation: m['ide.deployment.dialog.announcements.confirmation'](),
                progress: m['ide.deployment.dialog.announcements.progress'](),
                success: m['ide.deployment.dialog.announcements.success'](),
                existing: m['ide.deployment.dialog.announcements.existing']()
            }
            announce({
                message: stageMessages[currentStage] || m['ide.deployment.dialog.announcements.default'](),
                priority: 'polite',
                delay: 500
            })
        }
    }, [currentStage, open, announce])

    const renderCurrentStage = () => {
        switch (currentStage) {
            case 'progress':
                return (
                    <DeploymentProgress
                        deployProgress={deployProgress}
                        deployStage={deployStage}
                    />
                )
            case 'success':
                return (
                    <DeploymentSuccess
                        deployResult={deployResult}
                        existingUrl={existingUrl}
                        customDomainStatus={customDomainStatus}
                        onSetCustomDomain={onSetCustomDomain}
                        onVerifyCustomDomain={onVerifyCustomDomain}
                        onRemoveCustomDomain={onRemoveCustomDomain}
                        isCustomDomainLoading={isCustomDomainLoading}
                        onClose={() => onOpenChange(false)}
                    />
                )
            case 'existing':
                return (
                    <DeploymentSuccess
                        deployResult={null}
                        existingUrl={existingUrl}
                        customDomainStatus={customDomainStatus}
                        onSetCustomDomain={onSetCustomDomain}
                        onVerifyCustomDomain={onVerifyCustomDomain}
                        onRemoveCustomDomain={onRemoveCustomDomain}
                        isCustomDomainLoading={isCustomDomainLoading}
                        onClose={() => onOpenChange(false)}
                        onRedeploy={onConfirm}
                    />
                )
            default:
                return (
                    <DeploymentConfirmation
                        onConfirm={onConfirm}
                        existingUrl={existingUrl}
                        isDeploying={isDeploying}
                        onClose={() => onOpenChange(false)}
                        projectId={projectId}
                    />
                )
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                ref={modalRef}
                className="max-w-2xl w-[95vw] sm:w-full max-h-[90vh] overflow-hidden border-0 bg-transparent shadow-none p-0
                           sm:max-w-lg md:max-w-xl lg:max-w-2xl
                           max-sm:w-[100vw] max-sm:h-[100vh] max-sm:max-h-none max-sm:rounded-none"
                showCloseButton={false}
                aria-labelledby="deployment-dialog-title"
                aria-describedby="deployment-dialog-description"
                role="dialog"
                aria-modal="true"
            >
                {/* Always render DialogTitle and DialogDescription for accessibility as direct children */}
                <DialogTitle id="deployment-dialog-title" className={stageConfig.showHeader ? "sr-only" : "sr-only"}>
                    {dialogTitle}
                </DialogTitle>
                <DialogDescription id="deployment-dialog-description" className={stageConfig.showHeader ? "sr-only" : "sr-only"}>
                    {dialogDescription}
                </DialogDescription>

                {/* Accessibility announcer */}
                <AnnouncerComponent />

                <DeploymentErrorBoundary>
                    <div className="deployment-modal overflow-hidden
                                    max-sm:rounded-none max-sm:h-full max-sm:flex max-sm:flex-col">

                        {/* Enhanced header with accessibility */}
                        {stageConfig.showHeader && (
                            <DialogHeader className="space-y-3 px-6 pt-6 pb-4 border-b border-border/20">
                                <div className="text-xl font-bold text-foreground tracking-tight flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                        <Globe className="w-5 h-5 text-primary" aria-hidden="true" />
                                    </div>
                                    {dialogTitle}
                                </div>
                                <div className="text-muted-foreground text-sm leading-relaxed">
                                    {dialogDescription}
                                </div>
                            </DialogHeader>
                        )}

                        {/* Enhanced error display */}
                        {error && (
                            <div className="p-6 pb-0">
                                <ErrorDisplay
                                    error={error}
                                    onRetry={onErrorDismiss}
                                    variant="card"
                                    className="deployment-card border-2 border-destructive/30 bg-destructive/5"
                                />
                            </div>
                        )}

                        {/* Responsive content container */}
                        <div className={cn(
                            "overflow-y-auto",
                            "max-sm:flex-1 max-sm:overflow-y-auto",
                            stageConfig.showHeader
                                ? "max-h-[calc(90vh-140px)] max-sm:max-h-none"
                                : "max-h-[calc(90vh-60px)] max-sm:max-h-none"
                        )}>
                            {renderCurrentStage()}
                        </div>
                    </div>
                </DeploymentErrorBoundary>
            </DialogContent>
        </Dialog>
    )
}
