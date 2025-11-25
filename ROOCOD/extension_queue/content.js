// ═══════════════════════════════════════════════════════════════════
// MONOLITHIC CONTENT SCRIPT - Video Reader AI Extension
// Объединённый файл всех модулей БЕЗ import/export
// Автоматически сгенерирован из модулей content/
// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
// MODULE: state.js
// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
// STATE MODULE — global state for subtitles & user
// ═══════════════════════════════════════════════════════════════════

// глобальное состояние
const transcriptState = {
  subtitles: [],
  originalSubtitles: [],
  translatedSubtitles: {},
  selectedLang: "ru",

  userPlan: "Free",
  maxFreeLine: 0,

  exportAllowed: false,

  scrollLocked: false,
  scrollUnlockTimer: null,
  scrollListenersAttachedTo: null,
  wheelHandler: null,  // P1: сохраняем для cleanup
  scrollHandler: null,  // P1: сохраняем для cleanup

  timeIndexMap: [],  // O(1) поиск индекса субтитра по времени видео

  listeners: [],  // Массив document-level listeners для cleanup
  originalPushState: null,  // Оригинальные history методы
  originalReplaceState: null,
};

// расчёт лимита Free-плана (30%)
function calculateMaxFreeLine(total) {
  if (total <= 0) return 0;
  return Math.floor(total * 0.3);
}

// обновление плана пользователя
function updateUserPlan(newPlan) {
  transcriptState.userPlan = newPlan;
}

// преобразование translatedSubtitles (объект) в массив для экспорта
function getTranslatedSubtitlesArray() {
  const translated = [];
  for (let i = 0; i < transcriptState.originalSubtitles.length; i++) {
    if (transcriptState.translatedSubtitles[i]) {
      translated.push(transcriptState.translatedSubtitles[i]);
    } else {
      translated.push(transcriptState.originalSubtitles[i]);
    }
  }
  return translated;
}



// ═══════════════════════════════════════════════════════════════════
// MODULE: util.js
// ═══════════════════════════════════════════════════════════════════

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

// открыть страницу авторизации
function openAuthPage() {
  // КРИТИЧЕСКОЕ: открываем auth.html расширения через background.js
  // auth.html откроет OAuth popup и обработает postMessage от callback
  chrome.runtime.sendMessage({ type: 'OPEN_AUTH_PAGE' });
}

// обновить UI авторизации
async function updateAuthUI() {
  console.log('[VideoReader] 🔄 updateAuthUI() вызвана');
  const storage = await chrome.storage.local.get(['token', 'email', 'plan']);
  const token = storage.token || null;
  const email = storage.email || null;
  const plan = storage.plan || 'Free';

  console.log('[VideoReader] 📊 Данные из storage:', {
    hasToken: !!token,
    email,
    plan,
    tokenLength: token?.length
  });

  const authSection = document.getElementById('yt-reader-auth-section');
  const authInfo = document.getElementById('yt-reader-auth-info');
  const authEmail = document.querySelector('.yt-reader-auth-email');
  const authPlan = document.querySelector('.yt-reader-auth-plan');
  const upgradeBtn = document.getElementById('yt-reader-upgrade-btn');

  console.log('[VideoReader] 🔍 Найденные элементы:', {
    hasAuthSection: !!authSection,
    hasAuthInfo: !!authInfo,
    hasAuthEmail: !!authEmail,
    hasAuthPlan: !!authPlan,
    hasUpgradeBtn: !!upgradeBtn
  });

  if (!authSection || !authInfo) {
    console.warn('[VideoReader] ⚠️ Отсутствуют элементы authSection или authInfo');
    return;
  }

  if (token && email) {
    // Пользователь авторизован
    console.log('[VideoReader] ✅ Пользователь авторизован, обновляем UI');
    authSection.style.display = 'none';
    authInfo.style.display = 'flex';

    if (authEmail) authEmail.textContent = email;
    if (authPlan) authPlan.textContent = plan;

    if (upgradeBtn) {
      upgradeBtn.style.display = (plan === 'Free' || plan === 'Pro') ? 'block' : 'none';
    }
  } else {
    // Пользователь не авторизован
    console.log('[VideoReader] ❌ Пользователь НЕ авторизован');
    authSection.style.display = 'flex';
    authInfo.style.display = 'none';
  }
}



// ═══════════════════════════════════════════════════════════════════
// MODULE: export.js
// ═══════════════════════════════════════════════════════════════════

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
    console.warn("[VideoReader Export] No subtitles to export");
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



// ═══════════════════════════════════════════════════════════════════
// MODULE: highlight.js
// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
// HIGHLIGHT MODULE — realtime karaoke
// ═══════════════════════════════════════════════════════════════════



// Простая рабочая версия highlight (без оптимизаций)
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

