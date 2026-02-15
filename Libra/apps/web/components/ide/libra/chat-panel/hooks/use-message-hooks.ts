/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * use-message-hooks.ts
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

import { useState, useCallback } from 'react';
import type { ReactNode } from 'react';

/**
 * Tab information interface
 */
export interface TabInfo {
  id: string;
  label: string;
  icon?: ReactNode;
  badge?: number | string;
}

// In useTabState function, update tab click handling logic
function useTabState(tabs: TabInfo[] = []) {
  const initialTab = tabs.length > 0 && tabs[0] && tabs[0].id ? tabs[0].id : 'none';
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [isContentExpanded, setIsContentExpanded] = useState<boolean>(true);

  const handleTabClick = useCallback((tabId: string, action?: 'toggle' | 'expand' | 'collapse') => {
    
    // Handle expand/collapse operations
    if (action) {
      switch (action) {
        case 'expand':
          setIsContentExpanded(true);
          break;
        case 'collapse':
          setIsContentExpanded(false);
          break;
        case 'toggle':
          setIsContentExpanded((prev: boolean) => !prev);
          break;
      }
      return;
    }
    
    // If clicking current active tab, toggle expand state
    if (tabId === activeTab) {
      setIsContentExpanded((prev: boolean) => !prev);
      return;
    }
    
    // Switch tab
    setActiveTab(tabId);
    setIsContentExpanded(true);
  }, [activeTab]);

  return { 
    activeTab, 
    isContentExpanded, 
    handleTabClick
  };
} 