// Pricing page logic - работа с тарифными планами через Bearer токен из URL параметра
console.log('[Pricing] Скрипт загружен');

// Получаем токен из URL параметра ?token=...
function getTokenFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('token');
}

const token = getTokenFromURL();
console.log('[Pricing] Token из URL:', token ? token.substring(0, 8) + '...' : 'отсутствует');

// Текущий план пользователя
let currentPlan = 'Free';
let currentEmail = '';

// Загрузка информации о пользователе и плане
async function loadUserInfo() {
  console.log('[Pricing] Загрузка информации о пользователе...');

  const userInfoEl = document.getElementById('user-info');
  const authPromptEl = document.getElementById('auth-prompt');
  const userEmailEl = document.getElementById('userEmail');
  const currentPlanEl = document.getElementById('currentPlan');

  // Если токена нет - показываем кнопку Sign In
  if (!token) {
    console.log('[Pricing] Токен отсутствует - показываем Sign In');
    if (authPromptEl) authPromptEl.style.display = 'flex';
    if (userInfoEl) userInfoEl.style.display = 'none';

    // Устанавливаем кнопки для неавторизованного пользователя
    updateButtons('Free');
    return;
  }

  // Получаем план с сервера через Bearer токен
  try {
    const response = await fetch('http://localhost:5000/api/plan', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
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
        currentPlanEl.className = 'px-3 py-1 rounded-full text-sm font-semibold';
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
      // Если токен невалиден - показываем кнопку Sign In
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

    if (disabled) {
      btn.className = btn.className.replace('hover:bg-blue-700', '').replace('hover:bg-blue-50', '');
      btn.className += ' opacity-50 cursor-not-allowed';
    } else {
      btn.className = btn.className.replace('opacity-50', '').replace('cursor-not-allowed', '');
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
    setButton(btnFree, 'Downgrade', false, () => switchPlan('Free'));
    setButton(btnPro, 'Current Plan', true);
    setButton(btnPremium, 'Upgrade to Premium', false, () => switchPlan('Premium'));
  } else if (plan === 'Premium') {
    setButton(btnFree, 'Downgrade', false, () => switchPlan('Free'));
    setButton(btnPro, 'Downgrade', false, () => switchPlan('Pro'));
    setButton(btnPremium, 'Current Plan', true);
  }
}

// Переключение плана
async function switchPlan(newPlan) {
  console.log('[Pricing] Переключение на план:', newPlan);

  if (!token) {
    console.log('[Pricing] Токен отсутствует - перенаправление на /auth');
    window.location.href = '/auth';
    return;
  }

  try {
    const response = await fetch(`http://localhost:5000/switch-plan/${newPlan}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
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
        currentPlanEl.className = 'px-3 py-1 rounded-full text-sm font-semibold';
        if (newPlan === 'Free') {
          currentPlanEl.className += ' bg-gray-100 text-gray-800';
        } else if (newPlan === 'Pro') {
          currentPlanEl.className += ' bg-blue-100 text-blue-800';
        } else if (newPlan === 'Premium') {
          currentPlanEl.className += ' bg-purple-100 text-purple-800';
        }
      }

      updateButtons(newPlan);
      alert(`✅ План успешно изменен на ${newPlan}!`);
    } else {
      console.error('[Pricing] ❌ Ошибка обновления плана, статус:', response.status);
      alert('❌ Ошибка обновления плана');
    }
  } catch (error) {
    console.error('[Pricing] ❌ Ошибка запроса обновления плана:', error);
    alert('❌ Ошибка обновления плана');
  }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
  console.log('[Pricing] DOM загружен - инициализация...');
  loadUserInfo();
});
