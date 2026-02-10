import { create } from "zustand";

export type GenerationStatus = "idle" | "loading" | "success" | "error";

interface GenerationState {
  statusMap: Record<string, GenerationStatus>;
  setStatus: (key: string, status: GenerationStatus) => void;
  getStatus: (key: string) => GenerationStatus;
  resetStatus: (key: string) => void;
  clearAll: () => void;
}

/**
 * Глобальный store для управления состоянием генерации аналитики
 *
 * Гарантирует, что состояние НЕ теряется при collapse/unmount компонентов
 * Состояние привязано к уникальному ключу, а не к жизненному циклу компонента
 *
 * Использование:
 * const store = useGenerationStatusStore();
 * const key = `${competitorId}:${sectionType}`;
 *
 * // При старте генерации
 * store.setStatus(key, "loading");
 *
 * // При завершении
 * store.setStatus(key, "success");
 *
 * // При получении состояния
 * const status = store.getStatus(key); // "loading" | "success" | "error" | "idle"
 */
export const useGenerationStatusStore = create<GenerationState>((set, get) => ({
  statusMap: {},

  setStatus: (key, status) => {
    set((state) => ({
      statusMap: {
        ...state.statusMap,
        [key]: status,
      },
    }));
  },

  getStatus: (key) => {
    const state = get();
    return state.statusMap[key] || "idle";
  },

  resetStatus: (key) => {
    set((state) => {
      const newMap = { ...state.statusMap };
      delete newMap[key];
      return { statusMap: newMap };
    });
  },

  clearAll: () => {
    set({ statusMap: {} });
  },
}));
