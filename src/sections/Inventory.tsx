import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import {
  copies, updateCopy, deleteCopy,
  getShelves, updateShelf, createShelf,
  getRooms, createRoom, renameRoom, deleteRoom,
  getColumns, createColumn, deleteColumn,
} from "../data/repositories/library";
import { Modal, Input, Button, StatusBadge, ItemTypeBadge } from "../components/ui/primitives";
import { CopyEditModal } from "../components/CopyEditModal";
import { toast } from "sonner";
import { queryClient } from "../app/providers";
import type { Copy, Room, Shelf } from "../types";
import { FLOOR_SHELF_CODE, shelfRowCodes } from "../types";
import { useTranslation } from "react-i18next";
import { cleanBarcode, cleanText } from "../utils/isbn";
import { useUiStore } from "../store/uiStore";
import { useLibrarySettingsStore } from "../store/librarySettingsStore";
import {
  BookCopy, Trash2,
  ChevronLeft, ChevronRight, LayoutGrid, List, Search, RefreshCw,
  MapPin, X, Wifi, Pause, Play, Check, PlusCircle, Library, Info,
  Pencil, Plus,
  CheckCircle2, Clock, Wrench, AlertTriangle, Eye, Copy as CopyIcon
} from "lucide-react";

import { useContextMenu } from "../components/ui/ContextMenu";
import { useThemedAsset } from "../utils/useThemedAsset";

const invalidate = () => queryClient.invalidateQueries();

interface ScannedItem {
  barcode: string;
  title: string;
  item_type?: string;
  currentShelf: string;
  result: "found" | "misplaced" | "unknown";
  copyId?: string;
}

/**
 * Shelf status palette. Instead of a red/amber alarm ramp, degrees of concern are shown as
 * deepening tones of the app's warm parchment brown, so a wall of shelves reads as one
 * material rather than a traffic light. Healthy shelves stay green for contrast.
 */
// "#f9eedd" (faintest wash, badge backgrounds) is used directly in Tailwind class names below —
// Tailwind's JIT scanner needs static literal strings, so it can't be pulled from a constant.
const SHELF_WARN = "#d2ae96";   // worn / filling up
const SHELF_ALERT = "#a87c5f";  // damaged, missing, or full

function occupancyColor(pct: number) {
  if (pct >= 0.9) return SHELF_ALERT;
  if (pct >= 0.7) return SHELF_WARN;
  return "#10b981";
}

