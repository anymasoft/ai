/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * cdn-utils.ts
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

/**
 * CDN Utilities - Unified CDN URL management
 * 
 * Provides centralized CDN URL handling for both frontend and backend environments
 */

/**
 * Environment detection for CDN URL configuration
 */
const isNextJsEnvironment = typeof window !== 'undefined' || process.env.NEXT_PUBLIC_CDN_URL
const DEFAULT_CDN_URL = 'http://localhost:3004'

/**
 * Get CDN base URL from environment variables
 * Supports both frontend (NEXT_PUBLIC_CDN_URL) and backend (CDN_URL) environments
 */
function getCdnBaseUrl(): string {
  // Frontend environment (browser or Next.js)
  if (isNextJsEnvironment) {
    return process.env.NEXT_PUBLIC_CDN_URL || DEFAULT_CDN_URL
  }
  
  // Backend environment - try both CDN_URL and NEXT_PUBLIC_CDN_URL
  return process?.env?.CDN_URL || process?.env?.NEXT_PUBLIC_CDN_URL || DEFAULT_CDN_URL
}

/**
 * CDN Utilities Class
 * Provides centralized methods for CDN URL operations
 */
export class CDNUtils {
  /**
   * Get the base CDN URL
   * @returns {string} CDN base URL
   */
  static getBaseUrl(): string {
    return getCdnBaseUrl()
  }

  /**
   * Get image URL by key
   * @param key - Image key from CDN
   * @returns {string} Full image URL
   */
  static getImageUrl(key: string): string {
    const baseUrl = getCdnBaseUrl()
    return `${baseUrl}/image/${key}`
  }

  /**
   * Get file URL by planId
   * @param planId - Plan ID for file access
   * @returns {string} Full file URL
   */
  static getFileUrl(planId: string): string {
    const baseUrl = getCdnBaseUrl()
    return `${baseUrl}/file/${planId}`
  }

  /**
   * Get upload endpoint URL
   * @returns {string} Upload endpoint URL
   */
  static getUploadUrl(): string {
    const baseUrl = getCdnBaseUrl()
    return `${baseUrl}/upload`
  }

  /**
   * Get screenshot URL by planId
   * @param planId - Plan ID for screenshot access
   * @returns {string} Full screenshot URL
   */
  static getScreenshotUrl(planId: string): string {
    const baseUrl = getCdnBaseUrl()
    return `${baseUrl}/screenshot/${planId}`
  }

  /**
   * Get screenshot upload endpoint URL
   * @returns {string} Screenshot upload endpoint URL
   */
  static getScreenshotUploadUrl(): string {
    const baseUrl = getCdnBaseUrl()
    return `${baseUrl}/screenshot`
  }

  /**
   * Get static asset URL
   * @param assetPath - Path to static asset (e.g., 'notification.wav', 'badge.js')
   * @returns {string} Full static asset URL
   */
  static getStaticAssetUrl(assetPath: string): string {
    const baseUrl = getCdnBaseUrl()
    // Remove leading slash if present to avoid double slashes
    const cleanPath = assetPath.startsWith('/') ? assetPath.slice(1) : assetPath
    return `${baseUrl}/${cleanPath}`
  }
}

/**
 * Convenience function for getting base CDN URL
 * Maintains backward compatibility with existing getCdnUrl functions
 */
export const getCdnUrl = (): string => CDNUtils.getBaseUrl()

/**
 * Export individual utility functions for direct usage
 */
export const getCdnImageUrl = (key: string): string => CDNUtils.getImageUrl(key)
export const getCdnFileUrl = (planId: string): string => CDNUtils.getFileUrl(planId)
export const getCdnUploadUrl = (): string => CDNUtils.getUploadUrl()
export const getCdnScreenshotUrl = (planId: string): string => CDNUtils.getScreenshotUrl(planId)
export const getCdnScreenshotUploadUrl = (): string => CDNUtils.getScreenshotUploadUrl()
export const getCdnStaticAssetUrl = (assetPath: string): string => CDNUtils.getStaticAssetUrl(assetPath) 