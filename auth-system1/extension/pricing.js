// Pricing page logic - работа через cookies (credentials: include)
console.log('[Pricing] Скрипт загружен');

// Текущий план пользователя
let currentPlan = 'Free';
let currentEmail = '';

// Загрузка информации о пользователе через cookies
async function loadUserInfo() {
  console.log('[Pricing] Загрузка информации о пользователе через cookies...');

  const userInfoEl = document.getElementById('user-info');
  const authPromptEl = document.getElementById('auth-prompt');
  const userEmailEl = document.getElementById('userEmail');
  const currentPlanEl = document.getElementById('currentPlan');

  try {
    // Запрос к /api/plan с credentials: include (cookies автоматически отправятся)
    const response = await fetch('http://localhost:5000/api/plan', {
      method: 'GET',
      credentials: 'include', // ВАЖНО: отправляет cookies
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      currentPlan = data.plan || 'Free';
      currentEmail = data.email || '';
      console.log('[Pricing] ✅ Текущий план:', currentPlan, 'Email:', currentEmail);

      // Показываем user info
      if (userInfoEl) userInfoEl.style.display = 'flex';
      if (authPromptEl) authPromptEl.style.display = 'none';

      // Обновляем UI
      if (userEmailEl) userEmailEl.textContent = currentEmail;
      if (currentPlanEl) {
        currentPlanEl.textContent = currentPlan;

        // Меняем цвет бейджа в зависимости от плана
        currentPlanEl.className = 'px-3 py-1 rounded-full text-xs font-semibold';
        if (currentPlan === 'Free') {
          currentPlanEl.className += ' bg-gray-100 text-gray-800';
        } else if (currentPlan === 'Pro') {
          currentPlanEl.className += ' bg-blue-100 text-blue-800';
        } else if (currentPlan === 'Premium') {
          currentPlanEl.className += ' bg-purple-100 text-purple-800';
        }
      }

      // Обновляем кнопки тарифов
      updateButtons(currentPlan);
    } else {
      console.log('[Pricing] ❌ Ошибка получения плана, статус:', response.status);
      // Если cookie нет или невалидна - показываем кнопку Sign In
      if (authPromptEl) authPromptEl.style.display = 'flex';
      if (userInfoEl) userInfoEl.style.display = 'none';
      updateButtons('Free');
    }
  } catch (error) {
    console.error('[Pricing] ❌ Ошибка запроса плана:', error);
    // При ошибке показываем кнопку Sign In
    if (authPromptEl) authPromptEl.style.display = 'flex';
    if (userInfoEl) userInfoEl.style.display = 'none';
    updateButtons('Free');
  }
}

// Обновление кнопок тарифов в зависимости от текущего плана
function updateButtons(plan) {
  console.log('[Pricing] Обновление кнопок для плана:', plan);

  const btnFree = document.getElementById('btn-free');
  const btnPro = document.getElementById('btn-pro');
  const btnPremium = document.getElementById('btn-premium');

  // Функция для настройки кнопки
  function setButton(btn, text, disabled, onClick = null) {
    if (!btn) return;

    btn.textContent = text;
    btn.disabled = disabled;

    // Обновляем стили
    if (disabled) {
      btn.classList.add('opacity-50', 'cursor-not-allowed');
      btn.classList.remove('hover:bg-gray-50', 'hover:bg-blue-700');
    } else {
      btn.classList.remove('opacity-50', 'cursor-not-allowed');
      // Восстанавливаем hover эффекты в зависимости от стиля кнопки
      if (btn.classList.contains('bg-blue-600')) {
        btn.classList.add('hover:bg-blue-700');
      } else {
        btn.classList.add('hover:bg-gray-50');
      }
    }

    if (onClick) {
      btn.onclick = onClick;
    } else {
      btn.onclick = null;
    }
  }

  if (plan === 'Free') {
    setButton(btnFree, 'Current Plan', true);
    setButton(btnPro, 'Upgrade to Pro', false, () => switchPlan('Pro'));
    setButton(btnPremium, 'Upgrade to Premium', false, () => switchPlan('Premium'));
  } else if (plan === 'Pro') {
    setButton(btnFree, 'Downgrade to Free', false, () => switchPlan('Free'));
    setButton(btnPro, 'Current Plan', true);
    setButton(btnPremium, 'Upgrade to Premium', false, () => switchPlan('Premium'));
  } else if (plan === 'Premium') {
    setButton(btnFree, 'Downgrade to Free', false, () => switchPlan('Free'));
    setButton(btnPro, 'Downgrade to Pro', false, () => switchPlan('Pro'));
    setButton(btnPremium, 'Current Plan', true);
  }
}

// Переключение плана через cookie
async function switchPlan(newPlan) {
  console.log('[Pricing] Переключение на план:', newPlan);

  try {
    const response = await fetch(`http://localhost:5000/switch-plan/${newPlan}`, {
      method: 'POST',
      credentials: 'include', // ВАЖНО: отправляет cookies
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      console.log('[Pricing] ✅ План обновлен:', data);

      // Обновляем текущий план и UI
      currentPlan = newPlan;
      const currentPlanEl = document.getElementById('currentPlan');
      if (currentPlanEl) {
        currentPlanEl.textContent = newPlan;

        // Меняем цвет бейджа
        currentPlanEl.className = 'px-3 py-1 rounded-full text-xs font-semibold';
        if (newPlan === 'Free') {
          currentPlanEl.className += ' bg-gray-100 text-gray-800';
        } else if (newPlan === 'Pro') {
          currentPlanEl.className += ' bg-blue-100 text-blue-800';
        } else if (newPlan === 'Premium') {
          currentPlanEl.className += ' bg-purple-100 text-purple-800';
        }
      }

      updateButtons(newPlan);

      // Показываем уведомление
      showNotification(`✅ План успешно изменен на ${newPlan}!`, 'success');

      // HOT RELOAD: Отправляем сообщение расширению об обновлении плана
      // Это позволит расширению обновить UI без перезагрузки страницы YouTube
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({
            type: 'PLAN_UPDATED',
            newPlan: newPlan,
            email: currentEmail
          }, (response) => {
            if (chrome.runtime.lastError) {
              console.log('[Pricing] Chrome runtime недоступен (это нормально для обычного браузера)');
            } else {
              console.log('[Pricing] ✅ Сообщение PLAN_UPDATED отправлено в расширение');
            }
          });
        }
      } catch (e) {
        console.log('[Pricing] Расширение недоступно (это нормально для обычного браузера)');
      }
    } else {
      console.error('[Pricing] ❌ Ошибка обновления плана, статус:', response.status);

      if (response.status === 401) {
        showNotification('❌ Требуется авторизация. Войдите в систему.', 'error');
        // Показываем кнопку Sign In
        document.getElementById('auth-prompt').style.display = 'flex';
        document.getElementById('user-info').style.display = 'none';
      } else {
        showNotification('❌ Ошибка обновления плана. Попробуйте позже.', 'error');
      }
    }
  } catch (error) {
    console.error('[Pricing] ❌ Ошибка запроса обновления плана:', error);
    showNotification('❌ Ошибка соединения с сервером.', 'error');
  }
}

