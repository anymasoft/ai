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

import type {
    CommandMessageType,
    DiffMessageType,
    FileDiffType,
    FileType,
    HistoryType,
    MessageType,
    PlanMessageType,
    ThinkingMessageType,
    UserMessageType
} from '@libra/common';
import {createId} from "@paralleldrive/cuid2";
import type { DetailedLoadingStatus, LoadingStage } from '../types';

// Extended chat message types
export type Message = MessageType & {
    id?: string;
    role?: string;
    content?: string;
    status?: 'normal' | 'thinking' | 'error';
    thinking_content?: string;
    fileChanges?: Array<{
        path: string;
        type: 'create' | 'edit';
        status: 'loading' | 'completed' | 'error';
    }>;
}

// Code change type
export type CodeChange = {
    filePath: string;
    content: string;
    type: 'create' | 'edit';
}

// Version type
export type Version = {
    id: string;
    name: string;
    description: string;
    createdAt: string;
}

// Feedback type
export type Feedback = {
    rating: 'positive' | 'negative';
    comment?: string;
}

// Chat feature options
export type ChatFunctionOptions = {
    sendDefaultThinkingMessage?: boolean;
}

// Create default thinking message - remove static content, support dynamic loading components
const createThinkingMessage = (planId: string = createId()): ThinkingMessageType => ({
    type: 'thinking',
    content: '', // Remove static text, let component dynamically render loading state
    planId
});

// Create error message
const createErrorMessage = (planId: string = createId()): PlanMessageType => ({
    type: 'plan',
    content: "An error occurred while processing your request, please try again later.",
    planId
});

// Smart loading component related type definitions
type IntelligentLoadingContext = {
    userInputType?: 'code' | 'ui' | 'general' | 'debug';
    hasSelectedElements?: boolean;
    estimatedComplexity?: 'low' | 'medium' | 'high';
};

type LoadingDescriptor = {
    thinking: string;
    description: string;
    actions: string;
};

type IntelligentLoadingComposerProps = {
    planId: string;
    loadingStatus?: DetailedLoadingStatus;
    currentStage?: LoadingStage;
    progress?: number;
    context?: IntelligentLoadingContext;
    className?: string;
    isActive?: boolean;
    onStageComplete?: (stage: LoadingStage) => void;
};

// Context-aware loading description mapping
const LOADING_DESCRIPTORS: Record<string, LoadingDescriptor> = {
    code: {
        thinking: 'Analyzing code structure and logic...',
        description: 'Developing code optimization plan...',
        actions: 'Generating improved code...'
    },
    ui: {
        thinking: 'Analyzing interface design and user experience...',
        description: 'Planning interface optimization strategy...',
        actions: 'Implementing interface improvements...'
    },
    debug: {
        thinking: 'Diagnosing root cause of issues...',
        description: 'Developing debugging solution...',
        actions: 'Executing fix measures...'
    },
    general: {
        thinking: 'Deeply understanding your requirements...',
        description: 'Developing detailed solution...',
        actions: 'Executing specific operations...'
    }
}; 