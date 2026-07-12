import { BookOpen, CalendarClock, ChartNoAxesCombined, ClipboardList, Cog, LayoutDashboard, Menu, Minus, ScanLine, Square, Users, Warehouse, X } from "lucide-react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useUiStore } from "../../store/uiStore";
import { Button } from "../ui/primitives";

const links = [["/dashboard", "Dashboard", LayoutDashboard], ["/catalog", "Catalog", BookOpen], ["/circulation", "Circulation", ScanLine], ["/members", "Members", Users], ["/reservations", "Reservations", CalendarClock], ["/inventory", "Inventory", Warehouse], ["/reports", "Reports", ChartNoAxesCombined], ["/activity", "Activity", ClipboardList], ["/settings", "Settings", Cog]] as const;

export function AppShell() {
  const { sidebarOpen, toggleSidebar, setPaletteOpen, preferences } = useUiStore();
  const navigate = useNavigate(); const location = useLocation();
  useEffect(() => {
    const isDark = preferences.theme === "dark" || (preferences.theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", isDark);
  }, [preferences.theme]);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (preferences.theme === "system") {
        document.documentElement.classList.toggle("dark", media.matches);
      }
    };
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, [preferences.theme]);
  useEffect(() => { const handler = (event: KeyboardEvent) => { const target = event.target as HTMLElement | null; const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || Boolean(target?.isContentEditable); if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setPaletteOpen(true); } if (!typing && event.key === "/") { event.preventDefault(); document.getElementById("global-search")?.focus(); } if (!typing && (event.ctrlKey || event.metaKey) && event.key === ",") navigate("/settings"); }; window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler); }, [navigate, setPaletteOpen]);
  useEffect(() => { let unlisten: Array<() => void> = []; void import("@tauri-apps/api/event").then(async ({ listen }) => { unlisten = await Promise.all([listen<string>("warraq://navigate", (event) => navigate(event.payload)), listen("warraq://quick-search", () => { setPaletteOpen(true); })]); }).catch(() => undefined); return () => unlisten.forEach((stop) => stop()); }, [navigate, setPaletteOpen]);
  const windowAction = (action: "minimize" | "toggleMaximize" | "close") => { void import("@tauri-apps/api/window").then(({ getCurrentWindow }) => getCurrentWindow()[action]()); };
  return <div className="app-workspace min-h-screen bg-white text-ink dark:bg-[#111d1a] dark:text-[#f4ebdd]">
    <header className="flex h-10 items-center border-b border-white/5 bg-[#17211F] px-5">
      <span data-tauri-drag-region className="flex flex-1 select-none items-center">
        <span className="text-xs font-medium capitalize text-white/40">{location.pathname.slice(1) || "startup"}</span>
      </span>
      <div className="flex shrink-0 gap-1">
        <button aria-label="Minimize window" className="grid h-[28px] w-[36px] place-items-center border-0 rounded text-[16px] text-white/80 transition-colors hover:bg-white/10 hover:text-white" onClick={() => windowAction("minimize")}><Minus size={14} /></button>
        <button aria-label="Toggle maximize" className="grid h-[28px] w-[36px] place-items-center border-0 rounded text-[16px] text-white/80 transition-colors hover:bg-white/10 hover:text-white" onClick={() => windowAction("toggleMaximize")}><Square size={11} /></button>
        <button aria-label="Close window" className="grid h-[28px] w-[36px] place-items-center border-0 rounded text-[16px] text-white/80 transition-colors hover:bg-red-600 hover:text-white" onClick={() => windowAction("close")}><X size={14} /></button>
      </div>
    </header>
    <div className="flex min-h-[calc(100vh-2.5rem)]">
      <aside className={(sidebarOpen ? "w-60" : "w-16") + " warraq-sidebar shrink-0 p-3 text-white transition-[width] flex flex-col"}>
        <div className="mb-8 flex items-center justify-between"><Link to="/dashboard" className="flex min-w-0 items-center gap-2 overflow-hidden"><img src="/brand/warraq-symbol-cream.png" className="h-8 w-8 shrink-0 object-contain" alt="Warraq"/>{sidebarOpen && <span className="font-display text-sm font-bold tracking-[.12em] text-white">WARRAQ</span>}</Link><Button variant="ghost" className="p-2 text-white/75 hover:bg-white/10 hover:text-white" aria-label="Toggle navigation" onClick={toggleSidebar}><Menu size={18}/></Button></div>
        <nav className="space-y-1 flex-1">{links.map(([to, label, Icon]) => <NavLink key={to} to={to} className={({ isActive }) => "sidebar-link flex items-center gap-3 rounded-control px-3 py-2.5 text-sm font-medium transition " + (isActive ? "is-active" : "")} title={!sidebarOpen ? label : undefined}><Icon size={18}/>{sidebarOpen && <span>{label}</span>}</NavLink>)}</nav>
        {sidebarOpen && (
          <div className="mt-8 flex items-center gap-3 px-2 pb-2">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded bg-white/5 text-parchment/60 font-display font-bold">
              {preferences.libraryName.substring(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-parchment/90">{preferences.libraryName}</p>
              <p className="truncate text-[10px] text-parchment/50">Library Management</p>
            </div>
          </div>
        )}
      </aside>
      <main className="warraq-main min-w-0 flex-1 flex flex-col relative overflow-hidden">
        {/* Background Decorative SVG 1 (Bottom Right) */}
        <div className="absolute right-[-120px] bottom-[-120px] w-[550px] h-[550px] pointer-events-none select-none opacity-[0.04] dark:opacity-[0.02] text-emerald dark:text-parchment transition-opacity duration-500">
          <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            <circle cx="100" cy="100" r="90" stroke="currentColor" strokeWidth="0.5" />
            <circle cx="100" cy="100" r="70" stroke="currentColor" strokeWidth="0.5" strokeDasharray="4 4" />
            <circle cx="100" cy="100" r="50" stroke="currentColor" strokeWidth="0.25" />
            <path d="M100 10v180M10 100h180" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 2" />
            <path d="M100 135c-15-10-35-15-55-15v-50c20 0 40 5 55 15 15-10 35-15 55-15v50c-20 0-40 5-55 15z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
            <path d="M100 85v50" stroke="currentColor" strokeWidth="1" />
          </svg>
        </div>

        {/* Background Decorative SVG 2 (Top Left) */}
        <div className="absolute left-[-80px] top-[15%] w-[450px] h-[450px] pointer-events-none select-none opacity-[0.03] dark:opacity-[0.015] text-emerald dark:text-parchment transition-opacity duration-500">
          <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            <path d="M30 40c20 0 40 10 50 25 10-15 30-25 50-25h40v120h-40c-20 0-40 10-50 25-10-15-30-25-50-25H30V40z" stroke="currentColor" strokeWidth="0.5" />
            <path d="M80 65v120" stroke="currentColor" strokeWidth="0.5" />
            <path d="M45 60h25M45 80h25M45 100h25M45 120h25M115 60h25M115 80h25M115 100h25M115 120h25" stroke="currentColor" strokeWidth="0.25" />
            <circle cx="100" cy="100" r="95" stroke="currentColor" strokeWidth="0.25" strokeDasharray="5 5" />
          </svg>
        </div>

        <div className="z-10 border-b border-ink/8 bg-white/90 px-6 py-3 dark:border-parchment/10 dark:bg-[#111d1a]/90">
          <div className="mx-auto flex w-full max-w-[1600px] items-center gap-3">
            <input id="global-search" aria-label="Global search" placeholder="Search books, authors, ISBN…" className="max-w-xl flex-1 rounded-control border border-ink/10 bg-[#fcfbf8] px-3 py-2 text-sm dark:border-parchment/20 dark:bg-[#1d2926] dark:text-parchment" onKeyDown={(e) => { if (e.key === "Enter") navigate("/catalog?q=" + encodeURIComponent(e.currentTarget.value)); }}/>
            <Button variant="secondary" className="ml-2 shrink-0 bg-parchment/80 dark:bg-parchment/15 dark:text-parchment dark:hover:bg-parchment/25" onClick={() => setPaletteOpen(true)}>⌘ K</Button>
          </div>
        </div>
        <div className="p-6 flex-1 flex flex-col z-10">
          <div className="mx-auto w-full max-w-[1600px] flex-1 flex flex-col">
            <Outlet/>
          </div>
        </div>
      </main>
    </div>
  </div>;
}
