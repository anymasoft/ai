import { NextRequest, NextResponse } from 'next/server';

/**
 * Verify that the sandbox URL is serving the correct project
 * by checking for the SANDBOX_ID marker in the HTML
 */
export async function POST(request: NextRequest) {
  try {
    const { sandboxUrl, sandboxId } = await request.json();

    if (!sandboxUrl || !sandboxId) {
      return NextResponse.json({
        error: 'sandboxUrl and sandboxId are required'
      }, { status: 400 });
    }

    console.log('[verify-sandbox-content] Checking:', { sandboxUrl, sandboxId });

    // Fetch the HTML content from sandbox
    const response = await fetch(sandboxUrl, {
      method: 'GET',
      timeout: 5000
    });

    if (!response.ok) {
      console.error('[verify-sandbox-content] HTTP error:', response.status);
      return NextResponse.json({
        success: false,
        error: `HTTP ${response.status}`,
        correctMarker: false,
        isDefaultApp: false
      });
    }

    const htmlContent = await response.text();

    // Check for correct marker
    const hasCorrectMarker = htmlContent.includes(`SANDBOX_ID: ${sandboxId}`);
    const isDefaultApp = htmlContent.includes('Welcome to your React App');

    console.log('[verify-sandbox-content.DEBUG]', {
      sandboxId,
      htmlLength: htmlContent.length,
      hasCorrectMarker,
      isDefaultApp,
      htmlPreview: htmlContent.substring(0, 300)
    });

    // DIAGNOSTIC: If wrong marker, show what we got
    if (!hasCorrectMarker && htmlContent.length < 2000) {
      console.warn('[verify-sandbox-content] Full HTML (sandbox is small or error):', htmlContent);
    }

    return NextResponse.json({
      success: hasCorrectMarker,
      correctMarker: hasCorrectMarker,
      isDefaultApp,
      htmlLength: htmlContent.length,
      sandboxId,
      sandboxUrl,
      verdict: hasCorrectMarker ? 'CORRECT_SANDBOX' : isDefaultApp ? 'DEFAULT_APP' : 'UNKNOWN_APP'
    });
  } catch (error) {
    console.error('[verify-sandbox-content] Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      success: false,
      correctMarker: false
    }, { status: 500 });
  }
}
