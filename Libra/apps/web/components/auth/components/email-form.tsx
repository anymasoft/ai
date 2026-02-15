/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * email-form.tsx
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

import { Button } from '@libra/ui/components/button'
import type React from 'react'
import { useId, useState, useEffect, useCallback } from 'react'
import type { TurnstileState } from '../../../types/turnstile'
import TurnstileWidget from './turnstile-widget'
import { useTheme } from 'next-themes'
import * as m from '@/paraglide/messages'
import { toast } from '@libra/ui/components/sonner'

interface EmailFormProps {
  email: string
  setEmail: (email: string) => void
  isSubmitting: boolean
  isGitHubLoading: boolean
  isEmailValid: boolean
  errorMessage: string | null
  handleSubmit: (e: React.FormEvent) => Promise<void>
  handleGitHubLogin: () => Promise<void>
  // Turnstile props
  turnstileState: TurnstileState
  handleTurnstileSuccess: (token: string) => void
  handleTurnstileError: (error: string) => void
  handleTurnstileExpire: () => void
  handleTurnstileLoad: () => void
}

export default function EmailForm({
  email,
  setEmail,
  isSubmitting,
  isGitHubLoading,
  isEmailValid,
  errorMessage,
  handleSubmit,
  handleGitHubLogin,
  turnstileState,
  handleTurnstileSuccess,
  handleTurnstileError,
  handleTurnstileExpire,
  handleTurnstileLoad,
}: EmailFormProps) {
  const { resolvedTheme } = useTheme()
  const emailInputId = useId()
  const submitHelpId = useId()

  // Enhanced GitHub login state management
  const [githubState, setGithubState] = useState<'idle' | 'connecting' | 'redirecting'>('idle')
  const [clickFeedback, setClickFeedback] = useState(false)

  // Enhanced GitHub login handler with better UX
  const handleEnhancedGitHubLogin = useCallback(async () => {
    try {
      // Immediate click feedback
      setClickFeedback(true)
      setTimeout(() => setClickFeedback(false), 150)

      // Update state to connecting
      setGithubState('connecting')

      // Show connecting toast
      toast.loading(m["auth.email_form.github_connecting"](), {
        id: 'github-auth',
        duration: 10000,
      })

      // Small delay for better UX perception
      await new Promise(resolve => setTimeout(resolve, 300))

      // Update state to redirecting
      setGithubState('redirecting')

      // Update toast message
      toast.loading(m["auth.email_form.github_redirecting"](), {
        id: 'github-auth',
        duration: 15000,
      })

      // Call the original handler
      await handleGitHubLogin()

      // Success state (this might not execute due to redirect)
      toast.success(m["auth.email_form.github_success"](), {
        id: 'github-auth',
      })

    } catch (error) {
      // Reset state on error
      setGithubState('idle')

      // Dismiss loading toast
      toast.dismiss('github-auth')

      // Show error toast with enhanced error handling
      const errorMessage = error instanceof Error ? error.message : m["auth.email_form.unknown_error"]()

      if (errorMessage.includes('popup') || errorMessage.includes('blocked')) {
        toast.error(m["auth.email_form.github_popup_blocked"](), {
          duration: 10000,
          description: m["auth.email_form.help_popup_blocked"](),
          action: {
            label: m["auth.email_form.retry"](),
            onClick: () => handleEnhancedGitHubLogin(),
          },
        })
      } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        toast.error(m["auth.email_form.github_network_error"](), {
          duration: 8000,
          action: {
            label: m["auth.email_form.retry"](),
            onClick: () => handleEnhancedGitHubLogin(),
          },
        })
      } else if (errorMessage.includes('timeout')) {
        toast.error(m["auth.email_form.github_timeout"](), {
          duration: 6000,
          action: {
            label: m["auth.email_form.retry"](),
            onClick: () => handleEnhancedGitHubLogin(),
          },
        })
      } else if (errorMessage.includes('cancel') || errorMessage.includes('abort')) {
        toast.info(m["auth.email_form.github_cancelled"](), {
          duration: 4000,
        })
      } else {
        toast.error(m["auth.email_form.github_error"](), {
          duration: 5000,
          action: {
            label: m["auth.email_form.retry"](),
            onClick: () => handleEnhancedGitHubLogin(),
          },
        })
      }
    }
  }, [githubState, isGitHubLoading, isSubmitting, handleGitHubLogin])

  // Keyboard navigation support
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (githubState === 'idle' && !isGitHubLoading && !isSubmitting) {
        handleEnhancedGitHubLogin()
      }
    }
  }, [githubState, isGitHubLoading, isSubmitting, handleEnhancedGitHubLogin])

  // Reset GitHub state when isGitHubLoading changes
  useEffect(() => {
    if (!isGitHubLoading && githubState !== 'idle') {
      setGithubState('idle')
      toast.dismiss('github-auth')
    }
  }, [isGitHubLoading, githubState])
  
  return (
    <div className='' role="main" aria-labelledby="auth-form-title">
      <div className='flex flex-col p-6 space-y-1.5'>
        <h3 id="auth-form-title" className='font-semibold tracking-tight text-2xl'>{m["auth.email_form.title"]()}</h3>
        <p className='text-sm text-muted-foreground/90' id="auth-form-subtitle">{m["auth.email_form.subtitle"]()}</p>
      </div>

      <div className='p-6 pt-0 grid gap-5' role="form" aria-labelledby="auth-form-title" aria-describedby="auth-form-subtitle">
        <div className='grid grid-cols-1'>
          <div className='grid' role="group" aria-label="Social authentication options">
            <Button
              variant="outline"
              size="default"
              type='button'
              onClick={handleEnhancedGitHubLogin}
              onKeyDown={handleKeyDown}
              disabled={isGitHubLoading || isSubmitting || githubState !== 'idle'}
              className={`w-full flex items-center justify-center gap-2.5 font-medium transition-all duration-200 touch-manipulation ${
                clickFeedback ? 'scale-[0.98]' : 'scale-100'
              } ${githubState === 'connecting' ? 'bg-accent/40 border-accent/60' : ''} ${githubState === 'redirecting' ? 'bg-accent/60 border-accent/80' : ''}`}
              aria-describedby="github-login-status"
              aria-label={
                githubState === 'connecting'
                  ? m["auth.email_form.github_connecting"]()
                  : githubState === 'redirecting'
                  ? m["auth.email_form.github_redirecting"]()
                  : `${m["auth.email_form.github_button"]()} - ${m["auth.email_form.subtitle"]()}`
              }
              tabIndex={0}
            >
              {isGitHubLoading || githubState !== 'idle' ? (
                <>
                  <div className='animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent' />
                  <span className='text-sm'>
                    {githubState === 'connecting' && m["auth.email_form.github_connecting"]()}
                    {githubState === 'redirecting' && m["auth.email_form.github_redirecting"]()}
                    {githubState === 'idle' && m["auth.email_form.connecting"]()}
                  </span>
                </>
              ) : (
                <>
                  <svg
                    xmlns='http://www.w3.org/2000/svg'
                    viewBox='0 0 24 24'
                    className='h-4 w-4 fill-current'
                    aria-hidden='true'
                  >
                    <path d='M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z' />
                  </svg>
                  <span className='text-sm font-medium'>{m["auth.email_form.github_button"]()}</span>
                </>
              )}
            </Button>

            {/* Screen reader status updates */}
            <div
              id="github-login-status"
              className="sr-only"
              aria-live="polite"
              aria-atomic="true"
            >
              {githubState === 'connecting' && m["auth.email_form.github_connecting"]()}
              {githubState === 'redirecting' && m["auth.email_form.github_redirecting"]()}
            </div>
          </div>
        </div>

        <div className='relative my-2' aria-hidden="true">
          <div className='absolute inset-0 flex items-center'>
            <span className='w-full border-t border-border/60' />
          </div>
          <div className='relative flex justify-center text-xs uppercase'>
            <span className='px-3 bg-card text-muted-foreground/80 font-medium'>{m["auth.email_form.or_continue"]()}</span>
          </div>
        </div>

        <div className='grid gap-2' role="group" aria-label="Email authentication">
          <label
            className='text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70'
            htmlFor={emailInputId}
          >
            {m["auth.email_form.email_label"]()}
          </label>
          <input
            className='flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors'
            id={emailInputId}
            placeholder={m["auth.email_form.email_placeholder"]()}
            type='email'
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
            }}
            disabled={isSubmitting}
            autoComplete='email'
            aria-required="true"
            aria-invalid={!isEmailValid && email.length > 0}
            aria-describedby={`${emailInputId}-help ${errorMessage ? `${emailInputId}-error` : ''}`}
          />

          {errorMessage && (
            <div className='flex items-start gap-3 mt-3 p-3.5 text-sm text-destructive bg-destructive/8 border border-destructive/15 rounded-md transition-all duration-200' role='alert' aria-live='assertive'>
              <svg
                className='h-4 w-4 shrink-0 mt-0.5'
                fill='currentColor'
                viewBox='0 0 20 20'
                aria-hidden='true'
              >
                <path
                  fillRule='evenodd'
                  d='M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z'
                  clipRule='evenodd'
                />
              </svg>
              <div className='flex-1'>
                <div className='font-medium mb-1'>{m["auth.email_form.authentication_error"]()}</div>
                <div className='text-xs opacity-90'>{errorMessage}</div>
                {errorMessage.includes('GitHub') && (
                  <button
                    type="button"
                    onClick={handleEnhancedGitHubLogin}
                    className='mt-2 text-xs underline hover:no-underline focus:outline-none focus:ring-1 focus:ring-destructive/50 rounded px-1'
                    disabled={isGitHubLoading || githubState !== 'idle'}
                    aria-label={m["auth.email_form.retry_github_auth"]()}
                  >
                    {m["auth.email_form.retry"]()} GitHub Login
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Turnstile CAPTCHA Widget */}
        <div className='space-y-3'>
          <div className='flex flex-col items-center'>
            <TurnstileWidget
              onSuccess={handleTurnstileSuccess}
              onError={handleTurnstileError}
              onExpire={handleTurnstileExpire}
              onLoad={handleTurnstileLoad}
              theme={resolvedTheme === 'light' ? 'light' : 'dark'}
              size='normal'
              disabled={isSubmitting}
              className='w-full'
              aria-label='Complete CAPTCHA verification to continue'
              aria-describedby='captcha-help'
            />

            {/* Error feedback */}
            {turnstileState.error && (
              <div
                className='flex items-center gap-2 mt-3 p-3 text-sm text-destructive bg-destructive/8 border border-destructive/15 rounded-md text-center max-w-[320px]'
                role='alert'
                aria-live='assertive'
              >
                <svg
                  className='h-4 w-4 shrink-0'
                  fill='currentColor'
                  viewBox='0 0 20 20'
                  aria-hidden='true'
                >
                  <path
                    fillRule='evenodd'
                    d='M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z'
                    clipRule='evenodd'
                  />
                </svg>
                <span>{turnstileState.error}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className='flex flex-col items-center p-6 pt-0 space-y-3'>
        <Button
          variant="default"
          size="default"
          type='button'
          onClick={(e) => {
            handleSubmit(e)
          }}
          disabled={!isEmailValid || isSubmitting || !turnstileState.isVerified}
          className='w-full font-medium transition-all duration-200 disabled:opacity-50'
          aria-describedby={submitHelpId}
        >
          {isSubmitting ? (
            <div className='flex items-center gap-2'>
              <svg
                className='h-4 w-4 animate-spin'
                fill='none'
                viewBox='0 0 24 24'
                aria-hidden='true'
              >
                <circle
                  className='opacity-25'
                  cx='12'
                  cy='12'
                  r='10'
                  stroke='currentColor'
                  strokeWidth='4'
                />
                <path
                  className='opacity-75'
                  fill='currentColor'
                  d='m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
                />
              </svg>
              <span>{m["auth.email_form.sending"]()}</span>
            </div>
          ) : (
            m["auth.email_form.send_link"]()
          )}
        </Button>

        {/* Submit button help text */}
        {(!isEmailValid || !turnstileState.isVerified) && !isSubmitting && (
          <div id={submitHelpId} className='text-xs text-muted-foreground text-center'>
            {!isEmailValid && m["auth.email_form.email_required"]()}
            {isEmailValid &&
              !turnstileState.isVerified &&
              m["auth.email_form.captcha_required"]()}
          </div>
        )}
      </div>
    </div>
  )
}
