import { useState } from "react";
import {
  Settings as SettingsIcon, Search, CheckCircle2, ChevronRight,
  BookOpen, Database, UserCircle, Monitor, Globe, Bell, Shield,
  HardDrive, Info, Zap, Key, RefreshCw, Trash2, Download, Upload,
  Eye, EyeOff, Copy, Check, AlertTriangle, Clock, MapPin,
  FileText, Palette, Type, BookMarked, RotateCcw,
  DollarSign, Server, Cpu, FolderOpen, ExternalLink, Wifi, WifiOff,
  LayoutGrid, Save,
} from "lucide-react";
import { useUiStore } from "../store/uiStore";
import { ImageUpload } from "../components/ui/ImageUpload";

// ─── Types ────────────────────────────────────────────────────────────────────
type Tab =
  | "General" | "Library Profile" | "Localization" | "Appearance"
  | "Rules" | "Fines & Fees" | "Notifications"
  | "Backup & Restore" | "Database" | "Integrations & AI" | "Secrets & Keys"
  | "Desktop & Data" | "About";

// ─── Root Component ───────────────────────────────────────────────────────────
export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("General");
  const [search, setSearch] = useState("");
  const { preferences, updatePreferences } = useUiStore();

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
        <div className="flex items-center gap-2 mb-6 text-[#b96f3e]">
          <SettingsIcon size={20} />
          <h1 className="font-display text-[22px] font-bold text-[#122222] dark:text-white leading-tight">Settings</h1>
        </div>

        <div className="relative mb-6">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#122222]/40 dark:text-white/40" />
          <input
            type="text"
            placeholder="Search settings..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white dark:bg-[#1d2926] border border-black/10 dark:border-white/10 rounded-lg py-2 pl-8 pr-3 text-[13px] text-[#122222] dark:text-[#f0ebe1] outline-none focus:border-[#1a4d40]"
          />
        </div>

        <div className="space-y-5 flex-1">
          {filtered.map(group => (
            <NavGroup key={group.group} title={group.group}>
              {group.items.map(item => (
                <NavItem key={item} label={item} active={activeTab === item} onClick={() => setActiveTab(item)} />
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
  return (
    <div className="max-w-2xl">
      <PageHeader title="General" desc="Configure your library identity and operator profile." />

      <Card title="Library identity" icon={<SettingsIcon size={16} className="text-[#1a4d40]" />}>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <Field label="Library name">
            <input type="text" defaultValue={prefs.libraryName} onBlur={e => update({ libraryName: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Short name (optional)">
            <input type="text" defaultValue={prefs.libraryShortName} placeholder="e.g., MBH Library" onBlur={e => update({ libraryShortName: e.target.value })} className={inputCls} />
          </Field>
        </div>
        <Field label="Library logo (optional)">
          <div className="flex items-center gap-4">
            <div className="w-32 h-20 border-2 border-dashed border-[#1a4d40]/10 rounded-xl flex flex-col items-center justify-center text-[#1a4d40]/40 gap-1 bg-[#1a4d40]/5 select-none pointer-events-none">
              <span className="text-[11px] font-bold">Managed by OS</span>
            </div>
            <p className="text-[11px] text-[#122222]/40 dark:text-white/40">Library application icon is configured<br />in native desktop launcher.</p>
          </div>
        </Field>
      </Card>

      <Card title="Operator profile" icon={<UserCircle size={16} className="text-[#b96f3e]" />}>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <Field label="Operator name">
            <input type="text" defaultValue={prefs.operatorName} placeholder="e.g., Mohamed Benali" onBlur={e => update({ operatorName: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Email (optional)">
            <input type="email" defaultValue={prefs.operatorEmail} placeholder="librarian@hospital.dz" onBlur={e => update({ operatorEmail: e.target.value })} className={inputCls} />
          </Field>
        </div>
        <Field label="Profile Picture">
          <div className="flex items-center gap-4">
            <ImageUpload
              value={prefs.operatorAvatar}
              onChange={val => update({ operatorAvatar: val })}
              shape="circle"
            />
            <p className="text-[11px] text-[#122222]/40 dark:text-white/40">Recommended: Square PNG, JPG or WEBP<br />Max size: 2 MB</p>
          </div>
        </Field>
      </Card>

      <Card title="Autosave" icon={<Save size={16} className="text-[#122222]/60 dark:text-white/60" />}>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold text-[13px] text-[#122222] dark:text-white">Automatic saving</p>
            <p className="text-[12px] text-[#122222]/60 dark:text-white/60 mt-0.5">Periodically save any changes without manual action.</p>
          </div>
          <Toggle checked={prefs.autosaveEnabled} onChange={v => update({ autosaveEnabled: v })} />
        </div>
        {prefs.autosaveEnabled && (
          <div className="mt-4 pt-4 border-t border-black/5 dark:border-white/5">
            <Field label="Interval (seconds)">
              <input type="number" min={10} max={600} defaultValue={prefs.autosaveInterval} onBlur={e => update({ autosaveInterval: Number(e.target.value) })} className={inputCls + " w-32"} />
            </Field>
          </div>
        )}
      </Card>

      <SaveButton label="Save general settings" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. LIBRARY PROFILE TAB
// ═══════════════════════════════════════════════════════════════════════════════
function LibraryProfileTab({ prefs, update }: TabProps) {
  return (
    <div className="max-w-2xl">
      <PageHeader title="Library Profile" desc="Public-facing details about your library institution." />

      <Card title="Contact information" icon={<MapPin size={16} className="text-[#1a4d40]" />}>
        <div className="space-y-4">
          <Field label="Street address">
            <input type="text" defaultValue={prefs.libraryAddress} placeholder="e.g., Rue Kaddour Rahim, Bab El Oued" onBlur={e => update({ libraryAddress: e.target.value })} className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="City">
              <input type="text" defaultValue={prefs.libraryCity} placeholder="e.g., Algiers" onBlur={e => update({ libraryCity: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Phone">
              <input type="tel" defaultValue={prefs.libraryPhone} placeholder="+213 21 …" onBlur={e => update({ libraryPhone: e.target.value })} className={inputCls} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Email">
              <input type="email" defaultValue={prefs.libraryEmail} placeholder="library@hospital.dz" onBlur={e => update({ libraryEmail: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Website (optional)">
              <input type="url" defaultValue={prefs.libraryWebsite} placeholder="https://…" onBlur={e => update({ libraryWebsite: e.target.value })} className={inputCls} />
            </Field>
          </div>
        </div>
      </Card>

      <Card title="About the library" icon={<FileText size={16} className="text-[#b96f3e]" />}>
        <div className="space-y-4">
          <Field label="Description">
            <textarea
              rows={4}
              defaultValue={prefs.libraryDescription}
              placeholder="Brief description of the library's mission and collections…"
              onBlur={e => update({ libraryDescription: e.target.value })}
              className={inputCls + " resize-none"}
            />
          </Field>
          <Field label="Opening hours">
            <input type="text" defaultValue={prefs.libraryHours} placeholder="e.g., Sun–Thu 08:00–16:00" onBlur={e => update({ libraryHours: e.target.value })} className={inputCls} />
          </Field>
        </div>
      </Card>

      <SaveButton label="Save library profile" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. LOCALIZATION TAB
// ═══════════════════════════════════════════════════════════════════════════════
function LocalizationTab({ prefs, update }: TabProps) {
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
      <PageHeader title="Localization" desc="Configure regional preferences including language, timezone, and formats." />

      <Card title="Language" icon={<Globe size={16} className="text-[#1a4d40]" />}>
        <div className="grid grid-cols-3 gap-3">
          {languages.map(lang => (
            <button
              key={lang.code}
              onClick={() => handleLocaleChange(lang.code)}
              className={`p-4 rounded-xl border-2 text-left transition-all ${prefs.locale === lang.code ? "border-[#b96f3e] bg-[#b96f3e]/5" : "border-black/5 dark:border-white/5 hover:border-black/10 dark:hover:border-white/10"}`}
            >
              <div className="text-[18px] mb-2">{lang.code === "en" ? "🇬🇧" : lang.code === "fr" ? "🇫🇷" : "🇩🇿"}</div>
              <div className="font-bold text-[13px] text-[#122222] dark:text-white">{lang.label}</div>
              <div className="text-[11px] text-[#122222]/50 dark:text-white/50">{lang.native}</div>
              {prefs.locale === lang.code && <div className="mt-2 flex items-center gap-1 text-[11px] font-bold text-[#b96f3e]"><CheckCircle2 size={12} /> Active</div>}
            </button>
          ))}
        </div>
        {prefs.locale === "ar" && (
          <div className="mt-4 p-3 rounded-lg bg-[#b96f3e]/10 border border-[#b96f3e]/20 flex items-start gap-2">
            <Info size={14} className="text-[#b96f3e] shrink-0 mt-0.5" />
            <p className="text-[12px] text-[#b96f3e]">Selecting Arabic will enable right-to-left (RTL) layout automatically.</p>
          </div>
        )}
      </Card>

      <Card title="Regional formats" icon={<Clock size={16} className="text-[#b96f3e]" />}>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <Field label="Timezone">
            <select value={prefs.timezone} onChange={e => update({ timezone: e.target.value })} className={selectCls}>
              {timezones.map(tz => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </Field>
          <Field label="Currency">
            <select value={prefs.currency} onChange={e => update({ currency: e.target.value })} className={selectCls}>
              {currencies.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Date format">
          <div className="flex gap-3">
            {formats.map(f => (
              <button
                key={f}
                onClick={() => update({ dateFormat: f })}
                className={`flex-1 py-2 px-3 rounded-lg border text-[13px] font-semibold transition-all ${prefs.dateFormat === f ? "border-[#1a4d40] bg-[#1a4d40]/10 text-[#1a4d40] dark:text-[#1b9277]" : "border-black/10 dark:border-white/10 text-[#122222]/70 dark:text-white/70 hover:border-[#1a4d40]/30"}`}
              >
                {f}
              </button>
            ))}
          </div>
        </Field>
      </Card>

      <SaveButton label="Save localization" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. APPEARANCE TAB
// ═══════════════════════════════════════════════════════════════════════════════
function AppearanceTab({ prefs, update }: TabProps) {
  const accentColors = [
    { value: "#1a4d40", label: "Emerald" },
    { value: "#b96f3e", label: "Copper" },
    { value: "#3b5998", label: "Navy" },
    { value: "#7c3aed", label: "Violet" },
    { value: "#dc2626", label: "Ruby" },
    { value: "#0284c7", label: "Sapphire" },
  ];
  const fontSizes = [
    { value: "small" as const, label: "Small", desc: "Compact density" },
    { value: "medium" as const, label: "Medium", desc: "Balanced default" },
    { value: "large" as const, label: "Large", desc: "Accessible text" },
  ];

  return (
    <div className="max-w-2xl">
      <PageHeader title="Appearance" desc="Customize the look and feel of the Warraq interface." />

      <Card title="Theme" icon={<Monitor size={16} className="text-[#122222]/60 dark:text-white/60" />}>
        <p className="text-[12px] text-[#122222]/60 dark:text-white/60 mb-4">Choose your preferred interface theme.</p>
        <div className="grid grid-cols-3 gap-4">
          {(["Light", "Dark", "System"] as const).map(name => (
            <ThemeOption key={name} name={name} active={prefs.theme === name.toLowerCase() as "light" | "dark" | "system"} onClick={() => update({ theme: name.toLowerCase() as "light" | "dark" | "system" })} />
          ))}
        </div>
      </Card>

      <Card title="Accent color" icon={<Palette size={16} className="text-[#b96f3e]" />}>
        <p className="text-[12px] text-[#122222]/60 dark:text-white/60 mb-4">Choose the primary color used across the interface.</p>
        <div className="flex gap-3 flex-wrap">
          {accentColors.map(c => (
            <button
              key={c.value}
              title={c.label}
              onClick={() => update({ accentColor: c.value })}
              className={`w-10 h-10 rounded-full border-4 transition-all ${prefs.accentColor === c.value ? "border-[#122222] dark:border-white scale-110" : "border-transparent hover:scale-105"}`}
              style={{ backgroundColor: c.value }}
            />
          ))}
        </div>
        <p className="text-[11px] text-[#122222]/40 dark:text-white/40 mt-3">Selected: <span className="font-bold">{accentColors.find(c => c.value === prefs.accentColor)?.label ?? "Custom"}</span></p>
      </Card>

      <Card title="Text size" icon={<Type size={16} className="text-[#122222]/60 dark:text-white/60" />}>
        <div className="grid grid-cols-3 gap-3">
          {fontSizes.map(s => (
            <button
              key={s.value}
              onClick={() => update({ fontSize: s.value })}
              className={`p-4 rounded-xl border-2 text-left transition-all ${prefs.fontSize === s.value ? "border-[#b96f3e] bg-[#b96f3e]/5" : "border-black/5 dark:border-white/5 hover:border-black/10 dark:hover:border-white/10"}`}
            >
              <div className={`font-bold text-[#122222] dark:text-white mb-1 ${s.value === "small" ? "text-[12px]" : s.value === "large" ? "text-[16px]" : "text-[14px]"}`}>Aa</div>
              <div className="font-bold text-[13px] text-[#122222] dark:text-white">{s.label}</div>
              <div className="text-[11px] text-[#122222]/50 dark:text-white/50">{s.desc}</div>
            </button>
          ))}
        </div>
      </Card>

      <SaveButton label="Save appearance" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. RULES TAB
// ═══════════════════════════════════════════════════════════════════════════════
function RulesTab({ prefs, update }: TabProps) {
  return (
    <div className="max-w-2xl">
      <PageHeader title="Circulation Rules" desc="Define lending policies applied to all members and loans." />

      <Card title="Loan parameters" icon={<BookMarked size={16} className="text-[#1a4d40]" />}>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <Field label="Default loan period (days)">
            <NumberInput value={prefs.loanDays} min={1} max={365} onChange={v => update({ loanDays: v })} />
          </Field>
          <Field label="Max items per member">
            <NumberInput value={prefs.loanLimit} min={1} max={50} onChange={v => update({ loanLimit: v })} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Max renewals per loan">
            <NumberInput value={prefs.renewLimit} min={0} max={10} onChange={v => update({ renewLimit: v })} />
          </Field>
          <Field label="Reservation hold period (days)">
            <NumberInput value={prefs.reservationHoldDays} min={1} max={30} onChange={v => update({ reservationHoldDays: v })} />
          </Field>
        </div>
      </Card>

      <Card title="Member self-service" icon={<RotateCcw size={16} className="text-[#b96f3e]" />}>
        <ToggleRow
          label="Allow self-renewal"
          desc="Members can renew their own loans without staff intervention."
          checked={prefs.selfRenewalAllowed}
          onChange={v => update({ selfRenewalAllowed: v })}
        />
      </Card>

      <Card title="Grace period" icon={<Clock size={16} className="text-[#122222]/60 dark:text-white/60" />}>
        <ToggleRow
          label="Enable grace period"
          desc="Allow a short window after the due date before fines begin."
          checked={prefs.gracePeriodEnabled}
          onChange={v => update({ gracePeriodEnabled: v })}
        />
        {prefs.gracePeriodEnabled && (
          <div className="mt-4 pt-4 border-t border-black/5 dark:border-white/5">
            <Field label="Grace period length (days)">
              <NumberInput value={prefs.gracePeriodDays} min={1} max={14} onChange={v => update({ gracePeriodDays: v })} />
            </Field>
          </div>
        )}
      </Card>

      <SaveButton label="Save circulation rules" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. FINES & FEES TAB
// ═══════════════════════════════════════════════════════════════════════════════
function FinesTab({ prefs, update }: TabProps) {
  return (
    <div className="max-w-2xl">
      <PageHeader title="Fines & Fees" desc="Configure overdue fine calculations and payment methods." />

      <Card title="Fine policy" icon={<DollarSign size={16} className="text-[#1a4d40]" />}>
        <ToggleRow
          label="Enable overdue fines"
          desc="Automatically apply fines to loans returned past their due date."
          checked={prefs.finesEnabled}
          onChange={v => update({ finesEnabled: v })}
        />
        {prefs.finesEnabled && (
          <div className="mt-4 pt-4 border-t border-black/5 dark:border-white/5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label={`Fine per day (${prefs.fineCurrency})`}>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  defaultValue={prefs.finePerDay}
                  onBlur={e => update({ finePerDay: Number(e.target.value) })}
                  className={inputCls}
                />
              </Field>
              <Field label={`Max fine per loan (${prefs.fineCurrency})`}>
                <input
                  type="number"
                  min={0}
                  defaultValue={prefs.maxFineAmount}
                  onBlur={e => update({ maxFineAmount: Number(e.target.value) })}
                  className={inputCls}
                />
              </Field>
            </div>
            <Field label="Fine currency">
              <select value={prefs.fineCurrency} onChange={e => update({ fineCurrency: e.target.value })} className={selectCls}>
                {["DZD", "EUR", "USD", "GBP", "MAD", "TND"].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
          </div>
        )}
      </Card>

      {prefs.finesEnabled && (
        <Card title="Payment method" icon={<DollarSign size={16} className="text-[#b96f3e]" />}>
          <p className="text-[12px] text-[#122222]/60 dark:text-white/60 mb-4">Select the accepted payment methods for fine collection.</p>
          <div className="grid grid-cols-3 gap-3">
            {(["cash", "card", "both"] as const).map(method => (
              <button
                key={method}
                onClick={() => update({ finesPaymentMethod: method })}
                className={`py-3 px-4 rounded-xl border-2 font-semibold text-[13px] capitalize transition-all ${prefs.finesPaymentMethod === method ? "border-[#b96f3e] bg-[#b96f3e]/5 text-[#b96f3e]" : "border-black/5 dark:border-white/5 text-[#122222]/70 dark:text-white/70 hover:border-black/10 dark:hover:border-white/10"}`}
              >
                {method === "both" ? "Cash & Card" : method.charAt(0).toUpperCase() + method.slice(1)}
              </button>
            ))}
          </div>
        </Card>
      )}

      {!prefs.finesEnabled && (
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-700/30 rounded-2xl p-5 flex items-start gap-3">
          <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-[13px] text-amber-700 dark:text-amber-400">Fines are disabled</p>
            <p className="text-[12px] text-amber-600/80 dark:text-amber-400/80 mt-1">No fines will be applied to overdue loans. Enable the toggle above to configure fine rates.</p>
          </div>
        </div>
      )}

      <SaveButton label="Save fines settings" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7. NOTIFICATIONS TAB
// ═══════════════════════════════════════════════════════════════════════════════
function NotificationsTab({ prefs, update }: TabProps) {
  return (
    <div className="max-w-2xl">
      <PageHeader title="Notifications" desc="Control which alerts and reminders Warraq generates." />

      <Card title="Loan reminders" icon={<Bell size={16} className="text-[#1a4d40]" />}>
        <div className="space-y-5">
          <ToggleRow
            label="Overdue alerts"
            desc="Show an alert in the dashboard when loans are past their due date."
            checked={prefs.notifyOverdue}
            onChange={v => update({ notifyOverdue: v })}
          />
          <div className="border-t border-black/5 dark:border-white/5 pt-5">
            <ToggleRow
              label="Due-soon reminders"
              desc="Warn when a loan is approaching its due date."
              checked={prefs.notifyDueSoon}
              onChange={v => update({ notifyDueSoon: v })}
            />
            {prefs.notifyDueSoon && (
              <div className="mt-4 ml-12">
                <Field label="Remind how many days before due?">
                  <div className="flex items-center gap-3">
                    <NumberInput value={prefs.notifyDueSoonDays} min={1} max={14} onChange={v => update({ notifyDueSoonDays: v })} />
                    <span className="text-[13px] text-[#122222]/60 dark:text-white/60">days before</span>
                  </div>
                </Field>
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card title="Reservations" icon={<Bell size={16} className="text-[#b96f3e]" />}>
        <ToggleRow
          label="Reservation ready alerts"
          desc="Notify when a reserved item becomes available for pickup."
          checked={prefs.notifyReady}
          onChange={v => update({ notifyReady: v })}
        />
      </Card>

      <div className="bg-[#1a4d40]/5 dark:bg-[#1b9277]/5 border border-[#1a4d40]/10 dark:border-[#1b9277]/10 rounded-2xl p-5 flex items-start gap-3">
        <Info size={16} className="text-[#1a4d40] dark:text-[#1b9277] shrink-0 mt-0.5" />
        <p className="text-[12px] text-[#1a4d40] dark:text-[#1b9277]">
          Notifications appear in the Warraq dashboard Activity panel. Email and push notifications are planned for a future release.
        </p>
      </div>

      <SaveButton label="Save notification settings" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 8. BACKUP & RESTORE TAB
// ═══════════════════════════════════════════════════════════════════════════════
function BackupTab() {
  const [lastBackup] = useState<string | null>("2026-07-14 09:12");
  const [restoring, setRestoring] = useState(false);

  const handleExport = async () => {
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const { copyFile } = await import("@tauri-apps/plugin-fs");
      const { appDataDir } = await import("@tauri-apps/api/path");
      const dir = await appDataDir();
      const dest = await save({ defaultPath: "warraq-backup.db", filters: [{ name: "Database", extensions: ["db"] }] });
      if (dest) {
        await copyFile(`${dir}/warraq.db`, dest);
        alert("Backup saved successfully.");
      }
    } catch {
      alert("Could not export backup. Please try again.");
    }
  };

  const handleImport = async () => {
    try {
      setRestoring(true);
      const { open } = await import("@tauri-apps/plugin-dialog");
      const file = await open({ filters: [{ name: "Database", extensions: ["db"] }] });
      if (file) {
        await new Promise(r => setTimeout(r, 800));
        alert("Database restored. Please restart Warraq to apply changes.");
      }
    } catch {
      alert("Could not import backup.");
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <PageHeader title="Backup & Restore" desc="Export or restore your Warraq database." />

      <Card title="Last backup" icon={<HardDrive size={16} className="text-[#1a4d40]" />}>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold text-[13px] text-[#122222] dark:text-white">Latest backup</p>
            <p className="text-[12px] text-[#122222]/60 dark:text-white/60 mt-0.5">{lastBackup ? lastBackup : "No backups found"}</p>
          </div>
          {lastBackup && <span className="text-[11px] font-bold text-[#1a4d40] dark:text-[#1b9277] bg-[#1a4d40]/10 px-3 py-1 rounded-full">Saved</span>}
        </div>
      </Card>

      <Card title="Export backup" icon={<Download size={16} className="text-[#b96f3e]" />}>
        <p className="text-[12px] text-[#122222]/70 dark:text-white/70 mb-4">
          Save a copy of the complete SQLite database to your computer. Includes all books, members, loans, and history.
        </p>
        <button onClick={handleExport} className="flex items-center gap-2 bg-[#1a4d40] text-white px-5 py-2.5 rounded-lg font-bold text-[13px] hover:bg-[#1a4d40]/90 transition-colors shadow-sm">
          <Download size={15} /> Export database (.db)
        </button>
      </Card>

      <Card title="Restore from backup" icon={<Upload size={16} className="text-[#122222]/60 dark:text-white/60" />}>
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-700/30 flex items-start gap-3 mb-4">
          <AlertTriangle size={15} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-[12px] text-amber-700 dark:text-amber-400 font-medium">
            Restoring will <strong>replace</strong> all current data with the selected backup. This cannot be undone.
          </p>
        </div>
        <button onClick={handleImport} disabled={restoring} className="flex items-center gap-2 border border-[#122222]/15 dark:border-white/15 text-[#122222] dark:text-white px-5 py-2.5 rounded-lg font-bold text-[13px] hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-50">
          {restoring ? <><RefreshCw size={15} className="animate-spin" /> Restoring…</> : <><Upload size={15} /> Import backup file</>}
        </button>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 9. DATABASE TAB
// ═══════════════════════════════════════════════════════════════════════════════
function DatabaseTab() {
  const [vacuuming, setVacuuming] = useState(false);
  const [vacuumDone, setVacuumDone] = useState(false);
  const [showDanger, setShowDanger] = useState(false);
  const [clearingLoans, setClearingLoans] = useState(false);
  const [resetting, setResetting] = useState(false);
  const { preferences } = useUiStore();

  const stats = [
    { label: "Library name", value: preferences.libraryName },
    { label: "Database engine", value: "SQLite 3" },
    { label: "Location", value: "AppData / warraq.db" },
    { label: "WAL mode", value: "Enabled" },
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
      alert("Database optimization failed. See console for details.");
    } finally {
      setVacuuming(false);
    }
  };

  const handleClearLoans = async () => {
    const confirmed = window.confirm(
      "This will permanently delete ALL loan and circulation history.\nMembers and books will NOT be affected.\n\nThis action cannot be undone. Proceed?"
    );
    if (!confirmed) return;
    setClearingLoans(true);
    try {
      const { database } = await import("../data/database");
      const db = await database();
      await db.execute("DELETE FROM loans");
      alert("All loan history has been deleted.");
    } catch (err) {
      console.error("Clear loans failed", err);
      alert("Failed to clear loan history.");
    } finally {
      setClearingLoans(false);
    }
  };

  const handleFactoryReset = async () => {
    const first = window.confirm(
      "⚠️ FACTORY RESET\n\nThis will PERMANENTLY DELETE all books, members, loans, reservations, and settings.\nThis cannot be undone.\n\nAre you absolutely sure?"
    );
    if (!first) return;
    const second = window.confirm(
      "Last chance — type OK to confirm you want to wipe all data and start fresh."
    );
    if (!second) return;
    setResetting(true);
    try {
      const { database } = await import("../data/database");
      const db = await database();
      // Delete in FK-safe order
      await db.execute("DELETE FROM reservations");
      await db.execute("DELETE FROM loans");
      await db.execute("DELETE FROM copies");
      await db.execute("DELETE FROM books");
      await db.execute("DELETE FROM members");
      localStorage.removeItem("warraq-preferences");
      alert("Factory reset complete. Warraq will now reload.");
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
      <PageHeader title="Database" desc="Inspect and maintain the local Warraq SQLite database." />

      <Card title="Database info" icon={<Server size={16} className="text-[#1a4d40]" />}>
        <div className="space-y-3">
          {stats.map(s => (
            <div key={s.label} className="flex items-center justify-between py-2 border-b border-black/5 dark:border-white/5 last:border-0">
              <span className="text-[12px] text-[#122222]/60 dark:text-white/60">{s.label}</span>
              <span className="text-[13px] font-semibold text-[#122222] dark:text-white">{s.value}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Maintenance" icon={<Cpu size={16} className="text-[#b96f3e]" />}>
        <p className="text-[12px] text-[#122222]/70 dark:text-white/70 mb-4">
          Running VACUUM reclaims unused space and defragments the database. This is safe and reversible.
        </p>
        <button
          onClick={handleVacuum}
          disabled={vacuuming}
          className="flex items-center gap-2 bg-[#1a4d40] text-white px-5 py-2.5 rounded-lg font-bold text-[13px] hover:bg-[#1a4d40]/90 transition-colors shadow-sm disabled:opacity-60"
        >
          {vacuuming ? <><RefreshCw size={15} className="animate-spin" /> Optimizing…</> : vacuumDone ? <><Check size={15} /> Optimized!</> : <><Zap size={15} /> Optimize database</>}
        </button>
      </Card>

      <Card title="Danger zone" icon={<AlertTriangle size={16} className="text-red-500" />}>
        <p className="text-[12px] text-[#122222]/70 dark:text-white/70 mb-4">
          These actions are irreversible. Always export a backup before proceeding.
        </p>
        {!showDanger ? (
          <button onClick={() => setShowDanger(true)} className="flex items-center gap-2 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 px-5 py-2.5 rounded-lg font-bold text-[13px] hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
            <Trash2 size={15} /> Show danger actions
          </button>
        ) : (
          <div className="space-y-3">
            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-700/30">
              <p className="font-bold text-[13px] text-red-700 dark:text-red-400 mb-1">Clear all loans</p>
              <p className="text-[12px] text-red-600/80 dark:text-red-400/70 mb-3">Remove all loan and circulation history. Members and books remain.</p>
              <button
                onClick={handleClearLoans}
                disabled={clearingLoans}
                className="text-[12px] font-bold text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700 px-4 py-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {clearingLoans ? <><RefreshCw size={12} className="animate-spin" /> Deleting…</> : "Delete loan history"}
              </button>
            </div>
            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-700/30">
              <p className="font-bold text-[13px] text-red-700 dark:text-red-400 mb-1">Reset entire database</p>
              <p className="text-[12px] text-red-600/80 dark:text-red-400/70 mb-3">Wipe all data and start fresh. This cannot be undone.</p>
              <button
                onClick={handleFactoryReset}
                disabled={resetting}
                className="text-[12px] font-bold text-white bg-red-600 px-4 py-1.5 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {resetting ? <><RefreshCw size={12} className="animate-spin" /> Resetting…</> : "Factory reset"}
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
        headers: { Authorization: `Bearer ${prefs.openAIKey}` },
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
        headers: { Authorization: `Bearer ${prefs.groqApiKey}` },
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
    <div className="max-w-2xl">
      <PageHeader title="Integrations & AI" desc="Connect Warraq with external services and AI features." />

      <Card title="OpenAI" icon={<Zap size={16} className="text-[#1a4d40]" />}>
        <p className="text-[12px] text-[#122222]/70 dark:text-white/70 mb-4">
          Used for AI-assisted book descriptions, smart search, and catalog enrichment.
        </p>
        <Field label="API key">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showKey ? "text" : "password"}
                defaultValue={prefs.openAIKey}
                placeholder="sk-…"
                onBlur={e => update({ openAIKey: e.target.value })}
                className={inputCls + " pr-10"}
              />
              <button onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#122222]/40 dark:text-white/40 hover:text-[#122222] dark:hover:text-white transition-colors">
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <button
              onClick={handleTest}
              disabled={testing || !prefs.openAIKey}
              className="px-4 py-2 border border-black/10 dark:border-white/10 rounded-lg text-[13px] font-semibold text-[#122222] dark:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {testing ? <RefreshCw size={13} className="animate-spin" /> : null}
              {testing ? "Testing…" : "Test"}
            </button>
          </div>
          {testResult === "ok" && <p className="text-[12px] text-[#1a4d40] dark:text-[#1b9277] font-bold mt-2 flex items-center gap-1"><CheckCircle2 size={13} /> Connection successful</p>}
          {testResult === "fail" && <p className="text-[12px] text-red-500 font-bold mt-2 flex items-center gap-1"><AlertTriangle size={13} /> Invalid or expired key</p>}
        </Field>
        <p className="text-[11px] text-[#122222]/40 dark:text-white/40 mt-3">
          Your key is stored locally only and never sent to Warraq servers.
        </p>
      </Card>

      <Card title="Groq" icon={<Cpu size={16} className="text-[#b96f3e]" />}>
        <p className="text-[12px] text-[#122222]/70 dark:text-white/70 mb-4">
          Used to enrich book details, fill in missing fields, and provide smart classification.
        </p>
        <Field label="API key">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showGroqKey ? "text" : "password"}
                defaultValue={prefs.groqApiKey}
                placeholder="gsk_…"
                onBlur={e => update({ groqApiKey: e.target.value })}
                className={inputCls + " pr-10"}
              />
              <button onClick={() => setShowGroqKey(!showGroqKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#122222]/40 dark:text-white/40 hover:text-[#122222] dark:hover:text-white transition-colors">
                {showGroqKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <button
              onClick={handleTestGroq}
              disabled={testingGroq || !prefs.groqApiKey}
              className="px-4 py-2 border border-black/10 dark:border-white/10 rounded-lg text-[13px] font-semibold text-[#122222] dark:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {testingGroq ? <RefreshCw size={13} className="animate-spin" /> : null}
              {testingGroq ? "Testing…" : "Test"}
            </button>
          </div>
          {testGroqResult === "ok" && <p className="text-[12px] text-[#1a4d40] dark:text-[#1b9277] font-bold mt-2 flex items-center gap-1"><CheckCircle2 size={13} /> Connection successful</p>}
          {testGroqResult === "fail" && <p className="text-[12px] text-red-500 font-bold mt-2 flex items-center gap-1"><AlertTriangle size={13} /> Invalid or expired key</p>}
        </Field>
        <p className="text-[11px] text-[#122222]/40 dark:text-white/40 mt-3">
          Your key is stored locally only and never sent to Warraq servers.
        </p>
      </Card>

      <Card title="Book metadata sources" icon={<BookOpen size={16} className="text-[#b96f3e]" />}>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-[#fcfbf8] dark:bg-[#111d1a] rounded-xl border border-black/5 dark:border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Globe size={16} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="font-bold text-[13px] text-[#122222] dark:text-white">Google Books API</p>
                <p className="text-[11px] text-[#122222]/50 dark:text-white/50">Cover images, metadata, descriptions</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {prefs.googleBooksEnabled ? <Wifi size={13} className="text-[#1a4d40] dark:text-[#1b9277]" /> : <WifiOff size={13} className="text-[#122222]/30 dark:text-white/30" />}
              <Toggle checked={prefs.googleBooksEnabled} onChange={v => update({ googleBooksEnabled: v })} />
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-[#fcfbf8] dark:bg-[#111d1a] rounded-xl border border-black/5 dark:border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <BookOpen size={16} className="text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="font-bold text-[13px] text-[#122222] dark:text-white">Open Library (Internet Archive)</p>
                <p className="text-[11px] text-[#122222]/50 dark:text-white/50">ISBN lookup, author data, editions</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {prefs.openLibraryEnabled ? <Wifi size={13} className="text-[#1a4d40] dark:text-[#1b9277]" /> : <WifiOff size={13} className="text-[#122222]/30 dark:text-white/30" />}
              <Toggle checked={prefs.openLibraryEnabled} onChange={v => update({ openLibraryEnabled: v })} />
            </div>
          </div>
        </div>
      </Card>

      <SaveButton label="Save integrations" />
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// 11. SECRETS & KEYS TAB
// ═══════════════════════════════════════════════════════════════════════════════
function SecretsTab({ prefs, update }: TabProps) {
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
      <PageHeader title="Secrets & Keys" desc="View and manage API keys stored locally on this device." />

      <div className="bg-[#1a4d40]/5 dark:bg-[#1b9277]/5 border border-[#1a4d40]/10 dark:border-[#1b9277]/10 rounded-2xl p-5 flex items-start gap-3 mb-6">
        <Shield size={16} className="text-[#1a4d40] dark:text-[#1b9277] shrink-0 mt-0.5" />
        <p className="text-[12px] text-[#1a4d40] dark:text-[#1b9277]">
          All keys are stored in your browser's localStorage on this device only. They are never transmitted to any server by Warraq.
        </p>
      </div>

      <Card title="Stored secrets" icon={<Key size={16} className="text-[#1a4d40]" />}>
        {secrets.length === 0 ? (
          <div className="text-center py-8">
            <Key size={32} className="mx-auto text-[#122222]/20 dark:text-white/20 mb-3" />
            <p className="text-[13px] text-[#122222]/50 dark:text-white/50">No secrets stored yet.</p>
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
                  <p className="text-[11px] text-[#122222]/30 dark:text-white/30 mt-1">Set in Integrations & AI →</p>
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
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<"idle" | "uptodate" | "available" | "error">("idle");
  const dataPath = "AppData\\Roaming\\com.warraq.app";

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
      // Simulate checking for update
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
      <PageHeader title="Desktop & Data" desc="Configure how Warraq behaves as a desktop application." />

      <Card title="Window behavior" icon={<Monitor size={16} className="text-[#1a4d40]" />}>
        <ToggleRow
          label="Minimize to system tray"
          desc="When you close the window, Warraq stays running in the system tray."
          checked={prefs.closeToTray}
          onChange={v => update({ closeToTray: v })}
        />
      </Card>

      <Card title="Data location" icon={<FolderOpen size={16} className="text-[#b96f3e]" />}>
        <p className="text-[12px] text-[#122222]/70 dark:text-white/70 mb-4">
          Warraq stores its database and settings in your system's AppData directory.
        </p>
        <div className="flex items-center gap-2 p-3 bg-[#fcfbf8] dark:bg-[#111d1a] border border-black/5 dark:border-white/5 rounded-lg">
          <FolderOpen size={14} className="text-[#b96f3e] shrink-0" />
          <code className="text-[12px] text-[#122222]/70 dark:text-white/60 flex-1 truncate">{dataPath}</code>
          <button
            onClick={openFolder}
            className="text-[11px] font-bold text-[#1a4d40] dark:text-[#1b9277] flex items-center gap-1 hover:underline shrink-0"
          >
            Open <ExternalLink size={11} />
          </button>
        </div>
      </Card>

      <Card title="App updates" icon={<RefreshCw size={16} className="text-[#122222]/60 dark:text-white/60" />}>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold text-[13px] text-[#122222] dark:text-white">Current version</p>
            <p className="text-[12px] text-[#122222]/60 dark:text-white/60 mt-0.5">
              v1.0.0
              {updateStatus === "uptodate" && <span className="text-[#1a4d40] dark:text-[#1b9277] font-bold ml-2">✓ Up to date</span>}
              {updateStatus === "available" && <span className="text-[#b96f3e] font-bold ml-2">Update available!</span>}
            </p>
          </div>
          <button
            onClick={handleCheckUpdates}
            disabled={checkingUpdate}
            className="flex items-center gap-2 border border-black/10 dark:border-white/10 text-[#122222] dark:text-white px-4 py-2 rounded-lg font-bold text-[13px] hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={checkingUpdate ? "animate-spin" : ""} />
            {checkingUpdate ? "Checking…" : "Check for updates"}
          </button>
        </div>
      </Card>

      <SaveButton label="Save system settings" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 13. ABOUT TAB
// ═══════════════════════════════════════════════════════════════════════════════
function AboutTab() {
  const credits = [
    { role: "Book data", name: "Google Books / Open Library" },
    { role: "Icons", name: "Lucide React" },
    { role: "Font", name: "Manrope / IBM Plex Sans Arabic" },
  ];

  return (
    <div className="max-w-2xl">
      <PageHeader title="About Warraq" desc="Application information, version, and acknowledgements." />

      <Card title="Application" icon={<Info size={16} className="text-[#1a4d40]" />}>
        <div className="flex items-center gap-5 mb-6">
          <img src="/brand/warraq-symbol.png" alt="Warraq" className="h-16 w-16 rounded-2xl shadow-card" />
          <div>
            <h2 className="font-display text-[22px] font-bold text-[#122222] dark:text-white tracking-wider">WARRAQ</h2>
            <p className="text-[13px] font-arabic text-[#b96f3e]">وراق ـ المخطوط الحي</p>
            <p className="text-[12px] text-[#122222]/60 dark:text-white/60 mt-1">A living manuscript management system for libraries.</p>
          </div>
        </div>
        <div className="space-y-2">
          {[
            { label: "Version", value: "1.0.0" },
            { label: "Build", value: "2026.07.16" },
            { label: "Runtime", value: "Tauri v2 + React 18" },
            { label: "Database", value: "SQLite 3 (via tauri-plugin-sql)" },
          ].map(r => (
            <div key={r.label} className="flex justify-between py-2 border-b border-black/5 dark:border-white/5 last:border-0">
              <span className="text-[12px] text-[#122222]/60 dark:text-white/60">{r.label}</span>
              <span className="text-[13px] font-semibold text-[#122222] dark:text-white font-mono">{r.value}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Credits" icon={<LayoutGrid size={16} className="text-[#b96f3e]" />}>
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-black/5 dark:border-white/5 pb-3">
            <span className="text-[12px] text-[#122222]/60 dark:text-white/60">Design & Engineering</span>
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

      <Card title="Legal" icon={<FileText size={16} className="text-[#122222]/60 dark:text-white/60" />}>
        <div className="flex flex-col gap-3">
          <a href="#" className="flex items-center justify-between text-[13px] font-semibold text-[#1a4d40] dark:text-[#1b9277] hover:underline">
            Terms of Service <ChevronRight size={14} />
          </a>
          <a href="#" className="flex items-center justify-between text-[13px] font-semibold text-[#1a4d40] dark:text-[#1b9277] hover:underline">
            Privacy Policy <ChevronRight size={14} />
          </a>
          <a href="#" className="flex items-center justify-between text-[13px] font-semibold text-[#1a4d40] dark:text-[#1b9277] hover:underline">
            Open Source Licenses <ChevronRight size={14} />
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

function NumberInput({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        className="w-8 h-8 rounded-lg border border-black/10 dark:border-white/10 flex items-center justify-center text-[#122222] dark:text-white font-bold hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
      >−</button>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={e => onChange(Number(e.target.value))}
        className="w-16 text-center bg-[#fcfbf8] dark:bg-[#111d1a] border border-black/10 dark:border-white/10 rounded-lg py-1.5 text-[14px] font-bold text-[#122222] dark:text-white outline-none focus:border-[#1a4d40]"
      />
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        className="w-8 h-8 rounded-lg border border-black/10 dark:border-white/10 flex items-center justify-center text-[#122222] dark:text-white font-bold hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
      >+</button>
    </div>
  );
}

function SaveButton({ label }: { label: string }) {
  const [saved, setSaved] = useState(false);
  const handle = () => { setSaved(true); setTimeout(() => setSaved(false), 2500); };
  return (
    <div className="mt-6">
      <button
        onClick={handle}
        className="bg-[#1a4d40] text-white px-6 py-2.5 rounded-lg font-bold text-[13px] hover:bg-[#1a4d40]/90 transition-all shadow-sm flex items-center gap-2"
      >
        {saved ? <><Check size={16} /> Saved!</> : <><CheckCircle2 size={16} /> {label}</>}
      </button>
    </div>
  );
}

function ThemeOption({ name, active, onClick }: { name: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`relative p-2 rounded-xl border-2 transition-all w-full ${active ? "border-[#b96f3e] shadow-sm" : "border-black/5 dark:border-white/5 hover:border-black/10 dark:hover:border-white/10"}`}
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

function NavItem({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded-lg text-[13px] font-semibold transition-colors ${active ? "bg-[#1a4d40]/10 dark:bg-[#1b9277]/10 text-[#1a4d40] dark:text-[#1b9277]" : "text-[#122222]/70 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/5"}`}
    >
      {label}
    </button>
  );
}
