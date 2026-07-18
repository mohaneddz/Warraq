import { useEffect, useState } from "react";
import { HashRouter, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { ErrorBoundary } from "react-error-boundary";
import { initializeDatabase } from "../data/database";
import { members } from "../data/repositories/library";
import { seedDummyData } from "../data/seed";
import { Providers } from "./providers";
import { useUiStore } from "../store/uiStore";
import { AppShell } from "../components/layout/AppShell";
import { CommandPalette } from "../components/layout/CommandPalette";
import { DashboardPage } from "../sections/Dashboard";
import { CatalogPage } from "../sections/Catalog";
import { CirculationPage } from "../sections/Circulation";
import { MembersPage } from "../sections/Members";
import { InventoryPage } from "../sections/Inventory";
import { ActivityPage } from "../sections/Activity";
import { ReportsPage } from "../sections/Reports";
import { SettingsPage } from "../sections/Settings";
import { ReservationsPage } from "../sections/Reservations";
import { OnboardingPage } from "../sections/Onboarding";

import { listen } from "@tauri-apps/api/event";

function Home() { const complete = useUiStore((state) => state.preferences.onboardingComplete); return <Navigate to={complete ? "/dashboard" : "/onboarding"} replace/>; }
function Failure({ error }: { error: unknown }) { return <main className="grid min-h-screen place-items-center bg-ink p-6 text-parchment"><div className="max-w-lg rounded-card bg-parchment p-6 text-ink"><h1 className="font-display text-2xl font-bold">Warraq could not start</h1><p className="mt-3 text-sm">The local library database could not be opened. Check available disk space and restart the application.</p><pre className="mt-4 overflow-auto rounded bg-ink/5 p-3 text-xs">{String(error)}</pre><button className="mt-4 rounded-control bg-emerald px-3 py-2 text-sm font-semibold text-white" onClick={() => location.reload()}>Retry</button></div></main>; }

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
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<unknown>();
  const [loadingStep, setLoadingStep] = useState(0);
  const [progress, setProgress] = useState(0);


  useEffect(() => {
    const runInit = async () => {
      try {
        // Step 1: Database connecting
        setLoadingStep(0);
        setProgress(15);
        await new Promise(r => setTimeout(r, 450));
        
        await initializeDatabase();
        setProgress(45);
        
        // Step 2: Checking rules and seeding if needed
        setLoadingStep(1);
        setProgress(65);
        await new Promise(r => setTimeout(r, 500));
        
        const m = await members();
        if (m.length === 0) {
          await seedDummyData();
        }
        setProgress(85);
        
        // Step 3: Loading preferences & indexing
        setLoadingStep(2);
        setProgress(95);
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

  if (error) return <Failure error={error}/>;

  if (!ready) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#0d1614] overflow-hidden select-none relative font-sans">
        {/* Soft radial background glow */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-50"
          style={{
            background: "radial-gradient(circle at center, rgba(27, 146, 119, 0.15) 0%, rgba(13, 22, 20, 0) 70%)"
          }}
        />
        
        {/* Glassmorphic Card */}
        <div className="relative bg-[#122222]/40 backdrop-blur-xl border border-white/5 rounded-3xl p-8 w-[380px] text-center shadow-2xl flex flex-col items-center z-10 transition-all">
          {/* Logo container with background glow */}
          <div className="relative w-20 h-20 mb-6 flex items-center justify-center">
            <div className="absolute inset-0 bg-[#b96f3e]/25 rounded-2xl blur-lg animate-pulse" />
            <div className="relative w-full h-full bg-[#122222]/80 border border-white/10 rounded-2xl flex items-center justify-center p-3.5 shadow-inner">
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
            {loadingStep === 0 && "Connecting to SQLite database…"}
            {loadingStep === 1 && "Verifying system preferences & configurations…"}
            {loadingStep === 2 && "Optimizing catalog indices & seed data…"}
            {loadingStep === 3 && "Loading application modules…"}
          </p>
        </div>
      </main>
    );
  }

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
          <Route path="/circulation" element={<CirculationPage />} />
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
export function App() { return <ErrorBoundary FallbackComponent={Failure}><Providers><Boot/></Providers></ErrorBoundary>; }

