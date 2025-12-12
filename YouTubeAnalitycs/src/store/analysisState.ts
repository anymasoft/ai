import { create } from "zustand";

type AnalysisStore = {
  isGeneratingContent: boolean;
  setGeneratingContent: (v: boolean) => void;

  isGeneratingMomentum: boolean;
  setGeneratingMomentum: (v: boolean) => void;

  isGeneratingAudience: boolean;
  setGeneratingAudience: (v: boolean) => void;

  isGeneratingComments: boolean;
  setGeneratingComments: (v: boolean) => void;

  isGeneratingDeep: boolean;
  setGeneratingDeep: (v: boolean) => void;

  isGeneratingSWOT: boolean;
  setGeneratingSWOT: (v: boolean) => void;

  isRefreshingCommentAnalysis: boolean;
  setRefreshingCommentAnalysis: (v: boolean) => void;

  isEnrichingAudience: boolean;
  setEnrichingAudience: (v: boolean) => void;
};

export const useAnalysisStore = create<AnalysisStore>((set) => ({
  isGeneratingContent: false,
  setGeneratingContent: (v) => set({ isGeneratingContent: v }),

  isGeneratingMomentum: false,
  setGeneratingMomentum: (v) => set({ isGeneratingMomentum: v }),

  isGeneratingAudience: false,
  setGeneratingAudience: (v) => set({ isGeneratingAudience: v }),

  isGeneratingComments: false,
  setGeneratingComments: (v) => set({ isGeneratingComments: v }),

  isGeneratingDeep: false,
  setGeneratingDeep: (v) => set({ isGeneratingDeep: v }),

  isGeneratingSWOT: false,
  setGeneratingSWOT: (v) => set({ isGeneratingSWOT: v }),

  isRefreshingCommentAnalysis: false,
  setRefreshingCommentAnalysis: (v) => set({ isRefreshingCommentAnalysis: v }),

  isEnrichingAudience: false,
  setEnrichingAudience: (v) => set({ isEnrichingAudience: v }),
}));
