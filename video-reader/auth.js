// Google OAuth popup handler
// Открывает Google OAuth окно 480×640 при нажатии на кнопку

document.addEventListener('DOMContentLoaded', function() {
  const googleSignInBtn = document.getElementById('googleSignInBtn');

  if (googleSignInBtn) {
    googleSignInBtn.addEventListener('click', function() {
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

      // Размеры окна
      const width = 480;
      const height = 640;

      // Центрируем окно на экране
      const left = (screen.width - width) / 2;
      const top = (screen.height - height) / 2;

      // Открываем popup
      window.open(
        oauthUrl,
        'GoogleOAuth',
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
      );
    });
  }

  // Слушаем postMessage от OAuth callback popup
  window.addEventListener('message', function(event) {
    // Проверяем origin для безопасности
    if (event.origin !== window.location.origin) {
      return;
    }

    // Проверяем тип сообщения
    if (event.data && event.data.type === 'AUTH_SUCCESS' && event.data.token) {
      console.log('[VideoReader Auth] Получен токен от OAuth popup');

      // Перенаправляем на страницу тарифов
      window.location.href = '/pricing';
    }
  });
});
