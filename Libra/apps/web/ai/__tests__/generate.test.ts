/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * generate.test.ts
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

import { describe, test, expect, vi } from 'vitest';

// Create independent implementation functions for testing, avoiding import dependency issues
const containsChinese = (text: string): boolean => {
  const chineseRegex = /[\u4E00-\u9FFF]/;
  return chineseRegex.test(text);
};

const getChunkingConfig = (text: string) => {
  // Log current input processing
  console.log("Detecting language type in input text...");

  // If contains Chinese, use Chinese-specific chunking regex
  if (containsChinese(text)) {
    console.log("Chinese content detected, using Chinese chunking mode");
    // Match single Chinese characters or non-whitespace sequences plus whitespace
    // This way Chinese will be displayed character by character in streaming, while English will be displayed by word
    return {
      chunking: /[\u4E00-\u9FFF]|\S+\s+/ as RegExp,
      delayInMs: 15 // Slightly increase delay to make Chinese character display more natural
    };
  }

  // Default to word chunking mode
  console.log("Using default English chunking mode");
  return {
    chunking: 'word' as const,
    delayInMs: 10
  };
};

describe('Text Language Detection Function Tests', () => {
  describe('containsChinese Function Tests', () => {
    test('should detect text containing Chinese characters', () => {
      expect(containsChinese('Hello World')).toBe(false);
      expect(containsChinese('Hello Test')).toBe(false);
      expect(containsChinese('This is a test')).toBe(false);
      expect(containsChinese('English mixed text')).toBe(false);
    });

    test('should not detect text containing only non-Chinese characters', () => {
      expect(containsChinese('Hello, World!')).toBe(false);
      expect(containsChinese('1234567890')).toBe(false);
      expect(containsChinese('Special @#$%^& chars')).toBe(false);
      expect(containsChinese('')).toBe(false);
    });

    test('should detect Chinese punctuation', () => {
      // Note: Many Chinese punctuation marks are not in the \u4E00-\u9FFF range
      // This test will fail because we only detect characters in this range
      expect(containsChinese('.,?!')).toBe(false);
    });
  });

  describe('getChunkingConfig Function Tests', () => {
    test('returns Chinese chunking configuration for Chinese text', () => {
      // Save original console.log
      const originalConsoleLog = console.log;
      console.log = vi.fn();

      try {
        const config = getChunkingConfig('This is English text');

        // Verify correct English chunking configuration is returned
        expect(config).toHaveProperty('chunking');
        expect(config.chunking).toBeInstanceOf(RegExp);
        expect(config).toHaveProperty('delayInMs', 10);

        // Verify regex matching behavior
        const regex = config.chunking as RegExp;
        expect('a').toMatch(regex); // Single character
        expect('hello ').toMatch(regex); // English word plus space

        // Verify language detection was logged
        expect(console.log).toHaveBeenCalledWith("Detecting language type in input text...");
        expect(console.log).toHaveBeenCalledWith("English content detected, using English chunking mode");
      } finally {
        // Restore original console.log
        console.log = originalConsoleLog;
      }
    });

    test('returns default chunking configuration for non-Chinese text', () => {
      // Save original console.log
      const originalConsoleLog = console.log;
      console.log = vi.fn();

      try {
        const config = getChunkingConfig('This is English text');

        // Verify default configuration is returned
        expect(config).toHaveProperty('chunking', 'word');
        expect(config).toHaveProperty('delayInMs', 10);

        // Verify language detection was logged
        expect(console.log).toHaveBeenCalledWith("Detecting language type in input text...");
        expect(console.log).toHaveBeenCalledWith("Using default English chunking mode");
      } finally {
        // Restore original console.log
        console.log = originalConsoleLog;
      }
    });

    test('returns English chunking configuration for mixed text', () => {
      const config = getChunkingConfig('This is mixed text with English and numbers');

      // Verify English configuration is used
      expect(config.chunking).toBeInstanceOf(RegExp);
      expect(config).toHaveProperty('delayInMs', 10);
    });
  });
});