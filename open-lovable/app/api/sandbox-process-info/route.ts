import { NextRequest, NextResponse } from 'next/server';
import { localSandboxManager } from '@/lib/sandbox/local-sandbox-manager';

/**
 * Get process information for a sandbox
 * Used for diagnostics to verify Vite is running from correct directory
 */
export async function POST(request: NextRequest) {
  try {
    const { sandboxId } = await request.json();

    if (!sandboxId) {
      return NextResponse.json({
        error: 'sandboxId is required'
      }, { status: 400 });
    }

    console.log('[sandbox-process-info] Checking:', { sandboxId });

    // Get sandbox info from LocalSandboxManager
    const sandbox = localSandboxManager.getSandbox(sandboxId);

    if (!sandbox) {
      return NextResponse.json({
        error: `Sandbox not found: ${sandboxId}`,
        sandboxId,
        found: false
      }, { status: 404 });
    }

    const isAlive = !sandbox.process || !sandbox.process.killed ? true : false;

    console.log('[sandbox-process-info.DEBUG]', {
      sandboxId,
      dir: sandbox.dir,
      port: sandbox.port,
      pid: sandbox.process?.pid || null,
      isAlive,
      logsCount: sandbox.logsBuffer.length
    });

    return NextResponse.json({
      success: true,
      sandboxId,
      dir: sandbox.dir,
      port: sandbox.port,
      pid: sandbox.process?.pid || null,
      isAlive,
      logsCount: sandbox.logsBuffer.length,
      lastLogs: sandbox.logsBuffer.slice(-10)
    });
  } catch (error) {
    console.error('[sandbox-process-info] Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      success: false
    }, { status: 500 });
  }
}
