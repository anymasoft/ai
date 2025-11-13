// Глобальное состояние для предотвращения повторных запросов
const transcriptState = {
  videoId: null,
  isProcessing: false,
  isProcessed: false,
  subtitles: null,
  selectedLang: 'ru' // По умолчанию русский
};

// Список поддерживаемых языков
const SUPPORTED_LANGUAGES = [
  { code: 'ru', flag: '🇷🇺', name: 'Russian' },
  { code: 'en', flag: '🇺🇸', name: 'English' },
  { code: 'es', flag: '🇪🇸', name: 'Spanish' },
  { code: 'de', flag: '🇩🇪', name: 'German' },
  { code: 'fr', flag: '🇫🇷', name: 'French' },
  { code: 'ja', flag: '🇯🇵', name: 'Japanese' },
  { code: 'zh', flag: '🇨🇳', name: 'Chinese' },
  { code: 'it', flag: '🇮🇹', name: 'Italian' },
  { code: 'pt', flag: '🇵🇹', name: 'Portuguese' }
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

  const panel = document.createElement('div');
  panel.id = 'yt-transcript-panel';
  panel.innerHTML = `
    <div id="yt-transcript-panel-header">
      <div id="yt-transcript-panel-title">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zM4 12h4v2H4v-2zm10 6H4v-2h10v2zm6 0h-4v-2h4v2zm0-4H10v-2h10v2z"/>
        </svg>
        Transcript
      </div>
      <button id="yt-transcript-toggle-btn" title="Свернуть/Развернуть">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
        </svg>
      </button>
    </div>
    <div id="yt-transcript-body">
      <div class="yt-reader-controls">
        <button class="yt-reader-btn" id="yt-reader-translate-btn">
          <svg class="yt-reader-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
          </svg>
          <span class="yt-reader-btn-text">Translate Transcript</span>
        </button>
        <div class="yt-reader-lang-selector">
          <button class="yt-reader-lang-btn" id="yt-reader-lang-btn">
            <span class="yt-reader-lang-flag">${currentLang.flag}</span>
            <span class="yt-reader-lang-code">${currentLang.code}</span>
            <svg class="yt-reader-lang-arrow" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 10l5 5 5-5z"/>
            </svg>
          </button>
          <div class="yt-reader-lang-dropdown" id="yt-reader-lang-dropdown">
            ${SUPPORTED_LANGUAGES.map(lang => `
              <div class="yt-reader-lang-option ${lang.code === transcriptState.selectedLang ? 'selected' : ''}" data-lang="${lang.code}">
                <span class="yt-reader-lang-option-flag">${lang.flag}</span>
                <div class="yt-reader-lang-option-info">
                  <span class="yt-reader-lang-option-code">${lang.code}</span>
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
  langDropdown.classList.toggle('show', isActive);
}

// Обработчик выбора языка
function handleLanguageSelect(langCode) {
  const selectedLang = SUPPORTED_LANGUAGES.find(l => l.code === langCode);
  if (!selectedLang) return;

  // Сохраняем выбранный язык
  saveLanguage(langCode);

  // Обновляем UI кнопки
  const langBtn = document.getElementById('yt-reader-lang-btn');
  langBtn.querySelector('.yt-reader-lang-flag').textContent = selectedLang.flag;
  langBtn.querySelector('.yt-reader-lang-code').textContent = selectedLang.code;

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
  btn.innerHTML = `
    <div class="yt-reader-spinner"></div>
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
    btn.innerHTML = `
      <div class="yt-reader-spinner"></div>
      <span class="yt-reader-btn-text">Translating...</span>
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
    btn.innerHTML = `
      <svg class="yt-reader-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
      </svg>
      <span class="yt-reader-btn-text">Translate Transcript</span>
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

      subtitles.push({
        index: index,
        time: timeText,
        text: text
      });
    }
  });

  // Закрываем панель транскрипта если мы её открывали
  if (isOpen) {
    transcriptButton.click();
    console.log('Закрыли панель транскрипта');
  }

  console.log('Получено субтитров:', subtitles.length);
  return subtitles;
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
    <div class="yt-transcript-item" data-time="${sub.time}" data-index="${sub.index}">
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
