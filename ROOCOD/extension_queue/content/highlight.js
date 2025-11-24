// ═══════════════════════════════════════════════════════════════════
// HIGHLIGHT MODULE — realtime karaoke
// ═══════════════════════════════════════════════════════════════════

import { transcriptState } from "./state.js";
import { renderWindow } from "./ui.js";

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

    // O(1) поиск индекса через timeIndexMap вместо O(n) findIndex
    const key = Math.floor(video.currentTime * 10);
    const idx = transcriptState.timeIndexMap[key] ?? -1;

    if (idx !== -1) {
      highlightLine(idx);

      // Virtual scrolling: перерендериваем окно для больших транскриптов
      if (subtitles.length > 100) {
        renderWindow(idx);
      }
    }
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