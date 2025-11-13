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

// Создание панели транскрипта
function createTranscriptPanel() {
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
      <button id="yt-transcript-get-btn">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
        </svg>
        Get Transcript
      </button>
    </div>
    <div id="yt-transcript-content"></div>
  `;

  return panel;
}

// Вставка панели в страницу
async function injectPanel() {
  try {
    // Ищем secondary column (справа от видео)
    const secondary = await waitForElement('#secondary-inner, #secondary');

    // Проверяем, не добавлена ли уже панель
    if (document.getElementById('yt-transcript-panel')) {
      return;
    }

    const panel = createTranscriptPanel();

    // Вставляем в начало secondary column
    secondary.insertBefore(panel, secondary.firstChild);

    // Привязываем обработчик к кнопке
    const btn = document.getElementById('yt-transcript-get-btn');
    btn.addEventListener('click', handleGetTranscript);

    console.log('✅ Панель транскрипта добавлена');
  } catch (error) {
    console.error('❌ Ошибка при вставке панели:', error);
  }
}

// Обработчик нажатия кнопки
async function handleGetTranscript() {
  const btn = document.getElementById('yt-transcript-get-btn');
  const content = document.getElementById('yt-transcript-content');

  // Блокируем кнопку
  btn.disabled = true;
  btn.textContent = 'Loading...';

  // Показываем лоадер
  content.innerHTML = `
    <div class="yt-transcript-loader">
      <div class="yt-transcript-loader-spinner"></div>
      <span>Загрузка транскрипта...</span>
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
      return;
    }

    // Обрабатываем субтитры - переводим в верхний регистр
    const processedSubtitles = subtitles.map(sub => ({
      ...sub,
      text: sub.text.toUpperCase() // ОБРАБОТКА: ВЕРХНИЙ РЕГИСТР
    }));

    // Отображаем
    displayTranscript(processedSubtitles);

  } catch (error) {
    console.error('❌ Ошибка при получении транскрипта:', error);
    content.innerHTML = `
      <div class="yt-transcript-error">
        Ошибка при загрузке транскрипта: ${error.message}
      </div>
    `;
  } finally {
    btn.disabled = false;
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
      </svg>
      Refresh
    `;
  }
}

// Получение транскрипта
async function getTranscript() {
  console.log('🎬 Получаем транскрипт...');

  // Ищем кнопку "Show transcript"
  const transcriptButton = await findTranscriptButton();

  if (!transcriptButton) {
    throw new Error('Кнопка транскрипта не найдена');
  }

  // Проверяем, не открыт ли уже транскрипт
  const isOpen = transcriptButton.getAttribute('aria-pressed') === 'true';

  if (!isOpen) {
    transcriptButton.click();
    console.log('🖱️ Открыли панель транскрипта');
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  // Ищем элементы транскрипта
  const transcriptItems = document.querySelectorAll('ytd-transcript-segment-renderer');

  console.log('📝 Найдено элементов транскрипта:', transcriptItems.length);

  if (transcriptItems.length === 0) {
    throw new Error('Элементы транскрипта не найдены');
  }

  const subtitles = [];
  transcriptItems.forEach((item, index) => {
    const timeElement = item.querySelector('.segment-timestamp');
    const textElement = item.querySelector('yt-formatted-string.segment-text');

    if (textElement) {
      const text = textElement.textContent.trim();
      const timeText = timeElement?.textContent.trim() || '';

      subtitles.push({
        index: index + 1,
        time: timeText,
        text: text
      });
    }
  });

  // Закрываем панель транскрипта
  if (!isOpen) {
    transcriptButton.click();
    console.log('🖱️ Закрыли панель транскрипта');
  }

  console.log(`✅ Получено ${subtitles.length} субтитров`);
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
      console.log('✅ Найдена кнопка транскрипта');
      return btn;
    }
  }

  return null;
}

// Отображение транскрипта
function displayTranscript(subtitles) {
  const content = document.getElementById('yt-transcript-content');

  content.innerHTML = subtitles.map(sub => `
    <div class="yt-transcript-item" data-time="${sub.time}">
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

// Отслеживание изменений URL
let currentUrl = location.href;
new MutationObserver(() => {
  if (location.href !== currentUrl) {
    currentUrl = location.href;
    if (currentUrl.includes('/watch')) {
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
