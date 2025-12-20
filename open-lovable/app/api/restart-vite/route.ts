import { NextResponse } from 'next/server';

declare global {
  var activeSandbox: any;
  var activeSandboxProvider: any;
  var lastViteRestartTime: number;
  var viteRestartInProgress: boolean;
  var sandboxData: any;
}

const RESTART_COOLDOWN_MS = 2000; // 2 second cooldown between restarts

/**
 * Poll dev-server until it responds to HTTP requests
 * Ensures Vite is actually listening before considering restart complete
 */
async function waitForViteReady(sandboxUrl: string, maxAttempts = 20): Promise<boolean> {
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
        console.log(`[waitForViteReady] Vite ready after ${attempt + 1} attempts`);
        return true;
      }

      // Some status codes might indicate server is starting, keep trying
      if (response.status >= 500) {
        console.log(`[waitForViteReady] Server returning ${response.status}, waiting...`);
      }
    } catch (error) {
      // Network error = server not ready yet
      if (attempt % 5 === 0) {
        console.log(`[waitForViteReady] Attempt ${attempt + 1}/${maxAttempts}: Vite not responding yet`);
      }
    }

    attempt++;

    // Wait before next attempt
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  console.error(`[waitForViteReady] Vite did not become ready after ${maxAttempts} attempts`);
  return false;
}

export async function POST() {
  try {
    console.log('[TRACE] restart-vite: start');
    // Check both v1 and v2 global references
    const provider = global.activeSandbox || global.activeSandboxProvider;
    
    if (!provider) {
      return NextResponse.json({ 
        success: false, 
        error: 'No active sandbox' 
      }, { status: 400 });
    }
    
    // Check if restart is already in progress
    if (global.viteRestartInProgress) {
      console.log('[restart-vite] Vite restart already in progress, skipping...');
      return NextResponse.json({
        success: true,
        message: 'Vite restart already in progress'
      });
    }
    
    // Check cooldown
    const now = Date.now();
    if (global.lastViteRestartTime && (now - global.lastViteRestartTime) < RESTART_COOLDOWN_MS) {
      const remainingTime = Math.ceil((RESTART_COOLDOWN_MS - (now - global.lastViteRestartTime)) / 1000);
      console.log(`[restart-vite] Cooldown active, ${remainingTime}s remaining`);
      return NextResponse.json({
        success: true,
        message: `Vite was recently restarted, cooldown active (${remainingTime}s remaining)`
      });
    }
    
    // Set the restart flag
    global.viteRestartInProgress = true;

    console.log('[restart-vite] Using provider method to restart Vite...');

    // Use the provider's restartViteServer method if available
    if (typeof provider.restartViteServer === 'function') {
      console.log('[TRACE] restart-vite: killing process');
      await provider.restartViteServer();
      console.log('[TRACE] restart-vite: starting new Vite');
      console.log('[restart-vite] Vite restarted via provider method');
    } else {
      // Fallback to manual restart using provider's runCommand
      console.log('[restart-vite] Fallback to manual Vite restart...');

      // Kill existing Vite processes
      try {
        console.log('[TRACE] restart-vite: killing process');
        await provider.runCommand('pkill -f vite');
        console.log('[restart-vite] Killed existing Vite processes');

        // Wait a moment for processes to terminate
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch {
        console.log('[restart-vite] No existing Vite processes found');
      }

      // Clear any error tracking files
      try {
        await provider.runCommand('bash -c "echo \'{\\"errors\\": [], \\"lastChecked\\": '+ Date.now() +'}\' > /tmp/vite-errors.json"');
      } catch {
        // Ignore if this fails
      }

      // Start Vite dev server in background
      await provider.runCommand('sh -c "nohup npm run dev > /tmp/vite.log 2>&1 &"');
      console.log('[restart-vite] Vite dev server restarted');

      // Wait for Vite to start up
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // Wait for Vite to actually be ready before returning success
    if (global.sandboxData?.url) {
      console.log('[TRACE] restart-vite: waiting for readiness');
      console.log('[restart-vite] Waiting for Vite to become ready...');
      const isReady = await waitForViteReady(global.sandboxData.url);

      console.log('[TRACE] restart-vite: READY (200 OK)');

      if (!isReady) {
        console.error('[restart-vite] Vite failed to become ready after restart');
        global.viteRestartInProgress = false;
        global.lastViteRestartTime = Date.now();

        return NextResponse.json({
          success: false,
          error: 'Vite failed to become ready',
          details: 'Dev-server did not respond after restart'
        }, { status: 500 });
      }

      console.log('[restart-vite] Vite is ready');
    }

    // Update global state
    global.lastViteRestartTime = Date.now();
    global.viteRestartInProgress = false;

    console.log('[TRACE] restart-vite: returning response');
    return NextResponse.json({
      success: true,
      message: 'Vite restarted successfully and is ready'
    });
    
  } catch (error) {
    console.error('[restart-vite] Error:', error);
    
    // Clear the restart flag on error
    global.viteRestartInProgress = false;
    
    return NextResponse.json({ 
      success: false, 
      error: (error as Error).message 
    }, { status: 500 });
  }
}