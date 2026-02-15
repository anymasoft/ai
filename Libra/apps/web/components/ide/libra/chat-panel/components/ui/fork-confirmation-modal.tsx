/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * fork-confirmation-modal.tsx
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

import React from 'react'
import { GitFork, Loader2 } from 'lucide-react'
import * as m from '@/paraglide/messages'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@libra/ui/components/dialog'
import { Button } from '@libra/ui/components/button'
import { Alert, AlertDescription } from '@libra/ui/components/alert'

interface ForkConfirmationModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  isLoading?: boolean
  projectName?: string
  planId?: string
}

export const ForkConfirmationModal = ({
  open,
  onClose,
  onConfirm,
  isLoading = false,
  projectName = 'this project',
  planId,
}: ForkConfirmationModalProps) => {
  const handleConfirm = () => {
    onConfirm()
  }

  return (
    <Dialog open={open} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitFork className="h-5 w-5 text-blue-500" />
            {m['ide.forkModal.forkConversation']()}
          </DialogTitle>
          <DialogDescription>
            {m['ide.forkModal.createNewProject']()}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <Alert>
            <GitFork className="h-4 w-4" />
            <AlertDescription>
              {m['ide.forkModal.forkDescription']()}
            </AlertDescription>
          </Alert>

          <div className="text-sm text-muted-foreground space-y-2">
            <p><strong>{m['ide.forkModal.sourceProject']()}:</strong> {projectName}</p>
            {planId && <p><strong>{m['ide.forkModal.forkPoint']()}:</strong> {planId}</p>}
            <p><strong>{m['ide.forkModal.whatHappens']()}</strong></p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>{m['ide.forkModal.newProjectCreated']()}</li>
              <li>{m['ide.forkModal.conversationCopied']()}</li>
              <li>{m['ide.forkModal.redirectToNew']()}</li>
              <li>{m['ide.forkModal.originalUnchanged']()}</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={onClose}
            disabled={isLoading}
          >
            {m['ide.forkModal.cancel']()}
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {m['ide.forkModal.creatingFork']()}
              </>
            ) : (
              <>
                <GitFork className="mr-2 h-4 w-4" />
                {m['ide.forkModal.createFork']()}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
