# No-Sandbox Mode Documentation

## Overview

Open Lovable supports a **no-sandbox mode** that allows you to use the AI code generation features without requiring a sandbox provider (Vercel or E2B). This is useful for:

- **Development** - Testing without Vercel credentials
- **Local development** - When sandbox infrastructure isn't available
- **Reduced dependencies** - Minimal setup without cloud integrations
- **Learning** - Understanding code generation without deployment complexity

## Activation

To enable no-sandbox mode, set the `DISABLE_SANDBOX` environment variable to `"true"`:

### Via .env.local

```bash
# .env.local
DISABLE_SANDBOX=true

# You still need a valid AI provider
OPENAI_API_KEY=sk-...

# Firecrawl is optional (for web scraping)
FIRECRAWL_API_KEY=...
```

### Via CLI

```bash
export DISABLE_SANDBOX=true
pnpm dev
```

### Via Docker

```dockerfile
ENV DISABLE_SANDBOX=true
```

## How It Works

When `DISABLE_SANDBOX=true`:

1. **API Endpoint** (`/api/create-ai-sandbox-v2`)
   - Returns success response with `mode: "no-sandbox"`
   - No sandbox infrastructure is created
   - No Vercel/E2B tokens are required

2. **UI Behavior**
   - Sets `sandboxDisabled` state to `true`
   - Disables preview iframe
   - Disables sandbox-related operations (run, install, etc.)
   - Shows notification: "Running in no-sandbox mode"

3. **Code Generation**
   - AI can still generate code
   - Users can view generated code in chat/editor
   - Files cannot be applied to a live sandbox

## Limitations

### Not Available in No-Sandbox Mode

- ❌ Live preview of generated apps
- ❌ Real-time code execution
- ❌ Package installation (npm/yarn)
- ❌ File structure inspection from running environment
- ❌ Sandbox terminal/command execution

### Available in No-Sandbox Mode

- ✅ AI code generation
- ✅ Code display in chat interface
- ✅ Multiple AI models (OpenAI, Claude, Gemini, etc.)
- ✅ Web scraping (if Firecrawl configured)
- ✅ Code conversation and refinement

## Configuration

### Minimal Setup (No-Sandbox)

```bash
# Only need AI provider and Firecrawl (optional)
DISABLE_SANDBOX=true
OPENAI_API_KEY=sk-...
```

### Full Setup (With Sandbox)

```bash
# Need all sandbox credentials
DISABLE_SANDBOX=false  # or omit (default)
OPENAI_API_KEY=sk-...
SANDBOX_PROVIDER=vercel
VERCEL_OIDC_TOKEN=...  # or VERCEL_TOKEN with team/project IDs
```

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DISABLE_SANDBOX` | No | `false` | Set to `"true"` to disable sandbox |
| `OPENAI_API_KEY` | Yes* | - | OpenAI API key for code generation |
| `FIRECRAWL_API_KEY` | No | - | Firecrawl API key for web scraping |
| `SANDBOX_PROVIDER` | No** | `vercel` | Sandbox provider (ignored if DISABLE_SANDBOX=true) |
| `VERCEL_OIDC_TOKEN` | No** | - | Vercel authentication (ignored if DISABLE_SANDBOX=true) |

*At least one AI provider is required (OpenAI, Claude, Gemini, Groq)
**Required only if DISABLE_SANDBOX=false

## Code Changes

### Files Modified

1. **`app/api/create-ai-sandbox-v2/route.ts`**
   - Checks `DISABLE_SANDBOX` environment variable
   - Returns `mode: "no-sandbox"` response when disabled
   - Cleans up any existing sandbox state gracefully

2. **`lib/sandbox/providers/vercel-provider.ts`**
   - Guard check to prevent accidental sandbox creation
   - Throws descriptive error if somehow reached in no-sandbox mode

3. **`app/generation/page.tsx`**
   - Added `sandboxDisabled` state
   - Detects `mode === "no-sandbox"` in API response
   - Handles UI updates for no-sandbox mode
   - Notifies user of mode change

## API Response Examples

### No-Sandbox Mode Enabled

```json
{
  "success": true,
  "sandboxId": null,
  "url": null,
  "provider": "none",
  "mode": "no-sandbox",
  "message": "Sandbox disabled - running in no-sandbox mode"
}
```

### Sandbox Mode (Normal)

```json
{
  "success": true,
  "sandboxId": "sandbox_abc123",
  "url": "https://sandbox-abc123.vercel.sh",
  "provider": "vercel",
  "mode": "sandbox",
  "message": "Sandbox created and Vite React app initialized"
}
```

## Backward Compatibility

✅ **Fully backward compatible**

- Default behavior unchanged: `DISABLE_SANDBOX=false`
- Existing code continues to work without modifications
- No breaking changes to API or UI
- Graceful fallback when sandbox disabled

## Testing

### Test No-Sandbox Mode

```bash
# 1. Set environment variable
export DISABLE_SANDBOX=true

