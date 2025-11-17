// ═══════════════════════════════════════════════════════════════════
// TOKEN AUTH - Listen for postMessage from OAuth callback
// ═══════════════════════════════════════════════════════════════════

// Слушаем postMessage от OAuth callback popup
window.addEventListener('message', async (event) => {
  // Проверяем тип сообщения
  if (event.data && event.data.type === 'AUTH_SUCCESS') {
    const token = event.data.token;

    console.log('[VideoReader] Получен токен от OAuth callback:', token?.substring(0, 8) + '...');

    // Сохраняем токен в chrome.storage.local
    if (token) {
      await chrome.storage.local.set({ token });
      console.log('[VideoReader] Токен сохранён в chrome.storage');

      // Сразу после получения токена запрашиваем план
      await fetchPlan();
    }
  }
});

// ═══════════════════════════════════════════════════════════════════
// PLAN DETECTION SYSTEM - Fetch user plan from backend with Bearer token
// ═══════════════════════════════════════════════════════════════════

// Функция получения тарифного плана пользователя
async function fetchPlan() {
  const API_URL = 'http://localhost:5000/api/plan';

  try {
    // Получаем токен из chrome.storage
    const storage = await chrome.storage.local.get(['token']);
    const token = storage.token;

    if (!token) {
      console.log('[VideoReader] Токен отсутствует - пользователь не авторизован');
      await chrome.storage.local.set({ plan: 'Free', email: null });
      console.log('[VideoReader] Current plan: Free');
      return { plan: 'Free', email: null };
    }

    // Отправляем запрос с токеном в Authorization header
    const response = await fetch(API_URL, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    });

    // Обрабатываем ответ
    if (response.status === 401) {
      // 401 - токен невалиден или истёк
      console.log('[VideoReader] Токен невалиден - пользователь не авторизован');
      await chrome.storage.local.set({ plan: 'Free', email: null });
      console.log('[VideoReader] Current plan: Free');
      return { plan: 'Free', email: null };
    }

    if (!response.ok) {
      // Другие ошибки - считаем Free
      console.warn(`[VideoReader] Plan API returned status ${response.status}, defaulting to Free`);
      await chrome.storage.local.set({ plan: 'Free', email: null });
      console.log('[VideoReader] Current plan: Free');
      return { plan: 'Free', email: null };
    }

    // Успешный ответ
    const data = await response.json();

    if (data.status === 'ok' && data.plan && data.email) {
      console.log(`[VideoReader] Current plan: ${data.plan} (${data.email})`);

      // Сохраняем в chrome.storage.local
      await chrome.storage.local.set({ plan: data.plan, email: data.email });

      return { plan: data.plan, email: data.email };
    } else {
      // Неожиданный формат ответа
      console.warn('[VideoReader] Unexpected API response format, defaulting to Free');
      await chrome.storage.local.set({ plan: 'Free', email: null });
      console.log('[VideoReader] Current plan: Free');
      return { plan: 'Free', email: null };
    }

  } catch (error) {
    // Ошибка сети или сервер недоступен - считаем Free
    console.warn('[VideoReader] Failed to fetch plan from server, defaulting to Free:', error.message);

    // Сохраняем Free plan
    await chrome.storage.local.set({ plan: 'Free', email: null });
    console.log('[VideoReader] Current plan: Free');
    return { plan: 'Free', email: null };
  }
}

// ═══════════════════════════════════════════════════════════════════
// EXISTING CODE - All existing functionality remains unchanged
// ═══════════════════════════════════════════════════════════════════

// Глобальное состояние для предотвращения повторных запросов
const transcriptState = {
  videoId: null,
  isProcessing: false,
  isProcessed: false,
  subtitles: null,
  selectedLang: 'ru' // По умолчанию русский
};

