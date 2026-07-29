import { create } from "zustand";
import type { Preferences } from "../types";

const defaults: Preferences = {
  onboardingComplete: false,
  locale: "en",
  theme: "light",
  accentColor: "#1a4d40",
  fontSize: "medium",
  googleBooksEnabled: true,
  openLibraryEnabled: true,
  openAIEnabled: false,
  groqEnabled: false,
  openAIKey: "",
  groqApiKey: "",
  closeToTray: true,
  launchOnBoot: false,
  autosaveEnabled: true,
  autosaveInterval: 60,
  pageSize: 10,
  titlePreference: "original",
};
const stored = typeof localStorage === "undefined" ? null : localStorage.getItem("warraq-preferences");
export const useUiStore = create<{ preferences: Preferences; sidebarOpen: boolean; paletteOpen: boolean; updatePreferences: (values: Partial<Preferences>) => void; setPaletteOpen: (value: boolean) => void; toggleSidebar: () => void }>((set) => ({
  preferences: stored ? { ...defaults, ...JSON.parse(stored) as Partial<Preferences> } : defaults,
  sidebarOpen: true,
  paletteOpen: false,
  updatePreferences: (values) => set((state) => {
    const preferences = { ...state.preferences, ...values };
    localStorage.setItem("warraq-preferences", JSON.stringify(preferences));
    if (values.closeToTray !== undefined) {
      import("@tauri-apps/api/core").then(({ invoke }) => {
        invoke("set_close_to_tray", { enabled: values.closeToTray }).catch(console.error);
      });
    }
    return { preferences };
  }),
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}));
