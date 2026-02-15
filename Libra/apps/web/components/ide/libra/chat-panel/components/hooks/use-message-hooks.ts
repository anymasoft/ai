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

import { useMemo, useState, useCallback, useEffect } from 'react';
import type { 
  BaseMessage, 
  DiffMessage, 
  CommandMessage, 
  TabDefinition, 
  TabType
} from '../types/message-types';
import {
  isThinkingMessage,
  isPlanMessage,
  isDiffMessage,
  isCommandMessage
} from '../types/message-types';

// Custom Hook: Extract message content
export const useMessageContent = (message: BaseMessage | undefined): string => {
  if (!message) return '';
  
  try {
    
    if (typeof message.content === 'string') return message.content;
    if (message.data && typeof message.data.content === 'string') return message.data.content;
    if (typeof message.message === 'string') return message.message;
    
    if (message.content && typeof message.content === 'object') {
      if (typeof message.content.text === 'string') return message.content.text;
      if (typeof message.content.thinking === 'string') return message.content.thinking;
    }
    
    if (message.data && typeof message.data === 'object') {
      if (message.data.content && typeof message.data.content.text === 'string') 
        return message.data.content.text;
    }
    
    return '';
  } catch (error) {
    return '';
  }
};

// Message classification Hook
export const useMessageClassification = (messages: BaseMessage[]) => {
  return useMemo(() => {
    try {
      const thinkingMsg = messages.find(isThinkingMessage);
      const planMsg = messages.find(isPlanMessage);
      const diffMsg = messages.find(isDiffMessage) as DiffMessage | undefined;
      const commandMsgs = messages.filter(isCommandMessage) as CommandMessage[];
      
      
      return {
        thinking: thinkingMsg,
        plan: planMsg,
        diff: diffMsg,
        commands: commandMsgs
      };
    } catch (error) {
      return {
        thinking: undefined,
        plan: undefined,
        diff: undefined,
        commands: []
      };
    }
  }, [messages]);
};

// Tab Hook
export const useAvailableTabs = (
  thinking?: BaseMessage, 
  plan?: BaseMessage, 
  commands: CommandMessage[] = [], 
  diff?: DiffMessage,
  tabIcons: Record<TabType, React.ReactNode> = {} as any,
  hasThinkingInProgress?: boolean
) => {
  return useMemo(() => {
    const tabs: TabDefinition[] = [];
    
    // Add tabs in priority order - English labels
    // If there's a thinking message or thinking content is loading, thinking tab should be displayed
    if (thinking || hasThinkingInProgress) {
      tabs.push({ 
        id: 'thinking', 
        label: 'Thinking', 
        icon: tabIcons.thinking
      });
    }
    
    if (plan) {
      tabs.push({ 
        id: 'plan', 
        label: 'Plan', 
        icon: tabIcons.plan
      });
    }
    
    if (commands.length > 0) {
      tabs.push({ 
        id: 'commands', 
        label: 'Commands', 
        icon: tabIcons.commands,
        count: commands.length
      });
    }
    
    if (diff?.diff?.length) {
      tabs.push({ 
        id: 'files', 
        label: 'Files', 
        icon: tabIcons.files,
        count: diff.diff.length
      });
    }
    
    return tabs;
  }, [thinking, plan, commands, diff, tabIcons, hasThinkingInProgress]);
};

// Tab state Hook
export const useTabState = (availableTabs: TabDefinition[]) => {
  const [activeTab, setActiveTab] = useState<TabType>('none');
  const [isContentExpanded, setIsContentExpanded] = useState(false);
  
  // Initialize tab selection
  useEffect(() => {
    if (availableTabs.length > 0) {
      // If no tab is selected yet, or current tab is not in available tabs
      const currentTabAvailable = availableTabs.some(tab => tab.id === activeTab);
      
      if (activeTab === 'none' || !currentTabAvailable) {
        // Prioritize thinking tab (especially during loading state)
        const thinkingTabIndex = availableTabs.findIndex(tab => tab.id === 'thinking');
        // Next, select execution plan tab
        const planTabIndex = availableTabs.findIndex(tab => tab.id === 'plan');
        
        if (thinkingTabIndex >= 0) {
          setActiveTab('thinking');
        } else if (planTabIndex >= 0) {
          setActiveTab('plan');
        } else if (availableTabs[0]?.id) {
          setActiveTab(availableTabs[0].id);
        }
      }
      
      // Default expand content when tabs are available
      setIsContentExpanded(true);
    }
  }, [availableTabs, activeTab]);
  
  // Toggle content expand/collapse
  const toggleContent = useCallback(() => {
    setIsContentExpanded(prev => !prev);
  }, []);
  
  // Handle tab click
  const handleTabClick = useCallback((tabId: TabType) => {
    if (activeTab === tabId) {
      // Modified: When clicking the same tab, if content is collapsed then expand, if expanded then keep expanded
      if (!isContentExpanded) {
        setIsContentExpanded(true);
      }
    } else {
      setActiveTab(tabId);
      setIsContentExpanded(true);
    }
  }, [activeTab, isContentExpanded]);
  
  return {
    activeTab,
    isContentExpanded,
    toggleContent,
    handleTabClick
  };
}; 