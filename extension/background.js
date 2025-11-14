// background.js - Service Worker для Video Reader AI

// Обработка клика на иконку расширения
chrome.action.onClicked.addListener((tab) => {
  // Открываем страницу приветствия в новой вкладке
  chrome.tabs.create({
    url: chrome.runtime.getURL('extension/auth/welcome.html')
  });
});

// Обработка установки расширения
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Video Reader AI установлено! Версия:', chrome.runtime.getManifest().version);

    // Открываем welcome страницу при первой установке
    chrome.tabs.create({
      url: chrome.runtime.getURL('extension/auth/welcome.html')
    });
  } else if (details.reason === 'update') {
    const previousVersion = details.previousVersion;
    const currentVersion = chrome.runtime.getManifest().version;
    console.log(`Video Reader AI обновлено с ${previousVersion} на ${currentVersion}`);
  }
});

// Обработка сообщений от content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Получение данных пользователя из storage
  if (request.action === 'getUserData') {
    chrome.storage.sync.get(['user_id', 'plan', 'jwt', 'authenticated'], (result) => {
      sendResponse(result);
    });
    return true; // Асинхронный ответ
  }

  // Проверка авторизации
  if (request.action === 'checkAuth') {
    chrome.storage.sync.get(['authenticated', 'jwt'], (result) => {
      sendResponse({
        authenticated: result.authenticated || false,
        jwt: result.jwt || null
      });
    });
    return true;
  }

  // Открытие страницы апгрейда
  if (request.action === 'openUpgrade') {
    chrome.tabs.create({
      url: chrome.runtime.getURL('extension/auth/upgrade.html')
    });
    sendResponse({ success: true });
    return true;
  }

  // Выход из аккаунта
  if (request.action === 'logout') {
    chrome.storage.sync.clear(() => {
      sendResponse({ success: true });
    });
    return true;
  }
});

// Периодическая проверка валидности JWT (опционально)
chrome.alarms.create('checkJwtValidity', {
  periodInMinutes: 60 // Проверяем каждый час
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkJwtValidity') {
    chrome.storage.sync.get(['jwt', 'authenticated'], async (result) => {
      if (result.authenticated && result.jwt) {
        // TODO: Проверить валидность JWT на backend
        console.log('Проверка валидности JWT токена');
      }
    });
  }
});

console.log('Video Reader AI background service worker запущен');
