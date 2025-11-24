// ═══════════════════════════════════════════════════════════════════
// API MODULE — batch translate implementation
// ═══════════════════════════════════════════════════════════════════

import { updateSingleLine } from "./ui.js";
import { updateLimitedClass, insertUpgradeButtons, updateExportButtonState, updateProgressBar } from "./ui.js";
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

  // КРИТИЧЕСКОЕ: логирование payload для диагностики 500 ошибок
  if (attempt === 0) {
    console.log(`[VideoReader API] 📤 Sending batch:`, {
      videoId: payload.videoId,
      lang: payload.lang,
      itemsCount: payload.items?.length || 0,
      totalLines: payload.totalLines,
      hasAuth: !!headers.Authorization,
      firstItem: payload.items?.[0],
      payloadSize: JSON.stringify(payload).length
    });
  }

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
      const status = response.status;
      let errorBody = null;

      try {
        errorBody = await response.text();
      } catch (e) {
        // Игнорируем ошибки чтения body
      }

      // КРИТИЧЕСКОЕ: обработка различных HTTP статусов
      if (status === 429) {
        // Rate limiting - увеличиваем задержку
        if (attempt < MAX_RETRIES) {
          console.warn(`[VideoReader API] ⚠️ Rate limit (429), попытка ${attempt + 1}/${MAX_RETRIES + 1}, retry через ${2000 * Math.pow(2, attempt)}ms...`);
          const delay = 2000 * Math.pow(2, attempt); // Увеличенная задержка для 429
          await new Promise(r => setTimeout(r, delay));
          return sendBatchWithRetry(payload, headers, attempt + 1);
        } else {
          console.error(`[VideoReader API] ❌ Rate limit (429), исчерпаны все ${MAX_RETRIES + 1} попытки`);
        }
      } else if (status >= 500 && status < 600) {
        // Server error - retry
        if (attempt < MAX_RETRIES) {
          console.warn(`[VideoReader API] ⚠️ Server error (${status}), попытка ${attempt + 1}/${MAX_RETRIES + 1}, retry через ${1000 * Math.pow(2, attempt)}ms...`, {
            errorBody: errorBody ? errorBody.substring(0, 200) : null,
            videoId: payload.videoId,
            itemsCount: payload.items?.length
          });
          const delay = 1000 * Math.pow(2, attempt);
          await new Promise(r => setTimeout(r, delay));
          return sendBatchWithRetry(payload, headers, attempt + 1);
        } else {
          console.error(`[VideoReader API] ❌ Server error (${status}), исчерпаны все ${MAX_RETRIES + 1} попытки`, {
            errorBody: errorBody ? errorBody.substring(0, 500) : null,
            videoId: payload.videoId,
            itemsCount: payload.items?.length
          });
        }
      }

      // Логирование финальной ошибки для других статусов
      if (status !== 429 && !(status >= 500 && status < 600)) {
        console.error(`[VideoReader API] ❌ Request failed with status ${status}:`, {
          errorBody: errorBody ? errorBody.substring(0, 500) : null,
          videoId: payload.videoId,
          itemsCount: payload.items?.length
        });
      }

      return {
        error: "bad_status",
        status: status,
        errorBody: errorBody ? errorBody.substring(0, 200) : null
      };
    }

    const result = await response.json();

    // Логирование успешных запросов (только для диагностики)
    if (attempt > 0) {
      console.log(`[VideoReader API] ✅ Batch succeeded after ${attempt + 1} attempts`);
    }

    return result;
  } catch (err) {
    const isTimeout = err.name === 'AbortError';
    const errorType = isTimeout ? 'timeout' : 'network';

    if (attempt < MAX_RETRIES) {
      console.warn(`[VideoReader API] ⚠️ Batch ${errorType} error:`, err.message, `попытка ${attempt + 1}/${MAX_RETRIES + 1}, retry...`);
      const delay = 500 * Math.pow(2, attempt);
      await new Promise(r => setTimeout(r, delay));
      return sendBatchWithRetry(payload, headers, attempt + 1);
    } else {
      console.error(`[VideoReader API] ❌ Batch ${errorType} error:`, err.message, `исчерпаны все ${MAX_RETRIES + 1} попытки`);
    }

    return {
      error: "max_retries",
      errorType: errorType,
      message: err.message,
      attemptsUsed: attempt + 1
    };
  }
}

