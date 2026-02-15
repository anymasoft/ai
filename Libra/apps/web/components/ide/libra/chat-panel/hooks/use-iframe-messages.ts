/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * use-iframe-messages.ts
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

import { useCallback, useEffect, useState } from 'react'
import type { ElementEditingState, ElementProperties, IframeInfoItem, IframeMessage } from '../types'

interface UseIframeMessagesProps {
  onInspectorChange?: ((isActive: boolean) => void) | undefined;
  initialInspectorActive?: boolean;
  browserPreviewRef?: React.RefObject<{
    toggleInspector: (isActive?: boolean) => void;
    sendInspectorStateToIframe: (isActive: boolean) => void;
  } | null> | undefined;
}

/**
 * Custom Hook for handling iframe messages
 */
export const useIframeMessages = ({
  onInspectorChange,
  initialInspectorActive = false,
  browserPreviewRef
}: UseIframeMessagesProps) => {
  const [selectedItems, setSelectedItems] = useState<IframeInfoItem[]>([]);
  const [isInspectorActive, setIsInspectorActive] = useState(initialInspectorActive)

  // Element editing state
  const [editingState, setEditingState] = useState<ElementEditingState>({
    isEditing: false,
    selectedElement: null,
    originalProperties: null,
    currentProperties: null
  });

  /**
   * Add new selected element (maximum 3)
   */
  const addSelectedItem = useCallback((item: IframeInfoItem) => {
    setSelectedItems(prev => {
      // Check if the same element already exists
      const isDuplicate = prev.some(
        existing =>
          existing.filePath === item.filePath &&
          existing.fileName === item.fileName &&
          existing.lineNumber === item.lineNumber
      );

      if (isDuplicate) {
        return prev;
      }

      // Add new element to the beginning, keep only the latest 3
      const newItems = [item, ...prev];
      if (newItems.length > 3) {
        return newItems.slice(0, 3);
      }
      return newItems;
    });
  }, []);

  /**
   * Remove selected element - Fixed function, remove element by index
   */
  const removeSelectedItem = useCallback((index: number) => {
    // Remove by index, not by ID
    setSelectedItems(prev => {
      // Validate if index is valid
      if (index < 0 || index >= prev.length) {
        return prev;
      }

      // Create new array, excluding element at specified index
      const newItems = [...prev];
      newItems.splice(index, 1);

      return newItems;
    });
  }, []);

  /**
   * Request current element properties from iframe
   */
  const requestElementProperties = useCallback((element: IframeInfoItem): Promise<ElementProperties> => {
    return new Promise((resolve) => {
      const frames = document.querySelectorAll('iframe')

      // Create a unique request ID
      const requestId = `props_${Date.now()}_${Math.random()}`

      // Listen for the response
      const handleResponse = (event: MessageEvent) => {
        if (event.data?.type === 'ELEMENT_PROPERTIES_RESPONSE' && event.data?.requestId === requestId) {
          window.removeEventListener('message', handleResponse)
          resolve(event.data.payload)
        }
      }

      window.addEventListener('message', handleResponse)

      // Send request to iframe
      for (const frame of frames) {
        try {
          if (frame.contentWindow) {
            const message = {
              type: 'GET_ELEMENT_PROPERTIES',
              requestId,
              payload: {
                id: {
                  path: element.filePath,
                  line: element.lineNumber,
                  col: element.col
                }
              }
            }
            frame.contentWindow.postMessage(message, '*')
          }
        } catch (err) {
          // Failed to request element properties
        }
      }

      // Fallback timeout
      setTimeout(() => {
        window.removeEventListener('message', handleResponse)
        resolve({
          content: element.textContent || '',
          fontSize: '',
          fontWeight: 'normal',
          color: '',
          marginTop: '0',
          marginRight: '0',
          marginBottom: '0',
          marginLeft: '0',
          paddingTop: '0',
          paddingRight: '0',
          paddingBottom: '0',
          paddingLeft: '0'
        })
      }, 1000)
    })
  }, [])

  /**
   * Send property update to iframe
   */
  const sendPropertyUpdateToIframe = useCallback((element: IframeInfoItem, property: string, value: string) => {
    const frames = document.querySelectorAll('iframe')

    for (const frame of frames) {
      try {
        if (frame.contentWindow) {
          const message = {
            type: 'UPDATE_ELEMENT_PROPERTY',
            payload: {
              id: {
                path: element.filePath,
                line: element.lineNumber,
                col: element.col
              },
              property,
              value
            }
          }
          frame.contentWindow.postMessage(message, '*')
        }
      } catch (err) {
        // Failed to send property update to iframe
      }
    }
  }, [])

  /**
   * Start editing an element
   */
  const startElementEditing = useCallback(async (element: IframeInfoItem) => {
    // Get current properties from the actual DOM element
    const currentProperties = await requestElementProperties(element)

    setEditingState({
      isEditing: true,
      selectedElement: element,
      originalProperties: { ...currentProperties },
      currentProperties
    })
  }, [requestElementProperties])

  /**
   * Update element property and send to iframe
   */
  const updateElementProperty = useCallback((property: string, value: string) => {
    setEditingState(prev => {
      if (!prev.currentProperties) return prev

      const newProperties = {
        ...prev.currentProperties,
        [property]: value
      }

      // Send real-time update to iframe
      if (prev.selectedElement) {
        sendPropertyUpdateToIframe(prev.selectedElement, property, value)
      }

      return {
        ...prev,
        currentProperties: newProperties
      }
    })
  }, [sendPropertyUpdateToIframe])

  /**
   * Apply all changes and exit editing mode
   */
  const applyElementChanges = useCallback(() => {
    setEditingState({
      isEditing: false,
      selectedElement: null,
      originalProperties: null,
      currentProperties: null
    })
  }, [])

  /**
   * Cancel changes and restore original properties
   */
  const cancelElementChanges = useCallback(() => {
    if (editingState.selectedElement && editingState.originalProperties) {
      // Restore original properties
      for (const [property, value] of Object.entries(editingState.originalProperties)) {
        sendPropertyUpdateToIframe(editingState.selectedElement, property, value)
      }
    }

    setEditingState({
      isEditing: false,
      selectedElement: null,
      originalProperties: null,
      currentProperties: null
    })
  }, [editingState, sendPropertyUpdateToIframe])

  /**
   * Delete element and exit editing mode
   */
  const deleteElement = useCallback(() => {
    if (editingState.selectedElement) {
      // Send delete message to iframe
      const frames = document.querySelectorAll('iframe')

      for (const frame of frames) {
        try {
          if (frame.contentWindow) {
            const message = {
              type: 'DELETE_ELEMENT',
              payload: {
                id: {
                  path: editingState.selectedElement.filePath,
                  line: editingState.selectedElement.lineNumber,
                  col: editingState.selectedElement.col
                }
              }
            }
            frame.contentWindow.postMessage(message, '*')
          }
        } catch (err) {
          // Failed to send delete message to iframe
        }
      }

      // Remove from selected items if it exists
      setSelectedItems(prev =>
        prev.filter(item =>
          !(item.filePath === editingState.selectedElement?.filePath &&
            item.lineNumber === editingState.selectedElement?.lineNumber &&
            item.col === editingState.selectedElement?.col)
        )
      )
    }

    // Exit editing mode
    setEditingState({
      isEditing: false,
      selectedElement: null,
      originalProperties: null,
      currentProperties: null
    })
  }, [editingState])

  /**
   * Close editing panel
   */
  const closeElementEditor = useCallback(() => {
    cancelElementChanges()
  }, [cancelElementChanges])

  /**
   * Handle inspector toggle
   */
  const handleToggleInspector = useCallback(() => {
    // Toggle state
    const newState = !isInspectorActive;
    
    // Update local state
    setIsInspectorActive(newState);

    // Notify parent component
    if (onInspectorChange) {
      onInspectorChange(newState);
    }

    // Send message to all iframes
    const message = {
      type: "TOGGLE_SELECTOR",
      payload: newState
    };
    
    // Send message to all iframes on the page
    const frames = document.querySelectorAll('iframe');
    for (const frame of frames) {
      try {
        if (frame.contentWindow) {
          frame.contentWindow.postMessage(message, '*');
          
          // If closing inspector, also send message to clear selected elements
          if (!newState) {
            const clearMessage = {
              type: "UPDATE_SELECTED_ELEMENTS",
              payload: []
            };
            frame.contentWindow.postMessage(clearMessage, '*');
          }
        }
      } catch (err) {
        // Failed to send message to iframe
      }
    }
    
    // Send via browserPreviewRef (backup method)
    if (browserPreviewRef?.current) {
      browserPreviewRef.current.sendInspectorStateToIframe(newState);
    }
  }, [isInspectorActive, onInspectorChange, browserPreviewRef]);

  /**
   * Listen to iframe messages
   */
  useEffect(() => {
    const handleIframeMessage = (event: MessageEvent) => {
      try {
        const data = event.data as IframeMessage;
        
        if (data.type === "ELEMENT_CLICKED") {
          const newItem: IframeInfoItem = {
            id: Date.now().toString(), // Generate unique ID
            filePath: data.payload.filePath || '',
            fileName: data.payload.fileName || '',
            lineNumber: data.payload.lineNumber || 0,
            col: data.payload.col || 0,
            elementType: data.payload.elementType || '',
            textContent: data.payload.textContent || '',
            className: data.payload.className || '',
            // Use element type or content to display element name
            name: data.payload.elementType || data.payload.textContent?.substring(0, 20) || 'Unnamed element',
            // Ensure type field is present for API validation
            type: data.payload.elementType || 'element'
          };

          addSelectedItem(newItem);
        }

        if (data.type === "ELEMENT_DOUBLE_CLICKED") {
          const element: IframeInfoItem = {
            id: Date.now().toString(),
            filePath: data.payload.filePath || '',
            fileName: data.payload.fileName || '',
            lineNumber: data.payload.lineNumber || 0,
            col: data.payload.col || 0,
            elementType: data.payload.elementType || '',
            textContent: data.payload.textContent || '',
            className: data.payload.className || '',
            name: data.payload.elementType || data.payload.textContent?.substring(0, 20) || 'Unnamed element',
            // Ensure type field is present for API validation
            type: data.payload.elementType || 'element'
          };

          // Start editing the double-clicked element
          startElementEditing(element).catch(err => {
            // Failed to start element editing
          });
        }
      } catch (error) {
        // Error handling iframe message
      }
    };

    window.addEventListener("message", handleIframeMessage);
    
    return () => {
      window.removeEventListener("message", handleIframeMessage);
    };
  }, [addSelectedItem, startElementEditing]);

  return {
    selectedItems,
    isInspectorActive,
    addSelectedItem,
    removeSelectedItem,
    handleToggleInspector,
    // Element editing functions
    editingState,
    startElementEditing,
    updateElementProperty,
    applyElementChanges,
    cancelElementChanges,
    deleteElement,
    closeElementEditor
  };
}; 