function stopRealtimeHighlight() {
  // Заглушка для совместимости
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



// ═══════════════════════════════════════════════════════════════════
// MODULE: ui.js
// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
// UI MODULE - Все функции, связанные с созданием и управлением UI
// ═══════════════════════════════════════════════════════════════════



// Константа для virtual scrolling (количество видимых строк)
const VISIBLE_WINDOW = 80;

// Список поддерживаемых языков
const SUPPORTED_LANGUAGES = [
  { code: 'ru', name: 'Russian' },
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'de', name: 'German' },
  { code: 'fr', name: 'French' },
  { code: 'ja', name: 'Japanese' },
  { code: 'zh', name: 'Chinese' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' }
];

// SVG флаги для языков
function getFlagSVG(code) {
  const flags = {
    ru: `<svg width="16" height="12" viewBox="0 0 16 12" fill="none">
      <rect width="16" height="4" fill="#fff"/>
      <rect y="4" width="16" height="4" fill="#0039a6"/>
      <rect y="8" width="16" height="4" fill="#d52b1e"/>
    </svg>`,
    en: `<svg width="16" height="12" viewBox="0 0 16 12" fill="none">
      <rect width="16" height="12" fill="#012169"/>
      <path d="M0 0L16 12M16 0L0 12" stroke="#fff" stroke-width="2"/>
      <path d="M6 0L10 12M16 6L0 6" stroke="#fff" stroke-width="4"/>
      <path d="M6 0L10 12M16 6L0 6" stroke="#C8102E" stroke-width="2"/>
    </svg>`,
    es: `<svg width="16" height="12" viewBox="0 0 16 12" fill="none">
      <rect width="16" height="4" fill="#aa151b"/>
      <rect y="4" width="16" height="4" fill="#f1bf00"/>
      <rect y="8" width="16" height="4" fill="#aa151b"/>
    </svg>`,
    de: `<svg width="16" height="12" viewBox="0 0 16 12" fill="none">
      <rect width="16" height="4" fill="#000"/>
      <rect y="4" width="16" height="4" fill="#dd0000"/>
      <rect y="8" width="16" height="4" fill="#ffce00"/>
    </svg>`,
    fr: `<svg width="16" height="12" viewBox="0 0 16 12" fill="none">
      <rect width="5.33" height="12" fill="#002395"/>
      <rect x="5.33" width="5.33" height="12" fill="#fff"/>
      <rect x="10.67" width="5.33" height="12" fill="#ed2939"/>
    </svg>`,
    ja: `<svg width="16" height="12" viewBox="0 0 16 12" fill="none">
      <rect width="16" height="12" fill="#fff"/>
      <circle cx="8" cy="6" r="3" fill="#bc002d"/>
    </svg>`,
    zh: `<svg width="16" height="12" viewBox="0 0 16 12" fill="none">
      <rect width="16" height="12" fill="#de2910"/>
      <path d="M4 4L6 6L4 8L2 6L4 4Z" fill="#ffde00"/>
      <path d="M12 4L14 6L12 8L10 6L12 4Z" fill="#ffde00"/>
      <path d="M8 6L10 8L8 10L6 8L8 6Z" fill="#ffde00"/>
    </svg>`,
    it: `<svg width="16" height="12" viewBox="0 0 16 12" fill="none">
      <rect width="5.33" height="12" fill="#009246"/>
      <rect x="5.33" width="5.33" height="12" fill="#fff"/>
      <rect x="10.67" width="5.33" height="12" fill="#ce2b37"/>
    </svg>`,
    pt: `<svg width="16" height="12" viewBox="0 0 16 12" fill="none">
      <rect width="16" height="12" fill="#006600"/>
      <rect width="8" height="12" fill="#ff0000"/>
      <circle cx="4" cy="6" r="2" fill="#ffcc00"/>
      <circle cx="4" cy="6" r="1" fill="#006600"/>
    </svg>`
  };
  return flags[code] || flags['en'];
}
// Создание панели транскрипта с премиум UI
function createTranscriptPanel() {
  const currentLang = SUPPORTED_LANGUAGES.find(l => l.code === transcriptState.selectedLang) || SUPPORTED_LANGUAGES[0];

  // Получаем URL для логотипа через chrome.runtime.getURL
  const logoUrl = chrome.runtime.getURL('assets/logo.png');

  const panel = document.createElement('div');
  panel.id = 'yt-transcript-panel';
  panel.className = 'collapsed'; // Изначально свернуто
  panel.innerHTML = `
    <div id="yt-transcript-panel-header">
      <div id="yt-transcript-panel-title">
        <div class="yt-reader-header-main">
          <img src="${logoUrl}" alt="VideoReader" class="yt-reader-logo">
          <span class="yt-reader-brand">VideoReader</span>
        </div>
        <div class="yt-reader-header-subtitle">AI Translator for YouTube</div>
      </div>
      <button id="yt-transcript-toggle-btn" title="Свернуть/Развернуть">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
        </svg>
      </button>
    </div>
    <div id="yt-transcript-body" style="display: none;">
      <!-- Sign In Section -->
      <div class="yt-reader-auth-section" id="yt-reader-auth-section">
        <div class="yt-reader-auth-prompt">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
          <span>Sign in to save your preferences</span>
        </div>
        <button id="yt-reader-signin-btn" class="yt-reader-signin-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          <span>Sign in with Google</span>
        </button>
      </div>
      <!-- Logged In Section -->
      <div id="yt-reader-auth-info" class="yt-reader-auth-info" style="display: none;">
        <div class="yt-reader-user-info">
          <div class="yt-reader-auth-email"></div>
          <div class="yt-reader-auth-plan-badge">
            <span class="yt-reader-auth-plan"></span>
          </div>
        </div>
        <button id="yt-reader-upgrade-btn" class="yt-reader-upgrade-btn" style="display: none;">Upgrade</button>
        <button id="yt-reader-logout-btn" class="yt-reader-logout-btn">Log out</button>
      </div>
      <div class="yt-reader-controls">
        <button id="yt-reader-translate-btn" class="yt-native-switch-btn active">
          Translate Video
        </button>
        <div id="yt-reader-progress-container" style="display: none; padding: 8px 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <span style="font-size: 12px; color: #666;">Translating...</span>
            <span id="yt-reader-progress-percent" style="font-size: 12px; font-weight: 600; color: #667eea;">0%</span>
          </div>
          <div style="width: 100%; height: 4px; background: #e0e0e0; border-radius: 2px; overflow: hidden;">
            <div id="yt-reader-progress-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #667eea 0%, #764ba2 100%); transition: width 0.3s;"></div>
          </div>
        </div>
        <div class="yt-reader-export-container">
          <button id="yt-reader-export-btn" class="yt-reader-export-btn" title="Экспорт субтитров" disabled>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </button>
          <div class="yt-reader-export-dropdown" id="yt-reader-export-dropdown">
            <div class="yt-reader-export-section-title">Original</div>
            <div class="yt-reader-export-divider"></div>
            <div class="yt-reader-export-option" data-format="srt" data-type="original">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              <span>SRT</span>
            </div>
            <div class="yt-reader-export-option" data-format="vtt" data-type="original">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              <span>VTT</span>
            </div>
            <div class="yt-reader-export-option" data-format="txt" data-type="original">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
              <span>TXT</span>
            </div>

            <div class="yt-reader-export-divider"></div>

            <div class="yt-reader-export-section-title">Translated</div>
            <div class="yt-reader-export-divider"></div>
            <div class="yt-reader-export-option" data-format="srt" data-type="translated">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              <span>SRT</span>
            </div>
            <div class="yt-reader-export-option" data-format="vtt" data-type="translated">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              <span>VTT</span>
            </div>
            <div class="yt-reader-export-option" data-format="txt" data-type="translated">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
              <span>TXT</span>
            </div>
          </div>
        </div>
        <div class="yt-reader-lang-selector">
          <button class="yt-reader-lang-btn" id="yt-reader-lang-btn">
            <span class="yt-reader-lang-flag" data-flag="${currentLang.code}"></span>
            <span class="yt-reader-lang-code">${currentLang.code.toUpperCase()}</span>
            <svg class="yt-reader-lang-arrow" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 10l5 5 5-5z"/>
            </svg>
          </button>
          <div class="yt-reader-lang-dropdown" id="yt-reader-lang-dropdown">
            ${SUPPORTED_LANGUAGES.map(lang => `
              <div class="yt-reader-lang-option ${lang.code === transcriptState.selectedLang ? 'selected' : ''}" data-lang="${lang.code}">
                <span class="yt-reader-lang-option-flag" data-flag="${lang.code}"></span>
                <div class="yt-reader-lang-option-info">
                  <span class="yt-reader-lang-option-code">${lang.code.toUpperCase()}</span>
                  <span class="yt-reader-lang-option-name">${lang.name}</span>
                </div>
                <svg class="yt-reader-lang-option-check" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                </svg>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
      <div id="yt-transcript-content"></div>
    </div>
  `;

  // Вставляем SVG флаги после создания HTML
  setTimeout(() => {
    // Флаг в кнопке
    const btnFlag = panel.querySelector('.yt-reader-lang-btn .yt-reader-lang-flag');
    if (btnFlag) {
      btnFlag.innerHTML = getFlagSVG(currentLang.code);
    }

    // Флаги в dropdown опциях
    panel.querySelectorAll('.yt-reader-lang-option-flag').forEach(flagEl => {
      const code = flagEl.getAttribute('data-flag');
      if (code) {
        flagEl.innerHTML = getFlagSVG(code);
      }
    });
  }, 0);

  return panel;
}

// Virtual scrolling: рендеринг только видимого окна
function renderWindow(centerIndex) {
  const subtitles = transcriptState.originalSubtitles;
  if (!subtitles || subtitles.length === 0) return;

  const content = document.getElementById('yt-transcript-content');
  if (!content) return;

  const half = Math.floor(VISIBLE_WINDOW / 2);
  const start = Math.max(0, centerIndex - half);
  const end = Math.min(subtitles.length, centerIndex + half);

  // Используем requestIdleCallback для оптимизации
  const render = () => {
    content.innerHTML = subtitles.slice(start, end).map((sub, relIndex) => {
      const index = start + relIndex;
      // Проверяем, есть ли перевод для этой строки
      const text = transcriptState.translatedSubtitles[index]?.text || sub.text;

      return `
        <div class="yt-transcript-item"
             data-time="${sub.time}"
             data-index="${index}"
             data-start="${sub.start}"
             data-end="${sub.end}">
          <div class="yt-transcript-item-time">${sub.time}</div>
          <div class="yt-transcript-item-text">${text}</div>
        </div>
      `;
    }).join('');

    // Добавляем клик по элементу для перехода к времени
    content.querySelectorAll('.yt-transcript-item').forEach(item => {
      item.addEventListener('click', () => {
        const time = item.dataset.time;
        seekToTime(time);
      });
    });
  };

  // Используем requestIdleCallback если доступен, иначе setTimeout
  if (window.requestIdleCallback) {
    window.requestIdleCallback(render);
  } else {
    setTimeout(render, 0);
  }
}

// Отображение транскрипта (с virtual scrolling для ОЧЕНЬ больших транскриптов)
function displayTranscript(subtitles) {
  transcriptState.originalSubtitles = subtitles;
  const content = document.getElementById('yt-transcript-content');

  // КРИТИЧЕСКОЕ ИЗМЕНЕНИЕ: виртуальный скроллинг только для ОЧЕНЬ больших транскриптов (>1000)
  // Для транскриптов до 1000 строк рендерим все сразу для корректного отображения
  if (subtitles.length > 1000) {
    // Для очень больших транскриптов рендерим только первые VISIBLE_WINDOW строк
    const initialEnd = Math.min(VISIBLE_WINDOW, subtitles.length);
    console.log(`[VideoReader UI] 📊 Virtual scrolling enabled: showing ${initialEnd}/${subtitles.length} lines`);
    content.innerHTML = subtitles.slice(0, initialEnd).map((sub, index) => `
      <div class="yt-transcript-item"
           data-time="${sub.time}"
           data-index="${index}"
           data-start="${sub.start}"
           data-end="${sub.end}">
        <div class="yt-transcript-item-time">${sub.time}</div>
        <div class="yt-transcript-item-text">${sub.text}</div>
      </div>
    `).join('');
  } else {
    // Для транскриптов до 1000 строк рендерим все сразу
    console.log(`[VideoReader UI] 📊 Full render: showing all ${subtitles.length} lines`);
    content.innerHTML = subtitles.map((sub, index) => `
      <div class="yt-transcript-item"
           data-time="${sub.time}"
           data-index="${index}"
           data-start="${sub.start}"
           data-end="${sub.end}">
        <div class="yt-transcript-item-time">${sub.time}</div>
        <div class="yt-transcript-item-text">${sub.text}</div>
      </div>
    `).join('');
  }

  // Добавляем клик по элементу для перехода к времени
  content.querySelectorAll('.yt-transcript-item').forEach(item => {
    item.addEventListener('click', () => {
      const time = item.dataset.time;
      seekToTime(time);
    });
  });

  // Строим timeIndexMap для O(1) поиска (оптимизация RAF)
  transcriptState.timeIndexMap = [];
  for (let i = 0; i < subtitles.length; i++) {
    const start = subtitles[i].start || 0;
    const end = subtitles[i].end || start + 2;
    for (let t = start; t < end; t += 0.1) {
      transcriptState.timeIndexMap[Math.floor(t * 10)] = i;
    }
  }

  // Запускаем realtime highlighting после отрисовки
  startRealtimeHighlight(subtitles);
}

// Переход к определенному времени в видео
function seekToTime(timeStr) {
  // Парсим время вида "0:00", "1:23", "12:34:56"
  const parts = timeStr.split(':').reverse();
  const seconds = parseInt(parts[0] || 0) +
                 parseInt(parts[1] || 0) * 60 +
                 parseInt(parts[2] || 0) * 3600;

  const video = document.querySelector('video');
  if (video) {
    video.currentTime = seconds;
    video.play();
  }
}
// Обновление класса limited для всех строк (визуальное ограничение без блокировки подсветки)
function updateLimitedClass() {
  const items = document.querySelectorAll('.yt-transcript-item');
  const userPlan = transcriptState.userPlan;
  const maxFreeLine = transcriptState.maxFreeLine;

  items.forEach((item) => {
    const itemIndex = parseInt(item.getAttribute('data-index'));
    const isLimited = userPlan === 'Free' && itemIndex > maxFreeLine;
    item.classList.toggle('limited', isLimited);
  });

}

// Обновление состояния кнопки экспорта
function updateExportButtonState() {
  const exportBtn = document.getElementById('yt-reader-export-btn');
  if (!exportBtn) return;

  const hasSubtitles = transcriptState.originalSubtitles.length > 0;

  // Кнопка активна только для Premium и если есть субтитры (независимо от состояния перевода)
  exportBtn.disabled = !hasSubtitles || !transcriptState.exportAllowed;

  // Устанавливаем tooltip в зависимости от состояния
  if (!transcriptState.exportAllowed) {
    exportBtn.title = 'Available for Premium only';
  } else if (!hasSubtitles) {
    exportBtn.title = 'No subtitles available';
  } else {
    exportBtn.title = 'Export subtitles';
  }
}

// Вставка кнопок апгрейда (как в старой версии)
function insertUpgradeButtons(lastTranslatedIndex) {
  removeUpgradeButtons(); // Сначала удаляем старые кнопки
  
  // Создаем маркер после последней переведенной строки (фиолетовая полоска)
  const lastItem = document.querySelector(`[data-index="${lastTranslatedIndex}"]`);
  if (lastItem) {
    const marker = document.createElement('div');
    marker.className = 'yt-reader-limit-marker';
    marker.style.cssText = `
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 12px 16px;
      margin: 8px 0;
      border-radius: 8px;
      font-weight: 600;
      text-align: center;
      font-size: 14px;
      box-shadow: 0 2px 8px rgba(102, 126, 234, 0.4);
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    `;
    marker.textContent = '⭐ Free Plan Limit (30%) - Upgrade for 100%';
    
    // Добавляем hover эффект
    marker.addEventListener('mouseenter', () => {
      marker.style.transform = 'scale(1.02)';
      marker.style.boxShadow = '0 4px 16px rgba(102, 126, 234, 0.6)';
    });
    marker.addEventListener('mouseleave', () => {
      marker.style.transform = 'scale(1)';
      marker.style.boxShadow = '0 2px 8px rgba(102, 126, 234, 0.4)';
    });
    
    // Добавляем клик - открываем /pricing
    marker.addEventListener('click', () => {
      window.open('https://api.beem.ink/pricing', '_blank');
    });
    
    // Вставляем после последней строки
    lastItem.parentNode.insertBefore(marker, lastItem.nextSibling);
  }
  
  // Создаем большую CTA кнопку внизу (как в старой версии)
  const content = document.getElementById('yt-transcript-content');
  if (content) {
    const upgradeMessage = document.createElement('div');
    upgradeMessage.className = 'yt-transcript-upgrade-cta';
    upgradeMessage.innerHTML = `
      <div style="
        padding: 24px;
        margin: 16px 0;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 12px;
        color: white;
        text-align: center;
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
      ">
        <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">
          ⭐ Free Plan Limit Reached
        </div>
        <div style="font-size: 14px; opacity: 0.95; margin-bottom: 16px;">
          Upgrade to translate 100% of subtitles
        </div>
        <button id="yt-reader-upgrade-cta-btn" style="
          background: white;
          color: #667eea;
          border: none;
          padding: 10px 24px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          font-size: 14px;
          transition: transform 0.2s;
        " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
          Upgrade Now
        </button>
      </div>
    `;
    content.appendChild(upgradeMessage);
    
    // Обработчик для кнопки Upgrade в CTA
    const upgradeCtaBtn = document.getElementById('yt-reader-upgrade-cta-btn');
    if (upgradeCtaBtn) {
      upgradeCtaBtn.addEventListener('click', () => {
        window.open('https://api.beem.ink/pricing', '_blank');
      });
    }
  }
}

// Удаление кнопок апгрейда (как в старой версии)
function removeUpgradeButtons() {
  // Удаляем фиолетовую полоску-маркер
  const marker = document.querySelector('.yt-reader-limit-marker');
  if (marker) {
    marker.remove();
  }

  // Удаляем большую кнопку внизу
  const upgradeBtn = document.querySelector('.yt-transcript-upgrade-cta');
  if (upgradeBtn) {
    upgradeBtn.remove();
  }
}

// Обновление одной строки транскрипта
function updateSingleLine(index, translatedText) {
  const item = document.querySelector(`[data-index="${index}"]`);
  if (item) {
    const textElement = item.querySelector('.yt-transcript-item-text');
    if (textElement) {
      // Плавное обновление
      textElement.style.opacity = '0.5';
      setTimeout(() => {
        textElement.textContent = translatedText;
        textElement.style.opacity = '1';
      }, 100);
    }
  }
}

// Обновление прогресс-бара
function updateProgressBar(doneBatches, totalBatches) {
  const progressContainer = document.getElementById('yt-reader-progress-container');
  const progressBar = document.getElementById('yt-reader-progress-bar');
  const progressPercent = document.getElementById('yt-reader-progress-percent');

  if (!progressContainer || !progressBar || !progressPercent) return;

  // Показываем прогресс
  progressContainer.style.display = 'block';

  // Вычисляем процент
  const percent = Math.round((doneBatches / totalBatches) * 100);

  // Обновляем UI
  progressBar.style.width = `${percent}%`;
  progressPercent.textContent = `${percent}%`;

  // Скрываем прогресс после завершения
  if (doneBatches >= totalBatches) {
    setTimeout(() => {
      progressContainer.style.display = 'none';
      progressBar.style.width = '0%';
      progressPercent.textContent = '0%';
    }, 1000);
  }
}

// Глобальная привязка для api.js
window.updateSingleLine = updateSingleLine;



// ═══════════════════════════════════════════════════════════════════
// MODULE: api.js
// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
// API MODULE — batch translate implementation
// ═══════════════════════════════════════════════════════════════════




// Utility: timeout wrapper
async function fetchWithTimeout(url, options, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return response;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

// send batch with retry
async function sendBatchWithRetry(payload, headers, attempt = 0) {
  const MAX_RETRIES = 3;
  const SERVER_URL = "https://api.beem.ink/translate-batch";

  // КРИТИЧЕСКОЕ: логирование payload для диагностики 500 ошибок
  if (attempt === 0) {
    console.log(`[VideoReader API] 📤 Sending batch:`, {
      videoId: payload.videoId,
      lang: payload.lang,
      itemsCount: payload.items?.length || 0,
      totalLines: payload.totalLines,
      hasAuth: !!headers.Authorization,
      firstItem: payload.items?.[0],
      payloadSize: JSON.stringify(payload).length
    });
  }

  try {
    const response = await fetchWithTimeout(
      SERVER_URL,
      {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      },
      15000
    );

    if (!response.ok) {
      const status = response.status;
      let errorBody = null;

      try {
        errorBody = await response.text();
      } catch (e) {
        // Игнорируем ошибки чтения body
      }

      // КРИТИЧЕСКОЕ: обработка различных HTTP статусов
      if (status === 429) {
        // Rate limiting - увеличиваем задержку
        if (attempt < MAX_RETRIES) {
          console.warn(`[VideoReader API] ⚠️ Rate limit (429), попытка ${attempt + 1}/${MAX_RETRIES + 1}, retry через ${2000 * Math.pow(2, attempt)}ms...`);
          const delay = 2000 * Math.pow(2, attempt); // Увеличенная задержка для 429
          await new Promise(r => setTimeout(r, delay));
          return sendBatchWithRetry(payload, headers, attempt + 1);
        } else {
          console.error(`[VideoReader API] ❌ Rate limit (429), исчерпаны все ${MAX_RETRIES + 1} попытки`);
        }
      } else if (status >= 500 && status < 600) {
        // Server error - retry
        if (attempt < MAX_RETRIES) {
          console.warn(`[VideoReader API] ⚠️ Server error (${status}), попытка ${attempt + 1}/${MAX_RETRIES + 1}, retry через ${1000 * Math.pow(2, attempt)}ms...`,
            `errorBody: ${errorBody ? errorBody.substring(0, 200) : 'null'}, videoId: ${payload.videoId}, itemsCount: ${payload.items?.length}`
          );
          const delay = 1000 * Math.pow(2, attempt);
          await new Promise(r => setTimeout(r, delay));
          return sendBatchWithRetry(payload, headers, attempt + 1);
        } else {
          console.error(`[VideoReader API] ❌ Server error (${status}), исчерпаны все ${MAX_RETRIES + 1} попытки`,
            `errorBody: ${errorBody ? errorBody.substring(0, 500) : 'null'}, videoId: ${payload.videoId}, itemsCount: ${payload.items?.length}`
          );
        }
      }

      // Логирование финальной ошибки для других статусов
      if (status !== 429 && !(status >= 500 && status < 600)) {
        console.error(`[VideoReader API] ❌ Request failed with status ${status}:`,
          `errorBody: ${errorBody ? errorBody.substring(0, 500) : 'null'}, videoId: ${payload.videoId}, itemsCount: ${payload.items?.length}`
        );
      }

      return {
        error: "bad_status",
        status: status,
        errorBody: errorBody ? errorBody.substring(0, 200) : null
      };
    }

    const result = await response.json();

    // Логирование успешных запросов (только для диагностики)
    if (attempt > 0) {
      console.log(`[VideoReader API] ✅ Batch succeeded after ${attempt + 1} attempts`);
    }

    return result;
  } catch (err) {
    const isTimeout = err.name === 'AbortError';
    const errorType = isTimeout ? 'timeout' : 'network';

    if (attempt < MAX_RETRIES) {
      console.warn(`[VideoReader API] ⚠️ Batch ${errorType} error:`, err.message, `попытка ${attempt + 1}/${MAX_RETRIES + 1}, retry...`);
      const delay = 500 * Math.pow(2, attempt);
      await new Promise(r => setTimeout(r, delay));
      return sendBatchWithRetry(payload, headers, attempt + 1);
    } else {
      console.error(`[VideoReader API] ❌ Batch ${errorType} error:`, err.message, `исчерпаны все ${MAX_RETRIES + 1} попытки`);
    }

    return {
      error: "max_retries",
      errorType: errorType,
      message: err.message,
      attemptsUsed: attempt + 1
    };
  }
}

// main batch translate function
async function translateSubtitles(videoId, subtitles, targetLang) {
  const BATCH_SIZE = 10;
  const startTime = performance.now();

  console.log(`[VideoReader API] 🚀 Starting translation:`, {
    videoId,
    totalLines: subtitles.length,
    targetLang,
    batchSize: BATCH_SIZE
  });

  const storage = await chrome.storage.local.get(["token", "plan"]);
  const token = storage.token || null;
  const initialPlan = storage.plan || "Free";  // КРИТИЧЕСКОЕ: сохраняем начальный план для лимита
  let userPlan = initialPlan;

  console.log(`[VideoReader API] 📊 План пользователя:`, {
    fromStorage: storage.plan || 'не установлен',
    initialPlan: initialPlan
  });

  transcriptState.userPlan = initialPlan;

  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const totalLines = subtitles.length;
  transcriptState.maxFreeLine =
    initialPlan === "Free" ? calculateMaxFreeLine(totalLines) : totalLines - 1;

  console.log(`[VideoReader API] 📊 Лимит перевода:`, {
    totalLines,
    maxFreeLine: transcriptState.maxFreeLine,
    willTranslate: initialPlan === "Free" ? transcriptState.maxFreeLine + 1 : totalLines
  });

  const payloadBase = {
    videoId,
    lang: targetLang,
    totalLines,
  };

  let lastTranslatedIndex = -1;

  // Вычисляем общее количество батчей для прогресс-бара
  const effectiveLines = userPlan === "Free" ? transcriptState.maxFreeLine + 1 : totalLines;
  const totalBatches = Math.ceil(effectiveLines / BATCH_SIZE);
  let doneBatches = 0;

  for (let start = 0; start < totalLines; start += BATCH_SIZE) {
    const batchItems = [];

    for (let i = start; i < Math.min(start + BATCH_SIZE, totalLines); i++) {
      // КРИТИЧЕСКОЕ: используем initialPlan для проверки лимита, а не userPlan
      // userPlan может обновиться от сервера в середине цикла
      if (initialPlan === "Free" && i > transcriptState.maxFreeLine) break;

      batchItems.push({
        lineNumber: i,
        text: subtitles[i].text,
      });
    }

    if (batchItems.length === 0) break;

    const payload = { ...payloadBase, items: batchItems };
    const result = await sendBatchWithRetry(payload, headers);

    if (!result || result.error) {
      // КРИТИЧЕСКОЕ: детальное логирование ошибок для диагностики
      const errorDetails = `batchStart: ${start}, batchSize: ${batchItems.length}, error: ${result?.error || 'unknown'}, status: ${result?.status || 'N/A'}, errorBody: ${result?.errorBody || 'N/A'}, message: ${result?.message || 'N/A'}, videoId: ${videoId}`;
      console.error("[VideoReader API] ❌ Batch translation failed:", errorDetails);

      // При ошибке продолжаем со следующим batch (отказоустойчивость)
      doneBatches++;
      updateProgressBar(doneBatches, totalBatches);
      continue;
    }

    // update plan/export if server returned
    if (result.plan) {
      console.log(`[VideoReader API] 📊 План обновлен от сервера:`, {
        oldPlan: userPlan,
        newPlan: result.plan
      });

      userPlan = result.plan;
      transcriptState.userPlan = result.plan;

      // КРИТИЧЕСКОЕ: сохраняем план в chrome.storage для следующих видео
      chrome.storage.local.set({ plan: result.plan });

      updateExportButtonState();
    }

    if (typeof result.export_allowed === "boolean") {
      transcriptState.exportAllowed = result.export_allowed;
      updateExportButtonState();
    }

    if (Array.isArray(result.items)) {
      result.items.forEach(item => {
        updateSingleLine(item.lineNumber, item.text);

        // сохраняем в state для экспорта
        transcriptState.translatedSubtitles[item.lineNumber] = {
          ...transcriptState.originalSubtitles[item.lineNumber],
          text: item.text,
        };

        lastTranslatedIndex = Math.max(lastTranslatedIndex, item.lineNumber);
      });
    }

    // Обновляем прогресс-бар после успешного batch
    doneBatches++;
    updateProgressBar(doneBatches, totalBatches);

    // КРИТИЧЕСКОЕ ИЗМЕНЕНИЕ: завершаем прогресс-бар перед выходом
    if (result.stop === true) {
      // Завершаем прогресс до 100% для корректного скрытия
      updateProgressBar(totalBatches, totalBatches);
      break;
    }

    await new Promise(r => setTimeout(r, 300));
  }

  // КРИТИЧЕСКОЕ: используем initialPlan для вставки upgrade buttons
  // т.к. userPlan мог обновиться от сервера
  if (initialPlan === "Free" && lastTranslatedIndex >= 0) {
    const idx = Math.min(lastTranslatedIndex, transcriptState.maxFreeLine);
    console.log(`[VideoReader API] 📊 Вставляем upgrade buttons на индексе:`, idx);
    insertUpgradeButtons(idx);
  }

  updateLimitedClass();

  // Финальная статистика для мониторинга производительности
  const duration = performance.now() - startTime;
  const translatedCount = lastTranslatedIndex + 1;
  console.log(`[VideoReader API] ✅ Translation completed:`, {
    duration: `${(duration / 1000).toFixed(2)}s`,
    translatedLines: translatedCount,
    totalLines: subtitles.length,
    successRate: `${((translatedCount / subtitles.length) * 100).toFixed(1)}%`,
    initialPlan: initialPlan,
    finalPlan: userPlan
  });
}



// ═══════════════════════════════════════════════════════════════════
// MODULE: transcript.js
// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
// TRANSCRIPT MODULE — Получение субтитров YouTube через API (БЕЗ КЛИКОВ)
// Объединенный модуль со всеми методами получения транскриптов
// ═══════════════════════════════════════════════════════════════════

// ───────────────────────────────────────────────────────────────────
// UTILITIES — Вспомогательные функции
// ───────────────────────────────────────────────────────────────────

function generateRandomClientVersion() {
  const dates = Array.from({ length: 30 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - i);
    return date.toISOString().split("T")[0].replace(/-/g, "");
  });
  const randomDate = dates[Math.floor(Math.random() * dates.length)];
  return `2.${randomDate}.00.00`;
}

function createYouTubeContext(clientName = "WEB") {
  return {
    context: {
      client: {
        clientName: clientName,
        clientVersion: generateRandomClientVersion(),
        hl: "en",
        gl: "US"
      }
    }
  };
}

function cleanText(text) {
  if (!text) return "";
  text = text.replace(/<[^>]*>/g, "");
  text = decodeHtmlEntities(text);
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

function decodeHtmlEntities(text) {
  const entities = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&#x27;": "'",
    "&apos;": "'",
    "&nbsp;": " ",
    "&laquo;": "«",
    "&raquo;": "»"
  };
  return text.replace(/&#\d+;|&\w+;/g, entity => entities[entity] || entity);
}

function formatTimeFromSeconds(seconds) {
  const hasHours = seconds >= 3600;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hasHours) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  } else {
    return `${minutes}:${String(secs).padStart(2, '0')}`;
  }
}

function parseXML(xmlText) {
  const parser = new DOMParser();
  return parser.parseFromString(xmlText, "text/xml");
}

async function fetchYouTubePageHtml(videoId) {
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  const html = await response.text();
  if (!html || html.trim().length === 0) {
    throw new Error("Empty response from YouTube");
  }
  return html;
}

function log(module, ...args) {
  console.log(`[VideoReader Transcript:${module}]`, ...args);
}

function logError(module, ...args) {
  console.error(`[VideoReader Transcript:${module}]`, ...args);
}

// ───────────────────────────────────────────────────────────────────
// NEXT API — Получение params через YouTube NEXT API
// ───────────────────────────────────────────────────────────────────

async function getTranscriptParamsViaNextAPI(videoId) {
  const MODULE = "NEXT-API";
  try {
    log(MODULE, `Fetching params for video: ${videoId}`);
    const url = "https://www.youtube.com/youtubei/v1/next?prettyPrint=false";
    const body = {
      ...createYouTubeContext("WEB"),
      videoId: videoId
    };

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const result = extractParamsFromNextResponse(data);

    if (result) {
      log(MODULE, `Successfully extracted params`);
      return result;
    } else {
      log(MODULE, `No params found in NEXT API response`);
      return null;
    }
  } catch (error) {
    logError(MODULE, "Failed to get params:", error.message);
    return null;
  }
}

function extractParamsFromNextResponse(data) {
  try {
    const engagementPanels = data?.engagementPanels || [];
    for (const panel of engagementPanels) {
      const content = panel?.engagementPanelSectionListRenderer?.content;
      const panelContent = content?.structuredDescriptionContentRenderer?.items || [];

      for (const item of panelContent) {
        const transcriptRenderer = item?.transcriptRenderer;
        if (!transcriptRenderer) continue;

        const searchBox = transcriptRenderer?.content?.transcriptSearchPanelRenderer?.header?.transcriptSearchBoxRenderer;
        const endpoint = searchBox?.onTextChangeCommand?.getTranscriptEndpoint;

        if (endpoint?.params) {
          const availableLanguages = extractAvailableLanguages(transcriptRenderer);
          return {
            params: endpoint.params,
            availableLanguages: availableLanguages
          };
        }
      }
    }

    const alternativeParams = findParamsAlternative(data);
    if (alternativeParams) return alternativeParams;

    return null;
  } catch (error) {
    logError("extractParams", "Failed to extract params:", error);
    return null;
  }
}

function findParamsAlternative(data) {
  try {
    const found = searchInObject(data, "getTranscriptEndpoint");
    if (found && found.params) {
      return {
        params: found.params,
        availableLanguages: []
      };
    }
    return null;
  } catch (error) {
    return null;
  }
}

function searchInObject(obj, key, maxDepth = 10) {
  if (maxDepth <= 0) return null;
  if (!obj || typeof obj !== 'object') return null;
  if (obj[key]) return obj[key];

  for (const k in obj) {
    if (typeof obj[k] === 'object') {
      const result = searchInObject(obj[k], key, maxDepth - 1);
      if (result) return result;
    }
  }
  return null;
}

function extractAvailableLanguages(transcriptRenderer) {
  try {
    const footer = transcriptRenderer?.content?.transcriptSearchPanelRenderer?.footer;
    const languageMenu = footer?.transcriptFooterRenderer?.languageMenu;
    const subMenuItems = languageMenu?.sortFilterSubMenuRenderer?.subMenuItems || [];

    return subMenuItems.map(item => ({
      language: item?.title || "",
      params: item?.continuation?.reloadContinuationData?.continuation || ""
    })).filter(lang => lang.language && lang.params);
  } catch (error) {
    return [];
  }
}

// ───────────────────────────────────────────────────────────────────
// INTERNAL API — Получение субтитров через /youtubei/v1/get_transcript
// ───────────────────────────────────────────────────────────────────

async function getTranscriptViaInternalAPI(videoId, params) {
  const MODULE = "INTERNAL-API";
  try {
    if (!params) {
      log(MODULE, "No params provided");
      return null;
    }

    log(MODULE, `Fetching transcript for video: ${videoId}`);
    const url = "https://www.youtube.com/youtubei/v1/get_transcript?prettyPrint=false";
    const body = {
      ...createYouTubeContext("WEB"),
      params: params
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-YouTube-Client-Name": "1",
        "X-YouTube-Client-Version": "2.0"
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      logError(MODULE, `Response error body:`, errorText.substring(0, 500));
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const text = await response.text();
    if (!text || text.trim().length === 0) {
      throw new Error("Empty transcript response");
    }

    const data = JSON.parse(text);
    const segments = extractSegmentsFromInternalAPI(data);

    if (segments && segments.length > 0) {
      log(MODULE, `Successfully extracted ${segments.length} segments`);
      return segments;
    } else {
      log(MODULE, "No segments found in response");
      return null;
    }
  } catch (error) {
    logError(MODULE, "Failed to get transcript:", error.message);
    return null;
  }
}

function extractSegmentsFromInternalAPI(data) {
  try {
    const actions = data?.actions || [];
    if (actions.length === 0) {
      logError("extractSegments", "No actions in response");
      return [];
    }

    const panelRenderer = actions[0]
      ?.updateEngagementPanelAction
      ?.content
      ?.transcriptRenderer
      ?.content
      ?.transcriptSearchPanelRenderer;

    if (!panelRenderer) {
      logError("extractSegments", "Invalid response structure");
      return [];
    }

    const initialSegments = panelRenderer?.body
      ?.transcriptSegmentListRenderer
      ?.initialSegments || [];

    const segments = initialSegments
      .map((segment, index) => {
        const renderer = segment?.transcriptSegmentRenderer;
        if (!renderer) return null;

        const startMs = renderer.startMs;
        const endMs = renderer.endMs;
        const text = renderer.snippet?.runs?.[0]?.text || "";

        if (!startMs || !endMs || !text) return null;

        return {
          index: index,
          start: Number(startMs) / 1000,
          end: Number(endMs) / 1000,
          duration: (Number(endMs) - Number(startMs)) / 1000,
          text: cleanText(text)
        };
      })
      .filter(Boolean);

    return segments;
  } catch (error) {
    logError("extractSegments", "Failed to extract segments:", error);
    return [];
  }
}

// ───────────────────────────────────────────────────────────────────
// TIMEDTEXT API — Получение субтитров через /api/timedtext
// ───────────────────────────────────────────────────────────────────

async function getTranscriptViaTimedtext(baseUrl) {
  const MODULE = "TIMEDTEXT";
  try {
    if (!baseUrl) {
      log(MODULE, "No baseUrl provided");
      return null;
    }

    log(MODULE, `Fetching transcript from: ${baseUrl.substring(0, 120)}...`);
    const response = await fetch(baseUrl);

    if (!response.ok) {
      const errorText = await response.text();
      logError(MODULE, `HTTP error response:`, errorText.substring(0, 300));
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const xmlText = await response.text();
    log(MODULE, `Received XML length: ${xmlText.length} chars`);

    if (!xmlText || xmlText.trim().length === 0) {
      throw new Error("Empty caption XML response");
    }

    const segments = parseTimedtextXML(xmlText);

    if (segments && segments.length > 0) {
      log(MODULE, `Successfully extracted ${segments.length} segments`);
      return segments;
    } else {
      log(MODULE, "No segments found in XML");
      return null;
    }
  } catch (error) {
    logError(MODULE, "Failed to get transcript:", error.message);
    return null;
  }
}

function parseTimedtextXML(xmlText) {
  try {
    const xmlDoc = parseXML(xmlText);
    const parseError = xmlDoc.querySelector('parsererror');
    if (parseError) {
      throw new Error("XML parsing error");
    }

    const textElements = xmlDoc.querySelectorAll('text');
    if (!textElements || textElements.length === 0) {
      return [];
    }

    const segments = [];
    textElements.forEach((element, index) => {
      const start = parseFloat(element.getAttribute('start')) || 0;
      const duration = parseFloat(element.getAttribute('dur')) || 0;
      const text = element.textContent || "";

      if (text.trim()) {
        segments.push({
          index: index,
          start: start,
          end: start + duration,
          duration: duration,
          text: cleanText(text)
        });
      }
    });

    return segments;
  } catch (error) {
    logError("parseTimedtextXML", "Failed to parse XML:", error);
    return [];
  }
}

function extractBaseUrl(captionTracks, preferredLanguage = "en") {
  try {
    if (!captionTracks || captionTracks.length === 0) {
      log("extractBaseUrl", "No caption tracks provided");
      return null;
    }

    log("extractBaseUrl", `Available tracks: ${captionTracks.length}`);

    let track = captionTracks.find(t =>
      t.languageCode === preferredLanguage ||
      t.vssId === preferredLanguage ||
      t.vssId === `.${preferredLanguage}`
    );

    if (!track) {
      log("extractBaseUrl", `Preferred language ${preferredLanguage} not found, using first track`);
      track = captionTracks[0];
    } else {
      log("extractBaseUrl", `Found preferred language: ${track.language}`);
    }

    return track.baseUrl || null;
  } catch (error) {
    logError("extractBaseUrl", "Failed to extract baseUrl:", error);
    return null;
  }
}

// ───────────────────────────────────────────────────────────────────
// HTML PARSING — Извлечение данных из ytInitialPlayerResponse
// ───────────────────────────────────────────────────────────────────

async function getDataFromYtInitial(videoId) {
  const MODULE = "YTINITIAL";
  try {
    log(MODULE, `Fetching HTML for video: ${videoId}`);
    const html = await fetchYouTubePageHtml(videoId);

    const captionTracks = extractCaptionTracks(html);
    const params = extractTranscriptParams(html);

    if (captionTracks.length > 0 || params) {
      log(MODULE, `Found ${captionTracks.length} caption tracks and params: ${params ? 'YES' : 'NO'}`);
      return { captionTracks, params };
    } else {
      log(MODULE, "No caption data found in HTML");
      return null;
    }
  } catch (error) {
    logError(MODULE, "Failed to extract data from HTML:", error.message);
    return null;
  }
}

function extractCaptionTracks(html) {
  try {
    const parts = html.split('"captions":');
    if (parts.length < 2) return [];

    const captionsJson = parts[1].split(',"videoDetails')[0].replace(/\n/g, "");
    const captions = JSON.parse(captionsJson);
    const tracks = captions?.playerCaptionsTracklistRenderer?.captionTracks || [];

    return tracks.map(track => {
      let langCode = track.vssId || "";
      if (langCode.startsWith(".")) {
        langCode = langCode.slice(1);
      }

      return {
        baseUrl: track.baseUrl || "",
        language: track.name?.simpleText || "",
        languageCode: track.languageCode || "",
        vssId: langCode,
        kind: track.kind || "",
        isTranslatable: track.isTranslatable || false
      };
    });
  } catch (error) {
    logError("extractCaptionTracks", "Failed to extract caption tracks:", error);
    return [];
  }
}

function extractTranscriptParams(html) {
  try {
    const parts = html.split('"getTranscriptEndpoint":');
    if (parts.length < 2) {
      log("extractTranscriptParams", "getTranscriptEndpoint not found in HTML");
      return null;
    }

    const paramsMatch = parts[1].split('"params":"')[1];
    if (!paramsMatch) {
      log("extractTranscriptParams", "params field not found");
      return null;
    }

    const params = paramsMatch.split('"')[0];
    log("extractTranscriptParams", `Extracted params: ${params.substring(0, 50)}...`);
    return params;
  } catch (error) {
    logError("extractTranscriptParams", "Failed to extract params:", error);
    return null;
  }
}

// ───────────────────────────────────────────────────────────────────
// ORCHESTRATOR — Главный метод с fallback между всеми методами
// ───────────────────────────────────────────────────────────────────

// Простой кэш транскриптов
const transcriptCache = new Map();

function getCachedTranscript(videoId) {
  return transcriptCache.get(videoId) || null;
}

function cacheTranscript(videoId, result) {
  transcriptCache.set(videoId, result);
  // Автоочистка через 10 минут
  setTimeout(() => {
    transcriptCache.delete(videoId);
  }, 10 * 60 * 1000);
}

function createResult(videoId, segments, method, captionTracks) {
  return {
    videoId,
    segments,
    method,
    availableLanguages: captionTracks.map(t => ({
      code: t.languageCode || t.vssId,
      name: t.language
    }))
  };
}

async function getTranscriptAPI(videoId, options = {}) {
  const MODULE = "ORCHESTRATOR";
  const { preferredLanguage = "en", useCache = true } = options;

  try {
    log(MODULE, `Starting transcript fetch for video: ${videoId}`);

    // 1. Проверяем кэш
    if (useCache) {
      const cached = getCachedTranscript(videoId);
      if (cached) {
        log(MODULE, "✅ Using cached transcript");
        return cached;
      }
    }

    let params = null;
    let captionTracks = [];

    // METHOD 0: NEXT API - получение params
    log(MODULE, "📡 METHOD 0: Attempting NEXT API...");
    try {
      const nextData = await getTranscriptParamsViaNextAPI(videoId);
      if (nextData && nextData.params) {
        params = nextData.params;
        log(MODULE, "✅ METHOD 0: Successfully got params from NEXT API");
      }
    } catch (error) {
      logError(MODULE, "❌ METHOD 0 failed:", error.message);
    }

    // METHOD 1: Internal API с params
    if (params) {
      log(MODULE, "📡 METHOD 1: Attempting Internal API...");
      try {
        const segments = await getTranscriptViaInternalAPI(videoId, params);
        if (segments && segments.length > 0) {
          const result = createResult(videoId, segments, "internal_api", captionTracks);
          cacheTranscript(videoId, result);
          log(MODULE, "✅ METHOD 1: Success!");
          return result;
        }
      } catch (error) {
        logError(MODULE, "❌ METHOD 1 failed:", error.message);
      }
    } else {
      log(MODULE, "⏭️ METHOD 1: Skipped (no params)");
    }

    // METHOD 2: HTML Parsing - получаем captionTracks и params
    log(MODULE, "📡 METHOD 2: Attempting HTML Parsing...");
    try {
      const ytData = await getDataFromYtInitial(videoId);
      if (ytData) {
        captionTracks = ytData.captionTracks || [];

        // Если не получили params ранее, используем из HTML
        if (!params && ytData.params) {
          params = ytData.params;
          log(MODULE, "✅ METHOD 2: Got params from HTML");

          // Пробуем Internal API с новыми params
          try {
            const segments = await getTranscriptViaInternalAPI(videoId, params);
            if (segments && segments.length > 0) {
              const result = createResult(videoId, segments, "internal_api_html", captionTracks);
              cacheTranscript(videoId, result);
              log(MODULE, "✅ METHOD 2: Success via Internal API!");
              return result;
            }
          } catch (error) {
            logError(MODULE, "❌ METHOD 2 Internal API retry failed:", error.message);
          }
        }
      }
    } catch (error) {
      logError(MODULE, "❌ METHOD 2 failed:", error.message);
    }

    // METHOD 3: Timedtext API
    if (captionTracks.length > 0) {
      log(MODULE, "📡 METHOD 3: Attempting Timedtext API...");
      try {
        const baseUrl = extractBaseUrl(captionTracks, preferredLanguage);
        if (baseUrl) {
          const segments = await getTranscriptViaTimedtext(baseUrl);
          if (segments && segments.length > 0) {
            const result = createResult(videoId, segments, "timedtext", captionTracks);
            cacheTranscript(videoId, result);
            log(MODULE, "✅ METHOD 3: Success!");
            return result;
          }
        } else {
          log(MODULE, "⏭️ METHOD 3: Skipped (no baseUrl)");
        }
      } catch (error) {
        logError(MODULE, "❌ METHOD 3 failed:", error.message);
      }
    } else {
      log(MODULE, "⏭️ METHOD 3: Skipped (no caption tracks)");
    }

    throw new Error("Failed to fetch transcript: All methods exhausted");
  } catch (error) {
    logError(MODULE, "❌ Failed to fetch transcript:", error.message);
    throw error;
  }
}

// ───────────────────────────────────────────────────────────────────
// PUBLIC API — Главная функция для использования в content script
// ───────────────────────────────────────────────────────────────────

async function getTranscript(videoId) {
  console.log('[VideoReader Transcript] 🚀 Получаем транскрипт через API (без кликов)...');

  if (!videoId) {
    console.error('[VideoReader Transcript] ❌ Video ID not found');
    return null;
  }

  try {
    const result = await getTranscriptAPI(videoId, {
      preferredLanguage: 'en',
      useCache: true
    });

    if (!result || !result.segments || result.segments.length === 0) {
      console.warn('[VideoReader Transcript] ⚠️ No transcript data received');
      return null;
    }

    console.log(`[VideoReader Transcript] ✅ Получено ${result.segments.length} сегментов субтитров`);
    console.log(`[VideoReader Transcript] 📊 Метод: ${result.method}`);
    console.log(`[VideoReader Transcript] 🌍 Доступные языки: ${result.availableLanguages.length}`);

    // Преобразуем в формат, совместимый с текущим кодом
    const subtitles = result.segments.map(segment => ({
      index: segment.index,
      time: formatTimeFromSeconds(segment.start),
      text: segment.text,
      start: segment.start,
      end: segment.end
    }));

    return subtitles;
  } catch (error) {
    console.error('[VideoReader Transcript] ❌ Ошибка получения транскрипта:', error);
    console.error('[VideoReader Transcript] Стек ошибки:', error.stack);
    return null;
  }
}



// ═══════════════════════════════════════════════════════════════════
// MODULE: init.js
// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
// INIT MODULE - Главный init-процесс и обработчики
// ═══════════════════════════════════════════════════════════════════








// Флаг для предотвращения двойной вставки панели
let injecting = false;

// Утилита throttle для ограничения частоты вызовов
function throttle(fn, delay) {
  let last = 0;
  return (...args) => {
    const now = Date.now();
    if (now - last > delay) {
      last = now;
      return fn(...args);
    }
  };
}

// Уничтожение панели и очистка всех ресурсов
function destroyPanel() {
  // Останавливаем realtime highlight (прерывает RAF цикл)
  stopRealtimeHighlight();

  // P1 FIX: Явная очистка scroll/wheel handlers
  if (transcriptState.scrollListenersAttachedTo) {
    const oldContainer = transcriptState.scrollListenersAttachedTo;
    if (transcriptState.wheelHandler) {
      oldContainer.removeEventListener("wheel", transcriptState.wheelHandler);
      transcriptState.wheelHandler = null;
    }
    if (transcriptState.scrollHandler) {
      oldContainer.removeEventListener("scroll", transcriptState.scrollHandler);
      transcriptState.scrollHandler = null;
    }
    transcriptState.scrollListenersAttachedTo = null;
  }
  transcriptState.scrollLocked = false;

  // Очищаем все таймеры
  if (transcriptState.scrollUnlockTimer) {
    clearTimeout(transcriptState.scrollUnlockTimer);
    transcriptState.scrollUnlockTimer = null;
  }

  // Удаляем все document-level listeners
  for (const {target, type, handler} of transcriptState.listeners) {
    target.removeEventListener(type, handler);
  }
  transcriptState.listeners = [];

  // КРИТИЧЕСКОЕ ИЗМЕНЕНИЕ: НЕ восстанавливаем history методы
  // Hijack должен оставаться активным для корректной работы навигации между видео
  // History API hijack будет работать всё время пока content script загружен

  // Удаляем панель из DOM
  const panel = document.getElementById('yt-transcript-panel');
  if (panel) {
    panel.remove();
  }
}

// Cross-tab синхронизация плана, токена и email
chrome.storage.onChanged.addListener((changes) => {
  console.log('[VideoReader Content] 📬 chrome.storage.onChanged:', {
    hasToken: !!changes.token,
    hasEmail: !!changes.email,
    hasPlan: !!changes.plan,
    tokenValue: changes.token?.newValue ? `${changes.token.newValue.substring(0, 20)}...` : null,
    emailValue: changes.email?.newValue
  });

  // КРИТИЧЕСКОЕ ИЗМЕНЕНИЕ: обрабатываем все auth-related изменения
  let needsUpdate = false;

  if (changes.plan) {
    transcriptState.userPlan = changes.plan.newValue;
    needsUpdate = true;
  }

  // Обрабатываем изменения token и email
  if (changes.token || changes.email) {
    needsUpdate = true;
  }

  // Обновляем UI только если что-то изменилось
  if (needsUpdate) {
    console.log('[VideoReader Content] 🔄 Обновляем UI авторизации...');
    updateAuthUI();
    updateExportButtonState();
  }
});

// Вставка панели в страницу
async function injectPanel() {
  // Предотвращаем повторную вставку панели
  if (injecting) return;
  injecting = true;

  try {
    // Загружаем сохраненный язык и синхронизируем с state
    const savedLang = loadSavedLanguage();
    transcriptState.selectedLang = savedLang;

    // Ищем secondary column (справа от видео)
    const secondary = await waitForElement('#secondary-inner, #secondary');

    // Проверяем, не добавлена ли уже панель
    if (document.getElementById('yt-transcript-panel')) {
      return;
    }

    const panel = createTranscriptPanel();

    // Вставляем в начало secondary column
    secondary.insertBefore(panel, secondary.firstChild);

    // Привязываем обработчики
    const translateBtn = document.getElementById('yt-reader-translate-btn');
    const toggleBtn = document.getElementById('yt-transcript-toggle-btn');
    const langBtn = document.getElementById('yt-reader-lang-btn');
    const langDropdown = document.getElementById('yt-reader-lang-dropdown');

    translateBtn.addEventListener('click', handleGetTranscript);
    toggleBtn.addEventListener('click', handleTogglePanel);
    langBtn.addEventListener('click', handleLanguageToggle);

    // Обработчики для опций языка
    const langOptions = document.querySelectorAll('.yt-reader-lang-option');
    langOptions.forEach(option => {
      option.addEventListener('click', (e) => {
        e.stopPropagation();
        handleLanguageSelect(option.dataset.lang);
      });
    });

    // Обработчики экспорта
    const exportBtn = document.getElementById('yt-reader-export-btn');
    const exportDropdown = document.getElementById('yt-reader-export-dropdown');
    const exportOptions = document.querySelectorAll('.yt-reader-export-option');

    exportBtn.addEventListener('click', handleExportToggle);
    exportOptions.forEach(option => {
      option.addEventListener('click', (e) => {
        e.stopPropagation();

        // Блокируем клик на locked опциях
        if (option.classList.contains('locked')) {
          return;
        }

        const format = option.dataset.format;
        const type = option.dataset.type;
        handleExportFormat(format, type);
      });
    });

    // Закрытие dropdown при клике вне его
    const closeDropdownHandler = (e) => {
      if (!e.target.closest('.yt-reader-lang-selector')) {
        langDropdown.classList.remove('show');
        langBtn.classList.remove('active');
      }
      if (!e.target.closest('.yt-reader-export-container')) {
        exportDropdown.classList.remove('show');
      }
    };
    document.addEventListener('click', closeDropdownHandler);

    // Сохраняем listener для cleanup
    transcriptState.listeners.push({
      target: document,
      type: 'click',
      handler: closeDropdownHandler
    });

    // Обработчики авторизации
    const signInBtn = document.getElementById('yt-reader-signin-btn');
    if (signInBtn) {
      signInBtn.addEventListener('click', () => {
        openAuthPage();
      });
    }

    const logoutBtn = document.getElementById('yt-reader-logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        // Удаляем токен и email из chrome.storage
        await chrome.storage.local.remove(['token', 'email', 'plan']);

        // Обновляем UI
        await updateAuthUI();
      });
    }

    // Обработчик для кнопки Upgrade
    const upgradeBtn = document.getElementById('yt-reader-upgrade-btn');
    if (upgradeBtn) {
      upgradeBtn.addEventListener('click', () => {
        window.open('https://api.beem.ink/pricing', '_blank');
      });
    }

    // Обновляем UI авторизации при загрузке панели
    // Небольшая задержка чтобы гарантировать что DOM полностью готов
    await new Promise(resolve => setTimeout(resolve, 100));
    await updateAuthUI();

    console.log('[VideoReader Content] Панель транскрипта добавлена');
    injecting = false;
  } catch (error) {
    console.error('[VideoReader Content] Ошибка при вставке панели:', error);
    injecting = false;
  }
}

// Обработчик сворачивания/разворачивания
function handleTogglePanel() {
  const panel = document.getElementById('yt-transcript-panel');
  const body = document.getElementById('yt-transcript-body');
  const toggleBtn = document.getElementById('yt-transcript-toggle-btn');

  const isCollapsed = panel.classList.toggle('collapsed');

  if (isCollapsed) {
    body.style.display = 'none';
    toggleBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
      </svg>
    `;
  } else {
    body.style.display = 'block';
    toggleBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6 1.41 1.41z"/>
      </svg>
    `;
  }
}

// Обработчик переключения выпадающего списка языков
function handleLanguageToggle(e) {
  e.stopPropagation();
  const langBtn = document.getElementById('yt-reader-lang-btn');
  const langDropdown = document.getElementById('yt-reader-lang-dropdown');

  const isActive = langBtn.classList.toggle('active');

  if (isActive) {
    // Рассчитываем позицию dropdown
    const btnRect = langBtn.getBoundingClientRect();
    const dropdownHeight = 320; // примерная высота dropdown
    const viewportHeight = window.innerHeight;

    // Определяем, достаточно ли места снизу
    const spaceBelow = viewportHeight - btnRect.bottom;
    const shouldShowAbove = spaceBelow < dropdownHeight && btnRect.top > dropdownHeight;

    if (shouldShowAbove) {
      // Показываем сверху
      langDropdown.style.top = 'auto';
      langDropdown.style.bottom = `${viewportHeight - btnRect.top + 6}px`;
    } else {
      // Показываем снизу
      langDropdown.style.top = `${btnRect.bottom + 6}px`;
      langDropdown.style.bottom = 'auto';
    }

    // Выравниваем по правому краю кнопки
    langDropdown.style.right = `${window.innerWidth - btnRect.right}px`;
    langDropdown.style.left = 'auto';

    langDropdown.classList.add('show');
  } else {
    langDropdown.classList.remove('show');
  }
}

// Обработчик выбора языка
function handleLanguageSelect(langCode) {
  const selectedLang = SUPPORTED_LANGUAGES.find(l => l.code === langCode);
  if (!selectedLang) return;

  // Сохраняем выбранный язык и синхронизируем с state
  saveLanguage(langCode);
  transcriptState.selectedLang = langCode;

  // Обновляем UI кнопки
  const langBtn = document.getElementById('yt-reader-lang-btn');
  const flagEl = langBtn.querySelector('.yt-reader-lang-flag');
  flagEl.innerHTML = getFlagSVG(langCode);
  flagEl.setAttribute('data-flag', langCode);
  langBtn.querySelector('.yt-reader-lang-code').textContent = langCode.toUpperCase();

  // Обновляем selected опции
  document.querySelectorAll('.yt-reader-lang-option').forEach(opt => {
    opt.classList.toggle('selected', opt.dataset.lang === langCode);
  });

  // Закрываем dropdown
  const langDropdown = document.getElementById('yt-reader-lang-dropdown');
  langDropdown.classList.remove('show');
  langBtn.classList.remove('active');

  console.log('[VideoReader Content] Выбран язык:', selectedLang.name);
}
// Обработчик переключения выпадающего списка экспорта
function handleExportToggle(e) {
  e.stopPropagation();
  const exportDropdown = document.getElementById('yt-reader-export-dropdown');

  const isActive = exportDropdown.classList.toggle('show');

  if (isActive) {
    // Рассчитываем позицию dropdown
    const btnRect = e.currentTarget.getBoundingClientRect();
    const dropdownHeight = 200; // примерная высота dropdown
    const viewportHeight = window.innerHeight;

    // Определяем, достаточно ли места снизу
    const spaceBelow = viewportHeight - btnRect.bottom;
    const shouldShowAbove = spaceBelow < dropdownHeight && btnRect.top > dropdownHeight;

    if (shouldShowAbove) {
      // Показываем сверху
      exportDropdown.style.top = 'auto';
      exportDropdown.style.bottom = `${viewportHeight - btnRect.top + 6}px`;
    } else {
      // Показываем снизу
      exportDropdown.style.top = `${btnRect.bottom + 6}px`;
      exportDropdown.style.bottom = 'auto';
    }

    // Выравниваем по правому краю кнопки
    exportDropdown.style.right = `${window.innerWidth - btnRect.right}px`;
    exportDropdown.style.left = 'auto';
  }
}

// Обработчик выбора формата экспорта
function handleExportFormat(format, type) {
  if (!transcriptState.originalSubtitles || transcriptState.originalSubtitles.length === 0) {
    return;
  }

  const subtitles = type === 'original' ?
    transcriptState.originalSubtitles :
    getTranslatedSubtitlesArray();

  exportSubtitles(subtitles, format);
}


// Обработчик получения транскрипта
async function handleGetTranscript() {
  const translateBtn = document.getElementById('yt-reader-translate-btn');
  const contentEl = document.getElementById('yt-transcript-content');

  try {
    // Показываем статус загрузки
    translateBtn.disabled = true;
    translateBtn.innerHTML = `
      <div class="yt-reader-loading-spinner"></div>
      Получение...
    `;

    // Очищаем предыдущий контент
    contentEl.innerHTML = '';
    transcriptState.originalSubtitles = [];
    transcriptState.translatedSubtitles = {};

    // Получаем videoId
    const videoId = getVideoId();

    // Получаем субтитры
    const subtitles = await getTranscript(videoId);

    // Если getTranscript вернул null - субтитры недоступны для этого видео
    if (subtitles === null) {
      contentEl.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: #666;">
          <div style="font-size: 48px; margin-bottom: 16px;">📄</div>
          <div style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">Субтитры недоступны</div>
          <div style="font-size: 14px;">Для этого видео субтитры не найдены</div>
        </div>
      `;
      translateBtn.disabled = false;
      translateBtn.textContent = 'Translate Video';
      return;
    }

    if (!subtitles || subtitles.length === 0) {
      throw new Error('Транскрипт не найден для этого видео');
    }

    // Сохраняем оригинальные субтитры
    transcriptState.originalSubtitles = subtitles;

    // Отображаем оригинальные субтитры (displayTranscript уже запускает highlight)
    displayTranscript(subtitles);

    // --- AUTO SCROLL LOCK ---
    const container = document.getElementById('yt-transcript-content');
    if (container && transcriptState.scrollListenersAttachedTo !== container) {
      // Удаляем listeners со старого контейнера, если он существует
      if (transcriptState.scrollListenersAttachedTo) {
        const oldContainer = transcriptState.scrollListenersAttachedTo;
        if (transcriptState.wheelHandler) {
          oldContainer.removeEventListener("wheel", transcriptState.wheelHandler);
        }
        if (transcriptState.scrollHandler) {
          oldContainer.removeEventListener("scroll", transcriptState.scrollHandler);
        }
      }

      // Создаем новые обработчики
      transcriptState.wheelHandler = () => {
        transcriptState.scrollLocked = true;

        if (transcriptState.scrollUnlockTimer) {
          clearTimeout(transcriptState.scrollUnlockTimer);
        }

        // через 1200 мс возвращаем автоскролл
        transcriptState.scrollUnlockTimer = setTimeout(() => {
          transcriptState.scrollLocked = false;
          transcriptState.scrollUnlockTimer = null;
        }, 1200);
      };

      transcriptState.scrollHandler = () => {
        transcriptState.scrollLocked = true;

        if (transcriptState.scrollUnlockTimer) {
          clearTimeout(transcriptState.scrollUnlockTimer);
        }

        transcriptState.scrollUnlockTimer = setTimeout(() => {
          transcriptState.scrollLocked = false;
          transcriptState.scrollUnlockTimer = null;
        }, 1200);
      };

      // Добавляем listeners к новому контейнеру
      container.addEventListener("wheel", transcriptState.wheelHandler, { passive: true });
      container.addEventListener("scroll", transcriptState.scrollHandler, { passive: true });

      transcriptState.scrollListenersAttachedTo = container;
    }

    // Обновляем кнопку на "Перевод..."
    translateBtn.innerHTML = `
      <div class="yt-reader-loading-spinner"></div>
      Перевод...
    `;

    // Получаем выбранный язык
    const targetLang = transcriptState.selectedLang || 'ru';

    // Переводим субтитры
    await translateSubtitles(videoId, subtitles, targetLang);

    // Включаем кнопку и возвращаем оригинальный вид
    translateBtn.disabled = false;
    translateBtn.textContent = 'Translate Video';

    console.log('[VideoReader Content] Транскрипт успешно получен и переведен');

  } catch (error) {
    console.error('[VideoReader Content] Ошибка получения транскрипта:', error);

    // Включаем кнопку и возвращаем оригинальный вид
    translateBtn.disabled = false;
    translateBtn.textContent = 'Translate Video';
  }
}


