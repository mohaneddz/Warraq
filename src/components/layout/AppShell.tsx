import { BookOpen, CalendarClock, ChartNoAxesCombined, ClipboardList, Cog, LayoutDashboard, Search, Bell, Minus, ScanLine, Square, Users, Warehouse, X, ChevronDown, Menu } from "lucide-react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { useUiStore } from "../../store/uiStore";
import { useQuery } from "@tanstack/react-query";
import { dashboard } from "../../data/repositories/library";
import { formatDisplayDate } from "../../utils/dates";

const links = [
  ["/dashboard", "Dashboard", LayoutDashboard], 
  ["/catalog", "Catalog", BookOpen], 
  ["/circulation", "Circulation", ScanLine], 
  ["/members", "Members", Users], 
  ["/reservations", "Reservations", CalendarClock], 
  ["/inventory", "Inventory", Warehouse], 
  ["/reports", "Reports", ChartNoAxesCombined], 
  ["/activity", "Activity", ClipboardList], 
  ["/settings", "Settings", Cog]
] as const;

export function AppShell() {
  const { sidebarOpen, toggleSidebar, setPaletteOpen, preferences, updatePreferences } = useUiStore();
  const navigate = useNavigate(); 
  const [showNotifications, setShowNotifications] = useState(false);
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

  // Live queries for overdue alerts
  const { data: dashData } = useQuery({ queryKey: ["dashboard-shell"], queryFn: dashboard });
  const overdueCount = preferences.notifyOverdue ? (dashData?.overdue ?? 0) : 0;
  const overdueList = preferences.notifyOverdue ? (dashData?.overdueLoans ?? []) : [];

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
  }, [preferences.accentColor]);

  // ── Font size ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const size = preferences.fontSize === "small" ? "13px" : preferences.fontSize === "large" ? "17px" : "15px";
    document.documentElement.style.setProperty("--font-size-base", size);
  }, [preferences.fontSize]);

  // ── Locale → html lang + dir ──────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.lang = preferences.locale;
    document.documentElement.dir = preferences.locale === "ar" ? "rtl" : "ltr";
  }, [preferences.locale]);

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
  }, [navigate, setPaletteOpen]);

  const windowAction = (action: "minimize" | "toggleMaximize" | "close") => { 
    void import("@tauri-apps/api/window").then(({ getCurrentWindow }) => getCurrentWindow()[action]()); 
  };

  return (
    <div className={`app-workspace h-screen overflow-hidden bg-[#F9F8F4] text-[#122222] dark:bg-[#111d1a] dark:text-[#f0ebe1] flex flex-col font-sans ${isDragging ? "select-none cursor-col-resize" : ""}`}>
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
        <aside className={(sidebarOpen ? "" : "w-[80px]") + " relative shrink-0 text-white flex flex-col z-40 " + (isDragging ? "" : "transition-[width]")} style={{ width: sidebarOpen ? `${sidebarWidth}px` : "80px", background: '#122222' }}>
          
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

          <div className={(sidebarOpen ? "p-6" : "py-6 px-3") + " flex flex-col h-full relative z-10"}>
            {/* Logo & Toggle */}
            <div className="mb-10 w-full">
              {sidebarOpen ? (
                <div className="flex items-center justify-between w-full">
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
                    className="text-white/60 hover:text-white hover:bg-white/10 p-2 rounded transition-colors"
                    aria-label="Expand sidebar"
                  >
                    <Menu size={18} />
                  </button>
                  <Link to="/dashboard" className="flex justify-center">
                    <img src="/brand/warraq-symbol-cream.png" className="h-10 w-10 object-contain" alt="Warraq"/>
                  </Link>
                </div>
              )}
            </div>
            
            {/* Navigation */}
            <nav className="space-y-1.5 flex-1 overflow-y-auto pr-2 no-scrollbar">
              {links.map(([to, label, Icon]) => (
                <NavLink 
                  key={to} 
                  to={to} 
                  className={({ isActive }) => `flex items-center gap-3.5 rounded-lg px-3 py-3 text-[14px] font-medium transition-all duration-200 ${isActive ? "bg-gradient-to-r from-[#b96f3e] to-[#a05b2e] text-white shadow-md shadow-[#b96f3e]/20" : "text-white/60 hover:bg-white/5 hover:text-white"}`} 
                  title={!sidebarOpen ? label : undefined}
                >
                  {({ isActive }) => (
                    <>
                      <Icon size={20} strokeWidth={isActive ? 2.5 : 2}/>
                      {sidebarOpen && <span>{label}</span>}
                    </>
                  )}
                </NavLink>
              ))}
            </nav>

            {/* Bottom Profile */}
            {sidebarOpen && (
              <div className="mt-8 border-t border-white/10 pt-6 pb-2">
                <div className="flex items-center justify-between group cursor-pointer hover:bg-white/5 p-2 -mx-2 rounded-lg transition-colors" onClick={() => navigate("/settings")}>
                  <div className="flex items-center gap-3">
                    {preferences.operatorAvatar ? (
                      <img src={preferences.operatorAvatar} alt="" className="h-9 w-9 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="h-9 w-9 rounded-full bg-[#b96f3e] text-white flex items-center justify-center text-[12px] font-bold shrink-0">
                        {(preferences.operatorName || "Librarian").substring(0,2).toUpperCase()}
                      </div>
                    )}
                    <div className="flex flex-col min-w-0">
                      <span className="text-[13px] font-semibold text-white truncate">{preferences.operatorName || "Librarian"}</span>
                      <span className="text-[11px] text-white/50 truncate">Library Operator</span>
                    </div>
                  </div>
                  <ChevronDown size={14} className="text-white/40 group-hover:text-white/80" />
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Main Area */}
        <main className="flex-1 flex flex-col min-w-0 relative bg-[#F9F8F4] dark:bg-[#111d1a]">
          {/* Top Header */}
          <div className="h-[72px] bg-white border-b border-black/5 dark:bg-[#1d2926] dark:border-white/5 flex items-center justify-between px-8 z-30 shadow-sm sticky top-0">
            {/* Search */}
            <div className="flex-1 max-w-2xl relative flex items-center">
              <Search size={18} className="absolute left-4 text-[#122222]/40" />
              <input 
                id="global-search" 
                aria-label="Global search" 
                placeholder="Search books, authors, ISBN..." 
                className="w-full bg-[#F9F8F4] dark:bg-[#111d1a] border border-black/5 dark:border-white/5 rounded-full py-2.5 pl-11 pr-14 text-[14px] text-[#122222] dark:text-[#f0ebe1] outline-none focus:ring-2 focus:ring-[#1a4d40]/20 transition-all" 
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
                  {overdueCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-[#b96f3e] text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 border-white dark:border-[#1d2926]">
                      {overdueCount}
                    </span>
                  )}
                </button>

                {/* Notifications Dropdown */}
                {showNotifications && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                    <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-[#1d2926] rounded-xl border border-black/10 dark:border-white/10 shadow-2xl p-4 z-50 text-[13px]">
                      <h4 className="font-bold text-[#122222] dark:text-white mb-3 pb-2 border-b border-black/5 dark:border-white/5 flex justify-between items-center">
                        <span>Library Notifications</span>
                        {overdueCount > 0 && <span className="text-[10px] text-red-500 font-bold bg-red-500/10 px-2 py-0.5 rounded">{overdueCount} overdue</span>}
                      </h4>
                      <div className="space-y-3 max-h-60 overflow-y-auto pr-1 no-scrollbar">
                        {overdueList.length > 0 ? (
                          overdueList.map((loan) => (
                            <div 
                              key={loan.id} 
                              onClick={() => {
                                navigate("/circulation");
                                setShowNotifications(false);
                              }}
                              className="p-2 rounded-lg hover:bg-[#1a4d40]/5 dark:hover:bg-[#1b9277]/10 transition-colors cursor-pointer border border-black/5 dark:border-white/5"
                            >
                              <div className="font-bold text-[#122222] dark:text-white truncate">{loan.title}</div>
                              <div className="text-[11px] text-[#122222]/60 dark:text-white/60 mt-0.5">Borrowed by: {loan.member_name}</div>
                              <div className="text-[10px] text-red-500 font-bold mt-1">Due date: {formatDisplayDate(loan.due_at)}</div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-6 text-sm text-[#122222]/40 dark:text-white/40">
                            All clear! No overdue items.
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
              
              <div className="h-6 w-px bg-black/5 dark:bg-white/5"></div>
              
              {/* Profile Dropdown */}
              <div className="flex items-center gap-2 cursor-pointer p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors" onClick={() => navigate("/settings")}>
                {preferences.operatorAvatar ? (
                  <img src={preferences.operatorAvatar} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-[#122222] dark:bg-white/10 text-white flex items-center justify-center text-[12px] font-bold shrink-0">
                    <User size={14} />
                  </div>
                )}
                <span className="text-[14px] font-semibold text-[#122222] dark:text-white hidden sm:block truncate max-w-[80px]">
                  {preferences.operatorName || "Librarian"}
                </span>
                <ChevronDown size={14} className="text-[#122222]/40 dark:text-white/40" />
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
          <div className="flex-1 overflow-auto p-8 relative">
            <Outlet/>
          </div>
        </main>
      </div>
    </div>
  );
}

function User({ size }: { size: number }) {
  return <Users size={size} />;
}
