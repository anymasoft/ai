import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HTTPException } from 'hono/http-exception'
import { ZodError, z } from 'zod/v4'
import {
  CDNError,
  ErrorCodes,
  errorHandler,
  withErrorHandling,
  CommonErrors,
} from '../error-handler'
import type { AppContext } from '../../types'

// Mock dependencies
vi.mock('@libra/common', () => ({
  log: {
    cdn: vi.fn(),
  },
}))

vi.mock('../../config', () => ({
  getConfig: vi.fn(() => ({
    ENVIRONMENT: 'test',
  })),
  isProduction: vi.fn(() => false),
}))

describe('Error Handler', () => {
  const mockContext = {
    req: {
      header: vi.fn(),
      path: '/test',
      method: 'GET',
    },
    json: vi.fn(),
  } as unknown as AppContext

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('CDNError', () => {
    it('should create error with all properties', () => {
      const error = new CDNError(400, 'TEST_ERROR', 'Test message', { foo: 'bar' })
      
      expect(error).toBeInstanceOf(Error)
      expect(error.name).toBe('CDNError')
      expect(error.statusCode).toBe(400)
      expect(error.code).toBe('TEST_ERROR')
      expect(error.message).toBe('Test message')
      expect(error.details).toEqual({ foo: 'bar' })
    })
  })

  describe('errorHandler', () => {
    const handler = errorHandler()

    it('should handle CDNError correctly', async () => {
      const error = new CDNError(400, ErrorCodes.INVALID_REQUEST, 'Bad request', { field: 'test' })
      
      await handler(error, mockContext)
      
      expect(mockContext.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ErrorCodes.INVALID_REQUEST,
            message: 'Bad request',
            details: { field: 'test' },
            requestId: expect.any(String),
          }),
        }),
        400
      )
    })

    it('should handle HTTPException correctly', async () => {
      const error = new HTTPException(404, { message: 'Not found' })
      
      await handler(error, mockContext)
      
      expect(mockContext.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ErrorCodes.NOT_FOUND,
            message: 'Not found',
            requestId: expect.any(String),
          }),
        }),
        404
      )
    })

    it('should handle ZodError correctly', async () => {
      // Create a ZodError by parsing invalid data
      const schema = z.object({ field: z.string() })
      let error: ZodError
      try {
        schema.parse({ field: 123 })
        throw new Error('Should have thrown ZodError')
      } catch (e) {
        error = e as ZodError
      }
      
      await handler(error, mockContext)
      
      expect(mockContext.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ErrorCodes.INVALID_REQUEST,
            message: 'Invalid request data',
            details: expect.any(Array),
            requestId: expect.any(String),
          }),
        }),
        500
      )
    })

    it('should handle generic errors correctly', async () => {
      const error = new Error('Something went wrong')
      
      await handler(error, mockContext)
      
      expect(mockContext.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ErrorCodes.INTERNAL_ERROR,
            message: 'Something went wrong',
            requestId: expect.any(String),
          }),
        }),
        500
      )
    })

    it('should use request ID from header if available', async () => {
      const error = new Error('Test error')
      const contextWithRequestId = {
        ...mockContext,
        req: {
          ...mockContext.req,
          header: vi.fn((name) => name === 'x-request-id' ? 'custom-id' : null),
        },
      } as unknown as AppContext
      
      await handler(error, contextWithRequestId)
      
      expect(contextWithRequestId.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            requestId: 'custom-id',
          }),
        }),
        500
      )
    })
  })

  describe('withErrorHandling', () => {
    it('should return response when handler succeeds', async () => {
      const mockResponse = new Response('Success')
      const handler = vi.fn().mockResolvedValue(mockResponse)
      const wrapped = withErrorHandling(handler)
      
      const result = await wrapped(mockContext)
      
      expect(result).toBe(mockResponse)
      expect(handler).toHaveBeenCalledWith(mockContext)
    })

    it('should wrap non-CDN errors as CDNError', async () => {
      const handler = vi.fn().mockRejectedValue(new Error('Test error'))
      const wrapped = withErrorHandling(handler)
      
      await expect(wrapped(mockContext)).rejects.toThrow(CDNError)
      
      try {
        await wrapped(mockContext)
      } catch (error) {
        expect(error).toBeInstanceOf(CDNError)
        expect((error as CDNError).code).toBe(ErrorCodes.INTERNAL_ERROR)
        expect((error as CDNError).statusCode).toBe(500)
      }
    })

    it('should pass through CDNError unchanged', async () => {
      const originalError = new CDNError(400, 'TEST', 'Test message')
      const handler = vi.fn().mockRejectedValue(originalError)
      const wrapped = withErrorHandling(handler)
      
      await expect(wrapped(mockContext)).rejects.toThrow(originalError)
    })

    it('should pass through HTTPException unchanged', async () => {
      const originalError = new HTTPException(404, { message: 'Not found' })
      const handler = vi.fn().mockRejectedValue(originalError)
      const wrapped = withErrorHandling(handler)
      
      await expect(wrapped(mockContext)).rejects.toThrow(originalError)
    })
  })

  describe('CommonErrors', () => {
    it('should create unauthorized error', () => {
      const error = CommonErrors.unauthorized()
      expect(error.statusCode).toBe(401)
      expect(error.code).toBe(ErrorCodes.UNAUTHORIZED)
      expect(error.message).toBe('Authentication required')
    })

    it('should create forbidden error with custom reason', () => {
      const error = CommonErrors.forbidden('Insufficient permissions')
      expect(error.statusCode).toBe(403)
      expect(error.code).toBe(ErrorCodes.FORBIDDEN)
      expect(error.message).toBe('Insufficient permissions')
    })

    it('should create not found error', () => {
      const error = CommonErrors.notFound('User')
      expect(error.statusCode).toBe(404)
      expect(error.code).toBe(ErrorCodes.NOT_FOUND)
      expect(error.message).toBe('User not found')
    })

    it('should create quota exceeded error', () => {
      const error = CommonErrors.quotaExceeded('storage')
      expect(error.statusCode).toBe(429)
      expect(error.code).toBe(ErrorCodes.QUOTA_EXCEEDED)
      expect(error.message).toBe('storage quota exceeded. Please upgrade your plan.')
    })

    it('should create rate limited error', () => {
      const error = CommonErrors.rateLimited(60)
      expect(error.statusCode).toBe(429)
      expect(error.code).toBe(ErrorCodes.RATE_LIMITED)
      expect(error.details).toEqual({ retryAfter: 60 })
    })
  })
})