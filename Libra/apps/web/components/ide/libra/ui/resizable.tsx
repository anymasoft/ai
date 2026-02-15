/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * resizable.tsx
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

"use client"

import { cn } from "@libra/ui/lib/utils"
import * as React from "react"
import { PanelGroup, Panel, PanelResizeHandle, type ImperativePanelHandle } from "react-resizable-panels"

const ResizablePanelGroup = React.forwardRef<
  React.ElementRef<typeof PanelGroup>,
  React.ComponentPropsWithoutRef<typeof PanelGroup>
>(({ className, ...props }, ref) => (
  <PanelGroup
    ref={ref}
    className={cn(
      "flex h-full w-full data-[panel-group-direction=vertical]:flex-col",
      className
    )}
    {...props}
  />
))
ResizablePanelGroup.displayName = "ResizablePanelGroup"

const ResizablePanel = React.forwardRef<
  React.ElementRef<typeof Panel>,
  React.ComponentPropsWithoutRef<typeof Panel>
>(({ className, ...props }, ref) => (
  <Panel
    ref={ref}
    className={cn("flex h-full w-full", className)}
    {...props}
  />
))
ResizablePanel.displayName = "ResizablePanel"

const ResizableHandle = ({ className, ...props }: React.ComponentPropsWithoutRef<typeof PanelResizeHandle>) => (
  <PanelResizeHandle
    className={cn(
      "resize-handle group relative flex items-center justify-center",
      // Increased clickable area for better UX
      "before:absolute before:inset-0 before:z-10",
      "before:w-6 before:h-full data-[panel-group-direction=vertical]:before:w-full data-[panel-group-direction=vertical]:before:h-6",
      // Visual line - hidden (original implementation)
      "after:absolute after:inset-0 after:flex after:items-center after:justify-center",
      "after:w-[2px] after:h-full data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:h-[2px]",
      "after:bg-transparent after:transition-all after:duration-200",
      // Hover state - hidden (original implementation)
      "hover:after:w-[3px] hover:after:bg-transparent",
      "data-[panel-group-direction=vertical]:hover:after:h-[3px] data-[panel-group-direction=vertical]:hover:after:w-full",
      // Active drag state - hidden (original implementation)
      "data-[resize-handle-state=drag]:after:w-[4px] data-[resize-handle-state=drag]:after:bg-transparent",
      "data-[panel-group-direction=vertical]:data-[resize-handle-state=drag]:after:h-[4px]",
      // Cursor
      "cursor-col-resize data-[panel-group-direction=vertical]:cursor-row-resize",
      // Focus state
      "focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-offset-2",
      className
    )}
    {...props}
  />
)
ResizableHandle.displayName = "ResizableHandle"

export {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
}

export type { ImperativePanelHandle } 