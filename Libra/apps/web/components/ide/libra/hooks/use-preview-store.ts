/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * use-preview-store.ts
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

import { create } from 'zustand';

/**
 * Preview state store
 * Uses Zustand to manage preview URL and visibility state
 */
interface PreviewState {
  // Preview URL
  previewURL: string;
  // Whether preview is visible
  isPreviewVisible: boolean;
  // Whether preview URL is loading
  isLoadingURL: boolean;
  // Set preview URL
  setPreviewURL: (url: string) => void;
  // Set preview visibility
  setIsPreviewVisible: (visible: boolean) => void;
  // Set URL loading state
  setIsLoadingURL: (loading: boolean) => void;
  // Reset state
  reset: () => void;
}

/**
 * Create preview state management store
 */
export const usePreviewStore = create<PreviewState>((set) => ({
  // Initial state
  previewURL: '',
  isPreviewVisible: false,
  isLoadingURL: false,
  
  // State update methods
  setPreviewURL: (url: string) => {
    set({ previewURL: url });
  },
  
  setIsPreviewVisible: (visible: boolean) => {
    set({ isPreviewVisible: visible });
  },
  
  setIsLoadingURL: (loading: boolean) => {
    set({ isLoadingURL: loading });
  },
  
  // Reset state to default values
  reset: () => {
    set({ previewURL: '', isPreviewVisible: false, isLoadingURL: false });
  },
})); 