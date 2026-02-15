/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * types.ts
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

// iframe message types

// iframe message types
export type IframeMessage = {
  type: string
  payload: {
    id?: string
    filePath?: string
    fileName?: string
    lineNumber?: number
    col?: number
    elementType?: string
    content?: string
    children?: any[]
    className?: string
    textContent?: string
    attrs?: Record<string, string>
  }
}

// iframe info item types
export type IframeInfoItem = {
  id: string
  name: string
  filePath: string
  fileName: string
  lineNumber: number
  col: number
  elementType: string
  textContent: string
  className: string
  // Legacy optional fields for backward compatibility
  path?: string
  element?: any
  type?: string
  [key: string]: any
}

// Element editing types
export interface ElementEditingState {
  isEditing: boolean
  selectedElement: IframeInfoItem | null
  originalProperties: ElementProperties | null
  currentProperties: ElementProperties | null
}

export interface ElementProperties {
  content?: string
  fontSize?: string
  fontWeight?: string
  color?: string
  backgroundColor?: string
  marginTop?: string
  marginRight?: string
  marginBottom?: string
  marginLeft?: string
  paddingTop?: string
  paddingRight?: string
  paddingBottom?: string
  paddingLeft?: string
  [key: string]: any
}

// Code change types
type CodeChange = {
  filePath: string
  content: string
  type: 'create' | 'edit' | 'delete'
}

// Version control types
type Version = {
  id: string
  message: string
  timestamp: string
  changes: CodeChange[]
}

// Feedback types
type Feedback = {
  type: 'positive' | 'negative'
  message?: string
}

// Streaming response types
export type StreamResponseType = {
  type:
    | 'description'
    | 'thinking'
    | 'thinking-start'
    | 'thinking-end'
    | 'action'
    | 'error'
    | 'progress'
    | 'performance'
    | 'complete'
  planId?: string
  data?:
    | {
        content: string
        status?: string
        progress?: number
      }
    | {
        type: 'file' | 'command'
        description: string
        [key: string]: any
      }
}

// Enhanced Loading Status Types
export type DetailedLoadingStatus =
  | 'thinking_start'
  | 'thinking_progress'
  | 'thinking_complete'
  | 'description_start'
  | 'description_progress'
  | 'description_complete'
  | 'actions_start'
  | 'actions_progress'
  | 'actions_complete'
  | 'error'
  | 'complete'
  | null

// Loading Stage for enhanced components
export type LoadingStage = 'thinking' | 'description' | 'actions' | 'complete'

// Animation configuration interface
export interface AnimationConfig {
  breathingDuration?: number
  progressUpdateInterval?: number
  stageTransitionDuration?: number
  shimmerCycleDuration?: number
  enableParticleEffects?: boolean
  intensityMultiplier?: number
}

// Enhanced progress state
export interface EnhancedProgressState {
  stage: LoadingStage
  progress: number
  isActive: boolean
  startTime: number
  estimatedDuration?: number
  subSteps?: Array<{
    id: string
    label: string
    completed: boolean
    duration?: number
  }>
}

// Chat panel type definitions

// Base message type definitions
interface BaseMessageType {
  id: string
  created_at: Date
  planId?: string
  type?: string
  content?: {
    text?: string
    thinking?: string
    command?: any
    diff?: any
    plan?: any
  }
}

// User message types
interface UserMessageType extends BaseMessageType {
  role: 'user'
}

// AI message types
interface AIMessageType extends BaseMessageType {
  role: 'assistant'
}

type MessageType = UserMessageType | AIMessageType

// Enhanced Thinking Message Type with animation support
interface EnhancedThinkingMessageType extends BaseMessageType {
  type: 'thinking'
  content: {
    text?: string
    thinking?: string
    command?: any
    diff?: any
    plan?: any
  }
  planId: string
  animationConfig?: AnimationConfig
  progressState?: EnhancedProgressState
  isActive?: boolean
}

