// ═══════════════════════════════════════════════════════════════════
// UI MODULE - Все функции, связанные с созданием и управлением UI
// ═══════════════════════════════════════════════════════════════════

import { transcriptState } from "./state.js";
import { startRealtimeHighlight } from "./highlight.js";

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

// Отображение транскрипта (с virtual scrolling для больших транскриптов)
function displayTranscript(subtitles) {
  transcriptState.originalSubtitles = subtitles;
  const content = document.getElementById('yt-transcript-content');

  // Для больших транскриптов используем virtual scrolling
  if (subtitles.length > 100) {
    // Рендерим только первые VISIBLE_WINDOW строк
    const initialEnd = Math.min(VISIBLE_WINDOW, subtitles.length);
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
    // Для маленьких транскриптов рендерим все строки
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

export {
  createTranscriptPanel,
  displayTranscript,
  renderWindow,
  updateSingleLine,
  updateLimitedClass,
  updateExportButtonState,
  insertUpgradeButtons,
  updateProgressBar,
  SUPPORTED_LANGUAGES,
  getFlagSVG
};