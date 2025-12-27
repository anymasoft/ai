# WebSocket Connection Debugging Guide

## Quick Check

When user clicks "Generate", you should see these logs in order:

### Frontend Console (DevTools)
```
[WS] Connecting to backend @ ws://127.0.0.1:7001/generate-code
[WS] ✓ CONNECTED to backend successfully
```

### Backend Console
```
[WS] HANDLER ENTERED - frontend connected to generation route
[WS:0] Handler start
[WS:0] Client: <address>
[WS:1] accept WebSocket
[WS:1] DONE accept
[WS:2] receive_json from client
[WS:2] DONE receive_json
...
[WS:8] enqueue_generation
[WS:8] DONE enqueue_generation
[WS:9] start keep-alive loop
```

## Troubleshooting

### Problem: Frontend shows "[WS] ✗ CONNECTION ERROR"

**Possible causes:**
1. Backend not running on port 7001
2. Backend crashed
3. Backend firewall/CORS issue

**Solution:**
```bash
# Check if backend is running
curl http://localhost:7001/health

# Start backend if not running
cd backend
poetry run uvicorn main:app --reload --port 7001
```

### Problem: Frontend "[WS] Connecting..." but no CONNECTED log

**Possible causes:**
1. Connection hanging/timeout
2. Backend not accepting WebSocket connections

**Solution:**
- Check browser console for network errors
- Check if port 7001 is accessible: `telnet localhost 7001`
- Check backend logs for errors before `[WS] HANDLER ENTERED`

### Problem: Backend shows no "[WS] HANDLER ENTERED" log

**Meaning:** Frontend never connected to backend

**Possible causes:**
1. Frontend using wrong URL
2. Frontend not sending WebSocket request at all
3. Frontend running on different URL than expected

**Solution:**
1. Check frontend logs: `[WS] Connecting to backend @`
2. Check if URL is `ws://127.0.0.1:7001/generate-code` or `ws://localhost:7001/generate-code`
3. Check browser Network tab > WS tab for connection attempts

### Problem: Backend "[WS] HANDLER ENTERED" appears but generation doesn't start

**Possible causes:**
1. Generator pipeline error (check logs after `[WS:8]`)
2. Worker not processing job
3. Database error

**Solution:**
- Check for traceback after `[WS:8] DONE enqueue_generation`
- Check worker logs: `[WORKER] Processing`
- Check database logs for SQL errors

## Environment Configuration

### Development (Local)
No `.env.local` needed - defaults are:
- Frontend: `ws://127.0.0.1:7001`
- Backend: Runs on port 7001

### Custom Port (if needed)
Create `frontend/.env.local`:
```env
VITE_WS_BACKEND_URL=ws://custom.domain:9000
VITE_HTTP_BACKEND_URL=http://custom.domain:9000
```

## Verification Checklist

- [ ] Backend running: `curl http://localhost:7001/health`
- [ ] Frontend console shows `[WS] Connecting...`
- [ ] Frontend console shows `[WS] ✓ CONNECTED` after 1-2 seconds
- [ ] Backend shows `[WS] HANDLER ENTERED`
- [ ] Backend shows `[WS:9] keep-alive tick` (repeating every 100ms)
- [ ] Generation starts (code appears in UI)

## WebSocket Logs Reference

Frontend sends:
```
[WS] Connecting to backend @ <URL>
[WS] ✓ CONNECTED to backend successfully     ← Connection established
```

Frontend errors:
```
[WS] ✗ CONNECTION ERROR - backend unreachable at <URL>
[WS] ✗ Unknown server or connection error
```

Backend sequence:
```
[WS] HANDLER ENTERED                         ← Frontend connected!
[WS:0] Handler start
[WS:0] Client: <address>
[WS:1] accept WebSocket
[WS:1] DONE accept
[WS:2] receive_json from client
[WS:2] DONE receive_json
[WS:3] params check
[WS:3] DONE params check
[WS:4] create generation_id
[WS:4] DONE generation_id=<id>
[WS:5] save_generation to DB
[WS:5] DONE save_generation record=<id>
[WS:6] send status message
[WS:6] DONE send status
[WS:7] create GenerationJob
[WS:7] DONE GenerationJob created
[WS:8] enqueue_generation
[WS:8] DONE enqueue_generation job_id=<id>
[WS:9] start keep-alive loop
[WS:9] keep-alive tick                       ← Repeats every 100ms while generating
```

If any step fails, you'll see a Python traceback with the exact error.
