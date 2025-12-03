/**
 * Подавление ошибок MetaMask в консоли браузера
 *
 * MetaMask расширение может генерировать ошибки при попытке подключения,
 * даже если приложение не использует web3/криптовалютную функциональность.
 * Эта функция фильтрует такие ошибки для более чистой консоли разработки.
 */
export function suppressMetaMaskErrors() {
  if (typeof window === "undefined") {
    return; // Только для браузера
  }

  // Сохраняем оригинальный console.error
  const originalConsoleError = console.error;

  // Паттерны ошибок MetaMask, которые нужно подавить
  const metamaskErrorPatterns = [
    /metamask/i,
    /ethereum\.request/i,
    /failed to connect/i,
    /web3/i,
    /crypto wallet/i,
    /injected provider/i,
    /inpage\.js/i,
    /chrome-extension:\/\/[a-z]+\/scripts\/inpage/i,
  ];

  // Переопределяем console.error с фильтрацией
  console.error = (...args: any[]) => {
    // Преобразуем аргументы в строку для проверки
    const errorString = args
      .map((arg) => {
        if (typeof arg === "string") return arg;
        if (arg instanceof Error) return arg.message;
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      })
      .join(" ");

    // Проверяем, является ли это ошибкой MetaMask
    const isMetaMaskError = metamaskErrorPatterns.some((pattern) =>
      pattern.test(errorString)
    );

    // Если это не ошибка MetaMask, выводим в консоль
    if (!isMetaMaskError) {
      originalConsoleError.apply(console, args);
    }
  };

  // Аналогично для console.warn (некоторые MetaMask ошибки идут как warnings)
  const originalConsoleWarn = console.warn;

  console.warn = (...args: any[]) => {
    const warnString = args
      .map((arg) => {
        if (typeof arg === "string") return arg;
        if (arg instanceof Error) return arg.message;
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      })
      .join(" ");

    const isMetaMaskWarning = metamaskErrorPatterns.some((pattern) =>
      pattern.test(warnString)
    );

    if (!isMetaMaskWarning) {
      originalConsoleWarn.apply(console, args);
    }
  };

  // Перехват глобальных синхронных ошибок (window.onerror)
  // Это ловит ошибки, которые Next.js dev overlay показывает красным экраном
  window.addEventListener("error", (event: ErrorEvent) => {
    // Проверяем источники ошибки
    const errorMessage = event.message || "";
    const errorFilename = event.filename || "";
    const errorStack = event.error?.stack || "";

    // Собираем все данные для проверки
    const fullErrorInfo = [errorMessage, errorFilename, errorStack].join(" ");

    // Если это MetaMask ошибка - подавляем её
    const isMetaMaskError = metamaskErrorPatterns.some((pattern) =>
      pattern.test(fullErrorInfo)
    );

    if (isMetaMaskError) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
  }, true); // true = capturing phase, чтобы перехватить ДО других обработчиков

  // Перехват unhandled promise rejections
  // Это ловит промисы без catch, которые часто генерирует MetaMask
  window.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
    const reason = event.reason;

    // Формируем строку для проверки
    let reasonString = "";
    if (typeof reason === "string") {
      reasonString = reason;
    } else if (reason instanceof Error) {
      reasonString = reason.message + " " + (reason.stack || "");
    } else {
      try {
        reasonString = JSON.stringify(reason);
      } catch {
        reasonString = String(reason);
      }
    }

    // Если это MetaMask rejection - подавляем
    const isMetaMaskRejection = metamaskErrorPatterns.some((pattern) =>
      pattern.test(reasonString)
    );

    if (isMetaMaskRejection) {
      event.preventDefault();
      return;
    }
  });
}
