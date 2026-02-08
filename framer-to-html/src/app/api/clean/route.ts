import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import JSZip from "jszip";
import { removeFramerElements, injectDefenses } from "@/utils/rewriter";
import { extractAssets } from "@/utils/assets";
import { normalizeStructure } from "@/utils/normalizer";
import { validateResult, hasErrors } from "@/utils/validator";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Try to detect the site origin from absolute URLs found in the HTML.
 * We look at <link href>, <img src>, <script src> for the most common origin.
 * Falls back to a dummy origin — assets from the allowlist will still download.
 */
function detectOrigin($: cheerio.CheerioAPI): string {
  const origins = new Map<string, number>();
  const bump = (url: string | undefined) => {
    if (!url) return;
    try {
      const o = new URL(url).origin;
      if (o && o !== "null") origins.set(o, (origins.get(o) ?? 0) + 1);
    } catch {
      // ignore
    }
  };

  $("link[href]").each((_, el) => bump($(el).attr("href")));
  $("img[src]").each((_, el) => bump($(el).attr("src")));
  $("script[src]").each((_, el) => bump($(el).attr("src")));
  $("[style]").each((_, el) => {
    const style = $(el).attr("style") ?? "";
    const m = style.match(/url\(['"]?(https?:\/\/[^'")]+)/);
    if (m) bump(m[1]);
  });

  // Pick the most frequent origin (ignore framerusercontent — it's a CDN, not site origin)
  let best = "";
  let bestCount = 0;
  for (const [o, count] of origins) {
    if (o.includes("framerusercontent.com")) continue;
    if (count > bestCount) {
      best = o;
      bestCount = count;
    }
  }

  return best || "https://local.file";
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!file.name.endsWith(".html") && !file.name.endsWith(".htm")) {
      return NextResponse.json(
        { error: "Only .html / .htm files are accepted" },
        { status: 400 }
      );
    }

    const html = await file.text();
    if (!html.trim()) {
      return NextResponse.json(
        { error: "The uploaded file is empty" },
        { status: 400 }
      );
    }

    // --- Pipeline ---
    const $ = cheerio.load(html);

    // Step 1: Remove Framer UI + runtime + analytics
    removeFramerElements($);

    // Step 2: Detect origin for asset resolution
    const siteOrigin = detectOrigin($);

    // Step 3: Download & localize all assets
    const zip = new JSZip();
    const assetEntries = await extractAssets($, siteOrigin);
    for (const entry of assetEntries) {
      zip.file(entry.localPath, entry.data);
    }

    // Step 4: Normalize structure
    normalizeStructure($);

    // Step 5: Inject defensive CSS/JS
    injectDefenses($);

    // Step 6: Validate
    const warnings = validateResult($);
    if (hasErrors(warnings)) {
      const errors = warnings
        .filter((w) => w.level === "error")
        .map((w) => w.message);
      return NextResponse.json(
        { error: `Validation failed: ${errors.join("; ")}` },
        { status: 422 }
      );
    }

    // Step 7: Add HTML to ZIP and return
    const baseName = file.name.replace(/\.[^.]+$/, "");
    zip.file("index.html", $.html());

    const arrayBuffer = await zip.generateAsync({ type: "arraybuffer" });
    return new NextResponse(arrayBuffer as unknown as ArrayBuffer, {
      status: 200,
      headers: new Headers({
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${baseName}-clean.zip"`,
        "Cache-Control": "no-store",
      }),
    });
  } catch (error: any) {
    const message = error?.message || "Unexpected error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
