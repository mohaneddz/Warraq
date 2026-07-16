export function formatDisplayCurrency(amount: number): string {
  let currency = "DZD";
  let locale = "en";
  try {
    const stored = localStorage.getItem("warraq-preferences");
    if (stored) {
      const prefs = JSON.parse(stored);
      if (prefs.currency) currency = prefs.currency;
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
