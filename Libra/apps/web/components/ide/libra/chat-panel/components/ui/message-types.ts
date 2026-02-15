/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * message-types.ts
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

import type { DetailedLoadingStatus } from '../types';

/**
 * Message component properties interface
 * Defines common properties for message components
 */
export interface MessageComponentProps {
  /** Message content */
  message: any;
  /** Retry callback function */
  onRetry?: () => void;
  /** File click callback function */
  onFileClick: (path: string) => void;
  /** Detailed loading state */
  loadingStatus?: DetailedLoadingStatus;
  /** Whether to use enhanced mode */
  isEnhancedMode?: boolean;
  /** Custom style class name */
  className?: string;
} 