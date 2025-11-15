// Auth.js - Логика авторизации для auth.html

console.log('🚀 Auth.js загружен');

const googleSignInBtn = document.getElementById('googleSignInBtn');
const statusEl = document.getElementById('status');

/**
 * Проверка авторизации при загрузке страницы
 */
function checkAuthStatus() {
  chrome.runtime.sendMessage({ type: 'checkAuth' }, (response) => {
    if (response && response.authenticated) {
      console.log('✅ Пользователь уже авторизован:', response.user);
      showAuthenticatedState(response.user);
    } else {
      console.log('❌ Пользователь не авторизован');
      showUnauthenticatedState();
    }
  });
}

/**
 * Показать авторизованное состояние
 */
function showAuthenticatedState(user) {
  const container = document.querySelector('.container');
  container.innerHTML = `
    <div class="logo-container">
      <img src="${user.picture || 'vr_logo_small.png'}" alt="${user.name}" class="user-avatar">
    </div>
    
    <h1 class="title">С возвращением!</h1>
    <p class="subtitle">${user.name}</p>
    <p class="email">${user.email}</p>

    <div class="success-message">
      <svg class="checkmark" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
      </svg>
      <p>Авторизация успешна!</p>
    </div>

    <button id="logoutBtn" class="logout-button">Выйти</button>
  `;

  // Обработчик выхода
  const logoutBtn = document.getElementById('logoutBtn');
  logoutBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'logout' }, (response) => {
      if (response.success) {
        console.log('✅ Выход выполнен');
        location.reload();
      }
    });
  });

  // Автоматически закрываем вкладку через 2 секунды
  setTimeout(() => {
    window.close();
  }, 2000);
}

/**
 * Показать состояние без авторизации
 */
function showUnauthenticatedState() {
  // Кнопка уже есть на странице, просто добавляем обработчик
  if (googleSignInBtn) {
    googleSignInBtn.addEventListener('click', startOAuth);
    console.log('✅ Обработчик кнопки установлен');
  } else {
    console.error('❌ Кнопка googleSignInBtn не найдена!');
  }
}

/**
 * Запуск OAuth авторизации
 */
function startOAuth() {
  console.log('🔘 Клик на "Продолжить с Google"');

  // Блокируем кнопку
  googleSignInBtn.disabled = true;
  googleSignInBtn.textContent = 'Авторизация...';

  // Показываем статус
  showStatus('Открываем окно Google OAuth...', 'info');

  // Отправляем сообщение в background.js для запуска OAuth
  chrome.runtime.sendMessage({ type: 'startOAuth' }, (response) => {
    console.log('Ответ от background:', response);

    if (response && response.success) {
      console.log('✅ Авторизация успешна!', response.user);
      showStatus('Авторизация успешна!', 'success');
      
      // Показываем авторизованное состояние
      setTimeout(() => {
        showAuthenticatedState(response.user);
      }, 500);
    } else {
      console.error('❌ Ошибка авторизации:', response ? response.error : 'Нет ответа');
      showStatus('Ошибка: ' + (response ? response.error : 'Нет ответа от сервера'), 'error');
      
      // Разблокируем кнопку
      googleSignInBtn.disabled = false;
      googleSignInBtn.innerHTML = '<svg class="google-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg><span>Продолжить с Google</span>';
    }
  });
}

/**
 * Показать статус сообщение
 */
function showStatus(message, type = 'info') {
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
    statusEl.classList.remove('hidden');
  }
}

// Проверяем авторизацию при загрузке
checkAuthStatus();

console.log('✅ Auth.js готов к работе');