// Наблюдение за навигацией YouTube
function observeYoutubeNavigation() {
  // Callback для MutationObserver
  const observerCallback = (mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // Проверяем, изменился ли URL (новая страница видео)
          if (window.location.href.includes('/watch?v=')) {
            // Проверяем наличие secondary column
            const secondary = document.querySelector('#secondary-inner, #secondary');
            if (secondary && !document.getElementById('yt-transcript-panel')) {
              // Небольшая задержка чтобы убедиться что DOM полностью загружен
              setTimeout(() => {
                injectPanel();
              }, 500);
            }
          }
        }
      }
    }
  };

  // Применяем throttle для снижения нагрузки (защита от MutationObserver flood)
  const throttledCallback = throttle(observerCallback, 500);

  const observer = new MutationObserver(throttledCallback);

  // Начинаем наблюдение за body
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Также отслеживаем изменения URL через history API
  let currentUrl = window.location.href;

  // Сохраняем оригинальные методы для восстановления при cleanup
  if (!transcriptState.originalPushState) {
    transcriptState.originalPushState = history.pushState;
    transcriptState.originalReplaceState = history.replaceState;
  }

  history.pushState = function(...args) {
    transcriptState.originalPushState.apply(this, args);
    handleUrlChange();
  };

  history.replaceState = function(...args) {
    transcriptState.originalReplaceState.apply(this, args);
    handleUrlChange();
  };

  window.addEventListener('popstate', handleUrlChange);

  // Сохраняем popstate listener для cleanup
  transcriptState.listeners.push({
    target: window,
    type: 'popstate',
    handler: handleUrlChange
  });

  function handleUrlChange() {
    if (window.location.href !== currentUrl) {
      currentUrl = window.location.href;

      // Если перешли на страницу видео
      if (window.location.href.includes('/watch?v=')) {
        // Уничтожаем старую панель если есть
        destroyPanel();

        // Небольшая задержка чтобы убедиться что DOM полностью загружен
        setTimeout(() => {
          injectPanel();
        }, 500);
      }
    }
  }
}

// Главная функция инициализации
async function initContentScript() {
  console.log('[VideoReader Content] Инициализация content script...');

  // Ждем загрузки DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initializeAfterDOMReady();
    });
  } else {
    initializeAfterDOMReady();
  }

  async function initializeAfterDOMReady() {
    // Проверяем, находимся ли мы на странице видео
    if (window.location.href.includes('/watch?v=')) {
      // Ждем появления secondary column
      try {
        await waitForElement('#secondary-inner, #secondary', 10000);
        await injectPanel();
      } catch (error) {
        console.log('[VideoReader Content] Secondary column не найден, возможно страница еще не полностью загружена');
      }
    }

    // Запускаем наблюдение за навигацией
    observeYoutubeNavigation();
  }
}

// Автоматический запуск при загрузке
initContentScript();