// main batch translate function
async function translateSubtitles(videoId, subtitles, targetLang) {
  const BATCH_SIZE = 10;
  const startTime = performance.now();

  console.log(`[VideoReader API] 🚀 Starting translation:`, {
    videoId,
    totalLines: subtitles.length,
    targetLang,
    batchSize: BATCH_SIZE
  });

  const storage = await chrome.storage.local.get(["token", "plan"]);
  const token = storage.token || null;
  const initialPlan = storage.plan || "Free";  // КРИТИЧЕСКОЕ: сохраняем начальный план для лимита
  let userPlan = initialPlan;

  console.log(`[VideoReader API] 📊 План пользователя:`, {
    fromStorage: storage.plan || 'не установлен',
    initialPlan: initialPlan
  });

  transcriptState.userPlan = initialPlan;

  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const totalLines = subtitles.length;
  transcriptState.maxFreeLine =
    initialPlan === "Free" ? calculateMaxFreeLine(totalLines) : totalLines - 1;

  console.log(`[VideoReader API] 📊 Лимит перевода:`, {
    totalLines,
    maxFreeLine: transcriptState.maxFreeLine,
    willTranslate: initialPlan === "Free" ? transcriptState.maxFreeLine + 1 : totalLines
  });

  const payloadBase = {
    videoId,
    lang: targetLang,
    totalLines,
  };

  let lastTranslatedIndex = -1;

  // Вычисляем общее количество батчей для прогресс-бара
  const effectiveLines = userPlan === "Free" ? transcriptState.maxFreeLine + 1 : totalLines;
  const totalBatches = Math.ceil(effectiveLines / BATCH_SIZE);
  let doneBatches = 0;

  for (let start = 0; start < totalLines; start += BATCH_SIZE) {
    const batchItems = [];

    for (let i = start; i < Math.min(start + BATCH_SIZE, totalLines); i++) {
      // КРИТИЧЕСКОЕ: используем initialPlan для проверки лимита, а не userPlan
      // userPlan может обновиться от сервера в середине цикла
      if (initialPlan === "Free" && i > transcriptState.maxFreeLine) break;

      batchItems.push({
        lineNumber: i,
        text: subtitles[i].text,
      });
    }

    if (batchItems.length === 0) break;

    const payload = { ...payloadBase, items: batchItems };
    const result = await sendBatchWithRetry(payload, headers);

    if (!result || result.error) {
      // КРИТИЧЕСКОЕ: детальное логирование ошибок для диагностики
      console.error("[VideoReader API] ❌ Batch translation failed:", {
        batchStart: start,
        batchSize: batchItems.length,
        error: result?.error,
        status: result?.status,
        message: result?.message,
        videoId: videoId
      });

      // При ошибке продолжаем со следующим batch (отказоустойчивость)
      doneBatches++;
      updateProgressBar(doneBatches, totalBatches);
      continue;
    }

    // update plan/export if server returned
    if (result.plan) {
      console.log(`[VideoReader API] 📊 План обновлен от сервера:`, {
        oldPlan: userPlan,
        newPlan: result.plan
      });

      userPlan = result.plan;
      transcriptState.userPlan = result.plan;

      // КРИТИЧЕСКОЕ: сохраняем план в chrome.storage для следующих видео
      chrome.storage.local.set({ plan: result.plan });

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

    // Обновляем прогресс-бар после успешного batch
    doneBatches++;
    updateProgressBar(doneBatches, totalBatches);

    // КРИТИЧЕСКОЕ ИЗМЕНЕНИЕ: завершаем прогресс-бар перед выходом
    if (result.stop === true) {
      // Завершаем прогресс до 100% для корректного скрытия
      updateProgressBar(totalBatches, totalBatches);
      break;
    }

    await new Promise(r => setTimeout(r, 300));
  }

  // КРИТИЧЕСКОЕ: используем initialPlan для вставки upgrade buttons
  // т.к. userPlan мог обновиться от сервера
  if (initialPlan === "Free" && lastTranslatedIndex >= 0) {
    const idx = Math.min(lastTranslatedIndex, transcriptState.maxFreeLine);
    console.log(`[VideoReader API] 📊 Вставляем upgrade buttons на индексе:`, idx);
    insertUpgradeButtons(idx);
  }

  updateLimitedClass();

  // Финальная статистика для мониторинга производительности
  const duration = performance.now() - startTime;
  const translatedCount = lastTranslatedIndex + 1;
  console.log(`[VideoReader API] ✅ Translation completed:`, {
    duration: `${(duration / 1000).toFixed(2)}s`,
    translatedLines: translatedCount,
    totalLines: subtitles.length,
    successRate: `${((translatedCount / subtitles.length) * 100).toFixed(1)}%`,
    initialPlan: initialPlan,
    finalPlan: userPlan
  });
}

export { translateSubtitles };