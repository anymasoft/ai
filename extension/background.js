// background.js - Service Worker для Video Reader AI

// Google OAuth Configuration
const GOOGLE_CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com";
const REDIRECT_URI = `https://${chrome.runtime.id}.chromiumapp.org/`;

// Функция авторизации через Google OAuth
function loginWithGoogle() {
  console.log('🔐 Запуск Google OAuth авторизации...');
  console.log('Extension ID:', chrome.runtime.id);
  console.log('Redirect URI:', REDIRECT_URI);

  // Формируем URL для Google OAuth (Authorization Code Flow)
  const authUrl =
    "https://accounts.google.com/o/oauth2/auth" +
    `?client_id=${GOOGLE_CLIENT_ID}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&scope=${encodeURIComponent("openid email profile")}` +
    `&access_type=offline` +
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
        return;
      }

      if (redirectedUrl && redirectedUrl.includes("code=")) {
        try {
          // Извлекаем authorization code из query параметров
          const url = new URL(redirectedUrl);
          const code = url.searchParams.get('code');

          if (code) {
            console.log('✅ Authorization Code получен:', code.substring(0, 20) + '...');

            // ВРЕМЕННО: Сохраняем code в storage для проверки
            // В production нужно отправить code на backend для обмена на токены
            chrome.storage.local.set({
              authCode: code,
              authenticated: true,
              timestamp: Date.now()
            }, () => {
              console.log('✅ Authorization Code сохранен в storage');
              console.log('⚠️ ВАЖНО: Этот код нужно обменять на токены через backend!');
              console.log('⚠️ Authorization Code действителен ~10 минут');

              // Уведомляем UI об успешной авторизации
              chrome.runtime.sendMessage({
                type: 'authSuccess',
                user: {
                  // Пока нет данных пользователя - нужен обмен code на id_token
                  email: 'pending',
                  name: 'Авторизация успешна (требуется обмен кода)'
                }
              }).catch(() => {
                // Игнорируем ошибку если нет слушателей
              });
            });
          } else {
            console.error('❌ Authorization Code не найден в URL');
          }
        } catch (error) {
          console.error('❌ Ошибка обработки OAuth redirect:', error);
        }
      } else {
        console.error('❌ Redirect URL не содержит code');
        console.log('Redirect URL:', redirectedUrl);
      }
    }
  );
}

// Обработка клика на иконку расширения
chrome.action.onClicked.addListener((tab) => {
  // Открываем страницу авторизации в новой вкладке
  chrome.tabs.create({
    url: chrome.runtime.getURL('index.html')
  });
});

// Обработка установки расширения
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Video Reader AI установлено! Версия:', chrome.runtime.getManifest().version);

    // Открываем страницу авторизации при первой установке
    chrome.tabs.create({
      url: chrome.runtime.getURL('index.html')
    });
  } else if (details.reason === 'update') {
    const previousVersion = details.previousVersion;
    const currentVersion = chrome.runtime.getManifest().version;
    console.log(`Video Reader AI обновлено с ${previousVersion} на ${currentVersion}`);
  }
});

// Обработка сообщений от content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Google OAuth Login
  if (request.type === 'login') {
    console.log('📨 Получено сообщение: запуск Google OAuth');
    loginWithGoogle();
    sendResponse({ success: true });
    return true;
  }

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
      url: chrome.runtime.getURL('index.html')
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
