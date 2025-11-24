// ═══════════════════════════════════════════════════════════════════
// UTIL MODULE — helpers
// ═══════════════════════════════════════════════════════════════════

// ждём появление элемента в DOM
function waitForElement(selector, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const el = document.querySelector(selector);
    if (el) return resolve(el);

    const obs = new MutationObserver(() => {
      const el2 = document.querySelector(selector);
      if (el2) {
        obs.disconnect();
        resolve(el2);
      }
    });

    obs.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => {
      obs.disconnect();
      reject(new Error("Element not found"));
    }, timeout);
  });
}

// получить videoId из URL
function getVideoId() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("v");
}

// загрузить сохранённый язык
function loadSavedLanguage() {
  const saved = localStorage.getItem("yt-reader-lang");
  if (saved) {
    return saved;
  }
  return "ru";
}

// сохранить выбранный язык
function saveLanguage(lang) {
  localStorage.setItem("yt-reader-lang", lang);
}

// получить выбранный язык
function getSelectedLanguage() {
  const saved = loadSavedLanguage();
  return saved || "ru";
}

// нормализация текста
function normalizeText(text) {
  return text.replace(/\s+/g, " ").trim();
}

// ожидание
function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

export {
  waitForElement,
  getVideoId,
  loadSavedLanguage,
  saveLanguage,
  getSelectedLanguage,
  normalizeText,
  wait,
};