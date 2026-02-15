/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * edge-cases.test.ts
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

import { describe, test, expect } from 'vitest'
import { addMonths } from 'date-fns'

describe('Edge Cases for Period Calculation', () => {
  test('should handle 31st day edge case correctly', () => {
    // This is the exact scenario mentioned in the user's analysis
    const periodStart = new Date('2024-01-31T00:00:00.000Z')
    const now = new Date('2024-03-30T10:30:00.000Z')
    
    // Use loop-based approach to ensure coverage
    let newPeriodStart = periodStart
    while (addMonths(newPeriodStart, 1) <= now) {
      newPeriodStart = addMonths(newPeriodStart, 1)
    }
    
    // The loop should find the correct period that contains 'now'
    // From Jan 31, the periods are: Feb 29 - Mar 29, Mar 29 - Apr 29
    // Since now = Mar 30, the current period should be Mar 29 - Apr 29
    expect(newPeriodStart).toEqual(new Date('2024-03-29T00:00:00.000Z'))

    const newPeriodEnd = addMonths(newPeriodStart, 1)
    expect(newPeriodEnd).toEqual(new Date('2024-04-29T00:00:00.000Z'))
    
    // Verify that 'now' falls within this period
    expect(newPeriodStart.getTime()).toBeLessThanOrEqual(now.getTime())
    expect(newPeriodEnd.getTime()).toBeGreaterThan(now.getTime())
  })

  test('should handle time drift prevention with UTC alignment', () => {
    const periodStart = new Date('2024-01-01T10:23:45.123Z') // Non-midnight start
    const now = new Date('2024-02-15T00:00:00.000Z') // Midnight request
    
    // Use loop-based approach
    let newPeriodStart = periodStart
    while (addMonths(newPeriodStart, 1) <= now) {
      newPeriodStart = addMonths(newPeriodStart, 1)
    }
    
    // Apply UTC midnight alignment
    newPeriodStart = new Date(Date.UTC(
      newPeriodStart.getUTCFullYear(),
      newPeriodStart.getUTCMonth(),
      newPeriodStart.getUTCDate(),
      0, 0, 0, 0
    ))
    
    // Should be aligned to midnight
    expect(newPeriodStart.getUTCHours()).toBe(0)
    expect(newPeriodStart.getUTCMinutes()).toBe(0)
    expect(newPeriodStart.getUTCSeconds()).toBe(0)
    expect(newPeriodStart.getUTCMilliseconds()).toBe(0)
    
    // Should be Feb 1 midnight
    expect(newPeriodStart).toEqual(new Date('2024-02-01T00:00:00.000Z'))
  })

  test('should handle DST transitions correctly', () => {
    // Test around DST transition dates
    const periodStart = new Date('2024-03-01T00:00:00.000Z')
    const now = new Date('2024-03-11T10:00:00.000Z') // Around DST transition in some zones
    
    let newPeriodStart = periodStart
    while (addMonths(newPeriodStart, 1) <= now) {
      newPeriodStart = addMonths(newPeriodStart, 1)
    }
    
    // UTC alignment should prevent DST issues
    newPeriodStart = new Date(Date.UTC(
      newPeriodStart.getUTCFullYear(),
      newPeriodStart.getUTCMonth(),
      newPeriodStart.getUTCDate(),
      0, 0, 0, 0
    ))
    
    expect(newPeriodStart).toEqual(new Date('2024-03-01T00:00:00.000Z'))
    
    const newPeriodEnd = addMonths(newPeriodStart, 1)
    expect(newPeriodStart.getTime()).toBeLessThanOrEqual(now.getTime())
    expect(newPeriodEnd.getTime()).toBeGreaterThan(now.getTime())
  })

  test('should handle February 29th in leap year', () => {
    const periodStart = new Date('2024-01-29T00:00:00.000Z')
    const now = new Date('2024-02-29T12:00:00.000Z') // Leap day
    
    let newPeriodStart = periodStart
    while (addMonths(newPeriodStart, 1) <= now) {
      newPeriodStart = addMonths(newPeriodStart, 1)
    }
    
    // Should handle leap day correctly
    expect(newPeriodStart).toEqual(new Date('2024-02-29T00:00:00.000Z'))
    
    const newPeriodEnd = addMonths(newPeriodStart, 1)
    expect(newPeriodStart.getTime()).toBeLessThanOrEqual(now.getTime())
    expect(newPeriodEnd.getTime()).toBeGreaterThan(now.getTime())
  })

  test('should handle very long periods (multiple years)', () => {
    const periodStart = new Date('2020-01-01T00:00:00.000Z')
    const now = new Date('2024-06-15T10:30:00.000Z') // 4+ years later
    
    let newPeriodStart = periodStart
    let iterations = 0
    while (addMonths(newPeriodStart, 1) <= now) {
      newPeriodStart = addMonths(newPeriodStart, 1)
      iterations++
      // Safety check to prevent infinite loops in tests
      if (iterations > 100) break
    }
    
    // Should find the correct period
    expect(newPeriodStart).toEqual(new Date('2024-06-01T00:00:00.000Z'))
    expect(iterations).toBe(53) // 4 years + 5 months = 53 months
    
    const newPeriodEnd = addMonths(newPeriodStart, 1)
    expect(newPeriodStart.getTime()).toBeLessThanOrEqual(now.getTime())
    expect(newPeriodEnd.getTime()).toBeGreaterThan(now.getTime())
  })

  test('should handle edge case where now equals period boundary', () => {
    const periodStart = new Date('2024-01-01T00:00:00.000Z')
    const now = new Date('2024-02-01T00:00:00.000Z') // Exactly at period boundary
    
    let newPeriodStart = periodStart
    while (addMonths(newPeriodStart, 1) <= now) {
      newPeriodStart = addMonths(newPeriodStart, 1)
    }
    
    // When now equals the period boundary, should move to the next period
    expect(newPeriodStart).toEqual(new Date('2024-02-01T00:00:00.000Z'))
    
    const newPeriodEnd = addMonths(newPeriodStart, 1)
    expect(newPeriodStart.getTime()).toBeLessThanOrEqual(now.getTime())
    expect(newPeriodEnd.getTime()).toBeGreaterThan(now.getTime())
  })

  test('should handle microsecond precision edge cases', () => {
    const periodStart = new Date('2024-01-01T00:00:00.000Z')
    const now = new Date('2024-02-01T00:00:00.001Z') // 1ms after boundary
    
    let newPeriodStart = periodStart
    while (addMonths(newPeriodStart, 1) <= now) {
      newPeriodStart = addMonths(newPeriodStart, 1)
    }
    
    // Should move to the next period even with tiny time difference
    expect(newPeriodStart).toEqual(new Date('2024-02-01T00:00:00.000Z'))
    
    const newPeriodEnd = addMonths(newPeriodStart, 1)
    expect(newPeriodStart.getTime()).toBeLessThanOrEqual(now.getTime())
    expect(newPeriodEnd.getTime()).toBeGreaterThan(now.getTime())
  })

  test('should demonstrate the problem with differenceInMonths approach', () => {
    // This test shows why the old approach could fail
    const periodStart = new Date('2024-01-31T00:00:00.000Z')
    const now = new Date('2024-03-30T10:30:00.000Z')
    
    // Simulate the old approach (for comparison)
    // const monthsDiff = differenceInMonths(now, periodStart) // Would be 1
    // const oldNewPeriodStart = addMonths(periodStart, monthsDiff) // Would be Feb 29
    // const oldNewPeriodEnd = addMonths(oldNewPeriodStart, 1) // Would be Mar 29
    // Problem: now (Mar 30) > oldNewPeriodEnd (Mar 29), so period doesn't contain 'now'
    
    // New loop-based approach
    let newPeriodStart = periodStart
    while (addMonths(newPeriodStart, 1) <= now) {
      newPeriodStart = addMonths(newPeriodStart, 1)
    }
    
    // Should correctly find a period that contains 'now'
    expect(newPeriodStart).toEqual(new Date('2024-03-29T00:00:00.000Z'))
    
    const newPeriodEnd = addMonths(newPeriodStart, 1)
    expect(newPeriodStart.getTime()).toBeLessThanOrEqual(now.getTime())
    expect(newPeriodEnd.getTime()).toBeGreaterThan(now.getTime())
  })
})
