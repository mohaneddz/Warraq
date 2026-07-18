import { Command } from "cmdk";
import { useNavigate } from "react-router-dom";
import { useUiStore } from "../../store/uiStore";
import { useTranslation } from "react-i18next";
import { 
  BookOpen, CalendarClock, ClipboardList, Cog, LayoutDashboard, Search, 
  ScanLine, Users, Warehouse, Moon, Sun, HardDrive, Plus, 
  Globe, Shield, Database, Zap, BookMarked 
} from "lucide-react";

export function CommandPalette() {
  const { paletteOpen, setPaletteOpen, preferences, updatePreferences } = useUiStore();
  const navigate = useNavigate();
  const { t } = useTranslation();

  if (!paletteOpen) return null;

  const handleBackup = async () => {
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const { copyFile } = await import("@tauri-apps/plugin-fs");
      const { appDataDir } = await import("@tauri-apps/api/path");
      const dir = await appDataDir();
      const dest = await save({ 
        defaultPath: "warraq-backup.db", 
        filters: [{ name: "Database", extensions: ["db"] }] 
      });
      if (dest) {
        await copyFile(`${dir}/warraq.db`, dest);
        alert(t("profileCard.backupSuccess") || "Backup saved successfully.");
      }
    } catch {
      alert(t("profileCard.backupError") || "Could not export backup.");
    }
  };

  const toggleTheme = () => {
    updatePreferences({ theme: preferences.theme === "dark" ? "light" : "dark" });
  };

  const changeLanguage = (locale: "en" | "fr" | "ar") => {
    updatePreferences({ locale });
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  };

  const isRtl = preferences.locale === "ar" || document.documentElement.dir === "rtl";

  // Structured commands list
  const commandList = [
    // Page Navigations
    { label: t("nav.dashboard") || "Dashboard", subtitle: t("commandPalette.subtitles.dashboard"), route: "/dashboard", icon: LayoutDashboard },
    { label: t("nav.catalog") || "Catalog", subtitle: t("commandPalette.subtitles.catalog"), route: "/catalog", icon: BookOpen },
    { label: t("nav.members") || "Members", subtitle: t("commandPalette.subtitles.members"), route: "/members", icon: Users },
    { label: t("nav.reservations") || "Reservations", subtitle: t("commandPalette.subtitles.reservations"), route: "/reservations", icon: CalendarClock },
    { label: t("nav.inventory") || "Inventory", subtitle: t("commandPalette.subtitles.inventory"), route: "/inventory", icon: Warehouse },
    { label: t("nav.reports") || "Reports", subtitle: t("commandPalette.subtitles.reports"), route: "/reports", icon: ClipboardList },
    { label: t("nav.activity") || "Activity", subtitle: t("commandPalette.subtitles.activity"), route: "/activity", icon: ClipboardList },
    { label: t("nav.settings") || "Settings", subtitle: t("commandPalette.subtitles.settings"), route: "/settings", icon: Cog },

    // Quick Actions
    { label: t("commandPalette.actions.searchBook"), subtitle: t("commandPalette.actions.searchBookSub"), route: "/catalog?focus=search", icon: Search },
    { label: t("commandPalette.actions.searchMember"), subtitle: t("commandPalette.actions.searchMemberSub"), route: "/members?focus=search", icon: Search },
    { label: t("commandPalette.actions.addBook"), subtitle: t("commandPalette.actions.addBookSub"), route: "/catalog?action=add-book", icon: Plus },
    { label: t("commandPalette.actions.addMember"), subtitle: t("commandPalette.actions.addMemberSub"), route: "/members?action=add-member", icon: Plus },
    { label: t("commandPalette.actions.checkout"), subtitle: t("commandPalette.actions.checkoutSub"), route: "/circulation", icon: ScanLine },
    { label: t("commandPalette.actions.return"), subtitle: t("commandPalette.actions.returnSub"), route: "/circulation", icon: ScanLine },
    { label: t("commandPalette.actions.renew"), subtitle: t("commandPalette.actions.renewSub"), route: "/circulation", icon: ScanLine },

    // Native Actions
    { label: t("commandPalette.actions.backup"), subtitle: t("commandPalette.actions.backupSub"), action: handleBackup, icon: HardDrive },
    { label: t("commandPalette.actions.toggleTheme"), subtitle: t("commandPalette.actions.toggleThemeSub"), action: toggleTheme, icon: preferences.theme === "dark" ? Sun : Moon },
    
    // Language Switches
    { label: t("commandPalette.actions.langEn"), subtitle: t("commandPalette.actions.langEnSub"), action: () => changeLanguage("en"), icon: Globe },
    { label: t("commandPalette.actions.langAr"), subtitle: t("commandPalette.actions.langArSub"), action: () => changeLanguage("ar"), icon: Globe },
    { label: t("commandPalette.actions.langFr"), subtitle: t("commandPalette.actions.langFrSub"), action: () => changeLanguage("fr"), icon: Globe },

    // Settings Shortcuts
    { label: t("commandPalette.actions.profile"), subtitle: t("commandPalette.actions.profileSub"), route: "/settings?tab=profile", icon: Cog },
    { label: t("commandPalette.actions.appearance"), subtitle: t("commandPalette.actions.appearanceSub"), route: "/settings?tab=appearance", icon: Cog },
    { label: t("commandPalette.actions.localization"), subtitle: t("commandPalette.actions.localizationSub"), route: "/settings?tab=localization", icon: Globe },
    { label: t("commandPalette.actions.rules"), subtitle: t("commandPalette.actions.rulesSub"), route: "/settings?tab=rules", icon: BookMarked },
    { label: t("commandPalette.actions.backupTab"), subtitle: t("commandPalette.actions.backupTabSub"), route: "/settings?tab=backup", icon: Database },
    { label: t("commandPalette.actions.integrations"), subtitle: t("commandPalette.actions.integrationsSub"), route: "/settings?tab=integrations", icon: Zap },
    { label: t("commandPalette.actions.secrets"), subtitle: t("commandPalette.actions.secretsSub"), route: "/settings?tab=secrets", icon: Shield }
  ];

  return (
    <div 
      className="fixed inset-0 z-50 flex justify-center items-start bg-[#122222]/60 dark:bg-black/75 pt-[18vh] backdrop-blur-sm transition-all"
      onMouseDown={() => setPaletteOpen(false)}
    >
      <Command 
        className="w-full max-w-xl overflow-hidden rounded-2xl bg-white dark:bg-[#1d2926] border border-black/5 dark:border-white/10 shadow-2xl flex flex-col"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <Command.Input 
          autoFocus 
          placeholder={t("commandPalette.placeholder") || "Search pages and actions..."} 
          className="w-full border-b border-black/5 dark:border-white/5 p-4 outline-none text-[14px] text-[#122222] dark:text-white placeholder:text-[#122222]/40 dark:placeholder:white/40"
        />
        <Command.List className="max-h-96 overflow-y-auto p-2 no-scrollbar">
          <Command.Empty className="p-4 text-sm text-[#122222]/60 dark:text-white/60">
            {t("commandPalette.empty") || "No matching command."}
          </Command.Empty>
          
          {commandList.map((item, index) => {
            const Icon = item.icon;
            return (
              <Command.Item 
                key={index} 
                value={item.label + " " + item.subtitle} 
                className={`cursor-pointer rounded-xl px-3.5 py-2.5 text-[13px] font-semibold text-[#122222]/80 dark:text-white/80 transition-colors flex items-center justify-between data-[selected=true]:bg-[#1a4d40]/10 dark:data-[selected=true]:bg-[#1b9277]/10 data-[selected=true]:text-[#1a4d40] dark:data-[selected=true]:text-[#1b9277] group ${isRtl ? "text-right flex-row-reverse" : "text-left"}`}
                onSelect={() => { 
                  if (item.route) navigate(item.route);
                  if (item.action) item.action();
                  setPaletteOpen(false); 
                }}
              >
                <div className={`flex items-center gap-3 ${isRtl ? "flex-row-reverse" : ""}`}>
                  <span className="w-7 h-7 rounded-lg bg-black/5 dark:bg-white/5 flex items-center justify-center text-[#122222]/60 dark:text-white/60 group-hover:bg-[#1a4d40]/20 group-hover:text-[#1a4d40] dark:group-hover:bg-[#1b9277]/20 dark:group-hover:text-[#1b9277] transition-colors">
                    <Icon size={15} />
                  </span>
                  <div className={`flex flex-col ${isRtl ? "items-end" : "items-start"}`}>
                    <span className="leading-tight">{item.label}</span>
                    <span className="text-[10px] text-[#122222]/40 dark:text-white/40 font-medium leading-tight mt-0.5">{item.subtitle}</span>
                  </div>
                </div>
                <span className="text-[10px] opacity-40 font-mono">{t("commandPalette.action") || "Action"}</span>
              </Command.Item>
            );
          })}
        </Command.List>

      </Command>
    </div>
  );
}

