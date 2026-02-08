import { NextRequest, NextResponse } from "next/server";
import { cleanFramerHtml } from "@/utils/rewriter";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

    const cleaned = cleanFramerHtml(html);

    const outName = file.name.replace(/\.[^.]+$/, "") + "-clean.html";

    return new NextResponse(cleaned, {
      status: 200,
      headers: new Headers({
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${outName}"`,
        "Cache-Control": "no-store",
      }),
    });
  } catch (error: any) {
    const message = error?.message || "Unexpected error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
