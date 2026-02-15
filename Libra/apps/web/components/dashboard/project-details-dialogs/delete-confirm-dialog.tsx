/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * delete-confirm-dialog.tsx
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
import * as m from '@/paraglide/messages'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@libra/ui/components/alert-dialog'

interface DeleteConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectName: string
  isDeleting: boolean
  onDelete: () => Promise<boolean>
}

/**
 * Project deletion confirmation dialog
 */
export function DeleteConfirmDialog({
  open,
  onOpenChange,
  projectName,
  isDeleting,
  onDelete,
}: DeleteConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className='max-w-md'>
        <AlertDialogHeader>
          <AlertDialogTitle>{m["dashboard.projectDetailsTabs.danger.deleteConfirm.title"]()}</AlertDialogTitle>
          <AlertDialogDescription>
            {m["dashboard.projectDetailsTabs.danger.deleteConfirm.description"]({ projectName })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{m["dashboard.projectDetailsTabs.danger.deleteConfirm.cancel"]()}</AlertDialogCancel>
          <AlertDialogAction onClick={onDelete} className='bg-red-600 hover:bg-red-700'>
            {isDeleting ? (
              <>
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                {m["dashboard.projectDetailsTabs.danger.deleting"]()}
              </>
            ) : (
              m["dashboard.projectDetailsTabs.danger.deleteConfirm.confirm"]()
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
} 