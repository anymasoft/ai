// Условное логирование в зависимости от переменной окружения
// Если QUIET_MODE=true, отключаем логирование приложения
const QUIET_MODE = import.meta.env.QUIET_MODE === 'true'; // Отключить логирование приложения

export const logger = {
  log: (...args: any[]) => {
    if (!QUIET_MODE) {
      console.log(...args);
    }
  },
  error: (...args: any[]) => {
    // Ошибки логируем всегда
    console.error(...args);
  },
  warn: (...args: any[]) => {
    if (!QUIET_MODE) {
      console.warn(...args);
    }
  },
};
