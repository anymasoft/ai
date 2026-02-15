/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * revert-confirmation-modal.tsx
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

import { Loader2 } from 'lucide-react'
import { RollbackIcon } from '@/components/common/Icon'
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

interface RevertConfirmationModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  isLoading?: boolean
  planId?: string
}

export const RevertConfirmationModal = ({
  open,
  onClose,
  onConfirm,
  isLoading = false,
  planId,
}: RevertConfirmationModalProps) => {
  const handleConfirm = () => {
    onConfirm()
  }

  return (
    <Dialog open={open} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RollbackIcon className="h-5 w-5 text-amber-600" />
            {m['ide.revertModal.revertToState']()}
          </DialogTitle>
          <DialogDescription>
            {m['ide.revertModal.confirmRevertAction']()}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="text-sm text-muted-foreground space-y-2">
            {planId && <p><strong>{m['ide.revertModal.revertPoint']()}:</strong> {planId}</p>}
            <p><strong>{m['ide.revertModal.whatWillHappen']()}</strong></p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>{m['ide.revertModal.allVersionsAfterDeleted']()}</li>
              <li>{m['ide.revertModal.actionCannotBeUndone']()}</li>
              <li>{m['ide.revertModal.projectStateRestored']()}</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={onClose}
            disabled={isLoading}
          >
            {m['ide.revertModal.cancel']()}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoading}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {m['ide.revertModal.reverting']()}
              </>
            ) : (
              <>
                <RollbackIcon className="mr-2 h-4 w-4" />
                {m['ide.revertModal.confirmRevert']()}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