// Показ уведомления
function showNotification(message, type = 'info') {
  // Создаем элемент уведомления
  const notification = document.createElement('div');
  notification.className = `fixed top-4 right-4 px-6 py-4 rounded-lg shadow-lg text-white font-medium z-50 transition-all transform translate-x-0`;

  if (type === 'success') {
    notification.className += ' bg-green-600';
  } else if (type === 'error') {
    notification.className += ' bg-red-600';
  } else {
    notification.className += ' bg-blue-600';
  }

  notification.textContent = message;
  document.body.appendChild(notification);

  // Анимация появления
  setTimeout(() => {
    notification.style.transform = 'translateX(0)';
  }, 10);

  // Удаляем через 3 секунды
  setTimeout(() => {
    notification.style.transform = 'translateX(400px)';
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 3000);
}

// Logout - удаление cookie и обновление UI
async function logout() {
  console.log('[Pricing] Logout - удаление cookie...');

  try {
    // Пытаемся вызвать серверный logout (если маршрут существует)
    await fetch('http://localhost:5000/auth-site/logout', {
      method: 'GET',
      credentials: 'include'
    }).catch(() => {
      // Если маршрута нет - ничего страшного, cookie удалятся на клиенте
      console.log('[Pricing] Маршрут /auth-site/logout не найден, продолжаем');
    });

    // Обнуляем текущие данные
    currentPlan = 'Free';
    currentEmail = '';

    // Скрываем user-info, показываем auth-prompt
    document.getElementById('user-info').style.display = 'none';
    document.getElementById('auth-prompt').style.display = 'flex';

    // Обновляем кнопки тарифов
    updateButtons('Free');

    showNotification('✅ Вы вышли из системы', 'success');

    console.log('[Pricing] ✅ Logout успешен');
  } catch (error) {
    console.error('[Pricing] ❌ Ошибка logout:', error);
    showNotification('❌ Ошибка выхода из системы', 'error');
  }
}

// Отправка feedback
async function sendFeedback(message, email) {
  console.log('[Pricing] Отправка feedback:', { message, email });

  try {
    const response = await fetch('http://localhost:5000/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include', // Для отправки cookies
      body: JSON.stringify({
        message: message,
        email: email || null
      })
    });

    if (response.ok) {
      const data = await response.json();
      console.log('[Pricing] ✅ Feedback отправлен:', data);
      return { success: true };
    } else {
      console.error('[Pricing] ❌ Ошибка отправки feedback, статус:', response.status);
      return { success: false, error: 'server_error' };
    }
  } catch (error) {
    console.error('[Pricing] ❌ Ошибка запроса feedback:', error);
    return { success: false, error: 'network_error' };
  }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
  console.log('[Pricing] DOM загружен - инициализация...');
  loadUserInfo();

  // Привязываем обработчик Logout
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
    console.log('[Pricing] Обработчик Logout привязан');
  }

  // Привязываем обработчик формы Feedback
  const feedbackForm = document.getElementById('feedback-form');
  if (feedbackForm) {
    feedbackForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      console.log('[Pricing] Отправка формы feedback');

      const messageInput = document.getElementById('feedback-message');
      const emailInput = document.getElementById('feedback-email');
      const submitButton = feedbackForm.querySelector('button[type="submit"]');

      const message = messageInput.value.trim();
      const email = emailInput.value.trim();

      // Валидация
      if (!message) {
        showNotification('❌ Please enter your message', 'error');
        return;
      }

      // Дизейблим кнопку
      submitButton.disabled = true;
      submitButton.textContent = 'Sending...';

      // Отправляем
      const result = await sendFeedback(message, email);

      if (result.success) {
        showNotification('✅ Thank you for your feedback!', 'success');
        // Очищаем форму
        messageInput.value = '';
        emailInput.value = '';
      } else {
        showNotification('❌ Failed to send feedback. Try again later.', 'error');
      }

      // Включаем кнопку обратно
      submitButton.disabled = false;
      submitButton.textContent = 'Send Feedback';
    });

    console.log('[Pricing] Обработчик Feedback формы привязан');
  }
});

// Обработчик сообщений от popup OAuth
window.addEventListener('message', function(event) {
  console.log('[Pricing] Получено сообщение:', event.data);

  if (event.data && event.data.type === 'SITE_AUTH_SUCCESS') {
    console.log('[Pricing] ✅ SITE_AUTH_SUCCESS - обновление информации о пользователе');
    loadUserInfo();
  }
});
