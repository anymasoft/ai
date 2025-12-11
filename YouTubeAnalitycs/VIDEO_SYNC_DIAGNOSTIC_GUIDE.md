# Video Synchronization Diagnostic Guide

## Issue: Channel Added but 0 Videos Synced

When a channel like "КОНТУР-К" is added and shows 0 synchronized videos despite ScrapeCreators returning valid JSON, follow this guide to diagnose the root cause.

---

## Diagnostic Steps

### 1. **Check the Application Logs**

When you add a channel, look for console output containing these log prefixes:

```
[ScrapeCreators] Videos Request (page 1, ...)
[ScrapeCreators] Videos Response (page 1)
[ScrapeCreators] Extracted videos count:
[SyncVideos] Запрашиваем видео из ScrapeCreators
[SyncVideos] Фильтрация видео
```

### 2. **API Response Extraction**

Check the `[ScrapeCreators] Extracted videos count:` log which shows:

```json
{
  "rawVideosLength": <number>,
  "extractionMethod": "<method>",
  "dataStructure": {
    "hasVideos": <boolean>,
    "hasItems": <boolean>,
    "hasResultVideos": <boolean>,
    "hasDataVideos": <boolean>,
    "isArray": <boolean>,
    "dataKeys": [<array of keys>]
  }
}
```

**What to look for:**
- If `rawVideosLength` > 0: API returned videos successfully
- If `rawVideosLength` = 0: Check `dataKeys` to see the actual response structure
- `extractionMethod` shows which path was used to find videos

### 3. **Video ID Statistics**

Look for `[ScrapeCreators] Video ID statistics:` which shows:

```json
{
  "totalVideos": <number>,
  "videosWithId": <number>,
  "videosWithoutId": <number>,
  "sampledVideoIds": [<array of IDs>]
}
```

**Critical check:**
- If `videosWithoutId` > 0: Some API videos are missing ID fields
- If `sampledVideoIds` contains "MISSING": The API response has different field names

### 4. **Filtering Statistics**

Check `[SyncVideos] Фильтрация видео:` log:

```json
{
  "before": <number>,
  "videosWithoutId": <number>,
  "after": <number>,
  "filtered": [<array of video objects>]
}
```

**What this reveals:**
- If `before` = 10, `videosWithoutId` = 10, `after` = 0: **All videos are being filtered out because they have no videoId**
- If `before` = 0: The API returned 0 videos (check step 2)

### 5. **Database Operations**

Look for these patterns:

```
[SyncVideos] INSERT новое видео <videoId>
[SyncVideos] INSERT успешен для <videoId>
```

Or:

```
[SyncVideos] UPDATE видео <videoId>
[SyncVideos] UPDATE успешен для <videoId>
```

**If you see INSERT/UPDATE logs but still have 0 videos in the database:**
- The sync completed successfully from the code perspective
- But the read query is querying with a different `channelId`
- Check: Are both INSERT and SELECT queries using the exact same `channelId` value?

---

## Common Root Causes

### Case 1: API Returns Different Response Structure

**Symptom:**
```
rawVideosLength: 0
dataKeys: ["result", "data", "success"]
```

**Fix:** The API is wrapping videos in an additional object layer. The code now has fallback detection for `data.result.videos` and `data.data.videos`, but if the structure is different, a new case needs to be added.

**Action:** Report the `dataKeys` and actual response structure so we can add support.

---

### Case 2: API Returns Videos Without ID Fields

**Symptom:**
```
videosWithId: 0
videosWithoutId: 12
sampledVideoIds: ["MISSING", "MISSING", "MISSING"]
```

**Possible causes:**
1. The API returns videos under different field names (e.g., `youtubeId` instead of `videoId`)
2. The API requires special parameters to include video IDs
3. Channel has mixed content types where some items aren't videos

**Action:** Check the actual API response:
- Look at `[ScrapeCreators] RAW first video from API:` log
- Check what fields are actually present in the response
- The `allKeys` array shows all field names in the video object

---

### Case 3: ChannelId Mismatch

**Symptom:**
- Log shows: `INSERT успешен для 7 видео`
- But channel page shows: 0 videos
- Database query shows no videos for that channelId

