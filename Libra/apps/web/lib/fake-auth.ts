/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * fake-auth.ts
 * Fake authentication for local development
 */

export const FAKE_USER = {
  id: 'test-user-001',
  email: 'test@libra.dev',
  name: 'Test User',
  image: null,
  emailVerified: true,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date(),
  activeOrganizationId: 'test-org-001',
}

export const FAKE_SESSION = {
  user: FAKE_USER,
  session: {
    id: 'test-session-001',
    userId: FAKE_USER.id,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    token: 'test-token-001',
    ipAddress: '127.0.0.1',
    userAgent: 'Fake Auth',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
}

// Flag to enable fake auth mode
export const ENABLE_FAKE_AUTH = true
