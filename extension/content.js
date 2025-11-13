// Глобальное состояние для предотвращения повторных запросов
const transcriptState = {
  videoId: null,
  isProcessing: false,
  isProcessed: false,
  subtitles: null
};

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
      <button id="yt-transcript-toggle-btn" title="Свернуть/Развернуть">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
        </svg>
      </button>
    </div>
    <div id="yt-transcript-body">
      <button id="yt-transcript-get-btn">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
        </svg>
        Get Transcript
      </button>
      <div id="yt-transcript-content"></div>
    </div>
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

    // Привязываем обработчики
    const getBtn = document.getElementById('yt-transcript-get-btn');
    const toggleBtn = document.getElementById('yt-transcript-toggle-btn');

    getBtn.addEventListener('click', handleGetTranscript);
    toggleBtn.addEventListener('click', handleTogglePanel);

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

// Обработчик нажатия кнопки получения транскрипта
async function handleGetTranscript() {
  const btn = document.getElementById('yt-transcript-get-btn');
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

  // Блокируем кнопку
  btn.disabled = true;
  btn.textContent = 'Processing...';

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
      transcriptState.isProcessing = false;
      return;
    }

    // Сохраняем оригинальные субтитры
    transcriptState.subtitles = subtitles;

    // Отображаем оригинальные субтитры сразу
    displayTranscript(subtitles);

    // Отправляем на сервер для перевода
    btn.textContent = 'Translating...';
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
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
      </svg>
      Get Transcript
    `;
  }
}

// Отправка субтитров на сервер и получение переводов
async function translateSubtitles(videoId, subtitles) {
  const SERVER_URL = 'http://localhost:5000/translate';

  try {
    // Отправляем на сервер
    const response = await fetch(SERVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        videoId: videoId,
        subtitles: subtitles.map(sub => ({
          time: sub.time,
          text: sub.text
        }))
      })
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const data = await response.json();

    // Проверяем, есть ли кешированный результат
    if (data.cached) {
      console.log('Используем кешированный перевод');
      updateTranscriptWithTranslations(data.translations);
    } else {
      console.log('Получаем новый перевод');
      updateTranscriptWithTranslations(data.translations);
    }

  } catch (error) {
    console.error('Ошибка при переводе:', error);
    // Оставляем оригинальные субтитры в случае ошибки
  }
}

// Обновление транскрипта с переводами построчно
function updateTranscriptWithTranslations(translations) {
  translations.forEach((translation, index) => {
    setTimeout(() => {
      const item = document.querySelector(`[data-index="${index}"]`);
      if (item) {
        const textElement = item.querySelector('.yt-transcript-item-text');
        if (textElement) {
          // Плавное обновление
          textElement.style.opacity = '0.5';
          setTimeout(() => {
            textElement.textContent = translation.text;
            textElement.style.opacity = '1';
          }, 100);
        }
      }
    }, index * 50); // Задержка 50мс между обновлениями для плавности
  });
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
