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
    { label: t("nav.dashboard") || "Dashboard", subtitle: "Go to home dashboard", route: "/dashboard", icon: LayoutDashboard },
    { label: t("nav.catalog") || "Catalog", subtitle: "Browse book inventory", route: "/catalog", icon: BookOpen },
    { label: t("nav.members") || "Members", subtitle: "Manage library members", route: "/members", icon: Users },
    { label: t("nav.reservations") || "Reservations", subtitle: "Hold queue & reservations", route: "/reservations", icon: CalendarClock },
    { label: t("nav.inventory") || "Inventory", subtitle: "Physical shelves audit", route: "/inventory", icon: Warehouse },
    { label: t("nav.reports") || "Reports", subtitle: "Excel exports & metrics", route: "/reports", icon: ClipboardList },
    { label: t("nav.activity") || "Activity", subtitle: "Database audit logs", route: "/activity", icon: ClipboardList },
    { label: t("nav.settings") || "Settings", subtitle: "General app settings", route: "/settings", icon: Cog },

    // Quick Actions
    { label: "Search book or author", subtitle: "Search in catalog", route: "/catalog?focus=search", icon: Search },
    { label: "Search library member", subtitle: "Search in members", route: "/members?focus=search", icon: Search },
    { label: "Add a new book", subtitle: "Register new catalog title", route: "/catalog?action=add-book", icon: Plus },
    { label: "Register new member", subtitle: "Add new membership card", route: "/members?action=add-member", icon: Plus },
    { label: "New checkout / Loan book", subtitle: "Issue a book to a member", route: "/circulation", icon: ScanLine },
    { label: "Return a book / Check in", subtitle: "Process returned book copy", route: "/circulation", icon: ScanLine },
    { label: "Renew active loan", subtitle: "Extend loan duration", route: "/circulation", icon: ScanLine },

    // Native Actions
    { label: "Backup database", subtitle: "Export local .db copy", action: handleBackup, icon: HardDrive },
    { label: "Toggle dark mode", subtitle: "Switch visual theme", action: toggleTheme, icon: preferences.theme === "dark" ? Sun : Moon },
    
    // Language Switches
    { label: "Switch language to English", subtitle: "Change UI to English", action: () => changeLanguage("en"), icon: Globe },
    { label: "Switch language to Arabic", subtitle: "تغيير واجهة التطبيق إلى العربية", action: () => changeLanguage("ar"), icon: Globe },
    { label: "Switch language to French", subtitle: "Changer l'interface en français", action: () => changeLanguage("fr"), icon: Globe },

    // Settings Shortcuts
    { label: "Library Profile settings", subtitle: "Address, name, contact details", route: "/settings?tab=profile", icon: Cog },
    { label: "Appearance settings", subtitle: "Colors, themes, font sizes", route: "/settings?tab=appearance", icon: Cog },
    { label: "Localization settings", subtitle: "Language & date formatting", route: "/settings?tab=localization", icon: Globe },
    { label: "Circulation rules settings", subtitle: "Loan days, renewal limits", route: "/settings?tab=rules", icon: BookMarked },
    { label: "Backup & Restore settings", subtitle: "Database tools", route: "/settings?tab=backup", icon: Database },
    { label: "Integrations & AI settings", subtitle: "Configure LLMs & Groq keys", route: "/settings?tab=integrations", icon: Zap },
    { label: "Secrets & API keys", subtitle: "Manage developer tokens", route: "/settings?tab=secrets", icon: Shield }
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
          placeholder="Search pages and actions..." 
          className="w-full border-b border-black/5 dark:border-white/5 p-4 outline-none text-[14px] text-[#122222] dark:text-white placeholder:text-[#122222]/40 dark:placeholder:white/40"
        />
        <Command.List className="max-h-96 overflow-y-auto p-2 no-scrollbar">
          <Command.Empty className="p-4 text-sm text-[#122222]/60 dark:text-white/60">
            No matching command.
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
                <span className="text-[10px] opacity-40 font-mono">Action</span>
              </Command.Item>
            );
          })}
        </Command.List>
      </Command>
    </div>
  );
}

