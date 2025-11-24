// ═══════════════════════════════════════════════════════════════════
// MAIN CONTENT SCRIPT - Главный файл расширения
// ═══════════════════════════════════════════════════════════════════

// Импорт всех модулей
import { initContentScript } from './content/init.js';
import { createTranscriptPanel, showNotification, waitForElement } from './content/ui.js';
import { transcriptState } from './content/state.js';
import { translateSubtitles } from './content/api.js';
import { getTranscript } from './content/transcript.js';
import { startHighlighting, stopHighlighting } from './content/highlight.js';
import { exportSubtitles } from './content/export.js';
import { 
  SUPPORTED_LANGUAGES, 
  getSelectedLanguage, 
  saveLanguage, 
  loadSavedLanguage, 
  getFlagSVG,
  formatTime,
  openAuthPage,
  updateAuthUI
} from './content/util.js';

// Глобальные переменные для совместимости
window.transcriptState = transcriptState;
window.SUPPORTED_LANGUAGES = SUPPORTED_LANGUAGES;

// Главная функция инициализации
initContentScript();

// Экспорт для отладки
console.log('Content script загружен и инициализирован');