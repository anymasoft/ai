// Video Reader AI - Authentication UI Script
// UI popup - просто отправляет сообщение в background.js для OAuth

console.log('🚀 Auth UI script загружен');

// Кнопка Google Sign In
const googleSignInBtn = document.getElementById('googleSignInBtn');

// Обработчик клика на кнопку "Continue with Google"
if (googleSignInBtn) {
  googleSignInBtn.addEventListener('click', (e) => {
    e.preventDefault();
    console.log('🔘 Клик на "Continue with Google" - отправка сообщения в background');

    // Отправляем сообщение в background.js для запуска OAuth
    // Вся OAuth логика находится там (chrome.identity.launchWebAuthFlow)
    chrome.runtime.sendMessage({ type: 'login' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('❌ Ошибка отправки сообщения:', chrome.runtime.lastError.message);
        alert('Ошибка связи с background service. Попробуйте перезагрузить расширение.');
      } else {
        console.log('✅ Сообщение отправлено в background.js');
      }
    });
  });

  console.log('✅ Обработчик кнопки установлен');
} else {
  console.error('❌ Кнопка googleSignInBtn не найдена!');
}

// Слушаем сообщения от background.js об успешной авторизации
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'authSuccess') {
    console.log('✅ Получено уведомление об успешной авторизации:', message.user);

    // Показываем сообщение пользователю
    const userName = message.user.name || message.user.email || 'пользователь';
    alert(`Добро пожаловать, ${userName}! Вы успешно авторизованы.`);

    // Опционально: можно закрыть окно или перенаправить
    // window.close();
    // window.location.href = 'main.html';
  }
});

console.log('✅ Auth UI готов (OAuth через background.js)');
