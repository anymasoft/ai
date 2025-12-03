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
}
