// ═══════════════════════════════════════════════════════════════════
// TRANSCRIPT MODULE — Extraction from YouTube
// ═══════════════════════════════════════════════════════════════════

import { waitForElement } from "./util.js";

// Главный метод получения субтитров - парсит native YouTube transcript
async function getTranscript(videoId) {
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
        // Элементы не появились, попробуем retry
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

  console.log(`[Transcript] Found ${subtitles.length} subtitles via DOM parsing`);
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
  // Ждем загрузки секции с кнопкой транскрипта
  await waitForElement('#description ytd-video-description-transcript-section-renderer', 5000).catch(() => null);

  const selectors = [
    '#description ytd-video-description-transcript-section-renderer button[aria-label*="transcript" i]',
    '#description ytd-video-description-transcript-section-renderer button[aria-label*="текст" i]',
    'ytd-video-description-transcript-section-renderer button',
  ];

  for (const selector of selectors) {
    const btn = document.querySelector(selector);
    if (btn) {
      console.log('[Transcript] Found transcript button');
      return btn;
    }
  }

  console.warn('[Transcript] Transcript button not found');
  return null;
}

export { getTranscript };
