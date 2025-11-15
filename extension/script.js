// Video Reader AI - Authentication Script
// Кастомное popup окно для Google OAuth

console.log('🚀 Auth script загружен');
console.log('Extension ID:', chrome.runtime.id);

// Google OAuth Configuration
const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';
const REDIRECT_URI = `https://${chrome.runtime.id}.chromiumapp.org/`;

// Кнопка Google Sign In
const googleSignInBtn = document.getElementById('googleSignInBtn');

// Функция открытия Google OAuth в кастомном popup окне
function openGoogleAuthPopup() {
  console.log('🔐 Запуск Google OAuth авторизации...');
  console.log('Extension ID:', chrome.runtime.id);
  console.log('Redirect URI:', REDIRECT_URI);

  // Формируем URL для Google OAuth
  const authUrl = new URL('https://accounts.google.com/o/oauth2/auth');
  authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
  authUrl.searchParams.set('response_type', 'id_token');
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('scope', 'openid email profile');
  authUrl.searchParams.set('prompt', 'consent');
  authUrl.searchParams.set('nonce', Math.random().toString(36).substring(2));

  console.log('Auth URL:', authUrl.toString());

  // Размеры popup окна - компактное окно 480x640
  const popupWidth = 480;
  const popupHeight = 640;

  // Получаем размеры экрана
  const screenWidth = screen.width;
  const screenHeight = screen.height;

  // Вычисляем позицию по центру экрана
  const left = Math.round((screenWidth - popupWidth) / 2);
  const top = Math.round((screenHeight - popupHeight) / 2);

  // Логируем параметры для отладки
  console.log('=== Параметры Popup окна ===');
  console.log('Размеры экрана:', { width: screenWidth, height: screenHeight });
  console.log('Размеры popup:', { width: popupWidth, height: popupHeight });
  console.log('Позиция:', { left, top });
  console.log('Расчет центра:', {
    leftCalc: `(${screenWidth} - ${popupWidth}) / 2 = ${left}`,
    topCalc: `(${screenHeight} - ${popupHeight}) / 2 = ${top}`
  });

  // Параметры popup - компактное, без изменения размера
  const popupFeatures = [
    "popup=yes",
    `width=${popupWidth}`,
    `height=${popupHeight}`,
    `left=${left}`,
    `top=${top}`,
    "scrollbars=no",
    "resizable=no",
    "toolbar=no",
    "menubar=no",
    "status=no"
  ].join(",");

  console.log('Popup features:', popupFeatures);

  // Открываем popup окно
  const popup = window.open(authUrl.toString(), 'VideoReaderAI OAuth', popupFeatures);

  if (!popup) {
    console.error('❌ Popup заблокирован браузером');
    alert('Popup окно заблокировано. Разрешите popup для этого сайта и попробуйте снова.');
    return;
  }

  console.log('✅ Popup окно открыто');
  console.log('Свойства popup:', {
    innerWidth: popup.innerWidth,
    innerHeight: popup.innerHeight,
    screenX: popup.screenX,
    screenY: popup.screenY
  });

  // Мониторим popup для получения redirect URL с id_token
  const pollTimer = setInterval(() => {
    try {
      // Проверяем закрыто ли окно
      if (popup.closed) {
        clearInterval(pollTimer);
        console.log('❌ Popup закрыто пользователем');
        return;
      }

      // Проверяем URL popup окна (это работает только когда popup на нашем домене)
      if (popup.location.href.indexOf(REDIRECT_URI) === 0) {
        clearInterval(pollTimer);
        console.log('✅ Получен redirect URL:', popup.location.href);

        // Извлекаем id_token из hash параметров
        const hash = popup.location.hash.substring(1); // Убираем #
        const params = new URLSearchParams(hash);
        const idToken = params.get('id_token');

        // Закрываем popup
        popup.close();

        if (idToken) {
          console.log('✅ ID Token получен:', idToken.substring(0, 50) + '...');

          // Декодируем JWT для получения данных пользователя
          try {
            const payload = JSON.parse(atob(idToken.split('.')[1]));
            console.log('👤 Данные пользователя:', payload);

            // Сохраняем в chrome.storage
            chrome.storage.local.set({
              idToken: idToken,
              user: {
                email: payload.email,
                name: payload.name,
                picture: payload.picture,
                sub: payload.sub // Google User ID
              },
              authenticated: true,
              auth_timestamp: Date.now()
            }, () => {
              console.log('✅ Данные сохранены в storage');
              alert(`Добро пожаловать, ${payload.name || payload.email}! Вы успешно авторизованы.`);

              // Можно перенаправить на другую страницу
              // window.location.href = 'main.html';
            });
          } catch (error) {
            console.error('❌ Ошибка декодирования JWT:', error);
            alert('Ошибка обработки токена');
          }
        } else {
          console.error('❌ ID Token не найден в URL');
          alert('Не удалось получить токен авторизации');
        }
      }
    } catch (error) {
      // Cross-origin ошибка - popup все еще на Google домене
      // Это нормально, продолжаем polling
    }
  }, 500);

  // Таймаут на случай если что-то пошло не так
  setTimeout(() => {
    if (popup && !popup.closed) {
      clearInterval(pollTimer);
      popup.close();
      console.log('⏱️ Таймаут OAuth flow');
    }
  }, 5 * 60 * 1000); // 5 минут
}

// Обработчик клика на кнопку "Continue with Google"
if (googleSignInBtn) {
  googleSignInBtn.addEventListener('click', (e) => {
    e.preventDefault();
    console.log('🔘 Клик на кнопку "Continue with Google"');

    // Открываем кастомное popup окно
    openGoogleAuthPopup();
  });

  console.log('✅ Обработчик кнопки Google Sign In установлен');
} else {
  console.error('❌ Кнопка googleSignInBtn не найдена!');
}

console.log('✅ Auth script готов к работе (кастомное popup окно)');
