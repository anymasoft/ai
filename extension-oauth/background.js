// Background script для обработки авторизации через API токены
// Слушает postMessage от OAuth popup и сохраняет токен

console.log('[VideoReader Background] Service worker запущен');

// Глобальная переменная для отслеживания OAuth вкладки
let oauthTabId = null;

// Функция для открытия OAuth в новой вкладке
function openOAuthTab() {
  const authUrl = 'http://localhost:5000/auth';

  chrome.tabs.create(
    {
      url: authUrl,
      active: true
    },
    (tab) => {
      if (tab && tab.id) {
        oauthTabId = tab.id;
        console.log('[VideoReader Background] OAuth tab opened:', tab.id);
      }
    }
  );
}

// Функция для получения тарифного плана
async function getPlan() {
  try {
    const storage = await chrome.storage.local.get(['auth_token']);
    const token = storage.auth_token;

    if (!token) {
      console.log('[VideoReader Background] No auth token found, returning Free plan');
      return { plan: 'Free' };
    }

    const response = await fetch('http://localhost:5000/api/plan', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      console.error('[VideoReader Background] Failed to fetch plan:', response.status);
      // Токен невалидный - очищаем
      chrome.storage.local.remove('auth_token');
      return { plan: 'Free' };
    }

    const data = await response.json();
    console.log('[VideoReader Background] Plan fetched:', data);
    return data;
  } catch (error) {
    console.error('[VideoReader Background] Error fetching plan:', error);
    return { plan: 'Free' };
  }
}

// Слушаем сообщения от popup и content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Открытие OAuth вкладки
  if (message.type === 'login') {
    console.log('[VideoReader Background] Login request received');
    openOAuthTab();
    sendResponse({ success: true });
    return false;
  }

  // Получение тарифного плана
  if (message.type === 'get-plan') {
    console.log('[VideoReader Background] Get plan request received');
    getPlan().then(sendResponse);
    return true; // Асинхронный ответ
  }

  // Сохранение токена после успешной авторизации
  if (message.type === 'AUTH_SUCCESS' && message.token) {
    console.log('[VideoReader Background] Получен токен от OAuth popup');

    // Сохраняем токен в chrome.storage.local
    chrome.storage.local.set({ auth_token: message.token }, () => {
      console.log('[VideoReader Background] Токен сохранён в storage');
      sendResponse({ success: true });

      // Закрываем OAuth вкладку если она открыта
      if (oauthTabId) {
        chrome.tabs.remove(oauthTabId, () => {
          console.log('[VideoReader Background] OAuth tab closed');
          oauthTabId = null;
        });
      }
    });

    return true; // Асинхронный ответ
  }

  return false;
});

// Обработчик для закрытия OAuth вкладки
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === oauthTabId) {
    console.log('[VideoReader Background] OAuth tab was closed');
    oauthTabId = null;
  }
});

console.log('[VideoReader Background] Message handlers registered');