# 2. Start dev server
pnpm dev

# 3. Navigate to generation page
# Should show: "Running in no-sandbox mode"

# 4. Try generating code
# Code should be generated normally
# Preview iframe should be empty/hidden
```

### Test Normal Sandbox Mode

```bash
# 1. Remove or set to false
export DISABLE_SANDBOX=false

# 2. Provide sandbox credentials
export VERCEL_OIDC_TOKEN=...

# 3. Start dev server
pnpm dev

# 4. Navigate to generation page
# Should show: "Sandbox created"
# Preview should be functional
```

## Error Handling

### When Sandbox Disabled

If someone manually calls sandbox-related APIs with `DISABLE_SANDBOX=true`:

1. **`/api/create-ai-sandbox-v2`**
   - Returns `mode: "no-sandbox"` (graceful)

2. **Vercel Provider `createSandbox()`**
   - Throws: `"Sandbox disabled by configuration"`
   - This is a guard (shouldn't happen in normal flow)

### When Sandbox Enabled

Normal error handling:
- Missing tokens → Error response
- Sandbox creation failure → Error response with details
- Provider error → Logged and reported to UI

## Architecture

### Request Flow (No-Sandbox)

```
User initiates page
    ↓
createSandbox() called
    ↓
POST /api/create-ai-sandbox-v2
    ↓
Check DISABLE_SANDBOX=true
    ↓
Return { mode: "no-sandbox", ... }
    ↓
UI sets sandboxDisabled=true
    ↓
Show "No-sandbox mode" message
    ↓
Chat & code generation ready
```

### Request Flow (Sandbox Enabled)

```
User initiates page
    ↓
createSandbox() called
    ↓
POST /api/create-ai-sandbox-v2
    ↓
Check DISABLE_SANDBOX=false
    ↓
SandboxFactory.create()
    ↓
Vercel/E2B provider
    ↓
Return { mode: "sandbox", url: "...", ... }
    ↓
UI sets sandboxDisabled=false
    ↓
Show "Sandbox active" message
    ↓
Preview iframe loads
```

## FAQs

**Q: Can I switch modes without restarting?**
A: No, mode is determined at startup via environment variable. Restart required to change.

**Q: What about existing sandbox data?**
A: When disabled, existing sandbox state is cleared gracefully. No data loss.

**Q: Is no-sandbox mode production-ready?**
A: It's designed for development and learning. For production, use full sandbox mode.

**Q: Can I use multiple AI providers?**
A: Yes, configure any supported provider (OpenAI, Claude, Gemini, Groq).

**Q: What if I need live preview later?**
A: Enable sandbox mode by setting `DISABLE_SANDBOX=false` and providing sandbox credentials.

## Security Considerations

- `DISABLE_SANDBOX` is a configuration flag, not a security boundary
- Still requires valid AI provider API keys
- Code generation logic unchanged
- No security implications when disabled

## Performance

### No-Sandbox Mode Benefits

- ⚡ Faster startup (no sandbox initialization)
- 💾 Lower memory usage (no sandbox process)
- 🔌 No external API calls to Vercel/E2B
- 🚀 Suitable for CI/CD pipelines

### Sandbox Mode Benefits

- 👁️ Live preview capability
- ⚙️ Real code execution
- 📦 Package management
- 🧪 Testing environment

## Contributing

When modifying sandbox-related code:

1. Ensure `DISABLE_SANDBOX` check is respected
2. Add guards for sandb
ox operations
3. Handle both modes gracefully
4. Test both modes: enabled and disabled
5. Update docs if behavior changes

## Related Documentation

- [README.md](./README.md) - Project overview
- [.env.example](./.env.example) - Environment variables
- [config/app.config.ts](./config/app.config.ts) - Application configuration
