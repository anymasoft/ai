// Video Reader AI - Auth Popup Script с кастомным OAuth popup и polling

console.log('🚀 Auth Popup загружен');

// Google OAuth Configuration
const GOOGLE_CLIENT_ID = "431567664470-tnur42uavtfv279g05e2vq58q9b45ecg.apps.googleusercontent.com";
const EXTENSION_ID = chrome.runtime.id;
const REDIRECT_URI = `https://${EXTENSION_ID}.chromiumapp.org/`;

console.log('Extension ID:', EXTENSION_ID);
console.log('Redirect URI:', REDIRECT_URI);

const googleSignInBtn = document.getElementById('googleSignInBtn');

// Проверяем авторизацию при загрузке страницы
checkAuthStatus();

function checkAuthStatus() {
  chrome.storage.local.get(['authenticated', 'user'], (result) => {
    if (result.authenticated && result.user) {
      console.log('✅ Пользователь уже авторизован:', result.user);
      showAuthenticatedState(result.user);
    } else {
      console.log('❌ Пользователь не авторизован');
      showUnauthenticatedState();
    }
  });
}

function showAuthenticatedState(user) {
  const container = document.querySelector('.auth-container');
  container.innerHTML = `
    <div class="text-center">
      <div class="mb-4">
        <img src="${user.picture || 'vr_logo_small.png'}" alt="${user.name}" class="w-20 h-20 rounded-full mx-auto border-4 border-blue-500">
      </div>
      <h1 class="text-2xl font-bold mb-2">С возвращением!</h1>
      <p class="text-gray-400 text-lg mb-2">${user.name}</p>
      <p class="text-gray-500 text-sm mb-6">${user.email}</p>

      <button
        id="logoutBtn"
        class="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200"
      >
        Выйти
      </button>
    </div>
  `;

  const logoutBtn = document.getElementById('logoutBtn');
  logoutBtn.addEventListener('click', () => {
    chrome.storage.local.clear(() => {
      console.log('✅ Данные пользователя удалены');
      location.reload();
    });
  });
}

function showUnauthenticatedState() {
  if (!googleSignInBtn) {
    console.error('❌ Кнопка googleSignInBtn не найдена!');
    return;
  }

  googleSignInBtn.addEventListener('click', () => {
    console.log('🔘 Клик на "Продолжить с Google"');
    startGoogleOAuth();
  });

  console.log('✅ Обработчик кнопки установлен');
}

function startGoogleOAuth() {
  console.log('🔐 Запуск Google OAuth через кастомный popup...');

  // Блокируем кнопку на время авторизации
  googleSignInBtn.disabled = true;
  googleSignInBtn.innerHTML = '<span>Авторизация...</span>';

  // Формируем URL для Google OAuth (Implicit Flow с id_token)
  const authUrl =
    "https://accounts.google.com/o/oauth2/auth" +
    `?client_id=${GOOGLE_CLIENT_ID}` +
    `&response_type=id_token` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&scope=${encodeURIComponent("openid email profile")}` +
    "&prompt=consent";

  console.log('Auth URL:', authUrl);

  // Вычисляем позицию popup по центру экрана
  const popupWidth = 480;
  const popupHeight = 640;
  const screenLeft = window.screenLeft || window.screenX;
  const screenTop = window.screenTop || window.screenY;
  const screenWidth = window.innerWidth || document.documentElement.clientWidth || screen.width;
  const screenHeight = window.innerHeight || document.documentElement.clientHeight || screen.height;

  const left = screenLeft + (screenWidth - popupWidth) / 2;
  const top = screenTop + (screenHeight - popupHeight) / 2;

  const windowFeatures = `width=${popupWidth},height=${popupHeight},left=${left},top=${top},toolbar=no,menubar=no,location=no,status=no`;

  console.log('Открываем кастомный popup:', windowFeatures);

  // Открываем кастомный popup
  const popup = window.open(authUrl, "vr_google_auth", windowFeatures);

  if (!popup) {
    console.error('❌ Не удалось открыть popup окно');
    alert('Не удалось открыть окно авторизации. Проверьте, что popup окна не заблокированы.');
    googleSignInBtn.disabled = false;
    googleSignInBtn.innerHTML = '<img src="images/google.svg" alt="Google" class="w-5 h-5"><span>Продолжить с Google</span>';
    return;
  }

  console.log('✅ Popup окно открыто, начинаем polling...');

  // Запускаем polling для отслеживания redirect
  const pollInterval = setInterval(() => {
    try {
      // Проверяем URL popup окна
      if (!popup || popup.closed) {
        console.log('❌ Popup окно закрыто пользователем');
        clearInterval(pollInterval);
        googleSignInBtn.disabled = false;
        googleSignInBtn.innerHTML = '<img src="images/google.svg" alt="Google" class="w-5 h-5"><span>Продолжить с Google</span>';
        return;
      }

      const popupUrl = popup.location.href;

      // Проверяем, содержит ли URL redirect URI и id_token
      if (popupUrl.includes('chromiumapp.org') && popupUrl.includes('id_token')) {
        console.log('✅ Получен redirect с id_token');

        // Останавливаем polling
        clearInterval(pollInterval);

        // Извлекаем id_token из hash параметров
        const hash = new URL(popupUrl).hash.substring(1); // Убираем #
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

            // Закрываем popup
            popup.close();

            // Обновляем UI
            showAuthenticatedState({
              email: payload.email,
              name: payload.name,
              picture: payload.picture
            });
          });
        } else {
          console.error('❌ ID Token не найден в URL');
          popup.close();
          alert('Ошибка авторизации. Попробуйте снова.');
          googleSignInBtn.disabled = false;
          googleSignInBtn.innerHTML = '<img src="images/google.svg" alt="Google" class="w-5 h-5"><span>Продолжить с Google</span>';
        }
      }
    } catch (error) {
      // Ошибки cross-origin - это нормально до redirect
      // Просто продолжаем polling
    }
  }, 250); // Проверяем каждые 250ms

  // Таймаут для предотвращения бесконечного polling
  setTimeout(() => {
    if (popup && !popup.closed) {
      console.log('⏱️ Таймаут авторизации');
      clearInterval(pollInterval);
      popup.close();
      googleSignInBtn.disabled = false;
      googleSignInBtn.innerHTML = '<img src="images/google.svg" alt="Google" class="w-5 h-5"><span>Продолжить с Google</span>';
    }
  }, 120000); // 2 минуты таймаут
}

console.log('✅ Auth Popup готов к работе');
