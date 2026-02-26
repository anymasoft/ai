/**
 * Простая очередь генераций MiniMax с concurrency=1
 * В момент времени только одна активная генерация
 */

interface QueueItem {
  generationId: string;
}

let queue: QueueItem[] = [];
let isRunning = false;

/**
 * Добавить генерацию в очередь
 */
export function enqueueGeneration(generationId: string): void {
  queue.push({ generationId });
  console.log(
    `[QUEUE] Added generation ${generationId}. Queue size: ${queue.length}`
  );
}

/**
 * Получить следующую генерацию из очереди (без удаления)
 */
export function peekQueue(): QueueItem | null {
  return queue.length > 0 ? queue[0] : null;
}

/**
 * Удалить первую генерацию из очереди
 */
export function dequeueGeneration(): QueueItem | null {
  if (queue.length === 0) return null;
  const item = queue.shift()!;
  console.log(
    `[QUEUE] Dequeued generation ${item.generationId}. Queue size: ${queue.length}`
  );
  return item;
}

/**
 * Проверить работает ли обработчик
 */
export function isQueueRunning(): boolean {
  return isRunning;
}

/**
 * Установить флаг что очередь работает
 */
export function setQueueRunning(running: boolean): void {
  isRunning = running;
  console.log(`[QUEUE] Running: ${running}`);
}

/**
 * Получить размер очереди
 */
export function getQueueSize(): number {
  return queue.length;
}

/**
 * Очистить очередь (опционально для тестов)
 */
export function clearQueue(): void {
  queue = [];
  isRunning = false;
}
