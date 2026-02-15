/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * otp-form.tsx
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

import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from '@libra/ui/components/input-otp'
import { Button } from '@libra/ui/components/button'
import type React from 'react'
import FormDivider from './form-divider'
import * as m from '@/paraglide/messages'

interface OtpFormProps {
  email: string
  otp: string
  setOtp: (otp: string) => void
  isSubmitting: boolean
  errorMessage: string | null
  resetOtpForm: () => void
  verifyOtp: () => Promise<void>
  handleSubmit: (e: React.FormEvent) => Promise<void>
}

export default function OtpForm({
  email,
  otp,
  setOtp,
  isSubmitting,
  errorMessage,
  resetOtpForm,
  verifyOtp,
  handleSubmit,
}: OtpFormProps) {
  return (
    <>
      {/* Email display */}
      <div className='flex items-center justify-between bg-muted/50 rounded-full px-4 py-3 border border-border transition-colors'>
        <div className='flex items-center'>
          <div className='bg-primary/90 rounded-full p-2 mr-3 flex items-center justify-center'>
            <svg
              xmlns='http://www.w3.org/2000/svg'
              width='16'
              height='16'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth='2'
              strokeLinecap='round'
              strokeLinejoin='round'
              className='text-primary-foreground'
              aria-hidden='true'
            >
              <rect width='20' height='16' x='2' y='4' rx='2' />
              <path d='m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7' />
            </svg>
          </div>
          <span className='text-sm text-foreground truncate max-w-[180px] md:max-w-[300px] font-medium'>
            {email}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            resetOtpForm()
          }}
          type='button'
          className='text-muted-foreground hover:text-primary text-xs transition-colors shrink-0'
        >
          {m["auth.otp_form.change_email"]()}
        </Button>
      </div>

      <FormDivider text={m["auth.otp_form.verification_code"]()} />

      <div className='flex flex-col gap-4 mt-2'>
        <div className='text-sm text-muted-foreground text-center'>
          {m["auth.otp_form.enter_code"]()}
        </div>
        <div className='w-full flex justify-center my-2'>
          <InputOTP
            value={otp}
            onChange={setOtp}
            disabled={isSubmitting}
            maxLength={6}
            inputMode='numeric'
            autoComplete='one-time-code'
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
            </InputOTPGroup>
            <InputOTPSeparator />
            <InputOTPGroup>
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
        </div>
      </div>

      {/* Error message display */}
      {errorMessage && (
        <div className='flex items-center gap-2 mt-3 p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg' role='alert'>
          <svg
            xmlns='http://www.w3.org/2000/svg'
            width='16'
            height='16'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
            className='text-destructive shrink-0'
            aria-hidden='true'
          >
            <circle cx='12' cy='12' r='10' />
            <line x1='12' x2='12' y1='8' y2='12' />
            <line x1='12' x2='12.01' y1='16' y2='16' />
          </svg>
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Verify button */}
      <Button
        variant="default"
        size="default"
        onClick={() => {
          verifyOtp()
        }}
        disabled={isSubmitting || otp.length < 6}
        className='mt-4 h-12 w-full font-medium transition-all duration-200 disabled:opacity-50'
      >
        <div className='flex items-center justify-center gap-2'>
          {isSubmitting ? (
            <>
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
              <span>{m["auth.otp_form.verifying"]()}</span>
            </>
          ) : (
            <>
              <svg
                xmlns='http://www.w3.org/2000/svg'
                width='18'
                height='18'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
                aria-hidden='true'
              >
                <path d='M22 11.08V12a10 10 0 1 1-5.93-9.14' />
                <polyline points='22 4 12 14.01 9 11.01' />
              </svg>
              <span>{m["auth.otp_form.verify_button"]()}</span>
            </>
          )}
        </div>
      </Button>
    </>
  )
}
