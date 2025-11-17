// Pricing page logic - работа с тарифными планами через токен-авторизацию
console.log('[Pricing] Скрипт загружен');

// Получаем токен из URL параметров или localStorage
const urlParams = new URLSearchParams(window.location.search);
let token = urlParams.get('token');
let email = urlParams.get('email');

// Если нет токена в URL - пробуем из localStorage
if (!token) {
  token = localStorage.getItem('videoreader_token');
  email = localStorage.getItem('videoreader_email');
}

console.log('[Pricing] Token:', token ? token.substring(0, 8) + '...' : 'отсутствует');
console.log('[Pricing] Email:', email || 'отсутствует');

// Сохраняем в localStorage для дальнейшего использования
if (token) localStorage.setItem('videoreader_token', token);
if (email) localStorage.setItem('videoreader_email', email);

// Текущий план пользователя (получим с сервера)
let currentPlan = 'Free';

// Загрузка информации о пользователе и плане
async function loadUserInfo() {
  console.log('[Pricing] Загрузка информации о пользователе...');

  // Отображаем email
  const userEmailEl = document.getElementById('userEmail');
  if (userEmailEl && email) {
    userEmailEl.textContent = email;
  }

  // Получаем план с сервера
  if (token) {
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
        console.log('[Pricing] Текущий план:', currentPlan);

        // Отображаем текущий план
        const currentPlanEl = document.getElementById('currentPlan');
        if (currentPlanEl) {
          currentPlanEl.textContent = `Current: ${currentPlan}`;
        }

        // Обновляем кнопки
        updateButtons(currentPlan);
      } else {
        console.error('[Pricing] Ошибка получения плана:', response.status);
        updateButtons('Free');
      }
    } catch (error) {
      console.error('[Pricing] Ошибка запроса плана:', error);
      updateButtons('Free');
    }
  } else {
    console.log('[Pricing] Токен отсутствует - используем план Free');
    updateButtons('Free');
  }
}

// Обновление состояния кнопок в зависимости от текущего плана
function updateButtons(plan) {
  console.log('[Pricing] Обновление кнопок для плана:', plan);

  const btnFree = document.getElementById('btn-free');
  const btnPro = document.getElementById('btn-pro');
  const btnPremium = document.getElementById('btn-premium');

  // Функция для настройки кнопки
  function setBtn(btn, text, isCurrent) {
    if (!btn) return;

    btn.textContent = text;
    btn.disabled = isCurrent;

    if (isCurrent) {
      btn.classList.add('opacity-50', 'cursor-not-allowed');
      btn.classList.remove('hover:bg-blue-700', 'hover:bg-indigo-700');
    } else {
      btn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
  }

  if (plan === 'Free') {
    setBtn(btnFree, 'Current Plan', true);
    setBtn(btnPro, 'Upgrade to Pro', false);
    setBtn(btnPremium, 'Upgrade to Premium', false);
  } else if (plan === 'Pro') {
    setBtn(btnFree, 'Downgrade to Free', false);
    setBtn(btnPro, 'Current Plan', true);
    setBtn(btnPremium, 'Upgrade to Premium', false);
  } else if (plan === 'Premium') {
    setBtn(btnFree, 'Downgrade to Free', false);
    setBtn(btnPro, 'Downgrade to Pro', false);
    setBtn(btnPremium, 'Current Plan', true);
  }
}

// Обработчик смены плана (фейковый - обновляет в БД)
async function changePlan(newPlan) {
  console.log('[Pricing] Попытка смены плана на:', newPlan);

  if (!token || !email) {
    alert('Для смены плана необходимо авторизоваться');
    return;
  }

  if (currentPlan === newPlan) {
    console.log('[Pricing] Уже используется план:', newPlan);
    return;
  }

  try {
    // Отправляем запрос на сервер для обновления плана в БД
    const response = await fetch('http://localhost:5000/api/update-plan', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        plan: newPlan
      })
    });

    if (response.ok) {
      const data = await response.json();
      console.log('[Pricing] ✅ План успешно обновлен:', data);

      // Обновляем текущий план
      currentPlan = newPlan;

      // Обновляем UI
      const currentPlanEl = document.getElementById('currentPlan');
      if (currentPlanEl) {
        currentPlanEl.textContent = `Current: ${newPlan}`;
      }

      // Обновляем кнопки
      updateButtons(newPlan);

      // Показываем уведомление
      alert(`✅ План успешно изменен на ${newPlan}!\n\nРасширение автоматически обновит план при следующем запросе.`);

    } else {
      console.error('[Pricing] Ошибка обновления плана:', response.status);
      alert('Ошибка при смене плана. Попробуйте позже.');
    }
  } catch (error) {
    console.error('[Pricing] Ошибка запроса смены плана:', error);
    alert('Ошибка сети. Проверьте подключение и попробуйте снова.');
  }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
  console.log('[Pricing] DOM загружен, инициализация...');

  // Загружаем информацию о пользователе
  loadUserInfo();

  // Добавляем обработчики на кнопки
  const btnFree = document.getElementById('btn-free');
  const btnPro = document.getElementById('btn-pro');
  const btnPremium = document.getElementById('btn-premium');

  if (btnFree) {
    btnFree.addEventListener('click', () => {
      if (!btnFree.disabled) {
        changePlan('Free');
      }
    });
  }

  if (btnPro) {
    btnPro.addEventListener('click', () => {
      if (!btnPro.disabled) {
        changePlan('Pro');
      }
    });
  }

  if (btnPremium) {
    btnPremium.addEventListener('click', () => {
      if (!btnPremium.disabled) {
        changePlan('Premium');
      }
    });
  }

  console.log('[Pricing] Обработчики кнопок установлены');
});
