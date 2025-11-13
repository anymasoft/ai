// Ждем загрузки плеера YouTube
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

// Функция для извлечения данных ytInitialPlayerResponse
function getYTInitialPlayerResponse() {
  try {
    // Ищем ytInitialPlayerResponse в скриптах страницы
    const scripts = document.querySelectorAll('script');
    for (let script of scripts) {
      const content = script.textContent;
      if (content.includes('ytInitialPlayerResponse')) {
        const match = content.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
        if (match) {
          return JSON.parse(match[1]);
        }
      }
    }

    // Альтернативный способ - из window объекта
    if (window.ytInitialPlayerResponse) {
      return window.ytInitialPlayerResponse;
    }

    return null;
  } catch (error) {
    console.error('Ошибка при извлечении ytInitialPlayerResponse:', error);
    return null;
  }
}

// Функция для получения URL субтитров
function getSubtitlesUrl(playerResponse) {
  try {
    const captions = playerResponse?.captions?.playerCaptionsTracklistRenderer;
    if (!captions || !captions.captionTracks) {
      console.log('Субтитры не найдены для этого видео');
      return null;
    }

    // Приоритет: русские субтитры, затем английские, затем первые доступные
    const tracks = captions.captionTracks;

    let subtitleTrack = tracks.find(track => track.languageCode === 'ru');
    if (!subtitleTrack) {
      subtitleTrack = tracks.find(track => track.languageCode === 'en');
    }
    if (!subtitleTrack) {
      subtitleTrack = tracks[0];
    }

    console.log('Найден трек субтитров:', subtitleTrack.name.simpleText);
    return subtitleTrack.baseUrl;
  } catch (error) {
    console.error('Ошибка при получении URL субтитров:', error);
    return null;
  }
}

// Функция для парсинга XML субтитров
function parseSubtitles(xmlText) {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    const textElements = xmlDoc.querySelectorAll('text');

    const subtitles = [];
    textElements.forEach((element, index) => {
      const start = parseFloat(element.getAttribute('start'));
      const duration = parseFloat(element.getAttribute('dur'));
      const text = element.textContent
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\n/g, ' ')
        .trim();

      subtitles.push({
        index: index + 1,
        start: start,
        end: start + duration,
        text: text
      });
    });

    return subtitles;
  } catch (error) {
    console.error('Ошибка при парсинге субтитров:', error);
    return [];
  }
}

// Функция для форматирования времени
function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

// Основная функция для получения субтитров
async function fetchSubtitles() {
  console.log('🎬 Начинаем получение субтитров...');

  const playerResponse = getYTInitialPlayerResponse();
  if (!playerResponse) {
    console.error('❌ Не удалось получить данные плеера YouTube');
    return;
  }

  const subtitlesUrl = getSubtitlesUrl(playerResponse);
  if (!subtitlesUrl) {
    console.error('❌ URL субтитров не найден');
    return;
  }

  console.log('📡 Загружаем субтитры...');

  try {
    const response = await fetch(subtitlesUrl);
    if (!response.ok) {
      throw new Error(`HTTP ошибка: ${response.status}`);
    }

    const xmlText = await response.text();
    const subtitles = parseSubtitles(xmlText);

    console.log(`✅ Получено ${subtitles.length} субтитров\n`);
    console.log('═'.repeat(80));

    // Выводим субтитры в консоль
    subtitles.forEach(sub => {
      console.log(`[${formatTime(sub.start)} --> ${formatTime(sub.end)}]`);
      console.log(sub.text);
      console.log('─'.repeat(80));
    });

    console.log('═'.repeat(80));
    console.log('✅ Все субтитры выведены в консоль');

    // Также возвращаем массив субтитров для возможного дальнейшего использования
    return subtitles;
  } catch (error) {
    console.error('❌ Ошибка при загрузке субтитров:', error);
  }
}

// Создание и внедрение кнопки
async function injectButton() {
  try {
    // Ждем загрузки контейнера с кнопками YouTube
    const controlsContainer = await waitForElement('#movie_player .ytp-right-controls');

    // Проверяем, не добавлена ли уже кнопка
    if (document.getElementById('subtitle-extractor-btn')) {
      return;
    }

    // Создаем кнопку
    const button = document.createElement('button');
    button.id = 'subtitle-extractor-btn';
    button.className = 'ytp-button subtitle-extractor-button';
    button.title = 'Получить субтитры (вывод в консоль)';
    button.innerHTML = `
      <svg height="100%" version="1.1" viewBox="0 0 36 36" width="100%">
        <path fill="#fff" d="M11,11 C9.89,11 9,11.9 9,13 L9,23 C9,24.1 9.89,25 11,25 L25,25 C26.1,25 27,24.1 27,23 L27,13 C27,11.9 26.1,11 25,11 L11,11 Z M17,14 L19,14 L19,16 L17,16 L17,14 Z M14,14 L16,14 L16,16 L14,16 L14,14 Z M11,14 L13,14 L13,16 L11,16 L11,14 Z M23,17 L25,17 L25,19 L23,19 L23,17 Z M20,17 L22,17 L22,19 L20,19 L20,17 Z M17,17 L19,17 L19,19 L17,19 L17,17 Z M14,17 L16,17 L16,19 L14,19 L14,17 Z M11,17 L13,17 L13,19 L11,19 L11,17 Z M17,20 L19,20 L19,22 L17,22 L17,20 Z M14,20 L16,20 L16,22 L14,22 L14,20 Z M11,20 L13,20 L13,22 L11,22 L11,20 Z"></path>
      </svg>
    `;

    // Добавляем обработчик клика
    button.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await fetchSubtitles();
    });

    // Вставляем кнопку в контейнер управления
    controlsContainer.insertBefore(button, controlsContainer.firstChild);

    console.log('✅ Кнопка для получения субтитров добавлена');
  } catch (error) {
    console.error('❌ Ошибка при внедрении кнопки:', error);
  }
}

// Отслеживание изменений URL (для навигации по YouTube без перезагрузки страницы)
let currentUrl = location.href;
new MutationObserver(() => {
  if (location.href !== currentUrl) {
    currentUrl = location.href;
    if (currentUrl.includes('/watch')) {
      setTimeout(injectButton, 1000);
    }
  }
}).observe(document.body, { childList: true, subtree: true });

// Запускаем внедрение кнопки при загрузке
if (location.href.includes('/watch')) {
  injectButton();
}
