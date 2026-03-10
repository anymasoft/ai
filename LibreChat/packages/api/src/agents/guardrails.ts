/**
 * Guard rails for tool execution - prevents infinite loops and resource exhaustion
 * Adds safety limits without changing existing architecture or MCP communication
 */

export interface ToolExecutionLimits {
  maxToolCallsPerMessage: number;
  maxTavilySearchesPerMessage: number;
  toolTimeoutMs: number;
}

export interface ToolExecutionState {
  toolCallCount: number;
  tavilySearchCount: number;
  toolStartTimes: Map<string, number>; // toolCallId -> startTime
}

/**
 * Default execution limits
 * Can be overridden via environment variables
 */
export const getDefaultLimits = (): ToolExecutionLimits => ({
  maxToolCallsPerMessage: parseInt(
    process.env.MAX_TOOL_CALLS_PER_MESSAGE || '6',
    10,
  ),
  maxTavilySearchesPerMessage: parseInt(
    process.env.MAX_TAVILY_SEARCHES_PER_MESSAGE || '3',
    10,
  ),
  toolTimeoutMs: parseInt(
    process.env.TOOL_TIMEOUT_MS || '30000', // 30 seconds
    10,
  ),
});

/**
 * Creates a new execution state tracker for a message
 */
export function createExecutionState(): ToolExecutionState {
  return {
    toolCallCount: 0,
    tavilySearchCount: 0,
    toolStartTimes: new Map(),
  };
}

/**
 * Checks if a tool call should be allowed
 * Returns error message if limit exceeded, null if allowed
 */
export function checkToolCallLimit(
  state: ToolExecutionState,
  limits: ToolExecutionLimits,
  toolName: string,
): string | null {
  // Check total tool call limit
  if (state.toolCallCount >= limits.maxToolCallsPerMessage) {
    return `Maximum tool calls (${limits.maxToolCallsPerMessage}) reached for this message. Tool execution stopped.`;
  }

  // Check Tavily-specific limit
  if (toolName === 'tavily_search_results_json') {
    if (state.tavilySearchCount >= limits.maxTavilySearchesPerMessage) {
      return `Maximum Tavily searches (${limits.maxTavilySearchesPerMessage}) reached for this message. Search execution stopped.`;
    }
  }

  return null;
}

/**
 * Records a tool call start
 */
export function recordToolCallStart(
  state: ToolExecutionState,
  toolCallId: string,
  toolName: string,
): void {
  state.toolCallCount += 1;

  if (toolName === 'tavily_search_results_json') {
    state.tavilySearchCount += 1;
  }

  state.toolStartTimes.set(toolCallId, Date.now());
}

/**
 * Checks if a tool call has exceeded timeout
 * Returns error message if timed out, null if still running
 */
export function checkToolTimeout(
  state: ToolExecutionState,
  limits: ToolExecutionLimits,
  toolCallId: string,
): string | null {
  const startTime = state.toolStartTimes.get(toolCallId);
  if (!startTime) {
    return null; // Tool not yet started or already completed
  }

  const elapsed = Date.now() - startTime;
  if (elapsed > limits.toolTimeoutMs) {
    return `Tool execution timeout (${limits.toolTimeoutMs}ms exceeded). Execution terminated.`;
  }

  return null;
}

/**
 * Records tool call completion
 */
export function recordToolCallEnd(
  state: ToolExecutionState,
  toolCallId: string,
): void {
  state.toolStartTimes.delete(toolCallId);
}

/**
 * Gets current execution statistics for logging
 */
export function getExecutionStats(state: ToolExecutionState): {
  toolCallCount: number;
  tavilySearchCount: number;
  activeToolCalls: number;
} {
  return {
    toolCallCount: state.toolCallCount,
    tavilySearchCount: state.tavilySearchCount,
    activeToolCalls: state.toolStartTimes.size,
  };
}
