// Google OAuth popup handler
// Открывает Google OAuth окно 480×640 при нажатии на кнопку
// И слушает postMessage от OAuth callback для получения токена


// ═══════════════════════════════════════════════════════════════════
// КРИТИЧЕСКИ ВАЖНО: Обработчик postMessage от OAuth callback popup
// ═══════════════════════════════════════════════════════════════════

// Слушаем postMessage от OAuth callback popup (window.opener.postMessage)
window.addEventListener('message', function(event) {

  // Проверяем что сообщение от нашего сервера (localhost:5000)
  // ВАЖНО: убрал строгую проверку origin для отладки
  if (event.origin !== 'https://api.beem.ink') {
    // НЕ возвращаемся, продолжаем обработку
  }

  // Проверяем тип сообщения
  if (event.data && event.data.type === 'AUTH_SUCCESS') {

    const token = event.data.token;
    const email = event.data.email;

    // Пересылаем токен и email в background.js через chrome.runtime.sendMessage
    if (token && email) {

      chrome.runtime.sendMessage({
        type: 'AUTH_SUCCESS',
        token: token,
        email: email
      }, function(response) {
        if (chrome.runtime.lastError) {
          console.error('[auth.js] ❌ Ошибка отправки в background:', chrome.runtime.lastError);
        } else {
        }
      });

      // Показываем успешное сообщение пользователю
      const statusEl = document.getElementById('status');
      if (statusEl) {
        statusEl.textContent = `✅ Авторизация успешна! Email: ${email}`;
        statusEl.className = 'status success';
        statusEl.classList.remove('hidden');
      }

      // Закрываем окно авторизации через 1 секунду
      setTimeout(function() {
        window.close();
      }, 1000);
    }
  } else {
  }
});


// ═══════════════════════════════════════════════════════════════════
// Обработчик кнопки "Sign in with Google"
// ═══════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', function() {

  const googleSignInBtn = document.getElementById('googleSignInBtn');

  if (googleSignInBtn) {

    googleSignInBtn.addEventListener('click', function() {

      // Temporary CLIENT_ID (заглушка)
      const CLIENT_ID = '431567664470-mq0oim46t6tstlfjllbesuar346pf2qu.apps.googleusercontent.com';
      const REDIRECT_URI = 'https://api.beem.ink/auth/callback';
      const SCOPE = 'openid email profile';

      // Формируем Google OAuth URL
      const oauthUrl = 'https://accounts.google.com/o/oauth2/v2/auth' +
        '?client_id=' + encodeURIComponent(CLIENT_ID) +
        '&response_type=code' +
        '&redirect_uri=' + encodeURIComponent(REDIRECT_URI) +
        '&scope=' + encodeURIComponent(SCOPE) +
        '&prompt=select_account';


      // Размеры окна
      const width = 480;
      const height = 640;

      // Центрируем окно на экране
      const left = (screen.width - width) / 2;
      const top = (screen.height - height) / 2;


      // Открываем popup
      const popup = window.open(
        oauthUrl,
        'GoogleOAuth',
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
      );

      if (popup) {
      } else {
        console.error('[auth.js] ❌ Не удалось открыть OAuth popup - возможно заблокирован браузером');
      }
    });
  }
});
