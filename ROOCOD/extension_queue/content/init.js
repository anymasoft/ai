// ═══════════════════════════════════════════════════════════════════
// INIT MODULE - Главный init-процесс и обработчики
// ═══════════════════════════════════════════════════════════════════

import { getTranscript } from "./transcript.js";
import { translateSubtitles } from "./api.js";
import { createTranscriptPanel, displayTranscript, updateExportButtonState, SUPPORTED_LANGUAGES, getFlagSVG } from "./ui.js";
import { transcriptState, getTranslatedSubtitlesArray } from "./state.js";
import { startRealtimeHighlight, stopRealtimeHighlight } from "./highlight.js";
import { getVideoId, loadSavedLanguage, waitForElement, getSelectedLanguage, saveLanguage, openAuthPage, updateAuthUI } from "./util.js";
import { exportSubtitles } from "./export.js";

// Флаг для предотвращения двойной вставки панели
let injecting = false;

// Утилита throttle для ограничения частоты вызовов
function throttle(fn, delay) {
  let last = 0;
  return (...args) => {
    const now = Date.now();
    if (now - last > delay) {
      last = now;
      return fn(...args);
    }
  };
}

// Уничтожение панели и очистка всех ресурсов
function destroyPanel() {
  // Останавливаем realtime highlight (прерывает RAF цикл)
  stopRealtimeHighlight();

  // P1 FIX: Явная очистка scroll/wheel handlers
  if (transcriptState.scrollListenersAttachedTo) {
    const oldContainer = transcriptState.scrollListenersAttachedTo;
    if (transcriptState.wheelHandler) {
      oldContainer.removeEventListener("wheel", transcriptState.wheelHandler);
      transcriptState.wheelHandler = null;
    }
    if (transcriptState.scrollHandler) {
      oldContainer.removeEventListener("scroll", transcriptState.scrollHandler);
      transcriptState.scrollHandler = null;
    }
    transcriptState.scrollListenersAttachedTo = null;
  }
  transcriptState.scrollLocked = false;

  // Очищаем все таймеры
  if (transcriptState.scrollUnlockTimer) {
    clearTimeout(transcriptState.scrollUnlockTimer);
    transcriptState.scrollUnlockTimer = null;
  }

  // Удаляем все document-level listeners
  for (const {target, type, handler} of transcriptState.listeners) {
    target.removeEventListener(type, handler);
  }
  transcriptState.listeners = [];

  // КРИТИЧЕСКОЕ ИЗМЕНЕНИЕ: НЕ восстанавливаем history методы
  // Hijack должен оставаться активным для корректной работы навигации между видео
  // History API hijack будет работать всё время пока content script загружен

  // Удаляем панель из DOM
  const panel = document.getElementById('yt-transcript-panel');
  if (panel) {
    panel.remove();
  }
}

// Cross-tab синхронизация плана, токена и email
chrome.storage.onChanged.addListener((changes) => {
  // КРИТИЧЕСКОЕ ИЗМЕНЕНИЕ: обрабатываем все auth-related изменения
  let needsUpdate = false;

  if (changes.plan) {
    transcriptState.userPlan = changes.plan.newValue;
    needsUpdate = true;
  }

  // Обрабатываем изменения token и email
  if (changes.token || changes.email) {
    needsUpdate = true;
  }

  // Обновляем UI только если что-то изменилось
  if (needsUpdate) {
    updateAuthUI();
    updateExportButtonState();
  }
});

