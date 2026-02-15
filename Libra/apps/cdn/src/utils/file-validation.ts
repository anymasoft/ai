import { CDNError, ErrorCodes } from './error-handler'

/**
 * MIME type validation with magic number checking
 */
const MAGIC_NUMBERS = {
  // JPEG
  'image/jpeg': [
    { bytes: [0xFF, 0xD8, 0xFF], offset: 0 }
  ],
  // PNG
  'image/png': [
    { bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], offset: 0 }
  ],
  // GIF
  'image/gif': [
    { bytes: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], offset: 0 }, // GIF87a
    { bytes: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], offset: 0 }  // GIF89a
  ],
  // WebP
  'image/webp': [
    { bytes: [0x52, 0x49, 0x46, 0x46], offset: 0, additionalCheck: (buffer: ArrayBuffer) => {
      const view = new DataView(buffer)
      return view.byteLength > 12 && 
             view.getUint8(8) === 0x57 && 
             view.getUint8(9) === 0x45 && 
             view.getUint8(10) === 0x42 && 
             view.getUint8(11) === 0x50
    }}
  ],
  // AVIF
  'image/avif': [
    { bytes: [0x00, 0x00, 0x00], offset: 0, additionalCheck: (buffer: ArrayBuffer) => {
      const view = new DataView(buffer)
      if (view.byteLength < 12) return false
      
      // Check for ftyp box
      const ftyp = String.fromCharCode(
        view.getUint8(4),
        view.getUint8(5),
        view.getUint8(6),
        view.getUint8(7)
      )
      
      // Check for avif brand
      const brand = String.fromCharCode(
        view.getUint8(8),
        view.getUint8(9),
        view.getUint8(10),
        view.getUint8(11)
      )
      
      return ftyp === 'ftyp' && (brand === 'avif' || brand === 'avis')
    }}
  ]
}

/**
 * File extension to MIME type mapping
 */
const EXTENSION_MIME_MAP: Record<string, string> = {
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'png': 'image/png',
  'gif': 'image/gif',
  'webp': 'image/webp',
  'avif': 'image/avif',
}

/**
 * Allowed MIME types and their properties
 */
export const ALLOWED_MIME_TYPES = {
  'image/jpeg': {
    extensions: ['jpg', 'jpeg'],
    maxSize: 10 * 1024 * 1024, // 10MB
    compressible: true,
  },
  'image/png': {
    extensions: ['png'],
    maxSize: 10 * 1024 * 1024, // 10MB
    compressible: true,
  },
  'image/gif': {
    extensions: ['gif'],
    maxSize: 5 * 1024 * 1024, // 5MB
    compressible: false, // GIFs lose animation when compressed
  },
  'image/webp': {
    extensions: ['webp'],
    maxSize: 10 * 1024 * 1024, // 10MB
    compressible: true,
  },
  'image/avif': {
    extensions: ['avif'],
    maxSize: 10 * 1024 * 1024, // 10MB
    compressible: true,
  },
}

/**
 * Validate file using magic numbers
 * @description Validates that file content matches the declared MIME type by checking magic numbers
 * @param buffer - File content as ArrayBuffer
 * @param declaredMimeType - The MIME type declared for the file
 * @returns True if file content matches declared type
 */
export async function validateFileMagicNumber(
  buffer: ArrayBuffer, 
  declaredMimeType: string
): Promise<boolean> {
  const magicChecks = MAGIC_NUMBERS[declaredMimeType as keyof typeof MAGIC_NUMBERS]
  if (!magicChecks) {
    return false
  }

  const view = new Uint8Array(buffer)
  
  for (const check of magicChecks) {
    if (view.length < check.offset + check.bytes.length) {
      continue
    }
    
    let match = true
    for (let i = 0; i < check.bytes.length; i++) {
      if (view[check.offset + i] !== check.bytes[i]) {
        match = false
        break
      }
    }
    
    if (match) {
      // Run additional check if provided
      if ('additionalCheck' in check && check.additionalCheck) {
        return check.additionalCheck(buffer)
      }
      return true
    }
  }
  
  return false
}

/**
 * Detect actual MIME type from buffer
 */
export async function detectMimeType(buffer: ArrayBuffer): Promise<string | null> {
  for (const [mimeType] of Object.entries(MAGIC_NUMBERS)) {
    if (await validateFileMagicNumber(buffer, mimeType)) {
      return mimeType
    }
  }
  return null
}

/**
 * Validate file name and extension
 */
