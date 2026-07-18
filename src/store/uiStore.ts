import { create } from "zustand";
import type { Preferences } from "../types";

const defaults: Preferences = {
  onboardingComplete: false,
  libraryName: "Mustapha Bacha Hospital Library",
  libraryShortName: "",
  libraryLogo: null,
  operatorName: "",
  operatorEmail: "",
  operatorAvatar: null,
  libraryAddress: "",
  libraryCity: "Algiers",
  libraryPhone: "",
  libraryEmail: "",
  libraryWebsite: "",
  libraryDescription: "",
  libraryHours: "Sunday–Thursday 08:00–16:00",
  locale: "en",
  timezone: "Africa/Algiers",
  dateFormat: "dd/MM/yyyy",
  currency: "DZD",
  theme: "light",
  accentColor: "#1a4d40",
  fontSize: "medium",
  loanDays: 21,
  loanLimit: 5,
  renewLimit: 2,
  reservationHoldDays: 3,
  selfRenewalAllowed: true,
  gracePeriodEnabled: false,
  gracePeriodDays: 2,
  finesEnabled: false,
  finePerDay: 10,
  maxFineAmount: 500,
  fineCurrency: "DZD",
  finesPaymentMethod: "cash",
  notifyOverdue: true,
  notifyDueSoon: true,
  notifyDueSoonDays: 2,
  notifyReady: true,
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
