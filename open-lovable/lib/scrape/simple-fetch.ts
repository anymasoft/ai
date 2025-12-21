/**
 * Simple HTTP fetch scraper - no JS, no headless
 * Fast and free alternative for basic HTML content
 */

export async function simpleFetch(url: string): Promise<{
  success: boolean;
  html?: string;
  error?: string;
}> {
  const timeout = 7000; // 7 second timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
      },
      signal: controller.signal,
      redirect: 'follow'
    });

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}`
      };
    }

    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('text/html')) {
      return {
        success: false,
        error: 'Not HTML content'
      };
    }

    const html = await response.text();

    // Validate HTML quality
    if (!html || html.length < 1000) {
      return {
        success: false,
        error: 'HTML too short'
      };
    }

    // Check if it's just an empty SPA shell
    if (html.includes('<div id="root">') && html.length < 5000) {
      // This is likely just a React/Vue shell without actual content
      return {
        success: false,
        error: 'Empty SPA shell'
      };
    }

    return {
      success: true,
      html
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: errorMsg
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Convert HTML to markdown-like text (simple extraction)
 */
export function htmlToText(html: string): string {
  // Remove script and style tags
  let text = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, ' ');

  // Decode HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");

  // Clean up whitespace
  text = text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n');

  // Remove excessive blank lines
  text = text.replace(/\n\n+/g, '\n\n');

  return text.substring(0, 50000); // Limit to 50k chars
}
