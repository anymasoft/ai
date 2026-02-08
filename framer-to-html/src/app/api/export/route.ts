import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import JSZip from "jszip";
import pLimit from "p-limit";
import puppeteer from "puppeteer";
import { assertFramerUrl } from "@/utils/url";
import { toFilename } from "@/utils/filename";
import {
  removeFramerElements,
  injectDefenses,
  rewriteNavLinks,
} from "@/utils/rewriter";
import { readSitemapUrls } from "@/utils/sitemap";
import { extractAssets } from "@/utils/assets";
import { normalizeStructure } from "@/utils/normalizer";
import { validateResult, hasErrors } from "@/utils/validator";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { url?: string } | null;
    const inputUrl = body?.url ?? "";
    const site = assertFramerUrl(inputUrl);
    const siteOrigin = site.origin;

    const urls = await readSitemapUrls(siteOrigin);

    // Build filename mapping for inter-page links
    const pathToFilename = new Map<string, string>();
    for (const u of urls) {
      const { pathname } = new URL(u);
      pathToFilename.set(pathname, toFilename(pathname));
    }

    const zip = new JSZip();

    // Shared asset map: track already-downloaded assets across all pages
    const globalAssetPaths = new Set<string>();

    const browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-features=VizDisplayCompositor",
      ],
    });

    try {
      const limit = pLimit(3);
      await Promise.all(
        urls.map((urlStr) =>
          limit(async () => {
            const url = new URL(urlStr);
            const filename =
              pathToFilename.get(url.pathname) ?? toFilename(url.pathname);
            const page = await browser.newPage();
            try {
              await page.setViewport({
                width: 1440,
                height: 1024,
                deviceScaleFactor: 1,
              });

              await page.goto(url.toString(), {
                waitUntil: "networkidle0",
                timeout: 120_000,
              });

              // Wait for window.onload + settle period
              await page.evaluate(
                () =>
                  new Promise<void>((resolve) => {
                    if (document.readyState === "complete") {
                      setTimeout(resolve, 500);
                    } else {
                      window.addEventListener("load", () =>
                        setTimeout(resolve, 500)
                      );
                    }
                  })
              );

              const html = await page.evaluate(
                () => document.documentElement.outerHTML
              );

              // --- Pipeline ---
              const $ = cheerio.load(html);

              // Step 1: Remove Framer UI elements (DOM-based)
              removeFramerElements($);

              // Step 2: Download & localize assets
              const assetEntries = await extractAssets($, siteOrigin);
              for (const entry of assetEntries) {
                if (!globalAssetPaths.has(entry.localPath)) {
                  zip.file(entry.localPath, entry.data);
                  globalAssetPaths.add(entry.localPath);
                }
              }

              // Step 3: Normalize structure (data-framer-name → data-section)
              normalizeStructure($);

              // Step 4: Rewrite inter-page navigation links
              rewriteNavLinks($, siteOrigin, pathToFilename);

              // Step 5: Inject defensive CSS + runtime remover
              injectDefenses($);

              // Step 6: Validate
              const warnings = validateResult($);
              if (hasErrors(warnings)) {
                console.warn(
                  `[export] Validation errors for ${url}:`,
                  warnings.filter((w) => w.level === "error")
                );
              }

              // Step 7: Serialize & add to ZIP
              zip.file(filename, $.html());
            } finally {
              await page.close();
            }
          })
        )
      );
    } finally {
      await browser.close();
    }

    const arrayBuffer = await zip.generateAsync({ type: "arraybuffer" });
    return new NextResponse(arrayBuffer as unknown as ArrayBuffer, {
      status: 200,
      headers: new Headers({
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename=framer-export-${site.hostname}.zip`,
        "Cache-Control": "no-store",
      }),
    });
  } catch (error: any) {
    const message = error?.message || "Unexpected error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
