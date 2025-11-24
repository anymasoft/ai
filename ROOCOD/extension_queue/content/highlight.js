// ═══════════════════════════════════════════════════════════════════
// HIGHLIGHT MODULE — realtime karaoke
// ═══════════════════════════════════════════════════════════════════

import { transcriptState } from "./state.js";

function startRealtimeHighlight(subtitles) {
  const video = document.querySelector("video");
  if (!video) return;

  function tick() {
    const t = video.currentTime;
    const idx = subtitles.findIndex(s => {
      const start = s.start || 0;
      const end = s.end || start + 2;
      return t >= start && t < end && end > start;
    });
    if (idx !== -1) highlightLine(idx);
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

function highlightLine(idx) {
  const all = document.querySelectorAll(".yt-transcript-item");
  [...all].forEach((el, i) => {
    if (i === idx) {
      el.classList.add("active");
      if (transcriptState.scrollLocked) {
        return; // пользователь сам скроллит - подсветка НЕ захватывает экран
      }
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      el.classList.remove("active");
    }
  });
}

export { startRealtimeHighlight };