**Root Cause:** The `channelId` used in INSERT is different from what the channel page queries with.

**Debugging:**
1. When adding competitor: Note the `channelId` in the INSERT statement
2. On channel page: Check what `channelId` is in the URL
3. They should be identical

**Action:** Check if the YouTube API is returning different channelId formats for the same channel, or if there's URL encoding/decoding issue.

---

### Case 4: Silent Error in Sync

**Symptom:**
- Channel is added successfully
- No error message shown
- Logs show ERROR but process continued

**Root Cause:** In `/api/competitors/route.ts`, errors from `syncChannelTopVideos` are caught and silently ignored (lines 218-222) to allow competitor to be added even if sync fails.

**Debugging:**
1. Look for `[Competitors POST] Ошибка синхронизации видео` error logs
2. Check what error message is shown
3. Verify the video sync is actually being called

---

## Testing a Specific Channel

To test channel "КОНТУР-К":

### Step 1: Get the Actual Channel Data

```bash
# Get channel info
curl -X GET "https://api.scrapecreators.com/v1/youtube/channel?handle=КОНТУР-К" \
  -H "x-api-key: YOUR_API_KEY"

# Check what channelId is returned
# Note the exact channelId value
```

### Step 2: Get Videos for that Channel

```bash
# Using channelId from step 1
curl -X GET "https://api.scrapecreators.com/v1/youtube/channel-videos?channelId=<CHANNEL_ID>&sort=popular" \
  -H "x-api-key: YOUR_API_KEY"

# Analyze the response:
# - What is the JSON structure?
# - Where are videos located?
# - What fields do videos have?
# - Do all videos have 'id' or 'videoId' fields?
```

### Step 3: Review the Logs

Add the channel through the UI and check all logs matching the patterns above.

---

## Detailed Log Output Example

### Success Case (Normal Channel):

```
[ScrapeCreators] Extracted videos count: {
  "rawVideosLength": 26,
  "extractionMethod": "data.videos",
  "dataStructure": {
    "hasVideos": true,
    "hasItems": false,
    "hasResultVideos": false,
    "hasDataVideos": false,
    "isArray": false,
    "dataKeys": ["videos", "continuationToken"]
  }
}

[ScrapeCreators] Video ID statistics: {
  "totalVideos": 26,
  "videosWithId": 26,
  "videosWithoutId": 0,
  "sampledVideoIds": ["dQw4w9WgXcQ", "jNQXAC9IVRw", "J_DV5aIqD3E"]
}

[SyncVideos] Фильтрация видео: {
  "before": 26,
  "videosWithoutId": 0,
  "after": 12,
  "filtered": [
    {"videoId": "...", "title": "...", "viewCount": 1000000},
    {"videoId": "...", "title": "...", "viewCount": 900000},
    ...
  ]
}

[SyncVideos] INSERT успешен для 12 видео
```

### Problem Case (API Structure Mismatch):

```
[ScrapeCreators] Extracted videos count: {
  "rawVideosLength": 0,
  "extractionMethod": "none",
  "dataStructure": {
    "hasVideos": false,
    "hasItems": false,
    "hasResultVideos": false,
    "hasDataVideos": false,
    "isArray": false,
    "dataKeys": ["data", "pagination", "status"]
  }
}

[ScrapeCreators] Full API response structure (first 500 chars): {
  "dataSample": "{\"data\":{\"videos\":[...]},\"pagination\":{...}}",
  "dataKeys": ["data", "pagination", "status"],
  "paramType": "handle",
  "paramValue": "КОНТУР-К"
}
```

In this case, videos are in `data.data.videos` - the code should have found them with the new fallback detection, but if it didn't, we know exactly what structure to add support for.

---

## Next Steps After Diagnosis

Once you've identified the root cause using the steps above:

1. **Share the relevant logs** with the development team
2. **Include the API response structure** (from curl test or logs)
3. **Note the channel handle** and any special characteristics
4. The code will be updated to handle that specific case

---

## Performance Notes

The enhanced logging adds minor overhead but helps significantly with diagnostics. The logs will show:
- Exact point where data is being lost
- Why it's being lost
- What the alternative structures are

This makes debugging 0-video issues much faster and more reliable.