/** 3-row bookshelf visual that fills progressively, reused for both lettered and floor shelves. */
function ShelfSvgVisual({ copiesList, capacity }: { copiesList: (Copy & { title?: string })[]; capacity: number }) {
  const SPINES_PER_ROW = 9;
  const ROWS = 3;
  const TOTAL_SLOTS = SPINES_PER_ROW * ROWS;
  const total = copiesList.length;
  const pct = capacity > 0 ? Math.min(total / capacity, 1) : 0;
  const filledSlots = Math.round(pct * TOTAL_SLOTS);

  const spines = useMemo(() => {
    const result: { color: string; height: number; row: number; col: number }[] = [];
    for (let slot = 0; slot < TOTAL_SLOTS; slot++) {
      const row = Math.floor(slot / SPINES_PER_ROW);
      const col = slot % SPINES_PER_ROW;
      const filled = slot < filledSlots;
      let color = "#dde5e2";
      if (filled) {
        const idx = filledSlots > 0 ? Math.floor((slot / filledSlots) * Math.min(copiesList.length, filledSlots)) : 0;
        const copy = copiesList[idx];
        if (copy) {
          if (copy.status === "lost" || copy.condition === "damaged") color = SHELF_ALERT;
          else if (copy.condition === "worn" || copy.condition === "fair") color = SHELF_WARN;
          else color = "#478574";
        } else color = "#478574";
      }
      const h = 14 + ((col * 4 + row * 3 + 5) % 8);
      result.push({ color, height: h, row, col });
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [copiesList, capacity, filledSlots]);

  const svgW = 76, svgH = 66, sideW = 2.5, shelfH = 2.5;
  const innerW = svgW - sideW * 2;
  const rowH = (svgH - shelfH) / ROWS;
  const spineW = 3.2;
  const spineGap = (innerW - SPINES_PER_ROW * spineW) / (SPINES_PER_ROW + 1);
  const shelfY = [rowH, rowH * 2, svgH - shelfH];

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-auto">
      <rect x={sideW} y="0" width={innerW} height={svgH} fill="#f7faf8" className="dark:fill-[#1b2523]" />
      {shelfY.map((sy, i) => (
        <rect key={i} x={sideW} y={sy} width={innerW} height={shelfH} fill={i === 2 ? "#c5ccc9" : "#d1d5db"} className={i === 2 ? "dark:fill-[#384944]" : "dark:fill-[#3a4e49]"} />
      ))}
      <rect x="0" y="0" width={sideW} height={svgH} fill="#dde5e2" className="dark:fill-[#2d3b37]" rx="0.5" />
      <rect x={svgW - sideW} y="0" width={sideW} height={svgH} fill="#dde5e2" className="dark:fill-[#2d3b37]" rx="0.5" />
      <rect x="0" y="0" width={svgW} height={svgH} fill="none" stroke="#e0e7e4" strokeWidth="0.7" className="dark:stroke-white/8" rx="1" />
      {spines.map((spine, i) => {
        const shelfBase = shelfY[spine.row];
        const y = shelfBase - spine.height;
        const x = sideW + spineGap + spine.col * (spineW + spineGap);
        return <rect key={i} x={x} y={y} width={spineW} height={spine.height} fill={spine.color} rx="0.4" opacity={spine.color === "#dde5e2" ? 0.55 : 0.9} />;
      })}
    </svg>
  );
}

export function InventoryPage() {
  const { t } = useTranslation();
  const { showContextMenu } = useContextMenu();
  const noShelvesSrc = useThemedAsset("no-shelves");
  const shelfRowCount = useLibrarySettingsStore((s) => s.settings.shelf_row_count);
  const availableRowCodes = useMemo(() => shelfRowCodes(shelfRowCount), [shelfRowCount]);

  const handleCopyContextMenu = (e: React.MouseEvent, copy: Copy & { title: string }) => {
    showContextMenu(e, [
      { id: "set-available", label: t("inventory.setAvailable", "Set Available"), icon: CheckCircle2, hidden: copy.status === "available", variant: "success", onClick: async () => { await updateCopy(copy.id, { status: "available" }); invalidate(); toast.success(t("inventory.statusUpdated", "Copy status updated to Available")); } },
      { id: "set-loaned", label: t("inventory.setLoaned", "Set On Loan"), icon: Clock, hidden: copy.status === "on-loan", variant: "accent", onClick: async () => { await updateCopy(copy.id, { status: "on-loan" }); invalidate(); toast.info(t("inventory.statusUpdated", "Copy status updated to On Loan")); } },
      { id: "set-repair", label: t("inventory.setRepair", "Set In Repair"), icon: Wrench, hidden: copy.status === "repair", variant: "warning", onClick: async () => { await updateCopy(copy.id, { status: "repair" }); invalidate(); toast.warning(t("inventory.statusUpdated", "Copy status updated to In Repair")); } },
      { id: "set-lost", label: t("inventory.setLost", "Set Lost"), icon: AlertTriangle, hidden: copy.status === "lost", variant: "danger", onClick: async () => { await updateCopy(copy.id, { status: "lost" }); invalidate(); toast.error(t("inventory.statusUpdated", "Copy status updated to Lost")); } },
      { divider: true },
      { id: "view-copy", label: t("inventory.viewCopy", "View / Edit Details"), icon: Eye, onClick: () => setSelectedCopy(copy) },
      { id: "copy-barcode", label: t("inventory.copyBarcode", "Copy Barcode"), icon: CopyIcon, onClick: () => { navigator.clipboard.writeText(copy.barcode); toast.success(t("inventory.copiedBarcode", "Barcode copied to clipboard")); } },
      { divider: true },
      { id: "delete-copy", label: t("inventory.deleteCopy", "Delete Copy"), icon: Trash2, variant: "danger", onClick: async () => {
        if (confirm(t("inventory.confirmDelete", { barcode: copy.barcode }) || `Are you sure you want to delete copy #${copy.barcode}?`)) {
          await deleteCopy(copy.id);
          if (selectedCopy?.id === copy.id) setSelectedCopy(null);
          invalidate();
          toast.success(t("inventory.copyDeleted", "Copy deleted successfully"));
        }
      } },
    ], { title: `Barcode ${copy.barcode}` });
  };

  const [view, setView] = useState<"grid" | "list">("grid");
  // "desc" mirrors the physical bookcase: A at the bottom climbing to the highest letter on top.
  const [rowOrder, setRowOrder] = useState<"asc" | "desc">("desc");
  const [searchTerm, setSearchTerm] = useState("");
  const [conditionFilter, setConditionFilter] = useState("all");
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [selectedShelfId, setSelectedShelfId] = useState<string | null>(null);
  const [selectedCopy, setSelectedCopy] = useState<(Copy & { title: string }) | null>(null);
  const [listPage, setListPage] = useState(1);
  const itemsPerPage = useUiStore(s => s.preferences.pageSize) || 15;
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [manageRoomsOpen, setManageRoomsOpen] = useState(false);
  const [newColumnOpen, setNewColumnOpen] = useState(false);
  const [newColumnRows, setNewColumnRows] = useState<string[]>([...availableRowCodes]);
  const [editingShelf, setEditingShelf] = useState<Shelf | null>(null);

  const [scanInitOpen, setScanInitOpen] = useState(false);
  const [targetShelf, setTargetShelf] = useState("");
  const [activeSession, setActiveSession] = useState(false);
  const [sessionPaused, setSessionPaused] = useState(false);
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [barcodeInput, setBarcodeInput] = useState("");
  const scanInputRef = useRef<HTMLInputElement>(null);

  const [browseModalOpen, setBrowseModalOpen] = useState(false);
  const [targetShelfForBrowse, setTargetShelfForBrowse] = useState<Shelf | null>(null);
  const [browseSearch, setBrowseSearch] = useState("");
  const [browseTypeFilter, setBrowseTypeFilter] = useState("all");

  const handleOpenBrowseModal = (shelf: Shelf) => {
    setTargetShelfForBrowse(shelf);
    setBrowseSearch("");
    setBrowseTypeFilter("all");
    setBrowseModalOpen(true);
  };

  const editShelfForm = useForm({ defaultValues: { capacity: 40, notes: "" } });

  const result = useQuery({ queryKey: ["copies", "inventory"], queryFn: () => copies() });
  const allCopies = result.data ?? [];

  const roomsQuery = useQuery({ queryKey: ["rooms"], queryFn: () => getRooms() });
  const rooms = roomsQuery.data ?? [];

  const columnsQuery = useQuery({ queryKey: ["columns"], queryFn: () => getColumns() });
  const allColumns = columnsQuery.data ?? [];

  const shelvesQuery = useQuery({ queryKey: ["shelves", "inventory"], queryFn: () => getShelves() });
  const allShelves = shelvesQuery.data ?? [];

  useEffect(() => {
    if (!selectedRoomId && rooms.length > 0) setSelectedRoomId(rooms[0].id);
  }, [rooms, selectedRoomId]);

  useEffect(() => {
    if (activeSession && !sessionPaused && scanInputRef.current) scanInputRef.current.focus();
  }, [activeSession, sessionPaused]);

  // Match on shelf_id, not code: every column repeats the same row letters, so matching by
  // code alone would count one copy on the "A" shelf of every bookcase in the room.
  const shelvesWithCopies = useMemo(() => {
    return allShelves.map((s) => ({ ...s, copiesList: allCopies.filter(c => c.shelf_id === s.id) }));
  }, [allShelves, allCopies]);

  const roomShelves = useMemo(
    () => shelvesWithCopies.filter(s => s.room_id === selectedRoomId).sort((a, b) => a.shelf_type === b.shelf_type ? a.code.localeCompare(b.code) : a.shelf_type === "floor" ? 1 : -1),
    [shelvesWithCopies, selectedRoomId]
  );

  const roomColumns = useMemo(
    () => allColumns.filter(c => c.room_id === selectedRoomId).sort((a, b) => a.number - b.number),
    [allColumns, selectedRoomId]
  );

  /**
   * The room laid out as a wall of bookcases: one grid column per bookcase (numbered 01, 02…)
   * and one grid row per shelf level. Lettered rows are ordered by `rowOrder`; the ground row
   * "S" is always pinned to the bottom because that's where it physically sits.
   */
  const shelfGrid = useMemo(() => {
    const byColumnAndCode = new Map<string, typeof roomShelves[number]>();
    const groundByColumn = new Map<string, typeof roomShelves[number]>();
    const usedLetters = new Set<string>();
    for (const s of roomShelves) {
      // The ground row is identified by shelf_type, never by its code: older libraries store it
      // as a "⬤" glyph and only get renamed to "S" once migration 0016 runs, and matching on the
      // label would leave the whole bottom row of the grid empty until then.
      if (s.shelf_type === "floor") {
        groundByColumn.set(s.column_id, s);
      } else {
        byColumnAndCode.set(`${s.column_id}:${s.code.toUpperCase()}`, s);
        usedLetters.add(s.code.toUpperCase());
      }
    }
    // Show every configured row plus any legacy row that exists beyond the current setting,
    // so lowering the setting never hides shelves that still hold copies.
    const letters = Array.from(new Set([...availableRowCodes, ...usedLetters])).sort();
    const ordered = rowOrder === "desc" ? [...letters].reverse() : letters;
    return {
      rows: [...ordered, FLOOR_SHELF_CODE],
      shelfAt: (columnId: string, code: string) =>
        code === FLOOR_SHELF_CODE
          ? groundByColumn.get(columnId)
          : byColumnAndCode.get(`${columnId}:${code.toUpperCase()}`),
    };
  }, [roomShelves, availableRowCodes, rowOrder]);

  const filteredBrowseCopies = useMemo(() => {
    if (!targetShelfForBrowse) return [];
    const q = browseSearch.trim().toLowerCase();
    return allCopies.filter(c => {
      if (browseTypeFilter !== "all" && (c.item_type || "book").toLowerCase() !== browseTypeFilter) return false;
      if (q) {
        const match = c.title?.toLowerCase().includes(q) || c.barcode?.toLowerCase().includes(q) || c.accession_number?.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [allCopies, targetShelfForBrowse, browseSearch, browseTypeFilter]);

  const counts = useMemo(() => {
    const total = allCopies.length;
    const shelved = allCopies.filter(c => c.shelf).length;
    const needsRepair = allCopies.filter(c => c.condition === "damaged" || c.condition === "worn").length;
    const missing = allCopies.filter(c => c.status === "lost" || c.status === "repair").length;
    return { total, shelved, needsRepair, missing };
  }, [allCopies]);

  const filteredCopies = useMemo(() => {
    return allCopies.filter(c => {
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        if (!c.barcode.toLowerCase().includes(q) && !c.title.toLowerCase().includes(q) && !(c.shelf?.toLowerCase().includes(q))) return false;
      }
      if (selectedShelfId) {
        const shelf = allShelves.find(s => s.id === selectedShelfId);
        if (!shelf || c.shelf_id !== shelf.id) return false;
      }
      if (conditionFilter !== "all" && c.condition !== conditionFilter) return false;
      return true;
    });
  }, [allCopies, searchTerm, selectedShelfId, allShelves, conditionFilter]);

  const paginatedCopies = useMemo(() => filteredCopies.slice((listPage - 1) * itemsPerPage, listPage * itemsPerPage), [filteredCopies, listPage, itemsPerPage]);
  const totalPages = Math.max(1, Math.ceil(filteredCopies.length / itemsPerPage));

  const createRoomMutation = useMutation({
    mutationFn: (v: { name: string; notes?: string }) => createRoom(v.name, v.notes || null),
    onSuccess: (room) => { toast.success(t("inventory.roomCreated", "Room created.")); setSelectedRoomId(room.id); roomsQuery.refetch(); },
    onError: (err: any) => toast.error(err.message),
  });

  const createColumnMutation = useMutation({
    mutationFn: (v: { roomId: string; rows: string[] }) => createColumn(v.roomId, v.rows),
    onSuccess: () => { toast.success(t("inventory.columnCreated", "Column added.")); setNewColumnOpen(false); setNewColumnRows([...availableRowCodes]); columnsQuery.refetch(); shelvesQuery.refetch(); },
    onError: (err: any) => toast.error(err.message),
  });

  const createShelfMutation = useMutation({
    mutationFn: (v: { columnId: string; code: string }) =>
      createShelf(v.columnId, v.code, v.code === FLOOR_SHELF_CODE ? "floor" : "top"),
    onSuccess: () => { toast.success(t("inventory.shelfAdded", "Shelf added.")); shelvesQuery.refetch(); },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteColumnMutation = useMutation({
    mutationFn: (id: string) => deleteColumn(id),
    onSuccess: () => { toast.success(t("inventory.columnDeleted", "Column removed.")); setSelectedShelfId(null); columnsQuery.refetch(); shelvesQuery.refetch(); },
    onError: (err: any) => toast.error(err.message),
  });

  const renameRoomMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameRoom(id, name),
    onSuccess: () => { toast.success("Room renamed."); roomsQuery.refetch(); },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteRoomMutation = useMutation({
    mutationFn: (id: string) => deleteRoom(id),
    onSuccess: () => { toast.success("Room removed."); setSelectedRoomId(null); roomsQuery.refetch(); shelvesQuery.refetch(); },
    onError: (err: any) => toast.error(err.message),
  });

  const updateShelfMutation = useMutation({
    mutationFn: (v: { id: string; capacity: number; notes?: string | null }) => updateShelf(v.id, { capacity: v.capacity, notes: v.notes }),
    onSuccess: () => { toast.success("Shelf updated."); setEditingShelf(null); invalidate(); shelvesQuery.refetch(); },
    onError: (err: any) => toast.error(err.message),
  });

  const startScanningSession = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = cleanText(targetShelf);
    if (!clean) { toast.warning("Please specify a shelf code."); return; }
    setTargetShelf(clean.toUpperCase());
    setScannedItems([]);
    setScanInitOpen(false);
    setActiveSession(true);
    setSessionPaused(false);
  };

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (sessionPaused) return;
    const barcode = cleanBarcode(barcodeInput);
    if (!barcode) return;
    if (scannedItems.some(i => i.barcode === barcode)) { toast.warning("Already scanned this session."); setBarcodeInput(""); return; }
    const matched = allCopies.find(c => c.barcode.toUpperCase() === barcode || c.accession_number.toUpperCase() === barcode);
    if (matched) {
      const isCorrect = (matched.shelf?.trim().toUpperCase() ?? "") === targetShelf;
      setScannedItems(prev => [{ barcode, title: matched.title, item_type: matched.item_type || "book", currentShelf: matched.shelf ?? "Unassigned", result: isCorrect ? "found" : "misplaced", copyId: matched.id }, ...prev]);
      toast.success(`Scanned: ${matched.title}`);
    } else {
      setScannedItems(prev => [{ barcode, title: "Unknown Item", currentShelf: "Unknown", result: "unknown" }, ...prev]);
      toast.error(`Barcode/Index "${barcode}" not found.`);
    }
    setBarcodeInput("");
  };

  const finishMutation = useMutation({
    mutationFn: async () => {
      const misplaced = scannedItems.filter(i => i.result === "misplaced" && i.copyId);
      const targetShelfRow = allShelves.find(s => s.code.toUpperCase() === targetShelf);
      for (const item of misplaced) await updateCopy(item.copyId!, { shelfId: targetShelfRow?.id ?? null });
    },
    onSuccess: () => { toast.success("Shelf scan complete. Item positions updated."); setActiveSession(false); setScannedItems([]); setTargetShelf(""); invalidate(); },
    onError: (err: any) => toast.error(err.message),
  });

  const bulkArchiveMutation = useMutation({
    mutationFn: async () => { for (const id of selectedIds) await deleteCopy(id); },
    onSuccess: () => { invalidate(); toast.success("Selected copies archived."); setSelectedIds([]); },
    onError: (err: any) => toast.error(err.message),
  });

  const sessionFound = scannedItems.filter(i => i.result === "found").length;
  const sessionMisplaced = scannedItems.filter(i => i.result === "misplaced").length;
  const sessionUnknown = scannedItems.filter(i => i.result === "unknown").length;
  const scanTarget = allCopies.filter(c => c.shelf?.toUpperCase() === targetShelf).length || 1;
  const scanPct = scannedItems.length > 0 ? Math.round((scannedItems.length / scanTarget) * 100) : 0;

  const selectedRoom = rooms.find(r => r.id === selectedRoomId) ?? null;
  const selectedShelfDetails = roomShelves.find(s => s.id === selectedShelfId) ?? null;

  const handleOpenEditShelf = (sh: Shelf) => {
    editShelfForm.reset({ capacity: sh.capacity, notes: sh.notes || "" });
    setEditingShelf(sh);
  };

  const roomTotalCapacity = roomShelves.reduce((sum, s) => sum + s.capacity, 0);
  const roomTotalCopies = roomShelves.reduce((sum, s) => sum + s.copiesList.length, 0);

  return (
    <div className="flex flex-col gap-0 w-full text-[#122222] dark:text-white">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="font-display text-[26px] font-bold leading-tight">{t("inventory.title", "Inventory & shelves")}</h1>
          <p className="text-[13px] text-[#122222]/60 dark:text-white/60 mt-0.5">{t("inventory.subtitle", "Review copy condition and status before running a shelf-scanning session.")}</p>
        </div>
        <div className="flex items-center gap-2.5">
          <button onClick={() => { result.refetch(); shelvesQuery.refetch(); roomsQuery.refetch(); columnsQuery.refetch(); }} className="w-8 h-8 flex items-center justify-center bg-white dark:bg-[#1d2926] border border-black/8 dark:border-white/8 text-[#122222]/70 dark:text-white/70 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer">
            <RefreshCw size={13} className={result.isFetching || shelvesQuery.isFetching ? "animate-spin" : ""} />
          </button>
          <button onClick={() => setNewColumnOpen(true)} disabled={!selectedRoomId} title={!selectedRoomId ? (t("inventory.selectRoomFirst", "Select or create a room first") as string) : ""} className="flex items-center gap-1 bg-emerald text-white px-4 py-2 rounded-lg font-bold text-[12px] hover:bg-emerald/90 transition-all shadow-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
            <PlusCircle size={14} /> {t("inventory.addColumn", "New Bookcase")}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: t("inventory.totalCopies", "Total copies"), val: counts.total.toLocaleString(), color: "emerald", border: "border-emerald/15" },
          { label: t("inventory.shelved", "Shelved"), val: `${counts.shelved.toLocaleString()} (${counts.total > 0 ? Math.round(counts.shelved / counts.total * 100) : 0}%)`, color: "emerald", border: "border-emerald/15" },
          { label: t("inventory.needsRepair", "Needs repair"), val: counts.needsRepair.toLocaleString(), color: "warn", border: "border-[#d2ae96]/40" },
          { label: t("inventory.missing", "Missing"), val: counts.missing.toLocaleString(), color: "alert", border: "border-[#a87c5f]/30" },
        ].map(m => {
          // Tailwind's JIT scanner needs these as static literal classes — it can't see class
          // names assembled from a variable at runtime — so the two warm tones are spelled out
          // here rather than interpolated from the SHELF_WARN / SHELF_ALERT constants above.
          const colorClass = m.color === "emerald" ? "text-emerald" : m.color === "warn" ? "text-[#ab8264] dark:text-[#d2ae96]" : "text-[#8a6249] dark:text-[#c99b7d]";
          const bgLight = m.color === "emerald" ? "bg-emerald/5" : m.color === "warn" ? "bg-[#f9eedd] dark:bg-[#d2ae96]/10" : "bg-[#f2ddc9] dark:bg-[#a87c5f]/15";
          return (
            <div key={m.label} className={`bg-white dark:bg-[#1d2926] rounded-xl border ${m.border} shadow-card p-4 flex gap-4 items-center`}>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${bgLight}`}><BookCopy size={18} className={colorClass} /></div>
              <div>
                <div className="text-[11px] font-bold text-[#122222]/40 dark:text-white/40 uppercase tracking-wider">{m.label}</div>
                <div className="text-[20px] font-bold leading-none mt-1">{m.val}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-5 items-start relative">
        <div className="w-64 shrink-0 space-y-4">
          <div className="bg-white dark:bg-[#1d2926] rounded-xl border border-black/5 dark:border-white/5 shadow-card p-4">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-black/5 dark:border-white/5">
              <Library size={14} className="text-emerald" />
              <span className="font-bold text-[11px] uppercase tracking-wider text-[#122222]/70 dark:text-white/70 flex-1">{t("inventory.rooms", "Rooms")}</span>
              <button onClick={() => setManageRoomsOpen(true)} title="Manage rooms" className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-[#122222]/40 dark:text-white/40 hover:text-emerald transition-colors cursor-pointer"><Pencil size={11} /></button>
            </div>
            <div className="text-[12px] font-medium space-y-1">
              {rooms.map(room => (
                <button key={room.id} onClick={() => { setSelectedRoomId(room.id); setSelectedShelfId(null); }} className={`w-full text-left px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${selectedRoomId === room.id ? "bg-emerald/10 text-emerald font-bold" : "text-[#122222]/70 dark:text-white/70 hover:bg-black/5"}`}>
                  {room.name}
                </button>
              ))}
              {rooms.length === 0 && <p className="text-[11px] text-[#122222]/40 dark:text-white/40 italic px-2 py-1">{t("inventory.noRooms", "No rooms yet — create one to get started.")}</p>}
            </div>
          </div>

          <div className="bg-white dark:bg-[#1d2926] rounded-xl border border-black/5 dark:border-white/5 shadow-card p-4">
            <div className="flex items-center gap-2 mb-3 pb-1.5 border-b border-black/5">
              <Info size={14} className="text-[#b96f3e]" />
              <span className="font-bold text-[11px] uppercase tracking-wider text-[#122222]/70 dark:text-white/70">{t("inventory.roomDetails", "Room details")}</span>
            </div>
            <div className="text-[12px] space-y-2.5">
              <div className="flex justify-between items-center"><span className="text-[#122222]/55 dark:text-white/55">{t("inventory.room", "Room")}</span><span className="font-bold">{selectedRoom?.name ?? "—"}</span></div>
              <div className="flex justify-between items-center"><span className="text-[#122222]/55 dark:text-white/55">{t("inventory.totalShelves", "Total shelves")}</span><span className="font-bold text-[#b96f3e]">{roomShelves.length}</span></div>
              <div className="flex justify-between items-center"><span className="text-[#122222]/55 dark:text-white/55">{t("inventory.totalCapacity", "Total capacity")}</span><span className="font-bold">{roomTotalCapacity.toLocaleString()} {t("inventory.copiesWord", "copies")}</span></div>
              <div className="flex justify-between items-center"><span className="text-[#122222]/55 dark:text-white/55">{t("inventory.currentlyShelved", "Currently shelved")}</span><span className="font-bold">{roomTotalCopies.toLocaleString()}</span></div>
            </div>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-4 bg-white dark:bg-[#1d2926] p-2 rounded-xl border border-black/5 shadow-sm">
            <div className="flex-1 relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#122222]/40 dark:text-white/40" />
              <input type="text" placeholder={t("inventory.searchPlaceholder", "Search barcode, title, or shelf...") as string} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-[#fcfcfc] dark:bg-[#111d1a] border border-black/8 rounded-lg py-2 pl-9 pr-3 text-[12px] outline-none focus:border-emerald transition-all" />
            </div>
            <select value={conditionFilter} onChange={e => setConditionFilter(e.target.value)} className="bg-[#fcfcfc] dark:bg-[#111d1a] border border-black/8 rounded-lg py-2 px-3 text-[12px] outline-none cursor-pointer">
              <option value="all">{t("inventory.allConditions", "All conditions")}</option>
              <option value="mint">Mint</option><option value="good">Good</option><option value="fair">Fair</option><option value="worn">Worn</option><option value="damaged">Damaged</option>
            </select>
            <div className="flex rounded-lg border border-black/8 overflow-hidden">
              <button onClick={() => setView("grid")} className={`px-3 py-2 cursor-pointer transition-colors ${view === "grid" ? "bg-emerald text-white" : "bg-[#fcfcfc] dark:bg-[#111d1a] text-[#122222]/60 dark:text-white/60"}`}><LayoutGrid size={13} /></button>
              <button onClick={() => setView("list")} className={`px-3 py-2 cursor-pointer transition-colors ${view === "list" ? "bg-emerald text-white" : "bg-[#fcfcfc] dark:bg-[#111d1a] text-[#122222]/60 dark:text-white/60"}`}><List size={13} /></button>
            </div>
            {view === "grid" && (
              <button
                onClick={() => setRowOrder(prev => prev === "asc" ? "desc" : "asc")}
                className="bg-[#fcfcfc] dark:bg-[#111d1a] border border-black/8 rounded-lg py-2 px-3 text-[12px] outline-none cursor-pointer hover:bg-black/5 flex items-center gap-1.5 font-bold text-[#122222]/70 dark:text-white/70 whitespace-nowrap"
                title={t("inventory.rowOrderHint", "Flip which end of the bookcase is drawn at the top") as string}
              >
                <span>{t("inventory.rowsLabel", "Rows:")}</span>
                <span className="text-[#b96f3e]">
                  {rowOrder === "asc" ? t("inventory.rowOrderAsc", "Top → Bottom (A is Top Row)") : t("inventory.rowOrderDesc", "Bottom → Top (A is Bottom Row)")}
                </span>
              </button>
            )}

            <div className="hidden lg:flex items-center gap-3 text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 pl-2">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#478574]"/>Good</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#d2ae96]"/>Repair</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#a87c5f]"/>Missing</span>
            </div>
          </div>

          {view === "grid" && (
            <div className="bg-white dark:bg-[#1d2926] rounded-xl border border-black/5 dark:border-white/5 shadow-card p-5 overflow-auto">
              {!selectedRoom ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-[#122222]/50 dark:text-white/50">
                  <img src={noShelvesSrc} alt="" aria-hidden="true" className="h-64 w-auto object-contain mb-3 opacity-90" />
                  <h3 className="text-sm font-bold">{t("inventory.noRoomSelected", "No room selected")}</h3>
                  <p className="text-[11px] max-w-sm mt-1 mb-4 leading-normal">{t("inventory.createRoomHint", "Create a room in Manage Rooms, then add columns to give it shelves.")}</p>
                  <button type="button" onClick={() => setManageRoomsOpen(true)} className="bg-emerald text-white px-4 py-2 rounded-lg font-bold text-[12px] hover:bg-emerald/90 transition-all shadow-sm cursor-pointer">{t("inventory.manageRooms", "Manage Rooms")}</button>
                </div>
              ) : roomColumns.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-[#122222]/50 dark:text-white/50">
                  <img src={noShelvesSrc} alt="" aria-hidden="true" className="h-64 w-auto object-contain mb-3 opacity-90" />
                  <h3 className="text-sm font-bold">{t("inventory.noColumns", "No columns yet")}</h3>
                  <p className="text-[11px] max-w-sm mt-1 mb-4 leading-normal">{t("inventory.noColumnsHint", "Add a column to give this room its first shelves.")}</p>
                  <button type="button" onClick={() => setNewColumnOpen(true)} className="bg-emerald text-white px-4 py-2 rounded-lg font-bold text-[12px] hover:bg-emerald/90 transition-all shadow-sm cursor-pointer">+ {t("inventory.addColumn", "New Bookcase")}</button>
                </div>
              ) : (
                <div className="min-w-max">
                  {/* Bookcase numbers across the top, plus a shortcut to add another bookcase */}
                  <div className="grid items-center mb-2 text-center text-[11px] font-bold text-[#122222]/40 dark:text-white/40" style={{ gridTemplateColumns: `28px repeat(${roomColumns.length}, 90px) 32px` }}>
                    <div />
                    {roomColumns.map(column => {
                      const columnShelves = roomShelves.filter(s => s.column_id === column.id);
                      const columnEmpty = columnShelves.every(s => s.copiesList.length === 0);
                      return (
                        <div key={column.id} className="group flex items-center justify-center gap-1 uppercase tracking-wider">
                          <span>{String(column.number).padStart(2, "0")}</span>
                          {columnEmpty && (
                            <button type="button" title={t("inventory.deleteColumn", "Delete Column") as string}
                              onClick={() => { if (confirm(t("inventory.confirmDeleteColumn", "Delete this column and its shelves?") as string)) deleteColumnMutation.mutate(column.id); }}
                              className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-[#122222]/30 dark:text-white/30 hover:text-red-500 transition-all cursor-pointer">
                              <Trash2 size={11} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                    <button onClick={() => setNewColumnOpen(true)} title={t("inventory.addColumn", "New Bookcase") as string}
                      className="flex items-center justify-center w-7 h-7 rounded-lg border border-dashed border-emerald/40 text-emerald/60 hover:text-emerald hover:border-emerald hover:bg-emerald/5 transition-all cursor-pointer text-[14px] font-bold">
                      +
                    </button>
                  </div>

                  {/* One row per shelf level, ground row "S" pinned at the bottom */}
                  <div className="space-y-2">
                    {shelfGrid.rows.map(rowCode => (
                      <div key={rowCode} className="grid items-start" style={{ gridTemplateColumns: `28px repeat(${roomColumns.length}, 90px) 32px` }}>
                        <div className={`font-display font-bold text-[13px] text-center self-center ${rowCode === FLOOR_SHELF_CODE ? "text-[#b96f3e]" : "text-[#122222]/40 dark:text-white/40"}`}>
                          {rowCode}
                        </div>

                        {roomColumns.map(column => {
                          const shelf = shelfGrid.shelfAt(column.id, rowCode);
                          const cellCode = `${rowCode}${String(column.number).padStart(2, "0")}`;
                          const isGround = rowCode === FLOOR_SHELF_CODE;

                          if (!shelf) {
                            return (
                              <div key={column.id} className="px-0.5">
                                <button type="button"
                                  disabled={createShelfMutation.isPending}
                                  onClick={() => createShelfMutation.mutate({ columnId: column.id, code: rowCode })}
                                  title={t("inventory.addShelfAt", "Add shelf {{code}}", { code: cellCode }) as string}
                                  className="w-full border border-dashed border-black/10 dark:border-white/10 rounded-lg flex flex-col items-center justify-center text-center transition-all group enabled:hover:border-emerald/50 enabled:hover:bg-emerald/5 enabled:cursor-pointer disabled:opacity-40"
                                  style={{ minHeight: "88px" }}>
                                  <PlusCircle size={13} className="text-[#122222]/15 dark:text-white/15 group-hover:text-emerald transition-colors" />
                                  <span className="text-[9px] font-mono text-[#122222]/20 dark:text-white/20 mt-1">{cellCode}</span>
                                </button>
                              </div>
                            );
                          }

                          const isSelected = selectedShelfId === shelf.id;
                          const occupancy = shelf.capacity > 0 ? shelf.copiesList.length / shelf.capacity : 0;
                          return (
                            <div key={column.id} className="px-0.5">
                              <div onClick={() => setSelectedShelfId(isSelected ? null : shelf.id)}
                                title={isGround ? (t("inventory.floorShelfHint", "The library's oversized floor-level shelf — larger capacity than a lettered shelf.") as string) : undefined}
                                className={`relative border rounded-lg pt-1.5 px-1.5 pb-1.5 text-center flex flex-col items-center justify-between transition-all cursor-pointer hover:shadow-md hover:scale-[1.02] ${isGround ? "bg-[#f4ebdd]/50 dark:bg-[#1a2522]" : "bg-white dark:bg-[#1d2926]"} ${isSelected ? "ring-2 ring-[#b96f3e] border-[#b96f3e]/30 scale-[1.03] shadow-md" : "border-black/8 dark:border-white/8"}`}>
                                {isSelected && (
                                  <div className="absolute -top-0.5 right-2 w-3 h-4 bg-[#b96f3e] rounded-b-sm shadow z-10 flex flex-col justify-end pb-0.5 items-center">
                                    <div className="w-1 h-1 rounded-full bg-white/50" />
                                  </div>
                                )}
                                <div className="w-full"><ShelfSvgVisual copiesList={shelf.copiesList} capacity={shelf.capacity} /></div>
                                <div className="font-bold text-[10px] mt-1 text-[#122222] dark:text-white tracking-wide">{cellCode}</div>
                                <div className="flex items-center gap-1 mt-0.5 justify-center">
                                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: occupancyColor(occupancy) }} />
                                  <span className="text-[9px] text-[#122222]/50 dark:text-white/50 font-bold">{shelf.copiesList.length}/{shelf.capacity}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        <div />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {view === "list" && (
            <div className="bg-white dark:bg-[#1d2926] rounded-xl border border-black/5 dark:border-white/5 shadow-card overflow-hidden">
              {paginatedCopies.length > 0 ? (
                <>
                  <table className="w-full text-left text-[13px]">
                    <thead className="bg-[#fcfbf8] dark:bg-[#111d1a] border-b border-black/5 text-[11px] font-bold text-[#122222]/50 dark:text-white/50 uppercase tracking-wider">
                      <tr>
                        <th className="px-5 py-3 w-8"><input type="checkbox" checked={selectedIds.length === filteredCopies.length && filteredCopies.length > 0} onChange={e => setSelectedIds(e.target.checked ? filteredCopies.map(c => c.id) : [])} className="cursor-pointer" /></th>
                        <th className="px-5 py-3">Barcode</th><th className="px-5 py-3">Type</th><th className="px-5 py-3">Title</th><th className="px-5 py-3">Shelf</th><th className="px-5 py-3">Condition</th><th className="px-5 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5">
                      {paginatedCopies.map(copy => (
                        <tr key={copy.id} onClick={() => setSelectedCopy(copy)} onContextMenu={(e) => handleCopyContextMenu(e, copy)} className={`hover:bg-black/[0.02] dark:hover:bg-white/[0.02] cursor-pointer transition-colors ${selectedIds.includes(copy.id) ? "bg-emerald/5" : ""}`}>
                          <td className="px-5 py-3" onClick={e => e.stopPropagation()}><input type="checkbox" checked={selectedIds.includes(copy.id)} onChange={e => setSelectedIds(e.target.checked ? [...selectedIds, copy.id] : selectedIds.filter(id => id !== copy.id))} className="cursor-pointer" /></td>
                          <td className="px-5 py-3 font-mono font-bold text-[12px] text-[#122222] dark:text-white whitespace-nowrap">{copy.barcode}</td>
                          <td className="px-5 py-3"><ItemTypeBadge type={copy.item_type} /></td>
                          <td className="px-5 py-3 font-semibold text-[#122222]/80 dark:text-white/80"><div className="line-clamp-2" title={copy.title}>{copy.title}</div></td>
                          <td className="px-5 py-3">{copy.shelf ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#1a4d40]/10 text-[#1a4d40] dark:text-[#1b9277] font-bold text-[11px]"><MapPin size={10} /> {copy.shelf}</span> : <span className="text-[#122222]/30 dark:text-white/30 text-[11px]">Unassigned</span>}</td>
                          <td className="px-5 py-3"><span className={`capitalize text-[11px] font-semibold px-2 py-0.5 rounded-full ${copy.condition === "damaged" ? "bg-[#f2ddc9] text-[#8a6249] dark:bg-[#a87c5f]/20 dark:text-[#c99b7d]" : copy.condition === "worn" ? "bg-[#f9eedd] text-[#ab8264] dark:bg-[#d2ae96]/15 dark:text-[#d2ae96]" : "bg-[#10b981]/10 text-[#1a4d40] dark:text-[#1b9277]"}`}>{copy.condition}</span></td>
                          <td className="px-5 py-3"><StatusBadge value={copy.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="p-3 border-t border-black/5 flex items-center justify-between text-[12px] text-[#122222]/60 dark:text-white/60 font-semibold bg-[#fcfbf8] dark:bg-[#111d1a]">
                    <span>Showing {Math.min(filteredCopies.length, (listPage - 1) * itemsPerPage + 1)}–{Math.min(filteredCopies.length, listPage * itemsPerPage)} of {filteredCopies.length}</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setListPage(p => Math.max(1, p - 1))} disabled={listPage === 1} className="w-7 h-7 rounded flex items-center justify-center hover:bg-black/5 disabled:opacity-30 cursor-pointer"><ChevronLeft size={14} /></button>
                      <span className="px-2">{listPage} / {totalPages}</span>
                      <button onClick={() => setListPage(p => Math.min(totalPages, p + 1))} disabled={listPage === totalPages} className="w-7 h-7 rounded flex items-center justify-center hover:bg-black/5 disabled:opacity-30 cursor-pointer"><ChevronRight size={14} /></button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-[#122222]/40 dark:text-white/40"><BookCopy size={40} className="mb-4 opacity-30" /><p className="font-bold">No copies found</p></div>
              )}
            </div>
          )}
        </div>

        {activeSession ? (
          <div className="w-80 shrink-0">
            <div className="bg-white dark:bg-[#1d2926] rounded-xl border border-black/8 shadow-card p-5 sticky top-4 flex flex-col gap-4">
              <div className="flex items-center justify-between pb-2 border-b border-black/5">
                <span className="text-[11px] font-bold text-[#1a4d40] dark:text-[#1b9277] uppercase tracking-wider">Scanning in progress</span>
                <button onClick={() => setSessionPaused(p => !p)} className="flex items-center gap-1 text-[11px] font-bold text-[#122222]/60 dark:text-white/60 hover:text-[#122222] dark:hover:text-white cursor-pointer bg-black/5 dark:bg-white/5 px-2.5 py-1 rounded-lg">{sessionPaused ? <><Play size={11} /> Resume</> : <><Pause size={11} /> Pause</>}</button>
              </div>
              <h3 className="font-bold text-[18px]">Shelf {targetShelf}</h3>
              <div>
                <div className="flex justify-between items-end mb-1"><span className="text-[11px] font-bold text-[#122222]/50 dark:text-white/50 uppercase tracking-wider">Scanning progress</span><span className="text-[13px] font-bold text-[#1a4d40] dark:text-[#1b9277]">{Math.min(scanPct, 100)}%</span></div>
                <div className="text-[18px] font-bold mb-2">{scannedItems.length} <span className="text-[13px] font-semibold text-[#122222]/50 dark:text-white/50">/ {scanTarget} copies scanned</span></div>
                <div className="h-2 bg-black/5 rounded-full overflow-hidden"><div className="h-full bg-[#a87c5f] rounded-full transition-all duration-500" style={{ width: `${Math.min(scanPct, 100)}%` }} /></div>
              </div>
              <div className="p-3 bg-[#122222]/[0.02] rounded-xl border border-black/5">
                <div className="flex items-center justify-between mb-2"><div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#122222]/60 dark:text-white/60"><Wifi size={11} className="text-[#1a4d40]" /> Scanner input</div><span className="text-[10px] font-bold text-[#10b981]">Connected ●</span></div>
                <form onSubmit={handleBarcodeSubmit}>
                  <input ref={scanInputRef} type="text" value={barcodeInput} onChange={e => setBarcodeInput(e.target.value)} disabled={sessionPaused} placeholder="Scan barcode or Accession..." className="w-full bg-white dark:bg-[#111d1a] border border-black/10 rounded-lg py-2 px-3 text-[12px] outline-none focus:border-emerald disabled:opacity-50" />
                </form>
              </div>
              <div className="grid grid-cols-3 gap-2 border-t border-b border-black/5 py-3">
                {[{ label: "On shelf", val: sessionFound, color: "#478574" }, { label: "Wrong shelf", val: sessionMisplaced, color: SHELF_WARN }, { label: "Not found", val: sessionUnknown, color: SHELF_ALERT }].map(s => (
                  <div key={s.label} className="text-center"><div className="text-[18px] font-bold" style={{ color: s.color }}>{s.val}</div><div className="text-[10px] font-bold text-[#122222]/70 dark:text-white/70">{s.label}</div></div>
                ))}
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => { if (confirm("Discard scanning session?")) { setActiveSession(false); setScannedItems([]); } }} className="flex-1 py-2 text-center rounded-lg border border-black/10 text-[12px] font-bold text-[#122222]/60 dark:text-white/60 hover:bg-black/5 cursor-pointer transition-colors">Cancel</button>
                <button onClick={() => finishMutation.mutate()} disabled={finishMutation.isPending} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[#1a4d40] text-white text-[12px] font-bold hover:bg-[#1a4d40]/90 cursor-pointer transition-colors disabled:opacity-50"><Check size={13} /> Finish shelf</button>
              </div>
            </div>
          </div>
        ) : view === "grid" && selectedShelfDetails ? (
          <div className="w-80 shrink-0">
            <div className="bg-white dark:bg-[#1d2926] rounded-xl border border-black/8 shadow-card p-5 sticky top-4 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 pr-4 min-w-0">
                  <div className="w-8 h-8 bg-[#b96f3e]/10 rounded-lg flex items-center justify-center shrink-0"><MapPin size={14} className="text-[#b96f3e]" /></div>
                  <div className="min-w-0"><h3 className="font-bold text-[15px] truncate">{selectedShelfDetails.shelf_type === "floor" ? t("inventory.floorShelf", "Floor shelf") : `Shelf ${selectedShelfDetails.code}`}</h3><p className="text-[11px] text-[#122222]/50 dark:text-white/50 truncate">{selectedRoom?.name}</p></div>
                </div>
                <button onClick={() => setSelectedShelfId(null)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-black/5 cursor-pointer shrink-0"><X size={14} className="text-[#122222]/60 dark:text-white/60" /></button>
              </div>
              {selectedShelfDetails.notes && <div className="p-3 bg-black/[0.01] border border-black/5 rounded-lg text-[12px] text-[#122222]/70 dark:text-white/70 italic">{selectedShelfDetails.notes}</div>}
              <div>
                <div className="flex justify-between items-center mb-1"><span className="text-[11px] font-bold text-[#122222]/40 dark:text-white/40 uppercase tracking-wider">Books on shelf</span><span className="text-[12px] font-bold text-[#b96f3e]">{selectedShelfDetails.copiesList.length} / {selectedShelfDetails.capacity}</span></div>
                <div className="h-2 bg-black/5 rounded-full overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${Math.min((selectedShelfDetails.copiesList.length / selectedShelfDetails.capacity) * 100, 100)}%`, backgroundColor: occupancyColor(selectedShelfDetails.copiesList.length / selectedShelfDetails.capacity) }} /></div>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between"><div className="text-[11px] font-bold text-[#122222]/40 dark:text-white/40 uppercase tracking-wider">Placed items</div><button onClick={() => handleOpenBrowseModal(selectedShelfDetails)} className="text-[11px] font-bold text-emerald hover:underline flex items-center gap-1 cursor-pointer"><Plus size={12} /> Add items</button></div>
                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1 no-scrollbar border-t border-black/5 pt-2">
                  {selectedShelfDetails.copiesList.length === 0 ? <p className="text-center py-6 text-[12px] text-[#122222]/40 dark:text-white/40">No items currently placed on this shelf.</p> : selectedShelfDetails.copiesList.map((c) => (
                    <div key={c.id} onClick={() => setSelectedCopy(c as Copy & { title: string })} className="flex items-center justify-between p-2 rounded-lg bg-black/[0.01] border border-black/5 hover:bg-emerald/5 cursor-pointer transition-all">
                      <div className="min-w-0 pr-2 flex-1"><div className="flex items-center gap-1.5 mb-0.5"><span className="font-semibold text-[12px] truncate" title={c.title}>{c.title}</span><ItemTypeBadge type={c.item_type} /></div><div className="font-mono text-[9px] text-[#122222]/40 dark:text-white/40">{c.barcode}</div></div>
                      <span className={`text-[9px] font-bold capitalize px-1.5 py-0.5 rounded-full shrink-0 ${c.condition === "damaged" ? "bg-[#f2ddc9] text-[#8a6249]" : "bg-emerald/10 text-[#1a4d40]"}`}>{c.condition}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="pt-2 border-t border-black/5 flex gap-2 w-full">
                <button onClick={() => handleOpenBrowseModal(selectedShelfDetails)} className="flex-1 py-2 text-center rounded-xl bg-white dark:bg-[#111d1a] border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 hover:text-emerald text-[12px] font-bold cursor-pointer flex items-center justify-center gap-1.5 transition-colors"><Plus size={14} /> Add Books</button>
                <button onClick={() => handleOpenEditShelf(selectedShelfDetails)} className="flex-1 py-2 text-center rounded-xl bg-emerald hover:bg-emerald/90 text-white text-[12px] font-bold cursor-pointer">Edit</button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {selectedCopy && <CopyEditModal copy={selectedCopy} onClose={() => { setSelectedCopy(null); invalidate(); }} shelves={allShelves} />}

      <Modal isOpen={browseModalOpen} onClose={() => setBrowseModalOpen(false)} title={`Add / Assign Items to Shelf ${targetShelfForBrowse?.code ?? ""}`} size="xl">
        <div className="space-y-4 text-[13px]">
          <div className="flex items-center justify-between bg-[#fcfbf8] dark:bg-[#111d1a] p-3 rounded-xl border border-black/5 dark:border-white/5">
            <div className="text-[12px] text-[#122222]/70 dark:text-white/70">Browse your library catalog to place items onto shelf <span className="font-bold text-emerald font-mono">{targetShelfForBrowse?.code}</span>.</div>
            {targetShelfForBrowse && <span className="text-[11px] font-bold px-2.5 py-1 rounded-md bg-emerald/10 text-emerald shrink-0">Occupancy: {allCopies.filter(c => c.shelf_id === targetShelfForBrowse.id).length} / {targetShelfForBrowse.capacity}</span>}
          </div>
          <div className="flex gap-3 items-center">
            <div className="flex-1 relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#122222]/40 dark:text-white/40" /><Input type="text" value={browseSearch} onChange={(e) => setBrowseSearch(e.target.value)} placeholder="Search items by title, author, barcode, accession number..." className="pl-9 text-[13px] py-2" /></div>
            <select value={browseTypeFilter} onChange={(e) => setBrowseTypeFilter(e.target.value)} className="bg-white dark:bg-[#1d2926] border border-black/10 dark:border-white/10 rounded-lg py-2 px-3 text-[13px] font-semibold text-[#122222] dark:text-white outline-none focus:border-emerald cursor-pointer">
              <option value="all">All Types</option><option value="book">Book</option><option value="fyp">FYP / PFE</option><option value="journal">Journal</option><option value="other">Other</option>
            </select>
          </div>
          <div className="max-h-[460px] overflow-y-auto pr-1 space-y-2.5 no-scrollbar">
            {filteredBrowseCopies.length === 0 ? (
              <div className="text-center py-12 text-[#122222]/40 dark:text-white/40"><BookCopy size={36} className="mx-auto mb-2 opacity-30" /><p className="font-bold text-[14px]">No matching items found</p></div>
            ) : filteredBrowseCopies.map((c) => {
              const isCurrentShelf = targetShelfForBrowse ? c.shelf_id === targetShelfForBrowse.id : false;
              const isOtherShelf = c.shelf && !isCurrentShelf;
              return (
                <div key={c.id} className="flex items-center justify-between p-3 rounded-xl border border-black/5 dark:border-white/5 bg-white dark:bg-[#1d2926] hover:border-emerald/30 transition-all shadow-sm gap-4">
                  <div className="w-12 h-16 rounded-lg bg-[#f4ebdd] dark:bg-[#1a2522] border border-black/10 flex items-center justify-center shrink-0 overflow-hidden relative shadow-sm">
                    {c.cover_path ? <img src={c.cover_path} alt={c.title} className="w-full h-full object-cover" /> : <span className="text-[10px] font-bold text-[#122222]/40 dark:text-white/40 uppercase tracking-tighter">{(c.item_type || "BOK").slice(0, 3)}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5"><h4 className="font-bold text-[14px] text-[#122222] dark:text-white truncate" title={c.title}>{c.title}</h4><ItemTypeBadge type={c.item_type} /></div>
                    {c.author && <p className="text-[12px] text-[#122222]/60 dark:text-white/60 truncate mb-1">{c.author}</p>}
                    <div className="flex items-center gap-2.5 text-[11px] text-[#122222]/50 dark:text-white/50 font-mono"><span>Barcode: <strong className="text-[#122222]/80 dark:text-white/80">{c.barcode}</strong></span><span>·</span><span>Accession: <strong className="text-[#122222]/80 dark:text-white/80">{c.accession_number}</strong></span></div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {isCurrentShelf ? <span className="text-[11px] font-bold text-emerald bg-emerald/10 px-2.5 py-1 rounded-md">Placed on this shelf</span> : isOtherShelf ? <span className="text-[11px] font-semibold text-[#8a6249] dark:text-[#d2ae96] bg-[#f9eedd] dark:bg-[#d2ae96]/15 px-2.5 py-1 rounded-md">Shelf {c.shelf}</span> : <span className="text-[11px] text-[#122222]/40 dark:text-white/40 bg-black/5 dark:bg-white/5 px-2.5 py-1 rounded-md font-semibold">Unassigned</span>}
                    {isCurrentShelf ? (
                      <Button variant="ghost" className="text-[12px] text-red-500 hover:bg-red-500/10 py-1.5 px-3" onClick={async () => { await updateCopy(c.id, { shelfId: null }); toast.success(`Removed "${c.title}" from shelf`); invalidate(); shelvesQuery.refetch(); }}>Remove</Button>
                    ) : (
                      <Button variant="primary" className="text-[12px] py-1.5 px-3" onClick={async () => { if (!targetShelfForBrowse) return; await updateCopy(c.id, { shelfId: targetShelfForBrowse.id }); toast.success(`Assigned "${c.title}" to shelf ${targetShelfForBrowse.code}`); invalidate(); shelvesQuery.refetch(); }}><Plus size={13} /> Add to Shelf</Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-end pt-3 border-t border-black/5 dark:border-white/5"><Button variant="secondary" onClick={() => setBrowseModalOpen(false)}>Done</Button></div>
        </div>
      </Modal>

      {newColumnOpen && selectedRoomId && (
        <Modal isOpen={newColumnOpen} onClose={() => setNewColumnOpen(false)} title={t("inventory.addColumn", "New Bookcase")}>
          <form onSubmit={e => { e.preventDefault(); if (newColumnRows.length === 0) { toast.warning(t("inventory.selectRowsWarning", "Select at least one row.") as string); return; } createColumnMutation.mutate({ roomId: selectedRoomId, rows: newColumnRows }); }} className="space-y-4 text-[13px]">
            <p className="text-[12px] text-[#122222]/60 dark:text-white/60">{t("inventory.addColumnHint", "Adds a new bookshelf column to {{room}} with a floor shelf plus the rows you choose.", { room: selectedRoom?.name })}</p>
            <div>
              <label className="text-[11px] font-bold text-[#122222]/60 dark:text-white/60 uppercase block mb-2">{t("inventory.columnRows", "Shelf rows (A–{{last}})", { last: availableRowCodes[availableRowCodes.length - 1] })}</label>
              <div className="flex flex-wrap gap-2">
                {availableRowCodes.map(row => {
                  const checked = newColumnRows.includes(row);
                  return (
                    <button key={row} type="button" onClick={() => setNewColumnRows(prev => checked ? prev.filter(r => r !== row) : [...prev, row].sort())}
                      className={`w-9 h-9 rounded-lg border font-bold text-xs transition-all cursor-pointer ${checked ? "bg-emerald text-white border-emerald" : "bg-white dark:bg-[#1d2926] text-[#122222]/50 dark:text-white/50 border-black/10 hover:border-[#b96f3e]"}`}>
                      {row}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-4 border-t border-black/5">
              <Button type="button" variant="ghost" onClick={() => setNewColumnOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createColumnMutation.isPending}>{createColumnMutation.isPending ? t("inventory.creatingColumn", "Creating...") : t("inventory.createColumn", "Create Column")}</Button>
            </div>
          </form>
        </Modal>
      )}

      {editingShelf && (
        <Modal isOpen={!!editingShelf} onClose={() => setEditingShelf(null)} title={editingShelf.shelf_type === "floor" ? "Edit Floor Shelf" : `Edit Shelf: ${editingShelf.code}`}>
          <form onSubmit={editShelfForm.handleSubmit(v => updateShelfMutation.mutate({ ...v, id: editingShelf.id }))} className="space-y-4 text-[13px]">
            <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 block">Shelf Capacity<Input type="number" {...editShelfForm.register("capacity", { valueAsNumber: true })} min={1} required className="mt-1" /></label>
            <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 block">Notes (Optional)<Input {...editShelfForm.register("notes")} className="mt-1" /></label>
            <div className="flex gap-2 justify-end pt-4 border-t border-black/5">
              <Button type="button" variant="ghost" onClick={() => setEditingShelf(null)}>Cancel</Button>
              <Button type="submit" disabled={updateShelfMutation.isPending}>Save Changes</Button>
            </div>
          </form>
        </Modal>
      )}

      {scanInitOpen && (
        <Modal isOpen={scanInitOpen} onClose={() => setScanInitOpen(false)} title="Scan Shelf Barcodes">
          <form onSubmit={startScanningSession} className="space-y-4">
            <p className="text-[13px] text-[#122222]/70 dark:text-white/70 font-semibold">Enter or select a shelf code to scan. Scanned barcodes will highlight whether they are misplaced or correctly positioned on this shelf.</p>
            <div><label className="text-[11px] font-bold text-[#122222]/60 dark:text-white/60 uppercase block mb-1.5">Target Shelf Code</label><Input type="text" placeholder="e.g. A, S" value={targetShelf} onChange={e => setTargetShelf(e.target.value)} required /></div>
            {allShelves.length > 0 && (
              <div>
                <p className="text-[11px] font-bold text-[#122222]/50 dark:text-white/50 uppercase mb-2">Or click to select a shelf:</p>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                  {allShelves.map((b) => (
                    <button key={b.id} type="button" onClick={() => setTargetShelf(b.code)} className={`px-3 py-1.5 rounded-lg text-[12px] font-bold border border-solid cursor-pointer transition-all ${targetShelf.toUpperCase() === b.code.toUpperCase() ? "border-emerald bg-emerald/10 text-emerald" : "border-transparent bg-[#122222]/[0.03] dark:bg-white/[0.03] text-[#122222]/70 dark:text-white/70 hover:bg-[#122222]/[0.06]"}`}>{b.code} <span className="opacity-50">({b.room} · Col {b.column_number})</span></button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2 justify-end pt-4 border-t border-black/5"><Button type="button" variant="ghost" onClick={() => setScanInitOpen(false)}>Cancel</Button><Button type="submit">Begin Session</Button></div>
          </form>
        </Modal>
      )}

      {manageRoomsOpen && (
        <ManageRoomsModal rooms={rooms} onClose={() => setManageRoomsOpen(false)}
          onRename={(id, name) => renameRoomMutation.mutate({ id, name })}
          onDelete={(id) => { if (confirm("Delete this room? This only works if it has no shelved copies.")) deleteRoomMutation.mutate(id); }}
          onCreate={(name, notes) => createRoomMutation.mutate({ name, notes })}
          creating={createRoomMutation.isPending}
        />
      )}

      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/95 dark:bg-[#1d2926]/95 backdrop-blur-md px-6 py-3 rounded-full border border-black/10 shadow-lg flex items-center gap-5 z-50">
          <span className="text-[13px] font-semibold text-[#122222] dark:text-white">{selectedIds.length} copies selected</span>
          <div className="h-4 w-px bg-black/10" />
          <button onClick={() => setSelectedIds([])} className="text-[12px] font-bold text-[#122222]/60 dark:text-white/60 hover:underline cursor-pointer">Deselect all</button>
          <button onClick={() => { if (confirm(`Archive ${selectedIds.length} copies?`)) bulkArchiveMutation.mutate(); }} className="flex items-center gap-1.5 text-[12px] font-bold bg-red-500 hover:bg-red-600 text-white px-4 py-1.5 rounded-full transition-colors cursor-pointer"><Trash2 size={12} /> Archive Selected</button>
        </div>
      )}
    </div>
  );
}

function ManageRoomsModal({ rooms, onClose, onRename, onDelete, onCreate, creating }: {
  rooms: Room[]; onClose: () => void; onRename: (id: string, name: string) => void; onDelete: (id: string) => void;
  onCreate: (name: string, notes?: string) => void; creating: boolean;
}) {
  const { t } = useTranslation();
  const noShelvesSrc = useThemedAsset("no-shelves");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");

  return (
    <Modal isOpen={true} onClose={onClose} title={t("inventory.manageRooms", "Manage Rooms")}>
      <div className="space-y-1.5 min-h-[200px] text-[13px]">
        {rooms.map(room => (
          <div key={room.id} className="group flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
            {editingId === room.id ? (
              <form onSubmit={e => { e.preventDefault(); if (nameInput.trim()) { onRename(room.id, nameInput.trim()); setEditingId(null); } }} className="flex items-center gap-1 flex-1">
                <input autoFocus value={nameInput} onChange={e => setNameInput(e.target.value)} className="flex-1 bg-white dark:bg-[#111d1a] border border-emerald rounded px-2 py-1 text-[12px] outline-none" onKeyDown={e => e.key === "Escape" && setEditingId(null)} />
                <button type="submit" className="text-emerald cursor-pointer"><Check size={13} /></button>
                <button type="button" onClick={() => setEditingId(null)} className="text-[#122222]/40 dark:text-white/40 cursor-pointer"><X size={13} /></button>
              </form>
            ) : (
              <>
                <span className="flex-1 font-medium">{room.name}</span>
                <button onClick={() => { setEditingId(room.id); setNameInput(room.name); }} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-black/10 text-[#122222]/50 dark:text-white/50 transition-opacity cursor-pointer"><Pencil size={11} /></button>
                <button onClick={() => onDelete(room.id)} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-[#122222]/50 dark:text-white/50 hover:text-red-500 transition-opacity cursor-pointer"><Trash2 size={11} /></button>
              </>
            )}
          </div>
        ))}
        {rooms.length === 0 && !adding && (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <img src={noShelvesSrc} alt="" aria-hidden="true" className="h-36 w-auto object-contain mb-2 opacity-90" />
            <p className="text-[12px] text-[#122222]/60 dark:text-white/60 italic px-2">{t("inventory.noRooms", "No rooms yet — create one to get started.")}</p>
          </div>
        )}

        {adding ? (
          <form onSubmit={e => { e.preventDefault(); if (newName.trim()) { onCreate(newName.trim()); setNewName(""); setAdding(false); } }} className="flex items-center gap-1 px-2.5 py-1">
            <input autoFocus placeholder={t("inventory.roomName", "Room name") as string} value={newName} onChange={e => setNewName(e.target.value)} className="flex-1 bg-white dark:bg-[#111d1a] border border-emerald rounded px-2 py-1 text-[12px] outline-none" onKeyDown={e => e.key === "Escape" && setAdding(false)} />
            <button type="submit" disabled={creating} className="text-emerald cursor-pointer"><Check size={13} /></button>
            <button type="button" onClick={() => setAdding(false)} className="text-[#122222]/40 dark:text-white/40 cursor-pointer"><X size={13} /></button>
          </form>
        ) : (
          <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[12px] font-bold text-emerald hover:bg-emerald/5 transition-colors cursor-pointer w-full">
            <Plus size={13} /> {t("inventory.addRoom", "Add Room")}
          </button>
        )}
      </div>
      <div className="flex justify-end pt-4 mt-2 border-t border-black/5"><Button variant="ghost" onClick={onClose}>Close</Button></div>
    </Modal>
  );
}
