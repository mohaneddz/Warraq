import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { copies, updateCopy, deleteCopy } from "../data/repositories/library";
import { Modal, Input, Button, StatusBadge } from "../components/ui/primitives";
import { toast } from "sonner";
import { queryClient } from "../app/providers";
import type { Copy } from "../types";
import { useTranslation } from "react-i18next";
import { cleanBarcode, cleanText } from "../utils/isbn";
import { useUiStore } from "../store/uiStore";
import {
  ScanLine, BookCopy, AlertTriangle, HelpCircle, Trash2,
  ChevronLeft, ChevronRight, LayoutGrid, List, Search, RefreshCw,
  MapPin, Building2, Layers, Package, X,
  Wifi, Pause, Play, Check
} from "lucide-react";

const invalidate = () => queryClient.invalidateQueries();

// ─── Types ────────────────────────────────────────────────────────────────────
interface ScannedItem {
  barcode: string;
  title: string;
  currentShelf: string;
  result: "found" | "misplaced" | "unknown";
  copyId?: string;
}

interface ShelfBay {
  code: string;
  row: string;
  col: number;
  copies: (Copy & { title: string })[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseShelfCode(code: string): { row: string; col: number } | null {
  const m = code.match(/^([A-Za-z]+)[-_]?(\d+)$/);
  if (!m) return null;
  return { row: m[1].toUpperCase(), col: parseInt(m[2], 10) };
}

function groupIntoGrid(allCopies: (Copy & { title: string })[]) {
  const map = new Map<string, ShelfBay>();
  for (const c of allCopies) {
    if (!c.shelf) continue;
    const key = c.shelf.trim().toUpperCase();
    if (!map.has(key)) {
      const parsed = parseShelfCode(key);
      map.set(key, { code: key, row: parsed?.row ?? key, col: parsed?.col ?? 0, copies: [] });
    }
    map.get(key)!.copies.push(c);
  }
  return Array.from(map.values()).sort((a, b) => {
    if (a.row !== b.row) return a.row.localeCompare(b.row);
    return a.col - b.col;
  });
}

function occupancyColor(pct: number) {
  if (pct >= 0.9) return "#ef4444";
  if (pct >= 0.7) return "#f97316";
  if (pct >= 0.4) return "#1a4d40";
  return "#1a4d40";
}

function conditionColor(cond: string) {
  if (cond === "damaged") return "#ef4444";
  if (cond === "worn") return "#f97316";
  if (cond === "fair") return "#facc15";
  return "#1a4d40";
}

// ─── BookShelf SVG Visual ─────────────────────────────────────────────────────
function ShelfVisual({ bay, capacity = 120, isSelected = false, isScanning = false }: {
  bay: ShelfBay;
  capacity?: number;
  isSelected?: boolean;
  isScanning?: boolean;
}) {
  const totalCopies = bay.copies.length;
  const pct = Math.min(totalCopies / capacity, 1);
  const color = occupancyColor(pct);

  // Build spine bars per copy (max 16 shown)
  const spines = bay.copies.slice(0, 16);
  const width = 70;
  const shelfHeight = 52;
  const spineW = Math.max(2, (width - 8) / Math.max(spines.length, 1));

  return (
    <svg
      viewBox={`0 0 ${width} ${shelfHeight + 16}`}
      className="w-full h-auto"
      style={{ maxWidth: 80 }}
    >
      {/* Shelf board bottom */}
      <rect x="0" y={shelfHeight + 2} width={width} height={4} rx="2" fill={isSelected ? "#b96f3e" : "#c9b99a"} />
      {/* Side panel left */}
      <rect x="0" y="0" width="3" height={shelfHeight + 2} rx="1" fill={isSelected ? "#b96f3e" : "#c9b99a"} />
      {/* Side panel right */}
      <rect x={width - 3} y="0" width="3" height={shelfHeight + 2} rx="1" fill={isSelected ? "#b96f3e" : "#c9b99a"} />

      {/* Book spines */}
      {spines.map((c, i) => {
        const x = 4 + i * (spineW + 0.5);
        const h = shelfHeight * (0.5 + Math.random() * 0.45);
        const cc = conditionColor(c.condition);
        return (
          <rect
            key={c.id}
            x={x}
            y={shelfHeight - h + 2}
            width={Math.max(spineW - 0.5, 1.5)}
            height={h}
            rx="1"
            fill={isScanning && c.status === "on-loan" ? "#f97316" : cc}
            opacity={0.85 + Math.random() * 0.15}
          />
        );
      })}

      {/* Scanning pulse overlay */}
      {isScanning && (
        <rect x="3" y="0" width={width - 6} height={shelfHeight + 2} rx="2" fill={color} opacity={0.1} />
      )}
    </svg>
  );
}

// ─── Shelf Bay Card ────────────────────────────────────────────────────────────
function ShelfBayCard({ bay, capacity, isSelected, isScanning, onClick }: {
  bay: ShelfBay;
  capacity?: number;
  isSelected: boolean;
  isScanning: boolean;
  onClick: () => void;
}) {
  const cap = capacity ?? 120;
  const pct = Math.min(bay.copies.length / cap, 1);
  const color = occupancyColor(pct);
  const scanned = bay.copies.filter(c => c.status === "available").length;

  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 border-solid transition-all cursor-pointer text-center ${
        isSelected
          ? "border-[#b96f3e] bg-[#b96f3e]/5 scale-[1.05]"
          : "border-transparent bg-[#122222]/[0.02] dark:bg-[#ffffff]/[0.02] hover:bg-[#122222]/[0.04] dark:hover:bg-[#ffffff]/[0.04] hover:scale-[1.02]"
      }`}
    >
      <ShelfVisual bay={bay} capacity={cap} isSelected={isSelected} isScanning={isScanning} />
      <div className="font-bold text-[11px] text-[#122222] dark:text-white">{bay.code}</div>
      <div className="flex items-center gap-1">
        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-[10px] text-[#122222]/60 dark:text-white/60 font-semibold">
          {isScanning ? `${scanned}/${bay.copies.length}` : `${bay.copies.length}/${cap}`}
        </span>
      </div>
    </button>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────
export function InventoryPage() {
  const { t: _t } = useTranslation();
  const [view, setView] = useState<"grid" | "list">("grid");
  const [searchTerm, setSearchTerm] = useState("");
  const [conditionFilter, setConditionFilter] = useState("all");
  const [selectedBay, setSelectedBay] = useState<string | null>(null);
  const [selectedCopy, setSelectedCopy] = useState<(Copy & { title: string }) | null>(null);
  const [listPage, setListPage] = useState(1);
  const itemsPerPage = useUiStore(s => s.preferences.pageSize) || 15;
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Scanning session
  const [scanInitOpen, setScanInitOpen] = useState(false);
  const [targetShelf, setTargetShelf] = useState("");
  const [activeSession, setActiveSession] = useState(false);
  const [sessionPaused, setSessionPaused] = useState(false);
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [barcodeInput, setBarcodeInput] = useState("");
  const scanInputRef = useRef<HTMLInputElement>(null);

  const result = useQuery({ queryKey: ["copies", "inventory"], queryFn: () => copies() });
  const allCopies = result.data ?? [];

  // Focus scan input
  useEffect(() => {
    if (activeSession && !sessionPaused && scanInputRef.current) {
      scanInputRef.current.focus();
    }
  }, [activeSession, sessionPaused]);

  // Shelf grid
  const shelfBays = useMemo(() => groupIntoGrid(allCopies), [allCopies]);
  const rows = useMemo(() => [...new Set(shelfBays.map(b => b.row))].sort(), [shelfBays]);

  // Counts
  const counts = useMemo(() => {
    const available = allCopies.filter(c => c.status === "available").length;
    const onLoan = allCopies.filter(c => c.status === "on-loan").length;
    const shelved = allCopies.filter(c => c.shelf).length;
    const needsRepair = allCopies.filter(c => c.condition === "damaged").length;
    const unassigned = allCopies.filter(c => !c.shelf).length;
    return { total: allCopies.length, available, onLoan, shelved, needsRepair, unassigned };
  }, [allCopies]);

  // Filtered copies for list view
  const filteredCopies = useMemo(() => {
    return allCopies.filter(c => {
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        if (!c.barcode.toLowerCase().includes(q) && !c.title.toLowerCase().includes(q) && !(c.shelf?.toLowerCase().includes(q))) return false;
      }
      if (selectedBay && c.shelf !== selectedBay) return false;
      if (conditionFilter !== "all" && c.condition !== conditionFilter) return false;
      return true;
    });
  }, [allCopies, searchTerm, selectedBay, conditionFilter]);

  const paginatedCopies = useMemo(() => {
    const start = (listPage - 1) * itemsPerPage;
    return filteredCopies.slice(start, start + itemsPerPage);
  }, [filteredCopies, listPage, itemsPerPage]);
  const totalPages = Math.max(1, Math.ceil(filteredCopies.length / itemsPerPage));

  // Scanning handlers
  const startScanningSession = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = cleanText(targetShelf);
    if (!clean) { toast.warning("Please specify a shelf code."); return; }
    setTargetShelf(clean.toUpperCase());
    setScannedItems([]);
    setScanInitOpen(false);
    setActiveSession(true);
    setSessionPaused(false);
    setSelectedBay(clean.toUpperCase());
  };

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (sessionPaused) return;
    const barcode = cleanBarcode(barcodeInput);
    if (!barcode) return;
    if (scannedItems.some(i => i.barcode === barcode)) {
      toast.warning("Already scanned this session.");
      setBarcodeInput("");
      return;
    }
    const matched = allCopies.find(c => c.barcode.toUpperCase() === barcode);
    if (matched) {
      const isCorrect = (matched.shelf?.trim().toUpperCase() ?? "") === targetShelf;
      setScannedItems(prev => [{ barcode, title: matched.title, currentShelf: matched.shelf ?? "Unassigned", result: isCorrect ? "found" : "misplaced", copyId: matched.id }, ...prev]);
      toast.success(`Scanned: ${matched.title}`);
    } else {
      setScannedItems(prev => [{ barcode, title: "Unknown Item", currentShelf: "Unknown", result: "unknown" }, ...prev]);
      toast.error(`Barcode "${barcode}" not found.`);
    }
    setBarcodeInput("");
  };

  const finishMutation = useMutation({
    mutationFn: async () => {
      const misplaced = scannedItems.filter(i => i.result === "misplaced" && i.copyId);
      for (const item of misplaced) await updateCopy(item.copyId!, { shelf: targetShelf });
    },
    onSuccess: () => {
      toast.success("Shelf audit complete. Locations updated.");
      setActiveSession(false);
      setScannedItems([]);
      setTargetShelf("");
      invalidate();
    },
    onError: (err: any) => toast.error(err.message)
  });

  const bulkArchiveMutation = useMutation({
    mutationFn: async () => { for (const id of selectedIds) await deleteCopy(id); },
    onSuccess: () => { invalidate(); toast.success("Selected copies archived."); setSelectedIds([]); },
    onError: (err: any) => toast.error(err.message)
  });

  const sessionFound = scannedItems.filter(i => i.result === "found").length;
  const sessionMisplaced = scannedItems.filter(i => i.result === "misplaced").length;
  const sessionUnknown = scannedItems.filter(i => i.result === "unknown").length;
  const scanPct = scannedItems.length > 0
    ? Math.round((scannedItems.length / Math.max(shelfBays.find(b => b.code === targetShelf)?.copies.length ?? 1, 1)) * 100)
    : 0;

  return (
    <div className="flex flex-col gap-0 w-full">

      {/* ── Header ── */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="font-display text-[28px] font-bold text-[#122222] dark:text-white leading-tight">Inventory & Shelves</h1>
          <p className="text-[13px] text-[#122222]/60 dark:text-white/60 mt-0.5">Review copy condition and status before running a shelf-scanning session.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => result.refetch()}
            className="flex items-center gap-2 bg-[#122222]/[0.05] dark:bg-white/[0.05] text-[#122222] dark:text-white px-3 py-2 rounded-lg font-semibold text-[13px] hover:bg-[#122222]/[0.08] dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
          >
            <RefreshCw size={14} className={result.isFetching ? "animate-spin" : ""} />
            Refresh
          </button>
          <button
            onClick={() => setScanInitOpen(true)}
            className="flex items-center gap-2 bg-emerald text-white px-4 py-2.5 rounded-lg font-bold text-[13px] hover:bg-emerald/90 transition-colors shadow-sm cursor-pointer"
          >
            <ScanLine size={16} /> Start Scan Session
          </button>
        </div>
      </div>

      {/* ── Metrics Row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Copies", val: counts.total, icon: <BookCopy size={18} />, color: "#1a4d40", bg: "#1a4d40" },
          { label: "Shelved", val: `${counts.shelved} (${counts.total > 0 ? Math.round(counts.shelved / counts.total * 100) : 0}%)`, icon: <Package size={18} />, color: "#1a4d40", bg: "#1a4d40" },
          { label: "Needs Repair", val: counts.needsRepair, icon: <AlertTriangle size={18} />, color: "#f97316", bg: "#f97316" },
          { label: "Unassigned", val: counts.unassigned, icon: <HelpCircle size={18} />, color: "#6b7280", bg: "#6b7280" },
        ].map(m => (
          <div key={m.label} className="bg-white dark:bg-[#1d2926] rounded-2xl border border-black/5 dark:border-white/5 shadow-card p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: m.bg + "18", color: m.color }}>
              {m.icon}
            </div>
            <div>
              <div className="text-[22px] font-bold text-[#122222] dark:text-white leading-none">{m.val}</div>
              <div className="text-[11px] font-semibold text-[#122222]/50 dark:text-white/50 mt-0.5">{m.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Main Layout ── */}
      <div className="flex gap-5 relative">

        {/* ── Left: Location sidebar ── */}
        <div className="w-52 shrink-0 space-y-4">
          <div className="bg-white dark:bg-[#1d2926] rounded-2xl border border-black/5 dark:border-white/5 shadow-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Layers size={14} className="text-[#1a4d40] dark:text-[#1b9277]" />
              <span className="font-bold text-[12px] text-[#122222] dark:text-white uppercase tracking-wider">Locations & floors</span>
            </div>
            <button
              onClick={() => setSelectedBay(null)}
              className={`w-full text-left px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors mb-1 ${selectedBay === null ? "bg-[#1a4d40]/10 text-[#1a4d40] dark:text-[#1b9277]" : "text-[#122222]/70 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/5"}`}
            >
              All locations
            </button>
            <div className="space-y-0.5">
              {rows.map(row => (
                <button
                  key={row}
                  onClick={() => setSelectedBay(row)}
                  className={`w-full text-left px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${selectedBay === row ? "bg-[#1a4d40]/10 text-[#1a4d40] dark:text-[#1b9277]" : "text-[#122222]/60 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/5"}`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded bg-[#1a4d40]/10 dark:bg-[#1a4d40]/20 flex items-center justify-center text-[10px] font-bold text-[#1a4d40] dark:text-[#1b9277]">{row}</div>
                    Row {row}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Floor details */}
          <div className="bg-white dark:bg-[#1d2926] rounded-2xl border border-black/5 dark:border-white/5 shadow-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Building2 size={14} className="text-[#b96f3e]" />
              <span className="font-bold text-[12px] text-[#122222] dark:text-white uppercase tracking-wider">Summary</span>
            </div>
            <div className="space-y-2">
              {[
                { label: "Total bays", val: shelfBays.length },
                { label: "Total capacity", val: `${shelfBays.length * 120}` },
                { label: "Available", val: counts.available },
                { label: "On loan", val: counts.onLoan },
              ].map(row => (
                <div key={row.label} className="flex justify-between items-center">
                  <span className="text-[11px] text-[#122222]/60 dark:text-white/60">{row.label}</span>
                  <span className="text-[12px] font-bold text-[#122222] dark:text-white">{row.val}</span>
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="mt-4 pt-4 border-t border-black/5 dark:border-white/5 space-y-1.5">
              {[
                { label: "Good", color: "#1a4d40" },
                { label: "Repair", color: "#f97316" },
                { label: "Missing", color: "#ef4444" },
                { label: "Not scanned", color: "#d1d5db" },
              ].map(l => (
                <div key={l.label} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: l.color }} />
                  <span className="text-[11px] text-[#122222]/60 dark:text-white/60">{l.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Center: Shelf grid + list ── */}
        <div className="flex-1 min-w-0">
          {/* Toolbar */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 relative max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#122222]/40 dark:text-white/40" />
              <input
                type="text"
                placeholder="Search shelf (e.g., B04)..."
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setListPage(1); }}
                className="w-full bg-white dark:bg-[#1d2926] border border-black/10 dark:border-white/10 rounded-lg py-2 pl-9 pr-3 text-[13px] text-[#122222] dark:text-white outline-none focus:border-[#1a4d40] dark:focus:border-[#1b9277] transition-colors"
              />
            </div>
            <select
              value={conditionFilter}
              onChange={e => setConditionFilter(e.target.value)}
              className="bg-white dark:bg-[#1d2926] border border-black/10 dark:border-white/10 rounded-lg py-2 px-3 text-[13px] text-[#122222] dark:text-white outline-none cursor-pointer"
            >
              <option value="all">All conditions</option>
              <option value="mint">Mint</option>
              <option value="good">Good</option>
              <option value="fair">Fair</option>
              <option value="worn">Worn</option>
              <option value="damaged">Damaged</option>
            </select>
            <div className="flex rounded-lg border border-black/10 dark:border-white/10 overflow-hidden">
              <button
                onClick={() => setView("grid")}
                className={`px-3 py-2 cursor-pointer transition-colors ${view === "grid" ? "bg-[#1a4d40] text-white" : "bg-white dark:bg-[#1d2926] text-[#122222]/60 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/5"}`}
              >
                <LayoutGrid size={14} />
              </button>
              <button
                onClick={() => setView("list")}
                className={`px-3 py-2 cursor-pointer transition-colors ${view === "list" ? "bg-[#1a4d40] text-white" : "bg-white dark:bg-[#1d2926] text-[#122222]/60 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/5"}`}
              >
                <List size={14} />
              </button>
            </div>
          </div>

          {/* ── Grid View: Shelf Bays ── */}
          {view === "grid" && (
            <div className="bg-white dark:bg-[#1d2926] rounded-2xl border border-black/5 dark:border-white/5 shadow-card p-5">
              {rows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-[#122222]/40 dark:text-white/40">
                  <BookCopy size={48} className="mb-4 opacity-30" />
                  <p className="font-bold text-[16px]">No shelves assigned yet</p>
                  <p className="text-[13px] mt-1">Add copies to the catalog with shelf codes like A-01, B-12</p>
                </div>
              ) : (
                rows
                  .filter(row => selectedBay === null || selectedBay === row || shelfBays.some(b => b.code === selectedBay && b.row === row))
                  .map(row => {
                    const baysInRow = shelfBays.filter(b => b.row === row);
                    const filteredBays = selectedBay && selectedBay !== row
                      ? baysInRow.filter(b => b.code === selectedBay)
                      : baysInRow;
                    if (filteredBays.length === 0) return null;

                    return (
                      <div key={row} className="mb-8 last:mb-0">
                        {/* Row header */}
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-8 h-8 bg-[#1a4d40]/10 dark:bg-[#1a4d40]/20 rounded-lg flex items-center justify-center font-bold text-[14px] text-[#1a4d40] dark:text-[#1b9277]">
                            {row}
                          </div>
                          <div className="h-px flex-1 bg-black/5 dark:bg-white/5" />
                          <span className="text-[11px] font-bold text-[#122222]/40 dark:text-white/40 uppercase tracking-wider">Row {row} · {filteredBays.length} bays</span>
                        </div>

                        {/* Column numbers */}
                        <div className="grid gap-1 mb-1" style={{ gridTemplateColumns: `24px repeat(${filteredBays.length}, minmax(0, 1fr))` }}>
                          <div />
                          {filteredBays.map(b => (
                            <div key={b.code} className="text-center text-[10px] font-bold text-[#122222]/40 dark:text-white/40">
                              {String(b.col).padStart(2, "0")}
                            </div>
                          ))}
                        </div>

                        {/* Bay grid with row label */}
                        <div className="grid gap-1 items-end" style={{ gridTemplateColumns: `24px repeat(${filteredBays.length}, minmax(0, 1fr))` }}>
                          <div className="flex items-end justify-center pb-6">
                            <span className="font-bold text-[13px] text-[#122222]/50 dark:text-white/50">{row}</span>
                          </div>
                          {filteredBays.map(b => (
                            <ShelfBayCard
                              key={b.code}
                              bay={b}
                              capacity={120}
                              isSelected={selectedBay === b.code}
                              isScanning={activeSession && targetShelf === b.code}
                              onClick={() => setSelectedBay(selectedBay === b.code ? null : b.code)}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          )}

          {/* ── List View ── */}
          {view === "list" && (
            <div className="bg-white dark:bg-[#1d2926] rounded-2xl border border-black/5 dark:border-white/5 shadow-card overflow-hidden">
              {paginatedCopies.length > 0 ? (
                <>
                  <table className="w-full text-left text-[13px]">
                    <thead className="bg-[#fcfbf8] dark:bg-[#111d1a] border-b border-black/5 dark:border-white/5 text-[11px] font-bold text-[#122222]/50 dark:text-white/50 uppercase tracking-wider">
                      <tr>
                        <th className="px-5 py-3 w-8">
                          <input type="checkbox"
                            checked={selectedIds.length === filteredCopies.length && filteredCopies.length > 0}
                            onChange={e => setSelectedIds(e.target.checked ? filteredCopies.map(c => c.id) : [])}
                            className="cursor-pointer"
                          />
                        </th>
                        <th className="px-5 py-3">Barcode</th>
                        <th className="px-5 py-3">Title</th>
                        <th className="px-5 py-3">Shelf</th>
                        <th className="px-5 py-3">Condition</th>
                        <th className="px-5 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5 dark:divide-white/5">
                      {paginatedCopies.map(copy => (
                        <tr
                          key={copy.id}
                          onClick={() => setSelectedCopy(copy)}
                          className={`hover:bg-black/[0.02] dark:hover:bg-white/[0.02] cursor-pointer transition-colors ${selectedIds.includes(copy.id) ? "bg-emerald/5" : ""}`}
                        >
                          <td className="px-5 py-3" onClick={e => e.stopPropagation()}>
                            <input type="checkbox"
                              checked={selectedIds.includes(copy.id)}
                              onChange={e => setSelectedIds(e.target.checked ? [...selectedIds, copy.id] : selectedIds.filter(id => id !== copy.id))}
                              className="cursor-pointer"
                            />
                          </td>
                          <td className="px-5 py-3 font-mono font-bold text-[12px] text-[#122222] dark:text-white">{copy.barcode}</td>
                          <td className="px-5 py-3 font-semibold text-[#122222]/80 dark:text-white/80 max-w-[200px] truncate">{copy.title}</td>
                          <td className="px-5 py-3">
                            {copy.shelf ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#1a4d40]/10 text-[#1a4d40] dark:text-[#1b9277] font-bold text-[11px]">
                                <MapPin size={10} /> {copy.shelf}
                              </span>
                            ) : (
                              <span className="text-[#122222]/30 dark:text-white/30 text-[11px]">Unassigned</span>
                            )}
                          </td>
                          <td className="px-5 py-3">
                            <span className={`capitalize text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                              copy.condition === "damaged" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                              copy.condition === "worn" ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" :
                              "bg-emerald/10 text-[#1a4d40] dark:text-[#1b9277]"
                            }`}>{copy.condition}</span>
                          </td>
                          <td className="px-5 py-3"><StatusBadge value={copy.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="p-3 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-[12px] text-[#122222]/60 dark:text-white/60 font-semibold bg-[#fcfbf8] dark:bg-[#111d1a]">
                    <span>Showing {Math.min(filteredCopies.length, (listPage - 1) * itemsPerPage + 1)}–{Math.min(filteredCopies.length, listPage * itemsPerPage)} of {filteredCopies.length}</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setListPage(p => Math.max(1, p - 1))} disabled={listPage === 1} className="w-7 h-7 rounded flex items-center justify-center hover:bg-black/5 disabled:opacity-30 cursor-pointer"><ChevronLeft size={14} /></button>
                      <span className="px-2">{listPage} / {totalPages}</span>
                      <button onClick={() => setListPage(p => Math.min(totalPages, p + 1))} disabled={listPage === totalPages} className="w-7 h-7 rounded flex items-center justify-center hover:bg-black/5 disabled:opacity-30 cursor-pointer"><ChevronRight size={14} /></button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-[#122222]/40 dark:text-white/40">
                  <BookCopy size={40} className="mb-4 opacity-30" />
                  <p className="font-bold">No copies found</p>
                </div>
              )}
            </div>
          )}

          {/* Shelf detail panel (shown when a bay is selected in grid view) */}
          {view === "grid" && selectedBay && shelfBays.find(b => b.code === selectedBay) && (
            <div className="mt-4 bg-white dark:bg-[#1d2926] rounded-2xl border border-black/5 dark:border-white/5 shadow-card p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[#b96f3e]/10 rounded-lg flex items-center justify-center">
                    <MapPin size={14} className="text-[#b96f3e]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[15px] text-[#122222] dark:text-white">Shelf {selectedBay}</h3>
                    <p className="text-[11px] text-[#122222]/50 dark:text-white/50">{shelfBays.find(b => b.code === selectedBay)?.copies.length ?? 0} copies · 120 capacity</p>
                  </div>
                </div>
                <button onClick={() => setSelectedBay(null)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors">
                  <X size={14} className="text-[#122222]/60 dark:text-white/60" />
                </button>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {(shelfBays.find(b => b.code === selectedBay)?.copies ?? []).map(c => (
                  <div
                    key={c.id}
                    onClick={() => setSelectedCopy(c)}
                    className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-black/[0.03] dark:hover:bg-white/[0.03] cursor-pointer transition-colors"
                  >
                    <div>
                      <div className="font-semibold text-[12px] text-[#122222] dark:text-white">{c.title}</div>
                      <div className="font-mono text-[10px] text-[#122222]/50 dark:text-white/50">{c.barcode}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-semibold capitalize px-2 py-0.5 rounded-full ${c.condition === "damaged" ? "bg-red-100 text-red-700" : "bg-emerald/10 text-[#1a4d40] dark:text-[#1b9277]"}`}>{c.condition}</span>
                      <StatusBadge value={c.status} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Right: Active Session Panel ── */}
        {activeSession && (
          <div className="w-72 shrink-0">
            <div className="bg-white dark:bg-[#1d2926] rounded-2xl border border-[#1a4d40]/30 dark:border-[#1b9277]/30 shadow-card p-5 sticky top-4">
              {/* Session header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#1a4d40] animate-pulse" />
                  <span className="font-bold text-[12px] text-[#1a4d40] dark:text-[#1b9277] uppercase tracking-wider">Active session</span>
                </div>
                <button
                  onClick={() => setSessionPaused(p => !p)}
                  className="flex items-center gap-1 text-[11px] font-bold text-[#122222]/60 dark:text-white/60 hover:text-[#122222] dark:hover:text-white cursor-pointer transition-colors px-2 py-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5"
                >
                  {sessionPaused ? <><Play size={11} /> Resume</> : <><Pause size={11} /> Pause</>}
                </button>
              </div>

              {/* Target shelf */}
              <div className="mb-4">
                <div className="text-[18px] font-bold text-[#122222] dark:text-white flex items-center gap-2">
                  Shelf {targetShelf}
                  <span className="text-[#b96f3e]">📌</span>
                </div>
              </div>

              {/* Progress */}
              <div className="mb-4">
                <div className="flex justify-between items-end mb-1">
                  <span className="text-[11px] font-bold text-[#122222]/60 dark:text-white/60 uppercase tracking-wider">Scanning progress</span>
                  <span className="text-[14px] font-bold text-[#1a4d40] dark:text-[#1b9277]">{Math.min(scanPct, 100)}%</span>
                </div>
                <div className="text-[18px] font-bold text-[#122222] dark:text-white mb-2">
                  {scannedItems.length} <span className="text-[13px] font-semibold text-[#122222]/50 dark:text-white/50">/ {shelfBays.find(b => b.code === targetShelf)?.copies.length ?? "?"} copies scanned</span>
                </div>
                <div className="h-2 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-[#1a4d40] rounded-full transition-all duration-500" style={{ width: `${Math.min(scanPct, 100)}%` }} />
                </div>
              </div>

              {/* Scanner input */}
              <div className="mb-4 p-3 bg-[#122222]/[0.02] dark:bg-white/[0.02] rounded-xl border border-black/5 dark:border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#122222]/60 dark:text-white/60">
                    <Wifi size={11} className="text-[#1a4d40]" /> Scanner input
                  </div>
                  <span className="text-[10px] font-bold text-[#1a4d40] dark:text-[#1b9277]">Connected ●</span>
                </div>
                <form onSubmit={handleBarcodeSubmit}>
                  <input
                    ref={scanInputRef}
                    type="text"
                    value={barcodeInput}
                    onChange={e => setBarcodeInput(e.target.value)}
                    disabled={sessionPaused}
                    placeholder="Scan ISBN / barcode..."
                    className="w-full bg-white dark:bg-[#111d1a] border border-black/10 dark:border-white/10 rounded-lg py-2 px-3 text-[12px] text-[#122222] dark:text-white outline-none focus:border-[#1a4d40] dark:focus:border-[#1b9277] disabled:opacity-50"
                  />
                </form>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  { label: "Found", val: sessionFound, color: "#1a4d40", sub: "On shelf" },
                  { label: "Misplaced", val: sessionMisplaced, color: "#f97316", sub: "Wrong location" },
                  { label: "Missing", val: sessionUnknown, color: "#ef4444", sub: "Not found" },
                ].map(s => (
                  <div key={s.label} className="text-center">
                    <div className="text-[20px] font-bold" style={{ color: s.color }}>{s.val}</div>
                    <div className="text-[10px] font-bold text-[#122222]/70 dark:text-white/70">{s.label}</div>
                    <div className="text-[9px] text-[#122222]/40 dark:text-white/40">{s.sub}</div>
                  </div>
                ))}
              </div>

              {/* Discrepancies list */}
              {(sessionMisplaced > 0 || sessionUnknown > 0) && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-[#122222]/60 dark:text-white/60">Discrepancies</span>
                    <span className="bg-[#b96f3e] text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">{sessionMisplaced + sessionUnknown}</span>
                  </div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {scannedItems.filter(i => i.result !== "found").map(item => (
                      <div key={item.barcode} className={`flex items-start justify-between p-2.5 rounded-lg text-[11px] ${item.result === "misplaced" ? "bg-[#f97316]/5 border border-[#f97316]/15" : "bg-red-500/5 border border-red-500/15"}`}>
                        <div className="flex-1 min-w-0">
                          <div className="font-mono font-bold text-[#122222] dark:text-white truncate">{item.barcode}</div>
                          <div className="text-[#122222]/50 dark:text-white/50 truncate">{item.title}</div>
                        </div>
                        <div className="text-right ml-2 shrink-0">
                          {item.result === "misplaced" ? (
                            <div>
                              <div className="text-[#f97316] font-bold">Expected: {targetShelf}</div>
                              <div className="text-[#122222]/40 dark:text-white/40">Found in: {item.currentShelf}</div>
                            </div>
                          ) : (
                            <div className="text-red-500 font-bold">Missing</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => { if (confirm("Discard scanning session?")) { setActiveSession(false); setScannedItems([]); } }}
                  className="flex-1 py-2 rounded-lg border border-black/10 dark:border-white/10 text-[12px] font-bold text-[#122222]/60 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => finishMutation.mutate()}
                  disabled={finishMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[#1a4d40] text-white text-[12px] font-bold hover:bg-[#1a4d40]/90 cursor-pointer transition-colors disabled:opacity-50"
                >
                  <Check size={13} /> Finish shelf
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Copy edit modal */}
      {selectedCopy && (
        <CopyEditModal copy={selectedCopy} onClose={() => { setSelectedCopy(null); invalidate(); }} />
      )}

      {/* Scan init modal */}
      {scanInitOpen && (
        <Modal isOpen={scanInitOpen} onClose={() => setScanInitOpen(false)} title="Start Shelf Scan Session">
          <form onSubmit={startScanningSession} className="space-y-4">
            <p className="text-[13px] text-[#122222]/70 dark:text-white/70">Enter the shelf code you want to audit. All scanned barcodes will be checked against this shelf.</p>
            <div>
              <label className="text-[11px] font-bold text-[#122222]/60 dark:text-white/60 uppercase tracking-wider block mb-1.5">Target Shelf Code</label>
              <Input
                type="text"
                placeholder="e.g. B04, A-12"
                value={targetShelf}
                onChange={e => setTargetShelf(e.target.value)}
                required
              />
            </div>
            {shelfBays.length > 0 && (
              <div>
                <p className="text-[11px] font-bold text-[#122222]/50 dark:text-white/50 uppercase tracking-wider mb-2">Or select a shelf:</p>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                  {shelfBays.map(b => (
                    <button
                      key={b.code}
                      type="button"
                      onClick={() => setTargetShelf(b.code)}
                      className={`px-3 py-1.5 rounded-lg text-[12px] font-bold border border-solid cursor-pointer transition-all ${targetShelf.toUpperCase() === b.code ? "border-[#1a4d40] bg-[#1a4d40]/10 text-[#1a4d40] dark:text-[#1b9277]" : "border-transparent bg-[#122222]/[0.03] dark:bg-white/[0.03] text-[#122222]/70 dark:text-white/70 hover:bg-[#122222]/[0.06]"}`}
                    >
                      {b.code}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2 justify-end pt-4 border-t border-black/5 dark:border-white/5">
              <Button type="button" variant="ghost" onClick={() => setScanInitOpen(false)}>Cancel</Button>
              <Button type="submit">Begin Session</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Bulk select bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/95 dark:bg-[#1d2926]/95 backdrop-blur-md px-6 py-3 rounded-full border border-black/10 dark:border-white/10 shadow-lg flex items-center gap-5 z-50">
          <span className="text-[13px] font-semibold text-[#122222] dark:text-white">{selectedIds.length} copies selected</span>
          <div className="h-4 w-px bg-black/10 dark:bg-white/10" />
          <button onClick={() => setSelectedIds([])} className="text-[12px] font-bold text-[#122222]/60 dark:text-white/60 hover:underline cursor-pointer">Deselect all</button>
          <button
            onClick={() => { if (confirm(`Archive ${selectedIds.length} copies?`)) bulkArchiveMutation.mutate(); }}
            className="flex items-center gap-1.5 text-[12px] font-bold bg-red-500 hover:bg-red-600 text-white px-4 py-1.5 rounded-full transition-colors cursor-pointer"
          >
            <Trash2 size={12} /> Archive Selected
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Copy Edit Modal ─────────────────────────────────────────────────────────
function CopyEditModal({ copy, onClose }: { copy: Copy & { title: string }; onClose: () => void }) {
  const { t } = useTranslation();
  const form = useForm({ defaultValues: { shelf: copy.shelf ?? "", condition: copy.condition, status: copy.status } });
  const mutation = useMutation({
    mutationFn: (v: any) => updateCopy(copy.id, v),
    onSuccess: () => { toast.success("Copy updated."); onClose(); },
    onError: (err: any) => toast.error(err.message)
  });
  return (
    <Modal isOpen={true} onClose={onClose} title={`Edit Copy: ${copy.barcode}`}>
      <form onSubmit={form.handleSubmit(v => mutation.mutate(v))} className="space-y-4 text-[13px]">
        <div>
          <p className="text-[10px] text-[#122222]/40 dark:text-white/40 uppercase tracking-wider font-semibold">{t("catalog.headers.title")}</p>
          <p className="font-semibold mt-0.5 text-[#122222] dark:text-white">{copy.title}</p>
        </div>
        <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 block">
          Shelf Location (Code)
          <Input {...form.register("shelf")} placeholder="e.g. A-12" className="mt-1" />
        </label>
        <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 block">
          Condition
          <select {...form.register("condition")} className="field-select text-[13px] py-2 px-3 mt-1 font-semibold w-full">
            {["mint", "good", "fair", "worn", "damaged"].map(v => <option key={v} value={v} className="capitalize">{v.charAt(0).toUpperCase() + v.slice(1)}</option>)}
          </select>
        </label>
        <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 block">
          Status
          <select {...form.register("status")} className="field-select text-[13px] py-2 px-3 mt-1 font-semibold w-full">
            <option value="available">Available</option>
            <option value="on-loan">On Loan</option>
            <option value="reserved">Reserved</option>
            <option value="repair">In Repair</option>
            <option value="lost">Lost</option>
          </select>
        </label>
        <div className="flex gap-2 justify-end pt-4 border-t border-black/5 dark:border-white/5">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={mutation.isPending}>Save Changes</Button>
        </div>
      </form>
    </Modal>
  );
}
