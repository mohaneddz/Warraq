import { BookOpen, CalendarClock, ChartNoAxesCombined, ClipboardList, Cog, LayoutDashboard, Search, Bell, Minus, Square, Users, Warehouse, X, ChevronDown, Menu, Moon, Sun, Sparkles, RefreshCw, ArrowLeft, ArrowRight, Maximize, LogOut } from "lucide-react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";

import { useUiStore } from "../../store/uiStore";
import { useLibrarySettingsStore } from "../../store/librarySettingsStore";
import { useAuthStore } from "../../store/authStore";
import { useQuery } from "@tanstack/react-query";
import { dashboard, reservations } from "../../data/repositories/library";
import { logout as logoutRequest } from "../../data/auth";
import { formatDisplayDate } from "../../utils/dates";
import { useTranslation } from "react-i18next";
import { useContextMenu } from "../ui/ContextMenu";
import { queryClient } from "../../app/providers";
import { toast } from "sonner";




const links = [
  ["/dashboard", "Dashboard", LayoutDashboard], 
  ["/catalog", "Catalog", BookOpen], 
  ["/members", "Members", Users], 
  ["/reservations", "Reservations", CalendarClock], 
  ["/inventory", "Inventory", Warehouse], 
  ["/reports", "Reports", ChartNoAxesCombined], 
  ["/activity", "Activity", ClipboardList], 
  ["/settings", "Settings", Cog]
] as const;

