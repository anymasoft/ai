// ═══════════════════════════════════════════════════════════════════
// TOKEN AUTH - Listen for messages from background.js and OAuth callback
// ═══════════════════════════════════════════════════════════════════

console.log('[VideoReader content.js] Скрипт загружен');

// ОТЛАДКА: Проверяем что находится в storage при загрузке
chrome.storage.local.get(['token', 'email', 'plan'], (result) => {
  console.log('[VideoReader content.js] 🔍 Storage при загрузке:', result);
  if (result.token) {
    console.log('[VideoReader content.js] ✅ Токен найден:', result.token.substring(0, 8) + '...');
  } else {
    console.log('[VideoReader content.js] ❌ Токен НЕ найден в storage');
  }
});

// ГЛАВНЫЙ ОБРАБОТЧИК: Слушаем сообщения от background.js через chrome.runtime.onMessage
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[VideoReader content.js] ✅ Получено сообщение через chrome.runtime.onMessage');
  console.log('[VideoReader content.js] message:', message);
  console.log('[VideoReader content.js] sender:', sender);

  // Обрабатываем AUTH_SUCCESS от background.js
  if (message.type === 'AUTH_SUCCESS') {
    console.log('[VideoReader content.js] 🎉 AUTH_SUCCESS получен!');
    console.log('[VideoReader content.js] Token:', message.token?.substring(0, 8) + '...');
    console.log('[VideoReader content.js] Email:', message.email);

    const token = message.token;
    const email = message.email;

    // Сохраняем токен и email в chrome.storage.local
    if (token && email) {
      console.log('[VideoReader content.js] Сохраняем токен и email в storage...');

      chrome.storage.local.set({ token: token, email: email }, async () => {
        console.log('[VideoReader content.js] ✅ Токен и email сохранены в chrome.storage');

        // Сразу после получения токена запрашиваем план
        console.log('[VideoReader content.js] Запрашиваем план пользователя...');
        await fetchPlan();

        // Обновляем UI авторизации
        console.log('[VideoReader content.js] Обновляем UI авторизации...');
        await updateAuthUI();
        console.log('[VideoReader content.js] ✅ UI авторизации обновлён после получения токена');
      });

      sendResponse({ success: true });
    } else {
      console.error('[VideoReader content.js] ❌ Токен или email отсутствуют в сообщении!');
      sendResponse({ success: false, error: 'Missing token or email' });
    }

    return true; // Асинхронный ответ
  }

  // ═══════════════════════════════════════════════════════════════════
  // HOT-RELOAD: Обработка обновления тарифного плана от background.js
  // ═══════════════════════════════════════════════════════════════════
  if (message.type === 'PLAN_UPDATED') {
    console.log('[VideoReader content.js] 🔄 PLAN_UPDATED получен!');
    console.log('[VideoReader content.js] Новый план:', message.newPlan);
    console.log('[VideoReader content.js] Email:', message.email);

    const newPlan = message.newPlan;

    // Обновляем план в chrome.storage.local
    chrome.storage.local.set({ plan: newPlan }, async () => {
      console.log('[VideoReader content.js] ✅ План обновлен в storage:', newPlan);

      // Обновляем план с сервера (для синхронизации)
      console.log('[VideoReader content.js] Синхронизируем план с сервером...');
      await fetchPlan();

      // Обновляем UI панели
      console.log('[VideoReader content.js] Обновляем UI...');
      await updateAuthUI();

      console.log('[VideoReader content.js] ✅ UI обновлён БЕЗ перезагрузки страницы!');
    });

    sendResponse({ success: true });
    return true; // Асинхронный ответ
  }

  // Неизвестный тип сообщения
  console.log('[VideoReader content.js] Неизвестный тип сообщения:', message.type);
  sendResponse({ success: false, error: 'Unknown message type' });
  return false;
});

console.log('[VideoReader content.js] ✅ Обработчик chrome.runtime.onMessage установлен');