export function validateFileName(fileName: string): {
  valid: boolean
  extension?: string
  suggestedMimeType?: string
  error?: string
} {
  // Check for path traversal attempts
  if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
    return { valid: false, error: 'Invalid file name' }
  }
  
  // Extract extension
  const lastDot = fileName.lastIndexOf('.')
  if (lastDot === -1 || lastDot === fileName.length - 1) {
    return { valid: false, error: 'File must have an extension' }
  }
  
  const extension = fileName.substring(lastDot + 1).toLowerCase()
  const suggestedMimeType = EXTENSION_MIME_MAP[extension]
  
  if (!suggestedMimeType) {
    return { 
      valid: false, 
      error: `Unsupported file extension: ${extension}` 
    }
  }
  
  return { valid: true, extension, suggestedMimeType }
}

/**
 * Comprehensive file validation
 * @description Performs complete validation including name, type, content, and size
 * @param file - File object to validate
 * @param buffer - File content as ArrayBuffer
 * @param config - Validation configuration
 * @param config.allowedMimeTypes - List of allowed MIME types
 * @param config.maxFileSize - Maximum allowed file size in bytes
 * @returns Validation result with actual MIME type or error
 */
export async function validateFile(
  file: File,
  buffer: ArrayBuffer,
  config: {
    allowedMimeTypes: string[]
    maxFileSize: number
  }
): Promise<{
  valid: boolean
  actualMimeType?: string
  error?: CDNError
}> {
  // Validate file name
  const nameValidation = validateFileName(file.name)
  if (!nameValidation.valid) {
    return {
      valid: false,
      error: new CDNError(
        400,
        ErrorCodes.INVALID_REQUEST,
        nameValidation.error || 'Invalid file name'
      )
    }
  }
  
  // Check declared MIME type
  if (!config.allowedMimeTypes.includes(file.type)) {
    return {
      valid: false,
      error: new CDNError(
        400,
        ErrorCodes.INVALID_FILE_TYPE,
        `File type not allowed: ${file.type}`
      )
    }
  }
  
  // Detect actual MIME type from content
  const actualMimeType = await detectMimeType(buffer)
  if (!actualMimeType) {
    return {
      valid: false,
      error: new CDNError(
        400,
        ErrorCodes.INVALID_FILE_TYPE,
        'Could not determine file type from content'
      )
    }
  }
  
  // Verify declared type matches actual type
  if (actualMimeType !== file.type) {
    return {
      valid: false,
      error: new CDNError(
        400,
        ErrorCodes.INVALID_FILE_TYPE,
        `File content does not match declared type. Expected: ${file.type}, Actual: ${actualMimeType}`
      )
    }
  }
  
  // Check file size
  const typeConfig = ALLOWED_MIME_TYPES[actualMimeType as keyof typeof ALLOWED_MIME_TYPES]
  const maxSize = Math.min(
    config.maxFileSize,
    typeConfig?.maxSize || config.maxFileSize
  )
  
  if (file.size > maxSize) {
    return {
      valid: false,
      error: new CDNError(
        400,
        ErrorCodes.FILE_TOO_LARGE,
        `File size exceeds limit of ${maxSize / 1024 / 1024}MB for ${actualMimeType}`
      )
    }
  }
  
  return { valid: true, actualMimeType }
}

/**
 * Get image dimensions from buffer
 */
export function getImageDimensions(buffer: ArrayBuffer, mimeType: string): {
  width?: number
  height?: number
} | null {
  const view = new DataView(buffer)
  
  switch (mimeType) {
    case 'image/png': {
      if (view.byteLength < 24) return null
      const width = view.getUint32(16, false)
      const height = view.getUint32(20, false)
      return { width, height }
    }
    
    case 'image/jpeg': {
      // JPEG dimension detection is more complex
      // For now, return null and let image processing handle it
      return null
    }
    
    case 'image/gif': {
      if (view.byteLength < 10) return null
      const width = view.getUint16(6, true)
      const height = view.getUint16(8, true)
      return { width, height }
    }
    
    default:
      return null
  }
}

/**
 * Sanitize file metadata
 */
export function sanitizeFileMetadata(file: File): {
  name: string
  type: string
  size: number
  lastModified: number
} {
  // Remove any potentially harmful characters from filename
  const safeName = file.name
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .substring(0, 255) // Limit filename length
  
  return {
    name: safeName,
    type: file.type,
    size: file.size,
    lastModified: file.lastModified
  }
}