/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * logger.ts
 * Copyright (C) 2025 Nextify Limited
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 *
 */

import type { Bindings } from '../types'

/**
 * Log levels
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

/**
 * Log entry interface
 */
export interface LogEntry {
  timestamp: string
  level: string
  service: string
  message: string
  data?: Record<string, any>
  deploymentId?: string
  requestId?: string
  userId?: string
  organizationId?: string
}

/**
 * Logger class for structured logging
 */
export class Logger {
  private service = 'deploy-v2'
  private logLevel: LogLevel
  private env: Bindings

  constructor(env: Bindings, service?: string) {
    this.env = env
    this.service = service || 'deploy-v2'
    this.logLevel = this.parseLogLevel(env.LOG_LEVEL || 'info')
  }

  /**
   * Parse log level from string
   */
  private parseLogLevel(level: string): LogLevel {
    switch (level.toLowerCase()) {
      case 'debug': return LogLevel.DEBUG
      case 'info': return LogLevel.INFO
      case 'warn': return LogLevel.WARN
      case 'error': return LogLevel.ERROR
      default: return LogLevel.INFO
    }
  }

  /**
   * Check if log level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    return level >= this.logLevel
  }

  /**
   * Create log entry
   */
  private createLogEntry(
    level: string,
    message: string,
    data?: Record<string, any>
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      service: this.service,
      message,
      data,
      deploymentId: data?.deploymentId,
      requestId: data?.requestId,
      userId: data?.userId,
      organizationId: data?.organizationId
    }
  }

  /**
   * Output log entry
   */
  private output(entry: LogEntry): void {
    const logString = JSON.stringify(entry)
    
    // Use appropriate console method based on level
    switch (entry.level) {
      case 'DEBUG':
        console.debug(logString)
        break
      case 'INFO':
        console.info(logString)
        break
      case 'WARN':
        console.warn(logString)
        break
      case 'ERROR':
        console.error(logString)
        break
      default:
        console.log(logString)
    }
  }

  /**
   * Debug level logging
   */
  debug(message: string, data?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      const entry = this.createLogEntry('DEBUG', message, data)
      this.output(entry)
    }
  }

  /**
   * Info level logging
   */
  info(message: string, data?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.INFO)) {
      const entry = this.createLogEntry('INFO', message, data)
      this.output(entry)
    }
  }

  /**
   * Warning level logging
   */
  warn(message: string, data?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.WARN)) {
      const entry = this.createLogEntry('WARN', message, data)
      this.output(entry)
    }
  }

  /**
   * Error level logging
   */
  error(message: string, data?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      const entry = this.createLogEntry('ERROR', message, data)
      this.output(entry)
    }
  }

  /**
   * Log deployment step
   */
  step(stepName: string, message: string, data?: Record<string, any>): void {
    this.info(`[${stepName}] ${message}`, {
      ...data,
      step: stepName
    })
  }

  /**
   * Log deployment workflow events
   */
  workflow(event: string, deploymentId: string, data?: Record<string, any>): void {
    this.info(`[Workflow] ${event}`, {
      ...data,
      deploymentId,
      event
    })
  }

  /**
   * Log queue events
   */
  queue(event: string, data?: Record<string, any>): void {
    this.info(`[Queue] ${event}`, {
      ...data,
      event
    })
  }

  /**
   * Log API events
   */
  api(method: string, path: string, data?: Record<string, any>): void {
    this.info(`[API] ${method} ${path}`, {
      ...data,
      method,
      path
    })
  }

  /**
   * Log performance metrics
   */
  performance(operation: string, duration: number, data?: Record<string, any>): void {
    this.info(`[Performance] ${operation} completed in ${duration}ms`, {
      ...data,
      operation,
      duration
    })
  }

  /**
   * Create child logger with additional context
   */
  child(context: Record<string, any>): Logger {
    const childLogger = new Logger(this.env, this.service)
    
    // Override output method to include context
    const originalOutput = childLogger.output.bind(childLogger)
    childLogger.output = (entry: LogEntry) => {
      originalOutput({
        ...entry,
        data: { ...context, ...entry.data }
      })
    }

    return childLogger
  }
}

/**
 * Create logger instance
 */
export function createLogger(env: Bindings, service?: string): Logger {
  return new Logger(env, service)
}

/**
 * Log step utility function (for backward compatibility)
 * Now uses structured logging instead of console.log
 */
export function logStep(stepName: string, message: string, data?: Record<string, any>): void {
  // Create a basic logger for backward compatibility
  const logger = new Logger({ LOG_LEVEL: 'info' } as any, 'deploy-v2')
  logger.step(stepName, message, data)
}

/**
 * Performance measurement utility
 */
export class PerformanceTimer {
  private startTime: number
  private logger: Logger
  private operation: string

  constructor(logger: Logger, operation: string) {
    this.logger = logger
    this.operation = operation
    this.startTime = Date.now()
  }

  /**
   * End timer and log performance
   */
  end(data?: Record<string, any>): number {
    const duration = Date.now() - this.startTime
    this.logger.performance(this.operation, duration, data)
    return duration
  }
}

/**
 * Create performance timer
 */
export function createTimer(logger: Logger, operation: string): PerformanceTimer {
  return new PerformanceTimer(logger, operation)
}

/**
 * Async operation wrapper with logging
 */
export async function loggedOperation<T>(
  logger: Logger,
  operation: string,
  fn: () => Promise<T>,
  data?: Record<string, any>
): Promise<T> {
  const timer = createTimer(logger, operation)
  
  try {
    logger.debug(`Starting ${operation}`, data)
    const result = await fn()
    timer.end({ ...data, success: true })
    return result
  } catch (error) {
    const duration = timer.end({ ...data, success: false })
    logger.error(`${operation} failed after ${duration}ms`, {
      ...data,
      error: error instanceof Error ? error.message : String(error)
    })
    throw error
  }
}
