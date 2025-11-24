// ═══════════════════════════════════════════════════════════════════
// STATE MODULE — global state for subtitles & user
// ═══════════════════════════════════════════════════════════════════

// глобальное состояние
const transcriptState = {
  subtitles: [],
  originalSubtitles: [],
  translatedSubtitles: {},
  selectedLang: "ru",

  userPlan: "Free",
  maxFreeLine: 0,

  exportAllowed: false,

  scrollLocked: false,
  scrollUnlockTimer: null,
  scrollListenersAttachedTo: null,
  wheelHandler: null,  // P1: сохраняем для cleanup
  scrollHandler: null,  // P1: сохраняем для cleanup

  timeIndexMap: [],  // O(1) поиск индекса субтитра по времени видео

  listeners: [],  // Массив document-level listeners для cleanup
  originalPushState: null,  // Оригинальные history методы
  originalReplaceState: null,
};

// расчёт лимита Free-плана (30%)
function calculateMaxFreeLine(total) {
  if (total <= 0) return 0;
  return Math.floor(total * 0.3);
}

// обновление плана пользователя
function updateUserPlan(newPlan) {
  transcriptState.userPlan = newPlan;
}

// преобразование translatedSubtitles (объект) в массив для экспорта
function getTranslatedSubtitlesArray() {
  const translated = [];
  for (let i = 0; i < transcriptState.originalSubtitles.length; i++) {
    if (transcriptState.translatedSubtitles[i]) {
      translated.push(transcriptState.translatedSubtitles[i]);
    } else {
      translated.push(transcriptState.originalSubtitles[i]);
    }
  }
  return translated;
}

export { transcriptState, calculateMaxFreeLine, updateUserPlan, getTranslatedSubtitlesArray };