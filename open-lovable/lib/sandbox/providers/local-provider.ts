import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { SandboxProvider, SandboxInfo, CommandResult } from '../types';
import { localSandboxManager } from '../local-sandbox-manager';

export class LocalProvider extends SandboxProvider {
  private process: ChildProcess | null = null;
  private templateDir: string = path.join(process.cwd(), 'open-lovable', 'templates', 'vite-react');
  private sandboxesDir: string = path.join(process.cwd(), 'sandboxes');

  async createSandbox(): Promise<SandboxInfo> {
    try {
      // Generate sandbox ID and get port
      const sandboxId = localSandboxManager.generateSandboxId();
      const port = localSandboxManager.getNextPort();
      const sandboxDir = path.join(this.sandboxesDir, sandboxId);

      console.log(`[LocalProvider] Creating sandbox ${sandboxId} on port ${port}`);

      // Create sandboxes directory if not exists
      await fs.mkdir(this.sandboxesDir, { recursive: true });

      // Copy template to sandbox directory
      console.log(`[LocalProvider] Copying template from ${this.templateDir} to ${sandboxDir}`);
      await this.copyDir(this.templateDir, sandboxDir);

      // Register sandbox
      localSandboxManager.registerSandbox(sandboxId, sandboxDir, port);

      // Start Vite dev server
      console.log(`[LocalProvider] Starting Vite on port ${port}`);
      await this.startViteServer(sandboxId, sandboxDir, port);

      const url = `http://localhost:${port}`;

      this.sandboxInfo = {
        sandboxId,
        url,
        provider: 'vercel', // Keep as 'vercel' for backward compatibility with types
        createdAt: new Date()
      };

      return this.sandboxInfo;
    } catch (error) {
      console.error('[LocalProvider] Error creating sandbox:', error);
      throw error;
    }
  }

  async setupViteApp(): Promise<void> {
    // App is already set up when template is copied
    console.log('[LocalProvider] Vite app setup complete (template copied)');
  }

  async runCommand(command: string): Promise<CommandResult> {
    if (!this.sandboxInfo) {
      throw new Error('No active sandbox');
    }

    const sandboxDir = localSandboxManager.getSandbox(this.sandboxInfo.sandboxId)?.dir;
    if (!sandboxDir) {
      throw new Error('Sandbox directory not found');
    }

    try {
      const [cmd, ...args] = command.split(' ');
      const result = await new Promise<CommandResult>((resolve) => {
        const process = spawn(cmd, args, { cwd: sandboxDir });
        let stdout = '';
        let stderr = '';

        process.stdout?.on('data', (data) => {
          stdout += data.toString();
        });

        process.stderr?.on('data', (data) => {
          stderr += data.toString();
        });

        process.on('close', (code) => {
          resolve({
            stdout,
            stderr,
            exitCode: code || 0,
            success: code === 0
          });
        });
      });

      return result;
    } catch (error) {
      throw new Error(`Failed to run command: ${(error as Error).message}`);
    }
  }

