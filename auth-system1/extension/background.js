// Background script для обработки авторизации через API токены
// Получает сообщения от auth.js и ретранслирует их во все content scripts

console.log('[VideoReader Background] Service worker запущен');

// Слушаем сообщения от content script, auth.html и popup окна авторизации
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[VideoReader Background] Получено сообщение:', message);
  console.log('[VideoReader Background] Отправитель:', sender);

  // ═══════════════════════════════════════════════════════════════════
  // Обработка запроса на открытие страницы авторизации
  // ═══════════════════════════════════════════════════════════════════
  if (message.type === 'OPEN_AUTH_PAGE') {
    console.log('[VideoReader Background] Запрос на открытие страницы авторизации');

    // Открываем auth.html в новой вкладке
    chrome.tabs.create({
      url: chrome.runtime.getURL('auth.html'),
      active: true
    }, (tab) => {
      console.log('[VideoReader Background] Страница авторизации открыта, tab ID:', tab.id);
      sendResponse({ success: true, tabId: tab.id });
    });

    return true; // Асинхронный ответ
  }

  // ═══════════════════════════════════════════════════════════════════
  // КРИТИЧЕСКИ ВАЖНО: Обработка успешной авторизации от auth.js
  // ═══════════════════════════════════════════════════════════════════
  if (message.type === 'AUTH_SUCCESS') {
    console.log('[VideoReader Background] ✅ Получен AUTH_SUCCESS от auth.js');
    console.log('[VideoReader Background] Token:', message.token?.substring(0, 8) + '...');
    console.log('[VideoReader Background] Email:', message.email);

    const token = message.token;
    const email = message.email;

    if (!token || !email) {
      console.error('[VideoReader Background] ❌ Токен или email отсутствуют!');
      sendResponse({ success: false, error: 'Missing token or email' });
      return true;
    }

    // 1. Сохраняем токен и email в chrome.storage.local
    chrome.storage.local.set({ token: token, email: email }, () => {
      console.log('[VideoReader Background] ✅ Токен и email сохранены в storage');

      // 2. Ретранслируем AUTH_SUCCESS во ВСЕ вкладки с content scripts
      console.log('[VideoReader Background] Ретранслируем AUTH_SUCCESS во все вкладки...');

      chrome.tabs.query({}, (tabs) => {
        console.log('[VideoReader Background] Найдено вкладок:', tabs.length);

        let successCount = 0;
        let errorCount = 0;

        tabs.forEach((tab) => {
          // Фильтруем только YouTube вкладки
          if (tab.url && (tab.url.includes('youtube.com/watch') || tab.url.includes('youtu.be'))) {
            console.log('[VideoReader Background] Отправляем в YouTube вкладку:', tab.id, tab.url);

            chrome.tabs.sendMessage(tab.id, {
              type: 'AUTH_SUCCESS',
              token: token,
              email: email
            }, (response) => {
              if (chrome.runtime.lastError) {
                console.log('[VideoReader Background] ⚠️ Ошибка отправки в вкладку', tab.id, ':', chrome.runtime.lastError.message);
                errorCount++;
              } else {
                console.log('[VideoReader Background] ✅ Отправлено в вкладку', tab.id);
                successCount++;
              }
            });
          }
        });

        console.log('[VideoReader Background] Ретрансляция завершена. Успешно:', successCount, ', Ошибок:', errorCount);
      });

      sendResponse({ success: true });
    });

    return true; // Асинхронный ответ
  }

  // ═══════════════════════════════════════════════════════════════════
  // HOT-RELOAD: Обработка изменения тарифного плана от pricing.html
  // ═══════════════════════════════════════════════════════════════════
  if (message.type === 'PLAN_UPDATED') {
    console.log('[VideoReader Background] ✅ Получен PLAN_UPDATED от pricing.html');
    console.log('[VideoReader Background] Новый план:', message.newPlan);
    console.log('[VideoReader Background] Email:', message.email);

    const newPlan = message.newPlan;
    const email = message.email;

    if (!newPlan) {
      console.error('[VideoReader Background] ❌ newPlan отсутствует!');
      sendResponse({ success: false, error: 'Missing newPlan' });
      return true;
    }

    // 1. Обновляем план в chrome.storage.local
    chrome.storage.local.set({ plan: newPlan }, () => {
      console.log('[VideoReader Background] ✅ План обновлен в storage:', newPlan);

      // 2. Ретранслируем PLAN_UPDATED во ВСЕ YouTube вкладки для обновления UI
      console.log('[VideoReader Background] Ретранслируем PLAN_UPDATED во все YouTube вкладки...');

      chrome.tabs.query({}, (tabs) => {
        console.log('[VideoReader Background] Найдено вкладок:', tabs.length);

        let successCount = 0;
        let errorCount = 0;

        tabs.forEach((tab) => {
          // Фильтруем только YouTube вкладки
          if (tab.url && (tab.url.includes('youtube.com/watch') || tab.url.includes('youtu.be'))) {
            console.log('[VideoReader Background] Отправляем PLAN_UPDATED в YouTube вкладку:', tab.id, tab.url);

            chrome.tabs.sendMessage(tab.id, {
              type: 'PLAN_UPDATED',
              newPlan: newPlan,
              email: email
            }, (response) => {
              if (chrome.runtime.lastError) {
                console.log('[VideoReader Background] ⚠️ Ошибка отправки в вкладку', tab.id, ':', chrome.runtime.lastError.message);
                errorCount++;
              } else {
                console.log('[VideoReader Background] ✅ PLAN_UPDATED отправлен в вкладку', tab.id);
                successCount++;
              }
            });
          }
        });

        console.log('[VideoReader Background] Ретрансляция PLAN_UPDATED завершена. Успешно:', successCount, ', Ошибок:', errorCount);
      });

      sendResponse({ success: true });
    });

    return true; // Асинхронный ответ
  }

  // ═══════════════════════════════════════════════════════════════════
  // FETCH_PLAN: Запрос плана через background (для обхода CORS)
  // ═══════════════════════════════════════════════════════════════════
  if (message.type === 'FETCH_PLAN') {
    console.log('[VideoReader Background] Получен FETCH_PLAN, токен:', message.token?.substring(0, 8) + '...');

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
        console.log('[VideoReader Background] /api/plan ответил со статусом:', response.status);
        if (response.status === 401) {
          return { error: 'unauthorized' };
        }
        if (!response.ok) {
          return { error: 'server_error' };
        }
        return response.json();
      })
      .then(data => {
        console.log('[VideoReader Background] /api/plan данные:', data);
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
        // DEBUG: Логируем ЧТО ИМЕННО получили от сервера
        console.log(`[BACKGROUND DEBUG] Line ${data.lineNumber}, received text length: ${data.text ? data.text.length : 0}, text: "${data.text}"`);
        sendResponse(data);
      })
      .catch(err => {
        console.error('[VideoReader Background] ❌ fetch /translate-line failed:', err);
        sendResponse({ error: 'network_error' });
      });

    return true; // Асинхронный ответ
  }

  // Неизвестный тип сообщения
  console.log('[VideoReader Background] Неизвестный тип сообщения:', message.type);
  sendResponse({ success: false, error: 'Unknown message type' });
  return false;
});
