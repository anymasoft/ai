/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * LoginForm.tsx
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

import ParticlesBackground from './ParticlesBackground'
import EmailForm from './components/email-form'
import OtpForm from './components/otp-form'
import { useAuthForm } from './hooks/useAuthForm'

/**
 * Login form component with particle background
 */
export default function LoginForm() {
  const {
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
  } = useAuthForm()

  return (
    <div className='flex justify-center items-center min-h-screen relative overflow-hidden bg-background-landing p-4 sm:p-6 lg:p-8'>
      <ParticlesBackground />

      <div className='w-full absolute inset-0 h-full z-[1]'>
        <div
          className='w-full h-full'
          style={{
            background: 'radial-gradient(circle at center, transparent 10%, hsl(var(--background-landing) / 0.8) 70%)',
          }}
        />
      </div>

      <div className='w-full max-w-sm sm:max-w-md lg:max-w-lg z-10 relative'>
        <div className='relative rounded-lg border border-border bg-card text-card-foreground shadow-xl'>
          <div className='px-4 sm:px-6 lg:px-7 pt-2 pb-6 sm:pb-7 flex flex-col gap-4 sm:gap-5'>
            {!showOtpInput ? (
              <EmailForm
                email={email}
                setEmail={setEmail}
                isSubmitting={isSubmitting}
                isGitHubLoading={isGitHubLoading}
                isEmailValid={isEmailValid}
                errorMessage={errorMessage}
                handleSubmit={handleSubmit}
                handleGitHubLogin={handleGitHubLogin}
                turnstileState={turnstileState}
                handleTurnstileSuccess={handleTurnstileSuccess}
                handleTurnstileError={handleTurnstileError}
                handleTurnstileExpire={handleTurnstileExpire}
                handleTurnstileLoad={handleTurnstileLoad}
              />
            ) : (
              <OtpForm
                email={email}
                otp={otp}
                setOtp={setOtp}
                isSubmitting={isSubmitting}
                errorMessage={errorMessage}
                resetOtpForm={resetOtpForm}
                verifyOtp={verifyOtp}
                handleSubmit={handleSubmit}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
