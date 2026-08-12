import { useLibrarySettingsStore } from "../store/librarySettingsStore";

export function formatDisplayCurrency(amount: number): string {
  // Currency is a shared institutional setting (library_settings); locale is per-device.
  let currency = "DZD";
  let locale = "en";
  try {
    const settings = useLibrarySettingsStore.getState().settings;
    if (settings.currency) currency = settings.currency;
  } catch {}
  try {
    const stored = localStorage.getItem("warraq-preferences");
    if (stored) {
      const prefs = JSON.parse(stored);
      if (prefs.locale) locale = prefs.locale;
    }
  } catch {}

  try {
    return new Intl.NumberFormat(locale === "ar" ? "ar-DZ" : locale === "fr" ? "fr-FR" : "en-US", {
      style: "currency",
      currency: currency, minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}
