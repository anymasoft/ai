import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import { promises as fsAsync } from 'fs';
import path from 'path';
import os from 'os';
import net from 'net';
import { SandboxProvider, SandboxInfo, CommandResult } from '../types';
import { localSandboxManager } from '../local-sandbox-manager';

/**
 * Найти свободный порт начиная с requestedPort
 * Используется когда запрошенный порт может быть занят
 */
async function findFreePort(startPort: number): Promise<number> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();

    server.on('error', () => {
      // Порт занят, пробуем следующий
      resolve(findFreePort(startPort + 1));
    });

    server.listen(startPort, '127.0.0.1', () => {
      const actualPort = (server.address() as any).port;
      server.close(() => resolve(actualPort));
    });
  });
}

export class LocalProvider extends SandboxProvider {
  private process: ChildProcess | null = null;
  private sandboxesDir: string = path.join(process.cwd(), 'sandboxes');

  async createSandbox(): Promise<SandboxInfo> {
    try {
      // Generate sandbox ID and get port
      const sandboxId = localSandboxManager.generateSandboxId();
      const port = localSandboxManager.getNextPort();
      const sandboxDir = path.join(this.sandboxesDir, sandboxId);

      console.log(`[LocalProvider] Creating sandbox ${sandboxId} on port ${port}`);

      // Create sandboxes directory if not exists
      await fsAsync.mkdir(this.sandboxesDir, { recursive: true });

      // Create sandbox scaffold (no template needed)
      console.log(`[LocalProvider] Creating sandbox scaffold in ${sandboxDir}`);
      await this.createSandboxScaffold(sandboxDir, sandboxId);

      // HARD-GUARD: Verify package.json was created correctly
      const packageJsonPath = path.join(sandboxDir, 'package.json');
      if (!fs.existsSync(packageJsonPath)) {
        throw new Error(`[FATAL] Invalid sandboxDir - no package.json found at: ${packageJsonPath}`);
      }
      console.log(`[LocalProvider.DEBUG] package.json created at: ${packageJsonPath}`);

      // Register sandbox
      localSandboxManager.registerSandbox(sandboxId, sandboxDir, port);
      console.log(`[LocalProvider] Registered sandbox:`, {
        sandboxId,
        sandboxDir,
        requestedPort: port,
        managerSandbox: localSandboxManager.getSandbox(sandboxId)
      });

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

      // ПОЛУЧИТЬ РЕАЛЬНЫЙ ПОРТ (может отличаться если исходный был занят)
      const sandbox = localSandboxManager.getSandbox(sandboxId);
      const actualPort = sandbox?.port || port;

      const url = `http://localhost:${actualPort}`;

      this.sandboxInfo = {
        sandboxId,
        url,
        provider: 'local',
        createdAt: new Date()
      };

      console.log(`[CREATE-SANDBOX-URL]`, { sandboxId, requestedPort: port, actualPort, url });

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

    // DIAGNOSTIC: Log file write
    console.log(`[LocalProvider.writeFile] File written:`, {
      sandboxId: this.sandboxInfo.sandboxId,
      relativePath: filePath,
      fullPath: fullPath,
      contentSize: content.length,
      firstChars: content.substring(0, 60).replace(/\n/g, '\\n')
    });
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
      provider: 'local',
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

  /**
   * @deprecated Vite dev-server runs continuously with HMR.
   * No restart required - changes are automatically picked up via Hot Module Replacement.
   * This method should NOT be called in production.
   */
  async restartViteServer(): Promise<void> {
    console.warn('[LocalProvider.restartViteServer] DEPRECATED: Vite uses HMR, no restart needed');
    // No-op: Vite continues running
  }

  // Private helpers

  private async createSandboxScaffold(sandboxDir: string, sandboxId: string): Promise<void> {
    // Создать директорию sandbox
    await fsAsync.mkdir(sandboxDir, { recursive: true });

    // Создать папку src
    const srcDir = path.join(sandboxDir, 'src');
    await fsAsync.mkdir(srcDir, { recursive: true });

    // Создать package.json с зависимостями
    const packageJson = {
      name: 'vite-react-app',
      private: true,
      version: '0.0.1',
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'vite build',
        preview: 'vite preview'
      },
      dependencies: {
        react: '^18.2.0',
        'react-dom': '^18.2.0'
      },
      devDependencies: {
        '@types/react': '^18.2.0',
        '@types/react-dom': '^18.2.0',
        '@vitejs/plugin-react': '^4.0.0',
        autoprefixer: '^10.4.14',
        postcss: '^8.4.31',
        tailwindcss: '^3.3.0',
        vite: '^4.4.0'
      }
    };

    const packageJsonPath = path.join(sandboxDir, 'package.json');
    await fsAsync.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log(`[LocalProvider.DEBUG] Created package.json`);

    // Создать index.html
    const indexHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <!-- SANDBOX_ID: ${sandboxId} -->
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Vite + React</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`;

    const indexPath = path.join(sandboxDir, 'index.html');
    await fsAsync.writeFile(indexPath, indexHtml);
    console.log(`[LocalProvider.DEBUG] Created index.html`);

    // Создать src/App.jsx
    const appJsx = `export default function App() {
  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>React App</h1>
      <p>Ready for generated code...</p>
    </div>
  )
}`;

    const appJsxPath = path.join(srcDir, 'App.jsx');
    await fsAsync.writeFile(appJsxPath, appJsx);
    console.log(`[LocalProvider.DEBUG] Created src/App.jsx`);

    // Создать src/index.css с @tailwind директивами
    const indexCss = `@tailwind base;
@tailwind components;
@tailwind utilities;`;

    const indexCssPath = path.join(srcDir, 'index.css');
    await fsAsync.writeFile(indexCssPath, indexCss);
    console.log(`[LocalProvider.DEBUG] Created src/index.css`);

    // Создать src/main.jsx (с импортом CSS)
    const mainJsx = `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`;

    const mainJsxPath = path.join(srcDir, 'main.jsx');
    await fsAsync.writeFile(mainJsxPath, mainJsx);
    console.log(`[LocalProvider.DEBUG] Created src/main.jsx`);

    // Создать vite.config.js
    const viteConfig = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true
  }
})`;

    const viteConfigPath = path.join(sandboxDir, 'vite.config.js');
    await fsAsync.writeFile(viteConfigPath, viteConfig);
    console.log(`[LocalProvider.DEBUG] Created vite.config.js`);

    // Создать tailwind.config.js
    const tailwindConfig = `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};`;

    const tailwindConfigPath = path.join(sandboxDir, 'tailwind.config.js');
    await fsAsync.writeFile(tailwindConfigPath, tailwindConfig);
    console.log(`[LocalProvider.DEBUG] Created tailwind.config.js`);

    // Создать postcss.config.js
    const postcssConfig = `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};`;

    const postcssConfigPath = path.join(sandboxDir, 'postcss.config.js');
    await fsAsync.writeFile(postcssConfigPath, postcssConfig);
    console.log(`[LocalProvider.DEBUG] Created postcss.config.js`);

    // Создать .gitignore
    const gitignore = `node_modules
dist
.env.local
.env.*.local`;

    const gitignorePath = path.join(sandboxDir, '.gitignore');
    await fsAsync.writeFile(gitignorePath, gitignore);
    console.log(`[LocalProvider.DEBUG] Created .gitignore`);
  }

