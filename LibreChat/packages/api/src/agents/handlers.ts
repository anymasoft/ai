import { logger } from '@librechat/data-schemas';
import { GraphEvents, Constants } from '@librechat/agents';
import type {
  LCTool,
  EventHandler,
  LCToolRegistry,
  ToolCallRequest,
  ToolExecuteResult,
  ToolExecuteBatchRequest,
} from '@librechat/agents';
import type { StructuredToolInterface } from '@langchain/core/tools';
import { runOutsideTracing } from '~/utils';
import {
  createExecutionState,
  checkToolCallLimit,
  checkToolTimeout,
  recordToolCallStart,
  recordToolCallEnd,
  getDefaultLimits,
  getExecutionStats,
} from './guardrails';
import { withTimeout } from './toolTimeout';

export interface ToolEndCallbackData {
  output: {
    name: string;
    tool_call_id: string;
    content: string | unknown;
    artifact?: unknown;
  };
}

export interface ToolEndCallbackMetadata {
  run_id?: string;
  thread_id?: string;
  [key: string]: unknown;
}

export type ToolEndCallback = (
  data: ToolEndCallbackData,
  metadata: ToolEndCallbackMetadata,
) => Promise<void>;

export interface ToolExecuteOptions {
  /** Loads tools by name, using agentId to look up agent-specific context */
  loadTools: (
    toolNames: string[],
    agentId?: string,
  ) => Promise<{
    loadedTools: StructuredToolInterface[];
    /** Additional configurable properties to merge (e.g., userMCPAuthMap) */
    configurable?: Record<string, unknown>;
  }>;
  /** Callback to process tool artifacts (code output files, file citations, etc.) */
  toolEndCallback?: ToolEndCallback;
}

/**
 * Creates the ON_TOOL_EXECUTE handler for event-driven tool execution.
 * This handler receives batched tool calls, loads the required tools,
 * executes them in parallel, and resolves with the results.
 * Includes guard rails to prevent infinite loops and resource exhaustion.
 */
