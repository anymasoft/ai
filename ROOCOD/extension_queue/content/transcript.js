// ═══════════════════════════════════════════════════════════════════
// TRANSCRIPT MODULE — Extraction from YouTube
// ═══════════════════════════════════════════════════════════════════

import { normalizeText } from "./util.js";

function formatTimeFromSeconds(seconds) {
  const s = Math.floor(seconds % 60);
  const m = Math.floor(seconds / 60) % 60;
  const h = Math.floor(seconds / 3600);
  const pad = (n) => String(n).padStart(2, "0");

  if (h > 0) {
    return `${h}:${pad(m)}:${pad(s)}`;
  }
  return `${m}:${pad(s)}`;
}

function normalizeSubs(rawSubs) {
  return rawSubs.map((s, idx) => {
    const start = typeof s.start === "number" ? s.start : idx * 2;
    const end = typeof s.end === "number" ? s.end : start + 2;

    return {
      text: (s.text || "").trim(),
      start,
      end,
      time: s.time || formatTimeFromSeconds(start),
    };
  });
}

// главный метод получения субтитров
async function getTranscript(videoId) {
  const fromNext = await getFromNextAPI(videoId);
  if (fromNext && fromNext.length > 0) return normalizeSubs(fromNext);

  const fromTimed = await getFromTimedText(videoId);
  if (fromTimed && fromTimed.length > 0) return normalizeSubs(fromTimed);

  const fromHTML = parseHTMLTranscript();
  if (fromHTML && fromHTML.length > 0) return normalizeSubs(fromHTML);

  return [];
}

// YouTube NEXT API
async function getFromNextAPI(videoId) {
  try {
    const url = `https://www.youtube.com/youtubei/v1/get_transcript?key=AIzaSyA...`; 
    const body = {
      context: { client: { clientName: "WEB", clientVersion: "2.20230101" } },
      params: btoa(`\n\x0b${videoId}`),
    };

    const resp = await fetch(url, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });

    const json = await resp.json();
    if (!json?.actions) return [];

    const runs = extractTranscriptRuns(json);
    return runs || [];
  } catch (e) {
    console.warn("[Transcript] NEXT API failed:", e);
    return [];
  }
}

// TimedText API
async function getFromTimedText(videoId) {
  try {
    const resp = await fetch(
      `https://www.youtube.com/api/timedtext?lang=en&v=${videoId}`
    );
    const text = await resp.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, "text/xml");

    const entries = [...xml.getElementsByTagName("text")];
    return entries.map(x => ({
      text: x.textContent,
      start: parseFloat(x.getAttribute("start")),
      end: parseFloat(x.getAttribute("dur")) + parseFloat(x.getAttribute("start")),
    }));
  } catch (e) {
    console.warn("[Transcript] TimedText failed:", e);
    return [];
  }
}

// HTML fallback — если YouTube показывает native transcript
function parseHTMLTranscript() {
  const container = document.querySelector("ytd-transcript-segment-list-renderer");
  if (!container) return [];

  const items = [...container.querySelectorAll(".segment")];
  return items.map(x => {
    const raw = x.querySelector(".segment-text")?.textContent || "";
    return { text: raw.trim(), start: 0, end: 0 };
  });
}

function extractTranscriptRuns(json) {
  try {
    const renderer = json.actions[0]?.updateEngagementPanelAction
      ?.content?.transcriptRenderer?.body?.transcriptBodyRenderer;

    if (!renderer) return [];

    const segments = renderer?.cueGroups || [];
    return segments.map((c) => ({
      text: c.cueGroupRenderer.cues[0].simpleText,
      start: 0,
      end: 0
    }));
  } catch (e) {
    return [];
  }
}

export { getTranscript };