  private async startViteServer(sandboxId: string, sandboxDir: string, port: number): Promise<void> {
    const npmCommand = os.platform() === 'win32' ? 'npm.cmd' : 'npm';

    // HARD-GUARD: sandboxDir MUST exist and have package.json
    if (!fs.existsSync(sandboxDir)) {
      throw new Error(`[FATAL] sandboxDir does not exist: ${sandboxDir}`);
    }
    const packageJsonPath = path.join(sandboxDir, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      throw new Error(`[FATAL] sandboxDir missing package.json: ${sandboxDir}`);
    }

    // НАЙТИ СВОБОДНЫЙ ПОРТ (важно для множественных sandbox на одной машине)
    const actualPort = await findFreePort(port);
    const portChanged = actualPort !== port;

    // DIAGNOSTIC LOG: VITE-LAUNCH (с информацией о смене порта)
    console.log('[VITE-LAUNCH]', JSON.stringify({
      sandboxId,
      sandboxDir,
      nodeCwd: process.cwd(),
      spawnCwd: sandboxDir,
      requestedPort: port,
      actualPort: actualPort,
      portChanged: portChanged,
      cmd: npmCommand,
      args: ['run', 'dev', '--', '--port', String(actualPort), '--host', '0.0.0.0', '--strictPort'],
      timestamp: new Date().toISOString()
    }, null, 2));

    // Обновить порт в LocalSandboxManager если он изменился
    if (portChanged) {
      const sandbox = localSandboxManager.getSandbox(sandboxId);
      if (sandbox) {
        sandbox.port = actualPort;
        console.log('[PORT-CHANGED]', { sandboxId, from: port, to: actualPort });
      }
    }

    return new Promise((resolve, reject) => {
      const child = spawn(npmCommand, ['run', 'dev', '--', '--port', actualPort.toString(), '--host', '0.0.0.0', '--strictPort'], {
        cwd: sandboxDir,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      // DIAGNOSTIC LOG: VITE-PID
      console.log('[VITE-PID]', { sandboxId, pid: child.pid, actualPort, timestamp: new Date().toISOString() });

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