// Вставка панели в страницу
async function injectPanel() {
  // Предотвращаем повторную вставку панели
  if (injecting) return;
  injecting = true;

  try {
    // Загружаем сохраненный язык и синхронизируем с state
    const savedLang = loadSavedLanguage();
    transcriptState.selectedLang = savedLang;

    // Ищем secondary column (справа от видео)
    const secondary = await waitForElement('#secondary-inner, #secondary');

    // Проверяем, не добавлена ли уже панель
    if (document.getElementById('yt-transcript-panel')) {
      return;
    }

    const panel = createTranscriptPanel();

    // Вставляем в начало secondary column
    secondary.insertBefore(panel, secondary.firstChild);

    // Привязываем обработчики
    const translateBtn = document.getElementById('yt-reader-translate-btn');
    const toggleBtn = document.getElementById('yt-transcript-toggle-btn');
    const langBtn = document.getElementById('yt-reader-lang-btn');
    const langDropdown = document.getElementById('yt-reader-lang-dropdown');

    translateBtn.addEventListener('click', handleGetTranscript);
    toggleBtn.addEventListener('click', handleTogglePanel);
    langBtn.addEventListener('click', handleLanguageToggle);

    // Обработчики для опций языка
    const langOptions = document.querySelectorAll('.yt-reader-lang-option');
    langOptions.forEach(option => {
      option.addEventListener('click', (e) => {
        e.stopPropagation();
        handleLanguageSelect(option.dataset.lang);
      });
    });

    // Обработчики экспорта
    const exportBtn = document.getElementById('yt-reader-export-btn');
    const exportDropdown = document.getElementById('yt-reader-export-dropdown');
    const exportOptions = document.querySelectorAll('.yt-reader-export-option');

    exportBtn.addEventListener('click', handleExportToggle);
    exportOptions.forEach(option => {
      option.addEventListener('click', (e) => {
        e.stopPropagation();

        // Блокируем клик на locked опциях
        if (option.classList.contains('locked')) {
          return;
        }

        const format = option.dataset.format;
        const type = option.dataset.type;
        handleExportFormat(format, type);
      });
    });

    // Закрытие dropdown при клике вне его
    const closeDropdownHandler = (e) => {
      if (!e.target.closest('.yt-reader-lang-selector')) {
        langDropdown.classList.remove('show');
        langBtn.classList.remove('active');
      }
      if (!e.target.closest('.yt-reader-export-container')) {
        exportDropdown.classList.remove('show');
      }
    };
    document.addEventListener('click', closeDropdownHandler);

    // Сохраняем listener для cleanup
    transcriptState.listeners.push({
      target: document,
      type: 'click',
      handler: closeDropdownHandler
    });

    // Обработчики авторизации
    const signInBtn = document.getElementById('yt-reader-signin-btn');
    if (signInBtn) {
      signInBtn.addEventListener('click', () => {
        openAuthPage();
      });
    }

    const logoutBtn = document.getElementById('yt-reader-logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        // Удаляем токен и email из chrome.storage
        await chrome.storage.local.remove(['token', 'email', 'plan']);

        // Обновляем UI
        await updateAuthUI();
      });
    }

    // Обработчик для кнопки Upgrade
    const upgradeBtn = document.getElementById('yt-reader-upgrade-btn');
    if (upgradeBtn) {
      upgradeBtn.addEventListener('click', () => {
        window.open('https://api.beem.ink/pricing', '_blank');
      });
    }

    // Обновляем UI авторизации при загрузке панели
    // Небольшая задержка чтобы гарантировать что DOM полностью готов
    await new Promise(resolve => setTimeout(resolve, 100));
    await updateAuthUI();

    console.log('Панель транскрипта добавлена');
    injecting = false;
  } catch (error) {
    console.error('Ошибка при вставке панели:', error);
    injecting = false;
  }
}

// Обработчик сворачивания/разворачивания
function handleTogglePanel() {
  const panel = document.getElementById('yt-transcript-panel');
  const body = document.getElementById('yt-transcript-body');
  const toggleBtn = document.getElementById('yt-transcript-toggle-btn');

  const isCollapsed = panel.classList.toggle('collapsed');

  if (isCollapsed) {
    body.style.display = 'none';
    toggleBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
      </svg>
    `;
  } else {
    body.style.display = 'block';
    toggleBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6 1.41 1.41z"/>
      </svg>
    `;
  }
}

// Обработчик переключения выпадающего списка языков
function handleLanguageToggle(e) {
  e.stopPropagation();
  const langBtn = document.getElementById('yt-reader-lang-btn');
  const langDropdown = document.getElementById('yt-reader-lang-dropdown');

  const isActive = langBtn.classList.toggle('active');

  if (isActive) {
    // Рассчитываем позицию dropdown
    const btnRect = langBtn.getBoundingClientRect();
    const dropdownHeight = 320; // примерная высота dropdown
    const viewportHeight = window.innerHeight;

    // Определяем, достаточно ли места снизу
    const spaceBelow = viewportHeight - btnRect.bottom;
    const shouldShowAbove = spaceBelow < dropdownHeight && btnRect.top > dropdownHeight;

    if (shouldShowAbove) {
      // Показываем сверху
      langDropdown.style.top = 'auto';
      langDropdown.style.bottom = `${viewportHeight - btnRect.top + 6}px`;
    } else {
      // Показываем снизу
      langDropdown.style.top = `${btnRect.bottom + 6}px`;
      langDropdown.style.bottom = 'auto';
    }

    // Выравниваем по правому краю кнопки
    langDropdown.style.right = `${window.innerWidth - btnRect.right}px`;
    langDropdown.style.left = 'auto';

    langDropdown.classList.add('show');
  } else {
    langDropdown.classList.remove('show');
  }
}

