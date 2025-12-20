import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import { promises as fsAsync } from 'fs';
import path from 'path';
import os from 'os';
import { SandboxProvider, SandboxInfo, CommandResult } from '../types';
import { localSandboxManager } from '../local-sandbox-manager';

export class LocalProvider extends SandboxProvider {
  private process: ChildProcess | null = null;
  private templateDir: string = path.join(process.cwd(), 'templates', 'vite-react');
  private sandboxesDir: string = path.join(process.cwd(), 'sandboxes');

  async createSandbox(): Promise<SandboxInfo> {
    try {
      // Generate sandbox ID and get port
      const sandboxId = localSandboxManager.generateSandboxId();
      const port = localSandboxManager.getNextPort();
      const sandboxDir = path.join(this.sandboxesDir, sandboxId);

      console.log(`[LocalProvider] Creating sandbox ${sandboxId} on port ${port}`);

      // Verify template exists
      if (!fs.existsSync(this.templateDir)) {
        throw new Error(`Vite template not found at: ${this.templateDir}`);
      }

      // Create sandboxes directory if not exists
      await fsAsync.mkdir(this.sandboxesDir, { recursive: true });

      // Copy template to sandbox directory
      console.log(`[LocalProvider] Copying template from ${this.templateDir} to ${sandboxDir}`);
      await this.copyDir(this.templateDir, sandboxDir);

      // HARD-GUARD: Verify package.json was copied correctly
      const packageJsonPath = path.join(sandboxDir, 'package.json');
      if (!fs.existsSync(packageJsonPath)) {
        throw new Error(`[FATAL] Invalid sandboxDir - no package.json found after template copy at: ${packageJsonPath}`);
      }
      console.log(`[LocalProvider.DEBUG] package.json verified at: ${packageJsonPath}`);

      // Add sandbox ID marker to index.html for verification
      const indexHtmlPath = path.join(sandboxDir, 'index.html');
      if (fs.existsSync(indexHtmlPath)) {
        let htmlContent = fs.readFileSync(indexHtmlPath, 'utf-8');
        const marker = `<!-- SANDBOX_ID: ${sandboxId} -->`;
        if (!htmlContent.includes('SANDBOX_ID')) {
          htmlContent = htmlContent.replace('<head>', `<head>\n    ${marker}`);
          fs.writeFileSync(indexHtmlPath, htmlContent, 'utf-8');
          console.log(`[LocalProvider.DEBUG] Added sandbox marker to index.html`);
        }
      }

      // Register sandbox
      localSandboxManager.registerSandbox(sandboxId, sandboxDir, port);

      // Install dependencies
      console.log(`[LocalProvider] Installing dependencies via npm install...`);
      try {
        await this.runInstall(sandboxDir);
      } catch (error) {
        console.error(`[LocalProvider] npm install failed:`, error);
        throw new Error(`Failed to install dependencies: ${(error as Error).message}`);
      }

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
    await fsAsync.mkdir(dir, { recursive: true });

    // Write file
    await fsAsync.writeFile(fullPath, content, 'utf-8');
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
    return fsAsync.readFile(fullPath, 'utf-8');
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
    const files = await fsAsync.readdir(dir, { recursive: true });
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
      const npmCommand = os.platform() === 'win32' ? 'npm.cmd' : 'npm';

      // HARD-GUARD: sandboxDir MUST exist and have package.json
      if (!fs.existsSync(sandboxDir)) {
        throw new Error(`[FATAL] sandboxDir does not exist: ${sandboxDir}`);
      }
      const packageJsonPath = path.join(sandboxDir, 'package.json');
      if (!fs.existsSync(packageJsonPath)) {
        throw new Error(`[FATAL] sandboxDir missing package.json: ${sandboxDir}`);
      }

      // DIAGNOSTIC LOG: VITE-LAUNCH
      console.log('[VITE-LAUNCH]', JSON.stringify({
        sandboxId,
        sandboxDir,
        nodeCwd: process.cwd(),
        spawnCwd: sandboxDir,
        port,
        cmd: npmCommand,
        args: ['run', 'dev', '--', '--port', String(port), '--host', '0.0.0.0'],
        timestamp: new Date().toISOString()
      }, null, 2));

      const child = spawn(npmCommand, ['run', 'dev', '--', '--port', port.toString(), '--host', '0.0.0.0'], {
        cwd: sandboxDir,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      // DIAGNOSTIC LOG: VITE-PID
      console.log('[VITE-PID]', { sandboxId, pid: child.pid, port, timestamp: new Date().toISOString() });

      // Store references EXACTLY once
      this.process = child;
      localSandboxManager.setProcess(sandboxId, child);

      let viteReady = false;
      const stdout_lines: string[] = [];
      const stderr_lines: string[] = [];

      child.stdout?.on('data', (data) => {
        const line = data.toString();
        stdout_lines.push(line);
        localSandboxManager.addLog(sandboxId, line);

        // Check for Vite readiness markers
        if (line.includes('Local:') || line.includes('ready')) {
          viteReady = true;
          console.log('[VITE-READY-DETECTED]', { sandboxId, marker: line.substring(0, 50), pid: child.pid });
        }

        // Log first few Vite startup messages for debugging
        if (stdout_lines.length <= 5) {
          console.log(`[VITE-STDOUT] ${line.substring(0, 100)}`);
        }
      });

      child.stderr?.on('data', (data) => {
        const line = data.toString();
        stderr_lines.push(line);
        localSandboxManager.addLog(sandboxId, line);

        // Log errors but don't fail on warnings
        if (stderr_lines.length <= 5) {
          console.log(`[VITE-STDERR] ${line.substring(0, 100)}`);
        }
      });

      child.on('error', (error) => {
        console.error(`[VITE-PROCESS-ERROR]`, { sandboxId, error: error.message, pid: child.pid });
        reject(error);
      });

      child.on('close', (code) => {
        console.log(`[VITE-CLOSE]`, { sandboxId, exitCode: code, pid: child.pid, stdout_lines: stdout_lines.length, stderr_lines: stderr_lines.length });
      });

      // Wait for process to start and get ready
      setTimeout(() => {
        console.log('[VITE-STARTUP-COMPLETE]', { sandboxId, viteReady, pid: child.pid, port });
        resolve();
      }, 2000);
    });
  }

  private async runInstall(sandboxDir: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const npmCommand = os.platform() === 'win32' ? 'npm.cmd' : 'npm';
      const installProcess = spawn(npmCommand, ['install', '--legacy-peer-deps'], {
        cwd: sandboxDir,
        stdio: 'inherit'
      });

      installProcess.on('close', (code) => {
        if (code === 0) {
          console.log('[LocalProvider] npm install completed successfully');
          resolve();
        } else {
          reject(new Error(`npm install failed with exit code ${code}`));
        }
      });

      installProcess.on('error', (error) => {
        reject(error);
      });
    });
  }

  private async copyDir(src: string, dest: string): Promise<void> {
    await fsAsync.mkdir(dest, { recursive: true });
    const files = await fsAsync.readdir(src);

    for (const file of files) {
      const srcPath = path.join(src, file);
      const destPath = path.join(dest, file);
      const stat = await fsAsync.stat(srcPath);

      if (stat.isDirectory()) {
        // Skip node_modules and .git directories
        if (file === 'node_modules' || file === '.git') {
          console.log(`[LocalProvider] Skipping directory: ${file}`);
          continue;
        }
        await this.copyDir(srcPath, destPath);
      } else {
        await fsAsync.copyFile(srcPath, destPath);
      }
    }
  }
}