  async writeFile(path: string, content: string): Promise<void> {
    if (!this.sandboxInfo) {
      throw new Error('No active sandbox');
    }

    const sandboxDir = localSandboxManager.getSandbox(this.sandboxInfo.sandboxId)?.dir;
    if (!sandboxDir) {
      throw new Error('Sandbox directory not found');
    }

    const filePath = path.startsWith('/') ? path : `/${path}`;
    const fullPath = `${sandboxDir}${filePath}`;

    // Ensure directory exists
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });

    // Write file
    await fs.writeFile(fullPath, content, 'utf-8');
  }

  async readFile(filePath: string): Promise<string> {
    if (!this.sandboxInfo) {
      throw new Error('No active sandbox');
    }

    const sandboxDir = localSandboxManager.getSandbox(this.sandboxInfo.sandboxId)?.dir;
    if (!sandboxDir) {
      throw new Error('Sandbox directory not found');
    }

    const fullPath = path.join(sandboxDir, filePath.startsWith('/') ? filePath.slice(1) : filePath);
    return fs.readFile(fullPath, 'utf-8');
  }

  async listFiles(directory?: string): Promise<string[]> {
    if (!this.sandboxInfo) {
      throw new Error('No active sandbox');
    }

    const sandboxDir = localSandboxManager.getSandbox(this.sandboxInfo.sandboxId)?.dir;
    if (!sandboxDir) {
      throw new Error('Sandbox directory not found');
    }

    const dir = directory ? path.join(sandboxDir, directory) : sandboxDir;
    const files = await fs.readdir(dir, { recursive: true });
    return files.map(f => typeof f === 'string' ? f : f);
  }

  async installPackages(packages: string[]): Promise<CommandResult> {
    // npm install already done during setup
    console.log('[LocalProvider] Packages already installed during setup');
    return {
      stdout: 'Packages already installed',
      stderr: '',
      exitCode: 0,
      success: true
    };
  }

  getSandboxUrl(): string | null {
    return this.sandboxInfo?.url || null;
  }

  getSandboxInfo(): SandboxInfo | null {
    return this.sandboxInfo;
  }

  /**
   * Reconnect to an existing local sandbox
   * Used when edits are applied to an existing sandbox
   */
  async reconnect(sandboxId: string): Promise<boolean> {
    const sandbox = localSandboxManager.getSandbox(sandboxId);

    if (!sandbox) {
      console.log(`[LocalProvider] Cannot reconnect - sandbox ${sandboxId} not found in manager`);
      return false;
    }

    if (!sandbox.process || sandbox.process.killed) {
      console.log(`[LocalProvider] Cannot reconnect - process for ${sandboxId} is not alive`);
      return false;
    }

    console.log(`[LocalProvider] Reconnecting to existing sandbox ${sandboxId}`);

    // Set sandbox info from the manager's record
    this.sandboxInfo = {
      sandboxId,
      url: `http://localhost:${sandbox.port}`,
      provider: 'vercel',
      createdAt: new Date()
    };
    this.process = sandbox.process;

    return true;
  }

  async terminate(): Promise<void> {
    if (!this.sandboxInfo) return;

    localSandboxManager.terminateSandbox(this.sandboxInfo.sandboxId);
    console.log(`[LocalProvider] Sandbox ${this.sandboxInfo.sandboxId} terminated`);
  }

  isAlive(): boolean {
    if (!this.sandboxInfo) return false;
    return localSandboxManager.isProcessAlive(this.sandboxInfo.sandboxId);
  }

  async restartViteServer(): Promise<void> {
    if (!this.sandboxInfo) {
      throw new Error('No active sandbox');
    }

    const sandbox = localSandboxManager.getSandbox(this.sandboxInfo.sandboxId);
    if (!sandbox) {
      throw new Error('Sandbox not found');
    }

    console.log(`[LocalProvider] Restarting Vite for ${this.sandboxInfo.sandboxId}`);

    // Kill existing process
    if (sandbox.process && !sandbox.process.killed) {
      sandbox.process.kill();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Start new Vite process
    await this.startViteServer(this.sandboxInfo.sandboxId, sandbox.dir, sandbox.port);
  }

  // Private helpers

  private async startViteServer(sandboxId: string, sandboxDir: string, port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const process = spawn('npm', ['run', 'dev', '--', '--port', port.toString(), '--host', '0.0.0.0'], {
        cwd: sandboxDir,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      this.process = process;
      localSandboxManager.setProcess(sandboxId, process);

      let viteReady = false;

      process.stdout?.on('data', (data) => {
        const line = data.toString();
        localSandboxManager.addLog(sandboxId, line);

        if (line.includes('Local:') || line.includes('ready')) {
          viteReady = true;
        }
      });

      process.stderr?.on('data', (data) => {
        const line = data.toString();
        localSandboxManager.addLog(sandboxId, line);
      });

      process.on('error', (error) => {
        console.error(`[LocalProvider] Process error: ${error}`);
        reject(error);
      });

      process.on('close', (code) => {
        console.log(`[LocalProvider] Vite process closed with code ${code}`);
      });

      // Wait a bit for process to start
      setTimeout(() => {
        resolve();
      }, 2000);
    });
  }

  private async copyDir(src: string, dest: string): Promise<void> {
    await fs.mkdir(dest, { recursive: true });
    const files = await fs.readdir(src);

    for (const file of files) {
      const srcPath = path.join(src, file);
      const destPath = path.join(dest, file);
      const stat = await fs.stat(srcPath);

      if (stat.isDirectory()) {
        await this.copyDir(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }
}
