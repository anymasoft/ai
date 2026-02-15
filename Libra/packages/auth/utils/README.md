# OAuth Nonce Validation for Replay Attack Protection

This module implements cryptographically secure nonce generation and validation for OAuth flows to prevent replay attacks.

## Overview

The nonce system provides protection against replay attacks by ensuring that each OAuth authorization request can only be used once and within a limited time window.

## Features

- **Cryptographically Secure**: Uses `crypto.randomBytes()` for nonce generation
- **Time-based Expiration**: Nonces expire after 15 minutes
- **Single-use Validation**: Each nonce can only be validated once
- **KV Storage Integration**: Uses Cloudflare KV for distributed storage
- **Automatic Cleanup**: Expired nonces are automatically cleaned up by KV TTL

## Security Properties

1. **Replay Protection**: Each nonce can only be used once
2. **Time Bounds**: Nonces expire after 15 minutes to limit attack window
3. **Cryptographic Strength**: 32-byte random nonces provide 256 bits of entropy
4. **State Binding**: Nonces are bound to specific organization and user IDs

## Usage

### Generating a Nonce

```typescript
import { generateSecureNonce } from '@libra/auth/utils/nonce'

const nonceData = await generateSecureNonce(orgId, userId)
// Use nonceData.nonce in your OAuth state parameter
```

### Validating a Nonce

```typescript
import { validateAndConsumeNonce } from '@libra/auth/utils/nonce'

const isValid = await validateAndConsumeNonce(nonce, expectedOrgId, expectedUserId)
if (!isValid) {
  // Handle invalid nonce - possible replay attack
  throw new Error('Invalid or expired nonce')
}
```

## Implementation Details

### Nonce Format

- **Length**: 64 hexadecimal characters (32 bytes)
- **Encoding**: Hexadecimal string
- **Entropy**: 256 bits of cryptographic randomness

### Storage

- **Backend**: Cloudflare KV
- **Key Format**: `oauth_nonce:{nonce}`
- **TTL**: 15 minutes (900 seconds)
- **Data**: JSON-encoded NonceData object

### NonceData Structure

```typescript
interface NonceData {
  nonce: string      // The nonce value
  orgId: string      // Organization ID
  userId: string     // User ID
  timestamp: number  // Creation timestamp
  expiresAt: number  // Expiration timestamp
}
```

## Integration Points

### OAuth Initiation

The nonce is generated during OAuth URL creation:

1. `packages/api/src/router/github.ts` - `getOAuthUrl` method
2. `packages/api/src/router/github.ts` - `getInstallationUrl` method

### OAuth Callback

The nonce is validated during OAuth callback processing:

1. `apps/web/app/api/github/callback/route.ts`
2. `apps/web/app/api/github/setup/route.ts`

## Error Handling

The system handles various error conditions:

- **Missing Nonce**: Returns false for validation
- **Expired Nonce**: Returns false and cleans up the nonce
- **Wrong Organization/User**: Returns false without cleanup
- **KV Errors**: Returns false and logs errors
- **Malformed Data**: Returns false and logs errors

## Testing

Run the test suite:

```bash
bun test packages/auth/utils/__tests__/nonce.test.ts
```

The tests cover:
- Secure nonce generation
- Valid nonce validation
- Expired nonce rejection
- Organization/user ID validation
- Error handling scenarios

## Security Considerations

1. **Nonce Uniqueness**: Each nonce is cryptographically random
2. **Time Window**: 15-minute expiration limits replay attack window
3. **Single Use**: Nonces are deleted after successful validation
4. **State Binding**: Nonces are tied to specific org/user combinations
5. **Storage Security**: KV storage provides distributed, secure storage

## Configuration

Environment variables:
- No additional configuration required
- Uses existing Cloudflare KV binding from auth system

## Monitoring

The system provides comprehensive logging:
- Nonce generation events
- Validation attempts (success/failure)
- Error conditions
- Cleanup operations

All logs include truncated nonce values for debugging without exposing full nonces.

## Future Enhancements

Potential improvements:
1. Configurable expiration times
2. Rate limiting per organization
3. Metrics collection
4. Database fallback for non-Cloudflare environments