// ДОПОЛНИТЕЛЬНЫЙ ОБРАБОТЧИК: Слушаем postMessage от OAuth callback popup (на случай прямого сообщения)
window.addEventListener('message', async (event) => {
  console.log('[VideoReader content.js] Получено window.postMessage событие');
  console.log('[VideoReader content.js] event.origin:', event.origin);
  console.log('[VideoReader content.js] event.data:', event.data);

  // Проверяем тип сообщения
  if (event.data && event.data.type === 'AUTH_SUCCESS') {
    console.log('[VideoReader content.js] AUTH_SUCCESS получен через window.postMessage');

    const token = event.data.token;
    const email = event.data.email;

    console.log('[VideoReader content.js] Token:', token?.substring(0, 8) + '...');
    console.log('[VideoReader content.js] Email:', email);

    // Сохраняем токен и email в chrome.storage.local
    if (token && email) {
      console.log('[VideoReader content.js] Сохраняем токен и email в storage...');

      await chrome.storage.local.set({ token: token, email: email });
      console.log('[VideoReader content.js] ✅ Токен и email сохранены в chrome.storage');

      // Сразу после получения токена запрашиваем план
      console.log('[VideoReader content.js] Запрашиваем план пользователя...');
      await fetchPlan();

      // Обновляем UI авторизации
      console.log('[VideoReader content.js] Обновляем UI авторизации...');
      await updateAuthUI();
      console.log('[VideoReader content.js] ✅ UI авторизации обновлён после получения токена');
    } else {
      console.error('[VideoReader content.js] ❌ Токен или email отсутствуют в postMessage!');
    }
  } else {
    console.log('[VideoReader content.js] Получено postMessage другого типа:', event.data?.type);
  }
});

console.log('[VideoReader content.js] ✅ Обработчик window.postMessage установлен');

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
      console.log('[VideoReader] Токен отсутствует - пользователь не авторизован');
      await chrome.storage.local.set({ plan: 'Free', email: null });
      console.log('[VideoReader] Current plan: Free');
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
      console.log('[VideoReader] Current plan: Free');
      return { plan: 'Free', email: null };
    }

    if (data.error) {
      console.warn('[VideoReader] Plan API error:', data.error, ', defaulting to Free');
      await chrome.storage.local.set({ plan: 'Free', email: null });
      console.log('[VideoReader] Current plan: Free');
      return { plan: 'Free', email: null };
    }

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
    console.error('[VideoReader] ❌ fetch /api/plan failed:', error);
    console.warn('[VideoReader] Failed to fetch plan from server, defaulting to Free:', error.message);

    // Сохраняем Free plan
    await chrome.storage.local.set({ plan: 'Free', email: null });
    console.log('[VideoReader] Current plan: Free');
    return { plan: 'Free', email: null };
  } finally {
    // Всегда обновляем UI авторизации после проверки плана
    await updateAuthUI();
  }
}

