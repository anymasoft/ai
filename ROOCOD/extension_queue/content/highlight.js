// ═══════════════════════════════════════════════════════════════════
// HIGHLIGHT MODULE — realtime karaoke
// ═══════════════════════════════════════════════════════════════════

import { transcriptState } from "./state.js";

// Флаг активного цикла подсветки
let isActive = false;

function startRealtimeHighlight(subtitles) {
  // Предотвращение дублирования циклов
  if (isActive) {
    console.log("[Highlight] Loop already running, skipping duplicate start");
    return;
  }

  const video = document.querySelector("video");
  if (!video) return;

  isActive = true;

  function tick() {
    if (!isActive) return; // Остановка цикла

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

function stopRealtimeHighlight() {
  isActive = false;
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

export { startRealtimeHighlight, stopRealtimeHighlight };