// Обработчик выбора языка
function handleLanguageSelect(langCode) {
  const selectedLang = SUPPORTED_LANGUAGES.find(l => l.code === langCode);
  if (!selectedLang) return;

  // Сохраняем выбранный язык и синхронизируем с state
  saveLanguage(langCode);
  transcriptState.selectedLang = langCode;

  // Обновляем UI кнопки
  const langBtn = document.getElementById('yt-reader-lang-btn');
  const flagEl = langBtn.querySelector('.yt-reader-lang-flag');
  flagEl.innerHTML = getFlagSVG(langCode);
  flagEl.setAttribute('data-flag', langCode);
  langBtn.querySelector('.yt-reader-lang-code').textContent = langCode.toUpperCase();

  // Обновляем selected опции
  document.querySelectorAll('.yt-reader-lang-option').forEach(opt => {
    opt.classList.toggle('selected', opt.dataset.lang === langCode);
  });

  // Закрываем dropdown
  const langDropdown = document.getElementById('yt-reader-lang-dropdown');
  langDropdown.classList.remove('show');
  langBtn.classList.remove('active');

  console.log('Выбран язык:', selectedLang.name);
}
// Обработчик переключения выпадающего списка экспорта
function handleExportToggle(e) {
  e.stopPropagation();
  const exportDropdown = document.getElementById('yt-reader-export-dropdown');

  const isActive = exportDropdown.classList.toggle('show');

  if (isActive) {
    // Рассчитываем позицию dropdown
    const btnRect = e.currentTarget.getBoundingClientRect();
    const dropdownHeight = 200; // примерная высота dropdown
    const viewportHeight = window.innerHeight;

    // Определяем, достаточно ли места снизу
    const spaceBelow = viewportHeight - btnRect.bottom;
    const shouldShowAbove = spaceBelow < dropdownHeight && btnRect.top > dropdownHeight;

    if (shouldShowAbove) {
      // Показываем сверху
      exportDropdown.style.top = 'auto';
      exportDropdown.style.bottom = `${viewportHeight - btnRect.top + 6}px`;
    } else {
      // Показываем снизу
      exportDropdown.style.top = `${btnRect.bottom + 6}px`;
      exportDropdown.style.bottom = 'auto';
    }

    // Выравниваем по правому краю кнопки
    exportDropdown.style.right = `${window.innerWidth - btnRect.right}px`;
    exportDropdown.style.left = 'auto';
  }
}

// Обработчик выбора формата экспорта
function handleExportFormat(format, type) {
  if (!transcriptState.originalSubtitles || transcriptState.originalSubtitles.length === 0) {
    return;
  }

  const subtitles = type === 'original' ?
    transcriptState.originalSubtitles :
    getTranslatedSubtitlesArray();

  exportSubtitles(subtitles, format);
}


// Обработчик получения транскрипта
async function handleGetTranscript() {
  const translateBtn = document.getElementById('yt-reader-translate-btn');
  const contentEl = document.getElementById('yt-transcript-content');

  try {
    // Показываем статус загрузки
    translateBtn.disabled = true;
    translateBtn.innerHTML = `
      <div class="yt-reader-loading-spinner"></div>
      Получение...
    `;

    // Очищаем предыдущий контент
    contentEl.innerHTML = '';
    transcriptState.originalSubtitles = [];
    transcriptState.translatedSubtitles = {};

    // Получаем videoId
    const videoId = getVideoId();

    // Получаем субтитры
    const subtitles = await getTranscript(videoId);
    if (!subtitles || subtitles.length === 0) {
      throw new Error('Транскрипт не найден для этого видео');
    }

    // Сохраняем оригинальные субтитры
    transcriptState.originalSubtitles = subtitles;

    // Отображаем оригинальные субтитры (displayTranscript уже запускает highlight)
    displayTranscript(subtitles);

    // --- AUTO SCROLL LOCK ---
    const container = document.getElementById('yt-transcript-content');
    if (container && transcriptState.scrollListenersAttachedTo !== container) {
      // Удаляем listeners со старого контейнера, если он существует
      if (transcriptState.scrollListenersAttachedTo) {
        const oldContainer = transcriptState.scrollListenersAttachedTo;
        if (transcriptState.wheelHandler) {
          oldContainer.removeEventListener("wheel", transcriptState.wheelHandler);
        }
        if (transcriptState.scrollHandler) {
          oldContainer.removeEventListener("scroll", transcriptState.scrollHandler);
        }
      }

      // Создаем новые обработчики
      transcriptState.wheelHandler = () => {
        transcriptState.scrollLocked = true;

        if (transcriptState.scrollUnlockTimer) {
          clearTimeout(transcriptState.scrollUnlockTimer);
        }

        // через 1200 мс возвращаем автоскролл
        transcriptState.scrollUnlockTimer = setTimeout(() => {
          transcriptState.scrollLocked = false;
          transcriptState.scrollUnlockTimer = null;
        }, 1200);
      };

      transcriptState.scrollHandler = () => {
        transcriptState.scrollLocked = true;

        if (transcriptState.scrollUnlockTimer) {
          clearTimeout(transcriptState.scrollUnlockTimer);
        }

        transcriptState.scrollUnlockTimer = setTimeout(() => {
          transcriptState.scrollLocked = false;
          transcriptState.scrollUnlockTimer = null;
        }, 1200);
      };

      // Добавляем listeners к новому контейнеру
      container.addEventListener("wheel", transcriptState.wheelHandler, { passive: true });
      container.addEventListener("scroll", transcriptState.scrollHandler, { passive: true });

      transcriptState.scrollListenersAttachedTo = container;
    }

    // Обновляем кнопку на "Перевод..."
    translateBtn.innerHTML = `
      <div class="yt-reader-loading-spinner"></div>
      Перевод...
    `;

    // Получаем выбранный язык
    const targetLang = transcriptState.selectedLang || 'ru';

    // Переводим субтитры
    await translateSubtitles(videoId, subtitles, targetLang);

    // Включаем кнопку
    translateBtn.disabled = false;
    translateBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/>
      </svg>
      Получить транскрипт
    `;

    console.log('Транскрипт успешно получен и переведен');

  } catch (error) {
    console.error('Ошибка получения транскрипта:', error);

    // Включаем кнопку
    translateBtn.disabled = false;
    translateBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/>
      </svg>
      Получить транскрипт
    `;
  }
}


