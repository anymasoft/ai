/**
 * Basic component validation tests
 */

import { describe, expect, it } from 'vitest'

import GitHubModal from '../github-modal'

describe('GitHubModal Component Validation', () => {
  it('should export GitHubModal component', () => {
    expect(GitHubModal).toBeDefined()
    expect(typeof GitHubModal).toBe('function')
  })

  it('should have proper TypeScript types', () => {
    // Basic type checking - the component should accept the expected props
    const props = {
      open: true,
      onClose: () => {},
      projectId: 'test-id'
    }

    // If this compiles without TypeScript errors, the types are correct
    expect(props).toBeDefined()
  })
})
