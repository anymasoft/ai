// ═══════════════════════════════════════════════════════════════════
// MAIN CONTENT SCRIPT - Главный файл расширения
// ═══════════════════════════════════════════════════════════════════

// Импорт всех модулей
import { initContentScript } from './content/init.js';
import { createTranscriptPanel, SUPPORTED_LANGUAGES, getFlagSVG } from './content/ui.js';
import { transcriptState } from './content/state.js';
import { translateSubtitles } from './content/api.js';
import { getTranscript } from './content/transcript.js';
import { startRealtimeHighlight } from './content/highlight.js';
import { exportSubtitles } from './content/export.js';
import {
  getSelectedLanguage,
  saveLanguage,
  loadSavedLanguage,
  waitForElement,
  openAuthPage,
  updateAuthUI
} from './content/util.js';

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
console.log('Content script загружен и инициализирован');