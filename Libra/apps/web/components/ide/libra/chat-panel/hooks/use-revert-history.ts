/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * use-revert-history.ts
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

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";
import { useProjectContext } from '@/lib/hooks/use-project-id';
import type { HistoryType } from '@libra/common';

/**
 * Message rollback Hook
 * Used to rollback chat history to specified planId
 */
export const useRevertHistory = (
    setHistory: React.Dispatch<React.SetStateAction<HistoryType>>,
    setMessages: React.Dispatch<React.SetStateAction<HistoryType>>,
) => {
    const { projectId } = useProjectContext();
    const trpc = useTRPC();
    const queryClient = useQueryClient();

    // Mutation for rolling back history
    const revertHistoryMutation = useMutation(
        trpc.history.revert.mutationOptions({
            onSuccess: async (data) => {
                // Refresh history query cache
                await queryClient.invalidateQueries(trpc.history.getAll.pathFilter());
                toast.success('Successfully rolled back to previous state, refreshing...');
                // Directly refresh page to get latest state
                setTimeout(() => window.location.reload(), 1000);
            },
            onError: (err) => {
                toast.error(err.data?.code === 'UNAUTHORIZED' ? 'You must be logged in to rollback the project' : 'Failed to rollback project');
            },
        })
    );

    /**
     * Execute history rollback
     * @param planId Plan ID to rollback to
     */
    const revertHistory = async (planId: string) => {
        if (!projectId) {
            console.error('[Chat Panel] Error: projectId is empty, cannot rollback');
            toast.error('Cannot rollback: Project ID does not exist');
            return;
        }

        if (!planId) {
            console.error('[Chat Panel] Error: planId is empty, cannot rollback');
            toast.error('Cannot rollback: Plan ID does not exist');
            return;
        }

        
        try {
            // Show rollback in progress message
            toast.info('Rolling back message history, please wait...');
            
            // Call API to execute rollback
            const result = await revertHistoryMutation.mutateAsync({
                id: projectId,
                planId: planId
            });
            
            return result;
        } catch (error) {
            toast.error('Failed to rollback history');
            throw error;
        }
    };

    return {
        revertHistory,
        revertHistoryMutation
    };
}; 