// ═══════════════════════════════════════════════════════════════════
// REALTIME HIGHLIGHTING SYSTEM - Netflix-level subtitle sync
// ═══════════════════════════════════════════════════════════════════
const realtimeHighlighter = {
  video: null,
  subtitles: [],
  currentIndex: -1,
  lastUpdateTime: 0,
  throttleDelay: 120, // мс между обновлениями
  updateInterval: null,
  isActive: false,
  lastScrollTime: 0,
  scrollThrottle: 800, // не скроллим чаще чем раз в 800мс

  // Запуск системы подсветки
  start(subtitles) {
    this.stop(); // Останавливаем предыдущую сессию

    this.video = document.querySelector('video');
    if (!this.video) {
      console.warn('Video element not found for realtime highlighting');
      return;
    }

    this.subtitles = subtitles;
    this.currentIndex = -1;
    this.isActive = true;

    console.log('🎬 Realtime highlighting started:', subtitles.length, 'segments');

    // Используем requestAnimationFrame для плавной синхронизации
    const updateLoop = () => {
      if (!this.isActive) return;

      const now = performance.now();
      if (now - this.lastUpdateTime >= this.throttleDelay) {
        this.update();
        this.lastUpdateTime = now;
      }

      this.updateInterval = requestAnimationFrame(updateLoop);
    };

    updateLoop();
  },

  // Остановка системы подсветки
  stop() {
    if (this.updateInterval) {
      cancelAnimationFrame(this.updateInterval);
      this.updateInterval = null;
    }

    this.isActive = false;
    this.currentIndex = -1;

    // Убираем все подсветки
    document.querySelectorAll('.yt-transcript-item.active-subtitle').forEach(el => {
      el.classList.remove('active-subtitle');
    });

    console.log('⏹️ Realtime highlighting stopped');
  },

  // Обновление подсветки текущей строки
  update() {
    if (!this.video || !this.isActive) return;

    const currentTime = this.video.currentTime;

    // Быстрый поиск активной строки с оптимизацией
    let activeIndex = -1;

    // Оптимизация: начинаем поиск с текущего индекса
    const searchStart = Math.max(0, this.currentIndex - 1);
    const searchEnd = Math.min(this.subtitles.length, this.currentIndex + 10);

    // Ищем в узком диапазоне сначала (оптимизация)
    for (let i = searchStart; i < searchEnd; i++) {
      const sub = this.subtitles[i];
      if (sub && currentTime >= sub.start && currentTime < sub.end) {
        activeIndex = i;
        break;
      }
    }

    // Если не нашли в узком диапазоне - ищем по всему массиву
    if (activeIndex === -1) {
      for (let i = 0; i < this.subtitles.length; i++) {
        const sub = this.subtitles[i];
        if (sub && currentTime >= sub.start && currentTime < sub.end) {
          activeIndex = i;
          break;
        }
      }
    }

    // Подсвечиваем только если индекс изменился
    if (activeIndex !== this.currentIndex) {
      this.highlight(activeIndex);
      this.currentIndex = activeIndex;
    }

    // Обновляем karaoke прогресс для текущей активной строки
    if (activeIndex !== -1) {
      this.updateKaraokeProgress(activeIndex, currentTime);
    }
  },

  // Подсветка конкретного элемента
  highlight(index) {
    // Убираем предыдущую подсветку
    const prevActive = document.querySelector('.yt-transcript-item.active-subtitle');
    if (prevActive) {
      prevActive.classList.remove('active-subtitle');
      // Сбрасываем karaoke прогресс
      prevActive.style.setProperty('--karaoke-progress', '0%');
    }

    if (index === -1) return;

    // Добавляем новую подсветку
    const activeElement = document.querySelector(`.yt-transcript-item[data-index="${index}"]`);
    if (activeElement) {
      activeElement.classList.add('active-subtitle');
      // Инициализируем karaoke прогресс
      activeElement.style.setProperty('--karaoke-progress', '0%');

      // Скроллим к активному элементу с throttling
      const now = performance.now();
      if (now - this.lastScrollTime >= this.scrollThrottle) {
        this.scrollToActive(activeElement);
        this.lastScrollTime = now;
      }
    }
  },

  // Обновление karaoke прогресса (плавная анимация заполнения)
  updateKaraokeProgress(index, currentTime) {
    const sub = this.subtitles[index];
    if (!sub) return;

    const duration = sub.end - sub.start;
    if (duration <= 0) return;

    // Вычисляем процент прогресса (0-100)
    const elapsed = currentTime - sub.start;
    const progress = Math.min(100, Math.max(0, (elapsed / duration) * 100));

    // Обновляем CSS переменную для плавной анимации
    const activeElement = document.querySelector(`.yt-transcript-item[data-index="${index}"]`);
    if (activeElement) {
      activeElement.style.setProperty('--karaoke-progress', `${progress}%`);
    }
  },

  // Плавный скроллинг к активному элементу
  scrollToActive(element) {
    if (!element) return;

    const container = document.getElementById('yt-transcript-content');
    if (!container) return;

    const elementRect = element.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    // Проверяем, виден ли элемент
    const isVisible =
      elementRect.top >= containerRect.top &&
      elementRect.bottom <= containerRect.bottom;

    // Скроллим только если элемент не виден
    if (!isVisible) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest'
      });
    }
  }
};

