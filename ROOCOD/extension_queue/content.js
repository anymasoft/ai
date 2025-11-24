// ═══════════════════════════════════════════════════════════════════
// MAIN CONTENT SCRIPT - Главный файл расширения
// ═══════════════════════════════════════════════════════════════════

// Динамический импорт модулей (работает без "type": "module")
(async () => {
  try {
    // Импорт всех модулей
    const { initContentScript } = await import('./content/init.js');
    const { createTranscriptPanel, SUPPORTED_LANGUAGES, getFlagSVG } = await import('./content/ui.js');
    const { transcriptState } = await import('./content/state.js');
    const { translateSubtitles } = await import('./content/api.js');
    const { getTranscript } = await import('./content/transcript.js');
    const { startRealtimeHighlight } = await import('./content/highlight.js');
    const { exportSubtitles } = await import('./content/export.js');
    const {
      getSelectedLanguage,
      saveLanguage,
      loadSavedLanguage,
      waitForElement,
      openAuthPage,
      updateAuthUI
    } = await import('./content/util.js');

    // Глобальные переменные для совместимости
    window.transcriptState = transcriptState;
    window.SUPPORTED_LANGUAGES = SUPPORTED_LANGUAGES;

    // Global error boundary для перехвата всех ошибок
    window.addEventListener("error", (e) => {
      console.error("[VideoReader ERROR]", e.error);
    });

    window.addEventListener("unhandledrejection", (e) => {
      console.error("[VideoReader Promise ERROR]", e.reason);
    });

    // Главная функция инициализации
    initContentScript();

    // Экспорт для отладки
    console.log('[VideoReader] Content script загружен и инициализирован');
  } catch (error) {
    console.error('[VideoReader] Failed to load modules:', error);
  }
})();
