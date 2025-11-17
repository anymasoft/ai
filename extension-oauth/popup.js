// Popup script для OAuth авторизации
// Vanilla JavaScript - БЕЗ React, БЕЗ фреймворков

console.log('[VideoReader Popup] Popup loaded');

// DOM элементы
const loadingState = document.getElementById('loading-state');
const loginState = document.getElementById('login-state');
const userState = document.getElementById('user-state');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userEmail = document.getElementById('user-email');
const userPlan = document.getElementById('user-plan');

// Показать состояние
function showState(state) {
  loadingState.classList.add('hidden');
  loginState.classList.add('hidden');
  userState.classList.add('hidden');

  if (state === 'loading') {
    loadingState.classList.remove('hidden');
  } else if (state === 'login') {
    loginState.classList.remove('hidden');
  } else if (state === 'user') {
    userState.classList.remove('hidden');
  }
}

// Загрузка данных пользователя
async function loadUserData() {
  showState('loading');

  try {
    // Проверяем наличие токена
    const storage = await chrome.storage.local.get(['auth_token']);
    const token = storage.auth_token;

    console.log('[VideoReader Popup] Storage:', storage);
    console.log('[VideoReader Popup] Token:', token);

    if (!token) {
      console.log('[VideoReader Popup] No token found');
      showState('login');
      return;
    }

    console.log('[VideoReader Popup] Token found, requesting plan...');

    // Запрашиваем план через background
    const planData = await chrome.runtime.sendMessage({ type: 'get-plan' });

    console.log('[VideoReader Popup] Plan data received:', planData);

    if (planData && planData.email) {
      // Пользователь авторизован
      console.log('[VideoReader Popup] User authenticated:', planData.email, planData.plan);
      userEmail.textContent = planData.email;
      userPlan.textContent = planData.plan || 'Free';
      showState('user');
    } else {
      // Токен невалидный
      console.log('[VideoReader Popup] Invalid token or no email in response');
      showState('login');
    }
  } catch (error) {
    console.error('[VideoReader Popup] Error loading user data:', error);
    showState('login');
  }
}

// Обработчик кнопки Login
loginBtn.addEventListener('click', () => {
  console.log('[VideoReader Popup] Login button clicked');

  // Отправляем сообщение в background для открытия OAuth окна
  chrome.runtime.sendMessage({ type: 'login' });

  // Слушаем изменения в storage
  const listener = (changes, areaName) => {
    if (areaName === 'local' && changes.auth_token) {
      console.log('[VideoReader Popup] Token updated, reloading user data');
      chrome.storage.onChanged.removeListener(listener);
      loadUserData();
    }
  };

  chrome.storage.onChanged.addListener(listener);

  // Закрываем popup (пользователь увидит OAuth окно)
  window.close();
});

// Обработчик кнопки Logout
logoutBtn.addEventListener('click', async () => {
  console.log('[VideoReader Popup] Logout button clicked');

  // Удаляем токен
  await chrome.storage.local.remove('auth_token');

  // Показываем экран логина
  showState('login');
});

// Загрузка при открытии popup
loadUserData();
