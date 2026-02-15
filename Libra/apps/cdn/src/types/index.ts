import type { HonoDbContext } from '@libra/db'
import type { Context } from 'hono'
import type { Pool } from 'pg'

/**
 * Cloudflare Workers environment bindings
 * @description Contains all the bindings available in the Cloudflare Workers environment
 * @note Based on CloudflareBindings but with flexible types for environment variables
 */
export interface Bindings {
  // Core Cloudflare bindings (from generated types)
  KV: KVNamespace
  BUCKET: R2Bucket
  DATABASE: D1Database
  HYPERDRIVE: Hyperdrive
  IMAGES: ImagesBinding
  ASSETS: Fetcher
  FILE_UPLOAD_RATE_LIMITER: RateLimit

  // Environment variables (flexible string types)
  LOG_LEVEL?: string
  ENVIRONMENT?: string

  // Additional custom bindings
  R2?: R2Bucket
  DB?: D1Database  // Alias for DATABASE
  CLOUDFLARE_IMAGES?: unknown

  // Database connection strings
  DATABASE_URL?: string
  POSTGRES_URL?: string

  // Index signature to make it compatible with BaseBindings
  [key: string]: unknown
}

/**
 * Cloudflare Images API request structure
 */
export interface CloudflareImagesAPI {
  url: string
  method: string
  headers: HeadersInit
  body?: FormData
}

/**
 * User session structure
 * @description Standardized user session interface
 */
export interface UserSession {
  session: {
    id: string
    token: string
    userId: string
    expiresAt: Date
    createdAt: Date
    updatedAt: Date
    ipAddress?: string | null
    userAgent?: string | null
    activeOrganizationId?: string | null
    [key: string]: unknown
  }
  user: {
    id: string
    email: string
    name?: string | null
  }
}

/**
 * Variables available in the Hono context
 * @description Contains request-scoped variables like user session and request tracking
 */
export interface Variables {
  userSession?: UserSession
  // Request ID from Hono middleware (required for compatibility with BaseVariables)
  requestId: string
}

/**
 * Extended variables for CDN context with database pool support
 * @description Includes database connection pool for CDN-specific operations
 */
export interface CDNVariables extends Variables {
  dbPool?: Pool
}

/**
 * Application context type
 * @description The main context type used throughout the application
 */
export type AppContext = Context<{
  Bindings: Bindings
  Variables: Variables
}> & HonoDbContext

/**
 * CDN-specific context type
 * @description Context type for CDN operations with database pool support
 * @note This extends the base context with CDN-specific variables and ensures
 *       compatibility with database operations and quota management
 */
export type CDNContext = Context<{
  Bindings: Bindings
  Variables: CDNVariables
}> & HonoDbContext

/**
 * File metadata stored in KV
 */
export interface FileMetadata {
  sha256: string
  planId?: string
  public?: boolean
  uploadedBy?: string
  organizationId?: string
  uploadedAt: string
  size: number
  contentType: string
}

export interface QuotaInfo {
  used: number
  limit: number
  remaining: number
}

export interface UploadResult {
  success: boolean
  url?: string
  error?: string
  quota?: QuotaInfo
}

export interface DeleteResult {
  success: boolean
  message: string
  error?: string
}

export interface ScreenshotMetadata {
  planId: string
  uploadedAt: string
  size: number
}

export interface BadgeConfig {
  projectUrl: string
  style?: 'dark' | 'light'
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
}

/**
 * Subscription limit record from database
 * @description Type-safe representation of subscription_limit table record
 */
export interface SubscriptionLimitRecord {
  id: string
  organizationId: string
  stripeCustomerId: string | null
  planName: string
  planId: string
  aiNums: number
  enhanceNums: number
  uploadLimit: number
  seats: number
  projectNums: number
  isActive: boolean
  periodStart: string
  periodEnd: string
  createdAt: string | null
  updatedAt: string | null
}

/**
 * Database context interface for functions requiring database access
 * @description Ensures type safety for database operations
 */
export interface DatabaseContext {
  env: {
    HYPERDRIVE?: Hyperdrive
    DATABASE?: D1Database
    POSTGRES_URL?: string
  }
}

/**
 * OpenAPI route handler type
 * @description Type for OpenAPI route handlers with proper context typing
 */
export type OpenAPIRouteHandler = (c: AppContext) => Promise<Response>