/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * icons.tsx
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

import React from 'react';

// Selector icon component - optimized version
export const SelectorIcon = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="16" 
    height="16" 
    viewBox="0 0 16 16" 
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {/* Mouse pointer shape */}
    <path d="M2.5 2L2.5 9.5H5L8 12.5L8 9.5H13.5V2H2.5Z" fill="none" />
    
    {/* Selection box indicator */}
    <rect x="4" y="4" width="8" height="4" rx="1" fill="none" />
    
    {/* Highlight point */}
    <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    
    {/* Connection line */}
    <line x1="8" y1="8" x2="10.5" y2="10.5" />
  </svg>
);

// Attachment icon component
export const AttachmentIcon = () => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    className="h-5 w-5" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <path 
      d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
  </svg>
);

// Send button icon
export const SendIcon = () => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    version="1.1" 
    viewBox="0 0 16 16" 
    className="h-5 w-5"
  >
    <defs>
      <clipPath id="master_svg0_1855_28979">
        <rect x="0" y="0" width="16" height="16" rx="0" />
      </clipPath>
    </defs>
    <g clipPath="url(#master_svg0_1855_28979)">
      <path 
        className="fill" 
        d="M0,7.0000000047683715L0,1.1213300047683716C0,0.37795300476837157,0.782313,-0.10554299523162841,1.44721,0.22690800476837159L15.2111,7.108870004768372C15.9482,7.477400004768372,15.9482,8.529200004768372,15.2111,8.897730004768372L1.44721,15.779700004768372C0.782313,16.112100004768372,0,15.628600004768371,0,14.885300004768371L0,9.000000004768372L4,9.000000004768372L4,7.0000000047683715L0,7.0000000047683715Z" 
        fillRule="evenodd" 
        fillOpacity="1"
      />
    </g>
  </svg>
);

// Pause button icon
export const PauseIcon = () => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="24" 
    height="24" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className="h-5 w-5"
  >
    <rect x="6" y="4" width="4" height="16" />
    <rect x="14" y="4" width="4" height="16" />
  </svg>
);