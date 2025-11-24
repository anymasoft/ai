// ═══════════════════════════════════════════════════════════════════
// HIGHLIGHT MODULE — realtime karaoke
// ═══════════════════════════════════════════════════════════════════

import { transcriptState } from "./state.js";
import { renderWindow } from "./ui.js";

// Флаг активного цикла подсветки
let isActive = false;
// Кеширование последнего активного индекса для предотвращения лишних rerenders
let lastActiveIndex = -1;

function startRealtimeHighlight(subtitles) {
  // Предотвращение дублирования циклов
  if (isActive) {
    console.log("[VideoReader Highlight] Loop already running, skipping duplicate start");
    return;
  }

  const video = document.querySelector("video");
  if (!video) return;

  isActive = true;
  lastActiveIndex = -1; // Сброс при старте нового цикла

  function tick() {
    if (!isActive) return; // Остановка цикла

    // O(1) поиск индекса через timeIndexMap вместо O(n) findIndex
    const key = Math.floor(video.currentTime * 10);
    const idx = transcriptState.timeIndexMap[key] ?? -1;

    if (idx !== -1 && idx !== lastActiveIndex) {
      // КРИТИЧЕСКОЕ ИЗМЕНЕНИЕ: обновляем только если индекс изменился
      highlightLine(idx);

      // Virtual scrolling: перерендериваем окно для ОЧЕНЬ больших транскриптов (>1000)
      if (subtitles.length > 1000) {
        renderWindow(idx);
      }

      lastActiveIndex = idx;
    }
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

function stopRealtimeHighlight() {
  isActive = false;
  lastActiveIndex = -1; // Сброс кеша при остановке
}

function highlightLine(idx) {
  const all = document.querySelectorAll(".yt-transcript-item");
  [...all].forEach((el) => {
    // КРИТИЧЕСКОЕ ИЗМЕНЕНИЕ: сравниваем data-index вместо DOM array index
    const elIndex = parseInt(el.dataset.index);
    if (elIndex === idx) {
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