export function createToolExecuteHandler(options: ToolExecuteOptions): EventHandler {
  const { loadTools, toolEndCallback } = options;

  return {
    handle: async (_event: string, data: ToolExecuteBatchRequest) => {
      const { toolCalls, agentId, configurable, metadata, resolve, reject } = data;

      try {
        await runOutsideTracing(async () => {
          try {
            // Initialize execution state and limits for this message
            const executionState = createExecutionState();
            const limits = getDefaultLimits();

            // Apply guard rails: filter tool calls that exceed limits
            const allowedToolCalls: ToolCallRequest[] = [];
            const blockedToolCalls: Array<{ tc: ToolCallRequest; reason: string }> = [];

            for (const tc of toolCalls) {
              const limitError = checkToolCallLimit(executionState, limits, tc.name);
              if (limitError) {
                blockedToolCalls.push({ tc, reason: limitError });
                logger.info(
                  `[ON_TOOL_EXECUTE][GUARD_RAIL] Tool call blocked for "${tc.name}": ${limitError}`,
                );
              } else {
                allowedToolCalls.push(tc);
                recordToolCallStart(executionState, tc.id, tc.name);
              }
            }

            // Log statistics
            const stats = getExecutionStats(executionState);
            logger.info(
              `[ON_TOOL_EXECUTE][LIMITS] Tool calls: ${stats.toolCallCount}/${limits.maxToolCallsPerMessage}, ` +
                `Tavily searches: ${stats.tavilySearchCount}/${limits.maxTavilySearchesPerMessage}`,
            );

            const toolNames = [...new Set(allowedToolCalls.map((tc: ToolCallRequest) => tc.name))];
            const { loadedTools, configurable: toolConfigurable } = await loadTools(
              toolNames,
              agentId,
            );
            const toolMap = new Map(loadedTools.map((t) => [t.name, t]));
            const mergedConfigurable = { ...configurable, ...toolConfigurable };

            const results: ToolExecuteResult[] = await Promise.all(
              allowedToolCalls.map(async (tc: ToolCallRequest) => {
                const tool = toolMap.get(tc.name);

                if (!tool) {
                  logger.warn(
                    `[ON_TOOL_EXECUTE] Tool "${tc.name}" not found. Available: ${[...toolMap.keys()].join(', ')}`,
                  );
                  return {
                    toolCallId: tc.id,
                    status: 'error' as const,
                    content: '',
                    errorMessage: `Tool ${tc.name} not found`,
                  };
                }

                try {
                  const toolCallConfig: Record<string, unknown> = {
                    id: tc.id,
                    stepId: tc.stepId,
                    turn: tc.turn,
                  };

                  if (
                    tc.codeSessionContext &&
                    (tc.name === Constants.EXECUTE_CODE ||
                      tc.name === Constants.PROGRAMMATIC_TOOL_CALLING)
                  ) {
                    toolCallConfig.session_id = tc.codeSessionContext.session_id;
                    if (tc.codeSessionContext.files && tc.codeSessionContext.files.length > 0) {
                      toolCallConfig._injected_files = tc.codeSessionContext.files;
                    }
                  }

                  if (tc.name === Constants.PROGRAMMATIC_TOOL_CALLING) {
                    const toolRegistry = mergedConfigurable?.toolRegistry as
                      | LCToolRegistry
                      | undefined;
                    const ptcToolMap = mergedConfigurable?.ptcToolMap as
                      | Map<string, StructuredToolInterface>
                      | undefined;
                    if (toolRegistry) {
                      const toolDefs: LCTool[] = Array.from(toolRegistry.values()).filter(
                        (t) =>
                          t.name !== Constants.PROGRAMMATIC_TOOL_CALLING &&
                          t.name !== Constants.TOOL_SEARCH,
                      );
                      toolCallConfig.toolDefs = toolDefs;
                      toolCallConfig.toolMap = ptcToolMap ?? toolMap;
                    }
                  }

                  // Apply timeout guard rail for tool execution
                  const result = await withTimeout(
                    tool.invoke(tc.args, {
                      toolCall: toolCallConfig,
                      configurable: mergedConfigurable,
                      metadata,
                    } as Record<string, unknown>),
                    limits.toolTimeoutMs,
                    tc.name,
                  );

                  if (toolEndCallback) {
                    await toolEndCallback(
                      {
                        output: {
                          name: tc.name,
                          tool_call_id: tc.id,
                          content: result.content,
                          artifact: result.artifact,
                        },
                      },
                      {
                        run_id: (metadata as Record<string, unknown>)?.run_id as string | undefined,
                        thread_id: (metadata as Record<string, unknown>)?.thread_id as
                          | string
                          | undefined,
                        ...metadata,
                      },
                    );
                  }

                  recordToolCallEnd(executionState, tc.id);
                  return {
                    toolCallId: tc.id,
                    content: result.content,
                    artifact: result.artifact,
                    status: 'success' as const,
                  };
                } catch (toolError) {
                  recordToolCallEnd(executionState, tc.id);
                  const error = toolError as Error;
                  logger.error(`[ON_TOOL_EXECUTE] Tool ${tc.name} error:`, error);
                  return {
                    toolCallId: tc.id,
                    status: 'error' as const,
                    content: '',
                    errorMessage: error.message,
                  };
                }
              }),
            );

            // Add results for blocked tool calls
            const blockedResults: ToolExecuteResult[] = blockedToolCalls.map(({ tc, reason }) => ({
              toolCallId: tc.id,
              status: 'error' as const,
              content: '',
              errorMessage: reason,
            }));

            // Combine results from allowed and blocked tool calls, maintaining original order
            const allResults = toolCalls.map((tc) => {
              const allowedResult = results.find((r) => r.toolCallId === tc.id);
              if (allowedResult) {
                return allowedResult;
              }
              const blockedResult = blockedResults.find((r) => r.toolCallId === tc.id);
              return (
                blockedResult || {
                  toolCallId: tc.id,
                  status: 'error' as const,
                  content: '',
                  errorMessage: 'Unknown error',
                }
              );
            });

            resolve(allResults);
          } catch (error) {
            logger.error('[ON_TOOL_EXECUTE] Fatal error:', error);
            reject(error as Error);
          }
        });
      } catch (outerError) {
        logger.error('[ON_TOOL_EXECUTE] Unexpected error:', outerError);
        reject(outerError as Error);
      }
    },
  };
}

/**
 * Creates a handlers object that includes ON_TOOL_EXECUTE.
 * Can be merged with other handler objects.
 */
export function createToolExecuteHandlers(
  options: ToolExecuteOptions,
): Record<string, EventHandler> {
  return {
    [GraphEvents.ON_TOOL_EXECUTE]: createToolExecuteHandler(options),
  };
}
