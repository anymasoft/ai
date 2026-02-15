/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * danger-tab.tsx
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

import { useState, useCallback, useEffect, useId } from 'react'
import { AlertTriangle, Loader2, ShieldAlert, Download, CheckCircle2 } from 'lucide-react'
import { Button } from '@libra/ui/components/button'
import { Input } from '@libra/ui/components/input'
import { Label } from '@libra/ui/components/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@libra/ui/components/card'
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@libra/ui/components/alert'
import { cn } from '@libra/ui/lib/utils'
import type { DangerTabProps, DangerTabStep } from '../project-details-types'
import * as m from '@/paraglide/messages'

/**
 * Custom hook for managing danger tab state
 */
function useDangerTabState(projectName?: string) {
  const [currentStep, setCurrentStep] = useState<DangerTabStep>('warning')
  const [confirmationInput, setConfirmationInput] = useState('')
  const [isValidInput, setIsValidInput] = useState(false)

  // Validate input when it changes
  useEffect(() => {
    setIsValidInput(
      confirmationInput.trim() === projectName?.trim() && 
      confirmationInput.length > 0
    )
  }, [confirmationInput, projectName])

  const resetState = useCallback(() => {
    setCurrentStep('warning')
    setConfirmationInput('')
    setIsValidInput(false)
  }, [])

  return {
    currentStep,
    setCurrentStep,
    confirmationInput,
    setConfirmationInput,
    isValidInput,
    resetState,
  }
}

/**
 * Information section component
 */
function DangerInfoSection() {
  return (
    <Card className="border-destructive/20 bg-destructive/5">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-destructive">
          <ShieldAlert className="h-5 w-5" />
          {m["dashboard.projectDetailsTabs.danger.title"]()}
        </CardTitle>
        <CardDescription className="text-destructive-foreground/80">
          {m["dashboard.projectDetailsTabs.danger.description"]()}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert variant="error" className="border-destructive/40">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{m["dashboard.projectDetailsTabs.danger.warning"]()}</AlertTitle>
          <AlertDescription className="mt-2 space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-destructive rounded-full" />
              <span>{m["dashboard.projectDetailsTabs.danger.consequence1"]()}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-destructive rounded-full" />
              <span>{m["dashboard.projectDetailsTabs.danger.consequence2"]()}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-destructive rounded-full" />
              <span>{m["dashboard.projectDetailsTabs.danger.consequence3"]()}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-destructive rounded-full" />
              <span>{m["dashboard.projectDetailsTabs.danger.consequence4"]()}</span>
            </div>
          </AlertDescription>
        </Alert>

        <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
          <Download className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertTitle className="text-amber-800 dark:text-amber-400">
            {m["dashboard.projectDetailsTabs.danger.safetyTip"]()}
          </AlertTitle>
          <AlertDescription className="text-amber-700 dark:text-amber-300">
            {m["dashboard.projectDetailsTabs.danger.safetyTipContent"]()}
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  )
}

/**
 * Confirmation input component
 */
function DangerConfirmationInput({
  projectName,
  confirmationInput,
  setConfirmationInput,
  isValidInput,
}: {
  projectName: string
  confirmationInput: string
  setConfirmationInput: (value: string) => void
  isValidInput: boolean
}) {
  const inputId = useId()
  const errorId = useId()
  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="text-destructive">
          {m["dashboard.projectDetailsTabs.danger.step2Title"]()}
        </CardTitle>
        <CardDescription>
          {m["dashboard.projectDetailsTabs.danger.step2Instruction"]({ projectName })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={inputId} className="text-sm font-medium">
            {m["dashboard.projectDetailsTabs.danger.confirmationInputLabel"]()}
          </Label>
          <Input
            id={inputId}
            type="text"
            value={confirmationInput}
            onChange={(e) => setConfirmationInput(e.target.value)}
            placeholder={m["dashboard.projectDetailsTabs.danger.confirmationInputPlaceholder"]()}
            className={cn(
              "transition-colors",
              confirmationInput.length > 0 && !isValidInput && "border-destructive focus-visible:ring-destructive"
            )}
            aria-describedby={errorId}
          />
          {confirmationInput.length > 0 && !isValidInput && (
            <p id={errorId} className="text-sm text-destructive">
              {m["dashboard.projectDetailsTabs.danger.inputMismatchError"]()}
            </p>
          )}
          {isValidInput && (
            <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              {m["dashboard.projectDetailsTabs.danger.projectNameMatch"]()}
            </p>
          )}
        </div>

        <Alert variant="error">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{m["dashboard.projectDetailsTabs.danger.warning"]()}</AlertTitle>
          <AlertDescription>
            {m["dashboard.projectDetailsTabs.danger.finalWarning"]()}
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  )
}

/**
 * Action buttons component
 */
function DangerActionButtons({
  currentStep,
  setCurrentStep,
  isValidInput,
  isDeleting,
  onDeleteClick,
  onClose,
}: {
  currentStep: DangerTabStep
  setCurrentStep: (step: DangerTabStep) => void
  isValidInput: boolean
  isDeleting: boolean
  onDeleteClick: () => void
  onClose?: () => void
}) {
    if (currentStep === 'warning') {
    return (
      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={onClose}
          className="flex-1"
          disabled={isDeleting}
        >
          {m["dashboard.projectDetailsTabs.danger.close"]()}
        </Button>
        <Button
          variant="destructive"
          onClick={() => setCurrentStep('confirmation')}
          className="flex-1"
          disabled={isDeleting}
        >
          {m["dashboard.projectDetailsTabs.danger.proceedToDeletion"]()}
        </Button>
      </div>
    )
  }

    if (currentStep === 'confirmation') {
    return (
      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={() => setCurrentStep('warning')}
          className="flex-1"
          disabled={isDeleting}
        >
          {m["dashboard.projectDetailsTabs.danger.backButton"]()}
        </Button>
        <Button
          variant="destructive"
          onClick={onDeleteClick}
          className="flex-1"
          disabled={!isValidInput || isDeleting}
        >
          {isDeleting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {m["dashboard.projectDetailsTabs.danger.deleting"]()}
            </>
          ) : (
            m["dashboard.projectDetailsTabs.danger.proceedButton"]()
          )}
        </Button>
      </div>
    )
  }

  return null
}

/**
 * Danger operations tab - includes dangerous actions such as deleting a project
 */
export function DangerTab({ 
  isDeleting, 
  onDeleteClick, 
  onClose,
  projectName = 'Unknown Project' 
}: DangerTabProps) {
  const {
    currentStep,
    setCurrentStep,
    confirmationInput,
    setConfirmationInput,
    isValidInput,
    resetState,
  } = useDangerTabState(projectName)

  // Reset state when deleting status changes
  useEffect(() => {
    if (!isDeleting) {
      resetState()
    }
  }, [isDeleting, resetState])

  const handleClose = () => {
    if (onClose) {
      onClose()
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Main content */}
      <div className="space-y-6">
        {currentStep === 'warning' && <DangerInfoSection />}
        
        {currentStep === 'confirmation' && (
          <DangerConfirmationInput
            projectName={projectName}
            confirmationInput={confirmationInput}
            setConfirmationInput={setConfirmationInput}
            isValidInput={isValidInput}
          />
        )}

        {/* Action buttons */}
        <DangerActionButtons
          currentStep={currentStep}
          setCurrentStep={setCurrentStep}
          isValidInput={isValidInput}
          isDeleting={isDeleting}
          onDeleteClick={onDeleteClick}
          onClose={handleClose}
        />
      </div>
    </div>
  )
}