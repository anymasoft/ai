// Background script для обработки авторизации через API токены
// Слушает postMessage от OAuth popup и сохраняет токен

console.log('[VideoReader Background] Service worker запущен');

// Открываем страницу авторизации при клике на иконку расширения
chrome.action.onClicked.addListener(() => {
  const authUrl = chrome.runtime.getURL('auth.html');
  chrome.tabs.create({ url: authUrl });
});

// Слушаем сообщения от popup окна авторизации
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
