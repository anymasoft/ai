import { describe, it, expect } from 'vitest'
import {
  validateFileName,
  validateFileMagicNumber,
  detectMimeType,
  validateFile,
  sanitizeFileMetadata,
  ALLOWED_MIME_TYPES,
} from '../file-validation'
import { CDNError, ErrorCodes } from '../error-handler'

describe('File Validation', () => {
  describe('validateFileName', () => {
    it('should accept valid file names', () => {
      const result = validateFileName('image.jpg')
      expect(result.valid).toBe(true)
      expect(result.extension).toBe('jpg')
      expect(result.suggestedMimeType).toBe('image/jpeg')
    })

    it('should reject files without extensions', () => {
      const result = validateFileName('image')
      expect(result.valid).toBe(false)
      expect(result.error).toBe('File must have an extension')
    })

    it('should reject files with path traversal attempts', () => {
      const result = validateFileName('../../../etc/passwd')
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Invalid file name')
    })

    it('should reject files with unsupported extensions', () => {
      const result = validateFileName('document.pdf')
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Unsupported file extension: pdf')
    })

    it('should handle mixed case extensions', () => {
      const result = validateFileName('photo.JPG')
      expect(result.valid).toBe(true)
      expect(result.extension).toBe('jpg')
      expect(result.suggestedMimeType).toBe('image/jpeg')
    })
  })

  describe('validateFileMagicNumber', () => {
    it('should validate PNG magic numbers', async () => {
      const pngBuffer = new Uint8Array([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
        0x00, 0x00, 0x00, 0x00, // Extra bytes
      ]).buffer

      const result = await validateFileMagicNumber(pngBuffer, 'image/png')
      expect(result).toBe(true)
    })

    it('should validate JPEG magic numbers', async () => {
      const jpegBuffer = new Uint8Array([
        0xFF, 0xD8, 0xFF, 0xE0, // JPEG header
        0x00, 0x00, 0x00, 0x00, // Extra bytes
      ]).buffer

      const result = await validateFileMagicNumber(jpegBuffer, 'image/jpeg')
      expect(result).toBe(true)
    })

    it('should reject mismatched magic numbers', async () => {
      const pngBuffer = new Uint8Array([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
      ]).buffer

      const result = await validateFileMagicNumber(pngBuffer, 'image/jpeg')
      expect(result).toBe(false)
    })

    it('should reject unknown MIME types', async () => {
      const buffer = new ArrayBuffer(8)
      const result = await validateFileMagicNumber(buffer, 'application/pdf')
      expect(result).toBe(false)
    })
  })

  describe('detectMimeType', () => {
    it('should detect PNG from buffer', async () => {
      const pngBuffer = new Uint8Array([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
      ]).buffer

      const mimeType = await detectMimeType(pngBuffer)
      expect(mimeType).toBe('image/png')
    })

    it('should detect JPEG from buffer', async () => {
      const jpegBuffer = new Uint8Array([
        0xFF, 0xD8, 0xFF,
      ]).buffer

      const mimeType = await detectMimeType(jpegBuffer)
      expect(mimeType).toBe('image/jpeg')
    })

    it('should return null for unknown formats', async () => {
      const unknownBuffer = new Uint8Array([
        0x00, 0x00, 0x00, 0x00,
      ]).buffer

      const mimeType = await detectMimeType(unknownBuffer)
      expect(mimeType).toBe(null)
    })
  })

  describe('validateFile', () => {
    const createMockFile = (name: string, type: string, size: number): File => {
      return new File([new ArrayBuffer(size)], name, { type })
    }

    const createPNGBuffer = (size: number): ArrayBuffer => {
      const buffer = new Uint8Array(size)
      // PNG magic numbers
      buffer[0] = 0x89
      buffer[1] = 0x50
      buffer[2] = 0x4E
      buffer[3] = 0x47
      buffer[4] = 0x0D
      buffer[5] = 0x0A
      buffer[6] = 0x1A
      buffer[7] = 0x0A
      return buffer.buffer
    }

    it('should validate a valid PNG file', async () => {
      const file = createMockFile('test.png', 'image/png', 1024)
      const buffer = createPNGBuffer(1024)
      
      const result = await validateFile(file, buffer, {
        allowedMimeTypes: ['image/png', 'image/jpeg'],
        maxFileSize: 5 * 1024 * 1024,
      })

      expect(result.valid).toBe(true)
      expect(result.actualMimeType).toBe('image/png')
      expect(result.error).toBeUndefined()
    })

    it('should reject files with invalid names', async () => {
      const file = createMockFile('../test.png', 'image/png', 1024)
      const buffer = createPNGBuffer(1024)
      
      const result = await validateFile(file, buffer, {
        allowedMimeTypes: ['image/png'],
        maxFileSize: 5 * 1024 * 1024,
      })

      expect(result.valid).toBe(false)
      expect(result.error).toBeInstanceOf(CDNError)
      expect(result.error?.code).toBe(ErrorCodes.INVALID_REQUEST)
    })

    it('should reject files with disallowed MIME types', async () => {
      const file = createMockFile('test.svg', 'image/svg+xml', 1024)
      const buffer = new ArrayBuffer(1024)
      
      const result = await validateFile(file, buffer, {
        allowedMimeTypes: ['image/png', 'image/jpeg'],
        maxFileSize: 5 * 1024 * 1024,
      })

      expect(result.valid).toBe(false)
      expect(result.error?.code).toBe(ErrorCodes.INVALID_FILE_TYPE)
    })

    it('should reject files exceeding size limit', async () => {
      const file = createMockFile('test.png', 'image/png', 10 * 1024 * 1024)
      const buffer = createPNGBuffer(10 * 1024 * 1024)
      
      const result = await validateFile(file, buffer, {
        allowedMimeTypes: ['image/png'],
        maxFileSize: 5 * 1024 * 1024,
      })

      expect(result.valid).toBe(false)
      expect(result.error?.code).toBe(ErrorCodes.FILE_TOO_LARGE)
    })

    it('should reject files with mismatched content and declared type', async () => {
      const file = createMockFile('test.jpg', 'image/jpeg', 1024)
      const buffer = createPNGBuffer(1024) // PNG content but declared as JPEG
      
      const result = await validateFile(file, buffer, {
        allowedMimeTypes: ['image/jpeg', 'image/png'],
        maxFileSize: 5 * 1024 * 1024,
      })

      expect(result.valid).toBe(false)
      expect(result.error?.code).toBe(ErrorCodes.INVALID_FILE_TYPE)
      expect(result.error?.message).toContain('does not match declared type')
    })
  })

  describe('sanitizeFileMetadata', () => {
    it('should sanitize file names with special characters', () => {
      const file = new File([], 'test<script>alert(1)</script>.png', {
        type: 'image/png',
        lastModified: 1234567890,
      })

      const result = sanitizeFileMetadata(file)
      expect(result.name).toBe('test_script_alert_1___script_.png')
      expect(result.type).toBe('image/png')
      expect(result.size).toBe(0)
      expect(result.lastModified).toBe(1234567890)
    })

    it('should limit file name length', () => {
      const longName = 'a'.repeat(300) + '.png'
      const file = new File([], longName, { type: 'image/png' })

      const result = sanitizeFileMetadata(file)
      expect(result.name.length).toBeLessThanOrEqual(255)
      expect(result.name.endsWith('.png')).toBe(true)
    })

    it('should replace multiple underscores', () => {
      const file = new File([], 'test___file___name.png', { type: 'image/png' })

      const result = sanitizeFileMetadata(file)
      expect(result.name).toBe('test_file_name.png')
    })
  })
})