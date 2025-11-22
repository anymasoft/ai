// Pricing page logic - работа через cookies (credentials: include)

// Текущий план пользователя
let currentPlan = 'Free';
let currentEmail = '';

// Загрузка информации о пользователе через cookies
async function loadUserInfo() {

  const userInfoEl = document.getElementById('user-info');
  const authPromptEl = document.getElementById('auth-prompt');
  const userEmailEl = document.getElementById('userEmail');
  const currentPlanEl = document.getElementById('currentPlan');

  try {
    // Запрос к /api/plan с credentials: include (cookies автоматически отправятся)
    const response = await fetch('https://api.beem.ink/api/plan', {
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

      // Показываем user info
      if (userInfoEl) userInfoEl.style.display = 'flex';
      if (authPromptEl) authPromptEl.style.display = 'none';

      // Обновляем UI
      if (userEmailEl) userEmailEl.textContent = currentEmail;

      // Показываем ссылку на Admin только для nazarov.soft@gmail.com
      const adminLinkEl = document.getElementById('admin-link');
      if (adminLinkEl) {
        if (currentEmail === 'nazarov.soft@gmail.com') {
          adminLinkEl.style.display = 'inline';
        } else {
          adminLinkEl.style.display = 'none';
        }
      }

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

      // Автоматически подставляем email в форму feedback
      updateFeedbackForm();
    } else {
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
    setButton(btnFree, 'Your current plan', true);
    setButton(btnPro, 'Upgrade available', false, () => createPayment('Pro'));
    setButton(btnPremium, 'Upgrade available', false, () => createPayment('Premium'));
  } else if (plan === 'Pro') {
    setButton(btnFree, 'Basic plan', true);
    setButton(btnPro, 'Your current plan', true);
    setButton(btnPremium, 'Upgrade available', false, () => createPayment('Premium'));
  } else if (plan === 'Premium') {
    setButton(btnFree, 'Basic plan', true);
    setButton(btnPro, 'Included in your subscription', true);
    setButton(btnPremium, 'Your current plan', true);
  }
}

// Создание платежа для платных планов
async function createPayment(plan) {
  try {
    showNotification('Redirecting to payment...', 'success');

    const response = await fetch(`https://api.beem.ink/create-payment/${plan}`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();

      // Редиректим на страницу оплаты Yookassa
      if (data.confirmation_url) {
        window.location.href = data.confirmation_url;
      } else {
        showNotification('Payment URL not received', 'error');
      }
    } else {
      const error = await response.json();
      if (error.error === 'unauthorized') {
        showNotification('Please log in to upgrade', 'error');
      } else if (error.error === 'payment_not_configured') {
        showNotification('Payment system not configured', 'error');
      } else {
        showNotification(`Payment error: ${error.message || 'Unknown error'}`, 'error');
      }
    }
  } catch (error) {
    console.error('[Pricing] Payment error:', error);
    showNotification('Payment creation failed', 'error');
  }
}

// Переключение плана через cookie (для downgrades)
async function switchPlan(newPlan) {

  try {
    const response = await fetch(`https://api.beem.ink/switch-plan/${newPlan}`, {
      method: 'POST',
      credentials: 'include', // ВАЖНО: отправляет cookies
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();

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
      showNotification(`Plan successfully changed to ${newPlan}`, 'success');

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
            } else {
            }
          });
        }
      } catch (e) {
      }
    } else {
      console.error('[Pricing] ❌ Ошибка обновления плана, статус:', response.status);

      if (response.status === 401) {
        showNotification('Authorization required. Please sign in.', 'error');
        // Показываем кнопку Sign In
        document.getElementById('auth-prompt').style.display = 'flex';
        document.getElementById('user-info').style.display = 'none';
      } else {
        showNotification('Failed to update plan. Please try again later.', 'error');
      }
    }
  } catch (error) {
    console.error('[Pricing] ❌ Ошибка запроса обновления плана:', error);
    showNotification('Server connection error', 'error');
  }
}

