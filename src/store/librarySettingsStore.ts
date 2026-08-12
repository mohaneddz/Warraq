import { create } from "zustand";
import { supabase, unwrap } from "../data/supabaseClient";
import type { LibrarySettings } from "../types";

const defaults: LibrarySettings = {
  library_name: "CHU Mustapha Pacha — Medical Library",
  library_short_name: "Warraq",
  library_address: "Place du 1er Mai 1945, Sidi M'Hamed",
  library_city: "Algiers",
  library_phone: "+213 21 23 55 55",
  library_email: "",
  library_website: "",
  library_hours: "Sun–Thu, 08:00–16:30",
  library_description: "Medical library of the Mustapha Pacha University Hospital Center (CHU Mustapha Pacha), Algiers.",
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
  notify_overdue: true,
  notify_due_soon: true,
  notify_due_soon_days: 2,
  notify_ready: true,
  shelf_row_count: 6,
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
    // Fall back to the institutional defaults for any column the DB left null/undefined, so a
    // freshly-provisioned settings row still shows the CHU Mustapha profile out of the box.
    const merged: Record<string, unknown> = { ...defaults };
    for (const [key, value] of Object.entries(data)) {
      if (value !== null && value !== undefined) merged[key] = value;
    }
    set({ settings: merged as unknown as LibrarySettings, loaded: true });
  },
  update: async (values) => {
    const data = unwrap<Partial<LibrarySettings>>(
      await supabase.from("library_settings").update(values).eq("id", 1).select().single()
    );
    set({ settings: { ...get().settings, ...data } });
  },
}));
