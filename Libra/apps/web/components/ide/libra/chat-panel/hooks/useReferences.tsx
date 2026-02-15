/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * useReferences.tsx
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

import { useState } from 'react';

interface UseReferencesParams {
  initialItems?: any[];
}

interface UseReferencesReturn {
  selectedItems: any[];
  addSelectedItem: (item: any) => void;
  removeSelectedItem: (index: number) => void;
  clearSelectedItems: () => void;
}

/**
 * Hook for managing reference element selection
 */
export function useReferences({
  initialItems = []
}: UseReferencesParams = {}): UseReferencesReturn {
  const [selectedItems, setSelectedItems] = useState<any[]>(initialItems);
  
  // Add selected element
  const addSelectedItem = (item: any) => {
    setSelectedItems(prev => [...prev, item]);
  };
  
  // Remove selected element
  const removeSelectedItem = (index: number) => {
    setSelectedItems(prev => prev.filter((_, i) => i !== index));
  };
  
  // Clear all selected elements
  const clearSelectedItems = () => {
    setSelectedItems([]);
  };
  
  return {
    selectedItems,
    addSelectedItem,
    removeSelectedItem,
    clearSelectedItems
  };
} 