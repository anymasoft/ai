import * as cheerio from "cheerio";

// ---------------------------------------------------------------------------
// 1. Selectors for DOM elements to remove entirely
// ---------------------------------------------------------------------------

/** Framer UI overlays: badges, editor bar */
const FRAMER_UI_SELECTORS = [
  "#__framer-badge-container",
  ".__framer-badge",
  "a.__framer-badge",
  '[data-framer-name="Badge"]',
  "[data-framer-appear-id][class*='__framer-badge']",
  "[class*='__framer-badge']",
  "[id^='__framer-badge']",
  "#__framer-editorbar-container",
  "#__framer-editorbar-button",
  "#__framer-editorbar-label",
  "[id^='__framer-editorbar']",
  "iframe[id^='__framer-editorbar']",
];

/** Framer domains whose <script src> should be removed.
 * IMPORTANT: Do NOT add "framer.com" here — it matches module CDN
 * (framer.com/m/framer-motion, etc.) which is needed for animations.
 */
const FRAMER_SCRIPT_DOMAINS = [
  "events.framer.com",    // analytics only
  "router.framer.com",    // SPA router — not needed for static export
];

/** Patterns in inline <script> content that should be removed.
 * IMPORTANT: Only remove analytics/editor scripts.
 * Keep: __framer_importFromPackage (module loader — needed for animations),
 *       __framer_registry (component registration — needed for animations),
 *       __framer_ssr (SSR state — may contain animation parameters),
 *       framer-page-transition (page transition animations).
 */
const FRAMER_INLINE_PATTERNS = [
  "window.__framer_events",       // analytics tracking
  "framerInternalRenderReady",    // editor communication
];

// ---------------------------------------------------------------------------
// 2. Core cleaning function
// ---------------------------------------------------------------------------

/**
 * Remove ALL Framer artifacts from a cheerio document:
 * - UI overlays (badges, editor bar)
 * - <script> tags loading from framer.com domains
 * - <script> tags with inline Framer runtime code
 * - <link rel="preconnect"> to framer domains
 * - <meta name="generator" content="Framer">
 * - Framer analytics / tracking scripts
 */
export function removeFramerElements($: cheerio.CheerioAPI): void {
  // 1. Remove UI overlay elements by selector
  for (const sel of FRAMER_UI_SELECTORS) {
    $(sel).remove();
  }

  // 2. Remove <script src="...framer.com..."> (runtime, modules, analytics)
  $("script[src]").each((_, el) => {
    const src = $(el).attr("src") ?? "";
    for (const domain of FRAMER_SCRIPT_DOMAINS) {
      if (src.includes(domain)) {
        $(el).remove();
        return;
      }
    }
  });

  // 3. Remove inline <script> with Framer runtime code
  $("script:not([src])").each((_, el) => {
    const text = $(el).text();
    for (const pattern of FRAMER_INLINE_PATTERNS) {
      if (text.includes(pattern)) {
        $(el).remove();
        return;
      }
    }
  });

  // 4. Remove <link rel="preconnect"> to framer domains
  $('link[rel="preconnect"], link[rel="dns-prefetch"]').each((_, el) => {
    const href = $(el).attr("href") ?? "";
    if (href.includes("framer.com") || href.includes("framerusercontent.com")) {
      $(el).remove();
    }
  });

  // 5. Remove <meta name="generator" content="Framer">
  $('meta[name="generator"]').each((_, el) => {
    const content = $(el).attr("content") ?? "";
    if (content.toLowerCase().includes("framer")) {
      $(el).remove();
    }
  });

  // 6. Remove Framer-specific <noscript> (often contains redirect/fallback)
  $("noscript").each((_, el) => {
    const html = $(el).html() ?? "";
    if (html.includes("framer.com") || html.includes("__framer")) {
      $(el).remove();
    }
  });
}

// ---------------------------------------------------------------------------
// 3. Defensive injections (CSS + JS fallback)
// ---------------------------------------------------------------------------

const DEFENSIVE_CSS = `<style data-export="framer-hide">
[class*="__framer-badge"], [id^="__framer-badge"],
[id^="__framer-editorbar"], [data-framer-name="Badge"] {
  display: none !important;
  visibility: hidden !important;
}
</style>`;

const RUNTIME_REMOVER = `<script data-export="framer-hide">
(function(){
  var sel = ${JSON.stringify(FRAMER_UI_SELECTORS)};
  function rm(){
    try { document.querySelectorAll(sel.join(",")).forEach(function(n){ n.remove(); }); } catch(_){}
  }
  rm();
  try {
    new MutationObserver(rm).observe(document.documentElement, {childList:true,subtree:true});
  } catch(_){}
  window.addEventListener("load", rm);
})();
</script>`;

export function injectDefenses($: cheerio.CheerioAPI): void {
  const head = $("head");
  if (head.length) {
    head.append(DEFENSIVE_CSS);
  } else {
    $.root().prepend(DEFENSIVE_CSS);
  }

  const body = $("body");
  if (body.length) {
    body.append(RUNTIME_REMOVER);
  } else {
    $.root().append(RUNTIME_REMOVER);
  }
}

// ---------------------------------------------------------------------------
// 4. Navigation link rewriting (multi-page export)
// ---------------------------------------------------------------------------

export function rewriteNavLinks(
  $: cheerio.CheerioAPI,
  origin: string,
  pathToFilename: Map<string, string>
): void {
  const rewrite = (attr: string) => {
    $(`[${attr}]`).each((_, el) => {
      const node = $(el);
      const val = node.attr(attr);
      if (!val) return;
      try {
        const resolved = new URL(val, origin);
        if (resolved.origin !== origin) return;
        const local = pathToFilename.get(resolved.pathname);
        if (local) node.attr(attr, local);
      } catch {
        // not a valid URL — skip
      }
    });
  };
  rewrite("href");
  rewrite("action");
}

// ---------------------------------------------------------------------------
// 5. Convenience wrappers (kept for backward compatibility)
// ---------------------------------------------------------------------------

export function cleanFramerHtml(html: string): string {
  const $ = cheerio.load(html);
  removeFramerElements($);
  injectDefenses($);
  return $.html();
}

export function buildRewriters(
  origin: string,
  pathToFilename: Map<string, string>
) {
  return (html: string): string => {
    const $ = cheerio.load(html);
    removeFramerElements($);
    injectDefenses($);
    rewriteNavLinks($, origin, pathToFilename);
    return $.html();
  };
}
