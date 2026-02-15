/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * auth-server-mock.ts
 * Mock authentication for local development
 */

export const initAuth = async () => ({
  api: {
    getSession: async () => ({
      user: {
        id: 'test-user-001',
        email: 'test@libra.dev',
        name: 'Test User',
        image: null,
        emailVerified: true,
      },
      session: {
        id: 'test-session-001',
        userId: 'test-user-001',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    }),
  },
})

export const auth = {
  api: {
    getSession: async () => ({
      user: {
        id: 'test-user-001',
        email: 'test@libra.dev',
        name: 'Test User',
        image: null,
      },
    }),
  },
}
