import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getStorageBucket,
  getDatabase,
  getRequestId,
  getAuthInfo,
  createCacheKey,
  parseIntParam,
  createResponseHeaders,
  retryWithBackoff,
} from '../common'
import type { AppContext } from '../../types'

// Mock log module
vi.mock('@libra/common', () => ({
  log: {
    cdn: vi.fn(),
  },
}))

describe('Common Utilities', () => {
  const mockContext = {
    env: {
      BUCKET: {} as R2Bucket,
      DB: {} as D1Database,
    },
    req: {
      header: vi.fn(),
      path: '/test',
      method: 'GET',
    },
    get: vi.fn(),
  } as unknown as AppContext

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getStorageBucket', () => {
    it('should return BUCKET when available', () => {
      const bucket = getStorageBucket(mockContext)
      expect(bucket).toBe(mockContext.env.BUCKET)
    })

    it('should return R2 when BUCKET is not available', () => {
      const contextWithR2 = {
        ...mockContext,
        env: { R2: {} as R2Bucket },
      } as unknown as AppContext
      
      const bucket = getStorageBucket(contextWithR2)
      expect(bucket).toBe(contextWithR2.env.R2)
    })

    it('should throw error when no storage bucket is available', () => {
      const contextWithoutBucket = {
        ...mockContext,
        env: {},
      } as unknown as AppContext
      
      expect(() => getStorageBucket(contextWithoutBucket)).toThrow('Storage bucket not configured')
    })
  })

  describe('getDatabase', () => {
    it('should return DB when available', () => {
      const db = getDatabase(mockContext)
      expect(db).toBe(mockContext.env.DB)
    })

    it('should return DATABASE when DB is not available', () => {
      const contextWithDatabase = {
        ...mockContext,
        env: { DATABASE: {} as D1Database },
      } as unknown as AppContext
      
      const db = getDatabase(contextWithDatabase)
      expect(db).toBe(contextWithDatabase.env.DATABASE)
    })

    it('should throw error when no database is available', () => {
      const contextWithoutDb = {
        ...mockContext,
        env: {},
      } as unknown as AppContext
      
      expect(() => getDatabase(contextWithoutDb)).toThrow('Database not configured')
    })
  })

  describe('getRequestId', () => {
    it('should return existing request ID from header', () => {
      const contextWithRequestId = {
        ...mockContext,
        req: {
          ...mockContext.req,
          header: vi.fn((name) => name === 'x-request-id' ? 'existing-id' : null),
        },
      } as unknown as AppContext
      
      const id = getRequestId(contextWithRequestId)
      expect(id).toBe('existing-id')
    })

    it('should generate new request ID when not in header', () => {
      const id = getRequestId(mockContext)
      expect(id).toMatch(/^[a-f0-9-]{36}$/) // UUID format
    })
  })

  describe('getAuthInfo', () => {
    it('should return auth info when session exists', () => {
      const contextWithSession = {
        ...mockContext,
        get: vi.fn((key) => {
          if (key === 'userSession') {
            return {
              session: {
                userId: 'user-123',
                activeOrganizationId: 'org-456',
              },
            }
          }
        }),
      } as unknown as AppContext
      
      const authInfo = getAuthInfo(contextWithSession)
      expect(authInfo).toEqual({
        userId: 'user-123',
        organizationId: 'org-456',
      })
    })

    it('should return null when no session exists', () => {
      const authInfo = getAuthInfo(mockContext)
      expect(authInfo).toBeNull()
    })

    it('should use empty string for organizationId when not set', () => {
      const contextWithPartialSession = {
        ...mockContext,
        get: vi.fn((key) => {
          if (key === 'userSession') {
            return {
              session: {
                userId: 'user-123',
                activeOrganizationId: null,
              },
            }
          }
        }),
      } as unknown as AppContext
      
      const authInfo = getAuthInfo(contextWithPartialSession)
      expect(authInfo).toEqual({
        userId: 'user-123',
        organizationId: '',
      })
    })
  })

  describe('createCacheKey', () => {
    it('should create properly namespaced cache key', () => {
      const key = createCacheKey('images', 'user-123', 'profile.jpg')
      expect(key).toBe('libra:cdn:images:user-123:profile.jpg')
    })

    it('should handle single part', () => {
      const key = createCacheKey('config')
      expect(key).toBe('libra:cdn:config:')
    })

    it('should handle empty parts', () => {
      const key = createCacheKey('test', '', 'value')
      expect(key).toBe('libra:cdn:test::value')
    })
  })

  describe('parseIntParam', () => {
    it('should parse valid integer', () => {
      expect(parseIntParam('123', 0)).toBe(123)
    })

    it('should return default for undefined', () => {
      expect(parseIntParam(undefined, 42)).toBe(42)
    })

    it('should return default for invalid integer', () => {
      expect(parseIntParam('abc', 10)).toBe(10)
    })

    it('should respect minimum value', () => {
      expect(parseIntParam('5', 0, 10)).toBe(10)
    })

    it('should respect maximum value', () => {
      expect(parseIntParam('150', 0, 0, 100)).toBe(100)
    })

    it('should handle negative numbers', () => {
      expect(parseIntParam('-5', 0, -10, 10)).toBe(-5)
    })
  })

  describe('createResponseHeaders', () => {
    it('should create headers with security defaults', () => {
      const headers = createResponseHeaders('application/json')
      expect(headers).toEqual({
        'Content-Type': 'application/json',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
      })
    })

    it('should merge additional headers', () => {
      const headers = createResponseHeaders('text/plain', {
        'Cache-Control': 'no-cache',
        'X-Custom': 'value',
      })
      expect(headers).toEqual({
        'Content-Type': 'text/plain',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Cache-Control': 'no-cache',
        'X-Custom': 'value',
      })
    })

    it('should allow overriding security headers', () => {
      const headers = createResponseHeaders('text/html', {
        'X-Frame-Options': 'SAMEORIGIN',
      })
      expect(headers['X-Frame-Options']).toBe('SAMEORIGIN')
    })
  })

  describe('retryWithBackoff', () => {
    it('should succeed on first attempt', async () => {
      const operation = vi.fn().mockResolvedValue('success')
      
      const result = await retryWithBackoff(operation)
      
      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(1)
    })

    it('should retry on failure and eventually succeed', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValue('success')
      
      const onRetry = vi.fn()
      const result = await retryWithBackoff(operation, { onRetry })
      
      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(3)
      expect(onRetry).toHaveBeenCalledTimes(2)
    })

    it('should throw after max retries', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Always fails'))
      
      await expect(
        retryWithBackoff(operation, { maxRetries: 2 })
      ).rejects.toThrow('Always fails')
      
      expect(operation).toHaveBeenCalledTimes(2)
    })

    it('should respect delay timing', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('Fail'))
        .mockResolvedValue('success')
      
      const start = Date.now()
      await retryWithBackoff(operation, { initialDelay: 50 })
      const duration = Date.now() - start
      
      expect(duration).toBeGreaterThanOrEqual(50)
    })
  })


})