import { create } from "zustand";
import { AppState } from "../types";

// Store for app-wide state
interface AppStore {
  appState: AppState;
  setAppState: (state: AppState) => void;

  // 🎨 Visual-Edit Mode: Select & Edit element selection
  inSelectAndEditMode: boolean;
  toggleInSelectAndEditMode: () => void;
  disableInSelectAndEditMode: () => void;

  // 🔧 PARTIAL UPDATE: Flag to prevent iframe re-render during element mutations
  isPartialUpdateInProgress: boolean;
  setIsPartialUpdateInProgress: (inProgress: boolean) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  appState: AppState.INITIAL,
  setAppState: (state: AppState) => set({ appState: state }),

  // 🎨 Visual-Edit: Select & Edit mode for visual element selection
  inSelectAndEditMode: false,
  toggleInSelectAndEditMode: () =>
    set((state) => ({ inSelectAndEditMode: !state.inSelectAndEditMode })),
  disableInSelectAndEditMode: () => set({ inSelectAndEditMode: false }),

  // 🔧 PARTIAL UPDATE: Prevent iframe srcdoc update during element mutations
  isPartialUpdateInProgress: false,
  setIsPartialUpdateInProgress: (inProgress) =>
    set({ isPartialUpdateInProgress: inProgress }),
}));
