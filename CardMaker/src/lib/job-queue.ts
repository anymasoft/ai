/**
 * Простая in-process очередь задач для обработки batch операций
 * БЕЗ зависимостей от Redis или внешних сервисов
 * Подходит для MVP и небольшого числа пользователей (10-100)
 */

export type JobStatus = "queued" | "processing" | "completed" | "failed"

export interface Job {
  id: string
  userId: string
  status: JobStatus
  data: Record<string, unknown>
  result?: unknown
  error?: string
  createdAt: number
  startedAt?: number
  completedAt?: number
}

interface JobQueueOptions {
  concurrency?: number // макс параллельных обработок
  timeoutMs?: number // timeout для task
}

class JobQueue {
  private jobs: Map<string, Job> = new Map()
  private queue: string[] = [] // ID очереди
  private processing: Set<string> = new Set() // ID обрабатываемых
  private processors: Map<string, (data: Record<string, unknown>) => Promise<unknown>> = new Map()
  private concurrency: number
  private timeoutMs: number

  constructor(options: JobQueueOptions = {}) {
    this.concurrency = options.concurrency || 3
    this.timeoutMs = options.timeoutMs || 30000
  }

  /**
   * Зарегистрировать обработчик для типа задачи
   */
  registerProcessor(type: string, processor: (data: Record<string, unknown>) => Promise<unknown>) {
    this.processors.set(type, processor)
  }

  /**
   * Добавить задачу в очередь
   */
  enqueue(id: string, userId: string, data: Record<string, unknown>): Job {
    const job: Job = {
      id,
      userId,
      status: "queued",
      data,
      createdAt: Date.now(),
    }
    this.jobs.set(id, job)
    this.queue.push(id)
    return job
  }

  /**
   * Получить задачу по ID
   */
  getJob(id: string): Job | undefined {
    return this.jobs.get(id)
  }

  /**
   * Получить все задачи пользователя
   */
  getUserJobs(userId: string): Job[] {
    return Array.from(this.jobs.values()).filter((j) => j.userId === userId)
  }

  /**
   * Начать обработку очереди
   */
  async start() {
    while (this.queue.length > 0 || this.processing.size > 0) {
      // Заполняем обработчиков если есть место
      while (this.queue.length > 0 && this.processing.size < this.concurrency) {
        const jobId = this.queue.shift()!
        const job = this.jobs.get(jobId)!

        this.processing.add(jobId)
        job.status = "processing"
        job.startedAt = Date.now()

        // Обработка в фоне (не await)
        this.processJob(jobId).catch((err) => {
          console.error(`Job ${jobId} error:`, err)
        })
      }

      // Ждём немного перед следующей проверкой
      if (this.processing.size > 0) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    }
  }

  /**
   * Обработать одну задачу
   */
  private async processJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId)
    if (!job) return

    try {
      const processorType = (job.data.type as string) || "default"
      const processor = this.processors.get(processorType)

      if (!processor) {
        throw new Error(`No processor for type: ${processorType}`)
      }

      // Выполнить с timeout
      const result = await Promise.race([
        processor(job.data),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Job timeout")), this.timeoutMs)
        ),
      ])

      job.status = "completed"
      job.result = result
      job.completedAt = Date.now()
    } catch (error) {
      job.status = "failed"
      job.error = error instanceof Error ? error.message : String(error)
      job.completedAt = Date.now()
    } finally {
      this.processing.delete(jobId)
    }
  }

  /**
   * Очистить завершённые задачи (старше чем timeoutMs)
   */
  cleanup() {
    const cutoff = Date.now() - this.timeoutMs * 2
    for (const [id, job] of this.jobs) {
      if (job.completedAt && job.completedAt < cutoff) {
        this.jobs.delete(id)
      }
    }
  }
}

// Глобальная очередь (singleton)
export const globalJobQueue = new JobQueue({
  concurrency: 3, // макс 3 параллельные обработки
  timeoutMs: 30000, // 30 сек timeout
})

// Автоматически запустить очередь при импорте
if (typeof window === "undefined") {
  // Только на сервере
  globalJobQueue.start().catch((err) => {
    console.error("Job queue error:", err)
  })

  // Периодическая очистка завершённых задач
  setInterval(() => {
    globalJobQueue.cleanup()
  }, 60000) // каждую минуту
}
