// background.js - Service Worker для Video Reader AI

// Google OAuth Configuration
const GOOGLE_CLIENT_ID = "431567664470-tnur42uavtfv279g05e2vq58q9b45ecg.apps.googleusercontent.com";
const REDIRECT_URI = `https://${chrome.runtime.id}.chromiumapp.org/`;

// Переменная для хранения ID окна авторизации
let authPopupId = null;

// Функция авторизации через Google OAuth
function loginWithGoogle() {
  console.log('🔐 Запуск Google OAuth авторизации...');
  console.log('Extension ID:', chrome.runtime.id);
  console.log('Redirect URI:', REDIRECT_URI);

  // Формируем URL для Google OAuth (Implicit Flow с id_token)
  const authUrl =
    "https://accounts.google.com/o/oauth2/auth" +
    `?client_id=${GOOGLE_CLIENT_ID}` +
    `&response_type=id_token` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&scope=${encodeURIComponent("openid email profile")}` +
    "&prompt=consent";

  console.log('Auth URL:', authUrl);

  // Запускаем OAuth flow через Chrome Identity API
  chrome.identity.launchWebAuthFlow(
    {
      url: authUrl,
      interactive: true,
    },
    (redirectedUrl) => {
      console.log('OAuth redirect URL:', redirectedUrl);

      if (chrome.runtime.lastError) {
        console.error('❌ OAuth ошибка:', chrome.runtime.lastError.message);

        // Отправляем сообщение об ошибке в popup
        if (authPopupId) {
          chrome.tabs.sendMessage(authPopupId, {
            type: 'authError',
            error: chrome.runtime.lastError.message
          }).catch(() => {});
        }
        return;
      }

      if (redirectedUrl && redirectedUrl.includes("id_token")) {
        try {
          // Извлекаем id_token из hash параметров
          const hash = new URL(redirectedUrl).hash.substring(1); // Убираем #
          const params = new URLSearchParams(hash);
          const idToken = params.get('id_token');

          if (idToken) {
            console.log('✅ ID Token получен:', idToken.substring(0, 50) + '...');

            // Декодируем JWT для получения данных пользователя
            const payload = JSON.parse(atob(idToken.split('.')[1]));
            console.log('👤 Данные пользователя:', payload);

            // Сохраняем в chrome.storage.local
            chrome.storage.local.set({
              idToken: idToken,
              user: {
                email: payload.email,
                name: payload.name,
                picture: payload.picture,
                sub: payload.sub // Google User ID
              },
              authenticated: true,
              timestamp: Date.now()
            }, () => {
              console.log('✅ Данные сохранены в storage');

              // Отправляем сообщение об успешной авторизации в popup
              if (authPopupId) {
                chrome.tabs.sendMessage(authPopupId, {
                  type: 'authSuccess',
                  user: payload
                }).then(() => {
                  console.log('✅ Сообщение authSuccess отправлено в popup');

                  // Закрываем popup окно через 500ms
                  setTimeout(() => {
                    if (authPopupId) {
                      chrome.tabs.remove(authPopupId).catch(() => {});
                      authPopupId = null;
                    }
                  }, 500);
                }).catch((error) => {
                  console.log('Popup уже закрыт или недоступен');
                });
              }

              // Также отправляем broadcast сообщение (для других вкладок)
              chrome.runtime.sendMessage({
                type: 'authSuccess',
                user: payload
              }).catch(() => {
                // Игнорируем ошибку если нет слушателей
              });
            });
          } else {
            console.error('❌ ID Token не найден в URL');
          }
        } catch (error) {
          console.error('❌ Ошибка обработки OAuth redirect:', error);

          // Отправляем сообщение об ошибке в popup
          if (authPopupId) {
            chrome.tabs.sendMessage(authPopupId, {
              type: 'authError',
              error: error.message
            }).catch(() => {});
          }
        }
      } else {
        console.error('❌ Redirect URL не содержит id_token');
        console.log('Redirect URL:', redirectedUrl);
      }
    }
  );
}

// Обработка клика на иконку расширения - открываем auth popup
chrome.action.onClicked.addListener((tab) => {
  // Создаем popup окно 480x640 по центру экрана
  chrome.system.display.getInfo((displays) => {
    const primaryDisplay = displays[0];
    const screenWidth = primaryDisplay.workArea.width;
    const screenHeight = primaryDisplay.workArea.height;

    const popupWidth = 480;
    const popupHeight = 640;

    const left = Math.round((screenWidth - popupWidth) / 2) + primaryDisplay.workArea.left;
    const top = Math.round((screenHeight - popupHeight) / 2) + primaryDisplay.workArea.top;

    chrome.windows.create({
      url: chrome.runtime.getURL('auth_popup.html'),
      type: 'popup',
      width: popupWidth,
      height: popupHeight,
      left: left,
      top: top
    }, (window) => {
      if (window && window.tabs && window.tabs[0]) {
        authPopupId = window.tabs[0].id;
        console.log('✅ Auth popup открыт:', authPopupId);
      }
    });
  });
});

// Обработка установки расширения
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Video Reader AI установлено! Версия:', chrome.runtime.getManifest().version);
    console.log('Extension ID:', chrome.runtime.id);

    // Открываем auth popup при первой установке
    chrome.action.onClicked.addListener((tab) => {
      chrome.system.display.getInfo((displays) => {
        const primaryDisplay = displays[0];
        const screenWidth = primaryDisplay.workArea.width;
        const screenHeight = primaryDisplay.workArea.height;

        const popupWidth = 480;
        const popupHeight = 640;

        const left = Math.round((screenWidth - popupWidth) / 2) + primaryDisplay.workArea.left;
        const top = Math.round((screenHeight - popupHeight) / 2) + primaryDisplay.workArea.top;

        chrome.windows.create({
          url: chrome.runtime.getURL('auth_popup.html'),
          type: 'popup',
          width: popupWidth,
          height: popupHeight,
          left: left,
          top: top
        }, (window) => {
          if (window && window.tabs && window.tabs[0]) {
            authPopupId = window.tabs[0].id;
          }
        });
      });
    });
  } else if (details.reason === 'update') {
    const previousVersion = details.previousVersion;
    const currentVersion = chrome.runtime.getManifest().version;
    console.log(`Video Reader AI обновлено с ${previousVersion} на ${currentVersion}`);
  }
});

// Обработка сообщений от popup и content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Google OAuth Login
  if (request.type === 'login') {
    console.log('📨 Получено сообщение: запуск Google OAuth');

    // Сохраняем ID вкладки popup'а если он еще не сохранен
    if (sender.tab && sender.tab.id) {
      authPopupId = sender.tab.id;
      console.log('Auth popup ID установлен:', authPopupId);
    }

    loginWithGoogle();
    sendResponse({ success: true });
    return true;
  }

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

console.log('Video Reader AI background service worker запущен');
console.log('Extension ID:', chrome.runtime.id);
console.log('Client ID:', GOOGLE_CLIENT_ID);
