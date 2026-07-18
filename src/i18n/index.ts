import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en.json";
import fr from "./fr.json";
import ar from "./ar.json";

let savedLocale = "en";
try {
  const stored = typeof localStorage !== "undefined" ? localStorage.getItem("warraq-preferences") : null;
  if (stored) {
    const prefs = JSON.parse(stored);
    if (prefs && (prefs.locale === "en" || prefs.locale === "fr" || prefs.locale === "ar")) {
      savedLocale = prefs.locale;
    }
  }
} catch (e) {
  console.error("Failed to load saved locale", e);
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    fr: { translation: fr },
    ar: { translation: ar }
  },
  lng: savedLocale,
  fallbackLng: "en",
  interpolation: { escapeValue: false }
});

export default i18n;