// Функция запуска realtime highlighting (вызывается из displayTranscript)
function startRealtimeHighlighting(subtitles) {
  if (!subtitles || subtitles.length === 0) return;
  realtimeHighlighter.start(subtitles);
}

// Функция остановки realtime highlighting (вызывается при смене видео)
function stopRealtimeHighlighting() {
  realtimeHighlighter.stop();
}

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

// Загрузка сохраненного языка из localStorage
function loadSavedLanguage() {
  const saved = localStorage.getItem('yt-reader-lang');
  if (saved && SUPPORTED_LANGUAGES.find(l => l.code === saved)) {
    transcriptState.selectedLang = saved;
  }
}

// Сохранение выбранного языка
function saveLanguage(langCode) {
  localStorage.setItem('yt-reader-lang', langCode);
  transcriptState.selectedLang = langCode;
}

// Ждем загрузки элемента
function waitForElement(selector, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const element = document.querySelector(selector);
    if (element) {
      return resolve(element);
    }

    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (element) {
        observer.disconnect();
        resolve(element);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error('Element not found'));
    }, timeout);
  });
}

// Получение videoId из URL
function getVideoId() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('v');
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
          <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6 1.41 1.41z"/>
        </svg>
      </button>
    </div>
    <div id="yt-transcript-body" style="display: none;">
      <div class="yt-reader-controls">
        <button id="yt-reader-translate-btn" class="yt-native-switch-btn active">
          Translate Video
        </button>
        <div class="yt-reader-export-container">
          <button id="yt-reader-export-btn" class="yt-reader-export-btn" title="Экспорт субтитров" disabled>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </button>
          <div class="yt-reader-export-dropdown" id="yt-reader-export-dropdown">
            <div class="yt-reader-export-option" data-format="srt">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              <span>SRT</span>
            </div>
            <div class="yt-reader-export-option" data-format="vtt">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              <span>VTT</span>
            </div>
            <div class="yt-reader-export-option" data-format="txt">
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

// Вставка панели в страницу
async function injectPanel() {
  try {
    // Загружаем сохраненный язык
    loadSavedLanguage();

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
        handleExportFormat(option.dataset.format);
      });
    });

    // Закрытие dropdown при клике вне его
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.yt-reader-lang-selector')) {
        langDropdown.classList.remove('show');
        langBtn.classList.remove('active');
      }
      if (!e.target.closest('.yt-reader-export-container')) {
        exportDropdown.classList.remove('show');
      }
    });

    console.log('Панель транскрипта добавлена');
  } catch (error) {
    console.error('Ошибка при вставке панели:', error);
  }
}

// NOTE: All other existing functions remain exactly the same...
// (handleTogglePanel, handleLanguageToggle, handleLanguageSelect, handleExportToggle, etc.)
// For brevity, I'm including only the key modified sections above.
// The rest of the content.js file should remain unchanged from the original.

// ═══════════════════════════════════════════════════════════════════
// INITIALIZATION - Plan detection and panel injection
// ═══════════════════════════════════════════════════════════════════

// Получаем тарифный план пользователя при загрузке расширения
fetchPlan();

// Запускаем вставку панели при загрузке
if (location.href.includes('/watch')) {
  injectPanel();
}
