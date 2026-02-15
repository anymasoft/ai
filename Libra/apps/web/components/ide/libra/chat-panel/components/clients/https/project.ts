/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * project.ts
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

import type {ActionChunkType, DescriptionChunkType, ThinkingChunkType} from "@/ai/type";
import { tryCatch } from '@libra/common';

export async function llmGenerate( projectId: string,
                                   content: string,
                                   planId: string,
                                   selectedItems: any[] = [],
                                   fileDetails?: { key: string; name: string; type: string } | null,
                                   abortController?: AbortController,
                                   selectedModelId?: string,
                                   isDirectModification?: boolean) {
    // Extract target filename from selectedItems for direct modifications
    const targetFilename = isDirectModification && selectedItems.length > 0
        ? selectedItems[0]?.targetFilename || selectedItems[0]?.filePath || selectedItems[0]?.fileName
        : undefined

    console.log('[llmGenerate] Sending request to /api/ai with:', {
        projectId,
        planId,
        hasContent: !!content,
        selectedItemsCount: selectedItems.length,
        attachment: fileDetails,
        selectedModelId,
        isDirectModification,
        targetFilename
    })

    const response = await fetch('/api/ai', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            message: content,
            planId,
            projectId,
            selectedItems: selectedItems.length > 0 ? selectedItems : undefined,
            attachment: fileDetails || undefined,
            selectedModelId: selectedModelId || undefined,
            isDirectModification: isDirectModification || undefined,
            targetFilename: targetFilename || undefined,
        }),
        ...(abortController && { signal: abortController.signal }),
    });
    if (!response.ok) {
        console.error('[llmGenerate] Response not OK:', {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries())
        });

        // Try to get response text first
        const [responseText, textError] = await tryCatch(async () => {
            return await response.text();
        });

        if (textError) {
            console.error('[llmGenerate] Failed to read response text:', textError);
        } else {
            console.log('[llmGenerate] Response text:', responseText);
        }

        // Try to parse error response to get specific error details
        let errorData: { details?: string; error?: string; [key: string]: any } = {};
        let errorMessage = 'Request failed';

        if (responseText) {
            const [parsed, parseError] = tryCatch(() => {
                return JSON.parse(responseText);
            });

            if (parseError) {
                console.error('[llmGenerate] Failed to parse JSON response:', parseError);
                // If it's not JSON, use the raw text as error message
                errorMessage = responseText || 'Request failed';
            } else {
                errorData = parsed;
                errorMessage = errorData.details || errorData.error || 'Request failed';
                console.log('[llmGenerate] Parsed error data:', errorData);
            }
        }

        // Create enhanced error object with type information
        const error = new Error(errorMessage) as Error & {
            type?: string;
            status?: number;
            originalError?: any;
            responseText?: string;
        };
        error.status = response.status;
        error.originalError = errorData;
        error.responseText = responseText || undefined;

        // Identify error types based on message content
        if (errorMessage.includes('quota exceeded') || errorMessage.includes('AI quota exceeded')) {
            error.type = 'QUOTA_EXCEEDED';
        } else if (response.status === 401) {
            error.type = 'UNAUTHORIZED';
        } else if (response.status === 403) {
            error.type = 'FORBIDDEN';
        } else {
            error.type = 'UNKNOWN';
        }

        console.log('[llmGenerate] Throwing error:', {
            message: error.message,
            type: error.type,
            status: error.status
        });

        throw error;
    }

    const JSONDecoder = new TransformStream<string, DescriptionChunkType | ThinkingChunkType | ActionChunkType>({
        transform(chunk, controller) {
            const lines = chunk.split('\n');
            for (const line of lines) {
                if (line.trim() !== '') {
                    const parsed = JSON.parse(line);
                    controller.enqueue(parsed);
                }
            }
        },
    });

    return StreamToIterable(
        response?.body?.pipeThrough(new TextDecoderStream()).pipeThrough(JSONDecoder) ?? new ReadableStream(),
    );
}
function StreamToIterable<T>(stream: ReadableStream<T>): AsyncIterable<T> {
    // Check if stream already implements AsyncIterable interface
    if (stream && typeof (stream as any)[Symbol.asyncIterator] === 'function') {
        return (stream as any)[Symbol.asyncIterator]();
    }
    return createIterable(stream);
}

async function* createIterable<T>(stream: ReadableStream<T>): AsyncIterable<T> {
    const reader = stream.getReader();

    try {
        while (true) {
            const { done, value } = await reader.read();

            if (done) {
                return;
            }

            yield value;
        }
    } finally {
        reader.releaseLock();
    }
}