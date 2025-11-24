// ═══════════════════════════════════════════════════════════════════
// HIGHLIGHT MODULE — realtime karaoke
// ═══════════════════════════════════════════════════════════════════

function startRealtimeHighlight(subtitles) {
  const video = document.querySelector("video");
  if (!video) return;

  function tick() {
    const t = video.currentTime;
    const idx = subtitles.findIndex(s => t >= s.start && t < s.end);
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
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      el.classList.remove("active");
    }
  });
}

export { startRealtimeHighlight };