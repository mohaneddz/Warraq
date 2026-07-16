import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, Sun, Moon, Laptop } from "lucide-react";
import { useUiStore } from "../store/uiStore";
import { useTranslation } from "react-i18next";

export function OnboardingPage() {
  const { updatePreferences } = useUiStore();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const [libName, setLibName] = useState("Mustapha Bacha Hospital Library");
  const [operator, setOperator] = useState("");
  const [locale, setLocale] = useState<"en" | "fr" | "ar">("en");
  const [theme, setTheme] = useState<"light" | "dark" | "system">("light");
  const [finesEnabled, setFinesEnabled] = useState(false);

  const handleComplete = () => {
    updatePreferences({
      onboardingComplete: true,
      libraryName: libName.trim(),
      operatorName: operator.trim(),
      locale,
      theme,
      finesEnabled
    });
    
    // Set system language and directionality
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    
    navigate("/dashboard");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F9F8F4] dark:bg-[#111d1a] px-4 py-8">
      <div className="max-w-2xl w-full bg-white dark:bg-[#1d2926] p-8 md:p-10 rounded-2xl border border-black/5 dark:border-white/5 shadow-card flex flex-col">
        {/* Brand */}
        <div className="flex items-center gap-3 mb-8 pb-6 border-b border-black/5 dark:border-white/5">
          <div className="w-12 h-12 bg-emerald rounded-xl flex items-center justify-center shadow-inner">
            <img src="/brand/warraq-symbol-cream.png" className="h-8 w-8 object-contain" alt="" />
          </div>
          <div>
            <strong className="block text-[18px] font-bold text-[#122222] dark:text-white tracking-widest uppercase font-display">WARRAQ</strong>
            <span className="text-[11px] text-[#122222]/50 dark:text-white/50 tracking-wider uppercase font-semibold">Library Management System</span>
          </div>
        </div>
        
        {/* Title */}
        <div className="mb-8">
          <h1 className="font-display text-[26px] font-bold text-[#122222] dark:text-white leading-tight">{t("onboarding.welcome")}</h1>
          <p className="text-[14px] text-[#122222]/60 dark:text-white/60 mt-1">{t("onboarding.subtitle")}</p>
        </div>
        
        {/* Form fields */}
        <div className="space-y-5 flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <label className="text-[11px] font-bold text-[#122222]/60 dark:text-white/60 uppercase tracking-wider block font-semibold">
              <span>{t("onboarding.libraryName")} <span className="text-red-500">*</span></span>
              <input 
                type="text" 
                value={libName}
                onChange={(e) => setLibName(e.target.value)}
                placeholder={t("onboarding.placeholderLib")}
                className="w-full bg-[#fcfbf8] dark:bg-[#111d1a] border border-black/10 dark:border-white/10 rounded-xl py-3 px-4 text-[13px] text-[#122222] dark:text-white outline-none focus:border-emerald mt-1.5 font-semibold"
                required
              />
            </label>
            <label className="text-[11px] font-bold text-[#122222]/60 dark:text-white/60 uppercase tracking-wider block font-semibold">
              <span>{t("onboarding.operatorName")} <span className="text-red-500">*</span></span>
              <input 
                type="text" 
                value={operator}
                onChange={(e) => setOperator(e.target.value)}
                placeholder={t("onboarding.placeholderOp")}
                className="w-full bg-[#fcfbf8] dark:bg-[#111d1a] border border-black/10 dark:border-white/10 rounded-xl py-3 px-4 text-[13px] text-[#122222] dark:text-white outline-none focus:border-emerald mt-1.5 font-semibold"
                required
              />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <label className="text-[11px] font-bold text-[#122222]/60 dark:text-white/60 uppercase tracking-wider block font-semibold">
              {t("onboarding.language")}
              <select 
                value={locale}
                onChange={(e) => {
                  const val = e.target.value as "en" | "fr" | "ar";
                  setLocale(val);
                  i18n.changeLanguage(val);
                  document.documentElement.lang = val;
                  document.documentElement.dir = val === "ar" ? "rtl" : "ltr";
                }}
                className="field-select text-[13px] py-3 px-4 mt-1.5 font-semibold"
              >
                <option value="en">English (EN)</option>
                <option value="fr">Français (FR)</option>
                <option value="ar">العربية (AR)</option>
              </select>
            </label>

            <div>
              <span className="text-[11px] font-bold text-[#122222]/60 dark:text-white/60 uppercase tracking-wider block mb-1.5 font-semibold">{t("onboarding.theme")}</span>
              <div className="grid grid-cols-3 gap-2 mt-1.5">
                <button 
                  onClick={() => setTheme("light")}
                  className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 text-[12px] font-bold transition-all ${theme === 'light' ? 'border-[#b96f3e] text-[#b96f3e] bg-white dark:bg-transparent' : 'border-black/5 dark:border-white/5 bg-[#fcfbf8] dark:bg-[#111d1a] text-[#122222]/60 dark:text-white/60'}`}
                >
                  <Sun size={14} /> Light
                </button>
                <button 
                  onClick={() => setTheme("dark")}
                  className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 text-[12px] font-bold transition-all ${theme === 'dark' ? 'border-[#b96f3e] text-[#b96f3e] bg-white dark:bg-transparent' : 'border-black/5 dark:border-white/5 bg-[#fcfbf8] dark:bg-[#111d1a] text-[#122222]/60 dark:text-white/60'}`}
                >
                  <Moon size={14} /> Dark
                </button>
                <button 
                  onClick={() => setTheme("system")}
                  className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 text-[12px] font-bold transition-all ${theme === 'system' ? 'border-[#b96f3e] text-[#b96f3e] bg-white dark:bg-transparent' : 'border-black/5 dark:border-white/5 bg-[#fcfbf8] dark:bg-[#111d1a] text-[#122222]/60 dark:text-white/60'}`}
                >
                  <Laptop size={14} /> System
                </button>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <label className="flex items-start gap-3 cursor-pointer select-none p-4 rounded-xl border border-black/5 dark:border-white/5 bg-[#fcfbf8] dark:bg-[#111d1a] hover:bg-black/5 dark:hover:bg-white/5 transition-colors font-semibold">
              <input 
                type="checkbox" 
                checked={finesEnabled} 
                onChange={(e) => setFinesEnabled(e.target.checked)}
                className="mt-0.5 shrink-0"
              />
              <div>
                <strong className="block text-[13px] text-[#122222] dark:text-white font-bold">{t("onboarding.enableFines")}</strong>
                <small className="block text-[11px] text-[#122222]/50 dark:text-white/50 mt-0.5 font-normal">{t("onboarding.enableFinesHelp")}</small>
              </div>
            </label>
          </div>
        </div>

        {/* Submit */}
        <div className="mt-10 pt-6 border-t border-black/5 dark:border-white/5 flex flex-col gap-4">
          <button 
            onClick={handleComplete}
            disabled={!libName.trim() || !operator.trim()}
            className="bg-emerald text-white w-full py-4 rounded-xl font-bold text-[15px] hover:bg-emerald/90 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {t("onboarding.start")} <span>{document.documentElement.dir === "rtl" ? "←" : "→"}</span>
          </button>
          <p className="flex items-center justify-center gap-1.5 text-[11px] text-[#122222]/50 dark:text-white/50">
            <ShieldCheck size={14} className="text-emerald-600" /> {t("onboarding.security")}
          </p>
        </div>
      </div>
    </div>
  );
}
