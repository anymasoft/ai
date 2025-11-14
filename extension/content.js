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
        <button class="yt-reader-btn" id="yt-reader-translate-btn">
          <span class="yt-reader-btn-text">Translate Video</span>
        </button>
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

    // Закрытие dropdown при клике вне его
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.yt-reader-lang-selector')) {
        langDropdown.classList.remove('show');
        langBtn.classList.remove('active');
      }
    });

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

  // Блокируем кнопку и показываем spinner
  btn.disabled = true;
  btn.classList.add('loading');
  btn.innerHTML = `
    <span class="yt-reader-btn-text">Loading...</span>
  `;

  // Показываем лоадер
  content.innerHTML = `
    <div class="yt-transcript-loader">
      <div class="yt-transcript-loader-spinner"></div>
      <span class="yt-transcript-loader-text">Загрузка транскрипта...</span>
    </div>
  `;

  try {
    const subtitles = await getTranscript();

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

    // Отправляем на сервер для перевода
    btn.classList.add('translating');
    btn.classList.remove('loading');
    btn.innerHTML = `
      <span class="yt-reader-btn-text">AI is translating...</span>
    `;
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
    btn.disabled = false;
    btn.classList.remove('loading', 'translating');
    btn.innerHTML = `
      <span class="yt-reader-btn-text">Translate Video</span>
    `;
  }
}

// Отправка субтитров на сервер и получение переводов построчно
async function translateSubtitles(videoId, subtitles) {
  const SERVER_URL = 'http://localhost:5000/translate-line';
  const prevContext = [];
  const selectedLang = transcriptState.selectedLang; // Используем выбранный язык

  console.log(`Начинаем перевод на ${selectedLang}...`);

  try {
    // Переводим каждую строку по очереди
    for (let i = 0; i < subtitles.length; i++) {
      const subtitle = subtitles[i];

      try {
        // Отправляем запрос на перевод одной строки
        const response = await fetch(SERVER_URL, {
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
        });

        if (!response.ok) {
          console.error(`Ошибка перевода строки ${i}: ${response.status}`);
          prevContext.push(subtitle.text); // Используем оригинал
          continue;
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

        // Небольшая задержка для плавности (не обязательно для кешированных)
        if (!data.cached) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }

      } catch (error) {
        console.error(`Ошибка при переводе строки ${i}:`, error);
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
    throw new Error('Кнопка транскрипта не найдена');
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

// Запускаем вставку панели при загрузке
if (location.href.includes('/watch')) {
  injectPanel();
}
