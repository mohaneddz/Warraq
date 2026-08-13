import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Settings as SettingsIcon, Search, CheckCircle2, ChevronRight,
  BookOpen, Database, UserCircle, Monitor, Globe, Bell,
  HardDrive, Info, Zap, Key, RefreshCw, Trash2, Download, Upload,
  Eye, EyeOff, Copy, Check, AlertTriangle, Clock, MapPin,
  FileText, Palette, Type, BookMarked,
  Server, Cpu, FolderOpen, ExternalLink, Wifi, WifiOff,
  LayoutGrid, Save, Users as UsersIcon, Plus, ShieldCheck, Ban, KeyRound, Pencil, Sparkles
} from "lucide-react";
import { useUiStore } from "../store/uiStore";
import { useLibrarySettingsStore } from "../store/librarySettingsStore";
import { useAuthStore } from "../store/authStore";
import { changeOwnPassword, listUsers, createUser, updateUser, resetPassword, deleteUser } from "../data/auth";
import { books as fetchAllBooks } from "../data/repositories/library";
import { findEnrichableBooks, enrichAllBooks, type EnrichProgress } from "../utils/enrichment";
import type { PublicUser, UserRole, UserStatus } from "../types";
import { Button, Input, Modal } from "../components/ui/primitives";
import { useTranslation } from "react-i18next";
import { useContextMenu } from "../components/ui/ContextMenu";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";


// ─── Types ────────────────────────────────────────────────────────────────────
type Tab =
  | "General" | "Library Profile" | "Localization" | "Appearance"
  | "Rules" | "Notifications"
  | "Backup & Restore" | "Database" | "Integrations & AI" | "Users"
  | "Desktop & Data" | "About";

const tabIcons: Record<Tab, React.ComponentType<{ size?: number; className?: string }>> = {
  "General": SettingsIcon,
  "Library Profile": MapPin,
  "Localization": Globe,
  "Appearance": Palette,
  "Rules": BookMarked,
  "Notifications": Bell,
  "Backup & Restore": HardDrive,
  "Database": Database,
  "Integrations & AI": Zap,
  "Users": UsersIcon,
  "Desktop & Data": Monitor,
  "About": Info,
};

