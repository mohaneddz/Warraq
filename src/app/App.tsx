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

function Boot() { const [ready, setReady] = useState(false); const [error, setError] = useState<unknown>(); useEffect(() => { initializeDatabase().then(async () => { try { const m = await members(); if (m.length === 0) await seedDummyData(); } catch (e) { console.error("Auto-seed failed", e); } setReady(true); }).catch(setError); }, []); if (error) return <Failure error={error}/>; if (!ready) return <main className="grid min-h-screen place-items-center bg-ink text-parchment"><div className="text-center"><img src="/brand/warraq-symbol.png" className="mx-auto h-16 w-16 animate-pulse" alt="Warraq"/><p className="mt-4 font-display text-lg">Preparing your library…</p></div></main>; return <HashRouter><TrayListener/><CommandPalette/><Routes><Route path="/" element={<Home/>}/><Route path="/onboarding" element={<OnboardingPage/>}/><Route element={<AppShell/>}><Route path="/dashboard" element={<DashboardPage/>}/><Route path="/catalog" element={<CatalogPage/>}/><Route path="/circulation" element={<CirculationPage/>}/><Route path="/members" element={<MembersPage/>}/><Route path="/reservations" element={<ReservationsPage/>}/><Route path="/inventory" element={<InventoryPage/>}/><Route path="/reports" element={<ReportsPage/>}/><Route path="/activity" element={<ActivityPage/>}/><Route path="/settings" element={<SettingsPage/>}/></Route><Route path="*" element={<Home/>}/></Routes></HashRouter>; }
export function App() { return <ErrorBoundary FallbackComponent={Failure}><Providers><Boot/></Providers></ErrorBoundary>; }

