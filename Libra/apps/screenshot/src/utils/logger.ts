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
  screenshotId?: string
  requestId?: string
  userId?: string
  organizationId?: string
}

/**
 * Logger class for structured logging
 */
export class Logger {
  private service = 'screenshot-service'
  private logLevel: LogLevel
  private env: Bindings

  constructor(env: Bindings, service?: string) {
    this.env = env
    this.service = service || 'screenshot-service'
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
      screenshotId: data?.screenshotId,
      requestId: data?.requestId,
      userId: data?.userId,
      organizationId: data?.organizationId
    }
  }

  /**
   * Log message to console and optionally to R2
   */
  private async log(
    level: LogLevel,
    levelName: string,
    message: string,
    data?: Record<string, any>,
    error?: Error
  ): Promise<void> {
    if (!this.shouldLog(level)) {
      return
    }

    const logEntry = this.createLogEntry(levelName, message, data)

    // Add error details if provided
    if (error) {
      logEntry.data = {
        ...logEntry.data,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        }
      }
    }

    // Console logging
    const logMessage = `[${logEntry.timestamp}] ${levelName.toUpperCase()}: ${message}`
    const logData = logEntry.data ? JSON.stringify(logEntry.data, null, 2) : ''

    // Console logging for development and debugging
    if (level === LogLevel.ERROR) {
      console.error(logMessage, logData, error)
    } else if (level === LogLevel.WARN) {
      console.warn(logMessage, logData)
    } else if (level === LogLevel.INFO) {
      console.info(logMessage, logData)
    } else if (level === LogLevel.DEBUG) {
      console.log(logMessage, logData)
    }

    // Store logs in R2 for persistence (non-blocking)
    if (this.env.SCREENSHOT_LOGS && level >= LogLevel.WARN) {
      this.storeLogToR2(logEntry).catch(err => {
        console.error('Failed to store log to R2:', err)
      })
    }
  }

  /**
   * Store log entry to R2 bucket
   */
  private async storeLogToR2(logEntry: LogEntry): Promise<void> {
    try {
      const key = `logs/${new Date().toISOString().split('T')[0]}/${logEntry.timestamp}-${logEntry.screenshotId || 'unknown'}.json`
      await this.env.SCREENSHOT_LOGS.put(key, JSON.stringify(logEntry, null, 2), {
        httpMetadata: {
          contentType: 'application/json'
        }
      })
    } catch (error) {
      // Don't throw - logging should not break the main flow
      console.error('R2 log storage failed:', error)
    }
  }

  /**
   * Debug level logging
   */
  debug(message: string, data?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, 'debug', message, data)
  }

  /**
   * Info level logging
   */
  info(message: string, data?: Record<string, any>): void {
    this.log(LogLevel.INFO, 'info', message, data)
  }

  /**
   * Warning level logging
   */
  warn(message: string, data?: Record<string, any>): void {
    this.log(LogLevel.WARN, 'warn', message, data)
  }

  /**
   * Error level logging
   */
  error(message: string, data?: Record<string, any>, error?: Error): void {
    this.log(LogLevel.ERROR, 'error', message, data, error)
  }

  /**
   * Create child logger with additional context
   */
  child(context: Record<string, any>): Logger {
    const childLogger = new Logger(this.env, this.service)
    
    // Override log method to include context
    const originalLog = childLogger.log.bind(childLogger)
    childLogger.log = async (level, levelName, message, data, error) => {
      const mergedData = { ...context, ...data }
      return originalLog(level, levelName, message, mergedData, error)
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
 * Generate batch ID for queue processing
 */
export function generateBatchId(): string {
  return `batch_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
}
