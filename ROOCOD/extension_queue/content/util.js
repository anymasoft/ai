// ═══════════════════════════════════════════════════════════════════
// UTIL MODULE — helpers
// ═══════════════════════════════════════════════════════════════════

// ждём появление элемента в DOM
function waitForElement(selector, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const el = document.querySelector(selector);
    if (el) return resolve(el);

    const obs = new MutationObserver(() => {
      const el2 = document.querySelector(selector);
      if (el2) {
        obs.disconnect();
        resolve(el2);
      }
    });

    obs.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => {
      obs.disconnect();
      reject(new Error("Element not found"));
    }, timeout);
  });
}

// получить videoId из URL
function getVideoId() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("v");
}

// загрузить сохранённый язык
function loadSavedLanguage() {
  const saved = localStorage.getItem("yt-reader-lang");
  if (saved) {
    return saved;
  }
  return "ru";
}

// сохранить выбранный язык
function saveLanguage(lang) {
  localStorage.setItem("yt-reader-lang", lang);
}

// получить выбранный язык
function getSelectedLanguage() {
  const saved = loadSavedLanguage();
  return saved || "ru";
}

// нормализация текста
function normalizeText(text) {
  return text.replace(/\s+/g, " ").trim();
}

// ожидание
function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// открыть страницу авторизации
function openAuthPage() {
  const authUrl = 'https://api.beem.ink/auth';
  window.open(authUrl, '_blank');
}

// обновить UI авторизации
async function updateAuthUI() {
  console.log('[VideoReader] 🔄 updateAuthUI() вызвана');
  const storage = await chrome.storage.local.get(['token', 'email', 'plan']);
  const token = storage.token || null;
  const email = storage.email || null;
  const plan = storage.plan || 'Free';

  console.log('[VideoReader] 📊 Данные из storage:', {
    hasToken: !!token,
    email,
    plan,
    tokenLength: token?.length
  });

  const authSection = document.getElementById('yt-reader-auth-section');
  const authInfo = document.getElementById('yt-reader-auth-info');
  const authEmail = document.querySelector('.yt-reader-auth-email');
  const authPlan = document.querySelector('.yt-reader-auth-plan');
  const upgradeBtn = document.getElementById('yt-reader-upgrade-btn');

  console.log('[VideoReader] 🔍 Найденные элементы:', {
    hasAuthSection: !!authSection,
    hasAuthInfo: !!authInfo,
    hasAuthEmail: !!authEmail,
    hasAuthPlan: !!authPlan,
    hasUpgradeBtn: !!upgradeBtn
  });

  if (!authSection || !authInfo) {
    console.warn('[VideoReader] ⚠️ Отсутствуют элементы authSection или authInfo');
    return;
  }

  if (token && email) {
    // Пользователь авторизован
    console.log('[VideoReader] ✅ Пользователь авторизован, обновляем UI');
    authSection.style.display = 'none';
    authInfo.style.display = 'flex';

    if (authEmail) authEmail.textContent = email;
    if (authPlan) authPlan.textContent = plan;

    if (upgradeBtn) {
      upgradeBtn.style.display = (plan === 'Free' || plan === 'Pro') ? 'block' : 'none';
    }
  } else {
    // Пользователь не авторизован
    console.log('[VideoReader] ❌ Пользователь НЕ авторизован');
    authSection.style.display = 'flex';
    authInfo.style.display = 'none';
  }
}

export {
  waitForElement,
  getVideoId,
  loadSavedLanguage,
  saveLanguage,
  getSelectedLanguage,
  normalizeText,
  wait,
  openAuthPage,
  updateAuthUI,
};