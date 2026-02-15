/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * useAuthForm.ts
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

'use client'

import { authClient, signIn } from '@libra/auth/auth-client'
import { useCallback, useEffect, useState } from 'react'
import type { TurnstileState } from '../../../types/turnstile'
import { toast } from '@libra/ui/components/sonner'

/**
 * GitHub OAuth login states for enhanced user feedback
 */
export type GitHubLoginState =
  | 'idle'
  | 'connecting'
  | 'redirecting'
  | 'authorizing'
  | 'success'
  | 'error'

/**
 * GitHub OAuth error types for better error handling
 */
export type GitHubErrorType =
  | 'network'
  | 'oauth'
  | 'popup_blocked'
  | 'timeout'
  | 'cancelled'
  | 'unknown'

/**
 * Custom hook for auth form logic and validation
 */
export function useAuthForm() {
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGitHubLoading, setIsGitHubLoading] = useState(false)
  const [isEmailValid, setIsEmailValid] = useState(false)
  const [showOtpInput, setShowOtpInput] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // Turnstile CAPTCHA state
  const [turnstileState, setTurnstileState] = useState<TurnstileState>({
    token: null,
    isLoading: false,
    isVerified: false,
    error: null,
    isExpired: false,
  })

  // Validate email
  useEffect(() => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    setIsEmailValid(emailRegex.test(email))
  }, [email])

  // Turnstile handlers
  const handleTurnstileSuccess = useCallback((token: string) => {
    setTurnstileState((prev) => ({
      ...prev,
      token,
      isVerified: true,
      isLoading: false,
      error: null,
      isExpired: false,
    }))
  }, [])

  const handleTurnstileError = useCallback((error: string) => {
    setTurnstileState((prev) => ({
      ...prev,
      token: null,
      isVerified: false,
      isLoading: false,
      error,
      isExpired: false,
    }))
    setErrorMessage('CAPTCHA verification failed. Please try again.')
  }, [])

  const handleTurnstileExpire = useCallback(() => {
    setTurnstileState((prev) => ({
      ...prev,
      token: null,
      isVerified: false,
      isLoading: false,
      error: null,
      isExpired: true,
    }))
    setErrorMessage('CAPTCHA verification expired. Please verify again.')
  }, [])

  const handleTurnstileLoad = useCallback(() => {
    setTurnstileState((prev) => ({
      ...prev,
      isLoading: false,
    }))
  }, [])

  const resetTurnstile = useCallback(() => {
    setTurnstileState({
      token: null,
      isLoading: false,
      isVerified: false,
      error: null,
      isExpired: false,
    })
  }, [])

  // Handle OTP sending
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isEmailValid) return

    // Check Turnstile verification
    if (!turnstileState.isVerified || !turnstileState.token) {
      setErrorMessage('Please complete the CAPTCHA verification.')
      return
    }

    // Set submitting state
    setIsSubmitting(true)
    setErrorMessage('')

    try {
      // Proceed with OTP sending (better-auth will verify CAPTCHA token)
      // @ts-ignore
      const { data, error } = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: 'sign-in',
        fetchOptions: {
          headers: {
            'x-captcha-response': turnstileState.token,
          },
        },
      })

      // Handle response
      if (error) {
        // Handle specific error codes if provided by the API
        if (error.code === 'RATE_LIMITED') {
          setErrorMessage('Too many attempts. Please try again later.')
        } else {
          setErrorMessage(
            error.message || 'Failed to send verification code. Please try again later.'
          )
        }
      } else {
        setShowOtpInput(true)
      }
    } catch (error) {
      // Handle unexpected errors (likely network or server issues)
      setErrorMessage('Server error. Please check your connection and try again later.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle auth success and token storage
  const handleAuthSuccess = (ctx: any) => {
    try {
      // Extract token from response headers
      const authToken = ctx.response.headers.get('set-auth-token')

      // Validate token existence
      if (!authToken) {
        return
      }

      // Validate token format (basic check)
      if (typeof authToken !== 'string' || authToken.trim().length === 0) {
        return
      }

      // Store token securely in localStorage
      try {
        localStorage.setItem('bearer_token', authToken)
      } catch (storageError) {
        // Continue execution even if storage fails - user is still authenticated
      }
    } catch (error) {
      // Don't throw error to prevent breaking the auth flow
    }
  }

  // Handle OTP verification
  const verifyOtp = async () => {
    if (!otp || otp.length < 6) {
      setErrorMessage('Please enter a valid verification code')
      return
    }

    setIsSubmitting(true)
    setErrorMessage('')

    try {
      // Call better-auth to verify OTP with success callback
      // @ts-ignore
      const { data, error } = await authClient.signIn.emailOtp(
        {
          email,
          otp,
        },
        {
          onSuccess: (ctx: any) => {
            handleAuthSuccess(ctx)
          },
        }
      )

      if (error) {
        // Handle specific error codes
        if (error.code === 'INVALID_OTP') {
          setErrorMessage('Invalid verification code')
        } else if (error.code === 'EXPIRED_OTP') {
          setErrorMessage('Verification code has expired')
        } else if (error.code === 'MAX_ATTEMPTS_EXCEEDED') {
          setErrorMessage('Too many failed attempts. Please request a new code.')
        } else {
          setErrorMessage(error.message || 'Invalid or expired verification code')
        }
      } else {
        // Add redirect logic after successful verification
        window.location.href = '/dashboard'
      }
    } catch (error) {
      // Handle unexpected errors
      setErrorMessage('Server error. Please try again later.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Reset OTP form, go back to email input
  const resetOtpForm = () => {
    setShowOtpInput(false)
    setOtp('')
    setErrorMessage('')
  }

  // Handle GitHub login
  const handleGitHubLogin = async () => {
    setIsGitHubLoading(true)
    setErrorMessage('')

    try {
      // Call better-auth GitHub social login
      await signIn.social({
        provider: 'github',
        callbackURL: '/dashboard',
      })

      // Note: Better-auth will handle the redirect automatically
      // No need to manually handle success here as the page will redirect
    } catch (error) {
      // Handle different types of errors
      if (error instanceof Error) {
        if (error.message.includes('network') || error.message.includes('fetch')) {
          setErrorMessage('Network error. Please check your connection and try again.')
        } else if (error.message.includes('oauth') || error.message.includes('github')) {
          setErrorMessage('GitHub authentication failed. Please try again.')
        } else {
          setErrorMessage('Login failed. Please try again later.')
        }
      } else {
        setErrorMessage('An unexpected error occurred. Please try again.')
      }
    } finally {
      setIsGitHubLoading(false)
    }
  }

  return {
    email,
    setEmail,
    otp,
    setOtp,
    isSubmitting,
    isGitHubLoading,
    isEmailValid,
    showOtpInput,
    errorMessage,
    handleSubmit,
    handleGitHubLogin,
    verifyOtp,
    resetOtpForm,
    // Turnstile related
    turnstileState,
    handleTurnstileSuccess,
    handleTurnstileError,
    handleTurnstileExpire,
    handleTurnstileLoad,
    resetTurnstile,
  }
}
