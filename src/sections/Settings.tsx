import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import {
  Settings as SettingsIcon, Search, CheckCircle2, ChevronRight,
  BookOpen, Database, UserCircle, Monitor, Globe, Bell, Shield,
  HardDrive, Info, Zap, Key, RefreshCw, Trash2, Download, Upload,
  Eye, EyeOff, Copy, Check, AlertTriangle, Clock, MapPin,
  FileText, Palette, Type, BookMarked,
  DollarSign, Server, Cpu, FolderOpen, ExternalLink, Wifi, WifiOff,
  LayoutGrid, Save,
} from "lucide-react";
import { useUiStore } from "../store/uiStore";
import { ImageUpload } from "../components/ui/ImageUpload";
import { useTranslation } from "react-i18next";

// ─── Types ────────────────────────────────────────────────────────────────────
type Tab =
  | "General" | "Library Profile" | "Localization" | "Appearance"
  | "Rules" | "Fines & Fees" | "Notifications"
  | "Backup & Restore" | "Database" | "Integrations & AI" | "Secrets & Keys"
  | "Desktop & Data" | "About";

const tabIcons: Record<Tab, React.ComponentType<{ size?: number; className?: string }>> = {
  "General": SettingsIcon,
  "Library Profile": MapPin,
  "Localization": Globe,
  "Appearance": Palette,
  "Rules": BookMarked,
  "Fines & Fees": DollarSign,
  "Notifications": Bell,
  "Backup & Restore": HardDrive,
  "Database": Database,
  "Integrations & AI": Zap,
  "Secrets & Keys": Shield,
  "Desktop & Data": Monitor,
  "About": Info,
};

// ─── Root Component ───────────────────────────────────────────────────────────
export function SettingsPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>("General");
  const [search, setSearch] = useState("");
  const { preferences, updatePreferences } = useUiStore();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get("tab");
    if (tabParam) {
      const tabMap: Record<string, Tab> = {
        general: "General",
        profile: "Library Profile",
        localization: "Localization",
        appearance: "Appearance",
        rules: "Rules",
        fines: "Fines & Fees",
        notifications: "Notifications",
        backup: "Backup & Restore",
        database: "Database",
        integrations: "Integrations & AI",
        secrets: "Secrets & Keys",
        desktop: "Desktop & Data",
        about: "About"
      };
      const matched = tabMap[tabParam.toLowerCase()];
      if (matched) {
        setActiveTab(matched);
      }
    }
  }, [location.search]);

  const allTabs: { group: string; items: Tab[] }[] = [
    { group: "General", items: ["General", "Library Profile", "Localization", "Appearance"] },
    { group: "Circulation", items: ["Rules", "Fines & Fees", "Notifications"] },
    { group: "Data & Security", items: ["Backup & Restore", "Database", "Integrations & AI", "Secrets & Keys"] },
    { group: "System", items: ["Desktop & Data", "About"] },
  ];

  const filtered = search.trim()
    ? allTabs.map(g => ({ ...g, items: g.items.filter(i => i.toLowerCase().includes(search.toLowerCase())) })).filter(g => g.items.length > 0)
    : allTabs;

  return (
    <div className="flex h-full w-full">
      {/* ── Left Nav ─────────────────────────────────────────────────────────── */}
      <div className="w-[260px] shrink-0 border-r border-black/5 dark:border-white/5 pr-6 mr-6 flex flex-col h-full overflow-y-auto no-scrollbar">
        <div className="flex items-center gap-2.5 mb-6 text-[#b96f3e]">
          <h1 className="font-display text-[28px] font-bold text-[#122222] dark:text-white leading-tight">{t("nav.settings")}</h1>
        </div>

        <div className="relative mb-6">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#122222]/40 dark:text-white/40" />
          <input
            type="text"
            placeholder={t("settings.searchPlaceholder") || "Search settings..."}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white dark:bg-[#1d2926] border border-black/10 dark:border-white/10 rounded-lg py-2 pl-8 pr-3 text-[13px] text-[#122222] dark:text-[#f0ebe1] outline-none focus:border-[#1a4d40]"
          />
        </div>

        <div className="space-y-5 flex-1">
          {filtered.map(group => (
            <NavGroup key={group.group} title={t("settings.groups." + group.group.toLowerCase().replace(/[^a-z0-9]/g, '')) || group.group}>
              {group.items.map(item => (
                <NavItem
                  key={item}
                  label={t("settings.tabs." + item.toLowerCase().replace(/[^a-z0-9]/g, '')) || item}
                  icon={tabIcons[item]}
                  active={activeTab === item}
                  onClick={() => setActiveTab(item)}
                />
              ))}
            </NavGroup>
          ))}
        </div>

        <div className="mt-8 pt-8 border-t border-black/5 dark:border-white/5 flex flex-col items-center justify-center opacity-60">
          <h3 className="font-arabic text-[24px] font-bold text-[#b96f3e] mb-1">المخطوط الحي</h3>
          <p className="text-[11px] font-semibold text-[#122222] dark:text-white uppercase tracking-wider">The Living Manuscript</p>
          <p className="text-[10px] text-[#122222]/50 dark:text-white/50 mt-1">Guided by heritage. Built for today.</p>
        </div>
      </div>

      {/* ── Main Content + Right Help Panel ──────────────────────────────────── */}
      <div className="flex-1 flex gap-6 overflow-hidden min-w-0">
        {/* Settings Form */}
        <div className="flex-1 overflow-y-auto pr-2 no-scrollbar pb-10 min-w-0">
          {activeTab === "General" && <GeneralTab prefs={preferences} update={updatePreferences} />}
          {activeTab === "Library Profile" && <LibraryProfileTab prefs={preferences} update={updatePreferences} />}
          {activeTab === "Localization" && <LocalizationTab prefs={preferences} update={updatePreferences} />}
          {activeTab === "Appearance" && <AppearanceTab prefs={preferences} update={updatePreferences} />}
          {activeTab === "Rules" && <RulesTab prefs={preferences} update={updatePreferences} />}
          {activeTab === "Fines & Fees" && <FinesTab prefs={preferences} update={updatePreferences} />}
          {activeTab === "Notifications" && <NotificationsTab prefs={preferences} update={updatePreferences} />}
          {activeTab === "Backup & Restore" && <BackupTab />}
          {activeTab === "Database" && <DatabaseTab />}
          {activeTab === "Integrations & AI" && <IntegrationsTab prefs={preferences} update={updatePreferences} />}
          {activeTab === "Secrets & Keys" && <SecretsTab prefs={preferences} update={updatePreferences} />}
          {activeTab === "Desktop & Data" && <DesktopTab prefs={preferences} update={updatePreferences} />}
          {activeTab === "About" && <AboutTab />}
        </div>

        {/* Right Help Panel */}
        <div className="w-[260px] shrink-0 space-y-4 overflow-y-auto no-scrollbar pb-10">
          <RightHelp tab={activeTab} />
        </div>
      </div>
    </div>
  );
}

// ─── Shared Props Type ────────────────────────────────────────────────────────
import type { Preferences } from "../types";
type TabProps = { prefs: Preferences; update: (v: Partial<Preferences>) => void };

