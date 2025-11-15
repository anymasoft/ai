// Background Service Worker для Video Reader AI
// Полностью рабочий OAuth через Chrome Identity API

console.log('🚀 Video Reader AI Background Service Worker запущен');
console.log('Extension ID:', chrome.runtime.id);

// Google OAuth Configuration
const GOOGLE_CLIENT_ID = "CLIENT_ID_HERE.apps.googleusercontent.com";
const REDIRECT_URI = `https://${chrome.runtime.id}.chromiumapp.org/`;

console.log('Redirect URI:', REDIRECT_URI);

// Переменная для хранения ID вкладки авторизации
let authTabId = null;

/**
 * Обработка клика на иконку расширения
 * Открывает вкладку с auth.html
 */
chrome.action.onClicked.addListener(() => {
  console.log('🔘 Клик на иконку расширения');

  chrome.tabs.create({
    url: chrome.runtime.getURL('auth.html')
  }, (tab) => {
    authTabId = tab.id;
    console.log('✅ Вкладка авторизации открыта:', authTabId);
  });
});

/**
 * Основная функция OAuth авторизации через Chrome Identity API
 */
function startGoogleOAuth(sendResponse) {
  console.log('🔐 Запуск Google OAuth через Chrome Identity API...');

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
        sendResponse({
          success: false,
          error: chrome.runtime.lastError.message
        });
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

              // Отправляем успешный ответ
              sendResponse({
                success: true,
                user: {
                  email: payload.email,
                  name: payload.name,
                  picture: payload.picture
                }
              });

              // Закрываем вкладку авторизации через 500ms
              setTimeout(() => {
                if (authTabId) {
                  chrome.tabs.remove(authTabId).catch(() => {
                    console.log('Вкладка уже закрыта или недоступна');
                  });
                  authTabId = null;
                }
              }, 500);
            });
          } else {
            console.error('❌ ID Token не найден в URL');
            sendResponse({
              success: false,
              error: 'ID Token не найден в ответе OAuth'
            });
          }
        } catch (error) {
          console.error('❌ Ошибка обработки OAuth redirect:', error);
          sendResponse({
            success: false,
            error: error.message
          });
        }
      } else {
        console.error('❌ Redirect URL не содержит id_token');
        console.log('Redirect URL:', redirectedUrl);
        sendResponse({
          success: false,
          error: 'OAuth redirect не содержит id_token'
        });
      }
    }
  );
}

/**
 * Обработка сообщений от auth.html и других компонентов
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 Получено сообщение:', request.type);

  // Запуск Google OAuth
  if (request.type === 'startOAuth') {
    // Сохраняем ID вкладки отправителя
    if (sender.tab && sender.tab.id) {
      authTabId = sender.tab.id;
      console.log('Auth Tab ID установлен:', authTabId);
    }

    startGoogleOAuth(sendResponse);
    return true; // Асинхронный ответ
  }

  // Получение данных пользователя из storage
  if (request.type === 'getUserData') {
    chrome.storage.local.get(['user', 'idToken', 'authenticated'], (result) => {
      sendResponse(result);
    });
    return true;
  }

  // Проверка авторизации
  if (request.type === 'checkAuth') {
    chrome.storage.local.get(['authenticated', 'user'], (result) => {
      sendResponse({
        authenticated: result.authenticated || false,
        user: result.user || null
      });
    });
    return true;
  }

  // Выход из аккаунта
  if (request.type === 'logout') {
    chrome.storage.local.clear(() => {
      console.log('✅ Данные пользователя удалены');
      sendResponse({ success: true });
    });
    return true;
  }
});

/**
 * Обработка установки/обновления расширения
 */
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('📦 Video Reader AI установлено! Версия:', chrome.runtime.getManifest().version);
    console.log('Extension ID:', chrome.runtime.id);
    console.log('Redirect URI:', REDIRECT_URI);

    // Открываем страницу авторизации при первой установке
    chrome.tabs.create({
      url: chrome.runtime.getURL('auth.html')
    }, (tab) => {
      authTabId = tab.id;
    });
  } else if (details.reason === 'update') {
    const previousVersion = details.previousVersion;
    const currentVersion = chrome.runtime.getManifest().version;
    console.log(`📦 Video Reader AI обновлено с ${previousVersion} на ${currentVersion}`);
  }
});

console.log('✅ Background Service Worker полностью инициализирован');
console.log('📋 Доступные команды: startOAuth, getUserData, checkAuth, logout');
