/**
 * Utility for adding timeouts to tool execution promises
 * Prevents tool calls from hanging indefinitely
 */

/**
 * Creates a promise that rejects after a specified timeout
 */
function createTimeoutPromise<T>(timeoutMs: number, toolName: string): Promise<T> {
  return new Promise<T>((_, reject) => {
    setTimeout(() => {
      reject(
        new Error(
          `Tool execution timeout (${timeoutMs}ms) exceeded for "${toolName}". Request was terminated.`,
        ),
      );
    }, timeoutMs);
  });
}

/**
 * Wraps a promise with a timeout
 * Returns whichever completes first: the original promise or the timeout
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  toolName: string,
): Promise<T> {
  if (timeoutMs <= 0) {
    // No timeout if timeoutMs is invalid
    return promise;
  }

  return Promise.race([promise, createTimeoutPromise<T>(timeoutMs, toolName)]);
}

/**
 * Converts AbortSignal-based cancellation into timeout error
 */
export function createAbortablePromise<T>(
  promise: Promise<T>,
  abortSignal?: AbortSignal,
): Promise<T> {
  if (!abortSignal) {
    return promise;
  }

  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      abortSignal.addEventListener('abort', () => {
        reject(new Error('Operation was aborted'));
      });
    }),
  ]);
}
