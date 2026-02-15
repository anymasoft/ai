/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * rate-limit.test.ts
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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRateLimitMiddleware, type RateLimitBinding } from '../rate-limit'
import type { Context, Next } from 'hono'

// Mock the log function
vi.mock('@libra/common', () => ({
  log: {
    cdn: vi.fn()
  }
}))

describe('Rate Limit Middleware', () => {
  let mockBinding: RateLimitBinding
  let mockContext: Partial<Context>
  let mockNext: Next

  beforeEach(() => {
    mockBinding = {
      limit: vi.fn()
    }
    
    mockContext = {
      get: vi.fn(),
      json: vi.fn().mockReturnValue({}),
      req: {
        url: 'http://localhost/upload',
        method: 'PUT'
      }
    } as any // Mock object for testing - using any is acceptable here
    
    mockNext = vi.fn()
  })

  it('should allow request when rate limit is not exceeded', async () => {
    // Setup
    const userSession = { user: { id: 'user123' } }
    ;(mockContext.get as any).mockReturnValue(userSession)
    ;(mockBinding.limit as any).mockResolvedValue({ success: true })

    const middleware = createRateLimitMiddleware({
      binding: mockBinding,
      keyPrefix: 'test'
    })

    // Execute
    await middleware(mockContext as Context, mockNext)

    // Verify
    expect(mockBinding.limit).toHaveBeenCalledWith({ key: 'test:user123' })
    expect(mockNext).toHaveBeenCalled()
    expect(mockContext.json).not.toHaveBeenCalled()
  })

  it('should block request when rate limit is exceeded', async () => {
    // Setup
    const userSession = { user: { id: 'user123' } }
    ;(mockContext.get as any).mockReturnValue(userSession)
    ;(mockBinding.limit as any).mockResolvedValue({ success: false })
    ;(mockContext.json as any).mockReturnValue('rate limited response')

    const middleware = createRateLimitMiddleware({
      binding: mockBinding,
      keyPrefix: 'test'
    })

    // Execute
    const result = await middleware(mockContext as Context, mockNext)

    // Verify
    expect(mockBinding.limit).toHaveBeenCalledWith({ key: 'test:user123' })
    expect(mockNext).not.toHaveBeenCalled()
    expect(mockContext.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Too Many Requests',
        message: 'Upload rate limit exceeded. Please wait before trying again.'
      }),
      429,
      expect.objectContaining({
        'Retry-After': '60'
      })
    )
  })

  it('should handle missing user session', async () => {
    // Setup
    ;(mockContext.get as any).mockReturnValue(null)
    ;(mockContext.json as any).mockReturnValue('unauthorized response')

    const middleware = createRateLimitMiddleware({
      binding: mockBinding
    })

    // Execute
    await middleware(mockContext as Context, mockNext)

    // Verify
    expect(mockBinding.limit).not.toHaveBeenCalled()
    expect(mockNext).not.toHaveBeenCalled()
    expect(mockContext.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Unauthorized'
      }),
      401
    )
  })

  it('should skip rate limiting when skipOnMissingUser is true', async () => {
    // Setup
    ;(mockContext.get as any).mockReturnValue(null)

    const middleware = createRateLimitMiddleware({
      binding: mockBinding,
      skipOnMissingUser: true
    })

    // Execute
    await middleware(mockContext as Context, mockNext)

    // Verify
    expect(mockBinding.limit).not.toHaveBeenCalled()
    expect(mockNext).toHaveBeenCalled()
    expect(mockContext.json).not.toHaveBeenCalled()
  })

  it('should handle errors gracefully and fail open', async () => {
    // Setup
    const userSession = { user: { id: 'user123' } }
    ;(mockContext.get as any).mockReturnValue(userSession)
    ;(mockBinding.limit as any).mockRejectedValue(new Error('Rate limit service error'))

    const middleware = createRateLimitMiddleware({
      binding: mockBinding
    })

    // Execute
    await middleware(mockContext as Context, mockNext)

    // Verify - should fail open and allow the request
    expect(mockNext).toHaveBeenCalled()
    expect(mockContext.json).not.toHaveBeenCalled()
  })
})
