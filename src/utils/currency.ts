export function formatDisplayCurrency(amount: number): string {
  let currency = "DZD";
  try {
    const stored = localStorage.getItem("warraq-preferences");
    if (stored) {
      const prefs = JSON.parse(stored);
      if (prefs.currency) currency = prefs.currency;
    }
  } catch {}

  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency, minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}
