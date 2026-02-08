import * as cheerio from "cheerio";

/** CSS-селекторы всех Framer UI-элементов, которые нужно удалить */
const FRAMER_REMOVE_SELECTORS = [
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

const DEFENSIVE_CSS = `<style data-export="framer-hide">
a.__framer-badge, .__framer-badge, #__framer-badge-container,
div#__framer-badge-container, [data-framer-name="Badge"],
[data-framer-appear-id][class*="__framer-badge"],
[class*="__framer-badge"], div[id^="__framer-badge"],
div[class^="framer-"][class*="__framer-badge"],
#__framer-editorbar-container, #__framer-editorbar-button,
#__framer-editorbar-label, [id^="__framer-editorbar"],
div[id^="__framer-editorbar"] {
  display: none !important;
  pointer-events: none !important;
  visibility: hidden !important;
}
</style>`;

const RUNTIME_REMOVER = `<script data-export="framer-hide">
(function(){
  var sel = ${JSON.stringify(FRAMER_REMOVE_SELECTORS)};
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

/**
 * Remove Framer badge/editor artifacts from a cheerio instance.
 * DOM-based: no regex for HTML manipulation.
 */
export function removeFramerElements($: cheerio.CheerioAPI): void {
  for (const sel of FRAMER_REMOVE_SELECTORS) {
    $(sel).remove();
  }
}

/**
 * Inject defensive CSS + runtime remover script into a cheerio instance.
 */
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

/**
 * Rewrite internal navigation links for multi-page static export.
 * Converts absolute same-origin and relative hrefs/actions to local filenames.
 */
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

/**
 * Full clean pipeline for a single HTML string (used by /api/clean for local files).
 * DOM-based, no regex.
 */
export function cleanFramerHtml(html: string): string {
  const $ = cheerio.load(html);
  removeFramerElements($);
  injectDefenses($);
  return $.html();
}

/**
 * Full rewrite pipeline for URL-export (clean + rewrite links).
 */
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
