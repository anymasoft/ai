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
  scrollListenersAttached: false,
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