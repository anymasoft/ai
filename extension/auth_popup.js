// Video Reader AI - Auth Popup Script
// Отправляет сообщение в background.js для запуска OAuth

console.log('🚀 Auth Popup загружен');

const googleSignInBtn = document.getElementById('googleSignInBtn');

if (googleSignInBtn) {
  googleSignInBtn.addEventListener('click', () => {
    console.log('🔘 Клик на "Продолжить с Google"');

    // Блокируем кнопку на время авторизации
    googleSignInBtn.disabled = true;
    googleSignInBtn.textContent = 'Авторизация...';

    // Отправляем сообщение в background.js для запуска OAuth
    chrome.runtime.sendMessage({ type: 'login' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('❌ Ошибка:', chrome.runtime.lastError.message);
        googleSignInBtn.disabled = false;
        googleSignInBtn.innerHTML = '<img src="images/google.svg" alt="Google" class="w-5 h-5"><span>Продолжить с Google</span>';
        alert('Ошибка связи с расширением. Попробуйте перезагрузить страницу.');
      } else {
        console.log('✅ Сообщение отправлено в background.js');
      }
    });
  });

  console.log('✅ Обработчик кнопки установлен');
} else {
  console.error('❌ Кнопка googleSignInBtn не найдена!');
}

// Слушаем сообщения от background.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'authSuccess') {
    console.log('✅ Авторизация успешна!', message.user);

    // Закрываем popup окно после успешной авторизации
    window.close();
  }

  if (message.type === 'authError') {
    console.error('❌ Ошибка авторизации:', message.error);

    // Разблокируем кнопку
    googleSignInBtn.disabled = false;
    googleSignInBtn.innerHTML = '<img src="images/google.svg" alt="Google" class="w-5 h-5"><span>Продолжить с Google</span>';

    alert('Ошибка авторизации. Попробуйте снова.');
  }
});

console.log('✅ Auth Popup готов к работе');
