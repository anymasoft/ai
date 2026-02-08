import type { CheerioAPI } from "cheerio";

export type ValidationWarning = {
  level: "warning" | "error";
  message: string;
};

/** Patterns that should NOT appear in clean output.
 * Note: framer.com/m/ (module CDN) is intentionally kept for animations.
 * These URLs get rewritten to local paths by the asset pipeline, so if
 * they still appear, it means something wasn't downloaded properly.
 */
const FORBIDDEN_PATTERNS = [
  "events.framer.com",  // Framer analytics — should always be removed
];

/**
 * Validate the converted HTML result.
 *
 * Returns a list of warnings/errors. If any entry has level "error",
 * the conversion should be considered failed.
 */
export function validateResult($: CheerioAPI): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const html = $.html();

  // 1. Check for remaining Framer runtime scripts
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (html.includes(pattern)) {
      warnings.push({
        level: "warning",
        message: `HTML still contains reference to "${pattern}"`,
      });
    }
  }

  // 2. Check for Framer badge remnants
  if (
    html.includes("__framer-badge") ||
    html.includes("__framer-editorbar")
  ) {
    warnings.push({
      level: "warning",
      message: "Framer badge/editor bar elements may still be present",
    });
  }

  // 3. Check for at least one image (landing pages normally have images)
  const imgCount = $("img").length;
  if (imgCount === 0) {
    warnings.push({
      level: "warning",
      message: "No <img> elements found — the page may not have rendered fully",
    });
  }

  // 4. Check the page has meaningful content (not just an empty shell)
  const bodyText = $("body").text().trim();
  if (bodyText.length < 50) {
    warnings.push({
      level: "error",
      message: "Page body has almost no text content — rendering may have failed",
    });
  }

  // 5. Check for remaining absolute framerusercontent.com refs that weren't downloaded
  const framerCdnRefs = (
    html.match(/https?:\/\/[^"'\s)]*framerusercontent\.com[^"'\s)]*/g) ?? []
  );
  if (framerCdnRefs.length > 0) {
    warnings.push({
      level: "warning",
      message: `${framerCdnRefs.length} unresolved framerusercontent.com reference(s) remain`,
    });
  }

  return warnings;
}

/**
 * Returns true if there are any "error"-level issues.
 */
export function hasErrors(warnings: ValidationWarning[]): boolean {
  return warnings.some((w) => w.level === "error");
}
