import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

const PERSIST_KEY = "script_generation_state_v1";
const STALE_TIMEOUT_MS = 5 * 60 * 1000; // 5 минут

export type ScriptGenerationSourceKey = "trending" | "youtube" | "unknown";

interface ScriptGenerationState {
  isGenerating: boolean;
  startedAt: number | null;
  lastError: string | null;
  sourceKey: ScriptGenerationSourceKey;

  start: (sourceKey?: ScriptGenerationSourceKey) => void;
  finish: () => void;
  setError: (message: string) => void;
  reset: () => void;
  ensureNotStale: () => void;
}

/**
 * Zustand store для генерации сценариев.
 *
 * Требования:
 * - Persist в localStorage (переживает F5)
 * - Состояние не зависит от жизненного цикла компонента (переживает переходы/развороты)
 * - Авто-сброс если состояние "loading" зависло > 5 минут
 */
export const useScriptGenerationStore = create<ScriptGenerationState>()(
  persist(
    (set, get) => ({
      isGenerating: false,
      startedAt: null,
      lastError: null,
      sourceKey: "unknown",

      start: (sourceKey = "unknown") => {
        set({
          isGenerating: true,
          startedAt: Date.now(),
          lastError: null,
          sourceKey,
        });
      },

      finish: () => {
        set({
          isGenerating: false,
          startedAt: null,
          lastError: null,
          sourceKey: "unknown",
        });
      },

      setError: (message) => {
        // Ошибка должна автоматически завершать "loading", чтобы UX не зависал
        set({
          isGenerating: false,
          startedAt: null,
          lastError: message,
          sourceKey: "unknown",
        });
      },

      reset: () => {
        set({
          isGenerating: false,
          startedAt: null,
          lastError: null,
          sourceKey: "unknown",
        });
      },

      ensureNotStale: () => {
        const state = get();
        if (!state.isGenerating) return;
        if (!state.startedAt) {
          // Неконсистентное состояние
          set({ isGenerating: false });
          return;
        }
        if (Date.now() - state.startedAt > STALE_TIMEOUT_MS) {
          console.warn(
            `[ScriptGenerationStore] Detected stale generation state (> ${STALE_TIMEOUT_MS}ms). Auto-reset.`
          );
          set({
            isGenerating: false,
            startedAt: null,
            lastError: null,
            sourceKey: "unknown",
          });
        }
      },
    }),
    {
      name: PERSIST_KEY,
      version: 1,
      // Явно указываем localStorage (с safe-guard), чтобы persist корректно работал в Next.js runtime
      // и не ломался в окружениях, где localStorage недоступен.
      storage: createJSONStorage(() => {
        if (typeof window === "undefined") {
          // Во время SSR не должно выполняться, но оставляем защиту.
          return undefined as any;
        }
        return window.localStorage;
      }),
      onRehydrateStorage: () => (state) => {
        // После восстановления состояния из localStorage — проверяем, не зависло ли оно
        // (например, если пользователь сделал F5 во время генерации)
        state?.ensureNotStale();
      },
    }
  )
);
