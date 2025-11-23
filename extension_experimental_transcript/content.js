// ═══════════════════════════════════════════════════════════════════
// EXPERIMENTAL TRANSCRIPT MODULE (Динамический импорт)
// ═══════════════════════════════════════════════════════════════════
// Модуль будет загружен динамически при первом использовании

// Глобальное состояние для предотвращения повторных запросов
const transcriptState = {
  videoId: null,
  isProcessing: false,
  isProcessed: false,
  subtitles: null,
  selectedLang: 'ru' // По умолчанию русский
};

// ═══════════════════════════════════════════════════════════════════
// MESSAGE HANDLERS - Слушаем сообщения от background.js
// ═══════════════════════════════════════════════════════════════════

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

  // Обработка обновления тарифного плана от background.js
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

// Слушаем postMessage от OAuth callback popup (на случай прямого сообщения)
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
  }
});

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

// ═══════════════════════════════════════════════════════════════════
// AUTHORIZATION SYSTEM - Auth UI and handlers
// ═══════════════════════════════════════════════════════════════════

// Открыть страницу авторизации
function openAuthPage() {
  chrome.runtime.sendMessage({ type: 'OPEN_AUTH_PAGE' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('[VideoReader] Ошибка отправки сообщения в background:', chrome.runtime.lastError);
    }
  });
}

