/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * screenshot-modal.tsx
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

import { useEffect } from 'react'
import { Button } from '@libra/ui/components/button'
import { cn } from '@libra/ui/lib/utils'
import { X, Download, Copy, Check } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

interface ScreenshotModalProps {
  isOpen: boolean
  onClose: () => void
  screenshotData: {
    dataUrl: string
    format: string
    timestamp: number
  } | null
}

export const ScreenshotModal = ({ isOpen, onClose, screenshotData }: ScreenshotModalProps) => {
  const [copied, setCopied] = useState(false)

  // Close modal on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  // Handle download
  const handleDownload = () => {
    if (!screenshotData) return

    const link = document.createElement('a')
    link.href = screenshotData.dataUrl
    link.download = `screenshot-${new Date(screenshotData.timestamp).toISOString().slice(0, 19).replace(/:/g, '-')}.${screenshotData.format}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Screenshot downloaded successfully!')
  }

  // Handle copy to clipboard
  const handleCopy = async () => {
    if (!screenshotData) return

    try {
      // Convert data URL to blob
      const response = await fetch(screenshotData.dataUrl)
      const blob = await response.blob()
      
      // Copy to clipboard
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob
        })
      ])
      
      setCopied(true)
      toast.success('Screenshot copied to clipboard!')
      
      // Reset copy state after 2 seconds
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast.error('Failed to copy screenshot to clipboard')
    }
  }

  if (!isOpen || !screenshotData) return null

  return (
    <div 
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center",
        "bg-black/80 backdrop-blur-sm"
      )}
      onClick={onClose}
    >
      <div 
        className={cn(
          "relative max-w-[90vw] max-h-[90vh] p-4",
          "bg-white dark:bg-gray-900 rounded-lg shadow-2xl",
          "border border-border-default dark:border-border-emphasis"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-fg-default">
            Screenshot Preview
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Screenshot Image */}
        <div className="mb-4 flex justify-center">
          <img
            src={screenshotData.dataUrl}
            alt="Screenshot"
            className={cn(
              "max-w-full max-h-[60vh] object-contain",
              "rounded border border-border-default dark:border-border-emphasis",
              "shadow-md"
            )}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-fg-muted">
            Captured: {new Date(screenshotData.timestamp).toLocaleString()}
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              disabled={copied}
              className="flex items-center gap-2"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy
                </>
              )}
            </Button>
            
            <Button
              variant="default"
              size="sm"
              onClick={handleDownload}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Download
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
