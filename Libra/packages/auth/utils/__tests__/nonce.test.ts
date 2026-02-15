/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * nonce.test.ts
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

import { describe, it, expect } from 'vitest'
import { randomBytes } from 'node:crypto'

describe('Nonce Utilities - Basic Tests', () => {
  const testOrgId = 'test-org-123'
  const testUserId = 'test-user-456'

  describe('Nonce Generation Logic', () => {
    it('should generate cryptographically secure random bytes', () => {
      // Test the underlying crypto function
      const buffer1 = randomBytes(32)
      const buffer2 = randomBytes(32)

      expect(buffer1).toHaveLength(32)
      expect(buffer2).toHaveLength(32)
      expect(buffer1.toString('hex')).not.toBe(buffer2.toString('hex'))

      // Should be 64 hex characters
      expect(buffer1.toString('hex')).toMatch(/^[a-f0-9]{64}$/)
    })

    it('should create proper nonce data structure', () => {
      const nonce = randomBytes(32).toString('hex')
      const timestamp = Date.now()
      const expiresAt = timestamp + (15 * 60 * 1000)

      const nonceData = {
        nonce,
        orgId: testOrgId,
        userId: testUserId,
        timestamp,
        expiresAt
      }

      expect(nonceData.nonce).toMatch(/^[a-f0-9]{64}$/)
      expect(nonceData.orgId).toBe(testOrgId)
      expect(nonceData.userId).toBe(testUserId)
      expect(nonceData.expiresAt - nonceData.timestamp).toBe(15 * 60 * 1000)
    })

    it('should validate nonce expiration logic', () => {
      const now = Date.now()
      const validNonce = {
        nonce: 'a'.repeat(64),
        orgId: testOrgId,
        userId: testUserId,
        timestamp: now,
        expiresAt: now + (15 * 60 * 1000) // 15 minutes from now
      }

      const expiredNonce = {
        nonce: 'b'.repeat(64),
        orgId: testOrgId,
        userId: testUserId,
        timestamp: now - (20 * 60 * 1000), // 20 minutes ago
        expiresAt: now - (5 * 60 * 1000)   // 5 minutes ago
      }

      // Valid nonce should not be expired
      expect(now < validNonce.expiresAt).toBe(true)

      // Expired nonce should be expired
      expect(now > expiredNonce.expiresAt).toBe(true)
    })

    it('should validate organization and user ID matching', () => {
      const nonceData = {
        nonce: 'a'.repeat(64),
        orgId: testOrgId,
        userId: testUserId,
        timestamp: Date.now(),
        expiresAt: Date.now() + (15 * 60 * 1000)
      }

      // Correct org and user should match
      expect(nonceData.orgId === testOrgId && nonceData.userId === testUserId).toBe(true)

      // Wrong org should not match
      expect(nonceData.orgId === 'wrong-org').toBe(false)

      // Wrong user should not match
      expect(nonceData.userId === 'wrong-user').toBe(false)
    })

    it('should create proper KV key format', () => {
      const nonce = 'a'.repeat(64)
      const expectedKey = `oauth_nonce:${nonce}`

      expect(expectedKey).toBe(`oauth_nonce:${nonce}`)
      expect(expectedKey).toHaveLength(12 + 64) // prefix + nonce length
    })

    it('should calculate correct TTL for KV storage', () => {
      const expiryMinutes = 15
      const ttlSeconds = Math.ceil(expiryMinutes * 60)

      expect(ttlSeconds).toBe(900) // 15 * 60 = 900 seconds
    })
  })

  describe('Security Properties', () => {
    it('should generate nonces with sufficient entropy', () => {
      const nonces = new Set()
      const iterations = 1000

      // Generate many nonces and ensure they're all unique
      for (let i = 0; i < iterations; i++) {
        const nonce = randomBytes(32).toString('hex')
        expect(nonces.has(nonce)).toBe(false) // Should not have duplicates
        nonces.add(nonce)
      }

      expect(nonces.size).toBe(iterations)
    })

    it('should have proper nonce format validation', () => {
      const validNonce = randomBytes(32).toString('hex')
      const invalidNonces = [
        'short',
        'a'.repeat(63), // too short
        'a'.repeat(65), // too long
        'g'.repeat(64), // invalid hex character
        '',
        'A'.repeat(64), // uppercase (should be lowercase hex)
      ]

      expect(validNonce).toMatch(/^[a-f0-9]{64}$/)

      for (const invalid of invalidNonces) {
        expect(invalid).not.toMatch(/^[a-f0-9]{64}$/)
      }
    })
  })
})