// Обновляет UI авторизации на основе наличия токена
async function updateAuthUI() {
  try {
    // Защита от ошибок при получении данных из storage
    let storage = {};
    try {
      storage = await chrome.storage.local.get(['token', 'email', 'plan']);
    } catch (e) {
      console.log('[updateAuthUI] ⚠️ Не удалось получить данные из storage:', e.message);
      return; // Ошибка storage - пропускаем обновление
    }

    const hasToken = !!storage.token;
    const email = storage.email;
    const plan = storage.plan || 'Free';

    console.log('[updateAuthUI] Проверка статуса: hasToken=' + hasToken + ', email=' + email + ', plan=' + plan);

    // Безопасно получаем элементы
    const authSection = document.getElementById('yt-reader-auth-section');
    const authInfo = document.getElementById('yt-reader-auth-info');

    if (!authSection && !authInfo) {
      // Элементы авторизации не найдены - это нормально, если panel еще не создана
      // Просто логируем и возвращаемся без ошибки (не критично)
      console.log('[updateAuthUI] ℹ️ Элементы авторизации еще не загружены в DOM (panel не создана)');
      return;
    }

    if (hasToken && email) {
      // Пользователь авторизован - показываем Auth Info, скрываем Sign In
      console.log('[updateAuthUI] Пользователь авторизован, показываем Auth Info');
      if (authSection) authSection.style.display = 'none';
      if (authInfo) {
        authInfo.style.display = 'block';

        // Обновляем email
        const emailEl = authInfo.querySelector('.yt-reader-auth-email');
        if (emailEl) {
          emailEl.textContent = email;
          console.log('[updateAuthUI] Email обновлен:', email);
        }

        // Обновляем план с data-атрибутом для стилизации
        const planBadge = authInfo.querySelector('.yt-reader-auth-plan-badge');
        const planEl = authInfo.querySelector('.yt-reader-auth-plan');
        if (planBadge && planEl) {
          planBadge.setAttribute('data-plan', plan.toLowerCase());
          planEl.textContent = plan;
          console.log('[updateAuthUI] План обновлен:', plan);
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
      console.log('[updateAuthUI] Пользователь не авторизован, показываем Sign In');
      if (authSection) authSection.style.display = 'block';
      if (authInfo) authInfo.style.display = 'none';
    }
  } catch (error) {
    console.error('[updateAuthUI] Ошибка при обновлении UI:', error);
  }
}

// ═══════════════════════════════════════════════════════════════════
// PLAN DETECTION SYSTEM - Fetch user plan from backend
// ═══════════════════════════════════════════════════════════════════

// Функция получения тарифного плана пользователя
async function fetchPlan() {
  try {
    // Получаем токен из chrome.storage
    const storage = await chrome.storage.local.get(['token']);
    const token = storage.token;

    if (!token) {
      console.log('[VideoReader] Токен отсутствует - пользователь не авторизован');
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
      console.log('[VideoReader] Токен невалиден - пользователь не авторизован');
      await chrome.storage.local.set({ plan: 'Free', email: null });
      return { plan: 'Free', email: null };
    }

    if (data.error) {
      console.warn('[VideoReader] Ошибка при получении плана:', data.error);
      await chrome.storage.local.set({ plan: 'Free', email: null });
      return { plan: 'Free', email: null };
    }

    if (data.status === 'ok' && data.plan && data.email) {
      // Успешный ответ с данными пользователя
      console.log(`[VideoReader] Current plan: ${data.plan} ${data.email}`);

      // Сохраняем в chrome.storage.local
      await chrome.storage.local.set({ plan: data.plan, email: data.email });

      return { plan: data.plan, email: data.email };
    } else {
      // Неожиданный формат ответа
      console.warn('[VideoReader] Неожиданный формат ответа от сервера');
      await chrome.storage.local.set({ plan: 'Free', email: null });
      return { plan: 'Free', email: null };
    }

  } catch (error) {
    // Ошибка сети или сервер недоступен - считаем Free
    console.warn('[VideoReader] Failed to fetch plan from server, defaulting to Free:', error.message);

    // Сохраняем Free plan
    await chrome.storage.local.set({ plan: 'Free', email: null });
    return { plan: 'Free', email: null };

  } finally {
    // Всегда обновляем UI авторизации после проверки плана
    await updateAuthUI();
  }
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

    // Обновляем UI авторизации при загрузке панели
    // Небольшая задержка чтобы гарантировать что DOM полностью готов
    await new Promise(resolve => setTimeout(resolve, 100));
    await updateAuthUI();

    console.log('Панель транскрипта добавлена');
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

  console.log('Выбран язык:', selectedLang.name);
}

// ═══════════════════════════════════════════════════════════════════
// EXPORT SUBTITLE FUNCTIONS - Premium export system
// ═══════════════════════════════════════════════════════════════════

// Обработчик переключения export dropdown
function handleExportToggle(e) {
  e.stopPropagation();
  const exportBtn = document.getElementById('yt-reader-export-btn');
  const exportDropdown = document.getElementById('yt-reader-export-dropdown');

  const isActive = exportDropdown.classList.contains('show');

  if (!isActive) {
    // Рассчитываем позицию dropdown
    const btnRect = exportBtn.getBoundingClientRect();
    exportDropdown.style.top = `${btnRect.bottom + 6}px`;
    exportDropdown.style.right = `${window.innerWidth - btnRect.right}px`;
    exportDropdown.classList.add('show');
  } else {
    exportDropdown.classList.remove('show');
  }
}

// Обновление состояния кнопки экспорта
function updateExportButtonState() {
  const exportBtn = document.getElementById('yt-reader-export-btn');
  if (!exportBtn) return;

  const hasSubtitles = transcriptState.subtitles && transcriptState.subtitles.length > 0;
  const isProcessing = transcriptState.isProcessing;

  // Кнопка активна только если есть субтитры и перевод завершен
  exportBtn.disabled = !hasSubtitles || isProcessing;
}

// Обработчик выбора формата экспорта
function handleExportFormat(format) {
  // Дополнительная проверка (на случай если кнопка не заблокирована)
  if (!transcriptState.subtitles || transcriptState.subtitles.length === 0 || transcriptState.isProcessing) {
    return;
  }

  const videoId = getVideoId();
  const lang = transcriptState.selectedLang;

  // Собираем переведённые субтитры из DOM (не из transcriptState!)
  const translatedSubtitles = collectTranslatedSubtitles();

  if (!translatedSubtitles || translatedSubtitles.length === 0) {
    console.error('No translated subtitles found in DOM');
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
      console.error('Unknown format:', format);
      return;
  }

  // Скачиваем файл
  downloadFile(content, filename, mimeType);

  // Закрываем dropdown
  const exportDropdown = document.getElementById('yt-reader-export-dropdown');
  exportDropdown.classList.remove('show');

  console.log(`Экспортировано: ${filename}`);
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
    console.log('Обработка уже идет');
    return;
  }

  if (transcriptState.isProcessed && transcriptState.videoId === videoId) {
    console.log('Транскрипт уже обработан для этого видео');
    return;
  }

  // Обновляем состояние
  transcriptState.videoId = videoId;
  transcriptState.isProcessing = true;
  transcriptState.isProcessed = false;
  updateExportButtonState(); // Блокируем экспорт

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
    updateExportButtonState(); // Пока перевод идёт - экспорт заблокирован

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
    updateExportButtonState(); // Разблокируем экспорт после завершения
    btn.disabled = false;
    btn.classList.remove('loading', 'translating', 'inactive');
    btn.classList.add('active');
    btn.textContent = 'Translate Video';
  }
}

