# VideoReader - YouTube AI Translator

Clean YouTube video translation extension built with Plasmo Framework 0.90.3

## Features

- ✅ YouTube subtitle extraction
- ✅ Line-by-line AI translation
- ✅ Real-time subtitle highlighting with karaoke effect
- ✅ Multi-language support (9 languages)
- ✅ Export to SRT/VTT/TXT
- ✅ Token-based authentication (stubs ready)
- ✅ Modern UI with Tailwind CSS
- ✅ Manifest V3 compatible

## Installation

### Prerequisites

- Node.js 18+ or 20+
- npm or pnpm

### Steps

1. **Install dependencies**

```bash
cd video-reader
npm install
```

2. **Run development build**

```bash
npm run dev
```

This will start Plasmo in watch mode and output to `build/chrome-mv3-dev`

3. **Load extension in Chrome**

- Open `chrome://extensions/`
- Enable **Developer mode**
- Click **Load unpacked**
- Select `video-reader/build/chrome-mv3-dev`

4. **Test on YouTube**

- Open any YouTube video with subtitles
- The VideoReader panel will appear in the right sidebar
- Click "Translate Video" to start

## Production Build

```bash
npm run build
```

Output: `build/chrome-mv3-prod`

To package as .zip:

```bash
npm run package
```

## Project Structure

```
video-reader/
├── src/
│   ├── contents/
│   │   └── youtube.tsx         # Main content script (UI + logic)
│   ├── background.ts           # Background service worker (auth stubs)
│   └── style.css               # Tailwind + custom styles
├── assets/
│   └── logo.png                # Extension icon
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.js
└── README.md
```

## Backend API

The extension expects a Flask backend at `http://localhost:5000` with the following endpoints:

### POST /translate-line

Translate a single subtitle line

**Request:**
```json
{
  "videoId": "dQw4w9WgXcQ",
  "lineNumber": 0,
  "text": "Hello world",
  "prevContext": ["Previous line"],
  "lang": "ru"
}
```

**Response:**
```json
{
  "text": "Привет мир",
  "cached": false
}
```

### GET /api/plan

Get user plan (requires Bearer token)

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "status": "ok",
  "plan": "Premium",
  "email": "user@example.com"
}
```

## Authentication (Stubs)

The background service worker (`src/background.ts`) contains stubs for:

- `getToken()` - Get auth token from chrome.storage
- `saveToken(token)` - Save token to storage
- `getPlan()` - Fetch user plan from backend
- `login()` - Login stub (not implemented yet)

Token is stored in `chrome.storage.local` under key `auth_token`.

## Technologies

- **Plasmo Framework** 0.90.3 - Extension framework (no Parcel)
- **React** 18.3.1 - UI library
- **TypeScript** 5.5.2 - Type safety
- **Tailwind CSS** 3.4.4 - Styling
- **Manifest V3** - Modern Chrome extension standard

## Key Differences from Old Project

✅ **No @parcel/watcher** - Uses Plasmo's modern bundler
✅ **No node-gyp errors** - Clean Windows/Mac/Linux compatibility
✅ **Token-based auth** - Removed OAuth/cookies, added token stubs
✅ **Clean structure** - Organized src/ directory
✅ **Type-safe** - Full TypeScript support

## Troubleshooting

### Build errors

If you see any build errors, make sure:

- You're using Node 18+ or 20+
- Dependencies are installed: `npm install`
- No conflicting Plasmo versions

### Extension not loading

- Check that you loaded from `build/chrome-mv3-dev` (not src/)
- Open DevTools → Console to see errors
- Verify you're on a YouTube video page (`/watch?v=...`)

### Subtitles not loading

- Make sure the video has subtitles (check YouTube's "Show transcript" button)
- Some videos may not have transcript data available

### Translation not working

- Ensure Flask backend is running on `http://localhost:5000`
- Check Network tab in DevTools for failed requests
- Backend should respond to `/translate-line` endpoint

## Next Steps

After verifying the core works:

1. Implement actual `login()` function in background.ts
2. Add OAuth flow or email/password authentication
3. Integrate with `/api/plan` for plan enforcement
4. Add popup UI for account management
5. Implement Free/Premium tier limits

## License

Proprietary - VideoReader Team
