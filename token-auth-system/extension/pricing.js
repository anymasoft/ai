// Pricing page logic - работа с тарифными планами через Bearer токены из cookies
console.log('[Pricing] Скрипт загружен');

// Получаем токен из cookie
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

const token = getCookie('auth_token');
const email = getCookie('auth_email');

console.log('[Pricing] Token:', token ? token.substring(0, 8) + '...' : 'отсутствует');
console.log('[Pricing] Email:', email || 'отсутствует');

// Текущий план пользователя
let currentPlan = 'Free';

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
      console.log('[Pricing] ✅ Текущий план:', currentPlan);

      // Показываем user info
      if (userInfoEl) userInfoEl.style.display = 'flex';
      if (authPromptEl) authPromptEl.style.display = 'none';
      
      // Обновляем UI
      if (userEmailEl) userEmailEl.textContent = email || data.email || '';
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

// Переключение плана (фейковая оплата)
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

      // ═══════════════════════════════════════════════════════════════════
      // HOT-RELOAD: Отправляем сообщение в расширение для обновления плана
      // на всех YouTube вкладках БЕЗ перезагрузки
      // ═══════════════════════════════════════════════════════════════════
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        console.log('[Pricing] Отправляем PLAN_UPGRADED в расширение...');

        try {
          // Отправляем сообщение в background.js расширения
          chrome.runtime.sendMessage({
            type: 'PLAN_UPGRADED',
            newPlan: newPlan,
            email: email || data.email
          }, (response) => {
            if (chrome.runtime.lastError) {
              console.log('[Pricing] Chrome runtime error:', chrome.runtime.lastError.message);
            } else {
              console.log('[Pricing] ✅ Сообщение PLAN_UPGRADED отправлено в расширение:', response);
            }
          });
        } catch (error) {
          console.error('[Pricing] ❌ Ошибка отправки сообщения в расширение:', error);
        }
      } else {
        console.log('[Pricing] Chrome runtime недоступен (это нормально для веб-страницы)');
      }

      // Показываем уведомление
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