// Отправка субтитров на сервер и получение переводов построчно
async function translateSubtitles(videoId, subtitles) {
  const SERVER_URL = 'https://api.beem.ink/translate-line';
  const prevContext = [];
  const selectedLang = transcriptState.selectedLang; // Используем выбранный язык
  const MAX_RETRIES = 3;
  const INITIAL_DELAY = 100; // мс между запросами
  const REQUEST_TIMEOUT = 10000; // 10 секунд timeout для одного запроса

  console.log(`Начинаем перевод на ${selectedLang}...`);

  // Функция для fetch с timeout
  async function fetchWithTimeout(url, options, timeout) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  // Функция для одного запроса с retry логикой
  async function translateLineWithRetry(i, subtitle, retryCount = 0) {
    try {
      // Отправляем запрос на перевод одной строки с timeout
      const response = await fetchWithTimeout(SERVER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoId: videoId,
          lineNumber: i,
          text: subtitle.text,
          prevContext: prevContext.slice(-2), // Последние 1-2 переведенные строки
          lang: selectedLang // Используем выбранный язык
        })
      }, REQUEST_TIMEOUT);

      if (!response.ok) {
        console.error(`Ошибка перевода строки ${i}: ${response.status}`);
        prevContext.push(subtitle.text); // Используем оригинал
        return null;
      }

      const data = await response.json();
      const translatedText = data.text;

      // Логируем статус
      if (data.cached) {
        console.log(`[${i}] Cache: ${translatedText}`);
      } else {
        console.log(`[${i}] Translated: ${translatedText}`);
      }

      // Немедленно обновляем UI для этой строки
      updateSingleLine(i, translatedText);

      // Добавляем переведенную строку в контекст
      prevContext.push(translatedText);

      // Задержка только для новых переводов (для cached - нет задержки)
      if (!data.cached) {
        await new Promise(resolve => setTimeout(resolve, INITIAL_DELAY));
      }

      return translatedText;

    } catch (error) {
      // Retry логика
      if (retryCount < MAX_RETRIES) {
        const delay = Math.pow(2, retryCount) * 500; // Экспоненциальная задержка: 500ms, 1s, 2s
        console.warn(`Повторная попытка перевода строки ${i} (${retryCount + 1}/${MAX_RETRIES}) через ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return translateLineWithRetry(i, subtitle, retryCount + 1);
      } else {
        console.error(`Ошибка при переводе строки ${i} (после ${MAX_RETRIES} попыток):`, error.message);
        prevContext.push(subtitle.text); // Используем оригинал в контексте
        return null;
      }
    }
  }

  try {
    // Переводим батчи строк параллельно (4 одновременно)
    const BATCH_SIZE = 4;
    for (let i = 0; i < subtitles.length; i += BATCH_SIZE) {
      const batch = [];

      // Создаем батч с маленькой задержкой между стартами (гарантирует порядок prevContext)
      for (let j = i; j < Math.min(i + BATCH_SIZE, subtitles.length); j++) {
        const subtitle = subtitles[j];
        batch.push(translateLineWithRetry(j, subtitle));

        // 10ms задержка между стартами запросов в батче
        // Это гарантирует, что prevContext будет пополнен в правильном порядке
        if (j < Math.min(i + BATCH_SIZE, subtitles.length) - 1) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }

      // Ждем завершения всего батча перед следующим
      await Promise.all(batch);
    }

    console.log(`Перевод завершен: ${subtitles.length} строк на ${selectedLang}`);

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
// ═══════════════════════════════════════════════════════════════════
// NEW EXPERIMENTAL TRANSCRIPT FUNCTION - NO UI CLICKS
// ═══════════════════════════════════════════════════════════════════
async function getTranscript() {
  console.log('🚀 [EXPERIMENTAL] Получаем транскрипт через новый API...');

  const videoId = getVideoId();
  if (!videoId) {
    console.error('❌ Video ID not found');
    return null;
  }

  try {
    // Динамически импортируем модуль (обходим ограничение Chrome Extensions)
    const transcriptModule = await import(chrome.runtime.getURL('transcript/index.js'));
    const { getTranscript: getTranscriptNew } = transcriptModule;

    // Используем новый модуль без кликов в UI
    const result = await getTranscriptNew(videoId, {
      preferredLanguage: transcriptState.selectedLang || 'en',
      useCache: true
    });

    if (!result || !result.segments || result.segments.length === 0) {
      console.warn('⚠️ No transcript data received');
      return null;
    }

    console.log(`✅ [EXPERIMENTAL] Получено ${result.segments.length} сегментов субтитров`);
    console.log(`📊 Метод: ${result.method}`);
    console.log(`🌍 Доступные языки: ${result.availableLanguages.length}`);

    // Преобразуем в формат, совместимый с текущим кодом
    const subtitles = result.segments.map(segment => ({
      index: segment.index,
      time: formatTimeFromSeconds(segment.start),  // Форматируем время
      text: segment.text,
      start: segment.start,
      end: segment.end
    }));

    return subtitles;

  } catch (error) {
    console.error('❌ [EXPERIMENTAL] Ошибка получения транскрипта:', error);
    console.error('Стек ошибки:', error.stack);
    return null;
  }
}

// Вспомогательная функция для форматирования времени из секунд
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
      console.log('Найдена кнопка транскрипта');
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
function resetState() {
  // Останавливаем realtime highlighting
  stopRealtimeHighlighting();

  transcriptState.videoId = null;
  transcriptState.isProcessing = false;
  transcriptState.isProcessed = false;
  transcriptState.subtitles = null;

  // Блокируем экспорт при сбросе
  updateExportButtonState();
}

// Отслеживание изменений URL
let currentUrl = location.href;
new MutationObserver(() => {
  if (location.href !== currentUrl) {
    currentUrl = location.href;
    if (currentUrl.includes('/watch')) {
      // Сбрасываем состояние
      resetState();

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
