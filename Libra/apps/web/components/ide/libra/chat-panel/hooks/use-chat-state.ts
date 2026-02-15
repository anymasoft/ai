/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * use-chat-state.ts
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

import { useState, useMemo } from 'react'
import type { 
    CodeChange, 
    Version, 
    Feedback, 
    ChatFunctionOptions
} from './types'
import type { DetailedLoadingStatus } from '../types'
import type {
    HistoryType,
    FileDiffType
} from '@libra/common'

/**
 * Chat state management Hook
 */
export const useChatState = (
    initialMessages: HistoryType,
    options?: ChatFunctionOptions
) => {
    
    // Validate initial message format and fix possible issues
    const validateInitialMessages = (msgs: any[]): HistoryType => {
        if (!Array.isArray(msgs) || msgs.length === 0) {
            return [];
        }

        // Validate that each message contains necessary fields
        return msgs.filter(msg => {
            // Check if basic fields exist
            if (!msg || typeof msg !== 'object' || !msg.type) {
                return false;
            }

            // Validate specific fields required for each message type
            if (msg.type === 'user' && !msg.message) {
                return false;
            }

            if (msg.type === 'plan' && !msg.content) {
                return false;
            }

            // Passed validation
            return true;
        });
    };

    // Validate and process initial messages
    const validInitialMessages = validateInitialMessages(initialMessages);

    // State definitions
    const [fileDiffs, setFileDiffs] = useState<FileDiffType[]>([]);
    const [loading, setLoading] = useState<DetailedLoadingStatus>(null);
    const [history, setHistory] = useState<HistoryType>(validInitialMessages);
    const [messages, setMessages] = useState<HistoryType>(validInitialMessages);
    const [isLoading, setIsLoading] = useState(false);
    const [codeChanges, setCodeChanges] = useState<CodeChange[]>([]);
    const [currentVersion, setCurrentVersion] = useState<Version | null>(null);
    const [feedback, setFeedback] = useState<Feedback | null>(null);

    // Default configuration
    const defaultOptions = {
        sendDefaultThinkingMessage: false // Don't send placeholder thinking message by default
    };

    // Merge user-provided options with default options
    const mergedOptions = useMemo(() => ({
        ...defaultOptions,
        ...options
    }), [options]);
    

    return {
        fileDiffs,
        setFileDiffs,
        loading,
        setLoading,
        history,
        setHistory,
        messages,
        setMessages,
        isLoading, 
        setIsLoading,
        codeChanges,
        setCodeChanges,
        currentVersion,
        setCurrentVersion,
        feedback,
        setFeedback,
        mergedOptions
    };
}; 