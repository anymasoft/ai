/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * turnstile.ts
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
 * Turnstile CAPTCHA integration types
 */

export interface TurnstileWidgetProps {
  siteKey: string
  onSuccess: (token: string) => void
  onError?: (error: string) => void
  onExpire?: () => void
  onLoad?: () => void
  className?: string
  theme?: 'light' | 'dark' | 'auto'
  size?: 'normal' | 'compact'
  tabIndex?: number
  responseField?: boolean
  responseFieldName?: string
  retry?: 'auto' | 'never'
  retryInterval?: number
  refreshExpired?: 'auto' | 'manual' | 'never'
  language?: string
  appearance?: 'always' | 'execute' | 'interaction-only'
  execution?: 'render' | 'execute'
}

export interface TurnstileInstance {
  reset: () => void
  remove: () => void
  render: () => void
  getResponse: () => string | null
}

export interface TurnstileVerificationRequest {
  token: string
  remoteip?: string
}

export interface TurnstileVerificationResponse {
  success: boolean
  'error-codes'?: string[]
  challenge_ts?: string
  hostname?: string
  action?: string
  cdata?: string
}

export interface TurnstileState {
  token: string | null
  isLoading: boolean
  isVerified: boolean
  error: string | null
  isExpired: boolean
}

export type TurnstileStatus = 'idle' | 'loading' | 'success' | 'error' | 'expired'

export interface UseTurnstileReturn extends TurnstileState {
  status: TurnstileStatus
  reset: () => void
  verify: (token: string) => Promise<boolean>
}
