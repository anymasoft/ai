import { NextResponse } from 'next/server';
import { SandboxFactory } from '@/lib/sandbox/factory';
// SandboxProvider type is used through SandboxFactory
import type { SandboxState } from '@/types/sandbox';
import { sandboxManager } from '@/lib/sandbox/sandbox-manager';

// Store active sandbox globally
declare global {
  var activeSandboxProvider: any;
  var sandboxData: any;
  var existingFiles: Set<string>;
  var sandboxState: SandboxState;
}

/**
 * Poll sandbox dev-server until it's ready to serve
 * Checks HTTP connectivity to verify dev-server is listening
 */
async function waitForSandboxReady(sandboxUrl: string, maxAttempts = 30): Promise<boolean> {
  const POLL_INTERVAL_MS = 300; // Check every 300ms
  let attempt = 0;

  while (attempt < maxAttempts) {
    try {
      // Try to fetch root to verify dev-server is responding
      const response = await fetch(sandboxUrl, {
        method: 'HEAD',
        timeout: 3000 // 3 second timeout per request
      });

      // If we get any 2xx response, server is ready
      if (response.status >= 200 && response.status < 300) {
        console.log(`[waitForSandboxReady] Sandbox ready after ${attempt + 1} attempts`);
        return true;
      }

      // Some status codes might indicate server is starting, keep trying
      if (response.status >= 500) {
        console.log(`[waitForSandboxReady] Server returning ${response.status}, waiting...`);
      }
    } catch (error) {
      // Network error = server not ready yet
      if (attempt % 5 === 0) {
        console.log(`[waitForSandboxReady] Attempt ${attempt + 1}/${maxAttempts}: server not responding yet`);
      }
    }

    attempt++;

    // Wait before next attempt
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  console.error(`[waitForSandboxReady] Sandbox did not become ready after ${maxAttempts} attempts`);
  return false;
}

export async function POST() {
  try {
    console.log('[create-ai-sandbox-v2] Creating sandbox...');
    
    // Clean up all existing sandboxes
    console.log('[create-ai-sandbox-v2] Cleaning up existing sandboxes...');
    await sandboxManager.terminateAll();
    
    // Also clean up legacy global state
    if (global.activeSandboxProvider) {
      try {
        await global.activeSandboxProvider.terminate();
      } catch (e) {
        console.error('Failed to terminate legacy global sandbox:', e);
      }
      global.activeSandboxProvider = null;
    }
    
    // Clear existing files tracking
    if (global.existingFiles) {
      global.existingFiles.clear();
    } else {
      global.existingFiles = new Set<string>();
    }

    // Create new sandbox using factory
    const provider = SandboxFactory.create();
    const sandboxInfo = await provider.createSandbox();
    
    console.log('[create-ai-sandbox-v2] Setting up Vite React app...');
    await provider.setupViteApp();

    // Register with sandbox manager
    sandboxManager.registerSandbox(sandboxInfo.sandboxId, provider);

    // Wait for dev-server to actually be ready before returning URL
    console.log('[create-ai-sandbox-v2] Waiting for dev-server to become ready...');
    const isReady = await waitForSandboxReady(sandboxInfo.url);

    if (!isReady) {
      console.error('[create-ai-sandbox-v2] Sandbox dev-server failed to become ready');
      // Clean up sandbox if it didn't become ready
      try {
        await provider.terminate();
      } catch (e) {
        console.error('Failed to terminate unready sandbox:', e);
      }

      return NextResponse.json(
        {
          error: 'Sandbox dev-server failed to start',
          details: 'Vite server did not become ready after 30 attempts'
        },
        { status: 500 }
      );
    }

    // Also store in legacy global state for backward compatibility
    global.activeSandboxProvider = provider;
    global.sandboxData = {
      sandboxId: sandboxInfo.sandboxId,
      url: sandboxInfo.url
    };

    // Initialize sandbox state
    global.sandboxState = {
      fileCache: {
        files: {},
        lastSync: Date.now(),
        sandboxId: sandboxInfo.sandboxId
      },
      sandbox: provider, // Store the provider instead of raw sandbox
      sandboxData: {
        sandboxId: sandboxInfo.sandboxId,
        url: sandboxInfo.url
      }
    };

    console.log('[create-ai-sandbox-v2] Sandbox ready at:', sandboxInfo.url);

    return NextResponse.json({
      success: true,
      sandboxId: sandboxInfo.sandboxId,
      url: sandboxInfo.url,
      provider: sandboxInfo.provider,
      message: 'Sandbox created and Vite React app initialized'
    });

  } catch (error) {
    console.error('[create-ai-sandbox-v2] Error:', error);
    
    // Clean up on error
    await sandboxManager.terminateAll();
    if (global.activeSandboxProvider) {
      try {
        await global.activeSandboxProvider.terminate();
      } catch (e) {
        console.error('Failed to terminate sandbox on error:', e);
      }
      global.activeSandboxProvider = null;
    }
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to create sandbox',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}