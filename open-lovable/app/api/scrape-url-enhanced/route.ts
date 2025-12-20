import { NextRequest, NextResponse } from 'next/server';

// Function to sanitize smart quotes and other problematic characters
function sanitizeQuotes(text: string): string {
  return text
    // Replace smart single quotes
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    // Replace smart double quotes
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    // Replace other quote-like characters
    .replace(/[\u00AB\u00BB]/g, '"') // Guillemets
    .replace(/[\u2039\u203A]/g, "'") // Single guillemets
    // Replace other problematic characters
    .replace(/[\u2013\u2014]/g, '-') // En dash and em dash
    .replace(/[\u2026]/g, '...') // Ellipsis
    .replace(/[\u00A0]/g, ' '); // Non-breaking space
}

export async function POST(request: NextRequest) {
  let url = '';

  try {
    const body = await request.json();
    url = body.url;

    if (!url) {
      return NextResponse.json({
        success: false,
        error: 'URL is required'
      }, { status: 400 });
    }

    console.log('[scrape-url-enhanced] Scraping with Firecrawl:', url);

    const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
    if (!FIRECRAWL_API_KEY) {
      console.warn('[scrape-url-enhanced] FIRECRAWL_API_KEY not set, using fallback');
      return NextResponse.json({
        ok: true,
        enhancedScrape: {
          success: false,
          fallback: true,
          reason: 'FIRECRAWL_API_KEY_NOT_SET'
        },
        structured: {
          title: new URL(url).hostname || 'Website',
          description: '',
          content: '',
          url,
          screenshot: null
        },
        metadata: {
          scraper: 'firecrawl-enhanced',
          timestamp: new Date().toISOString(),
          cached: false
        }
      });
    }

    // Make request to Firecrawl API with maxAge for 500% faster scraping
    let firecrawlResponse: Response;
    try {
      firecrawlResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url,
          formats: ['markdown', 'html', 'screenshot'],
          waitFor: 3000,
          timeout: 30000,
          blockAds: true,
          maxAge: 3600000, // Use cached data if less than 1 hour old (500% faster!)
          actions: [
            {
              type: 'wait',
              milliseconds: 2000
            },
            {
              type: 'screenshot',
              fullPage: false // Just visible viewport for performance
            }
          ]
        })
      });
    } catch (fetchError) {
      // Network error or timeout
      console.warn('[scrape-url-enhanced] Fetch failed, using fallback:', fetchError);
      return NextResponse.json({
        ok: true,
        enhancedScrape: {
          success: false,
          fallback: true,
          reason: 'FETCH_ERROR'
        },
        structured: {
          title: new URL(url).hostname || 'Website',
          description: '',
          content: '',
          url,
          screenshot: null
        },
        metadata: {
          scraper: 'firecrawl-enhanced',
          timestamp: new Date().toISOString(),
          cached: false
        }
      });
    }

    // Check Firecrawl API response
    if (!firecrawlResponse.ok) {
      const errorText = await firecrawlResponse.text();
      console.warn(
        '[scrape-url-enhanced] Firecrawl API error:',
        firecrawlResponse.status,
        errorText.substring(0, 200)
      );

      // Determine error reason from status code
      let errorReason = 'FIRECRAWL_ERROR';
      if (firecrawlResponse.status === 408) {
        errorReason = 'SCRAPE_TIMEOUT';
      } else if (firecrawlResponse.status === 403) {
        errorReason = 'FORBIDDEN';
      } else if (firecrawlResponse.status >= 500) {
        errorReason = 'FIRECRAWL_SERVER_ERROR';
      }

      // Return fallback response (always 200)
      return NextResponse.json({
        ok: true,
        enhancedScrape: {
          success: false,
          fallback: true,
          reason: errorReason,
          statusCode: firecrawlResponse.status
        },
        structured: {
          title: new URL(url).hostname || 'Website',
          description: '',
          content: '',
          url,
          screenshot: null
        },
        metadata: {
          scraper: 'firecrawl-enhanced',
          timestamp: new Date().toISOString(),
          cached: false
        }
      });
    }

    // Parse response
    let data;
    try {
      data = await firecrawlResponse.json();
    } catch (parseError) {
      console.warn('[scrape-url-enhanced] Failed to parse Firecrawl response:', parseError);
      return NextResponse.json({
        ok: true,
        enhancedScrape: {
          success: false,
          fallback: true,
          reason: 'PARSE_ERROR'
        },
        structured: {
          title: new URL(url).hostname || 'Website',
          description: '',
          content: '',
          url,
          screenshot: null
        },
        metadata: {
          scraper: 'firecrawl-enhanced',
          timestamp: new Date().toISOString(),
          cached: false
        }
      });
    }

    // Check if Firecrawl reported success
    if (!data.success || !data.data) {
      console.warn('[scrape-url-enhanced] Firecrawl reported failure:', data);
      return NextResponse.json({
        ok: true,
        enhancedScrape: {
          success: false,
          fallback: true,
          reason: 'FIRECRAWL_NO_DATA'
        },
        structured: {
          title: new URL(url).hostname || 'Website',
          description: '',
          content: '',
          url,
          screenshot: null
        },
        metadata: {
          scraper: 'firecrawl-enhanced',
          timestamp: new Date().toISOString(),
          cached: false
        }
      });
    }

    const { markdown, metadata, screenshot, actions } = data.data;
    // html available but not used in current implementation

    // Get screenshot from either direct field or actions result
    const screenshotUrl = screenshot || actions?.screenshots?.[0] || null;

    // Sanitize the markdown content
    const sanitizedMarkdown = sanitizeQuotes(markdown || '');

    // Extract structured data from the response
    const title = metadata?.title || '';
    const description = metadata?.description || '';

    // Format content for AI
    const formattedContent = `
Title: ${sanitizeQuotes(title)}
Description: ${sanitizeQuotes(description)}
URL: ${url}

Main Content:
${sanitizedMarkdown}
    `.trim();

    return NextResponse.json({
      ok: true,
      enhancedScrape: {
        success: true,
        fallback: false
      },
      url,
      content: formattedContent,
      screenshot: screenshotUrl,
      structured: {
        title: sanitizeQuotes(title),
        description: sanitizeQuotes(description),
        content: sanitizedMarkdown,
        url,
        screenshot: screenshotUrl
      },
      metadata: {
        scraper: 'firecrawl-enhanced',
        timestamp: new Date().toISOString(),
        contentLength: formattedContent.length,
        cached: data.data.cached || false, // Indicates if data came from cache
        ...metadata
      },
      message: 'URL scraped successfully with Firecrawl (with caching for 500% faster performance)'
    });

  } catch (error) {
    // Fallback for any unexpected errors
    console.error('[scrape-url-enhanced] Unexpected error:', error);
    const fallbackTitle = url ? new URL(url).hostname || 'Website' : 'Website';
    return NextResponse.json({
      ok: true,
      enhancedScrape: {
        success: false,
        fallback: true,
        reason: 'UNEXPECTED_ERROR'
      },
      structured: {
        title: fallbackTitle,
        description: '',
        content: '',
        url: url || '',
        screenshot: null
      },
      metadata: {
        scraper: 'firecrawl-enhanced',
        timestamp: new Date().toISOString(),
        cached: false
      }
    });
  }
}