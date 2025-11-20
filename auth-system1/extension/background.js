// Background script для обработки авторизации через API токены
// Получает сообщения от auth.js и ретранслирует их во все content scripts


// Слушаем сообщения от content script, auth.html и popup окна авторизации
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  // ═══════════════════════════════════════════════════════════════════
  // Обработка запроса на открытие страницы авторизации
  // ═══════════════════════════════════════════════════════════════════
  if (message.type === 'OPEN_AUTH_PAGE') {

    // Открываем auth.html в новой вкладке
    chrome.tabs.create({
      url: chrome.runtime.getURL('auth.html'),
      active: true
    }, (tab) => {
      sendResponse({ success: true, tabId: tab.id });
    });

    return true; // Асинхронный ответ
  }

  // ═══════════════════════════════════════════════════════════════════
  // КРИТИЧЕСКИ ВАЖНО: Обработка успешной авторизации от auth.js
  // ═══════════════════════════════════════════════════════════════════
  if (message.type === 'AUTH_SUCCESS') {

    const token = message.token;
    const email = message.email;

    if (!token || !email) {
      sendResponse({ success: false, error: 'Missing token or email' });
      return true;
    }

    // 1. Сохраняем токен и email в chrome.storage.local
    chrome.storage.local.set({ token: token, email: email }, () => {

      // 2. Ретранслируем AUTH_SUCCESS во ВСЕ вкладки с content scripts

      chrome.tabs.query({}, (tabs) => {

        let successCount = 0;
        let errorCount = 0;

        tabs.forEach((tab) => {
          // Фильтруем только YouTube вкладки
          if (tab.url && (tab.url.includes('youtube.com/watch') || tab.url.includes('youtu.be'))) {

            chrome.tabs.sendMessage(tab.id, {
              type: 'AUTH_SUCCESS',
              token: token,
              email: email
            }, (response) => {
              if (chrome.runtime.lastError) {
                errorCount++;
              } else {
                successCount++;
              }
            });
          }
        });

      });

      sendResponse({ success: true });
    });

    return true; // Асинхронный ответ
  }

  // ═══════════════════════════════════════════════════════════════════
  // HOT-RELOAD: Обработка изменения тарифного плана от pricing.html
  // ═══════════════════════════════════════════════════════════════════
  if (message.type === 'PLAN_UPDATED') {

    const newPlan = message.newPlan;
    const email = message.email;

    if (!newPlan) {
      sendResponse({ success: false, error: 'Missing newPlan' });
      return true;
    }

    // 1. Обновляем план в chrome.storage.local
    chrome.storage.local.set({ plan: newPlan }, () => {

      // 2. Ретранслируем PLAN_UPDATED во ВСЕ YouTube вкладки для обновления UI

      chrome.tabs.query({}, (tabs) => {

        let successCount = 0;
        let errorCount = 0;

        tabs.forEach((tab) => {
          // Фильтруем только YouTube вкладки
          if (tab.url && (tab.url.includes('youtube.com/watch') || tab.url.includes('youtu.be'))) {

            chrome.tabs.sendMessage(tab.id, {
              type: 'PLAN_UPDATED',
              newPlan: newPlan,
              email: email
            }, (response) => {
              if (chrome.runtime.lastError) {
                errorCount++;
              } else {
                successCount++;
              }
            });
          }
        });

      });

      sendResponse({ success: true });
    });

    return true; // Асинхронный ответ
  }

  // ═══════════════════════════════════════════════════════════════════
  // FETCH_PLAN: Запрос плана через background (для обхода CORS)
  // ═══════════════════════════════════════════════════════════════════
  if (message.type === 'FETCH_PLAN') {

    const token = message.token;

    if (!token) {
      sendResponse({ error: 'unauthorized' });
      return true;
    }

    // Выполняем fetch от имени background.js
    fetch('http://localhost:5000/api/plan', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
      .then(response => {
        if (response.status === 401) {
          return { error: 'unauthorized' };
        }
        if (!response.ok) {
          return { error: 'server_error' };
        }
        return response.json();
      })
      .then(data => {
        sendResponse(data);
      })
      .catch(err => {
        console.error('[VideoReader Background] ❌ fetch /api/plan failed:', err);
        sendResponse({ error: 'network_error' });
      });

    return true; // Асинхронный ответ
  }

  // ═══════════════════════════════════════════════════════════════════
  // TRANSLATE_LINE: Запрос перевода через background (для обхода AdBlock)
  // ═══════════════════════════════════════════════════════════════════
  if (message.type === 'TRANSLATE_LINE') {
    const { videoId, lineNumber, text, prevContext, lang, totalLines, token } = message;

    // Формируем headers
    const headers = {
      'Content-Type': 'application/json'
    };

    // Добавляем Authorization header если есть токен
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Выполняем fetch от имени background.js
    fetch('http://localhost:5000/translate-line', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        videoId,
        lineNumber,
        text,
        prevContext,
        lang,
        totalLines  // Передаём общее количество строк для расчёта лимита
      })
    })
      .then(response => {
        if (!response.ok) {
          return { error: 'translation_failed', status: response.status };
        }
        return response.json();
      })
      .then(data => {
        sendResponse(data);
      })
      .catch(err => {
        console.error('[VideoReader Background] ❌ fetch /translate-line failed:', err);
        sendResponse({ error: 'network_error' });
      });

    return true; // Асинхронный ответ
  }

  // Неизвестный тип сообщения
  sendResponse({ success: false, error: 'Unknown message type' });
  return false;
});
