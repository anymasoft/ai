/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * use-element-selector.ts
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

import { useCallback, useEffect, useState } from 'react'
import { toast } from '@libra/ui/components/sonner'
import * as m from '@/paraglide/messages'

// 元素选择器状态枚举
export enum ElementSelectorState {
  INACTIVE = 'inactive',
  ACTIVATING = 'activating', 
  ACTIVE = 'active',
  SELECTING = 'selecting'
}

// 选中元素的类型定义
export interface SelectedElement {
  id: string
  type: string
  tagName: string
  className?: string
  textContent?: string
  attributes?: Record<string, string>
  timestamp: number
}

interface UseElementSelectorProps {
  /** 初始激活状态 */
  initialActive?: boolean
  /** 最大选择数量限制 */
  maxSelections?: number
  /** 状态变化回调 */
  onStateChange?: (state: ElementSelectorState) => void
  /** 元素选择回调 */
  onElementSelect?: (element: SelectedElement) => void
  /** 元素移除回调 */
  onElementRemove?: (elementId: string) => void
  /** 选择模式切换回调 */
  onToggle?: (isActive: boolean) => void
}

/**
 * 元素选择器状态管理Hook
 * 提供完整的元素选择功能和状态管理
 */
export const useElementSelector = ({
  initialActive = false,
  maxSelections = 10,
  onStateChange,
  onElementSelect,
  onElementRemove,
  onToggle
}: UseElementSelectorProps = {}) => {
  // 基础状态
  const [isActive, setIsActive] = useState(initialActive)
  const [selectedElements, setSelectedElements] = useState<SelectedElement[]>([])
  const [isActivating, setIsActivating] = useState(false)

  // 计算当前状态
  const getCurrentState = useCallback((): ElementSelectorState => {
    if (isActivating) return ElementSelectorState.ACTIVATING
    if (!isActive) return ElementSelectorState.INACTIVE
    if (selectedElements.length > 0) return ElementSelectorState.SELECTING
    return ElementSelectorState.ACTIVE
  }, [isActive, isActivating, selectedElements.length])

  const currentState = getCurrentState()

  // 切换选择模式
  const toggleSelector = useCallback(async () => {
    const newActiveState = !isActive

    if (newActiveState) {
      // 激活选择模式
      setIsActivating(true)
      
      try {
        // 模拟激活过程（可以在这里添加实际的激活逻辑）
        await new Promise(resolve => setTimeout(resolve, 300))
        
        setIsActive(true)
        toast.success(m['chatPanel.elementSelector.activatedSuccess']?.() || '元素选择模式已激活')
      } catch (error) {
        toast.error(m['chatPanel.elementSelector.activationFailed']?.() || '激活元素选择模式失败')
        console.error('Failed to activate element selector:', error)
      } finally {
        setIsActivating(false)
      }
    } else {
      // 停用选择模式
      setIsActive(false)
      toast.info(m['chatPanel.elementSelector.deactivated']?.() || '元素选择模式已停用')
    }

    onToggle?.(newActiveState)
  }, [isActive, onToggle])

  // 添加选中元素
  const addSelectedElement = useCallback((element: Omit<SelectedElement, 'timestamp'>) => {
    if (selectedElements.length >= maxSelections) {
      toast.warning(m['chatPanel.elementSelector.maxSelectionsReached']?.({ max: maxSelections }) || 
        `最多只能选择 ${maxSelections} 个元素`)
      return false
    }

    const newElement: SelectedElement = {
      ...element,
      timestamp: Date.now()
    }

    setSelectedElements(prev => {
      // 检查是否已经选择了相同元素
      const exists = prev.some(el => el.id === element.id)
      if (exists) {
        toast.info(m['chatPanel.elementSelector.elementAlreadySelected']?.() || '该元素已被选择')
        return prev
      }

      const updated = [...prev, newElement]
      onElementSelect?.(newElement)
      toast.success(m['chatPanel.elementSelector.elementAdded']?.({
        tagName: element.tagName
      }) || `已选择 ${element.tagName} 元素`)
      
      return updated
    })

    return true
  }, [selectedElements.length, maxSelections, onElementSelect])

  // 移除选中元素
  const removeSelectedElement = useCallback((elementId: string) => {
    setSelectedElements(prev => {
      const elementToRemove = prev.find(el => el.id === elementId)
      if (!elementToRemove) return prev

      const updated = prev.filter(el => el.id !== elementId)
      onElementRemove?.(elementId)
      
      toast.success(m['chatPanel.elementSelector.elementRemoved']?.({
        tagName: elementToRemove.tagName
      }) || `已移除 ${elementToRemove.tagName} 元素`)
      
      return updated
    })
  }, [onElementRemove])

  // 清除所有选中元素
  const clearSelectedElements = useCallback(() => {
    const count = selectedElements.length
    if (count === 0) return

    setSelectedElements([])
    toast.success(m['chatPanel.elementSelector.allElementsCleared']?.({ count }) || 
      `已清除 ${count} 个选中元素`)
  }, [selectedElements.length])

  // 获取状态描述文本
  const getStateDescription = useCallback(() => {
    switch (currentState) {
      case ElementSelectorState.INACTIVE:
        return m['chatPanel.elementSelector.stateInactive']?.() || '点击开始选择元素'
      case ElementSelectorState.ACTIVATING:
        return m['chatPanel.elementSelector.stateActivating']?.() || '正在启动选择模式...'
      case ElementSelectorState.ACTIVE:
        return m['chatPanel.elementSelector.stateActive']?.() || '点击页面元素进行选择'
      case ElementSelectorState.SELECTING:
        return m['chatPanel.elementSelector.stateSelecting']?.({ count: selectedElements.length }) || 
          `已选择 ${selectedElements.length} 个元素`
      default:
        return ''
    }
  }, [currentState, selectedElements.length])

  // 状态变化通知
  useEffect(() => {
    onStateChange?.(currentState)
  }, [currentState, onStateChange])

  // 自动停用选择模式（当没有选中元素且处于激活状态超过一定时间）
  useEffect(() => {
    if (currentState === ElementSelectorState.ACTIVE) {
      const timeout = setTimeout(() => {
        if (selectedElements.length === 0 && isActive) {
          toast.info(m['chatPanel.elementSelector.autoDeactivated']?.() || '选择模式已自动停用')
          setIsActive(false)
          onToggle?.(false)
        }
      }, 30000) // 30秒后自动停用

      return () => clearTimeout(timeout)
    }
  }, [currentState, selectedElements.length, isActive, onToggle])

  return {
    // 状态
    isActive,
    currentState,
    selectedElements,
    selectedCount: selectedElements.length,
    isActivating,
    canSelectMore: selectedElements.length < maxSelections,
    
    // 操作方法
    toggleSelector,
    addSelectedElement,
    removeSelectedElement,
    clearSelectedElements,
    
    // 辅助方法
    getStateDescription,
    
    // 配置
    maxSelections
  }
}
