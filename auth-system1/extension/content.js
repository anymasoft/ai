// ═══════════════════════════════════════════════════════════════════
// TOKEN AUTH - Listen for messages from background.js and OAuth callback
// ═══════════════════════════════════════════════════════════════════


// ОТЛАДКА: Проверяем что находится в storage при загрузке
chrome.storage.local.get(['token', 'email', 'plan'], (result) => {
  if (result.token) {
  } else {
  }
});

// ГЛАВНЫЙ ОБРАБОТЧИК: Слушаем сообщения от background.js через chrome.runtime.onMessage
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  // Обрабатываем AUTH_SUCCESS от background.js
  if (message.type === 'AUTH_SUCCESS') {

    const token = message.token;
    const email = message.email;

    // Сохраняем токен и email в chrome.storage.local
    if (token && email) {

      chrome.storage.local.set({ token: token, email: email }, async () => {

        // Сразу после получения токена запрашиваем план
        await fetchPlan();

        // Обновляем UI авторизации
        await updateAuthUI();
      });

      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'Missing token or email' });
    }

    return true; // Асинхронный ответ
  }

  // ═══════════════════════════════════════════════════════════════════
  // HOT-RELOAD: Обработка обновления тарифного плана от background.js
  // ═══════════════════════════════════════════════════════════════════
  if (message.type === 'PLAN_UPDATED') {

    const newPlan = message.newPlan;

    // Обновляем план в chrome.storage.local
    chrome.storage.local.set({ plan: newPlan }, async () => {

      // Обновляем план с сервера (для синхронизации)
      await fetchPlan();

      // Обновляем UI панели
      await updateAuthUI();

    });

    sendResponse({ success: true });
    return true; // Асинхронный ответ
  }

  // Неизвестный тип сообщения
  sendResponse({ success: false, error: 'Unknown message type' });
  return false;
});


// ДОПОЛНИТЕЛЬНЫЙ ОБРАБОТЧИК: Слушаем postMessage от OAuth callback popup (на случай прямого сообщения)
window.addEventListener('message', async (event) => {

  // Проверяем тип сообщения
  if (event.data && event.data.type === 'AUTH_SUCCESS') {

    const token = event.data.token;
    const email = event.data.email;


    // Сохраняем токен и email в chrome.storage.local
    if (token && email) {

      await chrome.storage.local.set({ token: token, email: email });

      // Сразу после получения токена запрашиваем план
      await fetchPlan();

      // Обновляем UI авторизации
      await updateAuthUI();
    }
  } else {
  }
});


// ═══════════════════════════════════════════════════════════════════
// PLAN DETECTION SYSTEM - Fetch user plan from backend with Bearer token
// ═══════════════════════════════════════════════════════════════════

// Функция получения тарифного плана пользователя
async function fetchPlan() {
  try {
    // Получаем токен из chrome.storage
    const storage = await chrome.storage.local.get(['token']);
    const token = storage.token;

    if (!token) {
      await chrome.storage.local.set({ plan: 'Free', email: null });
      return { plan: 'Free', email: null };
    }

    // Отправляем запрос через background.js (чтобы избежать CORS)
    const data = await chrome.runtime.sendMessage({
      type: 'FETCH_PLAN',
      token: token
    });

    // Обрабатываем ошибки
    if (data.error === 'unauthorized') {
      await chrome.storage.local.set({ plan: 'Free', email: null });
      return { plan: 'Free', email: null };
    }

    if (data.error) {
      await chrome.storage.local.set({ plan: 'Free', email: null });
      return { plan: 'Free', email: null };
    }

    if (data.status === 'ok' && data.plan && data.email) {

      // Сохраняем в chrome.storage.local
      await chrome.storage.local.set({ plan: data.plan, email: data.email });

      return { plan: data.plan, email: data.email };
    } else {
      // Неожиданный формат ответа
      await chrome.storage.local.set({ plan: 'Free', email: null });
      return { plan: 'Free', email: null };
    }

  } catch (error) {
    // Ошибка сети или сервер недоступен - считаем Free
    console.error('[VideoReader] ❌ fetch /api/plan failed:', error);

    // Сохраняем Free plan
    await chrome.storage.local.set({ plan: 'Free', email: null });
    return { plan: 'Free', email: null };
  } finally {
    // Всегда обновляем UI авторизации после проверки плана
    await updateAuthUI();
  }
}