export function AppShell() {
  const { sidebarOpen, toggleSidebar, setPaletteOpen, preferences, updatePreferences } = useUiStore();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);

  const handleSignOut = async () => {
    try {
      await logoutRequest();
    } catch (err) {
      console.error("Failed to clear server-side session", err);
    } finally {
      setUser(null);
    }
  };

  // Profile hover cards states
  const [showTopbarProfileCard, setShowTopbarProfileCard] = useState(false);
  const [showSidebarProfileCard, setShowSidebarProfileCard] = useState(false);

  const topbarHoverTimeoutRef = useRef<number | null>(null);
  const sidebarHoverTimeoutRef = useRef<number | null>(null);

  const handleTopbarMouseEnter = () => {
    if (topbarHoverTimeoutRef.current) {
      clearTimeout(topbarHoverTimeoutRef.current);
      topbarHoverTimeoutRef.current = null;
    }
    setShowTopbarProfileCard(true);
  };

  const handleTopbarMouseLeave = () => {
    topbarHoverTimeoutRef.current = window.setTimeout(() => {
      setShowTopbarProfileCard(false);
    }, 200);
  };

  const handleSidebarMouseEnter = () => {
    if (sidebarHoverTimeoutRef.current) {
      clearTimeout(sidebarHoverTimeoutRef.current);
      sidebarHoverTimeoutRef.current = null;
    }
    setShowSidebarProfileCard(true);
  };

  const handleSidebarMouseLeave = () => {
    sidebarHoverTimeoutRef.current = window.setTimeout(() => {
      setShowSidebarProfileCard(false);
    }, 200);
  };
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem("warraq-sidebar-width");
    return saved ? parseInt(saved, 10) : 260;
  });
  const [isDragging, setIsDragging] = useState(false);
  const widthRef = useRef(sidebarWidth);

  useEffect(() => {
    widthRef.current = sidebarWidth;
  }, [sidebarWidth]);

  const startResizing = (mouseDownEvent: React.MouseEvent) => {
    mouseDownEvent.preventDefault();
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const isRtl = document.documentElement.dir === "rtl" || preferences.locale === "ar";
      let newWidth = isRtl ? (window.innerWidth - e.clientX) : e.clientX;

      if (newWidth < 200) newWidth = 200;
      if (newWidth > 480) newWidth = 480;

      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      localStorage.setItem("warraq-sidebar-width", widthRef.current.toString());
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, preferences.locale]);

  const { t, i18n } = useTranslation();
  const librarySettings = useLibrarySettingsStore((s) => s.settings);

  // Live queries for overdue alerts
  const { data: dashData } = useQuery({ queryKey: ["dashboard-shell"], queryFn: dashboard });
  const overdueCount = librarySettings.notify_overdue ? (dashData?.overdue ?? 0) : 0;
  const overdueList = librarySettings.notify_overdue ? (dashData?.overdueLoans ?? []) : [];

  // Live reservations holds ready alert
  const { data: resData } = useQuery({
    queryKey: ["reservations-shell"],
    queryFn: reservations,
    enabled: librarySettings.notify_ready
  });
  const readyReservations = librarySettings.notify_ready
    ? (resData?.filter(r => r.status === "ready") ?? [])
    : [];

  const totalNotificationsCount = overdueCount + readyReservations.length;

  // ── Theme ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const applyTheme = () => {
      const isDark = preferences.theme === "dark" || (preferences.theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.classList.toggle("dark", isDark);
    };
    applyTheme();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", applyTheme);
    return () => mq.removeEventListener("change", applyTheme);
  }, [preferences.theme]);

  // ── Accent color → CSS variable ───────────────────────────────────────────
  useEffect(() => {
    document.documentElement.style.setProperty("--color-accent", preferences.accentColor);
    const darkAccents: Record<string, string> = {
      "#1a4d40": "#1b9277",
      "#b96f3e": "#c58a59",
      "#3b5998": "#5b79b8",
      "#7c3aed": "#9058f3",
      "#dc2626": "#e35353",
      "#0284c7": "#38a4db",
    };
    const darkColor = darkAccents[preferences.accentColor] || preferences.accentColor;
    document.documentElement.style.setProperty("--color-accent-dark", darkColor);
  }, [preferences.accentColor]);

  // ── Font size ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const size = preferences.fontSize === "small" ? "13px" : preferences.fontSize === "large" ? "17px" : "15px";
    document.documentElement.style.setProperty("--font-size-base", size);
  }, [preferences.fontSize]);

  // ── Locale → html lang + dir + i18n ──────────────────────────────────────
  useEffect(() => {
    document.documentElement.lang = preferences.locale;
    document.documentElement.dir = preferences.locale === "ar" ? "rtl" : "ltr";
    i18n.changeLanguage(preferences.locale);
  }, [preferences.locale, i18n]);

  // ── Close-to-tray ─────────────────────────────────────────────────────────
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    void import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
      void getCurrentWindow().onCloseRequested(async (event) => {
        if (preferences.closeToTray) {
          event.preventDefault();
          await getCurrentWindow().hide();
        }
      }).then(fn => { unlisten = fn; });
    }).catch(() => { /* not in Tauri context */ });
    return () => { if (unlisten) unlisten(); };
  }, [preferences.closeToTray]);

  // ── Autosave interval ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!preferences.autosaveEnabled) return;
    const ms = Math.max(10, preferences.autosaveInterval) * 1000;
    const id = setInterval(() => {
      // Persist current preferences snapshot (already in localStorage via updatePreferences,
      // but this ensures any pending changes are flushed)
      const snap = localStorage.getItem("warraq-preferences");
      if (snap) localStorage.setItem("warraq-preferences", snap);
    }, ms);
    return () => clearInterval(id);
  }, [preferences.autosaveEnabled, preferences.autosaveInterval]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => { 
      const target = event.target as HTMLElement | null; 
      const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || Boolean(target?.isContentEditable); 
      
      // Ctrl + Shift + S: Collapse / uncollapse sidebar
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        toggleSidebar();
      }

      if (event.key === "F11") {
        event.preventDefault();
        toggleFullscreen();
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { 
        event.preventDefault(); 
        setPaletteOpen(true); 
      } 
      if (!typing && event.key === "/") { 
        event.preventDefault(); 
        document.getElementById("global-search")?.focus(); 
      } 
      if (!typing && (event.ctrlKey || event.metaKey) && event.key === ",") navigate("/settings"); 
    }; 
    window.addEventListener("keydown", handler); 
    return () => window.removeEventListener("keydown", handler); 
  }, [navigate, setPaletteOpen, toggleSidebar]);

  const toggleFullscreen = async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const appWindow = getCurrentWindow();
      const isFS = await appWindow.isFullscreen();
      await appWindow.setFullscreen(!isFS);
    } catch {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  const { showContextMenu } = useContextMenu();

  const handleGlobalContextMenu = (e: React.MouseEvent) => {
    showContextMenu(e, [
      {
        id: "refresh",
        label: t("contextMenu.refresh", "Refresh Page / Data"),
        icon: RefreshCw,
        onClick: () => {
          queryClient.invalidateQueries();
          toast.success(t("contextMenu.refreshed", "Data refreshed successfully"));
        },
        shortcut: "Ctrl+R",
        variant: "accent",
      },
      { divider: true },
      {
        id: "back",
        label: t("contextMenu.goBack", "Go Back"),
        icon: ArrowLeft,
        onClick: () => navigate(-1),
        shortcut: "Alt+←",
      },
      {
        id: "forward",
        label: t("contextMenu.goForward", "Go Forward"),
        icon: ArrowRight,
        onClick: () => navigate(1),
        shortcut: "Alt+→",
      },
      {
        id: "dashboard",
        label: t("contextMenu.dashboard", "Go to Dashboard"),
        icon: LayoutDashboard,
        onClick: () => navigate("/dashboard"),
      },
      { divider: true },
      {
        id: "theme",
        label: preferences.theme === "dark" ? t("contextMenu.lightTheme", "Switch to Light Mode") : t("contextMenu.darkTheme", "Switch to Dark Mode"),
        icon: preferences.theme === "dark" ? Sun : Moon,
        onClick: () => updatePreferences({ theme: preferences.theme === "dark" ? "light" : "dark" }),
      },
      {
        id: "palette",
        label: t("contextMenu.commandPalette", "Quick Search / Command Palette"),
        icon: Sparkles,
        onClick: () => setPaletteOpen(true),
        shortcut: "Ctrl+K",
      },
      {
        id: "fullscreen",
        label: t("contextMenu.fullscreen", "Toggle Fullscreen"),
        icon: Maximize,
        onClick: () => toggleFullscreen(),
        shortcut: "F11",
      },
    ], { title: t("contextMenu.appTitle", "Warraq Context Menu") });
  };


  const windowAction = (action: "minimize" | "toggleMaximize" | "close") => { 
    void import("@tauri-apps/api/window").then(({ getCurrentWindow }) => getCurrentWindow()[action]()); 
  };

  return (
    <div
      onContextMenu={handleGlobalContextMenu}
      className={`app-workspace h-screen overflow-hidden bg-[#F9F8F4] text-[#122222] dark:bg-[#111d1a] dark:text-[#f0ebe1] flex flex-col font-sans ${isDragging ? "select-none cursor-col-resize" : ""}`}
    >

      {/* Titlebar for OS */}
      <header className="flex h-8 items-center bg-[#122222] px-3 z-50">
        <span data-tauri-drag-region className="flex flex-1 select-none items-center h-full"></span>
        <div className="flex shrink-0 gap-1">
          <button aria-label="Minimize window" className="grid h-[24px] w-[36px] place-items-center rounded text-[16px] text-white/50 hover:bg-white/10 hover:text-white" onClick={() => windowAction("minimize")}><Minus size={14} /></button>
          <button aria-label="Toggle maximize" className="grid h-[24px] w-[36px] place-items-center rounded text-[16px] text-white/50 hover:bg-white/10 hover:text-white" onClick={() => windowAction("toggleMaximize")}><Square size={11} /></button>
          <button aria-label="Close window" className="grid h-[24px] w-[36px] place-items-center rounded text-[16px] text-white/50 hover:bg-red-600 hover:text-white" onClick={() => windowAction("close")}><X size={14} /></button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar */}
        <aside className={(sidebarOpen ? "" : "w-[80px]") + " relative shrink-0 text-white flex flex-col z-40 overflow-hidden " + (isDragging ? "" : "transition-[width]")} style={{ width: sidebarOpen ? `${sidebarWidth}px` : "80px", background: '#122222' }}>

          {/* Decorative geometric watermark, anchored to the sidebar's leading top corner */}
          <img
            src="/assets/warraq-sidebar-pattern-dark.png"
            alt=""
            aria-hidden="true"
            className={`absolute top-0 w-full h-auto opacity-[0.16] mix-blend-screen pointer-events-none select-none ${preferences.locale === "ar" ? "right-0 scale-x-[-1]" : "left-0"}`}
          />

          {/* Decorative Book Spine Pattern */}
          <div className="absolute top-0 right-0 bottom-0 w-[24px] opacity-100 pointer-events-none" style={{ background: 'url("data:image/svg+xml,%3Csvg width=\'24\' height=\'60\' viewBox=\'0 0 24 60\' fill=\'none\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M24 0H20C15.5817 0 12 3.58172 12 8V22C12 26.4183 8.41828 30 4 30C8.41828 30 12 33.5817 12 38V52C12 56.4183 15.5817 60 20 60H24V0Z\' fill=\'%23c5a059\' fill-opacity=\'0.85\'/%3E%3C/svg%3E") repeat-y' }}></div>

          {/* Resize Handle */}
          {sidebarOpen && (
            <div 
              onMouseDown={startResizing}
              className={`absolute top-0 bottom-0 w-[6px] cursor-col-resize z-50 hover:bg-[#b96f3e]/40 transition-colors ${
                isDragging ? "bg-[#b96f3e]" : ""
              } ${
                (preferences.locale === "ar") ? "left-0" : "right-0"
              }`}
            />
          )}

          <div className={(sidebarOpen ? "p-6" : "py-6 pl-2 pr-7 flex flex-col items-center") + " flex flex-col h-full relative z-10 font-sans"}>
            {/* Logo & Toggle */}
            <div className="mb-8 w-full">
              {sidebarOpen ? (
                <div className="flex items-center justify-between w-full font-display">
                  <Link to="/dashboard" className="flex min-w-0 items-center gap-3 overflow-hidden">
                    <img src="/brand/warraq-symbol-cream.png" className="h-10 w-10 shrink-0 object-contain" alt="Warraq"/>
                    <div className="flex flex-col">
                      <span className="font-display text-[17px] font-bold tracking-[.15em] text-white leading-tight">WARRAQ</span>
                      <span className="text-[14px] text-white/60 font-medium font-arabic mt-0.5">وراق ـ</span>
                    </div>
                  </Link>
                  <button 
                    onClick={toggleSidebar}
                    className="text-white/60 hover:text-white hover:bg-white/10 p-1.5 rounded transition-colors shrink-0"
                    aria-label="Collapse sidebar"
                  >
                    <Menu size={18} />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4 w-full">
                  <button 
                    onClick={toggleSidebar}
                    className="text-white/60 hover:text-white hover:bg-white/10 w-10 h-10 rounded-xl flex items-center justify-center transition-colors shrink-0"
                    aria-label="Expand sidebar"
                  >
                    <Menu size={18} />
                  </button>
                  <Link to="/dashboard" className="w-10 h-10 flex items-center justify-center shrink-0">
                    <img src="/brand/warraq-symbol-cream.png" className="h-8 w-8 object-contain" alt="Warraq"/>
                  </Link>
                </div>
              )}
            </div>
            
            {/* Navigation */}
            <nav className={`flex-1 overflow-y-auto no-scrollbar ${sidebarOpen ? "space-y-1.5 pr-2 w-full" : "space-y-2 w-full flex flex-col items-center"}`}>
              {links.map(([to, label, Icon]) => (
                <NavLink 
                  key={to} 
                  to={to} 
                  className={({ isActive }) => 
                    sidebarOpen
                      ? `flex items-center gap-3.5 rounded-lg px-3 py-3 text-[14px] font-medium transition-all duration-200 ${isActive ? "bg-gradient-to-r from-[#b96f3e] to-[#a05b2e] text-white shadow-md shadow-[#b96f3e]/20" : "text-white/60 hover:bg-white/5 hover:text-white"}`
                      : `w-10 h-10 rounded-xl flex items-center justify-center text-[14px] font-medium transition-all duration-200 shrink-0 ${isActive ? "bg-gradient-to-r from-[#b96f3e] to-[#a05b2e] text-white shadow-md shadow-[#b96f3e]/20" : "text-white/60 hover:bg-white/5 hover:text-white"}`
                  } 
                  title={!sidebarOpen ? t("nav." + label.toLowerCase()) : undefined}
                >
                  {({ isActive }) => (
                    <>
                      <Icon size={20} strokeWidth={isActive ? 2.5 : 2}/>
                      {sidebarOpen && <span>{t("nav." + label.toLowerCase())}</span>}
                    </>
                  )}
                </NavLink>
              ))}
            </nav>

            {/* Bottom Profile */}
            <div className={`pt-4 border-t border-white/10 ${sidebarOpen ? "mt-8" : "mt-auto w-full flex flex-col items-center"}`}>
              {sidebarOpen ? (
                <div 
                  className="relative"
                  onMouseEnter={handleSidebarMouseEnter}
                  onMouseLeave={handleSidebarMouseLeave}
                >
                  <div className="flex items-center justify-between group cursor-pointer hover:bg-white/5 p-2 -mx-2 rounded-lg transition-colors" onClick={() => navigate("/settings")}>
                    <div className="flex items-center gap-3">
                      {user?.avatar_path ? (
                        <img src={user?.avatar_path} alt="" className="h-9 w-9 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="h-9 w-9 rounded-full bg-[#b96f3e] text-white flex items-center justify-center text-[12px] font-bold shrink-0">
                          {(user?.full_name || "Librarian").substring(0,2).toUpperCase()}
                        </div>
                      )}
                      <div className="flex flex-col min-w-0">
                        <span className="text-[13px] font-semibold text-white truncate">{user?.full_name || "Librarian"}</span>
                        <span className="text-[11px] text-white/50 truncate">{t("nav.role")}</span>
                      </div>
                    </div>
                    <ChevronDown size={14} className="text-white/40 group-hover:text-white/80" />
                  </div>

                  {showSidebarProfileCard && (
                    <ProfileCard
                      position="sidebar"
                      onClose={() => setShowSidebarProfileCard(false)}
                      preferences={preferences}
                      updatePreferences={updatePreferences}
                      setPaletteOpen={setPaletteOpen}
                      navigate={navigate}
                      t={t}
                      onSignOut={handleSignOut}
                    />
                  )}
                </div>
              ) : (
                <div 
                  className="relative flex justify-center items-center w-full"
                  onMouseEnter={handleSidebarMouseEnter}
                  onMouseLeave={handleSidebarMouseLeave}
                >
                  <button 
                    onClick={() => navigate("/settings")}
                    className="w-10 h-10 rounded-full flex items-center justify-center hover:ring-2 hover:ring-[#b96f3e]/60 transition-all shrink-0"
                    title={user?.full_name || "Librarian"}
                  >
                    {user?.avatar_path ? (
                      <img src={user?.avatar_path} alt="" className="h-9 w-9 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="h-9 w-9 rounded-full bg-[#b96f3e] text-white flex items-center justify-center text-[12px] font-bold shrink-0">
                        {(user?.full_name || "Librarian").substring(0,2).toUpperCase()}
                      </div>
                    )}
                  </button>

                  {showSidebarProfileCard && (
                    <ProfileCard
                      position="sidebar"
                      onClose={() => setShowSidebarProfileCard(false)}
                      preferences={preferences}
                      updatePreferences={updatePreferences}
                      setPaletteOpen={setPaletteOpen}
                      navigate={navigate}
                      t={t}
                      onSignOut={handleSignOut}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Main Area */}
        <main className="flex-1 flex flex-col min-w-0 relative bg-[#F9F8F4] dark:bg-[#111d1a] overflow-hidden">
          {/* Subtle paper grain texture overlay */}
          <div className="bg-paper-texture-overlay" />

          {/* Elegant background SVGs */}
          <div className="absolute inset-0 pointer-events-none select-none overflow-hidden z-0 opacity-[0.03] dark:opacity-[0.015]">
            {/* Top-Right: Open Book & Technical/Draft lines */}
            <svg className="absolute -top-12 -right-12 w-[380px] h-[380px] text-ink dark:text-parchment" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="0.4">
              <circle cx="50" cy="50" r="46" strokeDasharray="1,2" />
              <circle cx="50" cy="50" r="40" strokeDasharray="3,3" />
              <circle cx="50" cy="50" r="32" />
              <path d="M50,75 C60,67 72,70 80,72 L80,22 C72,20 60,17 50,25 C40,17 28,20 20,22 L20,72 C28,70 40,67 50,75 Z" />
              <path d="M50,25 L50,75" />
              <path d="M54,30 C62,24 70,26 76,27" />
              <path d="M54,38 C62,32 70,34 76,35" />
              <path d="M54,46 C62,40 70,42 76,43" />
              <path d="M54,54 C62,48 70,50 76,51" />
              <path d="M54,62 C62,56 70,58 76,59" />
              <path d="M46,30 C38,24 30,26 24,27" />
              <path d="M46,38 C38,32 30,34 24,35" />
              <path d="M46,46 C38,40 30,42 24,43" />
              <path d="M46,54 C38,48 30,50 24,51" />
              <path d="M46,62 C38,56 30,58 24,59" />
            </svg>

            {/* Bottom-Left: Traditional Rosette Geometric Pattern (Arabic/Scribal theme) */}
            <svg className="absolute -bottom-20 -left-20 w-[420px] h-[420px] text-ink dark:text-parchment" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="0.3">
              <circle cx="50" cy="50" r="48" strokeDasharray="2,2" />
              <circle cx="50" cy="50" r="42" />
              <circle cx="50" cy="50" r="30" strokeDasharray="1,1" />
              
              {/* Rotating square star rosette */}
              <rect x="25" y="25" width="50" height="50" transform="rotate(0 50 50)" />
              <rect x="25" y="25" width="50" height="50" transform="rotate(15 50 50)" />
              <rect x="25" y="25" width="50" height="50" transform="rotate(30 50 50)" />
              <rect x="25" y="25" width="50" height="50" transform="rotate(45 50 50)" />
              <rect x="25" y="25" width="50" height="50" transform="rotate(60 50 50)" />
              <rect x="25" y="25" width="50" height="50" transform="rotate(75 50 50)" />
              
              <circle cx="50" cy="50" r="15" />
              <circle cx="50" cy="50" r="6" />
            </svg>
          </div>

          {/* Top Header */}
          <div className="h-[72px] bg-white border-b border-black/5 dark:bg-[#1d2926] dark:border-white/5 flex items-center justify-between px-8 z-30 shadow-sm sticky top-0">
            {/* Search */}
            <div className="flex-1 max-w-2xl relative flex items-center">
              <Search size={18} className="absolute left-4 text-[#122222]/40" />
              <input 
                id="global-search" 
                aria-label="Global search" 
                placeholder={t("nav.quickSearch")} 
                className="w-full bg-[#F9F8F4] dark:bg-[#111d1a] border border-black/5 dark:border-white/5 rounded-full py-2.5 pl-11 pr-14 text-[14px] text-[#122222] dark:text-[#f0ebe1] outline-none focus:ring-2 focus:ring-emerald/20 transition-all" 
                onKeyDown={(e) => { if (e.key === "Enter") navigate("/catalog?q=" + encodeURIComponent(e.currentTarget.value)); }}
              />
              <div className="absolute right-3 flex items-center justify-center w-8 h-6 bg-white dark:bg-[#1d2926] border border-black/10 dark:border-white/10 rounded text-[11px] font-medium text-[#122222]/60 dark:text-white/60 cursor-pointer shadow-sm" onClick={() => setPaletteOpen(true)}>
                ⌘ K
              </div>
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-6 ml-6 relative">
              {/* Notification Bell Button */}
              <div className="relative">
                <button 
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative text-[#122222]/60 hover:text-[#122222] dark:text-white/60 dark:hover:text-white transition-colors p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5"
                  aria-label="Notifications"
                >
                  <Bell size={20} />
                  {totalNotificationsCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-[#b96f3e] text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 border-white dark:border-[#1d2926]">
                      {totalNotificationsCount}
                    </span>
                  )}
                </button>

                {/* Notifications Dropdown */}
                {showNotifications && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                    <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-[#1d2926] rounded-xl border border-black/10 dark:border-white/10 shadow-2xl p-4 z-50 text-[13px]">
                      <h4 className="font-bold text-[#122222] dark:text-white mb-3 pb-2 border-b border-black/5 dark:border-white/5 flex justify-between items-center">
                        <span>{t("nav.notifications")}</span>
                        {totalNotificationsCount > 0 && <span className="text-[10px] text-red-500 font-bold bg-red-500/10 px-2 py-0.5 rounded">{t("nav.overdueCount", { count: totalNotificationsCount })}</span>}
                      </h4>
                      <div className="space-y-3 max-h-60 overflow-y-auto pr-1 no-scrollbar">
                        {totalNotificationsCount > 0 ? (
                          <>
                            {overdueList.map((loan) => (
                              <div 
                                key={loan.id} 
                                onClick={() => {
                                  navigate("/members");
                                  setShowNotifications(false);
                                }}
                                className="p-2 rounded-lg hover:bg-emerald/5 dark:hover:bg-emerald-light/10 transition-colors cursor-pointer border border-black/5 dark:border-white/5"
                              >
                                <div className="font-bold text-[#122222] dark:text-white truncate">{loan.title}</div>
                                <div className="text-[11px] text-[#122222]/60 dark:text-white/60 mt-0.5">{t("circulation.selectedMember")}: {loan.member_name}</div>
                                <div className="text-[10px] text-red-500 font-bold mt-1">{t("circulation.due")}: {formatDisplayDate(loan.due_at)}</div>
                              </div>
                            ))}
                            {readyReservations.map((res) => (
                              <div 
                                key={res.id} 
                                onClick={() => {
                                  navigate("/reservations");
                                  setShowNotifications(false);
                                }}
                                className="p-2 rounded-lg hover:bg-emerald/5 dark:hover:bg-emerald-light/10 transition-colors cursor-pointer border border-black/5 dark:border-white/5"
                              >
                                <div className="font-bold text-[#122222] dark:text-white truncate">{res.title}</div>
                                <div className="text-[11px] text-[#122222]/60 dark:text-white/60 mt-0.5">{t("circulation.selectedMember")}: {res.member_name}</div>
                                <div className="text-[10px] text-emerald-600 dark:text-emerald-light font-bold mt-1">{t("dashboard.ready")}</div>
                              </div>
                            ))}
                          </>
                        ) : (
                          <div className="text-center py-6 text-sm text-[#122222]/40 dark:text-white/40">
                            {t("nav.allClear")}
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
              
              <div className="h-6 w-px bg-black/5 dark:bg-white/5"></div>
              
              {/* Profile Dropdown */}
              <div 
                className="relative"
                onMouseEnter={handleTopbarMouseEnter}
                onMouseLeave={handleTopbarMouseLeave}
              >
                <div className="flex items-center gap-2 cursor-pointer p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors" onClick={() => navigate("/settings")}>
                  {user?.avatar_path ? (
                    <img src={user?.avatar_path} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-[#122222] dark:bg-white/10 text-white flex items-center justify-center text-[12px] font-bold shrink-0">
                      <Users size={14} />
                    </div>

                  )}
                  <span className="text-[14px] font-semibold text-[#122222] dark:text-white hidden sm:block truncate max-w-[80px]">
                    {user?.full_name || "Librarian"}
                  </span>
                  <ChevronDown size={14} className="text-[#122222]/40 dark:text-white/40" />
                </div>

                {showTopbarProfileCard && (
                  <ProfileCard
                    position="topbar"
                    onClose={() => setShowTopbarProfileCard(false)}
                    preferences={preferences}
                    updatePreferences={updatePreferences}
                    setPaletteOpen={setPaletteOpen}
                    navigate={navigate}
                    t={t}
                    onSignOut={handleSignOut}
                  />
                )}
              </div>

              {/* Language Selector Overlay Dropdown */}
              <div className="relative flex items-center gap-1.5 bg-black/5 dark:bg-white/5 px-2.5 py-1.5 rounded-md hover:bg-black/10 transition-colors cursor-pointer">
                <span className="text-[13px] font-semibold text-[#122222] dark:text-white uppercase">{preferences.locale}</span>
                <ChevronDown size={14} className="text-[#122222]/40 dark:text-white/40" />
                <select 
                  value={preferences.locale} 
                  onChange={(e) => {
                    const locale = e.target.value as "en" | "fr" | "ar";
                    updatePreferences({ locale });
                    document.documentElement.lang = locale;
                    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                >
                  <option value="en">English (EN)</option>
                  <option value="fr">Français (FR)</option>
                  <option value="ar">العربية (AR)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Page Content */}
          <div className="flex-1 overflow-auto p-8 relative z-10">
            <Outlet/>
          </div>
        </main>
      </div>
    </div>
  );
}

function ProfileCard({
  position,
  onClose,
  preferences,
  updatePreferences,
  setPaletteOpen,
  navigate,
  t,
  onSignOut,
}: {
  position: "topbar" | "sidebar";
  onClose: () => void;
  preferences: any;
  updatePreferences: any;
  setPaletteOpen: any;
  navigate: any;
  t: any;
  onSignOut: () => void;
}) {

  const user = useAuthStore((s) => s.user);
  const isRtl = preferences.locale === "ar";

  const toggleTheme = () => {
    const nextTheme = preferences.theme === "dark" ? "light" : "dark";
    updatePreferences({ theme: nextTheme });
  };

  // Card classes
  const alignmentClass = position === "topbar" 
    ? (isRtl ? "left-0 top-[100%] mt-2" : "right-0 top-[100%] mt-2")
    : (isRtl ? "right-[100%] bottom-0 mr-4" : "left-[100%] bottom-0 ml-4");

  return (
    <div 
      className={`absolute ${alignmentClass} w-64 bg-white dark:bg-[#1d2926] border border-black/5 dark:border-white/5 rounded-2xl p-4 shadow-2xl z-50 text-[13px] text-[#122222] dark:text-[#f0ebe1] transition-all`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header Profile Section */}
      <div className={`flex items-center gap-3 pb-3 border-b border-black/5 dark:border-white/5 ${isRtl ? "text-right" : "text-left"}`}>
        {user?.avatar_path ? (
          <img src={user?.avatar_path} alt="" className="h-11 w-11 rounded-full object-cover shrink-0 border border-black/5" />
        ) : (
          <div className="h-11 w-11 rounded-full bg-[#b96f3e] text-white flex items-center justify-center text-[13px] font-bold shrink-0 shadow-sm">
            {(user?.full_name || "Librarian").substring(0, 2).toUpperCase()}
          </div>
        )}
        <div className="flex flex-col min-w-0">
          <span className="font-bold text-[14px] leading-tight truncate">{user?.full_name || "Librarian"}</span>
          <span className="text-[11px] text-[#122222]/50 dark:text-white/50 leading-tight mt-0.5">{t("nav.role")}</span>
          <span className="text-[10px] text-[#b96f3e] dark:text-[#c58a59] font-bold tracking-wider uppercase mt-1 truncate">
            {preferences.libraryShortName || preferences.libraryName || "Warraq Library"}
          </span>
        </div>
      </div>

      {/* Action Links */}
      <div className="mt-3 space-y-1">
        <h4 className={`text-[10px] font-bold text-[#122222]/40 dark:text-white/40 uppercase tracking-wider mb-1.5 px-1 ${isRtl ? "text-right" : "text-left"}`}>{t("profileCard.quickActions")}</h4>
        
        {/* Sign Out */}
        <button
          onClick={() => {
            onClose();
            onSignOut();
          }}
          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-[#122222]/80 dark:text-[#f0ebe1]/80 hover:bg-red-500/10 hover:text-red-600 dark:hover:bg-white/5 dark:hover:text-red-400 transition-all group ${isRtl ? "text-right flex-row-reverse" : "text-left"}`}
        >
          <div className={`flex items-center gap-2.5 ${isRtl ? "flex-row-reverse" : ""}`}>
            <span className="w-6 h-6 rounded-lg bg-[#b96f3e]/10 text-[#b96f3e] flex items-center justify-center font-bold transition-colors">
              <LogOut size={14} />
            </span>
            <span className="font-semibold text-[13px]">{t("profileCard.signOut")}</span>
          </div>
        </button>

        {/* Settings */}
        <button 
          onClick={() => {
            navigate("/settings");
            onClose();
          }}

          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-[#122222]/80 dark:text-[#f0ebe1]/80 hover:bg-[#b96f3e]/10 hover:text-[#b96f3e] dark:hover:bg-white/5 dark:hover:text-white transition-all group ${isRtl ? "text-right flex-row-reverse" : "text-left"}`}
        >
          <div className={`flex items-center gap-2.5 ${isRtl ? "flex-row-reverse" : ""}`}>
            <span className="w-6 h-6 rounded-lg bg-black/5 dark:bg-white/5 flex items-center justify-center text-[#122222]/60 dark:text-white/60 group-hover:bg-[#b96f3e]/20 group-hover:text-[#b96f3e] dark:group-hover:bg-[#b96f3e]/20 dark:group-hover:text-[#b96f3e] transition-colors">
              <Cog size={14} />
            </span>
            <span className="font-semibold text-[13px]">{t("profileCard.settings")}</span>
          </div>
        </button>

        {/* Toggle Theme */}
        <button 
          onClick={toggleTheme}
          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-[#122222]/80 dark:text-[#f0ebe1]/80 hover:bg-[#b96f3e]/10 hover:text-[#b96f3e] dark:hover:bg-white/5 dark:hover:text-white transition-all group ${isRtl ? "text-right flex-row-reverse" : "text-left"}`}
        >
          <div className={`flex items-center gap-2.5 ${isRtl ? "flex-row-reverse" : ""}`}>
            <span className="w-6 h-6 rounded-lg bg-black/5 dark:bg-white/5 flex items-center justify-center text-[#122222]/60 dark:text-white/60 group-hover:bg-[#b96f3e]/20 group-hover:text-[#b96f3e] dark:group-hover:bg-[#b96f3e]/20 dark:group-hover:text-[#b96f3e] transition-colors">
              {preferences.theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
            </span>
            <span className="font-semibold text-[13px]">
              {preferences.theme === "dark" ? t("profileCard.themeLight") : t("profileCard.themeDark")}
            </span>
          </div>
        </button>

        {/* Command Palette */}
        <button 
          onClick={() => {
            setPaletteOpen(true);
            onClose();
          }}
          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-[#122222]/80 dark:text-[#f0ebe1]/80 hover:bg-[#b96f3e]/10 hover:text-[#b96f3e] dark:hover:bg-white/5 dark:hover:text-white transition-all group ${isRtl ? "text-right flex-row-reverse" : "text-left"}`}
        >
          <div className={`flex items-center gap-2.5 ${isRtl ? "flex-row-reverse" : ""}`}>
            <span className="w-6 h-6 rounded-lg bg-black/5 dark:bg-white/5 flex items-center justify-center text-[#122222]/60 dark:text-white/60 group-hover:bg-[#b96f3e]/20 group-hover:text-[#b96f3e] dark:group-hover:bg-[#b96f3e]/20 dark:group-hover:text-[#b96f3e] transition-colors">
              <Sparkles size={14} />
            </span>
            <span className="font-semibold text-[13px]">{t("profileCard.commandPalette")}</span>
          </div>
          <span className="text-[10px] text-[#122222]/40 dark:text-white/40 font-semibold bg-black/5 dark:bg-white/5 px-1.5 py-0.5 rounded">⌘K</span>
        </button>
      </div>

      {/* Footer Info */}
      <div className={`mt-4 pt-3 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-[10px] text-[#122222]/40 dark:text-white/40 ${isRtl ? "flex-row-reverse" : ""}`}>
        <span>Warraq v0.1.0</span>
        <span className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-light">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          {t("profileCard.localWorkspace")}
        </span>
      </div>
    </div>
  );
}
