# Cloudflare Images Integration Guide

This document introduces how to integrate Cloudflare Images API with libra CDN service to achieve efficient image compression and optimization.

## Overview

Cloudflare Images provides powerful image processing capabilities, including:

- Automatic format conversion (AVIF, WebP, JPEG, PNG)

- Intelligent compression and quality optimization

- Resizing and cropping

- Metadata removal

- Advanced image enhancement

## Configuration Steps

### 1. Update wrangler.jsonc

Add Images binding in `apps/cdn/wrangler.jsonc`:

```jsonc
{
  "images": {
    "binding": "IMAGES"
  }
}
```

### 2. Enable Cloudflare Images

Ensure your Cloudflare account has enabled Images service:

1. Log in to Cloudflare Dashboard

2. Select your domain

3. Navigate to "Images" section

4. Enable Images service

### 3. Deploy Configuration

Use `wrangler deploy` to deploy the updated configuration.

## Usage

### Basic Image Compression

```typescript
import { compressImageWithCloudflareImages } from '../utils/file-management'

// Compress image using Cloudflare Images
const result = await compressImageWithCloudflareImages(
  env.IMAGES,
  file,
  {
    quality: 80,
    format: 'avif',
    enableAdvancedOptimization: true
  }
)
```

### File Replacement and Compression

```typescript
import { handleFileReplacementWithCloudflareImages } from '../utils/file-management'

// Replace file and compress using Cloudflare Images
const result = await handleFileReplacementWithCloudflareImages(
  env.KV,
  env.BUCKET,
  env.IMAGES,
  planId,
  fileKey,
  file,
  {
    enableCompression: true,
    compressionQuality: 80,
    maxWidth: 1920,
    maxHeight: 1080,
    format: 'avif',
    enableAdvancedOptimization: true
  }
)
```

## Compression Options

### Format Selection

- **AVIF**: Best compression ratio, supported by modern browsers

- **WebP**: Good compression ratio, widely supported

- **JPEG**: Traditional format, best compatibility

- **PNG**: Supports transparency, larger file size

### Quality Settings

- `quality: 50-70`: High compression, suitable for thumbnails

- `quality: 80-85`: Balance quality and size, recommended setting

- `quality: 90-100`: High quality, larger file size

### Advanced Optimization Options

```typescript
{
  enableAdvancedOptimization: true, // Enable advanced optimization
  sharpen: 1, // Slight sharpening
  metadata: 'none', // Remove metadata
  anim: true, // Preserve animation
  compression: 'fast' // Fast compression
}
```

## Performance Optimization

### Automatic Format Selection

The system automatically selects the best output format based on input file type and browser support:

```typescript
// Automatically select best format
if (file.type.includes('png') && !options?.enableAdvancedOptimization) {
  outputFormat = 'image/png' // Preserve PNG transparency
} else {
  outputFormat = 'image/avif' // AVIF provides best compression
}
```

### Size Optimization

```typescript
{
  maxWidth: 1920,
  maxHeight: 1080,
  fit: 'scale-down' // Do not enlarge image
}
```

## Error Handling

The system includes complete error handling and fallback mechanisms:

1. **Cloudflare Images unavailable**: Automatically fallback to basic compression

2. **Compression failed**: Use original file

3. **Unsupported format**: Keep original format

## Monitoring and Logging

All operations are logged in detail:

```typescript
log.cdn('info', 'Cloudflare Images compression completed', {
  operation: 'compress_image_cf',
  originalSize,
  compressedSize,
  compressionRatio,
  spaceSaved: originalSize - compressedSize,
  spaceSavedPercent: Math.round((1 - compressionRatio) * 100),
  outputFormat,
  transformOptions
})
```

## Best Practices

1. **Enable AVIF**: Provide best compression for modern browsers

2. **Set reasonable quality**: 80-85 is the best balance between quality and size

3. **Limit size**: Set maximum width and height to avoid large files

4. **Remove metadata**: Reduce file size

5. **Monitor compression ratio**: Ensure compression effect meets expectations

## Cost Consideration

Cloudflare Images charges based on processing count:

- First 100,000 transformations per month are free

- Exceeding transformations are charged at $1/1,000 transformations

Recommend monitoring usage and setting proper cache strategies.

## Troubleshooting

### Common Issues

1. **Images binding not found**: Check wrangler.jsonc configuration

2. **Compression failed**: Check if file format is supported

3. **Poor quality**: Adjust quality parameters and format selection

### Debugging Tips

Enable detailed logging to diagnose issues:

```typescript
log.cdn('debug', 'Image processing details', {
  inputFormat: file.type,
  outputFormat,
  transformOptions,
  compressionResult
})
```