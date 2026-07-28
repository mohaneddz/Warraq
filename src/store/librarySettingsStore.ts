import { create } from "zustand";
import { supabase, unwrap } from "../data/supabaseClient";
import type { LibrarySettings } from "../types";

const defaults: LibrarySettings = {
  library_name: "Mustapha Bacha Hospital Library",
  library_short_name: "Warraq",
  library_address: "",
  library_city: "",
  library_phone: "",
  library_email: "",
  library_website: "",
  library_hours: "",
  library_description: "",
  timezone: "Africa/Algiers",
  date_format: "dd/MM/yyyy",
  currency: "DZD",
  loan_days: 14,
  loan_limit: 3,
  renew_limit: 2,
  reservation_hold_days: 3,
  reservation_external_days: 7,
  reservation_internal_days: 1,
  self_renewal_allowed: false,
  grace_period_enabled: false,
  grace_period_days: 0,
  fines_enabled: false,
  fine_per_day: 0,
  max_fine_amount: 0,
  fine_currency: "DZD",
  fines_payment_method: "cash",
  notify_overdue: true,
  notify_due_soon: true,
  notify_due_soon_days: 2,
  notify_ready: true,
  updated_at: "",
};

interface LibrarySettingsState {
  settings: LibrarySettings;
  loaded: boolean;
  load: () => Promise<void>;
  update: (values: Partial<LibrarySettings>) => Promise<void>;
}

export const useLibrarySettingsStore = create<LibrarySettingsState>((set, get) => ({
  settings: defaults,
  loaded: false,
  load: async () => {
    const data = unwrap<Partial<LibrarySettings>>(await supabase.from("library_settings").select("*").eq("id", 1).single());
    set({ settings: { ...defaults, ...data }, loaded: true });
  },
  update: async (values) => {
    const data = unwrap<Partial<LibrarySettings>>(
      await supabase.from("library_settings").update(values).eq("id", 1).select().single()
    );
    set({ settings: { ...get().settings, ...data } });
  },
}));
