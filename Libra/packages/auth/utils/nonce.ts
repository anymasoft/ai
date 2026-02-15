/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * nonce.ts
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

import { randomBytes } from 'node:crypto'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { log } from '@libra/common'

// Nonce configuration
const NONCE_EXPIRY_MINUTES = 15
const NONCE_LENGTH = 32 // bytes
const NONCE_PREFIX = 'oauth_nonce:'

export interface NonceData {
  nonce: string
  orgId: string
  userId: string
  timestamp: number
  expiresAt: number
}

/**
 * Generate a cryptographically secure nonce for OAuth state protection
 * @param orgId Organization ID
 * @param userId User ID
 * @returns Promise<NonceData> Generated nonce data
 */
export async function generateSecureNonce(orgId: string, userId: string): Promise<NonceData> {
  // Generate cryptographically secure random bytes
  const randomBuffer = randomBytes(NONCE_LENGTH)
  const nonce = randomBuffer.toString('hex')
  
  const timestamp = Date.now()
  const expiresAt = timestamp + (NONCE_EXPIRY_MINUTES * 60 * 1000)
  
  const nonceData: NonceData = {
    nonce,
    orgId,
    userId,
    timestamp,
    expiresAt
  }
  
  // Store nonce in KV with expiration
  await storeNonce(nonce, nonceData)
  
  return nonceData
}

/**
 * Validate and consume a nonce (single-use)
 * @param nonce The nonce to validate
 * @param expectedOrgId Expected organization ID
 * @param expectedUserId Expected user ID (optional for some flows)
 * @returns Promise<boolean> True if nonce is valid and consumed
 */
export async function validateAndConsumeNonce(
  nonce: string, 
  expectedOrgId: string, 
  expectedUserId?: string
): Promise<boolean> {
  try {
    // Retrieve nonce data from storage
    const nonceData = await retrieveNonce(nonce)
    
    if (!nonceData) {
      return false
    }
    
    // Check expiration
    const now = Date.now()
    if (now > nonceData.expiresAt) {
      await deleteNonce(nonce) // Clean up expired nonce
      return false
    }
    
    // Validate organization ID
    if (nonceData.orgId !== expectedOrgId) {
      return false
    }
    
    // Validate user ID if provided
    if (expectedUserId && nonceData.userId !== expectedUserId) {
      return false
    }
    
    // Consume nonce (delete it to prevent reuse)
    await deleteNonce(nonce)
    
    return true
  } catch (error) {
    log.auth('error', 'Nonce validation failed', {
      operation: 'validate_and_consume_nonce',
      nonce: `${nonce.substring(0, 8)}...`, // Log truncated nonce for debugging
      expectedOrgId,
      expectedUserId,
    }, error as Error)
    return false
  }
}

/**
 * Store nonce in KV storage with TTL
 */
async function storeNonce(nonce: string, nonceData: NonceData): Promise<void> {
  try {
    const context = await getCloudflareContext({ async: true })
    const kv = (context.env as any)?.KV
    
    if (!kv) {
      throw new Error('KV storage not available')
    }
    
    const key = `${NONCE_PREFIX}${nonce}`
    const value = JSON.stringify(nonceData)
    const ttlSeconds = Math.ceil(NONCE_EXPIRY_MINUTES * 60)
    
    await kv.put(key, value, { expirationTtl: ttlSeconds })
  } catch (error) {
    log.auth('error', 'Failed to store nonce in KV storage', {
      operation: 'store_nonce',
      nonce: `${nonce.substring(0, 8)}...`, // Log truncated nonce for debugging
      ttlSeconds: Math.ceil(NONCE_EXPIRY_MINUTES * 60),
    }, error as Error)
    throw new Error('Failed to store nonce for replay protection')
  }
}

/**
 * Retrieve nonce from KV storage
 */
async function retrieveNonce(nonce: string): Promise<NonceData | null> {
  try {
    const context = await getCloudflareContext({ async: true })
    const kv = (context.env as any)?.KV
    
    if (!kv) {
      throw new Error('KV storage not available')
    }
    
    const key = `${NONCE_PREFIX}${nonce}`
    const value = await kv.get(key)
    
    if (!value) {
      return null
    }
    
    return JSON.parse(value) as NonceData
  } catch (error) {
    log.auth('error', 'Failed to retrieve nonce from KV storage', {
      operation: 'retrieve_nonce',
      nonce: `${nonce.substring(0, 8)}...`, // Log truncated nonce for debugging
    }, error as Error)
    return null
  }
}

/**
 * Delete nonce from KV storage
 */
async function deleteNonce(nonce: string): Promise<void> {
  try {
    const context = await getCloudflareContext({ async: true })
    const kv = (context.env as any)?.KV
    
    if (!kv) {
      throw new Error('KV storage not available')
    }
    
    const key = `${NONCE_PREFIX}${nonce}`
    await kv.delete(key)
  } catch (error) {
    log.auth('warn', 'Failed to delete nonce from KV storage', {
      operation: 'delete_nonce',
      nonce: `${nonce.substring(0, 8)}...`, // Log truncated nonce for debugging
    }, error as Error)
    // Don't throw here as this is cleanup
  }
}

/**
 * Clean up expired nonces (utility function for maintenance)
 * Note: KV automatically handles TTL, but this can be used for manual cleanup
 */
export async function cleanupExpiredNonces(): Promise<void> {
  // KV automatically handles TTL expiration
}
