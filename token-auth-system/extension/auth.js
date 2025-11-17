// Google OAuth popup handler
// Открывает Google OAuth окно 480×640 при нажатии на кнопку
// И слушает postMessage от OAuth callback для получения токена

console.log('[auth.js] Скрипт загружен');

// ═══════════════════════════════════════════════════════════════════
// КРИТИЧЕСКИ ВАЖНО: Обработчик postMessage от OAuth callback popup
// ═══════════════════════════════════════════════════════════════════

// Слушаем postMessage от OAuth callback popup (window.opener.postMessage)
window.addEventListener('message', function(event) {
  console.log('[auth.js] Получено postMessage событие');
  console.log('[auth.js] event.origin:', event.origin);
  console.log('[auth.js] event.data:', event.data);

  // Проверяем что сообщение от нашего сервера (localhost:5000)
  if (event.origin !== 'http://localhost:5000') {
    console.log('[auth.js] Игнорируем сообщение - неверный origin:', event.origin);
    return;
  }

  // Проверяем тип сообщения
  if (event.data && event.data.type === 'AUTH_SUCCESS') {
    console.log('[auth.js] ✅ Получен AUTH_SUCCESS от OAuth callback');
    console.log('[auth.js] Token:', event.data.token?.substring(0, 8) + '...');
    console.log('[auth.js] Email:', event.data.email);

    const token = event.data.token;
    const email = event.data.email;

    // Пересылаем токен и email в background.js через chrome.runtime.sendMessage
    if (token && email) {
      console.log('[auth.js] Отправляем сообщение в background.js...');

      chrome.runtime.sendMessage({
        type: 'AUTH_SUCCESS',
        token: token,
        email: email
      }, function(response) {
        if (chrome.runtime.lastError) {
          console.error('[auth.js] ❌ Ошибка отправки в background:', chrome.runtime.lastError);
        } else {
          console.log('[auth.js] ✅ Сообщение отправлено в background.js:', response);
        }
      });

      // КРИТИЧЕСКИ ВАЖНО: Устанавливаем cookie ЛОКАЛЬНО перед редиректом
      console.log('[auth.js] Устанавливаем cookie auth_token и auth_email...');
      document.cookie = `auth_token=${token}; path=/; max-age=2592000; SameSite=Lax`;
      document.cookie = `auth_email=${email}; path=/; max-age=2592000; SameSite=Lax`;
      console.log('[auth.js] ✅ Cookie установлены');

      // Показываем успешное сообщение пользователю
      const statusEl = document.getElementById('status');
      if (statusEl) {
        statusEl.textContent = `✅ Авторизация успешна! Email: ${email}`;
        statusEl.className = 'status success';
        statusEl.classList.remove('hidden');
      }

      // Делаем redirect на страницу pricing через 1 секунду
      setTimeout(function() {
        console.log('[auth.js] Делаем redirect на /pricing...');
        window.location.href = 'http://localhost:5000/pricing';
      }, 1000);
    } else {
      console.error('[auth.js] ❌ Токен или email отсутствуют в сообщении');
    }
  } else {
    console.log('[auth.js] Неизвестный тип сообщения:', event.data?.type);
  }
});

console.log('[auth.js] Обработчик postMessage установлен');

// ═══════════════════════════════════════════════════════════════════
// Обработчик кнопки "Sign in with Google"
// ═══════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', function() {
  console.log('[auth.js] DOMContentLoaded - инициализация кнопки');

  const googleSignInBtn = document.getElementById('googleSignInBtn');

  if (googleSignInBtn) {
    console.log('[auth.js] Кнопка Sign In найдена');

    googleSignInBtn.addEventListener('click', function() {
      console.log('[auth.js] Кнопка Sign In нажата');

      // Temporary CLIENT_ID (заглушка)
      const CLIENT_ID = '431567664470-mq0oim46t6tstlfjllbesuar346pf2qu.apps.googleusercontent.com';
      const REDIRECT_URI = 'http://localhost:5000/auth/callback';
      const SCOPE = 'openid email profile';

      // Формируем Google OAuth URL
      const oauthUrl = 'https://accounts.google.com/o/oauth2/v2/auth' +
        '?client_id=' + encodeURIComponent(CLIENT_ID) +
        '&response_type=code' +
        '&redirect_uri=' + encodeURIComponent(REDIRECT_URI) +
        '&scope=' + encodeURIComponent(SCOPE) +
        '&prompt=select_account';

      console.log('[auth.js] OAuth URL сформирован:', oauthUrl);

      // Размеры окна
      const width = 480;
      const height = 640;

      // Центрируем окно на экране
      const left = (screen.width - width) / 2;
      const top = (screen.height - height) / 2;

      console.log('[auth.js] Открываем OAuth popup...');

      // Открываем popup
      const popup = window.open(
        oauthUrl,
        'GoogleOAuth',
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
      );

      if (popup) {
        console.log('[auth.js] ✅ OAuth popup открыт успешно');
      } else {
        console.error('[auth.js] ❌ Не удалось открыть OAuth popup - возможно заблокирован браузером');
      }
    });
  } else {
    console.error('[auth.js] ❌ Кнопка Sign In не найдена!');
  }
});
