import { useEffect, useState } from "react";
import { HashRouter, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { ErrorBoundary } from "react-error-boundary";
import { useTranslation } from "react-i18next";
import { initializeDatabase } from "../data/database";
import { bootstrapAdminIfNeeded, currentSession } from "../data/auth";
import { useAuthStore } from "../store/authStore";
import { Providers } from "./providers";
import { useUiStore } from "../store/uiStore";
import { useLibrarySettingsStore } from "../store/librarySettingsStore";
import { AppShell } from "../components/layout/AppShell";
import { CommandPalette } from "../components/layout/CommandPalette";
import { DashboardPage } from "../sections/Dashboard";
import { CatalogPage } from "../sections/Catalog";
import { MembersPage } from "../sections/Members";
import { InventoryPage } from "../sections/Inventory";
import { ActivityPage } from "../sections/Activity";
import { ReportsPage } from "../sections/Reports";
import { SettingsPage } from "../sections/Settings";
import { ReservationsPage } from "../sections/Reservations";
import { OnboardingPage } from "../sections/Onboarding";
import { LoginPage, ForcedPasswordChangePage } from "../sections/Login";

import { listen } from "@tauri-apps/api/event";

function Home() { const complete = useUiStore((state) => state.preferences.onboardingComplete); return <Navigate to={complete ? "/dashboard" : "/onboarding"} replace />; }
function Failure({ error }: { error: unknown }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(String(error));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <main className="grid min-h-screen place-items-center bg-[#111d1a] p-6 text-[#f9f8f4]">
      <div className="max-w-lg rounded-2xl bg-[#f9f8f4] p-6 text-[#122222]">
        <h1 className="font-display text-2xl font-bold">Warraq could not start</h1>
        <p className="mt-3 text-sm">Warraq could not reach its Supabase database. Check your internet connection, confirm the VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY settings, and try again.</p>
        <pre className="mt-4 overflow-auto rounded-lg bg-black/5 p-3 text-xs font-mono">{String(error)}</pre>
        <div className="flex items-center gap-3 mt-5">
          <button
            className="rounded-xl bg-emerald px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald/90 transition-colors cursor-pointer"
            onClick={() => location.reload()}
          >
            Retry
          </button>
          <button
            className="rounded-xl bg-black/5 hover:bg-black/10 px-4 py-2.5 text-sm font-bold text-[#122222] transition-colors cursor-pointer"
            onClick={handleCopy}
          >
            {copied ? "Copied!" : "Copy Error"}
          </button>
        </div>
      </div>
    </main>
  );
}

function TrayListener() {
  const navigate = useNavigate();
  const setPaletteOpen = useUiStore((state) => state.setPaletteOpen);

  useEffect(() => {
    let unlistenNavigate: (() => void) | undefined;
    let unlistenSearch: (() => void) | undefined;

    const setupListeners = async () => {
      unlistenNavigate = await listen<string>("warraq://navigate", (event) => {
        navigate(event.payload);
      });
      unlistenSearch = await listen("warraq://quick-search", () => {
        setPaletteOpen(true);
      });
    };

    setupListeners();

    return () => {
      if (unlistenNavigate) unlistenNavigate();
      if (unlistenSearch) unlistenSearch();
    };
  }, [navigate, setPaletteOpen]);

  return null;
}

function Boot() {
  const { t } = useTranslation();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<unknown>();
  const [loadingStep, setLoadingStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const user = useAuthStore((s) => s.user);


  useEffect(() => {
    const runInit = async () => {
      try {
        // Step 1: Database connecting
        setLoadingStep(0);
        setProgress(15);
        await new Promise(r => setTimeout(r, 450));

        await initializeDatabase();
        await bootstrapAdminIfNeeded();
        const session = await currentSession();
        useAuthStore.getState().setUser(session);
        setProgress(45);

        // Step 2: Loading shared library settings
        setLoadingStep(1);
        setProgress(65);
        await new Promise(r => setTimeout(r, 500));

        if (session) {
          await useLibrarySettingsStore.getState().load();
        }
        setProgress(85);

        // Step 3: Loading preferences & indexing
        setLoadingStep(2);
        setProgress(95);
        try {
          const { invoke } = await import("@tauri-apps/api/core");
          const storedPrefs = localStorage.getItem("warraq-preferences");
          let closeToTray = true;
          if (storedPrefs) {
            const parsed = JSON.parse(storedPrefs);
            if (parsed.closeToTray !== undefined) {
              closeToTray = parsed.closeToTray;
            }
          }
          await invoke("set_close_to_tray", { enabled: closeToTray });
        } catch (e) {
          console.warn("Failed to sync close-to-tray preference on boot:", e);
        }
        await new Promise(r => setTimeout(r, 400));

        // Step 4: Finishing up
        setLoadingStep(3);
        setProgress(100);
        await new Promise(r => setTimeout(r, 350));

        setReady(true);
      } catch (err) {
        setError(err);
      }
    };

    runInit();
  }, []);

  if (error) return <Failure error={error} />;

  if (!ready) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#0d1614] overflow-hidden select-none relative font-sans">
        {/* Subtle paper grain texture overlay */}
        <div className="bg-paper-texture-overlay" />

        {/* Soft radial background glow */}
        <div
          className="absolute inset-0 pointer-events-none opacity-50"
          style={{
            background: "radial-gradient(circle at center, rgba(27, 146, 119, 0.15) 0%, rgba(13, 22, 20, 0) 70%)"
          }}
        />

        {/* Glassmorphic Card */}
        <div className="relative p-8 w-[380px] text-center flex flex-col items-center z-10 transition-all">
          {/* Logo container with background glow */}
          <div className="relative w-20 h-20 mb-6 flex items-center justify-center">
            <div className="absolute inset-0 rounded-2xl blur-lg animate-pulse" />
            <div className="relative w-full h-full border border-white/10 rounded-2xl flex items-center justify-center p-3.5 shadow-inner">
              <img
                src="/brand/warraq-symbol-cream.png"
                className="max-w-full max-h-full object-contain"
                alt="App Logo"
              />
            </div>
          </div>

          {/* App Name and Subtitle */}
          <h2 className="font-display text-[20px] font-bold text-white tracking-[.15em] leading-none uppercase">
            Warraq
          </h2>
          <p className="text-[10px] text-[#b96f3e] tracking-[0.25em] font-bold uppercase mt-2">
            Library Engine
          </p>

          {/* Progress Bar Container */}
          <div className="w-full bg-[#122222]/80 rounded-full h-1.5 mt-8 overflow-hidden border border-white/5 shadow-inner">
            <div
              className="bg-gradient-to-r from-[#1b9277] to-[#b96f3e] h-full rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Status step text */}
          <p className="text-[12px] text-white/55 mt-3.5 font-medium tracking-wide min-h-[18px]">
            {loadingStep === 0 && t("boot.database")}
            {loadingStep === 1 && t("boot.preferences")}
            {loadingStep === 2 && t("boot.optimizing")}
            {loadingStep === 3 && t("boot.loading")}
          </p>
        </div>
      </main>
    );
  }

  if (!user) return <LoginPage />;
  if (user.must_change_password) return <ForcedPasswordChangePage />;

  return (
    <HashRouter>
      <TrayListener />
      <CommandPalette />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/catalog" element={<CatalogPage />} />
          <Route path="/members" element={<MembersPage />} />
          <Route path="/reservations" element={<ReservationsPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/activity" element={<ActivityPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Home />} />
      </Routes>
    </HashRouter>
  );
}
export function App() { return <ErrorBoundary FallbackComponent={Failure}><Providers><Boot /></Providers></ErrorBoundary>; }

