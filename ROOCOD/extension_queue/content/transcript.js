// ═══════════════════════════════════════════════════════════════════
// TRANSCRIPT MODULE — Extraction from YouTube (БЕЗ КЛИКОВ)
// ═══════════════════════════════════════════════════════════════════

// Главный метод получения субтитров через API (без кликов по UI)
async function getTranscript(videoId) {
  console.log('🚀 Получаем транскрипт через API (без кликов)...');

  if (!videoId) {
    console.error('❌ Video ID not found');
    return null;
  }

  try {
    // Динамически импортируем модуль transcript
    const transcriptModule = await import(chrome.runtime.getURL('transcript/index.js'));
    const { getTranscript: getTranscriptAPI } = transcriptModule;

    // Используем API метод без кликов в UI
    const result = await getTranscriptAPI(videoId, {
      preferredLanguage: 'en',
      useCache: true
    });

    if (!result || !result.segments || result.segments.length === 0) {
      console.warn('⚠️ No transcript data received');
      return null;
    }

    console.log(`✅ Получено ${result.segments.length} сегментов субтитров`);
    console.log(`📊 Метод: ${result.method}`);
    console.log(`🌍 Доступные языки: ${result.availableLanguages.length}`);

    // Преобразуем в формат, совместимый с текущим кодом
    const subtitles = result.segments.map(segment => ({
      index: segment.index,
      time: formatTimeFromSeconds(segment.start),
      text: segment.text,
      start: segment.start,
      end: segment.end
    }));

    return subtitles;

  } catch (error) {
    console.error('❌ Ошибка получения транскрипта:', error);
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

export { getTranscript };