// Наблюдение за навигацией YouTube
function observeYoutubeNavigation() {
  // Callback для MutationObserver
  const observerCallback = (mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // Проверяем, изменился ли URL (новая страница видео)
          if (window.location.href.includes('/watch?v=')) {
            // Проверяем наличие secondary column
            const secondary = document.querySelector('#secondary-inner, #secondary');
            if (secondary && !document.getElementById('yt-transcript-panel')) {
              // Небольшая задержка чтобы убедиться что DOM полностью загружен
              setTimeout(() => {
                injectPanel();
              }, 500);
            }
          }
        }
      }
    }
  };

  // Применяем throttle для снижения нагрузки (защита от MutationObserver flood)
  const throttledCallback = throttle(observerCallback, 500);

  const observer = new MutationObserver(throttledCallback);

  // Начинаем наблюдение за body
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Также отслеживаем изменения URL через history API
  let currentUrl = window.location.href;

  // Сохраняем оригинальные методы для восстановления при cleanup
  if (!transcriptState.originalPushState) {
    transcriptState.originalPushState = history.pushState;
    transcriptState.originalReplaceState = history.replaceState;
  }

  history.pushState = function(...args) {
    transcriptState.originalPushState.apply(this, args);
    handleUrlChange();
  };

  history.replaceState = function(...args) {
    transcriptState.originalReplaceState.apply(this, args);
    handleUrlChange();
  };

  window.addEventListener('popstate', handleUrlChange);

  // Сохраняем popstate listener для cleanup
  transcriptState.listeners.push({
    target: window,
    type: 'popstate',
    handler: handleUrlChange
  });

  function handleUrlChange() {
    if (window.location.href !== currentUrl) {
      currentUrl = window.location.href;

      // Если перешли на страницу видео
      if (window.location.href.includes('/watch?v=')) {
        // Уничтожаем старую панель если есть
        destroyPanel();

        // Небольшая задержка чтобы убедиться что DOM полностью загружен
        setTimeout(() => {
          injectPanel();
        }, 500);
      }
    }
  }
}

// Главная функция инициализации
async function initContentScript() {
  console.log('Инициализация content script...');

  // Ждем загрузки DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initializeAfterDOMReady();
    });
  } else {
    initializeAfterDOMReady();
  }

  async function initializeAfterDOMReady() {
    // Проверяем, находимся ли мы на странице видео
    if (window.location.href.includes('/watch?v=')) {
      // Ждем появления secondary column
      try {
        await waitForElement('#secondary-inner, #secondary', 10000);
        await injectPanel();
      } catch (error) {
        console.log('Secondary column не найден, возможно страница еще не полностью загружена');
      }
    }

    // Запускаем наблюдение за навигацией
    observeYoutubeNavigation();
  }
}

// Экспорт функций
export { 
  initContentScript,
  injectPanel,
  handleTogglePanel,
  handleLanguageToggle,
  handleLanguageSelect,
  handleExportToggle,
  handleExportFormat,
  handleGetTranscript,
  displayTranscript,
  observeYoutubeNavigation
};