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
  // Инициализация queue processors (только на сервере)
  if (typeof window === "undefined") {
    try {
      const { registerQueueProcessors } = await import("./lib/queue-processors")
      registerQueueProcessors()
      console.log("[Queue] Processors registered successfully")
    } catch (error) {
      console.error("[Queue] Failed to register processors:", error)
    }
  }
}
