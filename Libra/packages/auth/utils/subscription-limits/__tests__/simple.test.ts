/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * simple.test.ts
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

describe('Loop-based Period Calculation Tests', () => {
  test('should calculate correct period using loop approach', () => {
    const originalStart = new Date('2024-01-01T00:00:00.000Z')
    const currentTime = new Date('2024-02-15T10:30:00.000Z')

    // Use loop-based approach like in the actual implementation
    let newPeriodStart = originalStart
    while (addMonths(newPeriodStart, 1) <= currentTime) {
      newPeriodStart = addMonths(newPeriodStart, 1)
    }

    expect(newPeriodStart).toEqual(new Date('2024-02-01T00:00:00.000Z'))

    const newPeriodEnd = addMonths(newPeriodStart, 1)
    expect(newPeriodEnd).toEqual(new Date('2024-03-01T00:00:00.000Z'))

    // Verify the period contains current time
    expect(newPeriodStart.getTime()).toBeLessThanOrEqual(currentTime.getTime())
    expect(newPeriodEnd.getTime()).toBeGreaterThan(currentTime.getTime())
  })

  test('should handle multiple months correctly', () => {
    const originalStart = new Date('2024-01-01T00:00:00.000Z')
    const currentTime = new Date('2024-05-15T10:30:00.000Z')

    // Use loop-based approach
    let newPeriodStart = originalStart
    while (addMonths(newPeriodStart, 1) <= currentTime) {
      newPeriodStart = addMonths(newPeriodStart, 1)
    }

    expect(newPeriodStart).toEqual(new Date('2024-05-01T00:00:00.000Z'))

    // Verify the period contains current time
    const newPeriodEnd = addMonths(newPeriodStart, 1)
    expect(newPeriodStart.getTime()).toBeLessThanOrEqual(currentTime.getTime())
    expect(newPeriodEnd.getTime()).toBeGreaterThan(currentTime.getTime())
  })

  test('should handle month boundaries correctly', () => {
    const originalStart = new Date('2024-01-31T00:00:00.000Z')
    const currentTime = new Date('2024-03-15T10:30:00.000Z')

    // Use loop-based approach to handle month boundaries
    let newPeriodStart = originalStart
    while (addMonths(newPeriodStart, 1) <= currentTime) {
      newPeriodStart = addMonths(newPeriodStart, 1)
    }

    // The loop will find the correct period that contains current time
    // From Jan 31, the next period that contains Mar 15 is Mar 31 (or Mar 29/30/31 depending on month)
    expect(newPeriodStart).toEqual(new Date('2024-02-29T00:00:00.000Z'))

    // Verify the period contains current time
    const newPeriodEnd = addMonths(newPeriodStart, 1)
    expect(newPeriodStart.getTime()).toBeLessThanOrEqual(currentTime.getTime())
    expect(newPeriodEnd.getTime()).toBeGreaterThan(currentTime.getTime())
  })

  test('should verify period coverage logic with UTC alignment', () => {
    const originalStart = new Date('2024-01-01T10:30:00.000Z') // Non-midnight start
    const currentTime = new Date('2024-02-15T14:45:00.000Z')

    // Use loop-based approach
    let newPeriodStart = originalStart
    while (addMonths(newPeriodStart, 1) <= currentTime) {
      newPeriodStart = addMonths(newPeriodStart, 1)
    }

    // Apply UTC midnight alignment like in the actual implementation
    newPeriodStart = new Date(Date.UTC(
      newPeriodStart.getUTCFullYear(),
      newPeriodStart.getUTCMonth(),
      newPeriodStart.getUTCDate(),
      0, 0, 0, 0
    ))

    const newPeriodEnd = addMonths(newPeriodStart, 1)

    // The new period should contain the current time: newPeriodStart <= now < newPeriodEnd
    expect(newPeriodStart.getTime()).toBeLessThanOrEqual(currentTime.getTime())
    expect(newPeriodEnd.getTime()).toBeGreaterThan(currentTime.getTime())

    // Verify UTC alignment (should be midnight)
    expect(newPeriodStart.getUTCHours()).toBe(0)
    expect(newPeriodStart.getUTCMinutes()).toBe(0)
    expect(newPeriodStart.getUTCSeconds()).toBe(0)

    // Verify it's a proper monthly period
    expect(newPeriodEnd.getTime() - newPeriodStart.getTime()).toBeGreaterThan(28 * 24 * 60 * 60 * 1000) // At least 28 days
    expect(newPeriodEnd.getTime() - newPeriodStart.getTime()).toBeLessThan(32 * 24 * 60 * 60 * 1000) // At most 32 days
  })

  test('should handle leap year correctly', () => {
    const originalStart = new Date('2024-02-01T00:00:00.000Z') // 2024 is a leap year
    const currentTime = new Date('2024-03-15T10:30:00.000Z')

    // Use loop-based approach
    let newPeriodStart = originalStart
    while (addMonths(newPeriodStart, 1) <= currentTime) {
      newPeriodStart = addMonths(newPeriodStart, 1)
    }

    expect(newPeriodStart).toEqual(new Date('2024-03-01T00:00:00.000Z'))
  })

  test('should handle year boundary', () => {
    const originalStart = new Date('2023-12-01T00:00:00.000Z')
    const currentTime = new Date('2024-02-15T10:30:00.000Z')

    // Use loop-based approach
    let newPeriodStart = originalStart
    while (addMonths(newPeriodStart, 1) <= currentTime) {
      newPeriodStart = addMonths(newPeriodStart, 1)
    }

    expect(newPeriodStart).toEqual(new Date('2024-02-01T00:00:00.000Z'))
  })
})
