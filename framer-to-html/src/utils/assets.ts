import * as cheerio from "cheerio";
import pLimit from "p-limit";
import { createHash } from "crypto";
import path from "path";

/** Allowed domains for asset downloading (Framer CDN + common CDNs) */
const ALLOWED_ASSET_HOSTS = [
  "framerusercontent.com",
  "framer.com",
  "fonts.googleapis.com",
  "fonts.gstatic.com",
  "cdn.jsdelivr.net",
  "unpkg.com",
  "cdnjs.cloudflare.com",
];

function isAllowedAssetUrl(url: string, siteOrigin: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.origin === siteOrigin) return true;
    return ALLOWED_ASSET_HOSTS.some(
      (h) => parsed.hostname === h || parsed.hostname.endsWith("." + h)
    );
  } catch {
    return false;
  }
}

/** Map MIME / URL extension → asset subfolder */
function classifyAsset(
  url: string,
  contentType?: string
): "images" | "css" | "js" | "fonts" | "other" {
  const ct = (contentType ?? "").toLowerCase();
  if (ct.startsWith("image/")) return "images";
  if (ct.includes("font") || /\.(woff2?|ttf|otf|eot)(\?|$)/i.test(url))
    return "fonts";
  if (ct.includes("css") || /\.css(\?|$)/i.test(url)) return "css";
  if (ct.includes("javascript") || /\.js(\?|$)/i.test(url)) return "js";

  // Fallback by extension
  const ext = path.extname(new URL(url).pathname).toLowerCase();
  if ([".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".avif", ".ico"].includes(ext))
    return "images";
  if ([".woff", ".woff2", ".ttf", ".otf", ".eot"].includes(ext)) return "fonts";
  if (ext === ".css") return "css";
  if (ext === ".js") return "js";
  return "other";
}

/** Generate a short, collision-resistant filename from URL */
function assetFilename(url: string, contentType?: string): string {
  const hash = createHash("md5").update(url).digest("hex").slice(0, 10);
  let ext = "";
  try {
    const pathname = new URL(url).pathname;
    ext = path.extname(pathname).split("?")[0]; // strip query from ext
  } catch {
    // ignore
  }
  if (!ext && contentType) {
    const map: Record<string, string> = {
      "image/png": ".png",
      "image/jpeg": ".jpg",
      "image/gif": ".gif",
      "image/svg+xml": ".svg",
      "image/webp": ".webp",
      "image/avif": ".avif",
      "image/x-icon": ".ico",
      "text/css": ".css",
      "application/javascript": ".js",
      "text/javascript": ".js",
      "font/woff": ".woff",
      "font/woff2": ".woff2",
      "font/ttf": ".ttf",
      "application/font-woff": ".woff",
      "application/font-woff2": ".woff2",
    };
    ext = map[contentType.split(";")[0].trim()] ?? "";
  }
  return `${hash}${ext}`;
}

export type AssetEntry = {
  originalUrl: string;
  localPath: string; // e.g. "assets/images/abc123.png"
  data: Buffer;
};

async function downloadAsset(
  url: string,
  siteOrigin: string,
  timeout = 15_000
): Promise<{ data: Buffer; contentType: string } | null> {
  if (!isAllowedAssetUrl(url, siteOrigin)) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const res = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    const buf = Buffer.from(await res.arrayBuffer());
    return { data: buf, contentType: ct };
  } catch {
    return null;
  }
}

/**
 * Extract all url(...) references from a CSS string.
 */
function extractCssUrls(css: string): string[] {
  const urls: string[] = [];
  const re = /url\(\s*(['"]?)(.*?)\1\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    const val = m[2].trim();
    if (val && !val.startsWith("data:")) urls.push(val);
  }
  return urls;
}

/**
 * Resolve a potentially relative URL against a base.
 */
function resolveUrl(ref: string, base: string): string | null {
  try {
    return new URL(ref, base).toString();
  } catch {
    return null;
  }
}

/**
 * Main pipeline: discover all assets in HTML, download them, rewrite URLs.
 *
 * Returns the mutated cheerio instance + collected asset entries to add to ZIP.
 */
export async function extractAssets(
  $: cheerio.CheerioAPI,
  siteOrigin: string
): Promise<AssetEntry[]> {
  // Map: absolute URL → local path
  const urlToLocal = new Map<string, string>();
  const entries: AssetEntry[] = [];
  const toDownload = new Set<string>();

  // --- 1. Collect asset URLs from HTML ---

  // <img src> and <img srcset>
  $("img[src]").each((_, el) => {
    const src = $(el).attr("src");
    if (src && !src.startsWith("data:")) {
      const abs = resolveUrl(src, siteOrigin);
      if (abs) toDownload.add(abs);
    }
  });
  $("img[srcset]").each((_, el) => {
    const srcset = $(el).attr("srcset") ?? "";
    for (const part of srcset.split(",")) {
      const url = part.trim().split(/\s+/)[0];
      if (url && !url.startsWith("data:")) {
        const abs = resolveUrl(url, siteOrigin);
        if (abs) toDownload.add(abs);
      }
    }
  });

  // <source src/srcset> (picture/video)
  $("source[src], source[srcset]").each((_, el) => {
    const node = $(el);
    const src = node.attr("src");
    if (src && !src.startsWith("data:")) {
      const abs = resolveUrl(src, siteOrigin);
      if (abs) toDownload.add(abs);
    }
    const srcset = node.attr("srcset") ?? "";
    for (const part of srcset.split(",")) {
      const url = part.trim().split(/\s+/)[0];
      if (url && !url.startsWith("data:")) {
        const abs = resolveUrl(url, siteOrigin);
        if (abs) toDownload.add(abs);
      }
    }
  });

  // <link rel="stylesheet" href>
  $('link[rel="stylesheet"][href]').each((_, el) => {
    const href = $(el).attr("href");
    if (href) {
      const abs = resolveUrl(href, siteOrigin);
      if (abs) toDownload.add(abs);
    }
  });

  // <link rel="icon/apple-touch-icon" href>
  $('link[rel="icon"][href], link[rel="apple-touch-icon"][href], link[rel="shortcut icon"][href]').each(
    (_, el) => {
      const href = $(el).attr("href");
      if (href) {
        const abs = resolveUrl(href, siteOrigin);
        if (abs) toDownload.add(abs);
      }
    }
  );

  // <script src>
  $("script[src]").each((_, el) => {
    const src = $(el).attr("src");
    if (src) {
      const abs = resolveUrl(src, siteOrigin);
      if (abs) toDownload.add(abs);
    }
  });

  // <video src>, <video poster>
  $("video[src]").each((_, el) => {
    const src = $(el).attr("src");
    if (src && !src.startsWith("data:")) {
      const abs = resolveUrl(src, siteOrigin);
      if (abs) toDownload.add(abs);
    }
  });
  $("video[poster]").each((_, el) => {
    const poster = $(el).attr("poster");
    if (poster && !poster.startsWith("data:")) {
      const abs = resolveUrl(poster, siteOrigin);
      if (abs) toDownload.add(abs);
    }
  });

  // Framer lazy-loading attributes: data-framer-src, data-src
  $("[data-framer-src]").each((_, el) => {
    const src = $(el).attr("data-framer-src");
    if (src && !src.startsWith("data:")) {
      const abs = resolveUrl(src, siteOrigin);
      if (abs) toDownload.add(abs);
    }
  });
  $("[data-src]").each((_, el) => {
    const src = $(el).attr("data-src");
    if (src && !src.startsWith("data:")) {
      const abs = resolveUrl(src, siteOrigin);
      if (abs) toDownload.add(abs);
    }
  });

  // CSS url() inside <style> tags
  $("style").each((_, el) => {
    const css = $(el).text();
    for (const ref of extractCssUrls(css)) {
      const abs = resolveUrl(ref, siteOrigin);
      if (abs) toDownload.add(abs);
    }
  });

  // inline style background-image
  $("[style]").each((_, el) => {
    const style = $(el).attr("style") ?? "";
    for (const ref of extractCssUrls(style)) {
      const abs = resolveUrl(ref, siteOrigin);
      if (abs) toDownload.add(abs);
    }
  });

  // --- 2. Download all assets in parallel (max 6 concurrent) ---
  const limit = pLimit(6);
  const cssContents = new Map<string, string>(); // URL → CSS text for sub-asset extraction

  await Promise.all(
    Array.from(toDownload).map((url) =>
      limit(async () => {
        const result = await downloadAsset(url, siteOrigin);
        if (!result) return;
        const category = classifyAsset(url, result.contentType);
        const fname = assetFilename(url, result.contentType);
        const localPath = `assets/${category}/${fname}`;
        urlToLocal.set(url, localPath);
        entries.push({ originalUrl: url, localPath, data: result.data });

        // If this is a CSS file, remember its content for sub-asset extraction
        if (category === "css") {
          cssContents.set(url, result.data.toString("utf-8"));
        }
      })
    )
  );

  // --- 3. Extract sub-assets from downloaded CSS files (fonts, bg images) ---
  const subAssets = new Set<string>();
  for (const [cssUrl, cssText] of cssContents) {
    for (const ref of extractCssUrls(cssText)) {
      const abs = resolveUrl(ref, cssUrl);
      if (abs && !urlToLocal.has(abs)) subAssets.add(abs);
    }
  }

  if (subAssets.size > 0) {
    await Promise.all(
      Array.from(subAssets).map((url) =>
        limit(async () => {
          const result = await downloadAsset(url, siteOrigin);
          if (!result) return;
          const category = classifyAsset(url, result.contentType);
          const fname = assetFilename(url, result.contentType);
          const localPath = `assets/${category}/${fname}`;
          urlToLocal.set(url, localPath);
          entries.push({ originalUrl: url, localPath, data: result.data });
        })
      )
    );
  }

  // --- 4. Rewrite CSS file contents (url() → local relative paths) ---
  for (const entry of entries) {
    if (classifyAsset(entry.originalUrl) !== "css") continue;
    let css = entry.data.toString("utf-8");
    const cssBaseUrl = entry.originalUrl;
    const cssDir = path.dirname(entry.localPath);

    css = css.replace(/url\(\s*(['"]?)(.*?)\1\s*\)/g, (match, quote, ref) => {
      const trimmed = ref.trim();
      if (!trimmed || trimmed.startsWith("data:")) return match;
      const abs = resolveUrl(trimmed, cssBaseUrl);
      if (abs && urlToLocal.has(abs)) {
        const rel = path.relative(cssDir, urlToLocal.get(abs)!);
        return `url(${quote}${rel}${quote})`;
      }
      return match;
    });

    entry.data = Buffer.from(css, "utf-8");
  }

  // --- 5. Rewrite HTML attributes to point to local assets ---
  const rewriteAttr = (selector: string, attr: string) => {
    $(selector).each((_, el) => {
      const node = $(el);
      const val = node.attr(attr);
      if (!val) return;
      const abs = resolveUrl(val, siteOrigin);
      if (abs && urlToLocal.has(abs)) {
        node.attr(attr, urlToLocal.get(abs)!);
      }
    });
  };

  const rewriteSrcset = (selector: string) => {
    $(selector).each((_, el) => {
      const node = $(el);
      const srcset = node.attr("srcset");
      if (!srcset) return;
      const rewritten = srcset
        .split(",")
        .map((part) => {
          const [url, ...rest] = part.trim().split(/\s+/);
          const abs = resolveUrl(url, siteOrigin);
          const local = abs ? urlToLocal.get(abs) : undefined;
          return local ? [local, ...rest].join(" ") : part;
        })
        .join(", ");
      node.attr("srcset", rewritten);
    });
  };

  rewriteAttr("img[src]", "src");
  rewriteSrcset("img[srcset]");
  rewriteAttr("source[src]", "src");
  rewriteSrcset("source[srcset]");
  rewriteAttr('link[rel="stylesheet"][href]', "href");
  rewriteAttr('link[rel="icon"][href], link[rel="apple-touch-icon"][href], link[rel="shortcut icon"][href]', "href");
  rewriteAttr("script[src]", "src");
  rewriteAttr("video[src]", "src");
  rewriteAttr("video[poster]", "poster");
  rewriteAttr("[data-framer-src]", "data-framer-src");
  rewriteAttr("[data-src]", "data-src");

  // Rewrite url() in <style> tags — resolve each ref before lookup
  $("style").each((_, el) => {
    const node = $(el);
    const original = node.text();
    const rewritten = original.replace(
      /url\(\s*(['"]?)(.*?)\1\s*\)/g,
      (match, quote, ref) => {
        const trimmed = ref.trim();
        if (!trimmed || trimmed.startsWith("data:")) return match;
        const abs = resolveUrl(trimmed, siteOrigin);
        if (abs && urlToLocal.has(abs)) {
          return `url(${quote}${urlToLocal.get(abs)}${quote})`;
        }
        return match;
      }
    );
    if (rewritten !== original) node.text(rewritten);
  });

  // Rewrite url() in inline styles — resolve each ref before lookup
  $("[style]").each((_, el) => {
    const node = $(el);
    const original = node.attr("style") ?? "";
    const rewritten = original.replace(
      /url\(\s*(['"]?)(.*?)\1\s*\)/g,
      (match, quote, ref) => {
        const trimmed = ref.trim();
        if (!trimmed || trimmed.startsWith("data:")) return match;
        const abs = resolveUrl(trimmed, siteOrigin);
        if (abs && urlToLocal.has(abs)) {
          return `url(${quote}${urlToLocal.get(abs)}${quote})`;
        }
        return match;
      }
    );
    if (rewritten !== original) node.attr("style", rewritten);
  });

  return entries;
}
