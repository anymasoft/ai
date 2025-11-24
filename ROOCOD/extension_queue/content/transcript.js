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

// YouTube NEXT API - DISABLED (incomplete API key)
async function getFromNextAPI(videoId) {
  // Метод отключен из-за неполного API-ключа
  return [];
}

// TimedText API - пробуем несколько языков
async function getFromTimedText(videoId) {
  // Пробуем разные языки по порядку
  const langs = ['en', 'ru', 'es', 'de', 'fr', 'ja', 'zh', 'it', 'pt'];

  for (const lang of langs) {
    try {
      const resp = await fetch(
        `https://www.youtube.com/api/timedtext?lang=${lang}&v=${videoId}`
      );

      if (!resp.ok) continue;

      const text = await resp.text();

      // Проверяем что XML не пустой
      if (!text || text.trim().length === 0) continue;

      const parser = new DOMParser();
      const xml = parser.parseFromString(text, "text/xml");

      const entries = [...xml.getElementsByTagName("text")];

      if (entries.length > 0) {
        console.log(`[Transcript] Found ${entries.length} subtitles in ${lang}`);
        return entries.map(x => ({
          text: x.textContent,
          start: parseFloat(x.getAttribute("start")),
          end: parseFloat(x.getAttribute("dur")) + parseFloat(x.getAttribute("start")),
        }));
      }
    } catch (e) {
      console.warn(`[Transcript] TimedText failed for ${lang}:`, e);
    }
  }

  return [];
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