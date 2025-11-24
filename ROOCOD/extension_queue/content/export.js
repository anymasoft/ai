// ═══════════════════════════════════════════════════════════════════
// EXPORT MODULE - Экспорт субтитров из массивов данных
// ═══════════════════════════════════════════════════════════════════

function formatTimeSRT(seconds) {
  const ms = Math.floor((seconds % 1) * 1000);
  const s = Math.floor(seconds) % 60;
  const m = Math.floor(seconds / 60) % 60;
  const h = Math.floor(seconds / 3600);

  const pad = (n, size = 2) => String(n).padStart(size, "0");

  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

function formatTimeVTT(seconds) {
  return formatTimeSRT(seconds).replace(",", ".");
}

function buildSRT(subs) {
  return subs
    .map((sub, index) => {
      const start = formatTimeSRT(sub.start || 0);
      const end = formatTimeSRT(sub.end || (sub.start || 0) + 2);
      return `${index + 1}\n${start} --> ${end}\n${sub.text}\n`;
    })
    .join("\n");
}

function buildVTT(subs) {
  const body = subs
    .map((sub) => {
      const start = formatTimeVTT(sub.start || 0);
      const end = formatTimeVTT(sub.end || (sub.start || 0) + 2);
      return `${start} --> ${end}\n${sub.text}\n`;
    })
    .join("\n");

  return `WEBVTT\n\n${body}`;
}

function buildTXT(subs) {
  return subs.map((sub) => sub.text).join("\n");
}

// subtitles: массив объектов { text, start, end }
// format: "srt" | "vtt" | "txt"
function exportSubtitles(subtitles, format) {
  if (!subtitles || subtitles.length === 0) {
    console.warn("No subtitles to export");
    return;
  }

  let content = "";
  let mime = "text/plain";
  let extension = format;

  if (format === "srt") {
    content = buildSRT(subtitles);
    mime = "application/x-subrip";
  } else if (format === "vtt") {
    content = buildVTT(subtitles);
    mime = "text/vtt";
  } else if (format === "txt") {
    content = buildTXT(subtitles);
    mime = "text/plain";
  }

  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `subtitles.${extension}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export { exportSubtitles };