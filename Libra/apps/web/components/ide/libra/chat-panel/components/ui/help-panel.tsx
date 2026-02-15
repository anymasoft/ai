/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * help-panel.tsx
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

import { X, HelpCircle, Info, Keyboard } from 'lucide-react';
import { useCallback, useEffect } from 'react';
import * as m from '@/paraglide/messages';

interface HelpPanelProps {
  onClose: () => void;
}

/**
 * Help panel component
 */
export const HelpPanel = ({ onClose }: HelpPanelProps) => {
  // Handle key press to close help panel
  const handleKeydownForHelp = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  // Add global keyboard event listener
  useEffect(() => {
    window.addEventListener('keydown', handleKeydownForHelp);
    return () => {
      window.removeEventListener('keydown', handleKeydownForHelp);
    };
  }, [handleKeydownForHelp]);

  return (
    <>
      {/* Semi-transparent background overlay - click to close help panel */}
      <div 
        className="fixed inset-0 bg-gray-900/60 dark:bg-gray-900/70 backdrop-blur-sm z-30 overflow-hidden"
        onClick={() => {
          onClose();
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
            e.preventDefault();
            onClose();
          }
        }}
        aria-label={m['ide.helpPanel.closeHelpPanel']()}
      />
      
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-sm sm:max-w-md  dark:bg-gray-800 border-l border-default dark:border-gray-700 h-full shadow-2xl transform transition-transform duration-300 ease-in-out translate-x-0 z-40 overflow-auto">
        <style jsx global>{`
          @keyframes slideIn {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
          }
        `}</style>

        {/* Drawer title area */}
        <div className="px-5 py-3 border-b border-default dark:border-gray-700 flex justify-between items-center sticky top-0 dark:bg-gray-800 z-10 shadow-sm">
          <div className="flex items-center gap-2 text-fg-default dark:text-gray-200">
            <Keyboard className="h-5 w-5 text-accent dark:text-indigo-400" />
            <h2 className="font-medium text-base">{m['ide.helpPanel.shortcutsAndHelp']()}</h2>
          </div>
          <button 
            type="button"
            onClick={onClose}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClose();
              }
            }}
            className="text-fg-muted hover:text-fg-default dark:text-gray-400 dark:hover:text-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md p-1 hover:-subtle dark:hover:bg-gray-700/50 transition-colors"
            aria-label={m['ide.helpPanel.closeHelpPanel']()}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        {/* Drawer content area */}
        <div className="w-full h-full p-5 dark:bg-gray-800">
          {/* Keyboard shortcuts section */}
          <div className="mb-6">
            <h3 className="text-sm font-medium mb-4 text-fg-default dark:text-gray-200 flex items-center gap-1.5">
              <HelpCircle className="h-4 w-4 text-accent dark:text-indigo-400" />
              {m['ide.helpPanel.keyboardShortcuts']()}
            </h3>
            <div className="grid grid-cols-1 gap-3">
              <div className="flex justify-between items-center -subtle dark:bg-gray-700 p-3 rounded-lg border border-default dark:border-gray-600">
                <span className="font-medium text-fg-default dark:text-gray-200">{m['ide.helpPanel.sendMessage']()}</span>
                <kbd className="px-2 py-1 dark:bg-gray-800 rounded text-fg-default dark:text-gray-300 border border-default dark:border-gray-600 text-xs shadow-sm">⌘ + Enter</kbd>
              </div>
              <div className="flex justify-between items-center -subtle dark:bg-gray-700 p-3 rounded-lg border border-default dark:border-gray-600">
                <span className="font-medium text-fg-default dark:text-gray-200">{m['ide.helpPanel.elementSelector']()}</span>
                <kbd className="px-2 py-1 dark:bg-gray-800 rounded text-fg-default dark:text-gray-300 border border-default dark:border-gray-600 text-xs shadow-sm">⌘ + K</kbd>
              </div>
              <div className="flex justify-between items-center -subtle dark:bg-gray-700 p-3 rounded-lg border border-default dark:border-gray-600">
                <span className="font-medium text-fg-default dark:text-gray-200">{m['ide.helpPanel.cancelRequest']()}</span>
                <kbd className="px-2 py-1 dark:bg-gray-800 rounded text-fg-default dark:text-gray-300 border border-default dark:border-gray-600 text-xs shadow-sm">Esc</kbd>
              </div>
            </div>
          </div>
          
          {/* Usage tips section */}
          <div className="mb-6">
            <h3 className="text-sm font-medium mb-4 text-fg-default dark:text-gray-200 flex items-center gap-1.5">
              <Info className="h-4 w-4 text-accent dark:text-indigo-400" />
              {m['ide.helpPanel.usageTips']()}
            </h3>
            <div className="grid grid-cols-1 gap-3">
              <div className="flex items-start gap-3 -subtle dark:bg-gray-700 p-3 rounded-lg border border-default dark:border-gray-600">
                <div className="flex-shrink-0 mt-0.5">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-accent/10 dark:bg-indigo-900/50 text-accent dark:text-indigo-400 font-medium text-xs">1</span>
                </div>
                <div>
                  <p className="text-fg-default dark:text-gray-200 font-medium">{m['ide.helpPanel.selectElementsTitle']()}</p>
                  <p className="text-sm text-fg-muted dark:text-gray-300 mt-1">{m['ide.helpPanel.selectElementsDesc']()}</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 -subtle dark:bg-gray-700 p-3 rounded-lg border border-default dark:border-gray-600">
                <div className="flex-shrink-0 mt-0.5">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-accent/10 dark:bg-indigo-900/50 text-accent dark:text-indigo-400 font-medium text-xs">2</span>
                </div>
                <div>
                  <p className="text-fg-default dark:text-gray-200 font-medium">{m['ide.helpPanel.describeRequirementsTitle']()}</p>
                  <p className="text-sm text-fg-muted dark:text-gray-300 mt-1">{m['ide.helpPanel.describeRequirementsDesc']()}</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 -subtle dark:bg-gray-700 p-3 rounded-lg border border-default dark:border-gray-600">
                <div className="flex-shrink-0 mt-0.5">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-accent/10 dark:bg-indigo-900/50 text-accent dark:text-indigo-400 font-medium text-xs">3</span>
                </div>
                <div>
                  <p className="text-fg-default dark:text-gray-200 font-medium">{m['ide.helpPanel.cancelRequestsTitle']()}</p>
                  <p className="text-sm text-fg-muted dark:text-gray-300 mt-1">{m['ide.helpPanel.cancelRequestsDesc']()}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Drawer bottom button area */}
        <div className="border-t border-default dark:border-gray-700 px-5 py-4 flex justify-end gap-3 sticky bottom-0 dark:bg-gray-800">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-accent text-white dark:bg-indigo-600 dark:text-white hover:bg-accent-hover dark:hover:bg-indigo-500 transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 dark:focus:ring-offset-gray-800"
          >
            <span>{m['ide.helpPanel.closeHelp']()}</span>
          </button>
        </div>
      </div>
    </>
  );
}; 