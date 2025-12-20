import { ChildProcess } from 'child_process';

/**
 * Minimal local sandbox manager
 * Tracks running sandboxes: sandboxId → { dir, port, process }
 */
export interface LocalSandboxInfo {
  sandboxId: string;
  dir: string;
  port: number;
  process: ChildProcess | null;
  logsBuffer: string[];
}

class LocalSandboxManager {
  private sandboxes: Map<string, LocalSandboxInfo> = new Map();
  private portCounter: number = 5173;

  /**
   * Generate new sandbox ID
   */
  generateSandboxId(): string {
    return `sbx_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Register new sandbox
   */
  registerSandbox(sandboxId: string, dir: string, port: number): LocalSandboxInfo {
    const info: LocalSandboxInfo = {
      sandboxId,
      dir,
      port,
      process: null,
      logsBuffer: []
    };
    this.sandboxes.set(sandboxId, info);
    return info;
  }

  /**
   * Get sandbox info
   */
  getSandbox(sandboxId: string): LocalSandboxInfo | undefined {
    return this.sandboxes.get(sandboxId);
  }

  /**
   * Get next available port
   */
  getNextPort(): number {
    return this.portCounter++;
  }

  /**
   * Set process for sandbox
   */
  setProcess(sandboxId: string, process: ChildProcess | null): void {
    const sandbox = this.sandboxes.get(sandboxId);
    if (sandbox) {
      sandbox.process = process;
    }
  }

  /**
   * Add log line to buffer
   */
  addLog(sandboxId: string, line: string): void {
    const sandbox = this.sandboxes.get(sandboxId);
    if (sandbox) {
      sandbox.logsBuffer.push(line);
      // Keep only last 200 lines
      if (sandbox.logsBuffer.length > 200) {
        sandbox.logsBuffer.shift();
      }
    }
  }

  /**
   * Get logs for sandbox
   */
  getLogs(sandboxId: string): string[] {
    const sandbox = this.sandboxes.get(sandboxId);
    return sandbox?.logsBuffer || [];
  }

  /**
   * Check if process is alive
   */
  isProcessAlive(sandboxId: string): boolean {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox || !sandbox.process) return false;
    return !sandbox.process.killed;
  }

  /**
   * Get all sandboxes
   */
  getAllSandboxes(): LocalSandboxInfo[] {
    return Array.from(this.sandboxes.values());
  }

  /**
   * Terminate single sandbox (cleanup in Vercel provider handled separately)
   */
  terminateSandbox(sandboxId: string): void {
    const sandbox = this.sandboxes.get(sandboxId);
    if (sandbox && sandbox.process && !sandbox.process.killed) {
      sandbox.process.kill();
    }
  }
}

// Singleton instance
export const localSandboxManager = new LocalSandboxManager();