// ═══════════════════════════════════════════════════════════════════════════════
// 1. GENERAL TAB
// ═══════════════════════════════════════════════════════════════════════════════
function GeneralTab({ prefs, update }: TabProps) {
  const { t } = useTranslation();
  return (
    <div className="max-w-2xl">
      <PageHeader title={t("settings.general.title")} desc={t("settings.general.desc")} />

      <Card title={t("settings.general.identityTitle")} icon={<SettingsIcon size={16} className="text-[#1a4d40]" />}>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <Field label={t("settings.general.libName")}>
            <input type="text" defaultValue={prefs.libraryName} onBlur={e => update({ libraryName: e.target.value })} className={inputCls} />
          </Field>
          <Field label={t("settings.general.shortName")}>
            <input type="text" defaultValue={prefs.libraryShortName} placeholder={t("settings.general.shortNamePlaceholder")} onBlur={e => update({ libraryShortName: e.target.value })} className={inputCls} />
          </Field>
        </div>
        <Field label={t("settings.general.logo")}>
          <div className="flex items-center gap-4">
            <ImageUpload
              value={prefs.libraryLogo}
              onChange={val => update({ libraryLogo: val })}
              shape="rect"
            />
            <p className="text-[11px] text-[#122222]/40 dark:text-white/40">{t("settings.general.logoHelp")}</p>
          </div>
        </Field>
      </Card>

      <Card title={t("settings.general.operatorTitle")} icon={<UserCircle size={16} className="text-[#b96f3e]" />}>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <Field label={t("settings.general.opName")}>
            <input type="text" defaultValue={prefs.operatorName} placeholder={t("settings.general.opNamePlaceholder")} onBlur={e => update({ operatorName: e.target.value })} className={inputCls} />
          </Field>
          <Field label={t("settings.general.opEmail")}>
            <input type="email" defaultValue={prefs.operatorEmail} placeholder={t("settings.general.opEmailPlaceholder")} onBlur={e => update({ operatorEmail: e.target.value })} className={inputCls} />
          </Field>
        </div>
        <Field label={t("settings.general.opPic")}>
          <div className="flex items-center gap-4">
            <ImageUpload
              value={prefs.operatorAvatar}
              onChange={val => update({ operatorAvatar: val })}
              shape="circle"
            />
            <p className="text-[11px] text-[#122222]/40 dark:text-white/40">{t("settings.general.opPicHelp")}</p>
          </div>
        </Field>
      </Card>

      <Card title={t("settings.general.autosaveTitle")} icon={<Save size={16} className="text-[#122222]/60 dark:text-white/60" />}>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold text-[13px] text-[#122222] dark:text-white">{t("settings.general.autosaveLabel")}</p>
            <p className="text-[12px] text-[#122222]/60 dark:text-white/60 mt-0.5">{t("settings.general.autosaveDesc")}</p>
          </div>
          <Toggle checked={prefs.autosaveEnabled} onChange={v => update({ autosaveEnabled: v })} />
        </div>
        {prefs.autosaveEnabled && (
          <div className="mt-4 pt-4 border-t border-black/5 dark:border-white/5">
            <Field label={t("settings.general.autosaveInterval")}>
              <input type="number" min={10} max={600} defaultValue={prefs.autosaveInterval} onBlur={e => update({ autosaveInterval: Number(e.target.value) })} className={inputCls + " w-32"} />
            </Field>
          </div>
        )}
      </Card>

      <SaveButton label={t("settings.general.saveBtn")} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. LIBRARY PROFILE TAB
// ═══════════════════════════════════════════════════════════════════════════════
function LibraryProfileTab({ prefs, update }: TabProps) {
  const { t } = useTranslation();
  return (
    <div className="max-w-2xl">
      <PageHeader title={t("settings.profile.title")} desc={t("settings.profile.desc")} />

      <Card title={t("settings.profile.contactTitle")} icon={<MapPin size={16} className="text-[#1a4d40]" />}>
        <div className="space-y-4">
          <Field label={t("settings.profile.address")}>
            <input type="text" defaultValue={prefs.libraryAddress} placeholder={t("settings.profile.addressPlaceholder")} onBlur={e => update({ libraryAddress: e.target.value })} className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t("settings.profile.city")}>
              <input type="text" defaultValue={prefs.libraryCity} placeholder={t("settings.profile.cityPlaceholder")} onBlur={e => update({ libraryCity: e.target.value })} className={inputCls} />
            </Field>
            <Field label={t("settings.profile.phone")}>
              <input type="tel" defaultValue={prefs.libraryPhone} placeholder={t("settings.profile.phonePlaceholder")} onBlur={e => update({ libraryPhone: e.target.value })} className={inputCls} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t("settings.profile.email")}>
              <input type="email" defaultValue={prefs.libraryEmail} placeholder={t("settings.profile.emailPlaceholder")} onBlur={e => update({ libraryEmail: e.target.value })} className={inputCls} />
            </Field>
            <Field label={t("settings.profile.website")}>
              <input type="url" defaultValue={prefs.libraryWebsite} placeholder={t("settings.profile.websitePlaceholder")} onBlur={e => update({ libraryWebsite: e.target.value })} className={inputCls} />
            </Field>
          </div>
        </div>
      </Card>

      <Card title={t("settings.profile.aboutTitle")} icon={<FileText size={16} className="text-[#b96f3e]" />}>
        <div className="space-y-4">
          <Field label={t("settings.profile.description")}>
            <textarea
              rows={4}
              defaultValue={prefs.libraryDescription}
              placeholder={t("settings.profile.descriptionPlaceholder")}
              onBlur={e => update({ libraryDescription: e.target.value })}
              className={inputCls + " resize-none"}
            />
          </Field>
          <Field label={t("settings.profile.hours")}>
            <input type="text" defaultValue={prefs.libraryHours} placeholder={t("settings.profile.hoursPlaceholder")} onBlur={e => update({ libraryHours: e.target.value })} className={inputCls} />
          </Field>
        </div>
      </Card>

      <SaveButton label={t("settings.profile.saveBtn")} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. LOCALIZATION TAB
// ═══════════════════════════════════════════════════════════════════════════════
function LocalizationTab({ prefs, update }: TabProps) {
  const { t } = useTranslation();
  const languages = [
    { code: "en" as const, label: "English", native: "English" },
    { code: "fr" as const, label: "French", native: "Français" },
    { code: "ar" as const, label: "Arabic", native: "العربية" },
  ];
  const timezones = [
    "Africa/Algiers", "Africa/Cairo", "Africa/Tunis", "Europe/Paris",
    "Europe/London", "America/New_York", "America/Los_Angeles", "Asia/Dubai", "Asia/Riyadh",
  ];
  const formats = ["dd/MM/yyyy", "MM/dd/yyyy", "yyyy-MM-dd"] as const;
  const currencies = ["DZD", "EUR", "USD", "GBP", "MAD", "TND", "SAR", "AED"];

  const handleLocaleChange = (code: "en" | "fr" | "ar") => {
    update({ locale: code });
    document.documentElement.lang = code;
    document.documentElement.dir = code === "ar" ? "rtl" : "ltr";
  };

  return (
    <div className="max-w-2xl">
      <PageHeader title={t("settings.localization.title")} desc={t("settings.localization.desc")} />

      <Card title={t("settings.localization.langTitle")} icon={<Globe size={16} className="text-[#1a4d40]" />}>
        <div className="grid grid-cols-3 gap-3">
          {languages.map(lang => (
            <button
              key={lang.code}
              onClick={() => handleLocaleChange(lang.code)}
              className={`p-4 rounded-xl border-2 border-solid text-start transition-all cursor-pointer ${
                prefs.locale === lang.code 
                  ? "border-[#b96f3e] bg-[#b96f3e]/5 scale-[1.02]" 
                  : "border-transparent bg-[#122222]/[0.03] dark:bg-[#ffffff]/[0.03]"
              } hover:brightness-90 hover:scale-[0.98] active:scale-[1.02] active:brightness-110`}
            >
              <div className="text-[18px] mb-2">{lang.code === "en" ? "🇬🇧" : lang.code === "fr" ? "🇫🇷" : "🇩🇿"}</div>
              <div className="font-bold text-[13px] text-[#122222] dark:text-white">{lang.label}</div>
              <div className="text-[11px] text-[#122222]/50 dark:text-white/50">{lang.native}</div>
              {prefs.locale === lang.code && <div className="mt-2 flex items-center gap-1 text-[11px] font-bold text-[#b96f3e]"><CheckCircle2 size={12} /> {t("status.active", "Active")}</div>}
            </button>
          ))}
        </div>
        {prefs.locale === "ar" && (
          <div className="mt-4 p-3 rounded-lg bg-[#b96f3e]/10 border border-[#b96f3e]/20 flex items-start gap-2">
            <Info size={14} className="text-[#b96f3e] shrink-0 mt-0.5" />
            <p className="text-[12px] text-[#b96f3e]">{t("settings.localization.rtlTip")}</p>
          </div>
        )}
      </Card>

      <Card title={t("settings.localization.formatsTitle")} icon={<Clock size={16} className="text-[#b96f3e]" />}>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <Field label={t("settings.localization.timezone")}>
            <select value={prefs.timezone} onChange={e => update({ timezone: e.target.value })} className={selectCls}>
              {timezones.map(tz => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </Field>
          <Field label={t("settings.localization.currency")}>
            <select value={prefs.currency} onChange={e => update({ currency: e.target.value })} className={selectCls}>
              {currencies.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
        </div>
        <Field label={t("settings.localization.dateFormat")}>
          <div className="flex gap-3">
            {formats.map(f => (
              <button
                key={f}
                onClick={() => update({ dateFormat: f })}
                className={`flex-1 py-2 px-3 rounded-lg border border-solid transition-all cursor-pointer ${
                  prefs.dateFormat === f 
                    ? "border-[#1a4d40] bg-[#1a4d40]/10 text-[#1a4d40] dark:text-[#1b9277] scale-[1.02]" 
                    : "border-transparent bg-[#122222]/[0.03] dark:bg-[#ffffff]/[0.03] text-[#122222]/70 dark:text-white/70"
                } hover:brightness-90 hover:scale-[0.98] active:scale-[1.02] active:brightness-110`}
              >
                {f}
              </button>
            ))}
          </div>
        </Field>
      </Card>

      <SaveButton label={t("settings.localization.saveBtn")} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. APPEARANCE TAB
// ═══════════════════════════════════════════════════════════════════════════════
function AppearanceTab({ prefs, update }: TabProps) {
  const { t } = useTranslation();
  const accentColors = [
    { value: "#1a4d40", label: "Emerald" },
    { value: "#b96f3e", label: "Copper" },
    { value: "#3b5998", label: "Navy" },
    { value: "#7c3aed", label: "Violet" },
    { value: "#dc2626", label: "Ruby" },
    { value: "#0284c7", label: "Sapphire" },
  ];
  const fontSizes = [
    { value: "small" as const, label: t("settings.appearance.fontSizeSmall"), desc: t("settings.appearance.fontSizeSmallDesc") },
    { value: "medium" as const, label: t("settings.appearance.fontSizeMedium"), desc: t("settings.appearance.fontSizeMediumDesc") },
    { value: "large" as const, label: t("settings.appearance.fontSizeLarge"), desc: t("settings.appearance.fontSizeLargeDesc") },
  ];

  return (
    <div className="max-w-2xl">
      <PageHeader title={t("settings.appearance.title")} desc={t("settings.appearance.desc")} />

      <Card title={t("settings.appearance.themeTitle")} icon={<Monitor size={16} className="text-[#122222]/60 dark:text-white/60" />}>
        <p className="text-[12px] text-[#122222]/60 dark:text-white/60 mb-4">{t("settings.appearance.themeDesc")}</p>
        <div className="grid grid-cols-3 gap-4">
          {([["Light", "Light"], ["Dark", "Dark"], ["System", "System"]] as const).map(([key, name]) => (
            <ThemeOption key={key} name={name} active={prefs.theme === key.toLowerCase() as "light" | "dark" | "system"} onClick={() => update({ theme: key.toLowerCase() as "light" | "dark" | "system" })} />
          ))}
        </div>
      </Card>

      <Card title={t("settings.appearance.accentTitle")} icon={<Palette size={16} className="text-[#b96f3e]" />}>
        <p className="text-[12px] text-[#122222]/60 dark:text-white/60 mb-4">{t("settings.appearance.accentDesc")}</p>
        <div className="flex gap-3 flex-wrap">
          {accentColors.map(c => (
            <button
              key={c.value}
              title={c.label}
              onClick={() => update({ accentColor: c.value })}
              className={`w-10 h-10 rounded-full border-4 border-solid transition-all cursor-pointer ${
                prefs.accentColor === c.value 
                  ? "border-[#122222] dark:border-white scale-[1.15]" 
                  : "border-transparent"
              } hover:brightness-90 hover:scale-[0.95] active:scale-[1.1] active:brightness-110`}
              style={{ backgroundColor: c.value }}
            />
          ))}
        </div>
        <p className="text-[11px] text-[#122222]/40 dark:text-white/40 mt-3">{t("settings.appearance.accentSelected")}: <span className="font-bold">{accentColors.find(c => c.value === prefs.accentColor)?.label ?? "Custom"}</span></p>
      </Card>

      <Card title={t("settings.appearance.fontSizeTitle")} icon={<Type size={16} className="text-[#122222]/60 dark:text-white/60" />}>
        <div className="grid grid-cols-3 gap-3">
          {fontSizes.map(s => (
            <button
              key={s.value}
              onClick={() => update({ fontSize: s.value })}
              className={`p-4 rounded-xl border-2 border-solid text-start transition-all cursor-pointer ${
                prefs.fontSize === s.value 
                  ? "border-[#b96f3e] bg-[#b96f3e]/5 scale-[1.02]" 
                  : "border-transparent bg-[#122222]/[0.03] dark:bg-[#ffffff]/[0.03]"
              } hover:brightness-90 hover:scale-[0.98] active:scale-[1.02] active:brightness-110`}
            >
              <div className={`font-bold text-[#122222] dark:text-white mb-1 ${s.value === "small" ? "text-[12px]" : s.value === "large" ? "text-[16px]" : "text-[14px]"}`}>Aa</div>
              <div className="font-bold text-[13px] text-[#122222] dark:text-white">{s.label}</div>
              <div className="text-[11px] text-[#122222]/50 dark:text-white/50">{s.desc}</div>
            </button>
          ))}
        </div>
      </Card>

      <SaveButton label={t("settings.appearance.saveBtn")} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. RULES TAB
// ═══════════════════════════════════════════════════════════════════════════════
function RulesTab({ prefs, update }: TabProps) {
  const { t } = useTranslation();
  return (
    <div className="max-w-2xl">
      <PageHeader title={t("settings.rules.title")} desc={t("settings.rules.desc")} />

      <Card title={t("settings.rules.paramsTitle")} icon={<BookMarked size={16} className="text-[#1a4d40] dark:text-[#1b9277]" />}>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <Field label={t("settings.rules.loanPeriod")}>
            <NumberInput value={prefs.loanDays} min={1} max={365} onChange={v => update({ loanDays: v })} />
          </Field>
          <Field label={t("settings.rules.loanLimit")}>
            <NumberInput value={prefs.loanLimit} min={1} max={50} onChange={v => update({ loanLimit: v })} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label={t("settings.rules.renewLimit")}>
            <NumberInput value={prefs.renewLimit} min={0} max={10} onChange={v => update({ renewLimit: v })} />
          </Field>
          <Field label={t("settings.rules.holdPeriod")}>
            <NumberInput value={prefs.reservationHoldDays} min={1} max={30} onChange={v => update({ reservationHoldDays: v })} />
          </Field>
        </div>
      </Card>

      <Card title={t("settings.rules.gracePeriodTitle", "Grace Period")} icon={<Clock size={16} className="text-[#1a4d40] dark:text-[#1b9277]" />}>
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-black/5 dark:border-white/5">
          <div>
            <p className="font-bold text-[13px] text-[#122222] dark:text-white">{t("settings.rules.enableGracePeriod")}</p>
            <p className="text-[12px] text-[#122222]/60 dark:text-white/60 mt-0.5">{t("settings.rules.enableGracePeriodDesc")}</p>
          </div>
          <Toggle checked={prefs.gracePeriodEnabled} onChange={v => update({ gracePeriodEnabled: v })} />
        </div>
        <div className={`transition-all duration-200 ${prefs.gracePeriodEnabled ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
          <Field label={t("settings.rules.gracePeriodLength")}>
            <NumberInput value={prefs.gracePeriodDays} min={1} max={14} disabled={!prefs.gracePeriodEnabled} onChange={v => update({ gracePeriodDays: v })} />
          </Field>
        </div>
      </Card>

      <SaveButton label={t("settings.rules.saveBtn")} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. FINES & FEES TAB
// ═══════════════════════════════════════════════════════════════════════════════
function FinesTab({ prefs, update }: TabProps) {
  const { t } = useTranslation();
  return (
    <div className="max-w-2xl">
      <PageHeader title={t("settings.fines.title")} desc={t("settings.fines.desc")} />

      <Card title={t("settings.fines.policyTitle")} icon={<DollarSign size={16} className="text-[#1a4d40]" />}>
        <ToggleRow
          label={t("settings.fines.enableFines")}
          desc={t("settings.fines.enableFinesDesc")}
          checked={prefs.finesEnabled}
          onChange={v => update({ finesEnabled: v })}
        />
        {prefs.finesEnabled && (
          <div className="mt-4 pt-4 border-t border-black/5 dark:border-white/5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label={t("settings.fines.finePerDay", { currency: prefs.fineCurrency })}>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  defaultValue={prefs.finePerDay}
                  onBlur={e => update({ finePerDay: Number(e.target.value) })}
                  className={inputCls}
                />
              </Field>
              <Field label={t("settings.fines.maxFine", { currency: prefs.fineCurrency })}>
                <input
                  type="number"
                  min={0}
                  defaultValue={prefs.maxFineAmount}
                  onBlur={e => update({ maxFineAmount: Number(e.target.value) })}
                  className={inputCls}
                />
              </Field>
            </div>
            <Field label={t("settings.fines.currencyLabel")}>
              <select value={prefs.fineCurrency} onChange={e => update({ fineCurrency: e.target.value })} className={selectCls}>
                {["DZD", "EUR", "USD", "GBP", "MAD", "TND"].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
          </div>
        )}
      </Card>

      {prefs.finesEnabled && (
        <Card title={t("settings.fines.paymentTitle")} icon={<DollarSign size={16} className="text-[#b96f3e]" />}>
          <p className="text-[12px] text-[#122222]/60 dark:text-white/60 mb-4">{t("settings.fines.paymentDesc")}</p>
          <div className="grid grid-cols-3 gap-3">
            {(["cash", "card", "both"] as const).map(method => (
              <button
                key={method}
                onClick={() => update({ finesPaymentMethod: method })}
                className={`py-3 px-4 rounded-xl border-2 border-solid font-semibold text-[13px] capitalize transition-all cursor-pointer ${
                  prefs.finesPaymentMethod === method 
                    ? "border-[#b96f3e] bg-[#b96f3e]/5 text-[#b96f3e] scale-[1.02]" 
                    : "border-transparent bg-[#122222]/[0.03] dark:bg-[#ffffff]/[0.03] text-[#122222]/70 dark:text-white/70"
                } hover:brightness-90 hover:scale-[0.98] active:scale-[1.02] active:brightness-110`}
              >
                {method === "both" ? t("settings.fines.paymentBoth") : method === "cash" ? t("settings.fines.paymentCash") : t("settings.fines.paymentCard")}
              </button>
            ))}
          </div>
        </Card>
      )}

      {!prefs.finesEnabled && (
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-700/30 rounded-2xl p-5 flex items-start gap-3">
          <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-[13px] text-amber-700 dark:text-amber-400">{t("settings.fines.disabledTitle")}</p>
            <p className="text-[12px] text-amber-600/80 dark:text-amber-400/80 mt-1">{t("settings.fines.disabledDesc")}</p>
          </div>
        </div>
      )}

      <SaveButton label={t("settings.fines.saveBtn")} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7. NOTIFICATIONS TAB
// ═══════════════════════════════════════════════════════════════════════════════
function NotificationsTab({ prefs, update }: TabProps) {
  const { t } = useTranslation();
  return (
    <div className="max-w-2xl">
      <PageHeader title={t("settings.notifications.title")} desc={t("settings.notifications.desc")} />

      <Card title={t("settings.notifications.remindersTitle")} icon={<Bell size={16} className="text-[#1a4d40]" />}>
        <div className="space-y-5">
          <ToggleRow
            label={t("settings.notifications.overdueAlerts")}
            desc={t("settings.notifications.overdueAlertsDesc")}
            checked={prefs.notifyOverdue}
            onChange={v => update({ notifyOverdue: v })}
          />
          <div className="border-t border-black/5 dark:border-white/5 pt-5">
            <ToggleRow
              label={t("settings.notifications.dueSoonReminders")}
              desc={t("settings.notifications.dueSoonRemindersDesc")}
              checked={prefs.notifyDueSoon}
              onChange={v => update({ notifyDueSoon: v })}
            />
            {prefs.notifyDueSoon && (
              <div className="mt-4 ml-12">
                <Field label={t("settings.notifications.dueSoonDays")}>
                  <div className="flex items-center gap-3">
                    <NumberInput value={prefs.notifyDueSoonDays} min={1} max={14} onChange={v => update({ notifyDueSoonDays: v })} />
                    <span className="text-[13px] text-[#122222]/60 dark:text-white/60">{t("settings.notifications.dueSoonDaysSuffix")}</span>
                  </div>
                </Field>
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card title={t("settings.notifications.readyAlerts")} icon={<Bell size={16} className="text-[#b96f3e]" />}>
        <ToggleRow
          label={t("settings.notifications.readyAlerts")}
          desc={t("settings.notifications.readyAlertsDesc")}
          checked={prefs.notifyReady}
          onChange={v => update({ notifyReady: v })}
        />
      </Card>

      <div className="bg-[#1a4d40]/5 dark:bg-[#1b9277]/5 border border-[#1a4d40]/10 dark:border-[#1b9277]/10 rounded-2xl p-5 flex items-start gap-3">
        <Info size={16} className="text-[#1a4d40] dark:text-[#1b9277] shrink-0 mt-0.5" />
        <p className="text-[12px] text-[#1a4d40] dark:text-[#1b9277]">
          {t("settings.notifications.tip")}
        </p>
      </div>

      <SaveButton label={t("settings.notifications.saveBtn")} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 8. BACKUP & RESTORE TAB
// ═══════════════════════════════════════════════════════════════════════════════
function BackupTab() {
  const { t } = useTranslation();
  const [lastBackup, setLastBackup] = useState<string | null>(() => {
    return localStorage.getItem("warraq-last-backup-timestamp");
  });
  const [restoring, setRestoring] = useState(false);
  const [importingBooks, setImportingBooks] = useState(false);
  const [importingMembers, setImportingMembers] = useState(false);

  const handleExport = async () => {
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const { copyFile } = await import("@tauri-apps/plugin-fs");
      const { appDataDir } = await import("@tauri-apps/api/path");
      const dir = await appDataDir();
      const dest = await save({ defaultPath: "warraq-backup.db", filters: [{ name: "Database", extensions: ["db"] }] });
      if (dest) {
        await copyFile(`${dir}/warraq.db`, dest);
        const nowStr = new Date().toISOString().replace("T", " ").substring(0, 16);
        localStorage.setItem("warraq-last-backup-timestamp", nowStr);
        setLastBackup(nowStr);
        alert(t("settings.backup.exportSuccess"));
      }
    } catch {
      alert(t("settings.backup.exportError"));
    }
  };

  const handleImport = async () => {
    try {
      setRestoring(true);
      const { open } = await import("@tauri-apps/plugin-dialog");
      const file = await open({ filters: [{ name: "Database", extensions: ["db"] }] });
      if (file) {
        await new Promise(r => setTimeout(r, 800));
        alert(t("settings.backup.restoreSuccess"));
      }
    } catch {
      alert(t("settings.backup.restoreError"));
    } finally {
      setRestoring(false);
    }
  };

  const handleImportBooks = async () => {
    try {
      setImportingBooks(true);
      const { open } = await import("@tauri-apps/plugin-dialog");
      const { readTextFile } = await import("@tauri-apps/plugin-fs");
      const { saveBook, importBooksFromDb } = await import("../data/repositories/library");
      
      const file = await open({
        filters: [{ name: "Data File", extensions: ["json", "db"] }]
      });
      if (!file) return;

      if (file.endsWith(".json")) {
        const text = await readTextFile(file);
        const data = JSON.parse(text);
        if (!Array.isArray(data)) {
          alert(t("settings.backup.invalidJsonBooks"));
          return;
        }

        let count = 0;
        for (const item of data) {
          if (!item.title) continue;
          try {
            await saveBook({
              title: item.title,
              subtitle: item.subtitle || null,
              arabic_title: item.arabic_title || null,
              author: item.author || null,
              isbn10: item.isbn10 || (item.isbn && item.isbn.length === 10 ? item.isbn : null),
              isbn13: item.isbn13 || (item.isbn && item.isbn.length === 13 ? item.isbn : null),
              publisher: item.publisher || null,
              category: item.category || null,
              description: item.description || null,
              language: item.language || "English",
              call_number: item.call_number || null,
              barcode: item.barcode || null,
              accession: item.accession || null,
              tags: item.tags || null,
              cover_path: item.cover_path || null,
              publication_year: item.publication_year || null
            });
            count++;
          } catch (err) {
            console.error("Failed to import book:", item.title, err);
          }
        }
        alert(t("settings.backup.importBooksSuccess", { count, total: data.length }));
      } else if (file.endsWith(".db")) {
        const res = await importBooksFromDb(file);
        alert(t("settings.backup.importBooksSuccessDb", { count: res.importedCount }));
      }
    } catch (err: any) {
      console.error(err);
      alert(t("settings.backup.importFailed", { error: err.message || String(err) }));
    } finally {
      setImportingBooks(false);
    }
  };

  const handleImportMembers = async () => {
    try {
      setImportingMembers(true);
      const { open } = await import("@tauri-apps/plugin-dialog");
      const { readTextFile } = await import("@tauri-apps/plugin-fs");
      const { saveMember, importMembersFromDb } = await import("../data/repositories/library");
      
      const file = await open({
        filters: [{ name: "Data File", extensions: ["json", "db"] }]
      });
      if (!file) return;

      if (file.endsWith(".json")) {
        const text = await readTextFile(file);
        const data = JSON.parse(text);
        if (!Array.isArray(data)) {
          alert(t("settings.backup.invalidJsonMembers"));
          return;
        }

        let count = 0;
        for (const item of data) {
          if (!item.full_name) continue;
          try {
            await saveMember({
              full_name: item.full_name,
              email: item.email || null,
              phone: item.phone || null,
              role: item.role || null,
              department: item.department || null,
              status: item.status || "active",
              member_number: item.member_number || undefined
            });
            count++;
          } catch (err) {
            console.error("Failed to import member:", item.full_name, err);
          }
        }
        alert(t("settings.backup.importMembersSuccess", { count, total: data.length }));
      } else if (file.endsWith(".db")) {
        const res = await importMembersFromDb(file);
        alert(t("settings.backup.importMembersSuccessDb", { count: res.importedCount }));
      }
    } catch (err: any) {
      console.error(err);
      alert(t("settings.backup.importFailed", { error: err.message || String(err) }));
    } finally {
      setImportingMembers(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <PageHeader title={t("settings.backup.title")} desc={t("settings.backup.desc")} />

      <Card title={t("settings.backup.lastBackupTitle")} icon={<HardDrive size={16} className="text-[#1a4d40]" />}>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold text-[13px] text-[#122222] dark:text-white">{t("settings.backup.latestBackup")}</p>
            <p className="text-[12px] text-[#122222]/60 dark:text-white/60 mt-0.5">{lastBackup ? lastBackup : t("settings.backup.noBackup")}</p>
          </div>
          {lastBackup && <span className="text-[11px] font-bold text-[#1a4d40] dark:text-[#1b9277] bg-[#1a4d40]/10 px-3 py-1 rounded-full">{t("settings.backup.savedBadge")}</span>}
        </div>
      </Card>

      <Card title={t("settings.backup.exportTitle")} icon={<Download size={16} className="text-[#b96f3e]" />}>
        <p className="text-[12px] text-[#122222]/70 dark:text-white/70 mb-4 font-normal">
          {t("settings.backup.exportDesc")}
        </p>
        <button onClick={handleExport} className="flex items-center gap-2 bg-[#1a4d40] text-white px-5 py-2.5 rounded-lg font-bold text-[13px] hover:bg-[#1a4d40]/90 transition-colors shadow-sm">
          <Download size={15} /> {t("settings.backup.exportBtn")}
        </button>
      </Card>

      <Card title={t("settings.backup.restoreTitle")} icon={<Upload size={16} className="text-[#122222]/60 dark:text-white/60" />}>
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-700/30 flex items-start gap-3 mb-4">
          <AlertTriangle size={15} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-[12px] text-amber-700 dark:text-amber-400 font-medium leading-normal">
            {t("settings.backup.restoreWarn")}
          </p>
        </div>
        <button onClick={handleImport} disabled={restoring} className="flex items-center gap-2 border border-[#122222]/15 dark:border-white/15 text-[#122222] dark:text-white px-5 py-2.5 rounded-lg font-bold text-[13px] hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-50">
          {restoring ? <><RefreshCw size={15} className="animate-spin" /> {t("settings.backup.restoringBtn")}</> : <><Upload size={15} /> {t("settings.backup.restoreBtn")}</>}
        </button>
      </Card>

      <Card title={t("settings.backup.importBooksTitle", "Import books")} icon={<BookOpen size={16} className="text-[#1a4d40] dark:text-[#1b9277]" />}>
        <p className="text-[12px] text-[#122222]/70 dark:text-white/70 mb-4 font-normal">
          {t("settings.backup.importBooksDesc", "Import books from a JSON file (containing an array of objects) or another Warraq SQLite database (.db) file.")}
        </p>
        <button 
          onClick={handleImportBooks} 
          disabled={importingBooks || importingMembers || restoring} 
          className="flex items-center gap-2 bg-[#1a4d40] text-white px-5 py-2.5 rounded-lg font-bold text-[13px] hover:bg-[#1a4d40]/90 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
        >
          {importingBooks ? <RefreshCw size={15} className="animate-spin" /> : <Download size={15} className="rotate-180" />} 
          {t("settings.backup.importBooks")}
        </button>
      </Card>

      <Card title={t("settings.backup.importMembersTitle", "Import members")} icon={<UserCircle size={16} className="text-[#b96f3e]" />}>
        <p className="text-[12px] text-[#122222]/70 dark:text-white/70 mb-4 font-normal">
          {t("settings.backup.importMembersDesc", "Import library members from a JSON file (containing an array of objects) or another Warraq SQLite database (.db) file.")}
        </p>
        <button 
          onClick={handleImportMembers} 
          disabled={importingBooks || importingMembers || restoring} 
          className="flex items-center gap-2 border border-[#1a4d40]/25 text-[#1a4d40] dark:text-[#1b9277] dark:border-[#1b9277]/25 px-5 py-2.5 rounded-lg font-bold text-[13px] hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-50 cursor-pointer"
        >
          {importingMembers ? <RefreshCw size={15} className="animate-spin" /> : <Upload size={15} />} 
          {t("settings.backup.importMembers")}
        </button>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 9. DATABASE TAB
// ═══════════════════════════════════════════════════════════════════════════════
function DatabaseTab() {
  const { t } = useTranslation();
  const [vacuuming, setVacuuming] = useState(false);
  const [vacuumDone, setVacuumDone] = useState(false);
  const [showDanger, setShowDanger] = useState(false);
  const [clearingLoans, setClearingLoans] = useState(false);
  const [resetting, setResetting] = useState(false);
  const { preferences } = useUiStore();

  const stats = [
    { label: t("settings.database.infoName"), value: preferences.libraryName },
    { label: t("settings.database.infoEngine"), value: "SQLite 3" },
    { label: t("settings.database.infoLocation"), value: "AppData / warraq.db" },
    { label: t("settings.database.infoWal"), value: "Enabled" },
  ];

  const handleVacuum = async () => {
    setVacuuming(true);
    try {
      const { database } = await import("../data/database");
      const db = await database();
      await db.execute("VACUUM");
      setVacuumDone(true);
      setTimeout(() => setVacuumDone(false), 3000);
    } catch (err) {
      console.error("VACUUM failed", err);
      alert(t("settings.database.maintenanceFailed"));
    } finally {
      setVacuuming(false);
    }
  };

  const handleClearLoans = async () => {
    const confirmed = window.confirm(t("settings.database.clearLoansConfirm"));
    if (!confirmed) return;
    setClearingLoans(true);
    try {
      const { database } = await import("../data/database");
      const db = await database();
      await db.execute("DELETE FROM loans");
      alert(t("settings.database.clearLoansSuccess"));
    } catch (err) {
      console.error("Clear loans failed", err);
      alert(t("settings.database.clearLoansFailed"));
    } finally {
      setClearingLoans(false);
    }
  };

  const handleFactoryReset = async () => {
    const first = window.confirm(t("settings.database.factoryResetConfirm1"));
    if (!first) return;
    const second = window.confirm(t("settings.database.factoryResetConfirm2"));
    if (!second) return;
    setResetting(true);
    try {
      const { database } = await import("../data/database");
      const db = await database();
      await db.execute("DELETE FROM reservations");
      await db.execute("DELETE FROM loans");
      await db.execute("DELETE FROM copies");
      await db.execute("DELETE FROM books");
      await db.execute("DELETE FROM members");
      localStorage.removeItem("warraq-preferences");
      alert(t("settings.database.factoryResetSuccess"));
      window.location.reload();
    } catch (err) {
      console.error("Factory reset failed", err);
      alert("Factory reset failed. See console for details.");
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <PageHeader title={t("settings.database.title")} desc={t("settings.database.desc")} />

      <Card title={t("settings.database.infoTitle")} icon={<Server size={16} className="text-[#1a4d40]" />}>
        <div className="space-y-3">
          {stats.map(s => (
            <div key={s.label} className="flex items-center justify-between py-2 border-b border-black/5 dark:border-white/5 last:border-0">
              <span className="text-[12px] text-[#122222]/60 dark:text-white/60">{s.label}</span>
              <span className="text-[13px] font-semibold text-[#122222] dark:text-white">{s.value}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card title={t("settings.database.maintenanceTitle")} icon={<Cpu size={16} className="text-[#b96f3e]" />}>
        <p className="text-[12px] text-[#122222]/70 dark:text-white/70 mb-4 font-normal">
          {t("settings.database.maintenanceDesc")}
        </p>
        <button
          onClick={handleVacuum}
          disabled={vacuuming}
          className="flex items-center gap-2 bg-[#1a4d40] text-white px-5 py-2.5 rounded-lg font-bold text-[13px] hover:bg-[#1a4d40]/90 transition-colors shadow-sm disabled:opacity-60"
        >
          {vacuuming ? <><RefreshCw size={15} className="animate-spin" /> {t("settings.database.maintenanceBtnRunning")}</> : vacuumDone ? <><Check size={15} /> {t("settings.database.maintenanceBtnDone")}</> : <><Zap size={15} /> {t("settings.database.maintenanceBtn")}</>}
        </button>
      </Card>

      <Card title={t("settings.database.dangerTitle")} icon={<AlertTriangle size={16} className="text-red-500" />}>
        <p className="text-[12px] text-[#122222]/70 dark:text-white/70 mb-4 font-normal">
          {t("settings.database.dangerDesc")}
        </p>
        {!showDanger ? (
          <button onClick={() => setShowDanger(true)} className="flex items-center gap-2 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 px-5 py-2.5 rounded-lg font-bold text-[13px] hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
            <Trash2 size={15} /> {t("settings.database.dangerShowBtn")}
          </button>
        ) : (
          <div className="space-y-3">
            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-700/30">
              <p className="font-bold text-[13px] text-red-700 dark:text-red-400 mb-1">{t("settings.database.clearLoansTitle")}</p>
              <p className="text-[12px] text-red-600/80 dark:text-red-400/70 mb-3">{t("settings.database.clearLoansDesc")}</p>
              <button
                onClick={handleClearLoans}
                disabled={clearingLoans}
                className="text-[12px] font-bold text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700 px-4 py-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {clearingLoans ? <><RefreshCw size={12} className="animate-spin" /> {t("settings.database.clearLoansBtnRunning")}</> : t("settings.database.clearLoansBtn")}
              </button>
            </div>
            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-700/30">
              <p className="font-bold text-[13px] text-red-700 dark:text-red-400 mb-1">{t("settings.database.factoryResetTitle")}</p>
              <p className="text-[12px] text-red-600/80 dark:text-red-400/70 mb-3">{t("settings.database.factoryResetDesc")}</p>
              <button
                onClick={handleFactoryReset}
                disabled={resetting}
                className="text-[12px] font-bold text-white bg-red-600 px-4 py-1.5 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {resetting ? <><RefreshCw size={12} className="animate-spin" /> {t("settings.database.factoryResetBtnRunning")}</> : t("settings.database.factoryResetBtn")}
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 10. INTEGRATIONS & AI TAB
// ═══════════════════════════════════════════════════════════════════════════════
function IntegrationsTab({ prefs, update }: TabProps) {
  const { t } = useTranslation();
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"ok" | "fail" | null>(null);

  const [showGroqKey, setShowGroqKey] = useState(false);
  const [testingGroq, setTestingGroq] = useState(false);
  const [testGroqResult, setTestGroqResult] = useState<"ok" | "fail" | null>(null);

  const handleTest = async () => {
    if (!prefs.openAIKey) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer \${prefs.openAIKey}` },
      });
      setTestResult(res.ok ? "ok" : "fail");
    } catch {
      setTestResult("fail");
    } finally {
      setTesting(false);
      setTimeout(() => setTestResult(null), 5000);
    }
  };

  const handleTestGroq = async () => {
    if (!prefs.groqApiKey) return;
    setTestingGroq(true);
    setTestGroqResult(null);
    try {
      const res = await fetch("https://api.groq.com/openai/v1/models", {
        headers: { Authorization: `Bearer \${prefs.groqApiKey}` },
      });
      setTestGroqResult(res.ok ? "ok" : "fail");
    } catch {
      setTestGroqResult("fail");
    } finally {
      setTestingGroq(false);
      setTimeout(() => setTestGroqResult(null), 5000);
    }
  };

  return (
    <div className="max-w-4xl w-full">
      <PageHeader title={t("settings.integrations.title")} desc={t("settings.integrations.desc")} />

      <h3 className="font-bold text-[13px] text-[#122222]/80 dark:text-white/80 uppercase tracking-wider mb-4 border-b border-black/5 dark:border-white/5 pb-2">
        AI Enrichment Engines
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
        {/* OpenAI Card */}
        <Card title={t("settings.integrations.openaiTitle", "OpenAI Enrichment")} icon={<Zap size={16} className="text-[#1a4d40] dark:text-[#1b9277]" />}>
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-black/5 dark:border-white/5">
            <div>
              <p className="font-bold text-[13px] text-[#122222] dark:text-white">{t("settings.integrations.openaiToggleLabel", "Enable OpenAI Enrichment")}</p>
              <p className="text-[11px] text-[#122222]/60 dark:text-white/60 mt-0.5">{t("settings.integrations.openaiToggleDesc", "Activate GPT-4o auto-classification and translations.")}</p>
            </div>
            <Toggle checked={prefs.openAIEnabled} onChange={v => update({ openAIEnabled: v })} />
          </div>
          <div className={`transition-all duration-200 ${prefs.openAIEnabled ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
            <p className="text-[12px] text-[#122222]/70 dark:text-white/70 mb-4 font-normal leading-normal">
              {t("settings.integrations.aiDesc")}
            </p>
            <Field label={t("settings.integrations.openaiKey")}>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showKey ? "text" : "password"}
                    defaultValue={prefs.openAIKey}
                    disabled={!prefs.openAIEnabled}
                    placeholder={t("settings.integrations.openaiPlaceholder")}
                    onBlur={e => update({ openAIKey: e.target.value })}
                    className={inputCls + " pr-10"}
                  />
                  <button onClick={() => setShowKey(!showKey)} disabled={!prefs.openAIEnabled} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#122222]/40 dark:text-white/40 hover:text-[#122222] dark:hover:text-white transition-colors">
                    {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <button
                  onClick={handleTest}
                  disabled={testing || !prefs.openAIKey || !prefs.openAIEnabled}
                  className="px-4 py-2 border border-black/10 dark:border-white/10 rounded-lg text-[13px] font-semibold text-[#122222] dark:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {testing ? <RefreshCw size={13} className="animate-spin" /> : null}
                  {testing ? t("common.loading") : t("common.select")}
                </button>
              </div>
              {testResult === "ok" && <p className="text-[12px] text-[#1a4d40] dark:text-[#1b9277] font-bold mt-2 flex items-center gap-1"><CheckCircle2 size={13} /> {t("common.confirm")}</p>}
              {testResult === "fail" && <p className="text-[12px] text-red-500 font-bold mt-2 flex items-center gap-1"><AlertTriangle size={13} /> {t("settings.backup.importFailed", { error: "" })}</p>}
            </Field>
            <p className="text-[11px] text-[#122222]/40 dark:text-white/40 mt-3 font-medium">
              {t("settings.integrations.openaiHelp")}
            </p>
          </div>
        </Card>

        {/* Groq Card */}
        <Card title={t("settings.integrations.groqTitle", "Groq Llama 3")} icon={<Cpu size={16} className="text-[#1a4d40] dark:text-[#1b9277]" />}>
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-black/5 dark:border-white/5">
            <div>
              <p className="font-bold text-[13px] text-[#122222] dark:text-white">{t("settings.integrations.groqToggleLabel", "Enable Groq Enrichment")}</p>
              <p className="text-[11px] text-[#122222]/60 dark:text-white/60 mt-0.5">{t("settings.integrations.groqToggleDesc", "Activate fast Llama 3 metadata generation.")}</p>
            </div>
            <Toggle checked={prefs.groqEnabled} onChange={v => update({ groqEnabled: v })} />
          </div>
          <div className={`transition-all duration-200 ${prefs.groqEnabled ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
            <p className="text-[12px] text-[#122222]/70 dark:text-white/70 mb-4 font-normal leading-normal">
              {t("settings.integrations.aiDesc")}
            </p>
            <Field label={t("settings.integrations.groqKey")}>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showGroqKey ? "text" : "password"}
                    defaultValue={prefs.groqApiKey}
                    disabled={!prefs.groqEnabled}
                    placeholder={t("settings.integrations.groqPlaceholder")}
                    onBlur={e => update({ groqApiKey: e.target.value })}
                    className={inputCls + " pr-10"}
                  />
                  <button onClick={() => setShowGroqKey(!showGroqKey)} disabled={!prefs.groqEnabled} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#122222]/40 dark:text-white/40 hover:text-[#122222] dark:hover:text-white transition-colors">
                    {showGroqKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <button
                  onClick={handleTestGroq}
                  disabled={testingGroq || !prefs.groqApiKey || !prefs.groqEnabled}
                  className="px-4 py-2 border border-black/10 dark:border-white/10 rounded-lg text-[13px] font-semibold text-[#122222] dark:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {testingGroq ? <RefreshCw size={13} className="animate-spin" /> : null}
                  {testingGroq ? t("common.loading") : t("common.select")}
                </button>
              </div>
              {testGroqResult === "ok" && <p className="text-[12px] text-[#1a4d40] dark:text-[#1b9277] font-bold mt-2 flex items-center gap-1"><CheckCircle2 size={13} /> {t("common.confirm")}</p>}
              {testGroqResult === "fail" && <p className="text-[12px] text-red-500 font-bold mt-2 flex items-center gap-1"><AlertTriangle size={13} /> {t("settings.backup.importFailed", { error: "" })}</p>}
            </Field>
            <p className="text-[11px] text-[#122222]/40 dark:text-white/40 mt-3 font-medium">
              {t("settings.integrations.groqHelp")}
            </p>
          </div>
        </Card>
      </div>

      <h3 className="font-bold text-[13px] text-[#122222]/80 dark:text-white/80 uppercase tracking-wider mb-4 border-b border-black/5 dark:border-white/5 pb-2">
        External Catalog Lookup
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
        {/* Google Books Card */}
        <Card title={t("settings.integrations.googleTitle", "Google Books Lookup")} icon={<Globe size={16} className="text-[#1a4d40] dark:text-[#1b9277]" />}>
          <div className="flex items-center justify-between">
            <div className="flex-1 pr-4">
              <p className="text-[12px] text-[#122222]/70 dark:text-white/70 font-normal leading-normal">
                {t("settings.integrations.googleDesc", "Search Google's massive global catalog. Recommended as the primary source for modern book records and covers.")}
              </p>
              <p className="text-[11px] text-[#122222]/40 dark:text-white/40 mt-3.5 flex items-center gap-1.5 font-semibold">
                {prefs.googleBooksEnabled ? <><Wifi size={13} className="text-[#1a4d40] dark:text-[#1b9277]" /> {t("statusConnected", "Connected")}</> : <><WifiOff size={13} /> {t("statusDisconnected", "Disconnected")}</>}
              </p>
            </div>
            <Toggle checked={prefs.googleBooksEnabled} onChange={v => update({ googleBooksEnabled: v })} />
          </div>
        </Card>

        {/* Open Library Card */}
        <Card title={t("settings.integrations.openLibraryTitle", "Open Library Catalog")} icon={<BookOpen size={16} className="text-[#1a4d40] dark:text-[#1b9277]" />}>
          <div className="flex items-center justify-between">
            <div className="flex-1 pr-4">
              <p className="text-[12px] text-[#122222]/70 dark:text-white/70 font-normal leading-normal">
                {t("settings.integrations.openLibraryDesc", "Search the Internet Archive's Open Library. Great fallback for classic literature and historical editions.")}
              </p>
              <p className="text-[11px] text-[#122222]/40 dark:text-white/40 mt-3.5 flex items-center gap-1.5 font-semibold">
                {prefs.openLibraryEnabled ? <><Wifi size={13} className="text-[#1a4d40] dark:text-[#1b9277]" /> {t("statusConnected", "Connected")}</> : <><WifiOff size={13} /> {t("statusDisconnected", "Disconnected")}</>}
              </p>
            </div>
            <Toggle checked={prefs.openLibraryEnabled} onChange={v => update({ openLibraryEnabled: v })} />
          </div>
        </Card>
      </div>

      <SaveButton label={t("settings.integrations.saveBtn")} />
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// 11. SECRETS & KEYS TAB
// ═══════════════════════════════════════════════════════════════════════════════
function SecretsTab({ prefs, update }: TabProps) {
  const { t } = useTranslation();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [visibleKey, setVisibleKey] = useState<string | null>(null);

  const secrets = [
    { id: "openai", label: "OpenAI API Key", value: prefs.openAIKey, placeholder: "Not set", onClear: () => update({ openAIKey: "" }) },
    { id: "groq", label: "Groq API Key", value: prefs.groqApiKey, placeholder: "Not set", onClear: () => update({ groqApiKey: "" }) },
  ];

  const handleCopy = (id: string, value: string) => {
    void navigator.clipboard.writeText(value);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="max-w-2xl">
      <PageHeader title={t("settings.secrets.title")} desc={t("settings.secrets.desc")} />

      <div className="bg-[#1a4d40]/5 dark:bg-[#1b9277]/5 border border-[#1a4d40]/10 dark:border-[#1b9277]/10 rounded-2xl p-5 flex items-start gap-3 mb-6">
        <Shield size={16} className="text-[#1a4d40] dark:text-[#1b9277] shrink-0 mt-0.5" />
        <p className="text-[12px] text-[#1a4d40] dark:text-[#1b9277]">
          {t("settings.secrets.desc")}
        </p>
      </div>

      <Card title={t("settings.secrets.keysTitle")} icon={<Key size={16} className="text-[#1a4d40]" />}>
        {secrets.length === 0 ? (
          <div className="text-center py-8">
            <Key size={32} className="mx-auto text-[#122222]/20 dark:text-white/20 mb-3" />
            <p className="text-[13px] text-[#122222]/50 dark:text-white/50">{t("settings.secrets.secretPlaceholder")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {secrets.map(secret => (
              <div key={secret.id} className="p-4 bg-[#fcfbf8] dark:bg-[#111d1a] rounded-xl border border-black/5 dark:border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Key size={13} className="text-[#b96f3e]" />
                    <span className="font-bold text-[13px] text-[#122222] dark:text-white">{secret.label}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {secret.value && (
                      <>
                        <button
                          onClick={() => setVisibleKey(visibleKey === secret.id ? null : secret.id)}
                          className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 text-[#122222]/40 dark:text-white/40 hover:text-[#122222] dark:hover:text-white transition-colors"
                          title="Toggle visibility"
                        >
                          {visibleKey === secret.id ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                        <button
                          onClick={() => handleCopy(secret.id, secret.value)}
                          className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 text-[#122222]/40 dark:text-white/40 hover:text-[#1a4d40] dark:hover:text-[#1b9277] transition-colors"
                          title="Copy"
                        >
                          {copiedKey === secret.id ? <Check size={13} className="text-[#1a4d40]" /> : <Copy size={13} />}
                        </button>
                        <button
                          onClick={secret.onClear}
                          className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-[#122222]/40 dark:text-white/40 hover:text-red-500 transition-colors"
                          title="Remove key"
                        >
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <p className="font-mono text-[12px] text-[#122222]/50 dark:text-white/40 break-all">
                  {!secret.value
                    ? <span className="italic">{secret.placeholder}</span>
                    : visibleKey === secret.id
                      ? secret.value
                      : secret.value.slice(0, 4) + "•".repeat(Math.max(0, secret.value.length - 8)) + secret.value.slice(-4)
                  }
                </p>
                {!secret.value && (
                  <p className="text-[11px] text-[#122222]/30 dark:text-white/30 mt-1">{t("settings.secrets.secretHelp")}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 12. DESKTOP & DATA TAB
// ═══════════════════════════════════════════════════════════════════════════════
function DesktopTab({ prefs, update }: TabProps) {
  const { t } = useTranslation();
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<"idle" | "uptodate" | "available" | "error">("idle");
  const [autostartEnabled, setAutostartEnabled] = useState(false);
  const dataPath = "AppData\\Roaming\\com.warraq.app";

  useEffect(() => {
    async function checkAutostart() {
      try {
        const { isEnabled } = await import("@tauri-apps/plugin-autostart");
        const enabled = await isEnabled();
        setAutostartEnabled(enabled);
        if (enabled !== prefs.launchOnBoot) {
          update({ launchOnBoot: enabled });
        }
      } catch (e) {
        console.warn("Autostart plugin not available", e);
        setAutostartEnabled(prefs.launchOnBoot);
      }
    }
    void checkAutostart();
  }, [prefs.launchOnBoot, update]);

  const handleAutostartToggle = async (v: boolean) => {
    try {
      const { enable, disable } = await import("@tauri-apps/plugin-autostart");
      if (v) {
        await enable();
      } else {
        await disable();
      }
      setAutostartEnabled(v);
      update({ launchOnBoot: v });
    } catch (e) {
      console.error("Failed to update autostart setting", e);
    }
  };

  const openFolder = async () => {
    try {
      const { appDataDir } = await import("@tauri-apps/api/path");
      const { openPath } = await import("@tauri-apps/plugin-opener");
      const dir = await appDataDir();
      await openPath(dir);
    } catch {
      // No-op in browser dev
    }
  };

  const handleCheckUpdates = async () => {
    setCheckingUpdate(true);
    setUpdateStatus("idle");
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setUpdateStatus("uptodate");
      setTimeout(() => setUpdateStatus("idle"), 4000);
    } catch {
      setUpdateStatus("error");
      setTimeout(() => setUpdateStatus("idle"), 4000);
    } finally {
      setCheckingUpdate(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <PageHeader title={t("settings.desktop.title")} desc={t("settings.desktop.desc")} />

      <Card title={t("settings.desktop.trayTitle")} icon={<Monitor size={16} className="text-[#1a4d40] dark:text-[#1b9277]" />}>
        <ToggleRow
          label={t("settings.desktop.closeToTray")}
          desc={t("settings.desktop.trayDesc")}
          checked={prefs.closeToTray}
          onChange={v => update({ closeToTray: v })}
        />
      </Card>

      <Card title={t("settings.desktop.startupTitle")} icon={<LayoutGrid size={16} className="text-[#1a4d40] dark:text-[#1b9277]" />}>
        <ToggleRow
          label={t("settings.desktop.launchOnBoot")}
          desc={t("settings.desktop.startupDesc")}
          checked={autostartEnabled}
          onChange={handleAutostartToggle}
        />
      </Card>

      <Card title={t("settings.desktop.paginationTitle", "Pagination settings")} icon={<LayoutGrid size={16} className="text-[#1a4d40] dark:text-[#1b9277]" />}>
        <div className="flex items-center justify-between text-[13px]">
          <div>
            <p className="font-bold text-[#122222] dark:text-white">{t("settings.desktop.pageSizeLabel", "Default page size")}</p>
            <p className="text-[12px] text-[#122222]/60 dark:text-white/60 mt-0.5">
              {t("settings.desktop.pageSizeDesc", "Select the default number of items to show per page in tables.")}
            </p>
          </div>
          <select
            value={prefs.pageSize || 10}
            onChange={(e) => update({ pageSize: Number(e.target.value) })}
            className="bg-white dark:bg-[#1d2926] border border-black/10 dark:border-white/10 rounded-lg py-1.5 px-3 font-semibold text-[#122222]/70 dark:text-white/70 outline-none cursor-pointer"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </Card>

      <Card title={t("settings.desktop.storageTitle", "Database storage")} icon={<FolderOpen size={16} className="text-[#b96f3e]" />}>
        <p className="text-[12px] text-[#122222]/70 dark:text-white/70 mb-4 font-normal">
          {t("settings.desktop.storageDesc", "Locate the folder where your database and local assets are saved on this system.")}
        </p>
        <div className="flex items-center gap-2 p-3 bg-[#fcfbf8] dark:bg-[#111d1a] border border-black/5 dark:border-white/5 rounded-lg">
          <FolderOpen size={14} className="text-[#b96f3e] shrink-0" />
          <code className="text-[12px] text-[#122222]/70 dark:text-white/60 flex-1 truncate">{dataPath}</code>
          <button
            onClick={openFolder}
            className="text-[11px] font-bold text-[#1a4d40] dark:text-[#1b9277] flex items-center gap-1 hover:underline shrink-0 text-[12px]"
          >
            {t("common.select")} <ExternalLink size={11} />
          </button>
        </div>
      </Card>

      <Card title={t("settings.about.updates")} icon={<RefreshCw size={16} className="text-[#122222]/60 dark:text-white/60" />}>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold text-[13px] text-[#122222] dark:text-white">{t("settings.about.version")}</p>
            <p className="text-[12px] text-[#122222]/60 dark:text-white/60 mt-0.5">
              v1.0.0
              {updateStatus === "uptodate" && <span className="text-[#1a4d40] dark:text-[#1b9277] font-bold ml-2">✓ {t("settings.about.upToDate")}</span>}
              {updateStatus === "available" && <span className="text-[#b96f3e] font-bold ml-2">Update available!</span>}
            </p>
          </div>
          <button
            onClick={handleCheckUpdates}
            disabled={checkingUpdate}
            className="flex items-center gap-2 border border-black/10 dark:border-white/10 text-[#122222] dark:text-white px-4 py-2 rounded-lg font-bold text-[13px] hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={checkingUpdate ? "animate-spin" : ""} />
            {checkingUpdate ? t("common.loading") : t("settings.about.checkBtn")}
          </button>
        </div>
      </Card>

      <SaveButton label={t("settings.desktop.saveBtn")} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 13. ABOUT TAB
// ═══════════════════════════════════════════════════════════════════════════════
function AboutTab() {
  const { t } = useTranslation();
  const credits = [
    { role: t("settings.about.developer"), name: "MANAA Mohaned" },
    { role: "Book data", name: "Google Books / Open Library" },
    { role: "Icons", name: "Lucide React" },
    { role: "Font", name: "Manrope / IBM Plex Sans Arabic" },
  ];

  return (
    <div className="max-w-2xl">
      <PageHeader title={t("settings.about.title")} desc={t("settings.about.desc")} />

      <Card title={t("settings.about.engine")} icon={<Info size={16} className="text-[#1a4d40]" />}>
        <div className="flex items-center gap-5 mb-6">
          <img src="/brand/warraq-symbol.png" alt="Warraq" className="h-16 w-16 rounded-2xl shadow-card" />
          <div>
            <h2 className="font-display text-[22px] font-bold text-[#122222] dark:text-white tracking-wider">WARRAQ</h2>
            <p className="text-[13px] font-arabic text-[#b96f3e]">وراق ـ المخطوط الحي</p>
            <p className="text-[12px] text-[#122222]/60 dark:text-white/60 mt-1">{t("settings.about.desc")}</p>
          </div>
        </div>
        <div className="space-y-2">
          {[
            { label: t("settings.about.version"), value: "1.0.0" },
            { label: t("settings.about.database"), value: "SQLite 3" },
            { label: t("settings.about.platform"), value: "Windows / Tauri" },
          ].map(r => (
            <div key={r.label} className="flex justify-between py-2 border-b border-black/5 dark:border-white/5 last:border-0">
              <span className="text-[12px] text-[#122222]/60 dark:text-white/60">{r.label}</span>
              <span className="text-[13px] font-semibold text-[#122222] dark:text-white font-mono">{r.value}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card title={t("settings.about.credits") || "Credits"} icon={<LayoutGrid size={16} className="text-[#b96f3e]" />}>
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-black/5 dark:border-white/5 pb-3">
            <span className="text-[12px] text-[#122222]/60 dark:text-white/60">{t("settings.about.designAndEngineering") || "Design & Engineering"}</span>
            <div className="flex flex-col items-end mt-1 sm:mt-0">
              <span className="text-[13px] font-semibold text-[#122222] dark:text-white">MANAA Mohaned</span>
              <div className="flex gap-2.5 mt-1 text-[11px] font-medium text-[#1a4d40] dark:text-[#1b9277]">
                <a href="https://mohaned.space/" target="_blank" rel="noopener noreferrer" className="hover:underline">Website</a>
                <span className="text-black/20 dark:text-white/20">•</span>
                <a href="https://github.com/mohaneddz" target="_blank" rel="noopener noreferrer" className="hover:underline">GitHub</a>
                <span className="text-black/20 dark:text-white/20">•</span>
                <a href="https://www.linkedin.com/in/mohaned-manaa-491483295/" target="_blank" rel="noopener noreferrer" className="hover:underline">LinkedIn</a>
              </div>
            </div>
          </div>
          {credits.map(c => (
            <div key={c.role} className="flex justify-between py-1">
              <span className="text-[12px] text-[#122222]/60 dark:text-white/60">{c.role}</span>
              <span className="text-[13px] font-semibold text-[#122222] dark:text-white">{c.name}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card title={t("settings.about.legal") || "Legal"} icon={<FileText size={16} className="text-[#122222]/60 dark:text-white/60" />}>
        <div className="flex flex-col gap-3">
          <a href="#" className="flex items-center justify-between text-[13px] font-semibold text-[#1a4d40] dark:text-[#1b9277] hover:underline">
            {t("settings.about.terms") || "Terms of Service"} <ChevronRight size={14} />
          </a>
          <a href="#" className="flex items-center justify-between text-[13px] font-semibold text-[#1a4d40] dark:text-[#1b9277] hover:underline">
            {t("settings.about.privacy") || "Privacy Policy"} <ChevronRight size={14} />
          </a>
          <a href="#" className="flex items-center justify-between text-[13px] font-semibold text-[#1a4d40] dark:text-[#1b9277] hover:underline">
            {t("settings.about.licenses") || "Open Source Licenses"} <ChevronRight size={14} />
          </a>
        </div>
        <p className="text-[11px] text-[#122222]/40 dark:text-white/40 mt-4">© 2026 Warraq. All rights reserved.</p>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DYNAMIC RIGHT HELP PANEL
// ═══════════════════════════════════════════════════════════════════════════════
function RightHelp({ tab }: { tab: Tab }) {
  const helpData: Record<Tab, { title: string; icon: React.ReactNode; body: string; tips: string[] }> = {
    "General": {
      title: "General settings",
      icon: <SettingsIcon size={16} className="text-[#b96f3e]" />,
      body: "Defines your library's core identity and operator preferences used throughout the system.",
      tips: ["Set an official library name and logo", "Configure the operator profile for reports", "Autosave keeps changes safe"],
    },
    "Library Profile": {
      title: "Library profile",
      icon: <MapPin size={16} className="text-[#1a4d40]" />,
      body: "Contact details and description used in printed receipts and public-facing documents.",
      tips: ["Add an address for printed receipts", "Opening hours appear on member cards", "Website used in email footers"],
    },
    "Localization": {
      title: "Localization",
      icon: <Globe size={16} className="text-[#b96f3e]" />,
      body: "Controls the language, timezone, and number formats used across the interface.",
      tips: ["Arabic enables RTL layout", "Date format affects all date displays", "Currency is used in fine reports"],
    },
    "Appearance": {
      title: "Appearance",
      icon: <Palette size={16} className="text-[#b96f3e]" />,
      body: "Personalize the visual experience with themes, colors, and text sizes.",
      tips: ["System theme follows your OS setting", "Accent color applies to buttons and highlights", "Large text improves accessibility"],
    },
    "Rules": {
      title: "Circulation rules",
      icon: <BookMarked size={16} className="text-[#1a4d40]" />,
      body: "Rules define how items are lent, how long they can be kept, and how renewals work.",
      tips: ["Default loan period applies to new loans", "Reservation hold prevents items going back to shelf", "Grace period delays fine accrual"],
    },
    "Fines & Fees": {
      title: "Fines & fees",
      icon: <DollarSign size={16} className="text-[#b96f3e]" />,
      body: "Configure automatic fine calculation for overdue materials.",
      tips: ["Set a max fine to cap charges", "Grace period (in Rules) delays fine start", "Fines appear in member records"],
    },
    "Notifications": {
      title: "Notifications",
      icon: <Bell size={16} className="text-[#1a4d40]" />,
      body: "Control which system events trigger alerts in the Activity panel.",
      tips: ["Due-soon reminders reduce overdue rates", "Reservation alerts help members collect on time", "Overdue alerts appear on the dashboard"],
    },
    "Backup & Restore": {
      title: "Backup & restore",
      icon: <HardDrive size={16} className="text-[#b96f3e]" />,
      body: "Protect your library data with regular backups.",
      tips: ["Export after major cataloging sessions", "Keep backups on a separate drive", "Never restore without a fresh export first"],
    },
    "Database": {
      title: "Database",
      icon: <Database size={16} className="text-[#1a4d40]" />,
      body: "Inspect the underlying SQLite database and perform maintenance.",
      tips: ["VACUUM reclaims deleted record space", "Run monthly for best performance", "Factory reset requires a relaunch"],
    },
    "Integrations & AI": {
      title: "Integrations & AI",
      icon: <Zap size={16} className="text-[#b96f3e]" />,
      body: "Connect third-party services to enrich your catalog and enable AI features.",
      tips: ["Google Books provides cover images", "OpenAI powers smart descriptions", "All keys stay on your device"],
    },
    "Secrets & Keys": {
      title: "Secrets & keys",
      icon: <Shield size={16} className="text-[#1a4d40]" />,
      body: "All API keys are stored in localStorage. Nothing is sent to Warraq servers.",
      tips: ["Mask keys before screen-sharing", "Delete keys when no longer needed", "Keys can be re-entered in Integrations"],
    },
    "Desktop & Data": {
      title: "Desktop & data",
      icon: <Monitor size={16} className="text-[#b96f3e]" />,
      body: "Tauri desktop behavior and data storage location.",
      tips: ["Tray mode keeps the app running quietly", "Open the data folder to locate backups", "Check for updates regularly"],
    },
    "About": {
      title: "About Warraq",
      icon: <Info size={16} className="text-[#1a4d40]" />,
      body: "Warraq — وراق — means 'the scribe' or 'paper seller' in classical Arabic.",
      tips: ["v1.0.0 is the initial release", "Built with Tauri 2 + React", "Open source licenses are listed below"],
    },
  };

  const help = helpData[tab];

  return (
    <>
      <div className="bg-[#fcfbf8] dark:bg-[#1a2522] rounded-2xl border border-black/5 dark:border-white/5 p-5 shadow-card">
        <div className="w-10 h-10 bg-white dark:bg-[#1d2926] border border-black/5 dark:border-white/5 rounded-full flex items-center justify-center mb-4">
          {help.icon}
        </div>
        <h3 className="font-bold text-[14px] text-[#122222] dark:text-white mb-2">{help.title}</h3>
        <p className="text-[12px] text-[#122222]/70 dark:text-white/70 mb-4">{help.body}</p>
        <div className="text-[12px] font-bold text-[#122222] dark:text-white mb-2">Tips</div>
        <ul className="space-y-2">
          {help.tips.map(tip => (
            <li key={tip} className="flex gap-2 text-[12px] text-[#122222]/70 dark:text-white/70">
              <CheckCircle2 size={14} className="text-[#1a4d40] dark:text-[#1b9277] shrink-0 mt-0.5" />
              {tip}
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-[#fcfbf8] dark:bg-[#1a2522] rounded-2xl border border-black/5 dark:border-white/5 p-5 shadow-card">
        <div className="w-10 h-10 bg-white dark:bg-[#1d2926] border border-black/5 dark:border-white/5 rounded-full flex items-center justify-center mb-4">
          <BookOpen size={16} className="text-[#b96f3e]" />
        </div>
        <h3 className="font-bold text-[14px] text-[#122222] dark:text-white mb-2">Quick navigation</h3>
        <div className="space-y-1.5">
          {[["General", "⌘ ,"], ["Appearance", "—"], ["Backup", "—"]].map(([label, shortcut]) => (
            <div key={label} className="flex items-center justify-between text-[12px]">
              <span className="text-[#122222]/70 dark:text-white/70">{label}</span>
              <span className="font-mono text-[10px] bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded">{shortcut}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

const inputCls = "w-full bg-[#fcfbf8] dark:bg-[#111d1a] border border-black/10 dark:border-white/10 rounded-lg py-2 px-3 text-[13px] text-[#122222] dark:text-white outline-none focus:border-[#1a4d40] dark:focus:border-[#1b9277] transition-colors";
const selectCls = "w-full bg-[#fcfbf8] dark:bg-[#111d1a] border border-black/10 dark:border-white/10 rounded-lg py-2 px-3 text-[13px] text-[#122222] dark:text-white outline-none focus:border-[#1a4d40] dark:focus:border-[#1b9277] transition-colors";

function PageHeader({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-[20px] font-bold text-[#122222] dark:text-white mb-1">{title}</h2>
      <p className="text-[13px] text-[#122222]/60 dark:text-white/60">{desc}</p>
    </div>
  );
}

function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-[#1d2926] rounded-2xl border border-black/5 dark:border-white/5 p-6 shadow-card mb-5">
      <div className="flex items-center gap-2 mb-4 font-bold text-[#122222] dark:text-white text-[14px]">
        {icon} {title}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-bold text-[#122222]/50 dark:text-white/50 uppercase tracking-wider mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`w-10 h-6 rounded-full relative transition-colors shrink-0 ${checked ? "bg-[#1a4d40]" : "bg-black/20 dark:bg-white/20"}`}
    >
      <div className={`absolute top-1 bottom-1 w-4 bg-white rounded-full shadow-sm transition-[left] ${checked ? "left-5" : "left-1"}`} />
    </button>
  );
}

function ToggleRow({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <p className="font-bold text-[13px] text-[#122222] dark:text-white">{label}</p>
        <p className="text-[12px] text-[#122222]/60 dark:text-white/60 mt-0.5">{desc}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

function NumberInput({ value, min, max, onChange, disabled }: { value: number; min: number; max: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <div className={`flex items-center gap-2 ${disabled ? "pointer-events-none opacity-50" : ""}`}>
      <button
        disabled={disabled}
        onClick={() => onChange(Math.max(min, value - 1))}
        className="w-8 h-8 rounded-lg border border-black/10 dark:border-white/10 flex items-center justify-center text-[#122222] dark:text-white font-bold hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
      >−</button>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        onChange={e => onChange(Number(e.target.value))}
        className="w-16 text-center bg-[#fcfbf8] dark:bg-[#111d1a] border border-black/10 dark:border-white/10 rounded-lg py-1.5 text-[14px] font-bold text-[#122222] dark:text-white outline-none focus:border-[#1a4d40]"
      />
      <button
        disabled={disabled}
        onClick={() => onChange(Math.min(max, value + 1))}
        className="w-8 h-8 rounded-lg border border-black/10 dark:border-white/10 flex items-center justify-center text-[#122222] dark:text-white font-bold hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
      >+</button>
    </div>
  );
}

function SaveButton({ label }: { label: string }) {
  const { t } = useTranslation();
  const [saved, setSaved] = useState(false);
  const handle = () => { setSaved(true); setTimeout(() => setSaved(false), 2500); };
  return (
    <div className="mt-6">
      <button
        onClick={handle}
        className="bg-[#1a4d40] text-white px-6 py-2.5 rounded-lg font-bold text-[13px] hover:bg-[#1a4d40]/90 transition-all shadow-sm flex items-center gap-2"
      >
        {saved ? <><Check size={16} /> {t("save") || "Saved!"}</> : <><CheckCircle2 size={16} /> {label}</>}
      </button>
    </div>
  );
}

function ThemeOption({ name, active, onClick }: { name: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`relative p-2 rounded-xl border-2 border-solid transition-all w-full cursor-pointer ${
        active 
          ? "border-[#b96f3e] bg-[#b96f3e]/5 scale-[1.02] shadow-sm" 
          : "border-transparent bg-[#122222]/[0.03] dark:bg-[#ffffff]/[0.03]"
      } hover:brightness-90 hover:scale-[0.98] active:scale-[1.02] active:brightness-110`}
    >
      <div className={`h-20 w-full rounded-lg mb-2 ${name === "Dark" ? "bg-[#111d1a]" : name === "Light" ? "bg-[#fcfbf8]" : "bg-gradient-to-r from-[#fcfbf8] to-[#111d1a]"} border border-black/10 dark:border-white/10 overflow-hidden relative`}>
        <div className={`absolute top-2 left-2 right-2 h-4 rounded ${name === "Dark" ? "bg-white/10" : name === "Light" ? "bg-black/10" : "bg-transparent"}`} />
        <div className={`absolute top-8 left-2 w-12 h-2 rounded-full ${name === "Dark" ? "bg-white/5" : "bg-black/5"}`} />
        <div className={`absolute top-12 left-2 w-8 h-2 rounded-full ${name === "Dark" ? "bg-white/5" : "bg-black/5"}`} />
      </div>
      <div className="flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full border flex items-center justify-center ${active ? "border-[#b96f3e]" : "border-[#122222]/30 dark:border-white/30"}`}>
          {active && <div className="w-1.5 h-1.5 bg-[#b96f3e] rounded-full" />}
        </div>
        <span className="text-[13px] font-bold text-[#122222] dark:text-white">{name}</span>
      </div>
    </button>
  );
}

function NavGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="text-[11px] font-bold text-[#122222]/40 dark:text-white/40 uppercase tracking-wider mb-2 px-3">{title}</div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function NavItem({ label, icon: Icon, active, onClick }: { label: string; icon: React.ComponentType<{ size?: number; className?: string }>; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-start px-3 py-2 rounded-lg text-[13px] font-semibold transition-colors flex items-center gap-2.5 ${active ? "bg-[#1a4d40]/10 dark:bg-[#1b9277]/10 text-[#1a4d40] dark:text-[#1b9277]" : "text-[#122222]/70 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/5"}`}
    >
      <Icon
        size={15}
        className={`shrink-0 transition-colors ${active
            ? "text-[#1a4d40] dark:text-[#1b9277]"
            : "text-[#122222]/40 dark:text-white/40"
          }`}
      />
      <span>{label}</span>
    </button>
  );
}
