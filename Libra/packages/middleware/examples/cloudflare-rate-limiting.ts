/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * cloudflare-rate-limiting.ts
 * Copyright (C) 2025 Nextify Limited
 *
 * Example: Using Cloudflare Workers Native Rate Limiting
 * 
 * This example demonstrates how to use the new Cloudflare-native rate limiting
 * middleware in a Hono application running on Cloudflare Workers.
 */

import { Hono } from 'hono'
import {
  createCloudflareRateLimitMiddlewareFromEnv,
  createCloudflareUserRateLimitMiddleware,
  createCloudflareUploadRateLimitMiddleware,
  createCloudflareAuthRateLimitMiddleware,
  CloudflareRateLimitPresets
} from '@libra/middleware'

// Define your environment bindings
interface Env {
  RATE_LIMITER: any // Cloudflare rate limiting binding
  USER_RATE_LIMITER: any
  UPLOAD_RATE_LIMITER: any
  AUTH_RATE_LIMITER: any
}

const app = new Hono<{ Bindings: Env }>()

// General API rate limiting (100 requests per minute)
app.use('/api/*', createCloudflareRateLimitMiddlewareFromEnv({
  message: 'API rate limit exceeded. Please try again later.',
  retryAfterSeconds: 60
}))

// User-specific rate limiting for authenticated endpoints
app.use('/user/*', createCloudflareUserRateLimitMiddleware(
  CloudflareRateLimitPresets.moderate
))

// Upload-specific rate limiting (stricter limits)
app.use('/upload/*', createCloudflareUploadRateLimitMiddleware(
  CloudflareRateLimitPresets.upload
))

// Authentication rate limiting (very strict)
app.use('/auth/*', createCloudflareAuthRateLimitMiddleware(
  CloudflareRateLimitPresets.auth
))

// Your API routes
app.get('/api/data', (c) => {
  return c.json({ message: 'API data' })
})

app.post('/upload/file', (c) => {
  return c.json({ message: 'File uploaded' })
})

app.post('/auth/login', (c) => {
  return c.json({ message: 'Login attempt' })
})

export default app

/*
 * wrangler.toml configuration:
 * 
 * [[unsafe.bindings]]
 * name = "RATE_LIMITER"
 * type = "ratelimit"
 * namespace_id = "1001"
 * simple = { limit = 100, period = 60 }
 * 
 * [[unsafe.bindings]]
 * name = "USER_RATE_LIMITER"
 * type = "ratelimit"
 * namespace_id = "1002"
 * simple = { limit = 30, period = 60 }
 * 
 * [[unsafe.bindings]]
 * name = "UPLOAD_RATE_LIMITER"
 * type = "ratelimit"
 * namespace_id = "1003"
 * simple = { limit = 10, period = 60 }
 * 
 * [[unsafe.bindings]]
 * name = "AUTH_RATE_LIMITER"
 * type = "ratelimit"
 * namespace_id = "1004"
 * simple = { limit = 5, period = 900 }
 */
