// ═══════════════════════════════════════════════════════════════════
// API MODULE — batch translate implementation
// ═══════════════════════════════════════════════════════════════════

import { updateSingleLine } from "./ui.js";
import { updateLimitedClass, insertUpgradeButtons, updateExportButtonState } from "./ui.js";
import { transcriptState, calculateMaxFreeLine } from "./state.js";

// Utility: timeout wrapper
async function fetchWithTimeout(url, options, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return response;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

// send batch with retry
async function sendBatchWithRetry(payload, headers, attempt = 0) {
  const MAX_RETRIES = 3;
  const SERVER_URL = "https://api.beem.ink/translate-batch";

  try {
    const response = await fetchWithTimeout(
      SERVER_URL,
      {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      },
      15000
    );

    if (!response.ok) {
      return { error: "bad_status", status: response.status };
    }

    return await response.json();
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      const delay = 500 * Math.pow(2, attempt);
      await new Promise(r => setTimeout(r, delay));
      return sendBatchWithRetry(payload, headers, attempt + 1);
    }
    return { error: "max_retries", message: err.message };
  }
}

// main batch translate function
async function translateSubtitles(videoId, subtitles, targetLang) {
  const BATCH_SIZE = 10;

  const storage = await chrome.storage.local.get(["token", "plan"]);
  const token = storage.token || null;
  let userPlan = storage.plan || "Free";

  transcriptState.userPlan = userPlan;

  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const totalLines = subtitles.length;
  transcriptState.maxFreeLine =
    userPlan === "Free" ? calculateMaxFreeLine(totalLines) : totalLines - 1;

  const payloadBase = {
    videoId,
    lang: targetLang,
    totalLines,
  };

  let lastTranslatedIndex = -1;

  for (let start = 0; start < totalLines; start += BATCH_SIZE) {
    const batchItems = [];

    for (let i = start; i < Math.min(start + BATCH_SIZE, totalLines); i++) {
      if (userPlan === "Free" && i > transcriptState.maxFreeLine) break;

      batchItems.push({
        lineNumber: i,
        text: subtitles[i].text,
      });
    }

    if (batchItems.length === 0) break;

    const payload = { ...payloadBase, items: batchItems };
    const result = await sendBatchWithRetry(payload, headers);

    if (!result || result.error) {
      console.warn("Batch skipped due to error:", result);
      continue;
    }

    // update plan/export if server returned
    if (result.plan) {
      userPlan = result.plan;
      transcriptState.userPlan = result.plan;
      updateExportButtonState();
    }

    if (typeof result.export_allowed === "boolean") {
      transcriptState.exportAllowed = result.export_allowed;
      updateExportButtonState();
    }

    if (Array.isArray(result.items)) {
      result.items.forEach(item => {
        updateSingleLine(item.lineNumber, item.text);

        // сохраняем в state для экспорта
        transcriptState.translatedSubtitles[item.lineNumber] = {
          ...transcriptState.originalSubtitles[item.lineNumber],
          text: item.text,
        };

        lastTranslatedIndex = Math.max(lastTranslatedIndex, item.lineNumber);
      });
    }

    if (result.stop === true) break;

    await new Promise(r => setTimeout(r, 300));
  }

  if (userPlan === "Free" && lastTranslatedIndex >= 0) {
    const idx = Math.min(lastTranslatedIndex, transcriptState.maxFreeLine);
    insertUpgradeButtons(idx);
  }

  updateLimitedClass();
}

export { translateSubtitles };