// Message group type definitions
export interface MessageGroup {
  type: 'user' | 'ai'
  planId?: string
  messages: any[]
}

// Browser preview interface
interface BrowserPreviewInterface {
  toggleInspector: (isActive?: boolean) => void
  sendInspectorStateToIframe: (isActive: boolean) => void
}

// Chat panel property definitions
export interface ChatPanelProps {
  initialMessages: any[]
  onSendMessage?: (message: string) => void
  onClose: () => void
  onInspectorChange?: (isActive: boolean) => void
  initialInspectorActive?: boolean
  browserPreviewRef?: React.RefObject<BrowserPreviewInterface | null>
  onFileClick: (filePath: string) => void
  onFileContentUpdate?: (content: string, filePath: string) => void
  deployChanges?: () => Promise<void>
  usageData?: any
  isUsageLoading?: boolean
  /** Detected errors from iframe monitoring */
  detectedErrors?: Array<{
    message: string
    filename?: string
    lineno?: number
    colno?: number
    stack?: string
    blankScreen?: boolean
  }>
  /** Ref to expose chat panel methods */
  chatPanelRef?: React.MutableRefObject<{ addMessage: (message: any) => void } | null>
}

// Enhanced Loading Status Type (replacing simple string)
type LoadingStatus = DetailedLoadingStatus

// New message state
interface NewMessageState {
  hasNewMessages: boolean
  unreadCount: number
}

// Scroll state
interface ScrollState {
  autoScrollEnabled: boolean
  lastScrollPosition: number
}

// Enhanced Message List Props with animation support
export interface MessageListProps {
  groupedMessages: MessageGroup[]
  isLoading: boolean
  loading: DetailedLoadingStatus
  onFileClick: (filePath: string) => void
  selectedItems: any[]
  messagesEndRef: React.RefObject<HTMLDivElement>
  revertHistory?: (planId: string) => Promise<any>
  removeSelectedItem: (index: number) => void
  animationConfig?: AnimationConfig
}

// Enhanced Chat Input Area Props
export interface ChatInputAreaProps {
  message: string
  isSending: boolean
  handleTextareaChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  handleSendMessage: (
    e: React.FormEvent,
    fileDetails?: { key: string; name: string; type: string } | null,
    planId?: string
  ) => void
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  isInspectorActive: boolean
  handleToggleInspector: () => void
  /** Enhanced AI processing status */
  loadingStatus?: DetailedLoadingStatus
  selectedItems?: IframeInfoItem[]
  onRemoveSelectedItem?: (index: number) => void
  /** Selected AI model ID */
  selectedModelId?: string
  /** Model change callback */
  onModelChange?: (modelId: string) => void
  /** Callback when a file is successfully uploaded */
  onFileUploadSuccess?: (fileDetails: { key: string; name: string; type: string }, planId: string) => void
  /** Callback when an uploaded file is removed by the user */
  onFileRemoved?: () => void
  /** Flag for externally triggered file state clearing */
  shouldClearFile?: boolean
  /** Function to stop AI generation */
  onStopGeneration?: () => void
  /** Whether generation is being stopped */
  isStopping?: boolean
  /** Whether generation can be stopped */
  canStop?: boolean
  /** Usage data from subscription */
  usageData?: any
  /** Whether usage data is loading */
  isUsageLoading?: boolean
  /** Detected errors from iframe monitoring */
  detectedErrors?: Array<{
    message: string
    filename?: string
    lineno?: number
    colno?: number
    stack?: string
    blankScreen?: boolean
  }>
  /** Callback when Auto Fix is triggered */
  onAutoFix?: (errors: Array<{
    message: string
    filename?: string
    lineno?: number
    colno?: number
    stack?: string
    blankScreen?: boolean
  }>) => void
}

// Animation State Management
interface AnimationState {
  breathingPhase: number
  shimmerPhase: number
  progressPhase: number
  isTransitioning: boolean
  currentIntensity: number
}