// Открывает страницу авторизации через background.js
function openAuthPage() {
  console.log('[VideoReader] Запрос на открытие страницы авторизации');
  chrome.runtime.sendMessage({ type: 'OPEN_AUTH_PAGE' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('[VideoReader] Ошибка отправки сообщения в background:', chrome.runtime.lastError);
    } else {
      console.log('[VideoReader] Страница авторизации запрошена');
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
    console.log('[VideoReader] Пользователь авторизован:', email, ', План:', plan);
  } else {
    // Пользователь не авторизован - показываем Sign In, скрываем Auth Info
    if (authSection) authSection.style.display = 'block';
    if (authInfo) authInfo.style.display = 'none';
    console.log('[VideoReader] Пользователь не авторизован - показываем Sign In');
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
    const signInBtn = document.getElementById('yt-reader-signin-btn');

    console.log('🔍 ПРОВЕРКА КНОПОК:', {
      translateBtn: !!translateBtn,
      toggleBtn: !!toggleBtn,
      langBtn: !!langBtn
    });

    if (!translateBtn) {
      console.error('❌ КНОПКА TRANSLATE НЕ НАЙДЕНА!');
    } else {
      console.log('✅ Кнопка Translate найдена, привязываю обработчик...');
      translateBtn.addEventListener('click', handleGetTranscript);
      console.log('✅ Обработчик привязан к кнопке Translate');
    }

    toggleBtn.addEventListener('click', handleTogglePanel);
    langBtn.addEventListener('click', handleLanguageToggle);

    // Обработчик для кнопки Sign In
    if (signInBtn) {
      signInBtn.addEventListener('click', () => {
        console.log('[VideoReader] Кнопка Sign In нажата');
        openAuthPage();
      });
    }

    // Обработчик для кнопки Upgrade
    const upgradeBtn = document.getElementById('yt-reader-upgrade-btn');
    if (upgradeBtn) {
      upgradeBtn.addEventListener('click', () => {
        console.log('[VideoReader] Кнопка Upgrade нажата - открываем /pricing');
        window.open('http://localhost:5000/pricing', '_blank');
      });
    }

    // Обработчик для кнопки Log out
    const logoutBtn = document.getElementById('yt-reader-logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        console.log('[VideoReader] Кнопка Log out нажата');

        // Удаляем токен и email из chrome.storage
        await chrome.storage.local.remove(['token', 'email', 'plan']);
        console.log('[VideoReader] Токен и email удалены из storage');

        // Обновляем UI
        await updateAuthUI();
        console.log('[VideoReader] Пользователь вышел из системы');
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

    // Обновляем UI авторизации на основе текущего состояния
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
  console.log('🔥🔥🔥 handleGetTranscript ВЫЗВАН!');

  const btn = document.getElementById('yt-reader-translate-btn');
  const content = document.getElementById('yt-transcript-content');
  const videoId = getVideoId();

  console.log('🔥 btn:', btn);
  console.log('🔥 content:', content);
  console.log('🔥 videoId:', videoId);

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

    console.log('🔥🔥🔥 ПЕРЕД translateSubtitles, subtitles.length:', subtitles.length);

    // Отправляем на сервер для перевода
    btn.classList.add('translating');
    btn.classList.remove('loading');
    btn.textContent = 'AI is translating...';

    console.log('🔥🔥🔥 ВЫЗЫВАЕМ translateSubtitles...');
    await translateSubtitles(videoId, subtitles);
    console.log('🔥🔥🔥 translateSubtitles ЗАВЕРШЁН!');

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
  const prevContext = [];
  const selectedLang = transcriptState.selectedLang; // Используем выбранный язык
  const totalLines = subtitles.length;

  console.log(`Начинаем перевод на ${selectedLang}... Всего строк: ${totalLines}`);

  // Получаем токен для отправки на сервер
  const storage = await chrome.storage.local.get(['token']);
  const token = storage.token || null;

  try {
    // Переводим каждую строку по очереди
    for (let i = 0; i < subtitles.length; i++) {
      const subtitle = subtitles[i];

      try {
        console.log(`→ TRANSLATE i=${i}, subtitle:`, subtitle, `text type: ${typeof subtitle.text}`, `videoId: ${videoId}`, `lang: ${selectedLang}`);

        const requestBody = {
          videoId: videoId,
          lineNumber: i,
          text: subtitle.text,
          prevContext: prevContext.slice(-2), // Последние 1-2 переведенные строки
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
        console.log('[DEBUG TRANSLATE]', {
          lineNumber: data.lineNumber,
          len: data.text ? data.text.length : 0,
          text: data.text,
          limited: data.limited,
          stop: data.stop,
          plan: data.plan
        });

        console.log(`→ RESPONSE i=${i}, data:`, data);

        if (data.error) {
          console.error(`❌ Ошибка перевода строки ${i}: ${data.error}`);
          prevContext.push(subtitle.text); // Используем оригинал
          continue;
        }

        // ═══════════════════════════════════════════════════════════════════
        // ОБРАБОТКА STOP - остановка перевода при достижении лимита Free
        // ═══════════════════════════════════════════════════════════════════
        if (data.stop === true) {
          console.log(`🛑 FREE LIMIT REACHED на строке ${i}. Останавливаем перевод.`);

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
                console.log('[VideoReader] CTA Upgrade нажата - открываем /pricing');
                window.open('http://localhost:5000/pricing', '_blank');
              });
            }
          }

          // ОСТАНАВЛИВАЕМ цикл перевода
          break;
        }

        console.log(`→ RESPONSE i=${i}, cached: ${data.cached}`);
        const translatedText = data.text;

        // Логируем статус
        if (data.cached) {
          console.log(`[${i}] Cache: ${translatedText}`);
        } else {
          console.log(`[${i}] Translated: ${translatedText}`);
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
async function getTranscript() {
  console.log('Получаем транскрипт...');

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
      console.log('Открыли панель транскрипта');
      isOpen = true;

      // Ждем появления элементов
      try {
        await waitForElement('ytd-transcript-segment-renderer', 5000);
      } catch (e) {
        console.log('Ожидание элементов транскрипта истекло');
      }

      // Дополнительная задержка для полной загрузки
      await new Promise(resolve => setTimeout(resolve, 1000));
    } else {
      // Панель уже открыта, просто ждем загрузки элементов
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Ищем элементы транскрипта
    const transcriptItems = document.querySelectorAll('ytd-transcript-segment-renderer');
    console.log('Найдено элементов транскрипта:', transcriptItems.length);

    // Если элементы не найдены и есть попытки retry
    if (transcriptItems.length === 0 && retryCount < maxRetries) {
      console.log(`Retry ${retryCount + 1}/${maxRetries}: элементы не найдены, пробуем снова`);
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
        console.log(`[DEBUG] subtitle[${index}]:`, {time: timeText, text: text.substring(0, 100)});
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
    console.log('Закрыли панель транскрипта');
  }

  console.log('Получено субтитров:', subtitles.length);
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
