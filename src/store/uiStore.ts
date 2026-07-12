import { create } from "zustand";
import type { Preferences } from "../types";

const defaults: Preferences = { onboardingComplete: false, libraryName: "Mustapha Bacha Hospital Library", operatorName: "", locale: "en", theme: "light", loanDays: 21, loanLimit: 5, finesEnabled: false, closeToTray: true };
const stored = typeof localStorage === "undefined" ? null : localStorage.getItem("warraq-preferences");
export const useUiStore = create<{ preferences: Preferences; sidebarOpen: boolean; paletteOpen: boolean; updatePreferences: (values: Partial<Preferences>) => void; setPaletteOpen: (value: boolean) => void; toggleSidebar: () => void }>((set) => ({
  preferences: stored ? { ...defaults, ...JSON.parse(stored) as Partial<Preferences> } : defaults,
  sidebarOpen: true,
  paletteOpen: false,
  updatePreferences: (values) => set((state) => { const preferences = { ...state.preferences, ...values }; localStorage.setItem("warraq-preferences", JSON.stringify(preferences)); return { preferences }; }),
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}));
