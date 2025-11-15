// background.js - Service Worker для Video Reader AI
// Упрощенная версия - только открытие auth страницы

console.log('Video Reader AI background service worker запущен');
console.log('Extension ID:', chrome.runtime.id);

// Обработка клика на иконку расширения - открываем auth_popup.html как обычную вкладку
chrome.action.onClicked.addListener(() => {
  console.log('🔘 Клик на иконку расширения - открываем auth_popup.html');

  chrome.tabs.create({
    url: chrome.runtime.getURL('auth_popup.html')
  });
});

// Обработка установки расширения
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Video Reader AI установлено! Версия:', chrome.runtime.getManifest().version);
    console.log('Extension ID:', chrome.runtime.id);

    // Открываем auth страницу при первой установке
    chrome.tabs.create({
      url: chrome.runtime.getURL('auth_popup.html')
    });
  } else if (details.reason === 'update') {
    const previousVersion = details.previousVersion;
    const currentVersion = chrome.runtime.getManifest().version;
    console.log(`Video Reader AI обновлено с ${previousVersion} на ${currentVersion}`);
  }
});

// Обработка сообщений от popup и content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Получение данных пользователя из storage
  if (request.action === 'getUserData') {
    chrome.storage.local.get(['user', 'idToken', 'authenticated'], (result) => {
      sendResponse(result);
    });
    return true;
  }

  // Проверка авторизации
  if (request.action === 'checkAuth') {
    chrome.storage.local.get(['authenticated', 'user'], (result) => {
      sendResponse({
        authenticated: result.authenticated || false,
        user: result.user || null
      });
    });
    return true;
  }

  // Выход из аккаунта
  if (request.action === 'logout') {
    chrome.storage.local.clear(() => {
      sendResponse({ success: true });
    });
    return true;
  }
});

// Периодическая проверка валидности токена
chrome.alarms.create('checkTokenValidity', {
  periodInMinutes: 60 // Проверяем каждый час
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkTokenValidity') {
    chrome.storage.local.get(['idToken', 'authenticated'], async (result) => {
      if (result.authenticated && result.idToken) {
        // TODO: Проверить валидность токена на backend
        console.log('Проверка валидности ID токена');
      }
    });
  }
});