// Показ уведомления (премиальные бледные toasts)
function showNotification(message, type = 'info') {
  // Создаем элемент уведомления
  const notification = document.createElement('div');
  notification.className = `fixed top-4 right-4 px-6 py-4 rounded-lg shadow-lg font-medium z-50 transition-all duration-300 ease-in-out opacity-0 translate-x-full`;

  if (type === 'success') {
    // Премиальный бледно-зеленый
    notification.className += ' bg-green-50 text-green-800 border border-green-200';
  } else if (type === 'error') {
    // Премиальный бледно-розовый
    notification.className += ' bg-rose-50 text-rose-800 border border-rose-200';
  } else {
    notification.className += ' bg-blue-50 text-blue-800 border border-blue-200';
  }

  notification.textContent = message;
  document.body.appendChild(notification);

  // Анимация появления (плавно)
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      notification.classList.remove('opacity-0', 'translate-x-full');
      notification.classList.add('opacity-100', 'translate-x-0');
    });
  });

  // Удаляем через 4 секунды (плавное исчезание)
  setTimeout(() => {
    notification.classList.add('opacity-0', 'translate-x-full');
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 4000);
}

// Logout - удаление cookie и обновление UI
async function logout() {

  try {
    // Пытаемся вызвать серверный logout (если маршрут существует)
    await fetch('https://api.beem.ink/auth-site/logout', {
      method: 'GET',
      credentials: 'include'
    }).catch(() => {
      // Если маршрута нет - ничего страшного, cookie удалятся на клиенте
    });

    // Обнуляем текущие данные
    currentPlan = 'Free';
    currentEmail = '';

    // Скрываем user-info, показываем auth-prompt
    document.getElementById('user-info').style.display = 'none';
    document.getElementById('auth-prompt').style.display = 'flex';

    // Скрываем ссылку на Admin
    const adminLinkEl = document.getElementById('admin-link');
    if (adminLinkEl) {
      adminLinkEl.style.display = 'none';
    }

    // Обновляем кнопки тарифов
    updateButtons('Free');

    // Очищаем форму feedback
    updateFeedbackForm();

    showNotification('You have been logged out', 'success');

  } catch (error) {
    console.error('[Pricing] ❌ Ошибка logout:', error);
    showNotification('Logout error', 'error');
  }
}

// Обновление формы feedback (автозаполнение email если пользователь авторизован)
function updateFeedbackForm() {
  const emailInput = document.getElementById('feedback-email');

  if (!emailInput) return;

  if (currentEmail && currentEmail !== '') {
    // Пользователь авторизован - подставляем email и делаем поле readonly
    emailInput.value = currentEmail;
    emailInput.readOnly = true;
    emailInput.classList.add('bg-gray-50', 'cursor-not-allowed');
  } else {
    // Пользователь не авторизован - поле редактируемое
    emailInput.value = '';
    emailInput.readOnly = false;
    emailInput.classList.remove('bg-gray-50', 'cursor-not-allowed');
  }
}

// Обработчик формы обратной связи
async function handleFeedbackSubmit(event) {
  event.preventDefault();

  const form = event.target;
  const email = form.querySelector('#feedback-email').value;
  const message = form.querySelector('#feedback-message').value;
  const submitBtn = form.querySelector('#feedback-submit-btn');

  // Блокируем кнопку
  submitBtn.disabled = true;
  submitBtn.textContent = 'Sending...';

  try {
    const response = await fetch('https://api.beem.ink/api/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        message,
        plan: currentPlan || 'Free'  // Отправляем план пользователя
      })
    });

    if (response.ok) {
      // Успех - показываем премиальный toast
      showNotification('Thank you for your feedback!', 'success');

      // Очищаем форму и восстанавливаем email если пользователь авторизован
      form.reset();
      updateFeedbackForm();
    } else {
      // Ошибка от сервера
      const data = await response.json();
      showNotification(`Error: ${data.error || 'Failed to send feedback'}`, 'error');
    }
  } catch (error) {
    console.error('[Pricing] ❌ Ошибка отправки feedback:', error);
    showNotification('Network error. Please try again.', 'error');
  } finally {
    // Разблокируем кнопку
    submitBtn.disabled = false;
    submitBtn.textContent = 'Send Feedback';
  }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
  loadUserInfo();

  // Привязываем обработчик Logout
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }

  // Привязываем обработчик формы обратной связи
  const feedbackForm = document.getElementById('feedback-form');
  if (feedbackForm) {
    feedbackForm.addEventListener('submit', handleFeedbackSubmit);
  }
});

// Обработчик сообщений от popup OAuth
window.addEventListener('message', function(event) {

  if (event.data && event.data.type === 'SITE_AUTH_SUCCESS') {
    loadUserInfo();
  }
});
