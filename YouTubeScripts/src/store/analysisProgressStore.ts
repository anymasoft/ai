import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AnalysisType = 'content' | 'comment' | 'audience' | 'momentum' | 'swot' | 'deep';

type ChannelProgress = {
  [key in AnalysisType]?: boolean;
};

type AnalysisProgressStore = {
  // inProgress[channelId][analysisType] = boolean
  inProgress: Record<string, ChannelProgress>;

  // Запустить генерацию анализа
  start: (channelId: string, type: AnalysisType) => void;

  // Завершить генерацию анализа
  finish: (channelId: string, type: AnalysisType) => void;

  // Проверить, генерируется ли анализ
  isGenerating: (channelId: string, type: AnalysisType) => boolean;

  // Получить все типы в процессе для канала
  getChannelProgress: (channelId: string) => ChannelProgress;

  // Очистить весь прогресс (на случай logout или switch cannal)
  clearAll: () => void;
};

export const useAnalysisProgressStore = create<AnalysisProgressStore>(
  persist(
    (set, get) => ({
      inProgress: {},

      start: (channelId, type) => {
        set((state) => ({
          inProgress: {
            ...state.inProgress,
            [channelId]: {
              ...state.inProgress[channelId],
              [type]: true,
            },
          },
        }));
      },

      finish: (channelId, type) => {
        set((state) => ({
          inProgress: {
            ...state.inProgress,
            [channelId]: {
              ...state.inProgress[channelId],
              [type]: false,
            },
          },
        }));
      },

      isGenerating: (channelId, type) => {
        const state = get();
        return state.inProgress[channelId]?.[type] === true;
      },

      getChannelProgress: (channelId) => {
        const state = get();
        return state.inProgress[channelId] || {};
      },

      clearAll: () => {
        set({ inProgress: {} });
      },
    }),
    {
      name: "analysis-progress-store",
      version: 1,
    }
  )
);