// Открывает страницу авторизации через background.js
function openAuthPage() {
  chrome.runtime.sendMessage({ type: 'OPEN_AUTH_PAGE' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('[VideoReader] Ошибка отправки сообщения в background:', chrome.runtime.lastError);
    } else {
    }
  });
}

// Обновляет UI авторизации на основе наличия токена
async function updateAuthUI() {
  const storage = await chrome.storage.local.get(['token', 'email', 'plan']);
  const hasToken = !!storage.token;
  const email = storage.email;
  const plan = storage.plan || 'Free';

  const authSection = document.getElementById('yt-reader-auth-section');
  const authInfo = document.getElementById('yt-reader-auth-info');

  if (hasToken && email) {
    // Пользователь авторизован - показываем Auth Info, скрываем Sign In
    if (authSection) authSection.style.display = 'none';
    if (authInfo) {
      authInfo.style.display = 'block';

      // Обновляем email
      const emailEl = authInfo.querySelector('.yt-reader-auth-email');
      if (emailEl) {
        emailEl.textContent = email;
      }

      // Обновляем план с data-атрибутом для стилизации
      const planBadge = authInfo.querySelector('.yt-reader-auth-plan-badge');
      const planEl = authInfo.querySelector('.yt-reader-auth-plan');
      if (planBadge && planEl) {
        planBadge.setAttribute('data-plan', plan.toLowerCase());
        planEl.textContent = plan;
      }

      // Обновляем кнопку Upgrade в зависимости от плана
      const upgradeBtn = document.getElementById('yt-reader-upgrade-btn');
      if (upgradeBtn) {
        if (plan === 'Free') {
          upgradeBtn.style.display = 'block';
          upgradeBtn.textContent = 'Upgrade';
        } else if (plan === 'Pro') {
          upgradeBtn.style.display = 'block';
          upgradeBtn.textContent = 'Upgrade to Premium';
        } else if (plan === 'Premium') {
          upgradeBtn.style.display = 'none';
        } else {
          // На случай неизвестного плана - показываем кнопку Upgrade
          upgradeBtn.style.display = 'block';
          upgradeBtn.textContent = 'Upgrade';
        }
      }
    }
  } else {
    // Пользователь не авторизован - показываем Sign In, скрываем Auth Info
    if (authSection) authSection.style.display = 'block';
    if (authInfo) authInfo.style.display = 'none';
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
      return;
    }

    this.subtitles = subtitles;
    this.currentIndex = -1;
    this.isActive = true;


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
      <!-- Sign In Section -->
      <div class="yt-reader-auth-section" id="yt-reader-auth-section" style="display: none;">
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
        <div class="yt-reader-export-container">
          <button id="yt-reader-export-btn" class="yt-reader-export-btn" disabled>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </button>
          <div class="yt-reader-export-dropdown" id="yt-reader-export-dropdown">
            <div class="yt-reader-export-section-title">Original Subtitles</div>
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

            <div class="yt-reader-export-section-title">Translated Subtitles (Premium)</div>
            <div class="yt-reader-export-option" data-format="srt" data-type="translated">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M5 8h14M5 8a2 2 0 0 1 0-4h14a2 2 0 0 1 0 4M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8m-9 4h2m-1 0v6"/>
              </svg>
              <span>SRT</span>
            </div>
            <div class="yt-reader-export-option" data-format="vtt" data-type="translated">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M5 8h14M5 8a2 2 0 0 1 0-4h14a2 2 0 0 1 0 4M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8m-9 4h2m-1 0v6"/>
              </svg>
              <span>VTT</span>
            </div>
            <div class="yt-reader-export-option" data-format="txt" data-type="translated">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M5 8h14M5 8a2 2 0 0 1 0-4h14a2 2 0 0 1 0 4M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8m-9 4h2m-1 0v6"/>
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
    const signInBtn = document.getElementById('yt-reader-signin-btn');

      translateBtn: !!translateBtn,
      toggleBtn: !!toggleBtn,
      langBtn: !!langBtn
    });

    if (!translateBtn) {
    } else {
      translateBtn.addEventListener('click', handleGetTranscript);
    }

    toggleBtn.addEventListener('click', handleTogglePanel);
    langBtn.addEventListener('click', handleLanguageToggle);

    // Обработчик для кнопки Sign In
    if (signInBtn) {
      signInBtn.addEventListener('click', () => {
        openAuthPage();
      });
    }

    // Обработчик для кнопки Upgrade
    const upgradeBtn = document.getElementById('yt-reader-upgrade-btn');
    if (upgradeBtn) {
      upgradeBtn.addEventListener('click', () => {
        window.open('http://localhost:5000/pricing', '_blank');
      });
    }

    // Обработчик для кнопки Log out
    const logoutBtn = document.getElementById('yt-reader-logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {

        // Удаляем токен и email из chrome.storage
        await chrome.storage.local.remove(['token', 'email', 'plan']);

        // Обновляем UI
        await updateAuthUI();
      });
    }

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
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.yt-reader-lang-selector')) {
        langDropdown.classList.remove('show');
        langBtn.classList.remove('active');
      }
      if (!e.target.closest('.yt-reader-export-container')) {
        exportDropdown.classList.remove('show');
      }
    });

    // Обновляем UI авторизации на основе текущего состояния
    await updateAuthUI();

  } catch (error) {
    console.error('Ошибка при вставке панели:', error);
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
        <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6 1.41 1.41z"/>
      </svg>
    `;
  } else {
    body.style.display = 'block';
    toggleBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
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

  // Сохраняем выбранный язык
  saveLanguage(langCode);

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

}

// ═══════════════════════════════════════════════════════════════════
// EXPORT SUBTITLE FUNCTIONS - Premium export system
// ═══════════════════════════════════════════════════════════════════

// Обработчик переключения export dropdown
async function handleExportToggle(e) {
  e.stopPropagation();
  const exportBtn = document.getElementById('yt-reader-export-btn');
  const exportDropdown = document.getElementById('yt-reader-export-dropdown');

  const isActive = exportDropdown.classList.contains('show');

  if (!isActive) {
    // Обновляем состояние опций перед открытием
    await updateExportDropdownState();

    // Рассчитываем позицию dropdown
    const btnRect = exportBtn.getBoundingClientRect();
    exportDropdown.style.top = `${btnRect.bottom + 6}px`;
    exportDropdown.style.right = `${window.innerWidth - btnRect.right}px`;
    exportDropdown.classList.add('show');
  } else {
    exportDropdown.classList.remove('show');
  }
}

// Обновление состояния опций экспорта в dropdown
async function updateExportDropdownState() {
  const userPlan = await getUserPlan();
  const translatedOptions = document.querySelectorAll('.yt-reader-export-option[data-type="translated"]');

  translatedOptions.forEach(option => {
    if (userPlan !== 'Premium') {
      option.classList.add('locked');
      option.setAttribute('data-tooltip', 'Upgrade to Premium');
    } else {
      option.classList.remove('locked');
      option.removeAttribute('data-tooltip');
    }
  });
}

// Обновление состояния кнопки экспорта
async function updateExportButtonState() {
  const exportBtn = document.getElementById('yt-reader-export-btn');
  if (!exportBtn) return;

  const hasSubtitles = transcriptState.subtitles && transcriptState.subtitles.length > 0;
  const isProcessing = transcriptState.isProcessing;
  const userPlan = await getUserPlan();

  // Кнопка активна только для Premium и если есть субтитры и перевод завершен
  const isPremium = userPlan === 'Premium';
  exportBtn.disabled = !hasSubtitles || isProcessing || !isPremium;

  // Устанавливаем tooltip в зависимости от состояния
  if (!isPremium) {
    exportBtn.title = 'Available for Premium only';
  } else if (isProcessing) {
    exportBtn.title = 'Processing...';
  } else if (!hasSubtitles) {
    exportBtn.title = 'No subtitles available';
  } else {
    exportBtn.title = 'Export subtitles';
  }
}

// Экспорт оригинальных (непереведённых) субтитров
function exportOriginalSubtitles(format) {
  const videoId = getVideoId();
  const originalSubtitles = transcriptState.subtitles;

  if (!originalSubtitles || originalSubtitles.length === 0) {
    return;
  }

  let content, filename, mimeType;

  switch (format) {
    case 'srt':
      content = generateSRT(originalSubtitles);
      filename = `${videoId}_original.srt`;
      mimeType = 'text/plain;charset=utf-8';
      break;
    case 'vtt':
      content = generateVTT(originalSubtitles);
      filename = `${videoId}_original.vtt`;
      mimeType = 'text/vtt;charset=utf-8';
      break;
    case 'txt':
      content = generateTXT(originalSubtitles);
      filename = `${videoId}_original.txt`;
      mimeType = 'text/plain;charset=utf-8';
      break;
    default:
      return;
  }

  downloadFile(content, filename, mimeType);
}

// Экспорт переведённых субтитров (Premium-only)
function exportTranslatedSubtitles(format) {
  const videoId = getVideoId();
  const lang = transcriptState.selectedLang;

  // Собираем переведённые субтитры из DOM
  const translatedSubtitles = collectTranslatedSubtitles();

  if (!translatedSubtitles || translatedSubtitles.length === 0) {
    return;
  }

  let content, filename, mimeType;

  switch (format) {
    case 'srt':
      content = generateSRT(translatedSubtitles);
      filename = `${videoId}_${lang}_translated.srt`;
      mimeType = 'text/plain;charset=utf-8';
      break;
    case 'vtt':
      content = generateVTT(translatedSubtitles);
      filename = `${videoId}_${lang}_translated.vtt`;
      mimeType = 'text/vtt;charset=utf-8';
      break;
    case 'txt':
      content = generateTXT(translatedSubtitles);
      filename = `${videoId}_${lang}_translated.txt`;
      mimeType = 'text/plain;charset=utf-8';
      break;
    default:
      return;
  }

  downloadFile(content, filename, mimeType);
}

// Обработчик выбора формата экспорта
function handleExportFormat(format, type) {
  // Проверяем наличие субтитров
  if (!transcriptState.subtitles || transcriptState.subtitles.length === 0 || transcriptState.isProcessing) {
    return;
  }

  // Закрываем dropdown после выбора
  const exportDropdown = document.getElementById('yt-reader-export-dropdown');
  exportDropdown.classList.remove('show');

  // Роутинг по типу экспорта
  if (type === 'original') {
    exportOriginalSubtitles(format);
  } else if (type === 'translated') {
    exportTranslatedSubtitles(format);
  }
}

// Сбор переведённых субтитров из DOM
function collectTranslatedSubtitles() {
  const items = document.querySelectorAll('.yt-transcript-item');
  const subtitles = [];

  items.forEach(item => {
    const start = parseFloat(item.dataset.start);
    const end = parseFloat(item.dataset.end);
    const textElement = item.querySelector('.yt-transcript-item-text');
    const text = textElement ? textElement.textContent.trim() : '';

    if (text) {
      subtitles.push({ start, end, text });
    }
  });

  return subtitles;
}

// Генерация SRT формата
function generateSRT(subtitles) {
  let srt = '';

  subtitles.forEach((sub, index) => {
    // Номер субтитра (начинается с 1)
    srt += `${index + 1}\n`;

    // Таймкоды в формате SRT: 00:01:21,450 --> 00:01:24,120
    const startTime = formatSRTTime(sub.start);
    const endTime = formatSRTTime(sub.end);
    srt += `${startTime} --> ${endTime}\n`;

    // Текст субтитра
    srt += `${sub.text}\n\n`;
  });

  return srt;
}

// Генерация VTT формата
function generateVTT(subtitles) {
  let vtt = 'WEBVTT\n\n';

  subtitles.forEach((sub, index) => {
    // Таймкоды в формате VTT: 00:01:24.120 --> 00:01:27.480
    const startTime = formatVTTTime(sub.start);
    const endTime = formatVTTTime(sub.end);
    vtt += `${startTime} --> ${endTime}\n`;

    // Текст субтитра
    vtt += `${sub.text}\n\n`;
  });

  return vtt;
}

// Генерация TXT формата (только текст)
function generateTXT(subtitles) {
  return subtitles.map(sub => sub.text).join('\n');
}

// Форматирование времени для SRT (00:01:21,450)
function formatSRTTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 1000);

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
}

// Форматирование времени для VTT (00:01:24.120)
function formatVTTTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 1000);

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

// Скачивание файла
function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Получить план пользователя через API
async function getUserPlan() {
  try {
    const storage = await chrome.storage.local.get(['token']);
    const token = storage.token;

    if (!token) {
      return 'Free'; // Нет токена = Free план
    }

    const response = await fetch('http://localhost:5000/api/plan', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      return data.plan || 'Free';
    }

    return 'Free';
  } catch (error) {
    console.error('[getUserPlan] Ошибка:', error);
    return 'Free';
  }
}

// Удалить кнопки Upgrade из DOM
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

// Найти индекс последней переведенной строки
function findLastTranslatedIndex() {
  const allItems = document.querySelectorAll('.yt-transcript-item');
  let lastIndex = -1;

  allItems.forEach((item, idx) => {
    const textElement = item.querySelector('.yt-transcript-item-text');
    if (textElement && textElement.textContent.trim() !== '') {
      const index = parseInt(item.getAttribute('data-index'));
      if (!isNaN(index) && index > lastIndex) {
        lastIndex = index;
      }
    }
  });

  return lastIndex;
}

// Обработчик нажатия кнопки получения транскрипта
async function handleGetTranscript() {

  const btn = document.getElementById('yt-reader-translate-btn');
  const content = document.getElementById('yt-transcript-content');
  const videoId = getVideoId();


  if (!videoId) {
    content.innerHTML = `
      <div class="yt-transcript-error">
        Не удалось получить ID видео
      </div>
    `;
    return;
  }

  // Проверяем состояние
  if (transcriptState.isProcessing) {
    return;
  }

  // Проверяем план пользователя
  const userPlan = await getUserPlan();

  // Если видео уже обработано
  if (transcriptState.isProcessed && transcriptState.videoId === videoId) {
    // Для Premium/Pro - проверяем, есть ли непереведенные строки
    if (userPlan === 'Premium' || userPlan === 'Pro') {
      const lastTranslatedIndex = findLastTranslatedIndex();

      // Если есть непереведенные строки - продолжаем перевод
      if (lastTranslatedIndex >= 0) {

        // Удаляем кнопки Upgrade
        removeUpgradeButtons();

        // НЕ сбрасываем transcriptState.isProcessed - будет сброшен в конце
        transcriptState.isProcessing = true;

        // Получаем субтитры и продолжаем перевод
        const subtitles = await getTranscript();
        if (subtitles && subtitles.length > lastTranslatedIndex + 1) {
          await translateSubtitles(videoId, subtitles, lastTranslatedIndex + 1);
        }

        transcriptState.isProcessing = false;
        transcriptState.isProcessed = true;
        return;
      }
    }

    // Для Free или если все уже переведено - выходим
    return;
  }

  // Обновляем состояние
  transcriptState.videoId = videoId;
  transcriptState.isProcessing = true;
  transcriptState.isProcessed = false;
  await updateExportButtonState(); // Блокируем экспорт

  // Блокируем кнопку и показываем loading
  btn.disabled = true;
  btn.classList.remove('active');
  btn.classList.add('inactive', 'loading');
  btn.textContent = 'Loading...';

  // Показываем лоадер
  content.innerHTML = `
    <div class="yt-transcript-loader">
      <div class="yt-transcript-loader-spinner"></div>
      <span class="yt-transcript-loader-text">Загрузка транскрипта...</span>
    </div>
  `;

  try {
    const subtitles = await getTranscript();

    // Если getTranscript вернул null - субтитры недоступны для этого видео
    if (subtitles === null) {
      content.innerHTML = `
        <div class="yt-transcript-no-subtitles">
          <div class="yt-no-subtitles-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <line x1="7" y1="10" x2="7.01" y2="10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              <line x1="12" y1="10" x2="12.01" y2="10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              <line x1="17" y1="10" x2="17.01" y2="10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </div>
          <div class="yt-no-subtitles-title">Субтитры недоступны</div>
          <div class="yt-no-subtitles-description">
            Для этого видео YouTube не предоставляет текст. Возможно, автор не добавил субтитры или не включил автоматическую транскрипцию.
          </div>
        </div>
      `;
      transcriptState.isProcessing = false;
      return;
    }

    if (!subtitles || subtitles.length === 0) {
      content.innerHTML = `
        <div class="yt-transcript-empty">
          Субтитры не найдены для этого видео
        </div>
      `;
      transcriptState.isProcessing = false;
      return;
    }

    // Сохраняем оригинальные субтитры
    transcriptState.subtitles = subtitles;

    // Отображаем оригинальные субтитры сразу
    displayTranscript(subtitles);
    await updateExportButtonState(); // Пока перевод идёт - экспорт заблокирован


    // Отправляем на сервер для перевода
    btn.classList.add('translating');
    btn.classList.remove('loading');
    btn.textContent = 'AI is translating...';

    await translateSubtitles(videoId, subtitles);

    transcriptState.isProcessed = true;

  } catch (error) {
    console.error('Ошибка при получении транскрипта:', error);
    content.innerHTML = `
      <div class="yt-transcript-error">
        Ошибка при загрузке транскрипта: ${error.message}
      </div>
    `;
  } finally {
    transcriptState.isProcessing = false;
    await updateExportButtonState(); // Разблокируем экспорт после завершения
    btn.disabled = false;
    btn.classList.remove('loading', 'translating', 'inactive');
    btn.classList.add('active');
    btn.textContent = 'Translate Video';
  }
}

// Получить план пользователя через API
async function getUserPlan() {
  try {
    const storage = await chrome.storage.local.get(['token']);
    const token = storage.token;

    if (!token) {
      return 'Free'; // Нет токена = Free план
    }

    const response = await fetch('http://localhost:5000/api/plan', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      return data.plan || 'Free';
    }

    return 'Free';
  } catch (error) {
    console.error('[getUserPlan] Ошибка:', error);
    return 'Free';
  }
}

// Отправка субтитров на сервер и получение переводов построчно
async function translateSubtitles(videoId, subtitles, startIndex = 0) {
  const prevContext = [];
  const selectedLang = transcriptState.selectedLang; // Используем выбранный язык
  const totalLines = subtitles.length;

  if (startIndex > 0) {
  } else {
  }

  // Получаем токен для отправки на сервер
  const storage = await chrome.storage.local.get(['token']);
  const token = storage.token || null;

  // Получаем план пользователя для определения размера контекста
  const userPlan = await getUserPlan();

  // Определяем размер контекста по плану
  const contextSize = userPlan === 'Premium' ? 10 : (userPlan === 'Pro' ? 5 : 2);

  try {
    // Переводим каждую строку по очереди (начиная с startIndex)
    for (let i = startIndex; i < subtitles.length; i++) {
      const subtitle = subtitles[i];

      try {

        const requestBody = {
          videoId: videoId,
          lineNumber: i,
          text: subtitle.text,
          prevContext: prevContext.slice(-contextSize), // Динамический размер контекста по плану
          lang: selectedLang, // Используем выбранный язык
          totalLines: totalLines, // Передаём общее количество строк для расчёта лимита
          token: token // Передаём токен для определения плана
        };

        // Отправляем запрос на перевод через background.js (обход AdBlock)
        const data = await chrome.runtime.sendMessage({
          type: 'TRANSLATE_LINE',
          videoId: requestBody.videoId,
          lineNumber: requestBody.lineNumber,
          text: requestBody.text,
          prevContext: requestBody.prevContext,
          lang: requestBody.lang,
          totalLines: requestBody.totalLines,
          token: requestBody.token
        });

        // DEBUG-ЛОГИРОВАНИЕ (как просил пользователь)
          lineNumber: data.lineNumber,
          len: data.text ? data.text.length : 0,
          text: data.text,
          limited: data.limited,
          stop: data.stop,
          plan: data.plan
        });


        if (data.error) {
          console.error(`❌ Ошибка перевода строки ${i}: ${data.error}`);
          prevContext.push(subtitle.text); // Используем оригинал
          continue;
        }

        // ═══════════════════════════════════════════════════════════════════
        // ОБРАБОТКА STOP - остановка перевода при достижении лимита Free
        // ═══════════════════════════════════════════════════════════════════

        if (data.stop === true) {

          // Добавляем визуальный маркер сразу после последней переведенной строки
          const lastTranslatedIndex = i - 1; // Предыдущая строка была последней переведенной
          const lastItem = document.querySelector(`[data-index="${lastTranslatedIndex}"]`);

          if (lastItem) {
            // Добавляем яркий маркер сразу после последней переведенной строки
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
              window.open('http://localhost:5000/pricing', '_blank');
            });

            lastItem.insertAdjacentElement('afterend', marker);
          }

          // Показываем CTA для Upgrade
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
                window.open('http://localhost:5000/pricing', '_blank');
              });
            }
          }

          // ОСТАНАВЛИВАЕМ цикл перевода
          break;
        }

        const translatedText = data.text;

        // Логируем статус
        if (data.cached) {
        } else {
        }

        // Немедленно обновляем UI для этой строки ПОЛНЫМ текстом (без обрезки)
        updateSingleLine(i, translatedText);

        // Добавляем переведенную строку в контекст
        prevContext.push(translatedText);

        // Небольшая задержка для плавности (не обязательно для кешированных)
        if (!data.cached) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }

      } catch (error) {
        console.error(`❌❌❌ EXCEPTION на строке i=${i}:`, error);
        console.error(`Subtitle на момент ошибки:`, subtitle);
        console.error(`prevContext:`, prevContext);
        prevContext.push(subtitle.text); // Используем оригинал в контексте
      }
    }


  } catch (error) {
    console.error('Общая ошибка при переводе:', error);
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

// Получение транскрипта
async function getTranscript() {

  // Ищем кнопку "Show transcript"
  const transcriptButton = await findTranscriptButton();

  if (!transcriptButton) {
    // Кнопка транскрипта не найдена - субтитры недоступны для этого видео
    return null;
  }

  // Проверяем, не открыт ли уже транскрипт
  let isOpen = transcriptButton.getAttribute('aria-pressed') === 'true';

  // Функция для получения элементов с retry
  async function getTranscriptItems(retryCount = 0) {
    const maxRetries = 3;

    // Если панель не открыта или это retry, открываем/переоткрываем
    if (!isOpen || retryCount > 0) {
      // Если это retry и панель была открыта, сначала закрываем
      if (retryCount > 0 && isOpen) {
        transcriptButton.click();
        await new Promise(resolve => setTimeout(resolve, 500));
        isOpen = false;
      }

      // Открываем панель
      transcriptButton.click();
      isOpen = true;

      // Ждем появления элементов
      try {
        await waitForElement('ytd-transcript-segment-renderer', 5000);
      } catch (e) {
      }

      // Дополнительная задержка для полной загрузки
      await new Promise(resolve => setTimeout(resolve, 1000));
    } else {
      // Панель уже открыта, просто ждем загрузки элементов
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Ищем элементы транскрипта
    const transcriptItems = document.querySelectorAll('ytd-transcript-segment-renderer');

    // Если элементы не найдены и есть попытки retry
    if (transcriptItems.length === 0 && retryCount < maxRetries) {
      return getTranscriptItems(retryCount + 1);
    }

    return transcriptItems;
  }

  // Получаем элементы с retry
  const transcriptItems = await getTranscriptItems();

  if (transcriptItems.length === 0) {
    throw new Error('Элементы транскрипта не найдены после нескольких попыток');
  }

  const subtitles = [];
  transcriptItems.forEach((item, index) => {
    const timeElement = item.querySelector('.segment-timestamp');
    const textElement = item.querySelector('yt-formatted-string.segment-text');

    if (textElement) {
      const text = textElement.textContent.trim();
      const timeText = timeElement?.textContent.trim() || '';

      // ОТЛАДКА: логируем первые 5 строк
      if (index < 5) {
      }

      // Извлекаем точное время start в секундах из атрибута
      let startSeconds = 0;
      const startAttr = item.getAttribute('start-offset');
      if (startAttr) {
        startSeconds = parseFloat(startAttr) / 1000; // YouTube хранит в миллисекундах
      } else {
        // Fallback: парсим из текстового времени
        startSeconds = parseTimeToSeconds(timeText);
      }

      // Вычисляем end как start следующего элемента или добавляем ~5 секунд
      let endSeconds = startSeconds + 5;

      subtitles.push({
        index: index,
        time: timeText,
        text: text,
        start: startSeconds,
        end: endSeconds // Будет обновлено позже
      });
    }
  });

  // Обновляем end для каждого элемента (равен start следующего)
  for (let i = 0; i < subtitles.length - 1; i++) {
    subtitles[i].end = subtitles[i + 1].start;
  }

  // Закрываем панель транскрипта если мы её открывали
  if (isOpen) {
    transcriptButton.click();
  }

  return subtitles;
}

// Парсинг времени из строки "0:00", "1:23", "12:34:56" в секунды
function parseTimeToSeconds(timeStr) {
  const parts = timeStr.split(':').reverse();
  const seconds = parseInt(parts[0] || 0) +
                 parseInt(parts[1] || 0) * 60 +
                 parseInt(parts[2] || 0) * 3600;
  return seconds;
}

// Поиск кнопки транскрипта
async function findTranscriptButton() {
  // Ждем загрузки кнопок
  await waitForElement('#description ytd-video-description-transcript-section-renderer', 5000).catch(() => null);

  const selectors = [
    '#description ytd-video-description-transcript-section-renderer button[aria-label*="transcript" i]',
    '#description ytd-video-description-transcript-section-renderer button[aria-label*="текст" i]',
    'ytd-video-description-transcript-section-renderer button',
  ];

  for (const selector of selectors) {
    const btn = document.querySelector(selector);
    if (btn) {
      return btn;
    }
  }

  return null;
}

// Отображение транскрипта
function displayTranscript(subtitles) {
  const content = document.getElementById('yt-transcript-content');

  content.innerHTML = subtitles.map(sub => `
    <div class="yt-transcript-item"
         data-time="${sub.time}"
         data-index="${sub.index}"
         data-start="${sub.start}"
         data-end="${sub.end}">
      <div class="yt-transcript-item-time">${sub.time}</div>
      <div class="yt-transcript-item-text">${sub.text}</div>
    </div>
  `).join('');

  // Добавляем клик по элементу для перехода к времени
  content.querySelectorAll('.yt-transcript-item').forEach(item => {
    item.addEventListener('click', () => {
      const time = item.dataset.time;
      seekToTime(time);
    });
  });

  // Запускаем realtime highlighting
  startRealtimeHighlighting(subtitles);
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

// Сброс состояния при смене видео
async function resetState() {
  // Останавливаем realtime highlighting
  stopRealtimeHighlighting();

  transcriptState.videoId = null;
  transcriptState.isProcessing = false;
  transcriptState.isProcessed = false;
  transcriptState.subtitles = null;

  // Блокируем экспорт при сбросе
  await updateExportButtonState();
}

// Отслеживание изменений URL
let currentUrl = location.href;
new MutationObserver(async () => {
  if (location.href !== currentUrl) {
    currentUrl = location.href;
    if (currentUrl.includes('/watch')) {
      // Сбрасываем состояние
      await resetState();

      // Удаляем старую панель
      const oldPanel = document.getElementById('yt-transcript-panel');
      if (oldPanel) {
        oldPanel.remove();
      }
      // Вставляем новую через таймаут
      setTimeout(injectPanel, 1500);
    }
  }
}).observe(document.body, { childList: true, subtree: true });

// ═══════════════════════════════════════════════════════════════════
// INITIALIZATION - Plan detection and panel injection
// ═══════════════════════════════════════════════════════════════════

// Получаем тарифный план пользователя при загрузке расширения
fetchPlan();

// Запускаем вставку панели при загрузке
if (location.href.includes('/watch')) {
  injectPanel();
}
