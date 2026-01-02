/**
 * Next.js Instrumentation - фильтрация логирования конкретных запросов
 */

const originalLog = console.log;
const originalInfo = console.info;
const originalWarn = console.warn;

const blockedMessages = [
  "GET /api/admin/messages/unread-count",
  "GET /api/auth/session",
];

function isBlocked(args: any[]): boolean {
  const message = args.map(arg => String(arg)).join(" ");
  return blockedMessages.some(msg => message.includes(msg));
}

console.log = (...args: any[]) => {
  if (!isBlocked(args)) {
    originalLog(...args);
  }
};

console.info = (...args: any[]) => {
  if (!isBlocked(args)) {
    originalInfo(...args);
  }
};

console.warn = (...args: any[]) => {
  if (!isBlocked(args)) {
    originalWarn(...args);
  }
};

export async function register() {
  // Инициализация сервера
  // Очередь теперь используется через БД, не нужна инициализация
}
