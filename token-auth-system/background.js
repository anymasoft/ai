// Background script для обработки авторизации через API токены
// Слушает postMessage от OAuth popup и сохраняет токен

console.log('[VideoReader Background] Service worker запущен');

// Слушаем сообщения от content script и popup окна авторизации
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Обработка запроса на открытие страницы авторизации
  if (message.type === 'OPEN_AUTH_PAGE') {
    console.log('[VideoReader Background] Запрос на открытие страницы авторизации');

    // Открываем auth.html в новой вкладке
    chrome.tabs.create({
      url: chrome.runtime.getURL('auth.html'),
      active: true
    }, (tab) => {
      console.log('[VideoReader Background] Страница авторизации открыта, tab ID:', tab.id);
      sendResponse({ success: true, tabId: tab.id });
    });

    return true; // Асинхронный ответ
  }

  // Обработка успешной авторизации
  if (message.type === 'AUTH_SUCCESS' && message.token) {
    console.log('[VideoReader Background] Получен токен от OAuth popup');

    // Сохраняем токен в chrome.storage.local
    chrome.storage.local.set({ token: message.token }, () => {
      console.log('[VideoReader Background] Токен сохранён в storage');
      sendResponse({ success: true });
    });

    return true; // Асинхронный ответ
  }
});

// Альтернативный вариант: прослушивание через window.addEventListener
// (если postMessage приходит напрямую в background)
if (typeof window !== 'undefined') {
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'AUTH_SUCCESS' && event.data.token) {
      console.log('[VideoReader Background] Получен токен через window.postMessage');

      chrome.storage.local.set({ token: event.data.token }, () => {
        console.log('[VideoReader Background] Токен сохранён');
      });
    }
  });
}
