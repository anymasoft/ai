// Video Reader AI - Authentication Script
// Вся логика OAuth находится в background.js

console.log('🚀 Auth script загружен');
console.log('Extension ID:', chrome.runtime.id);

// Кнопка Google Sign In
const googleSignInBtn = document.getElementById('googleSignInBtn');

// Обработчик клика на кнопку "Continue with Google"
if (googleSignInBtn) {
  googleSignInBtn.addEventListener('click', (e) => {
    e.preventDefault();
    console.log('🔘 Клик на кнопку "Continue with Google"');

    // Отправляем сообщение в background.js для запуска OAuth
    chrome.runtime.sendMessage({ type: 'login' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('❌ Ошибка отправки сообщения:', chrome.runtime.lastError.message);
        alert('Ошибка связи с background service. Попробуйте перезагрузить расширение.');
      } else {
        console.log('✅ Сообщение отправлено в background.js:', response);
      }
    });
  });

  console.log('✅ Обработчик кнопки Google Sign In установлен');
} else {
  console.error('❌ Кнопка googleSignInBtn не найдена!');
}

// Слушаем сообщения от background.js об успешной авторизации
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'authSuccess') {
    console.log('✅ Авторизация успешна!', message.user);

    // Показываем сообщение пользователю
    alert(`Добро пожаловать, ${message.user.name || message.user.email}! Вы успешно авторизованы.`);

    // Можно перенаправить на другую страницу или закрыть текущую
    // window.location.href = 'main.html';
    // или
    // window.close();
  }
});

console.log('✅ Auth script готов к работе');
