/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * email-otp-plugin.ts
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

import { resend } from '@libra/email'
import { env as emailEnv } from '@libra/email/env.mjs'
import { EmailVerificationTemplate, SignInTemplate } from '@libra/email/templates'
import { emailSubjects } from '@libra/email/templates'
import { emailOTP } from 'better-auth/plugins'
import React from 'react'

export const emailOTPPlugin = emailOTP({
  otpLength: 6,
  expiresIn: 600,
  async sendVerificationOTP(
    {
      email,
      otp,
      type,
    }: {
      email: string
      otp: string
      type: string
    },
    _req
  ) {
    let template: React.ReactElement
    let subject: string
    if (type === 'sign-in') {
      template = React.createElement(SignInTemplate, { otp })
      subject = emailSubjects['sign-in']
    } else {
      template = React.createElement(EmailVerificationTemplate, { otp })
      subject = emailSubjects['email-verification']
    }
    await resend.emails.send({
      from: emailEnv.RESEND_FROM,
      to: [email],
      subject,
      react: template as any,
    })
  },
})
