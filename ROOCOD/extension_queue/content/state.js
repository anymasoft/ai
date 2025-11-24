// ═══════════════════════════════════════════════════════════════════
// STATE MODULE — global state for subtitles & user
// ═══════════════════════════════════════════════════════════════════

// глобальное состояние
const transcriptState = {
  subtitles: [],
  originalSubtitles: [],
  translatedSubtitles: [],
  selectedLang: "ru",

  userPlan: "Free",
  maxFreeLine: 0,

  exportAllowed: false,
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

export { transcriptState, calculateMaxFreeLine, updateUserPlan };