// ─── Root Component ───────────────────────────────────────────────────────────
export function SettingsPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>("General");
  const [search, setSearch] = useState("");
  const { preferences, updatePreferences } = useUiStore();
  const { settings: librarySettings, update: updateLibrarySettings } = useLibrarySettingsStore();
  const isAdmin = useAuthStore((s) => s.user?.role === "admin");
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
        notifications: "Notifications",
        backup: "Backup & Restore",
        database: "Database",
        integrations: "Integrations & AI",
        secrets: "Integrations & AI",
        desktop: "Desktop & Data",
        about: "About",
        users: "Users"
      };
      const matched = tabMap[tabParam.toLowerCase()];
      if (matched) {
        setActiveTab(matched);
      }
    }
  }, [location.search]);

  const allTabs: { group: string; items: Tab[] }[] = [
    { group: "General", items: ["General", "Library Profile", "Localization", "Appearance"] },
    { group: "Circulation", items: ["Rules", "Notifications"] },
    { group: "Data & Security", items: ["Backup & Restore", "Database", "Integrations & AI", ...(isAdmin ? (["Users"] as Tab[]) : [])] },
    { group: "System", items: ["Desktop & Data", "About"] },
  ];

  const filtered = search.trim()
    ? allTabs.map(g => ({ ...g, items: g.items.filter(i => i.toLowerCase().includes(search.toLowerCase())) })).filter(g => g.items.length > 0)
    : allTabs;

  const { showContextMenu } = useContextMenu();


  const handleSettingsContextMenu = (e: React.MouseEvent) => {
    showContextMenu(e, [
      {
        id: "save-prefs",
        label: t("settings.saved", "Save Preferences"),
        icon: Check,
        variant: "accent",
        onClick: () => {
          updatePreferences(preferences);
          toast.success(t("settings.savedMsg", "Settings saved successfully"));
        },
      },
      { divider: true },
      {
        id: "tab-general",
        label: t("settings.groups.general", "General Settings"),
        icon: SettingsIcon,
        onClick: () => setActiveTab("General"),
      },
      {
        id: "tab-appearance",
        label: t("settings.tabs.appearance", "Appearance & Theme"),
        icon: Palette,
        onClick: () => setActiveTab("Appearance"),
      },
      {
        id: "tab-backup",
        label: t("settings.tabs.backuprestore", "Backup & Restore"),
        icon: HardDrive,
        onClick: () => setActiveTab("Backup & Restore"),
      },
    ], { title: t("settings.title", "Application Settings") });
  };

  return (
    <div onContextMenu={handleSettingsContextMenu} className="flex h-full w-full">

      {/* ── Left Nav ─────────────────────────────────────────────────────────── */}
      <div className="w-[260px] shrink-0 border-r border-black/5 dark:border-white/5 pr-6 mr-6 flex flex-col h-full overflow-y-auto no-scrollbar">
        <div className="flex items-center gap-2.5 mb-6 text-[#b96f3e]">
          <h1 className="font-display text-[28px] font-bold text-[#122222] dark:text-white leading-tight">{t("nav.settings")}</h1>
        </div>

        {/* Small left padding + an inset focus ring so the ring can't be clipped by the nav's
            overflow-y-auto (which was cropping the input's left edge when focused). */}
        <div className="relative mb-6 px-0.5">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#122222]/40 dark:text-white/40 pointer-events-none" />
          <input
            type="text"
            placeholder={t("settings.searchPlaceholder") || "Search settings..."}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white dark:bg-[#1d2926] border border-black/10 dark:border-white/10 rounded-lg py-2 pl-9 pr-3 text-[13px] text-[#122222] dark:text-[#f0ebe1] outline-none focus:border-[#1a4d40] focus:ring-2 focus:ring-inset focus:ring-[#1a4d40]/20"
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
          {activeTab === "General" && <GeneralTab prefs={librarySettings} update={updateLibrarySettings} localPrefs={preferences} updateLocal={updatePreferences} />}
          {activeTab === "Library Profile" && <LibraryProfileTab prefs={librarySettings} update={updateLibrarySettings} />}
          {activeTab === "Localization" && <LocalizationTab prefs={librarySettings} update={updateLibrarySettings} localPrefs={preferences} updateLocal={updatePreferences} />}
          {activeTab === "Appearance" && <AppearanceTab prefs={preferences} update={updatePreferences} />}
          {activeTab === "Rules" && <RulesTab prefs={librarySettings} update={updateLibrarySettings} />}

          {activeTab === "Notifications" && <NotificationsTab prefs={librarySettings} update={updateLibrarySettings} />}
          {activeTab === "Backup & Restore" && <BackupTab />}
          {activeTab === "Database" && <DatabaseTab />}
          {activeTab === "Integrations & AI" && <IntegrationsTab prefs={preferences} update={updatePreferences} />}
          {activeTab === "Users" && isAdmin && <UsersTab />}
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
import type { Preferences, LibrarySettings } from "../types";
type TabProps = { prefs: Preferences; update: (v: Partial<Preferences>) => void };
type LibraryTabProps = { prefs: LibrarySettings; update: (v: Partial<LibrarySettings>) => Promise<void> };

// ═══════════════════════════════════════════════════════════════════════════════
// 1. GENERAL TAB
// ═══════════════════════════════════════════════════════════════════════════════
function GeneralTab({ prefs, update, localPrefs, updateLocal }: LibraryTabProps & { localPrefs: Preferences; updateLocal: (v: Partial<Preferences>) => void }) {
  const { t } = useTranslation();
  return (
    <div className="max-w-2xl">
      <PageHeader title={t("settings.general.title")} desc={t("settings.general.desc")} />

      <Card title={t("settings.general.identityTitle")} icon={<SettingsIcon size={16} className="text-[#1a4d40]" />}>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <Field label={t("settings.general.libName")}>
            <input type="text" defaultValue={prefs.library_name} onBlur={e => update({ library_name: e.target.value })} className={inputCls} />
          </Field>
          <Field label={t("settings.general.shortName")}>
            <input type="text" defaultValue={prefs.library_short_name} placeholder={t("settings.general.shortNamePlaceholder")} onBlur={e => update({ library_short_name: e.target.value })} className={inputCls} />
          </Field>
        </div>
      </Card>

      <AccountCard />

      <Card title={t("settings.general.autosaveTitle")} icon={<Save size={16} className="text-[#122222]/60 dark:text-white/60" />}>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold text-[13px] text-[#122222] dark:text-white">{t("settings.general.autosaveLabel")}</p>
            <p className="text-[12px] text-[#122222]/60 dark:text-white/60 mt-0.5">{t("settings.general.autosaveDesc")}</p>
          </div>
          <Toggle checked={localPrefs.autosaveEnabled} onChange={v => updateLocal({ autosaveEnabled: v })} />
        </div>
        {localPrefs.autosaveEnabled && (
          <div className="mt-4 pt-4 border-t border-black/5 dark:border-white/5">
            <Field label={t("settings.general.autosaveInterval")}>
              <input type="number" min={10} max={600} defaultValue={localPrefs.autosaveInterval} onBlur={e => updateLocal({ autosaveInterval: Number(e.target.value) })} className={inputCls + " w-32"} />
            </Field>
          </div>
        )}
      </Card>

      <SaveButton label={t("settings.general.saveBtn")} />
    </div>
  );
}

// ─── Signed-in account card (shown in General tab) ─────────────────────────────
function AccountCard() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [changing, setChanging] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setChanging(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error(t("settings.account.passwordTooShort"));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t("settings.account.passwordMismatch"));
      return;
    }
    setSubmitting(true);
    try {
      await changeOwnPassword(currentPassword, newPassword);
      toast.success(t("settings.account.passwordChanged"));
      resetForm();
    } catch (err: any) {
      toast.error(err.message || String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card title={t("settings.account.title")} icon={<UserCircle size={16} className="text-[#b96f3e]" />}>
      <div className="flex items-center gap-4 mb-4">
        {user?.avatar_path ? (
          <img src={user.avatar_path} alt="" className="h-12 w-12 rounded-full object-cover shrink-0" />
        ) : (
          <div className="h-12 w-12 rounded-full bg-[#b96f3e] text-white flex items-center justify-center text-[14px] font-bold shrink-0">
            {(user?.full_name || "?").substring(0, 2).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="font-bold text-[14px] text-[#122222] dark:text-white truncate">{user?.full_name}</p>
          <p className="text-[12px] text-[#122222]/60 dark:text-white/60 truncate">
            @{user?.username} · {user?.role === "admin" ? t("settings.account.roleAdmin") : t("settings.account.roleStaff")}
          </p>
        </div>
      </div>

      {!changing ? (
        <Button variant="secondary" onClick={() => setChanging(true)}>{t("settings.account.changePassword")}</Button>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3 pt-3 border-t border-black/5 dark:border-white/5">
          <Field label={t("settings.account.currentPassword")}>
            <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className={inputCls} required autoFocus />
          </Field>
          <Field label={t("settings.account.newPassword")}>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className={inputCls} required minLength={8} />
          </Field>
          <Field label={t("settings.account.confirmPassword")}>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={inputCls} required minLength={8} />
          </Field>
          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={submitting}>{submitting ? t("settings.account.saving") : t("settings.account.savePassword")}</Button>
            <Button type="button" variant="ghost" onClick={resetForm}>{t("catalog.addModal.cancel")}</Button>
          </div>
        </form>
      )}
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. LIBRARY PROFILE TAB
// ═══════════════════════════════════════════════════════════════════════════════
function LibraryProfileTab({ prefs, update }: LibraryTabProps) {
  const { t } = useTranslation();
  return (
    <div className="max-w-2xl">
      <PageHeader title={t("settings.profile.title")} desc={t("settings.profile.desc")} />

      <Card title={t("settings.profile.contactTitle")} icon={<MapPin size={16} className="text-[#1a4d40]" />}>
        <div className="space-y-4">
          <Field label={t("settings.profile.address")}>
            <input type="text" defaultValue={prefs.library_address} placeholder={t("settings.profile.addressPlaceholder")} onBlur={e => update({ library_address: e.target.value })} className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t("settings.profile.city")}>
              <input type="text" defaultValue={prefs.library_city} placeholder={t("settings.profile.cityPlaceholder")} onBlur={e => update({ library_city: e.target.value })} className={inputCls} />
            </Field>
            <Field label={t("settings.profile.phone")}>
              <input type="tel" defaultValue={prefs.library_phone} placeholder={t("settings.profile.phonePlaceholder")} onBlur={e => update({ library_phone: e.target.value })} className={inputCls} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t("settings.profile.email")}>
              <input type="email" defaultValue={prefs.library_email} placeholder={t("settings.profile.emailPlaceholder")} onBlur={e => update({ library_email: e.target.value })} className={inputCls} />
            </Field>
            <Field label={t("settings.profile.website")}>
              <input type="url" defaultValue={prefs.library_website} placeholder={t("settings.profile.websitePlaceholder")} onBlur={e => update({ library_website: e.target.value })} className={inputCls} />
            </Field>
          </div>
        </div>
      </Card>

      <Card title={t("settings.profile.aboutTitle")} icon={<FileText size={16} className="text-[#b96f3e]" />}>
        <div className="space-y-4">
          <Field label={t("settings.profile.description")}>
            <textarea
              rows={4}
              defaultValue={prefs.library_description}
              placeholder={t("settings.profile.descriptionPlaceholder")}
              onBlur={e => update({ library_description: e.target.value })}
              className={inputCls + " resize-none"}
            />
          </Field>
          <Field label={t("settings.profile.hours")}>
            <input type="text" defaultValue={prefs.library_hours} placeholder={t("settings.profile.hoursPlaceholder")} onBlur={e => update({ library_hours: e.target.value })} className={inputCls} />
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
function LocalizationTab({ prefs, update, localPrefs, updateLocal }: LibraryTabProps & { localPrefs: Preferences; updateLocal: (v: Partial<Preferences>) => void }) {
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
    updateLocal({ locale: code });
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
                localPrefs.locale === lang.code
                  ? "border-[#b96f3e] bg-[#b96f3e]/5 scale-[1.02]"
                  : "border-transparent bg-[#122222]/[0.03] dark:bg-[#ffffff]/[0.03]"
              } hover:brightness-90 hover:scale-[0.98] active:scale-[1.02] active:brightness-110`}
            >
              <div className="text-[18px] mb-2">{lang.code === "en" ? "🇬🇧" : lang.code === "fr" ? "🇫🇷" : "🇩🇿"}</div>
              <div className="font-bold text-[13px] text-[#122222] dark:text-white">{lang.label}</div>
              <div className="text-[11px] text-[#122222]/50 dark:text-white/50">{lang.native}</div>
              {localPrefs.locale === lang.code && <div className="mt-2 flex items-center gap-1 text-[11px] font-bold text-[#b96f3e]"><CheckCircle2 size={12} /> {t("status.active", "Active")}</div>}
            </button>
          ))}
        </div>
        {localPrefs.locale === "ar" && (
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
                onClick={() => update({ date_format: f })}
                className={`flex-1 py-2 px-3 rounded-lg border border-solid transition-all cursor-pointer ${
                  prefs.date_format === f
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
function RulesTab({ prefs, update }: LibraryTabProps) {
  const { t } = useTranslation();
  return (
    <div className="max-w-2xl">
      <PageHeader title={t("settings.rules.title")} desc={t("settings.rules.desc")} />

      <Card title={t("settings.rules.paramsTitle")} icon={<BookMarked size={16} className="text-[#1a4d40] dark:text-[#1b9277]" />}>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <Field label={t("settings.rules.loanPeriod")}>
            <NumberInput value={prefs.loan_days} min={1} max={365} onChange={v => update({ loan_days: v })} />
          </Field>
          <Field label={t("settings.rules.loanLimit")}>
            <NumberInput value={prefs.loan_limit} min={1} max={50} onChange={v => update({ loan_limit: v })} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label={t("settings.rules.renewLimit")}>
            <NumberInput value={prefs.renew_limit} min={0} max={10} onChange={v => update({ renew_limit: v })} />
          </Field>
          <Field label={t("settings.rules.holdPeriod")}>
            <NumberInput value={prefs.reservation_hold_days} min={1} max={30} onChange={v => update({ reservation_hold_days: v })} />
          </Field>
        </div>
      </Card>

      <Card title={t("settings.rules.scopeDurationsTitle", "Internal / External Durations")} icon={<Clock size={16} className="text-[#1a4d40] dark:text-[#1b9277]" />}>
        <div className="grid grid-cols-2 gap-4">
          <Field label={t("settings.rules.internalDays", "Internal loan duration (days)")}>
            <NumberInput value={prefs.reservation_internal_days} min={1} max={7} onChange={v => update({ reservation_internal_days: v })} />
          </Field>
          <Field label={t("settings.rules.externalDays", "External loan duration (days)")}>
            <NumberInput value={prefs.reservation_external_days} min={1} max={90} onChange={v => update({ reservation_external_days: v })} />
          </Field>
        </div>
        <p className="text-[11px] text-[#122222]/50 dark:text-white/50 mt-3">
          {t("settings.rules.scopeDurationsHelp", "Internal reservations stay in the library (read-in-place); external reservations are taken home. Visitors and single-copy titles can only be reserved internally.")}
        </p>
      </Card>

      <Card title={t("settings.rules.shelvingTitle", "Shelving")} icon={<BookMarked size={16} className="text-[#1a4d40] dark:text-[#1b9277]" />}>
        <Field label={t("settings.rules.shelfRowCount", "Shelf rows per bookcase column (A–…)")}>
          <NumberInput value={prefs.shelf_row_count} min={1} max={20} onChange={v => update({ shelf_row_count: v })} />
        </Field>
        <p className="text-[11px] text-[#122222]/50 dark:text-white/50 mt-3">
          {t("settings.rules.shelfRowCountHelp", "Every bookcase column gets a ground-level shelf plus this many lettered rows (A, B, C…), stacked bottom to top. Raise this if your bookcases are taller — existing columns keep their current rows.")}
        </p>
      </Card>

      <Card title={t("settings.rules.gracePeriodTitle", "Grace Period")} icon={<Clock size={16} className="text-[#1a4d40] dark:text-[#1b9277]" />}>
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-black/5 dark:border-white/5">
          <div>
            <p className="font-bold text-[13px] text-[#122222] dark:text-white">{t("settings.rules.enableGracePeriod")}</p>
            <p className="text-[12px] text-[#122222]/60 dark:text-white/60 mt-0.5">{t("settings.rules.enableGracePeriodDesc")}</p>
          </div>
          <Toggle checked={prefs.grace_period_enabled} onChange={v => update({ grace_period_enabled: v })} />
        </div>
        <div className={`transition-all duration-200 ${prefs.grace_period_enabled ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
          <Field label={t("settings.rules.gracePeriodLength")}>
            <NumberInput value={prefs.grace_period_days} min={1} max={14} disabled={!prefs.grace_period_enabled} onChange={v => update({ grace_period_days: v })} />
          </Field>
        </div>
      </Card>

      <SaveButton label={t("settings.rules.saveBtn")} />
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// 7. NOTIFICATIONS TAB
// ═══════════════════════════════════════════════════════════════════════════════
function NotificationsTab({ prefs, update }: LibraryTabProps) {
  const { t } = useTranslation();
  return (
    <div className="max-w-2xl">
      <PageHeader title={t("settings.notifications.title")} desc={t("settings.notifications.desc")} />

      <Card title={t("settings.notifications.remindersTitle")} icon={<Bell size={16} className="text-[#1a4d40]" />}>
        <div className="space-y-5">
          <ToggleRow
            label={t("settings.notifications.overdueAlerts")}
            desc={t("settings.notifications.overdueAlertsDesc")}
            checked={prefs.notify_overdue}
            onChange={v => update({ notify_overdue: v })}
          />
          <div className="border-t border-black/5 dark:border-white/5 pt-5">
            <ToggleRow
              label={t("settings.notifications.dueSoonReminders")}
              desc={t("settings.notifications.dueSoonRemindersDesc")}
              checked={prefs.notify_due_soon}
              onChange={v => update({ notify_due_soon: v })}
            />
            {prefs.notify_due_soon && (
              <div className="mt-4 ml-12">
                <Field label={t("settings.notifications.dueSoonDays")}>
                  <div className="flex items-center gap-3">
                    <NumberInput value={prefs.notify_due_soon_days} min={1} max={14} onChange={v => update({ notify_due_soon_days: v })} />
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
          checked={prefs.notify_ready}
          onChange={v => update({ notify_ready: v })}
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
  const [importingBooks, setImportingBooks] = useState(false);
  const [importingMembers, setImportingMembers] = useState(false);
  const [exportingBackup, setExportingBackup] = useState(false);
  const [importingBackup, setImportingBackup] = useState(false);

  const handleExportFullBackup = async () => {
    try {
      setExportingBackup(true);
      const { save } = await import("@tauri-apps/plugin-dialog");
      const { writeTextFile } = await import("@tauri-apps/plugin-fs");
      const { exportLibraryBackup } = await import("../data/repositories/library");

      const path = await save({
        defaultPath: `warraq-backup-${new Date().toISOString().slice(0, 10)}.json`,
        filters: [{ name: "JSON", extensions: ["json"] }]
      });
      if (!path) return;

      const backup = await exportLibraryBackup();
      await writeTextFile(path, JSON.stringify(backup, null, 2));
      toast.success(t("settings.backup.fullExportSuccess", "Full library backup saved successfully.") as string, {
        duration: 8000,
        action: {
          label: t("common.openFolder", "Open folder") as string,
          onClick: () => { void import("@tauri-apps/plugin-opener").then(({ revealItemInDir }) => revealItemInDir(path)).catch(() => {}); },
        },
      });
    } catch (err: any) {
      console.error(err);
      toast.error(t("settings.backup.fullExportError", "Could not export backup: {{error}}", { error: err.message || String(err) }) as string);
    } finally {
      setExportingBackup(false);
    }
  };

  const handleImportFullBackup = async () => {
    if (!confirm(t("settings.backup.fullRestoreWarn", "This restores every row from the backup file (rooms, shelves, books, copies, members, reservations, loans) by ID, overwriting anything that already exists with the same ID. Continue?") as string)) {
      return;
    }
    try {
      setImportingBackup(true);
      const { open } = await import("@tauri-apps/plugin-dialog");
      const { readTextFile } = await import("@tauri-apps/plugin-fs");
      const { importLibraryBackup } = await import("../data/repositories/library");

      const file = await open({ filters: [{ name: "JSON", extensions: ["json"] }] });
      if (!file) return;

      const text = await readTextFile(file);
      const backup = JSON.parse(text);
      if (!backup?.tables || typeof backup.tables !== "object") {
        toast.error(t("settings.backup.fullRestoreInvalidFile", "Invalid backup file: missing tables.") as string);
        return;
      }

      const counts = await importLibraryBackup(backup);
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      toast.success(t("settings.backup.fullRestoreSuccess", "Restored {{count}} rows from backup.", { count: total }) as string);
    } catch (err: any) {
      console.error(err);
      toast.error(t("settings.backup.fullRestoreError", "Could not import backup: {{error}}", { error: err.message || String(err) }) as string);
    } finally {
      setImportingBackup(false);
    }
  };

  const handleImportBooks = async () => {
    try {
      setImportingBooks(true);
      const { open } = await import("@tauri-apps/plugin-dialog");
      const { readTextFile } = await import("@tauri-apps/plugin-fs");
      const { saveBook } = await import("../data/repositories/library");

      const file = await open({ filters: [{ name: "JSON", extensions: ["json"] }] });
      if (!file) return;

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
            item_type: item.item_type || "book",
            subtitle: item.subtitle || null,
            arabic_title: item.arabic_title || null,
            author: item.author || null,
            isbn10: item.isbn10 || (item.isbn && item.isbn.length === 10 ? item.isbn : null),
            isbn13: item.isbn13 || (item.isbn && item.isbn.length === 13 ? item.isbn : null),
            publisher: item.publisher || null,
            category: item.category || null,
            description: item.description || null,
            language: item.language || "French",
            call_number: item.call_number || null,
            dewey_code: item.dewey_code || null,
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
      const { saveMember } = await import("../data/repositories/library");

      const file = await open({ filters: [{ name: "JSON", extensions: ["json"] }] });
      if (!file) return;

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
            role: item.role || "visitor",
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

      <div className="bg-[#1a4d40]/5 dark:bg-[#1b9277]/5 border border-[#1a4d40]/10 dark:border-[#1b9277]/10 rounded-2xl p-5 flex items-start gap-3 mb-6">
        <Info size={16} className="text-[#1a4d40] dark:text-[#1b9277] shrink-0 mt-0.5" />
        <p className="text-[12px] text-[#1a4d40] dark:text-[#1b9277] leading-relaxed">
          {t("settings.backup.supabaseNote2", "Warraq's data lives in Supabase, which handles automated database backups on its own. The full backup below is for taking your own local copy — e.g. before a risky change — and covers rooms, shelves, books, copies, members, reservations, and loans.")}
        </p>
      </div>

      <Card title={t("settings.backup.fullBackupTitle", "Full library backup")} icon={<HardDrive size={16} className="text-[#1a4d40] dark:text-[#1b9277]" />}>
        <p className="text-[12px] text-[#122222]/70 dark:text-white/70 mb-4 font-normal">
          {t("settings.backup.fullBackupDesc", "Export every catalog and circulation record to a single JSON file, or restore from one. Restoring re-inserts rows by their original ID, so it's meant for putting data back exactly as it was — not merging with unrelated data.")}
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleExportFullBackup}
            disabled={exportingBackup || importingBackup}
            className="flex items-center gap-2 bg-[#1a4d40] text-white px-5 py-2.5 rounded-lg font-bold text-[13px] hover:bg-[#1a4d40]/90 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
          >
            {exportingBackup ? <RefreshCw size={15} className="animate-spin" /> : <Download size={15} />}
            {t("settings.backup.fullExportBtn", "Export full backup")}
          </button>
          <button
            onClick={handleImportFullBackup}
            disabled={exportingBackup || importingBackup}
            className="flex items-center gap-2 border border-[#1a4d40]/25 text-[#1a4d40] dark:text-[#1b9277] dark:border-[#1b9277]/25 px-5 py-2.5 rounded-lg font-bold text-[13px] hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {importingBackup ? <RefreshCw size={15} className="animate-spin" /> : <Upload size={15} />}
            {t("settings.backup.fullRestoreBtn", "Restore from backup")}
          </button>
        </div>
      </Card>

      <Card title={t("settings.backup.importBooksTitle", "Import books")} icon={<BookOpen size={16} className="text-[#1a4d40] dark:text-[#1b9277]" />}>
        <p className="text-[12px] text-[#122222]/70 dark:text-white/70 mb-4 font-normal">
          {t("settings.backup.importBooksDescJson", "Import books from a JSON file containing an array of book objects.")}
        </p>
        <button
          onClick={handleImportBooks}
          disabled={importingBooks || importingMembers}
          className="flex items-center gap-2 bg-[#1a4d40] text-white px-5 py-2.5 rounded-lg font-bold text-[13px] hover:bg-[#1a4d40]/90 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
        >
          {importingBooks ? <RefreshCw size={15} className="animate-spin" /> : <Download size={15} className="rotate-180" />}
          {t("settings.backup.importBooks")}
        </button>
      </Card>

      <Card title={t("settings.backup.importMembersTitle", "Import members")} icon={<UserCircle size={16} className="text-[#b96f3e]" />}>
        <p className="text-[12px] text-[#122222]/70 dark:text-white/70 mb-4 font-normal">
          {t("settings.backup.importMembersDescJson", "Import library members from a JSON file containing an array of member objects.")}
        </p>
        <button
          onClick={handleImportMembers}
          disabled={importingBooks || importingMembers}
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
  const [showDanger, setShowDanger] = useState(false);
  const [clearingLoans, setClearingLoans] = useState(false);
  const [resetting, setResetting] = useState(false);
  const { settings: librarySettings } = useLibrarySettingsStore();

  // Guard against VITE_SUPABASE_URL being undefined — a bare `.replace` here would throw and crash
  // the whole Database tab render.
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "";
  const stats = [
    { label: t("settings.database.infoName"), value: librarySettings.library_name },
    { label: t("settings.database.infoEngine"), value: "Supabase (Postgres)" },
    { label: t("settings.database.infoLocation"), value: supabaseUrl ? supabaseUrl.replace("https://", "") : "—" },
  ];

  const handleClearLoans = async () => {
    const confirmed = window.confirm(t("settings.database.clearLoansConfirm"));
    if (!confirmed) return;
    setClearingLoans(true);
    try {
      const { supabase } = await import("../data/supabaseClient");
      const { error } = await supabase.from("loans").delete().not("id", "is", null);
      if (error) throw error;
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
      // Use the shared, FK-safe wipe (children before parents across every backed-up table)
      // instead of a partial hand-written delete list that both left reference data behind and
      // could fail on foreign keys (e.g. deleting books while book_authors still reference them).
      const { deleteAllLibraryData } = await import("../data/repositories/library");
      await deleteAllLibraryData();
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
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [visibleKey, setVisibleKey] = useState<string | null>(null);

  const secrets = [
    { id: "groq", label: t("settings.integrations.groqKey") || "Groq API Key", value: prefs.groqApiKey, placeholder: t("settings.secrets.secretPlaceholder") || "Not set", onClear: () => update({ groqApiKey: "" }) },
  ];

  const handleCopyKey = (id: string, value: string) => {
    void navigator.clipboard.writeText(value);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const [showGroqKey, setShowGroqKey] = useState(false);
  const [testingGroq, setTestingGroq] = useState(false);
  const [testGroqResult, setTestGroqResult] = useState<"ok" | "fail" | "invalid" | null>(null);

  const [enriching, setEnriching] = useState(false);
  const [enrichLog, setEnrichLog] = useState<EnrichProgress[]>([]);
  const [enrichTotal, setEnrichTotal] = useState(0);
  const enrichCancelRef = useRef(false);

  const handleStartEnrichment = async () => {
    const confirmed = confirm(
      t(
        "settings.integrations.enrichConfirm",
        "This looks up every book that's missing a cover, ISBN, Dewey code, or Arabic title against Google Books/Open Library (and Groq, if enabled) and fills in only the blank fields, one book at a time. It will make many external network requests and can take a while for a large catalog. Continue?"
      )
    );
    if (!confirmed) return;

    enrichCancelRef.current = false;
    setEnrichLog([]);
    setEnriching(true);
    try {
      const allBooks = await fetchAllBooks();
      const targets = findEnrichableBooks(allBooks);
      setEnrichTotal(targets.length);
      if (targets.length === 0) {
        toast.info(t("settings.integrations.enrichNone", "Every book already has a cover, ISBN, Dewey code, and Arabic title."));
        return;
      }
      await enrichAllBooks(
        targets,
        { groqApiKey: prefs.groqEnabled ? prefs.groqApiKey : undefined },
        (progress) => setEnrichLog((prev) => [...prev, progress]),
        () => enrichCancelRef.current
      );
      toast.success(t("settings.integrations.enrichDone", "Bulk enrichment finished."));
    } catch (err: any) {
      toast.error(err?.message || String(err));
    } finally {
      setEnriching(false);
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
      // A 401/403 means the key itself is rejected (invalid/expired/revoked) — the common cause of
      // "Groq not working" — so surface that distinctly from a network/other error.
      setTestGroqResult(res.ok ? "ok" : (res.status === 401 || res.status === 403) ? "invalid" : "fail");
    } catch {
      setTestGroqResult("fail");
    } finally {
      setTestingGroq(false);
      setTimeout(() => setTestGroqResult(null), 6000);
    }
  };

  return (
    <div className="max-w-4xl w-full">
      <PageHeader title={t("settings.integrations.title")} desc={t("settings.integrations.desc")} />

      <h3 className="font-bold text-[13px] text-[#122222]/80 dark:text-white/80 uppercase tracking-wider mb-4 border-b border-black/5 dark:border-white/5 pb-2">
        AI Enrichment Engines
      </h3>
      <div className="grid grid-cols-1 gap-5 mb-8">
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
              {testGroqResult === "invalid" && <p className="text-[12px] text-red-500 font-bold mt-2 flex items-center gap-1"><AlertTriangle size={13} /> {t("settings.integrations.groqInvalidKey", "Invalid or expired API key (401). Generate a new key at console.groq.com and paste it here.")}</p>}
              {testGroqResult === "fail" && <p className="text-[12px] text-red-500 font-bold mt-2 flex items-center gap-1"><AlertTriangle size={13} /> {t("settings.integrations.groqTestFailed", "Couldn't reach Groq. Check your connection and try again.")}</p>}
            </Field>
            <p className="text-[11px] text-[#122222]/40 dark:text-white/40 mt-3 font-medium">
              {t("settings.integrations.groqHelp")}
            </p>
          </div>
        </Card>
      </div>

      <h3 className="font-bold text-[13px] text-[#122222]/80 dark:text-white/80 uppercase tracking-wider mb-4 border-b border-black/5 dark:border-white/5 pb-2">
        {t("settings.secrets.keysTitle", "API Keys")}
      </h3>
      <Card title={t("settings.secrets.keysTitle", "API Keys")} icon={<Key size={16} className="text-[#1a4d40]" />}>
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
                        title={t("settings.secrets.toggleVisibility", "Toggle visibility") as string}
                      >
                        {visibleKey === secret.id ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                      <button
                        onClick={() => handleCopyKey(secret.id, secret.value)}
                        className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 text-[#122222]/40 dark:text-white/40 hover:text-[#1a4d40] dark:hover:text-[#1b9277] transition-colors"
                        title={t("settings.secrets.copyKey", "Copy") as string}
                      >
                        {copiedKey === secret.id ? <Check size={13} className="text-[#1a4d40]" /> : <Copy size={13} />}
                      </button>
                      <button
                        onClick={secret.onClear}
                        className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-[#122222]/40 dark:text-white/40 hover:text-red-500 transition-colors"
                        title={t("settings.secrets.removeKey", "Remove key") as string}
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
      </Card>

      <h3 className="font-bold text-[13px] text-[#122222]/80 dark:text-white/80 uppercase tracking-wider mb-4 mt-8 border-b border-black/5 dark:border-white/5 pb-2">
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

      <h3 className="font-bold text-[13px] text-[#122222]/80 dark:text-white/80 uppercase tracking-wider mb-4 border-b border-black/5 dark:border-white/5 pb-2">
        {t("settings.integrations.enrichSectionTitle", "Bulk Enrich Existing Books")}
      </h3>
      <Card title={t("settings.integrations.enrichTitle", "Fill in missing book data")} icon={<Sparkles size={16} className="text-[#1a4d40] dark:text-[#1b9277]" />}>
        <p className="text-[12px] text-[#122222]/70 dark:text-white/70 mb-4 font-normal leading-normal">
          {t(
            "settings.integrations.enrichDesc",
            "Goes through every book missing a cover, ISBN, Dewey code, or Arabic title and looks it up one at a time via Google Books/Open Library, plus Groq for Arabic translation and a best-estimate Dewey code if enabled above. Existing values are never overwritten."
          )}
        </p>
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={handleStartEnrichment}
            disabled={enriching}
            className="flex items-center gap-2 bg-[#1a4d40] text-white px-5 py-2.5 rounded-lg font-bold text-[13px] hover:bg-[#1a4d40]/90 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
          >
            {enriching ? <RefreshCw size={15} className="animate-spin" /> : <Sparkles size={15} />}
            {enriching ? t("settings.integrations.enrichRunning", "Enriching…") : t("settings.integrations.enrichStart", "Start Enrichment")}
          </button>
          {enriching && (
            <button
              onClick={() => { enrichCancelRef.current = true; }}
              className="flex items-center gap-2 border border-black/10 dark:border-white/10 px-4 py-2.5 rounded-lg font-bold text-[13px] text-[#122222] dark:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
              {t("settings.integrations.enrichCancel", "Cancel")}
            </button>
          )}
          {enrichTotal > 0 && (
            <span className="text-[12px] font-semibold text-[#122222]/60 dark:text-white/60">
              {t("settings.integrations.enrichProgress", "{{done}} of {{total}} processed", { done: enrichLog.length, total: enrichTotal })}
            </span>
          )}
        </div>
        {enrichLog.length > 0 && (
          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1 border-t border-black/5 dark:border-white/5 pt-3">
            {enrichLog.map((entry, idx) => (
              <div key={`${entry.book.id}-${idx}`} className="flex items-start gap-2 text-[12px] py-1">
                {entry.status === "success" && <CheckCircle2 size={14} className="text-[#1a4d40] dark:text-[#1b9277] shrink-0 mt-0.5" />}
                {entry.status === "skipped" && <Info size={14} className="text-[#122222]/40 dark:text-white/40 shrink-0 mt-0.5" />}
                {entry.status === "error" && <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />}
                <div>
                  <span className="font-semibold text-[#122222] dark:text-white">{entry.book.title}</span>
                  <span className="text-[#122222]/60 dark:text-white/60"> — {entry.message}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <SaveButton label={t("settings.integrations.saveBtn")} />
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// 11B. USERS TAB (admin only)
// ═══════════════════════════════════════════════════════════════════════════════
function UsersTab() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const { data: users, isLoading } = useQuery({ queryKey: ["users"], queryFn: listUsers });

  const [showCreate, setShowCreate] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("action") === "add-user") {
      setShowCreate(true);
      const cleanUrl = window.location.hash ? window.location.hash.split("?")[0] + "?tab=users" : window.location.pathname + "?tab=users";
      window.history.replaceState({}, document.title, cleanUrl);
    }
  }, [location.search]);

  const [createdCredentials, setCreatedCredentials] = useState<{ username: string; password: string } | null>(null);
  const [resetForUser, setResetForUser] = useState<PublicUser | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [resetResultPassword, setResetResultPassword] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PublicUser | null>(null);

  const [editTarget, setEditTarget] = useState<PublicUser | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<UserRole>("staff");
  const [editStatus, setEditStatus] = useState<UserStatus>("active");

  const [newUsername, setNewUsername] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("staff");
  const [newPassword, setNewPassword] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["users"] });

  const createMutation = useMutation({
    mutationFn: () => createUser({ username: newUsername, fullName: newFullName, email: newEmail || null, role: newRole, password: newPassword }),
    onSuccess: (user) => {
      invalidate();
      setCreatedCredentials({ username: user.username, password: newPassword });
      setShowCreate(false);
      setNewUsername(""); setNewFullName(""); setNewEmail(""); setNewRole("staff"); setNewPassword("");
    },
    onError: (err: any) => toast.error(err.message || String(err)),
  });

  const updateDetailsMutation = useMutation({
    mutationFn: () => updateUser(editTarget!.id, { fullName: editFullName, email: editEmail || null, role: editRole, status: editStatus }),
    onSuccess: () => {
      invalidate();
      toast.success(t("settings.users.userUpdated") || "User details updated successfully.");
      setEditTarget(null);
    },
    onError: (err: any) => toast.error(err.message || String(err)),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: (u: PublicUser) => updateUser(u.id, { status: u.status === "active" ? "disabled" : "active" }),
    onSuccess: () => { invalidate(); toast.success(t("settings.users.statusUpdated")); },
    onError: (err: any) => toast.error(err.message || String(err)),
  });

  const toggleRoleMutation = useMutation({
    mutationFn: (u: PublicUser) => updateUser(u.id, { role: u.role === "admin" ? "staff" : "admin" }),
    onSuccess: () => { invalidate(); toast.success(t("settings.users.roleUpdated")); },
    onError: (err: any) => toast.error(err.message || String(err)),
  });

  const resetMutation = useMutation({
    mutationFn: () => resetPassword(resetForUser!.id, resetPasswordValue),
    onSuccess: () => { invalidate(); setResetResultPassword(resetPasswordValue); setResetPasswordValue(""); },
    onError: (err: any) => toast.error(err.message || String(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteUser(deleteTarget!.id),
    onSuccess: () => { invalidate(); toast.success(t("settings.users.deleted")); setDeleteTarget(null); },
    onError: (err: any) => { toast.error(err.message || String(err)); setDeleteTarget(null); },
  });

  const openEdit = (u: PublicUser) => {
    setEditTarget(u);
    setEditFullName(u.full_name || "");
    setEditEmail(u.email || "");
    setEditRole(u.role);
    setEditStatus(u.status);
  };

  return (
    <div className="max-w-3xl">
      <PageHeader title={t("settings.users.title")} desc={t("settings.users.desc")} />

      <div className="flex justify-end mb-4">
        <Button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5">
          <Plus size={15} /> {t("settings.users.addUser")}
        </Button>
      </div>

      <Card title={t("settings.users.title")} icon={<UsersIcon size={16} className="text-[#1a4d40]" />}>
        {isLoading ? (
          <p className="text-[12px] text-[#122222]/50 dark:text-white/50">{t("settings.account.saving")}</p>
        ) : (
          <div className="space-y-2">
            {(users ?? []).map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-3 py-2.5 border-b border-black/5 dark:border-white/5 last:border-0">
                <div className="min-w-0 flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0 ${u.status === "active" ? "bg-[#b96f3e] text-white" : "bg-black/10 dark:bg-white/10 text-[#122222]/40 dark:text-white/40"}`}>
                    {Array.from(u.full_name || u.username).slice(0, 2).join("").toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-[13px] text-[#122222] dark:text-white truncate">
                      {u.full_name} {u.id === currentUser?.id && <span className="text-[10px] text-[#122222]/40 dark:text-white/40">({t("settings.users.you")})</span>}
                    </p>
                    <p className="text-[11px] text-[#122222]/50 dark:text-white/50 truncate">
                      @{u.username} {u.email ? `· ${u.email} ` : ""}· {u.role === "admin" ? t("settings.account.roleAdmin") : t("settings.account.roleStaff")} · {u.status === "active" ? t("settings.users.active") : t("settings.users.disabled")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button title={t("settings.users.editUser") || "Edit User"} onClick={() => openEdit(u)} className="p-1.5 rounded-lg text-[#122222]/50 dark:text-white/50 hover:bg-black/5 dark:hover:bg-white/5 hover:text-[#1a4d40] cursor-pointer">
                    <Pencil size={15} />
                  </button>
                  <button title={t("settings.users.toggleRole")} onClick={() => toggleRoleMutation.mutate(u)} className="p-1.5 rounded-lg text-[#122222]/50 dark:text-white/50 hover:bg-black/5 dark:hover:bg-white/5 hover:text-[#1a4d40] cursor-pointer">
                    <ShieldCheck size={15} />
                  </button>
                  <button title={t("settings.users.resetPassword")} onClick={() => setResetForUser(u)} className="p-1.5 rounded-lg text-[#122222]/50 dark:text-white/50 hover:bg-black/5 dark:hover:bg-white/5 hover:text-[#1a4d40] cursor-pointer">
                    <KeyRound size={15} />
                  </button>
                  <button title={t("settings.users.toggleStatus")} onClick={() => toggleStatusMutation.mutate(u)} className="p-1.5 rounded-lg text-[#122222]/50 dark:text-white/50 hover:bg-black/5 dark:hover:bg-white/5 hover:text-amber-600 cursor-pointer">
                    <Ban size={15} />
                  </button>
                  {u.id !== currentUser?.id && (
                    <button title={t("settings.users.deleteUser")} onClick={() => setDeleteTarget(u)} className="p-1.5 rounded-lg text-[#122222]/50 dark:text-white/50 hover:bg-red-500/10 hover:text-red-600 cursor-pointer">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Edit User Modal */}
      <Modal isOpen={!!editTarget} onClose={() => setEditTarget(null)} title={t("settings.users.editUser") || "Edit User Details"}>
        <form
          className="space-y-3"
          onSubmit={(e) => { e.preventDefault(); updateDetailsMutation.mutate(); }}
        >
          <Field label={t("settings.users.fullName") || "Full Name"}>
            <Input value={editFullName} onChange={(e) => setEditFullName(e.target.value)} required />
          </Field>
          <Field label={t("settings.users.email") || "Email Address"}>
            <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="user@library.dz" />
          </Field>
          <Field label={t("settings.users.role") || "Role"}>
            <select value={editRole} onChange={(e) => setEditRole(e.target.value as UserRole)} className="field-select text-[13px] py-2 px-3 font-semibold w-full">
              <option value="staff">{t("settings.account.roleStaff")}</option>
              <option value="admin">{t("settings.account.roleAdmin")}</option>
            </select>
          </Field>
          <Field label={t("status") || "Status"}>
            <select value={editStatus} onChange={(e) => setEditStatus(e.target.value as UserStatus)} className="field-select text-[13px] py-2 px-3 font-semibold w-full">
              <option value="active">{t("settings.users.active")}</option>
              <option value="disabled">{t("settings.users.disabled")}</option>
            </select>
          </Field>
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={updateDetailsMutation.isPending}>{updateDetailsMutation.isPending ? t("settings.account.saving") : t("save")}</Button>
            <Button type="button" variant="ghost" onClick={() => setEditTarget(null)}>{t("catalog.addModal.cancel")}</Button>
          </div>
        </form>
      </Modal>

      {/* Create user */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title={t("settings.users.addUser")}>
        <form
          className="space-y-3"
          onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }}
        >
          <Field label={t("settings.users.username")}>
            <Input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} required minLength={3} autoFocus />
          </Field>
          <Field label={t("settings.users.fullName") || "Full Name"}>
            <Input value={newFullName} onChange={(e) => setNewFullName(e.target.value)} required placeholder="e.g. عبد القادر الجزائري" />
          </Field>
          <Field label={t("settings.users.email") || "Email Address"}>
            <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="user@library.dz" />
          </Field>
          <Field label={t("settings.users.role")}>
            <select value={newRole} onChange={(e) => setNewRole(e.target.value as UserRole)} className="field-select text-[13px] py-2 px-3 font-semibold w-full">
              <option value="staff">{t("settings.account.roleStaff")}</option>
              <option value="admin">{t("settings.account.roleAdmin")}</option>
            </select>
          </Field>
          <Field label={t("settings.users.initialPassword")}>
            <Input type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} />
          </Field>
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? t("settings.account.saving") : t("settings.users.addUser")}</Button>
            <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>{t("catalog.addModal.cancel")}</Button>
          </div>
        </form>
      </Modal>

      {/* Just-created credentials */}
      <Modal isOpen={!!createdCredentials} onClose={() => setCreatedCredentials(null)} title={t("settings.users.credentialsTitle")}>
        <p className="text-[12px] text-[#122222]/60 dark:text-white/60 mb-3">{t("settings.users.credentialsHelp")}</p>
        <div className="bg-black/5 dark:bg-white/5 rounded-lg p-3 font-mono text-[13px] space-y-1">
          <p>{t("settings.users.username")}: <strong>{createdCredentials?.username}</strong></p>
          <p>{t("settings.users.initialPassword")}: <strong>{createdCredentials?.password}</strong></p>
        </div>
        <Button className="mt-4 w-full" onClick={() => setCreatedCredentials(null)}>{t("catalog.addModal.cancel")}</Button>
      </Modal>

      {/* Reset password */}
      <Modal isOpen={!!resetForUser} onClose={() => { setResetForUser(null); setResetResultPassword(null); }} title={t("settings.users.resetPassword")}>
        {!resetResultPassword ? (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); resetMutation.mutate(); }}>
            <p className="text-[12px] text-[#122222]/60 dark:text-white/60">{t("settings.users.resetPasswordHelp", { name: resetForUser?.full_name })}</p>
            <Field label={t("settings.users.newPasswordFor")}>
              <Input type="text" value={resetPasswordValue} onChange={(e) => setResetPasswordValue(e.target.value)} required minLength={8} autoFocus />
            </Field>
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={resetMutation.isPending}>{resetMutation.isPending ? t("settings.account.saving") : t("settings.account.savePassword")}</Button>
              <Button type="button" variant="ghost" onClick={() => setResetForUser(null)}>{t("catalog.addModal.cancel")}</Button>
            </div>
          </form>
        ) : (
          <>
            <div className="bg-black/5 dark:bg-white/5 rounded-lg p-3 font-mono text-[13px]">
              {t("settings.account.newPassword")}: <strong>{resetResultPassword}</strong>
            </div>
            <Button className="mt-4 w-full" onClick={() => { setResetForUser(null); setResetResultPassword(null); }}>{t("catalog.addModal.cancel")}</Button>
          </>
        )}
      </Modal>

      {/* Delete confirmation */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title={t("settings.users.deleteUser")} size="md">
        <p className="text-[13px] text-[#122222] dark:text-white">{t("settings.users.confirmDelete", { name: deleteTarget?.full_name })}</p>
        <div className="flex gap-2 pt-4">
          <Button variant="danger" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>{t("delete")}</Button>
          <Button variant="ghost" onClick={() => setDeleteTarget(null)}>{t("catalog.addModal.cancel")}</Button>
        </div>
      </Modal>
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
              {updateStatus === "available" && <span className="text-[#b96f3e] font-bold ml-2">{t("settings.about.updateAvailable", "Update available!")}</span>}
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
  const navigate = useNavigate();
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
                <a href="https://mohaned.space/" target="_blank" rel="noopener noreferrer" className="hover:underline">{t("settings.about.website", "Website")}</a>
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
          <button onClick={() => navigate("/legal/terms")} className="flex items-center justify-between text-[13px] font-semibold text-[#1a4d40] dark:text-[#1b9277] hover:underline cursor-pointer text-left">
            {t("settings.about.terms") || "Terms of Service"} <ChevronRight size={14} />
          </button>
          <button onClick={() => navigate("/legal/privacy")} className="flex items-center justify-between text-[13px] font-semibold text-[#1a4d40] dark:text-[#1b9277] hover:underline cursor-pointer text-left">
            {t("settings.about.privacy") || "Privacy Policy"} <ChevronRight size={14} />
          </button>
          <button onClick={() => navigate("/legal/licenses")} className="flex items-center justify-between text-[13px] font-semibold text-[#1a4d40] dark:text-[#1b9277] hover:underline cursor-pointer text-left">
            {t("settings.about.licenses") || "Open Source Licenses"} <ChevronRight size={14} />
          </button>
        </div>
        <p className="text-[11px] text-[#122222]/40 dark:text-white/40 mt-4">© 2026 Warraq — MANAA Mohaned. Free for CHU Mustapha Pacha only; redistribution is prohibited.</p>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DYNAMIC RIGHT HELP PANEL
// ═══════════════════════════════════════════════════════════════════════════════
function RightHelp({ tab }: { tab: Tab }) {
  const { t } = useTranslation();
  const tabKey = tab.toLowerCase().replace(/[^a-z0-9]/g, '');

  const iconMap: Record<Tab, React.ReactNode> = {
    "General": <SettingsIcon size={16} className="text-[#b96f3e]" />,
    "Library Profile": <MapPin size={16} className="text-[#1a4d40]" />,
    "Localization": <Globe size={16} className="text-[#b96f3e]" />,
    "Appearance": <Palette size={16} className="text-[#b96f3e]" />,
    "Rules": <BookMarked size={16} className="text-[#1a4d40]" />,
    "Notifications": <Bell size={16} className="text-[#1a4d40]" />,
    "Backup & Restore": <HardDrive size={16} className="text-[#b96f3e]" />,
    "Database": <Database size={16} className="text-[#1a4d40]" />,
    "Integrations & AI": <Zap size={16} className="text-[#b96f3e]" />,
    "Users": <UsersIcon size={16} className="text-[#1a4d40]" />,
    "Desktop & Data": <Monitor size={16} className="text-[#b96f3e]" />,
    "About": <Info size={16} className="text-[#1a4d40]" />,
  };

  const title = t(`settings.help.${tabKey}.title`) || tab;
  const body = t(`settings.help.${tabKey}.body`) || "";
  const tipsRaw = t(`settings.help.${tabKey}.tips`, { returnObjects: true });
  const tips: string[] = Array.isArray(tipsRaw) ? tipsRaw : [];

  const quickNavLabels: Record<string, string> = {
    "General": t("settings.tabs.general") || "General",
    "Appearance": t("settings.tabs.appearance") || "Appearance",
    "Backup": t("settings.tabs.backuprestore") || "Backup",
  };

  return (
    <>
      <div className="bg-[#fcfbf8] dark:bg-[#1a2522] rounded-2xl border border-black/5 dark:border-white/5 p-5 shadow-card">
        <div className="w-10 h-10 bg-white dark:bg-[#1d2926] border border-black/5 dark:border-white/5 rounded-full flex items-center justify-center mb-4">
          {iconMap[tab] || <SettingsIcon size={16} className="text-[#b96f3e]" />}
        </div>
        <h3 className="font-bold text-[14px] text-[#122222] dark:text-white mb-2">{title}</h3>
        {body && <p className="text-[12px] text-[#122222]/70 dark:text-white/70 mb-4">{body}</p>}
        {tips.length > 0 && (
          <>
            <div className="text-[12px] font-bold text-[#122222] dark:text-white mb-2">{t("settings.help.tipsTitle") || "Tips"}</div>
            <ul className="space-y-2">
              {tips.map((tip, idx) => (
                <li key={idx} className="flex gap-2 text-[12px] text-[#122222]/70 dark:text-white/70">
                  <CheckCircle2 size={14} className="text-[#1a4d40] dark:text-[#1b9277] shrink-0 mt-0.5" />
                  {tip}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="bg-[#fcfbf8] dark:bg-[#1a2522] rounded-2xl border border-black/5 dark:border-white/5 p-5 shadow-card">
        <div className="w-10 h-10 bg-white dark:bg-[#1d2926] border border-black/5 dark:border-white/5 rounded-full flex items-center justify-center mb-4">
          <BookOpen size={16} className="text-[#b96f3e]" />
        </div>
        <h3 className="font-bold text-[14px] text-[#122222] dark:text-white mb-2">{t("settings.help.quickNavTitle") || "Quick navigation"}</h3>
        <div className="space-y-1.5">
          {[["General", "⌘ ,"], ["Appearance", "—"], ["Backup", "—"]].map(([key, shortcut]) => (
            <div key={key} className="flex items-center justify-between text-[12px]">
              <span className="text-[#122222]/70 dark:text-white/70">{quickNavLabels[key] || key}</span>
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
