import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { 
  copies, updateCopy, deleteCopy,
  getShelves, createShelf, updateShelf, deleteShelf,
  renameBuilding, deleteBuilding, renameFloor, deleteFloor
} from "../data/repositories/library";
import { Modal, Input, Button, StatusBadge, ItemTypeBadge } from "../components/ui/primitives";
import { toast } from "sonner";
import { queryClient } from "../app/providers";
import type { Copy } from "../types";
import { useTranslation } from "react-i18next";
import { cleanBarcode, cleanText } from "../utils/isbn";
import { useUiStore } from "../store/uiStore";
import {
  BookCopy, Trash2,
  ChevronLeft, ChevronRight, ChevronDown, LayoutGrid, List, Search, RefreshCw,
  MapPin, X, Wifi, Pause, Play, Check, PlusCircle, Library, Info,
  Pencil, Plus, Building2, Layers, Trash,
  CheckCircle2, Clock, Wrench, AlertTriangle, Eye, Copy as CopyIcon
} from "lucide-react";

import { useContextMenu } from "../components/ui/ContextMenu";



const invalidate = () => queryClient.invalidateQueries();

// ─── Custom Icons ───
function ShelfRowIcon({ size = 12, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 18h18" />
      <path d="M6 8v10" />
      <path d="M11 6v12" />
      <path d="M16 9v9" />
    </svg>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface ScannedItem {
  barcode: string;
  title: string;
  item_type?: string;
  currentShelf: string;
  result: "found" | "misplaced" | "unknown";
  copyId?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function occupancyColor(pct: number) {
  if (pct >= 0.9) return "#ef4444"; // Red (full)
  if (pct >= 0.7) return "#f97316"; // Orange (medium)
  return "#10b981"; // Green (open)
}

// ─── SVG Book Spines Visualizer ───
// 3-row bookshelf that fills progressively left→right, top→bottom.
function ShelfSvgVisual({ copiesList, capacity, rowOrder = "asc" }: { copiesList: any[]; capacity: number; rowOrder?: "asc" | "desc" }) {
  const SPINES_PER_ROW = 9;
  const ROWS = 3;
  const TOTAL_SLOTS = SPINES_PER_ROW * ROWS;
  const total = copiesList.length;
  const pct = capacity > 0 ? Math.min(total / capacity, 1) : 0;
  const filledSlots = Math.round(pct * TOTAL_SLOTS);

  const spines = useMemo(() => {
    const result: { color: string; height: number; row: number; col: number }[] = [];
    for (let slot = 0; slot < TOTAL_SLOTS; slot++) {
      const rawRow = Math.floor(slot / SPINES_PER_ROW);
      const row = rowOrder === "desc" ? (ROWS - 1 - rawRow) : rawRow;
      const col = slot % SPINES_PER_ROW;
      const filled = slot < filledSlots;
      let color = "#dde5e2";

      if (filled) {
        const idx = filledSlots > 0
          ? Math.floor((slot / filledSlots) * Math.min(copiesList.length, filledSlots))
          : 0;
        const copy = copiesList[idx];
        if (copy) {
          if (copy.status === "lost" || copy.condition === "damaged") color = "#dd4a4a";
          else if (copy.condition === "worn" || copy.condition === "fair") color = "#dd7a4a";
          else color = "#478574";
        } else {
          color = "#478574";
        }
      }

      const h = 14 + ((col * 4 + row * 3 + 5) % 8); // heights 14–22px
      result.push({ color, height: h, row, col });
    }
    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [copiesList, capacity, filledSlots, rowOrder]);

  // Compact SVG – fits in a small card
  const svgW = 76;
  const svgH = 66;
  const sideW = 2.5;
  const shelfH = 2.5;
  const innerW = svgW - sideW * 2;
  const rowH = (svgH - shelfH) / ROWS; // height allocated per row
  const spineW = 3.2;
  const spineGap = (innerW - SPINES_PER_ROW * spineW) / (SPINES_PER_ROW + 1);

  // Shelf board y-positions (after row 0, after row 1, bottom)
  const shelfY = [rowH, rowH * 2, svgH - shelfH];

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-auto">
      {/* Background */}
      <rect x={sideW} y="0" width={innerW} height={svgH} fill="#f7faf8" className="dark:fill-[#1b2523]" />

      {/* Shelf boards between rows */}
      {shelfY.map((sy, i) => (
        <rect key={i} x={sideW} y={sy} width={innerW} height={shelfH}
          fill={i === 2 ? "#c5ccc9" : "#d1d5db"}
          className={i === 2 ? "dark:fill-[#384944]" : "dark:fill-[#3a4e49]"}
        />
      ))}

      {/* Side panels */}
      <rect x="0" y="0" width={sideW} height={svgH} fill="#dde5e2" className="dark:fill-[#2d3b37]" rx="0.5" />
      <rect x={svgW - sideW} y="0" width={sideW} height={svgH} fill="#dde5e2" className="dark:fill-[#2d3b37]" rx="0.5" />

      {/* Border */}
      <rect x="0" y="0" width={svgW} height={svgH} fill="none" stroke="#e0e7e4" strokeWidth="0.7" className="dark:stroke-white/8" rx="1" />

      {/* Book spines – 3 rows */}
      {spines.map((spine, i) => {
        // Each spine sits on top of its row's shelf board
        const shelfBase = shelfY[spine.row];
        const y = shelfBase - spine.height;
        const x = sideW + spineGap + spine.col * (spineW + spineGap);
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={spineW}
            height={spine.height}
            fill={spine.color}
            rx="0.4"
            opacity={spine.color === "#dde5e2" ? 0.55 : 0.9}
          />
        );
      })}
    </svg>
  );
}

export function InventoryPage() {
  const { t } = useTranslation();
  const { showContextMenu } = useContextMenu();

  const handleCopyContextMenu = (e: React.MouseEvent, copy: Copy & { title: string }) => {
    showContextMenu(e, [
      {
        id: "set-available",
        label: t("inventory.setAvailable", "Set Available"),
        icon: CheckCircle2,
        hidden: copy.status === "available",
        variant: "success",
        onClick: async () => {
          await updateCopy(copy.id, { status: "available" });
          invalidate();
          toast.success(t("inventory.statusUpdated", "Copy status updated to Available"));
        },
      },
      {
        id: "set-loaned",
        label: t("inventory.setLoaned", "Set On Loan"),
        icon: Clock,
        hidden: copy.status === "on-loan",
        variant: "accent",
        onClick: async () => {
          await updateCopy(copy.id, { status: "on-loan" });
          invalidate();
          toast.info(t("inventory.statusUpdated", "Copy status updated to On Loan"));
        },
      },
      {
        id: "set-repair",
        label: t("inventory.setRepair", "Set In Repair"),
        icon: Wrench,
        hidden: copy.status === "repair",
        variant: "warning",
        onClick: async () => {
          await updateCopy(copy.id, { status: "repair" });
          invalidate();
          toast.warning(t("inventory.statusUpdated", "Copy status updated to In Repair"));
        },
      },
      {
        id: "set-lost",
        label: t("inventory.setLost", "Set Lost"),
        icon: AlertTriangle,
        hidden: copy.status === "lost",
        variant: "danger",
        onClick: async () => {
          await updateCopy(copy.id, { status: "lost" });
          invalidate();
          toast.error(t("inventory.statusUpdated", "Copy status updated to Lost"));
        },
      },
      { divider: true },
      {
        id: "view-copy",
        label: t("inventory.viewCopy", "View / Edit Details"),
        icon: Eye,
        onClick: () => setSelectedCopy(copy),
      },
      {
        id: "copy-barcode",
        label: t("inventory.copyBarcode", "Copy Barcode"),
        icon: CopyIcon,
        onClick: () => {
          navigator.clipboard.writeText(copy.barcode);
          toast.success(t("inventory.copiedBarcode", "Barcode copied to clipboard"));
        },
      },
      { divider: true },
      {
        id: "delete-copy",
        label: t("inventory.deleteCopy", "Delete Copy"),
        icon: Trash2,
        variant: "danger",
        onClick: async () => {
          if (confirm(t("inventory.confirmDelete", { barcode: copy.barcode }) || `Are you sure you want to delete copy #${copy.barcode}?`)) {
            await deleteCopy(copy.id);
            if (selectedCopy?.id === copy.id) setSelectedCopy(null);
            invalidate();
            toast.success(t("inventory.copyDeleted", "Copy deleted successfully"));
          }
        },
      },
    ], { title: `Barcode ${copy.barcode}` });
  };

  const [view, setView] = useState<"grid" | "list">("grid");
  const [searchTerm, setSearchTerm] = useState("");
  const [conditionFilter, setConditionFilter] = useState("all");

  const [rowOrder, setRowOrder] = useState<"asc" | "desc">("asc");
  
  // Selected shelf code (e.g. B04)
  const [selectedBay, setSelectedBay] = useState<string | null>(null);
  
  // Location and Floor tree selection (default matches mockup)
  const [selectedLocation, setSelectedLocation] = useState<string | null>("Main Building");
  const [selectedFloor, setSelectedFloor] = useState<string | null>("First Floor");
  
  // Tree state for expansion
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    "Mustapha Bacha Hospital Library": true,
    "Main Building": true,
    "Annex Building": false
  });

  const toggleNode = (node: string) => {
    setExpandedNodes(prev => ({ ...prev, [node]: !prev[node] }));
  };

  const [selectedCopy, setSelectedCopy] = useState<(Copy & { title: string }) | null>(null);
  const [listPage, setListPage] = useState(1);
  const itemsPerPage = useUiStore(s => s.preferences.pageSize) || 15;
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modals state
  const [newBookcaseOpen, setNewBookcaseOpen] = useState(false);
  const [addShelfSection, setAddShelfSection] = useState<string | null>(null);
  const [editingShelf, setEditingShelf] = useState<any | null>(null);
  const [manageLocationsOpen, setManageLocationsOpen] = useState(false);

  // Scanning session
  const [scanInitOpen, setScanInitOpen] = useState(false);
  const [targetShelf, setTargetShelf] = useState("");
  const [activeSession, setActiveSession] = useState(false);
  const [sessionPaused, setSessionPaused] = useState(false);
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [barcodeInput, setBarcodeInput] = useState("");
  const scanInputRef = useRef<HTMLInputElement>(null);

  // Browse & Assign Items Modal
  const [browseModalOpen, setBrowseModalOpen] = useState(false);
  const [targetShelfForBrowse, setTargetShelfForBrowse] = useState<string | null>(null);
  const [browseSearch, setBrowseSearch] = useState("");
  const [browseTypeFilter, setBrowseTypeFilter] = useState("all");

  const handleOpenBrowseModal = (shelfCode: string) => {
    setTargetShelfForBrowse(shelfCode);
    setBrowseSearch("");
    setBrowseTypeFilter("all");
    setBrowseModalOpen(true);
  };

  const [availableRows, setAvailableRows] = useState<string[]>(["A", "B", "C", "D", "E", "F", "G", "H"]);
  const [customRowInput, setCustomRowInput] = useState("");
  const [selectedRows, setSelectedRows] = useState<string[]>(["A", "B", "C", "D"]);
  const toggleRowSelect = (r: string) => {
    setSelectedRows(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);
  };

  // Forms
  const newBookcaseForm = useForm({
    defaultValues: { section: "Main Section", columnNumber: 1, capacity: 120, notes: "", room: "Main Building", floor: "First Floor" }
  });
  const addShelfForm = useForm({
    defaultValues: { code: "", capacity: 120, notes: "", room: "Main Building", floor: "First Floor" }
  });
  const editShelfForm = useForm({
    defaultValues: { code: "", section: "", capacity: 120, notes: "", room: "Main Building", floor: "First Floor" }
  });

  // Queries
  const result = useQuery({ queryKey: ["copies", "inventory"], queryFn: () => copies() });
  const allCopies = result.data ?? [];

  const shelvesQuery = useQuery({ queryKey: ["shelves", "inventory"], queryFn: () => getShelves() });
  const allShelves = shelvesQuery.data ?? [];

  // Focus scan input
  useEffect(() => {
    if (activeSession && !sessionPaused && scanInputRef.current) {
      scanInputRef.current.focus();
    }
  }, [activeSession, sessionPaused]);

  // Locations tree configuration — derived dynamically from shelves data
  const locationTree = useMemo(() => {
    const tree: Record<string, string[]> = {};
    for (const s of allShelves) {
      const room = (s.room || "Main Building").trim();
      const floor = (s.floor || "").trim();
      if (!tree[room]) tree[room] = [];
      if (floor && !tree[room].includes(floor)) {
        tree[room].push(floor);
      }
    }
    // Sort floors within each room
    for (const room of Object.keys(tree)) {
      tree[room].sort();
    }
    return tree;
  }, [allShelves]);

  // Compile copies in real-time for parsed shelves
  const parsedShelves = useMemo(() => {
    return allShelves.map((s: any) => {
      const code = s.code || "";
      const m = code.match(/^([A-Za-z]+)[-_]?(\d+)$/);
      const row = m ? m[1].toUpperCase() : "A";
      const col = m ? parseInt(m[2], 10) : 1;
      
      // Match copies where shelf code equals the shelf code
      const copiesList = allCopies.filter(c => c.shelf?.toUpperCase() === code.toUpperCase());
      
      return {
        ...s,
        rowLetter: row,
        colNumber: col,
        copiesList
      };
    });
  }, [allShelves, allCopies]);

  const targetBrowseShelfDetails = useMemo(() => {
    if (!targetShelfForBrowse) return null;
    return parsedShelves.find(s => s.code.toUpperCase() === targetShelfForBrowse.toUpperCase()) || null;
  }, [parsedShelves, targetShelfForBrowse]);

  const filteredBrowseCopies = useMemo(() => {
    if (!targetShelfForBrowse) return [];
    const q = browseSearch.trim().toLowerCase();
    
    return allCopies.filter(c => {
      if (browseTypeFilter !== "all") {
        const copyType = (c.item_type || "book").toLowerCase();
        if (copyType !== browseTypeFilter) return false;
      }
      if (q) {
        const titleMatch = c.title?.toLowerCase().includes(q);
        const barcodeMatch = c.barcode?.toLowerCase().includes(q);
        const accessionMatch = c.accession_number?.toLowerCase().includes(q);
        if (!titleMatch && !barcodeMatch && !accessionMatch) return false;
      }
      return true;
    });
  }, [allCopies, targetShelfForBrowse, browseSearch, browseTypeFilter]);

  // Filtered shelves based on the selected location/floor
  const filteredShelves = useMemo(() => {
    return parsedShelves.filter((s: any) => {
      // Default to "Main Building" and "First Floor" if shelf properties are blank
      const r = s.room || "Main Building";
      const f = s.floor || "First Floor";
      
      if (selectedLocation && r !== selectedLocation) return false;
      if (selectedFloor && f !== selectedFloor) return false;
      return true;
    });
  }, [parsedShelves, selectedLocation, selectedFloor]);

  // Grid coordinates mapping (R, C)
  const gridData = useMemo(() => {
    const rowsMap = new Map<string, Record<number, any>>();
    const colsSet = new Set<number>();
    
    for (const s of filteredShelves) {
      if (!rowsMap.has(s.rowLetter)) {
        rowsMap.set(s.rowLetter, {});
      }
      rowsMap.get(s.rowLetter)![s.colNumber] = s;
      colsSet.add(s.colNumber);
    }
    
    const sortedRowLetters = Array.from(rowsMap.keys()).sort((a, b) => a.localeCompare(b));
    if (rowOrder === "desc") {
      sortedRowLetters.reverse();
    }
    
    // Only show columns that are actually defined in the shelves
    const columnsList = Array.from(colsSet).sort((a, b) => a - b);
    
    return {
      rowLetters: sortedRowLetters.length > 0 ? sortedRowLetters : (rowOrder === "desc" ? ["D", "C", "B", "A"] : ["A", "B", "C", "D"]),
      columns: columnsList,
      rowsMap
    };
  }, [filteredShelves, rowOrder]);

  // Metrics
  const counts = useMemo(() => {
    const total = allCopies.length;
    const shelved = allCopies.filter(c => c.shelf).length;
    const needsRepair = allCopies.filter(c => c.condition === "damaged" || c.condition === "worn").length;
    const missing = allCopies.filter(c => c.status === "lost" || c.status === "repair").length;
    return { total, shelved, needsRepair, missing };
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

  // Mutations
  const createBookcaseMutation = useMutation({
    mutationFn: async (values: { section: string; columnNumber: number; capacity: number; notes?: string; room: string; floor: string }) => {
      if (selectedRows.length === 0) {
        throw new Error("Please select at least one row for the bookcase.");
      }
      const colStr = String(values.columnNumber).padStart(2, '0');
      for (const row of selectedRows) {
        const code = `${row.toUpperCase()}${colStr}`;
        await createShelf(values.section, code, values.capacity, values.notes, values.room, values.floor);
      }
    },
    onSuccess: () => {
      toast.success("New bookcase column created successfully.");
      setNewBookcaseOpen(false);
      newBookcaseForm.reset();
      invalidate();
      shelvesQuery.refetch();
    },
    onError: (err: any) => toast.error(err.message)
  });

  const createShelfMutation = useMutation({
    mutationFn: async (values: { section: string; code: string; capacity: number; notes?: string; room: string; floor: string }) => {
      await createShelf(values.section, values.code, values.capacity, values.notes, values.room, values.floor);
    },
    onSuccess: () => {
      toast.success("Shelf added successfully.");
      setAddShelfSection(null);
      addShelfForm.reset();
      invalidate();
      shelvesQuery.refetch();
    },
    onError: (err: any) => toast.error(err.message)
  });

  const updateShelfMutation = useMutation({
    mutationFn: async (values: { id: string; code: string; section: string; capacity: number; notes?: string | null; room: string; floor: string }) => {
      await updateShelf(values.id, { code: values.code, section: values.section, capacity: values.capacity, notes: values.notes, room: values.room, floor: values.floor });
    },
    onSuccess: () => {
      toast.success("Shelf updated.");
      setEditingShelf(null);
      invalidate();
      shelvesQuery.refetch();
    },
    onError: (err: any) => toast.error(err.message)
  });

  const deleteShelfMutation = useMutation({
    mutationFn: (shelfId: string) => deleteShelf(shelfId),
    onSuccess: () => {
      toast.success("Shelf deleted.");
      setSelectedBay(null);
      invalidate();
      shelvesQuery.refetch();
    },
    onError: (err: any) => toast.error(err.message)
  });

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
    const matched = allCopies.find(c => 
      c.barcode.toUpperCase() === barcode || 
      c.accession_number.toUpperCase() === barcode
    );
    if (matched) {
      const isCorrect = (matched.shelf?.trim().toUpperCase() ?? "") === targetShelf;
      setScannedItems(prev => [{ 
        barcode, 
        title: matched.title, 
        item_type: matched.item_type || "book",
        currentShelf: matched.shelf ?? "Unassigned", 
        result: isCorrect ? "found" : "misplaced", 
        copyId: matched.id 
      }, ...prev]);
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
      for (const item of misplaced) await updateCopy(item.copyId!, { shelf: targetShelf });
    },
    onSuccess: () => {
      toast.success("Shelf scan complete. Item positions updated.");
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
    ? Math.round((scannedItems.length / Math.max(allCopies.filter(c => c.shelf?.toUpperCase() === targetShelf).length ?? 1, 1)) * 100)
    : 0;

  // Find selected shelf details
  const selectedShelfDetails = useMemo(() => {
    if (!selectedBay) return null;
    return parsedShelves.find(s => s.code.toUpperCase() === selectedBay.toUpperCase()) || null;
  }, [selectedBay, parsedShelves]);

  const handleOpenEditShelf = (sh: any) => {
    editShelfForm.reset({
      code: sh.code,
      section: sh.section || "Main Room",
      capacity: sh.capacity || 120,
      notes: sh.notes || "",
      room: sh.room || "Main Building",
      floor: sh.floor || "First Floor"
    });
    setEditingShelf(sh);
  };

  const handleOpenNewBookcase = () => {
    const nextColNum = gridData.columns.length > 0 ? Math.max(...gridData.columns) + 1 : 1;
    newBookcaseForm.reset({
      section: "Main Section",
      columnNumber: nextColNum,
      capacity: 120,
      notes: "",
      room: selectedLocation || "Main Building",
      floor: selectedFloor || "First Floor"
    });
    setSelectedRows(["A", "B", "C", "D"]);
    setAvailableRows(["A", "B", "C", "D", "E", "F", "G", "H"]);
    setCustomRowInput("");
    setNewBookcaseOpen(true);
  };

  // Summary floor details calculation

  const totalFloorShelves = filteredShelves.length;
  const totalFloorCapacity = filteredShelves.reduce((sum, s) => sum + s.capacity, 0);

  return (
    <div className="flex flex-col gap-0 w-full text-[#122222] dark:text-white">


      {/* ── Header ── */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="font-display text-[26px] font-bold leading-tight">Inventory & shelves</h1>
          <p className="text-[13px] text-[#122222]/60 dark:text-white/60 mt-0.5">Review copy condition and status before running a shelf-scanning session.</p>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="text-[11px] text-[#122222]/40 dark:text-white/40 font-semibold">Last updated: Today, 09:42</span>
          <button
            onClick={() => { result.refetch(); shelvesQuery.refetch(); }}
            className="w-8 h-8 flex items-center justify-center bg-white dark:bg-[#1d2926] border border-black/8 dark:border-white/8 text-[#122222]/70 dark:text-white/70 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <RefreshCw size={13} className={result.isFetching || shelvesQuery.isFetching ? "animate-spin" : ""} />
          </button>
          <button
            onClick={handleOpenNewBookcase}
            className="flex items-center gap-1 bg-emerald text-white px-4 py-2 rounded-lg font-bold text-[12px] hover:bg-emerald/90 transition-all shadow-sm cursor-pointer"
          >
            <PlusCircle size={14} /> New Bookcase
          </button>
        </div>
      </div>

      {/* ── Mockup Metrics cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total copies", val: counts.total.toLocaleString(), sub: "+120 this month", color: "emerald", border: "border-emerald/15" },
          { label: "Shelved", val: `${counts.shelved.toLocaleString()} (${counts.total > 0 ? Math.round(counts.shelved / counts.total * 100) : 0}%)`, sub: "+98 this month", color: "emerald", border: "border-emerald/15" },
          { label: "Needs repair", val: counts.needsRepair.toLocaleString(), sub: "+2 this month", color: "orange", border: "border-orange-500/15" },
          { label: "Missing", val: counts.missing.toLocaleString(), sub: "-1 this month", color: "red", border: "border-red-500/15" }
        ].map(m => {
          const colorClass = m.color === "emerald" ? "text-emerald" : m.color === "orange" ? "text-orange-500" : "text-red-500";
          const bgLight = m.color === "emerald" ? "bg-emerald/5" : m.color === "orange" ? "bg-orange-500/5" : "bg-red-500/5";
          return (
            <div key={m.label} className={`bg-white dark:bg-[#1d2926] rounded-xl border ${m.border} shadow-card p-4 flex gap-4 items-center`}>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${bgLight}`}>
                <BookCopy size={18} className={colorClass} />
              </div>
              <div>
                <div className="text-[11px] font-bold text-[#122222]/40 dark:text-white/40 uppercase tracking-wider">{m.label}</div>
                <div className="text-[20px] font-bold leading-none mt-1">{m.val}</div>
                <div className={`text-[10px] font-semibold mt-1 ${colorClass}`}>{m.sub}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Main Dashboard Layout ── */}
      <div className="flex gap-5 items-start relative">

        {/* ── Sidebar Locations and Floor tree navigation ── */}
        <div className="w-64 shrink-0 space-y-4">
          <div className="bg-white dark:bg-[#1d2926] rounded-xl border border-black/5 dark:border-white/5 shadow-card p-4">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-black/5 dark:border-white/5">
              <Library size={14} className="text-emerald" />
              <span className="font-bold text-[11px] uppercase tracking-wider text-[#122222]/70 dark:text-white/70 flex-1">Locations & floors</span>
              <button
                onClick={() => setManageLocationsOpen(true)}
                title="Manage buildings & floors"
                className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-[#122222]/40 dark:text-white/40 hover:text-emerald transition-colors cursor-pointer"
              >
                <Pencil size={11} />
              </button>
            </div>
            
            <div className="text-[12px] font-medium space-y-1">
              <button
                onClick={() => { setSelectedLocation(null); setSelectedFloor(null); }}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${selectedLocation === null ? "bg-emerald/10 text-emerald font-bold" : "text-[#122222]/70 dark:text-white/70 hover:bg-black/5"}`}
              >
                All locations
              </button>
              
              {/* Nested interactive location tree — dynamic from shelves */}
              {Object.entries(locationTree).map(([room, floors]) => (
                <div key={room} className="pl-1">
                  {floors.length > 0 ? (
                    <>
                      <div
                        onClick={() => toggleNode(room)}
                        className="flex items-center gap-1.5 py-1 text-[#122222]/75 dark:text-white/75 hover:text-emerald cursor-pointer select-none"
                      >
                        {expandedNodes[room] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        <Building2 size={12} className="text-[#b96f3e] shrink-0" />
                        <span className={`font-semibold ${selectedLocation === room && !selectedFloor ? "text-emerald font-bold" : ""}`}>{room}</span>
                      </div>
                      {expandedNodes[room] && (
                        <div className="pl-3 space-y-0.5 border-l border-black/5 dark:border-white/5 mt-0.5">
                          <button
                            onClick={() => { setSelectedLocation(room); setSelectedFloor(null); }}
                            className={`w-full text-left px-2 py-1.5 rounded transition-colors cursor-pointer text-[11px] flex items-center gap-1.5 ${
                              selectedLocation === room && !selectedFloor
                                ? "bg-emerald/10 text-emerald font-bold"
                                : "text-[#122222]/60 dark:text-white/60 hover:bg-black/5"
                            }`}
                          >
                            <Building2 size={11} className={selectedLocation === room && !selectedFloor ? "text-emerald" : "text-[#122222]/30 dark:text-white/30"} />
                            <span>All floors</span>
                          </button>
                          {floors.map(floor => (
                            <button
                              key={floor}
                              onClick={() => { setSelectedLocation(room); setSelectedFloor(floor); }}
                              className={`w-full text-left px-2 py-1.5 rounded transition-colors cursor-pointer text-[11px] flex items-center gap-1.5 ${
                                selectedLocation === room && selectedFloor === floor
                                  ? "bg-[#b96f3e]/10 text-[#b96f3e] font-bold"
                                  : "text-[#122222]/60 dark:text-white/60 hover:bg-black/5"
                              }`}
                            >
                              <ShelfRowIcon size={11} className={selectedLocation === room && selectedFloor === floor ? "text-[#b96f3e]" : "text-[#122222]/40 dark:text-white/40"} />
                              <span>{floor}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <button
                      onClick={() => { setSelectedLocation(room); setSelectedFloor(null); }}
                      className={`w-full text-left px-2 py-1.5 rounded transition-colors text-[11px] flex items-center gap-1.5 cursor-pointer ${
                        selectedLocation === room
                          ? "bg-emerald/10 text-emerald font-bold"
                          : "text-[#122222]/60 dark:text-white/60 hover:bg-black/5"
                      }`}
                    >
                      <Building2 size={12} className={selectedLocation === room ? "text-emerald" : "text-[#122222]/40 dark:text-white/40"} />
                      <span>{room}</span>
                    </button>
                  )}
                </div>
              ))}

              {Object.keys(locationTree).length === 0 && (
                <p className="text-[11px] text-[#122222]/40 dark:text-white/40 italic px-2 py-1">
                  No locations yet. Add shelves to populate.
                </p>
              )}
            </div>
          </div>

          {/* Floor details */}
          <div className="bg-white dark:bg-[#1d2926] rounded-xl border border-black/5 dark:border-white/5 shadow-card p-4">
            <div className="flex items-center gap-2 mb-3 pb-1.5 border-b border-black/5">
              <Info size={14} className="text-[#b96f3e]" />
              <span className="font-bold text-[11px] uppercase tracking-wider text-[#122222]/70 dark:text-white/70">Floor details</span>
            </div>
            <div className="text-[12px] space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="text-[#122222]/55">Location</span>
                <span className="font-bold">{selectedLocation || "All locations"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#122222]/55">Floor</span>
                <span className="font-bold">{selectedFloor || "All Floors"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#122222]/55">Total shelves</span>
                <span className="font-bold text-[#b96f3e]">{totalFloorShelves}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#122222]/55">Total capacity</span>
                <span className="font-bold">{totalFloorCapacity.toLocaleString()} copies</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Center: Visual grid mapping ── */}
        <div className="flex-1 min-w-0">
          
          {/* Top toolbar */}
          <div className="flex items-center gap-2 mb-4 bg-white dark:bg-[#1d2926] p-2 rounded-xl border border-black/5 shadow-sm">
            <div className="flex-1 relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#122222]/40" />
              <input
                type="text"
                placeholder="Search shelf (e.g., B04)..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-[#fcfcfc] dark:bg-[#111d1a] border border-black/8 rounded-lg py-2 pl-9 pr-3 text-[12px] outline-none focus:border-emerald transition-all"
              />
            </div>
            <select
              value={conditionFilter}
              onChange={e => setConditionFilter(e.target.value)}
              className="bg-[#fcfcfc] dark:bg-[#111d1a] border border-black/8 rounded-lg py-2 px-3 text-[12px] outline-none cursor-pointer"
            >
              <option value="all">All conditions</option>
              <option value="mint">Mint</option>
              <option value="good">Good</option>
              <option value="fair">Fair</option>
              <option value="worn">Worn</option>
              <option value="damaged">Damaged</option>
            </select>
            
            <div className="flex rounded-lg border border-black/8 overflow-hidden">
              <button onClick={() => setView("grid")} className={`px-3 py-2 cursor-pointer transition-colors ${view === "grid" ? "bg-emerald text-white" : "bg-[#fcfcfc] dark:bg-[#111d1a] text-[#122222]/60"}`}>
                <LayoutGrid size={13} />
              </button>
              <button onClick={() => setView("list")} className={`px-3 py-2 cursor-pointer transition-colors ${view === "list" ? "bg-emerald text-white" : "bg-[#fcfcfc] dark:bg-[#111d1a] text-[#122222]/60"}`}>
                <List size={13} />
              </button>
            </div>
            
            {view === "grid" && (
              <button
                onClick={() => setRowOrder(prev => prev === "asc" ? "desc" : "asc")}
                className="bg-[#fcfcfc] dark:bg-[#111d1a] border border-black/8 rounded-lg py-2 px-3 text-[12px] outline-none cursor-pointer hover:bg-black/5 flex items-center gap-1.5 font-bold text-[#122222]/70 dark:text-white/70"
                title={rowOrder === "asc" ? "Top → Bottom: Row A is the top row" : "Bottom → Top: Row A is the bottom row"}
              >
                <span>Rows:</span>
                <span className="text-[#b96f3e]">{rowOrder === "asc" ? "Top → Bottom (A is Top Row)" : "Bottom → Top (A is Bottom Row)"}</span>
              </button>
            )}
            
            {/* Mockup Status Dots Legend */}
            <div className="hidden lg:flex items-center gap-3 text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 pl-2">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#478574]"/>Good</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#dd7a4a]"/>Repair</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#dd4a4a]"/>Missing</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#e5e7eb] dark:bg-[#2d3b37]"/>Not scanned</span>
            </div>
          </div>

          {/* ── Visual Grid mapping: rows A-D, columns 1-8 ── */}
          {view === "grid" && (
            <div className="bg-white dark:bg-[#1d2926] rounded-xl border border-black/5 dark:border-white/5 shadow-card p-5 overflow-auto">
              {gridData.columns.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center text-[#122222]/40 dark:text-white/40">
                  <Library size={36} className="text-[#b96f3e] mb-3" />
                  <h3 className="text-sm font-bold">No Bookshelf Columns Created</h3>
                  <p className="text-[11px] max-w-sm mt-1 mb-4 leading-normal">
                    This floor has no bookshelf columns mapped yet. Click below to add a vertical bookcase column (e.g. Column 01 with shelves A01, B01, C01, D01).
                  </p>
                  <button
                    type="button"
                    onClick={handleOpenNewBookcase}
                    className="bg-emerald text-white px-4 py-2 rounded-lg font-bold text-[12px] hover:bg-emerald/90 transition-all shadow-sm cursor-pointer"
                  >
                    + Add Bookshelf Column
                  </button>
                </div>
              ) : (
                <>
              
              {/* Header column numbers */}
              <div className="grid items-center mb-2 text-center text-[11px] font-bold text-[#122222]/40" style={{ gridTemplateColumns: `22px repeat(${gridData.columns.length}, 90px) 28px` }}>
                <div />
                {gridData.columns.map(col => (
                  <div key={col} className="uppercase tracking-wider">
                    {String(col).padStart(2, "0")}
                  </div>
                ))}
                {/* Add column button in header */}
                <button
                  onClick={handleOpenNewBookcase}
                  title="Add new column"
                  className="flex items-center justify-center w-7 h-7 rounded-lg border border-dashed border-emerald/40 text-emerald/60 hover:text-emerald hover:border-emerald hover:bg-emerald/5 transition-all cursor-pointer text-[14px] font-bold"
                >
                  +
                </button>
              </div>

              {/* Grid rows mapping */}
              <div className="space-y-2">
                {gridData.rowLetters.map(row => (
                  <div key={row} className="grid items-start" style={{ gridTemplateColumns: `22px repeat(${gridData.columns.length}, 90px) 28px` }}>
                    
                    {/* Row header label */}
                    <div className="font-display font-bold text-[13px] text-center text-[#122222]/40 dark:text-white/40 self-center">
                      {row}
                    </div>
                    
                    {/* Grid columns cells */}
                    {gridData.columns.map(col => {
                      const shelf = gridData.rowsMap.get(row)?.[col];
                      const isSelected = selectedBay === `${row}${String(col).padStart(2, "0")}` || (shelf && selectedBay === shelf.code);
                      const isScanning = activeSession && targetShelf === (shelf?.code ?? `${row}${String(col).padStart(2, "0")}`);
                      
                      if (shelf) {
                        const occupancy = shelf.capacity > 0 ? shelf.copiesList.length / shelf.capacity : 0;
                        return (
                          <div key={col} className="px-0.5">
                            <div
                              onClick={() => setSelectedBay(isSelected ? null : shelf.code)}
                              className={`relative bg-white dark:bg-[#1d2926] border rounded-lg pt-1.5 px-1.5 pb-1.5 text-center flex flex-col items-center justify-between transition-all cursor-pointer hover:shadow-md hover:scale-[1.02] ${
                                isSelected
                                  ? "ring-2 ring-[#b96f3e] border-[#b96f3e]/30 scale-[1.03] shadow-md"
                                  : "border-black/8 dark:border-white/8"
                              } ${isScanning ? "animate-pulse ring-2 ring-emerald" : ""}`}
                            >
                              {/* Selected Ribbon Bookmark */}
                              {isSelected && (
                                <div className="absolute -top-0.5 right-2 w-3 h-4 bg-[#b96f3e] rounded-b-sm shadow z-10 flex flex-col justify-end pb-0.5 items-center">
                                  <div className="w-1 h-1 rounded-full bg-white/50" />
                                </div>
                              )}
                              
                              {/* SVG Book Spines */}
                              <div className="w-full">
                                <ShelfSvgVisual copiesList={shelf.copiesList} capacity={shelf.capacity} rowOrder={rowOrder} />
                              </div>
                              
                              {/* Shelf Code */}
                              <div className="font-bold text-[10px] mt-1 text-[#122222] dark:text-white tracking-wide">{shelf.code}</div>
                              
                              {/* Occupancy */}
                              <div className="flex items-center gap-1 mt-0.5 justify-center">
                                <div 
                                  className="w-1.5 h-1.5 rounded-full" 
                                  style={{ backgroundColor: occupancyColor(occupancy) }} 
                                />
                                <span className="text-[9px] text-[#122222]/50 dark:text-white/50 font-bold">
                                  {shelf.copiesList.length}/{shelf.capacity}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      } else {
                        // Empty slot placeholder
                        const tempCode = `${row}${String(col).padStart(2, "0")}`;
                        return (
                          <div key={col} className="px-0.5">
                            <div 
                              onClick={() => {
                                addShelfForm.reset({ code: tempCode, capacity: 120, notes: "", room: selectedLocation || "Main Building", floor: selectedFloor || "First Floor" });
                                setAddShelfSection(tempCode);
                              }}
                              className="border border-dashed border-black/10 dark:border-white/10 hover:border-emerald/50 hover:bg-emerald/5 rounded-lg flex flex-col items-center justify-center text-center transition-all cursor-pointer group"
                              style={{ minHeight: "88px" }}
                            >
                              <PlusCircle size={13} className="text-[#122222]/15 group-hover:text-emerald transition-colors" />
                              <span className="text-[9px] font-mono text-[#122222]/20 dark:text-white/20 mt-1">{tempCode}</span>
                            </div>
                          </div>
                        );
                      }
                    })}
                    {/* Spacer to align with + column button in header */}
                    <div />
                  </div>
                ))}
              </div>
              
              {/* Bottom legend descriptors */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-8 pt-5 border-t border-black/5 dark:border-white/5 text-[11px] font-semibold text-[#122222]/60 dark:text-white/60">
                <div>
                  <div className="text-emerald font-bold">Shelf bay</div>
                  <div className="text-[10px] text-[#122222]/40 mt-0.5 leading-relaxed">Each bay represents a physical shelf section.</div>
                </div>
                <div>
                  <div className="text-emerald font-bold">Capacity</div>
                  <div className="text-[10px] text-[#122222]/40 mt-0.5 leading-relaxed">Maximum number of copies the shelf can hold.</div>
                </div>
                <div>
                  <div className="text-emerald font-bold">Occupancy</div>
                  <div className="text-[10px] text-[#122222]/40 mt-0.5 leading-relaxed">Current number of copies on the shelf.</div>
                </div>
                <div>
                  <div className="text-[#b96f3e] font-bold">Status</div>
                  <div className="text-[10px] text-[#122222]/40 mt-0.5 leading-relaxed">Based on last inventory scanning audit.</div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

          {/* ── List View ── */}
          {view === "list" && (
            <div className="bg-white dark:bg-[#1d2926] rounded-xl border border-black/5 dark:border-white/5 shadow-card overflow-hidden">
              {paginatedCopies.length > 0 ? (
                <>
                  <table className="w-full text-left text-[13px]">
                    <thead className="bg-[#fcfbf8] dark:bg-[#111d1a] border-b border-black/5 text-[11px] font-bold text-[#122222]/50 uppercase tracking-wider">
                      <tr>
                        <th className="px-5 py-3 w-8">
                          <input type="checkbox"
                            checked={selectedIds.length === filteredCopies.length && filteredCopies.length > 0}
                            onChange={e => setSelectedIds(e.target.checked ? filteredCopies.map(c => c.id) : [])}
                            className="cursor-pointer"
                          />
                        </th>
                        <th className="px-5 py-3">Barcode</th>
                        <th className="px-5 py-3">Type</th>
                        <th className="px-5 py-3">Title</th>
                        <th className="px-5 py-3">Shelf</th>
                        <th className="px-5 py-3">Condition</th>
                        <th className="px-5 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5">
                      {paginatedCopies.map(copy => (
                        <tr
                          key={copy.id}
                          onClick={() => setSelectedCopy(copy)}
                          onContextMenu={(e) => handleCopyContextMenu(e, copy)}
                          className={`hover:bg-black/[0.02] dark:hover:bg-white/[0.02] cursor-pointer transition-colors ${selectedIds.includes(copy.id) ? "bg-emerald/5" : ""}`}
                        >

                          <td className="px-5 py-3" onClick={e => e.stopPropagation()}>
                            <input type="checkbox"
                              checked={selectedIds.includes(copy.id)}
                              onChange={e => setSelectedIds(e.target.checked ? [...selectedIds, copy.id] : selectedIds.filter(id => id !== copy.id))}
                              className="cursor-pointer"
                            />
                          </td>
                          <td className="px-5 py-3 font-mono font-bold text-[12px] text-[#122222] dark:text-white whitespace-nowrap">{copy.barcode}</td>
                          <td className="px-5 py-3"><ItemTypeBadge type={copy.item_type} /></td>
                          <td className="px-5 py-3 font-semibold text-[#122222]/80 dark:text-white/80"><div className="line-clamp-2" title={copy.title}>{copy.title}</div></td>
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
                              "bg-[#10b981]/10 text-[#1a4d40] dark:text-[#1b9277]"
                            }`}>{copy.condition}</span>
                          </td>
                          <td className="px-5 py-3"><StatusBadge value={copy.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="p-3 border-t border-black/5 flex items-center justify-between text-[12px] text-[#122222]/60 font-semibold bg-[#fcfbf8] dark:bg-[#111d1a]">
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
        </div>

        {/* ── Right Panel: audit session details or shelf details ── */}
        {activeSession ? (
          <div className="w-80 shrink-0">
            <div className="bg-white dark:bg-[#1d2926] rounded-xl border border-black/8 shadow-card p-5 sticky top-4 flex flex-col gap-4">
              
              <div className="flex items-center justify-between pb-2 border-b border-black/5">
                <span className="text-[11px] font-bold text-[#1a4d40] dark:text-[#1b9277] uppercase tracking-wider">Scanning in progress</span>
                <button
                  onClick={() => setSessionPaused(p => !p)}
                  className="flex items-center gap-1 text-[11px] font-bold text-[#122222]/60 hover:text-[#122222] cursor-pointer bg-black/5 px-2.5 py-1 rounded-lg"
                >
                  {sessionPaused ? <><Play size={11} /> Resume</> : <><Pause size={11} /> Pause</>}
                </button>
              </div>

              <div>
                <h3 className="font-bold text-[18px]">Shelf {targetShelf} 📌</h3>
                <p className="text-[11px] text-[#122222]/50 mt-0.5">{selectedFloor} · {selectedLocation}</p>
              </div>

              {/* Progress bar */}
              <div>
                <div className="flex justify-between items-end mb-1">
                  <span className="text-[11px] font-bold text-[#122222]/50 uppercase tracking-wider">Scanning progress</span>
                  <span className="text-[13px] font-bold text-[#1a4d40] dark:text-[#1b9277]">{Math.min(scanPct, 100)}%</span>
                </div>
                <div className="text-[18px] font-bold mb-2">
                  {scannedItems.length} <span className="text-[13px] font-semibold text-[#122222]/50">/ {allCopies.filter(c => c.shelf?.toUpperCase() === targetShelf).length ?? "?"} copies scanned</span>
                </div>
                <div className="h-2 bg-black/5 rounded-full overflow-hidden">
                  <div className="h-full bg-orange-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(scanPct, 100)}%` }} />
                </div>
                <div className="text-[10px] text-[#122222]/40 font-semibold mt-1">Estimated time remaining: 00:07:15</div>
              </div>

              {/* Scanner emulator status */}
              <div className="p-3 bg-[#122222]/[0.02] rounded-xl border border-black/5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#122222]/60">
                    <Wifi size={11} className="text-[#1a4d40]" /> Scanner input
                  </div>
                  <span className="text-[10px] font-bold text-[#10b981]">Connected ●</span>
                </div>
                <div className="text-[11px] text-[#122222]/40 font-bold mb-1.5 uppercase">Honeywell MS9590</div>
                <form onSubmit={handleBarcodeSubmit}>
                  <input
                    ref={scanInputRef}
                    type="text"
                    value={barcodeInput}
                    onChange={e => setBarcodeInput(e.target.value)}
                    disabled={sessionPaused}
                    placeholder="Scan barcode, ISSN, ISBN, or Accession..."
                    className="w-full bg-white dark:bg-[#111d1a] border border-black/10 rounded-lg py-2 px-3 text-[12px] outline-none focus:border-emerald disabled:opacity-50"
                  />
                </form>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-2 border-t border-b border-black/5 py-3">
                {[
                  { label: "On shelf", val: sessionFound, color: "#478574", sub: "Correct shelf" },
                  { label: "Wrong shelf", val: sessionMisplaced, color: "#dd7a4a", sub: "Misplaced item" },
                  { label: "Not found", val: sessionUnknown, color: "#dd4a4a", sub: "Missing record" },
                ].map(s => (
                  <div key={s.label} className="text-center">
                    <div className="text-[18px] font-bold" style={{ color: s.color }}>{s.val}</div>
                    <div className="text-[10px] font-bold text-[#122222]/70 dark:text-white/70">{s.label}</div>
                    <div className="text-[9px] text-[#122222]/40">{s.sub}</div>
                  </div>
                ))}
              </div>

              {/* Discrepancies listing */}
              {(sessionMisplaced > 0 || sessionUnknown > 0) && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-[#122222]/60 uppercase">Issues found ({sessionMisplaced + sessionUnknown})</span>
                    <button className="text-[10px] text-emerald font-bold hover:underline cursor-pointer">View all</button>
                  </div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto no-scrollbar">
                    {scannedItems.filter(i => i.result !== "found").map(item => (
                      <div key={item.barcode} className={`flex items-start justify-between p-2.5 rounded-lg text-[11px] border ${item.result === "misplaced" ? "bg-orange-50/20 border-orange-500/15" : "bg-red-50/20 border-red-500/15"}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="font-mono font-bold text-[#122222] truncate">{item.barcode}</span>
                            <ItemTypeBadge type={item.item_type} />
                          </div>
                          <div className="text-[#122222]/50 truncate">{item.title}</div>
                        </div>
                        <div className="text-right ml-2 shrink-0">
                          {item.result === "misplaced" ? (
                            <div>
                              <div className="text-orange-500 font-bold">Expected: {targetShelf}</div>
                              <div className="text-[#122222]/40">Found in: {item.currentShelf}</div>
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

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => { if (confirm("Discard scanning session?")) { setActiveSession(false); setScannedItems([]); } }}
                  className="flex-1 py-2 text-center rounded-lg border border-black/10 text-[12px] font-bold text-[#122222]/60 hover:bg-black/5 cursor-pointer transition-colors"
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
        ) : view === "grid" && selectedShelfDetails ? (
          /* Shelf detail panel */
          <div className="w-80 shrink-0">
            <div className="bg-white dark:bg-[#1d2926] rounded-xl border border-black/8 shadow-card p-5 sticky top-4 flex flex-col gap-4">
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 pr-4 min-w-0">
                  <div className="w-8 h-8 bg-[#b96f3e]/10 rounded-lg flex items-center justify-center shrink-0">
                    <MapPin size={14} className="text-[#b96f3e]" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-[15px] truncate">Shelf {selectedShelfDetails.code}</h3>
                    <p className="text-[11px] text-[#122222]/50 truncate">{selectedShelfDetails.floor} · {selectedShelfDetails.room}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedBay(null)} 
                  className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-black/5 cursor-pointer shrink-0"
                >
                  <X size={14} className="text-[#122222]/60" />
                </button>
              </div>

              {selectedShelfDetails.notes && (
                <div className="p-3 bg-black/[0.01] border border-black/5 rounded-lg text-[12px] text-[#122222]/70 italic">
                  {selectedShelfDetails.notes}
                </div>
              )}

              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[11px] font-bold text-[#122222]/40 uppercase tracking-wider">Books on shelf</span>
                  <span className="text-[12px] font-bold text-[#b96f3e]">
                    {selectedShelfDetails.copiesList.length} / {selectedShelfDetails.capacity}
                  </span>
                </div>
                <div className="h-2 bg-black/5 rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all" 
                    style={{ 
                      width: `${Math.min((selectedShelfDetails.copiesList.length / selectedShelfDetails.capacity) * 100, 100)}%`,
                      backgroundColor: occupancyColor(selectedShelfDetails.copiesList.length / selectedShelfDetails.capacity)
                    }} 
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-bold text-[#122222]/40 uppercase tracking-wider">Placed items</div>
                  <button
                    onClick={() => handleOpenBrowseModal(selectedShelfDetails.code)}
                    className="text-[11px] font-bold text-emerald hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={12} /> Add items
                  </button>
                </div>
                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1 no-scrollbar border-t border-black/5 pt-2">
                  {selectedShelfDetails.copiesList.length === 0 ? (
                    <p className="text-center py-6 text-[12px] text-[#122222]/40">No items currently placed on this shelf.</p>
                  ) : (
                    selectedShelfDetails.copiesList.map((c: any) => (
                      <div
                        key={c.id}
                        onClick={() => setSelectedCopy(c)}
                        className="flex items-center justify-between p-2 rounded-lg bg-black/[0.01] border border-black/5 hover:bg-emerald/5 cursor-pointer transition-all"
                      >
                        <div className="min-w-0 pr-2 flex-1">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="font-semibold text-[12px] truncate" title={c.title}>{c.title}</span>
                            <ItemTypeBadge type={c.item_type} />
                          </div>
                          <div className="font-mono text-[9px] text-[#122222]/40">{c.barcode}</div>
                        </div>
                        <div className="shrink-0">
                          <span className={`text-[9px] font-bold capitalize px-1.5 py-0.5 rounded-full ${c.condition === "damaged" ? "bg-red-100 text-red-700" : "bg-emerald/10 text-[#1a4d40]"}`}>{c.condition}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

                <div className="pt-2 border-t border-black/5 flex gap-2 w-full">
                  <button
                    onClick={() => {
                      if (confirm(`Are you sure you want to delete shelf ${selectedShelfDetails.code}?`)) {
                        deleteShelfMutation.mutate(selectedShelfDetails.id);
                      }
                    }}
                    className="p-2 text-red-500 hover:text-red-700 hover:bg-red-500/5 rounded-xl border border-black/10 flex items-center justify-center shrink-0 cursor-pointer"
                    title="Delete Shelf"
                  >
                    <Trash2 size={14} />
                  </button>
                  <button
                    onClick={() => handleOpenBrowseModal(selectedShelfDetails.code)}
                    className="flex-1 py-2 text-center rounded-xl bg-white border border-black/10 hover:bg-black/5 hover:text-emerald text-[12px] font-bold cursor-pointer flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Plus size={14} /> Add Books
                  </button>
                  <button
                    onClick={() => handleOpenEditShelf(selectedShelfDetails)}
                    className="flex-1 py-2 text-center rounded-xl bg-emerald hover:bg-emerald/90 text-white text-[12px] font-bold cursor-pointer"
                  >
                    Edit
                  </button>
                </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Copy edit modal */}
      {selectedCopy && (
        <CopyEditModal copy={selectedCopy} onClose={() => { setSelectedCopy(null); invalidate(); }} shelves={allShelves} />
      )}

      {/* Browse & Assign Items to Shelf Modal */}
      <Modal
        isOpen={browseModalOpen}
        onClose={() => setBrowseModalOpen(false)}
        title={`Add / Assign Items to Shelf ${targetShelfForBrowse || ""}`}
        size="xl"
      >
        <div className="space-y-4 text-[13px]">
          {/* Information & Occupancy Bar */}
          <div className="flex items-center justify-between bg-[#fcfbf8] dark:bg-[#111d1a] p-3 rounded-xl border border-black/5 dark:border-white/5">
            <div className="text-[12px] text-[#122222]/70 dark:text-white/70">
              Browse your library catalog to place items onto shelf <span className="font-bold text-emerald font-mono">{targetShelfForBrowse}</span>.
            </div>
            {targetBrowseShelfDetails && (
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-md bg-emerald/10 text-emerald dark:text-emerald-light shrink-0">
                Occupancy: {targetBrowseShelfDetails.copiesList.length} / {targetBrowseShelfDetails.capacity}
              </span>
            )}
          </div>

          {/* Filter & Search Controls */}
          <div className="flex gap-3 items-center">
            <div className="flex-1 relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#122222]/40" />
              <Input
                type="text"
                value={browseSearch}
                onChange={(e) => setBrowseSearch(e.target.value)}
                placeholder="Search items by title, author, barcode, accession number..."
                className="pl-9 text-[13px] py-2"
              />
            </div>

            <select
              value={browseTypeFilter}
              onChange={(e) => setBrowseTypeFilter(e.target.value)}
              className="bg-white dark:bg-[#1d2926] border border-black/10 dark:border-white/10 rounded-lg py-2 px-3 text-[13px] font-semibold text-[#122222] dark:text-white outline-none focus:border-emerald cursor-pointer"
            >
              <option value="all">All Types</option>
              <option value="book">Book</option>
              <option value="magazine">Magazine</option>
              <option value="notebook">Notebook</option>
              <option value="journal">Journal</option>
              <option value="newspaper">Newspaper</option>
              <option value="disc">Disc / Media</option>
              <option value="other">Other / Misc</option>
            </select>
          </div>

          {/* Item Catalog List */}
          <div className="max-h-[460px] overflow-y-auto pr-1 space-y-2.5 no-scrollbar">
            {filteredBrowseCopies.length === 0 ? (
              <div className="text-center py-12 text-[#122222]/40 dark:text-white/40">
                <BookCopy size={36} className="mx-auto mb-2 opacity-30" />
                <p className="font-bold text-[14px]">No matching items found</p>
                <p className="text-[12px] mt-0.5">Try adjusting your search or item type filter.</p>
              </div>
            ) : (
              filteredBrowseCopies.map((c) => {
                const isCurrentShelf = (c.shelf?.trim().toUpperCase() ?? "") === (targetShelfForBrowse?.trim().toUpperCase() ?? "");
                const isOtherShelf = c.shelf && !isCurrentShelf;

                return (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-black/5 dark:border-white/5 bg-white dark:bg-[#1d2926] hover:border-emerald/30 transition-all shadow-sm gap-4"
                  >
                    {/* Cover Thumbnail */}
                    <div className="w-12 h-16 rounded-lg bg-[#f4ebdd] dark:bg-[#1a2522] border border-black/10 flex items-center justify-center shrink-0 overflow-hidden relative shadow-sm">
                      <div className="absolute left-1 top-0 bottom-0 w-0.5 bg-black/10" />
                      {c.cover_path ? (
                        <img src={c.cover_path} alt={c.title} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[10px] font-bold text-[#122222]/40 dark:text-white/40 uppercase tracking-tighter">
                          {(c.item_type || "BOK").slice(0, 3)}
                        </span>
                      )}
                    </div>

                    {/* Content Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h4 className="font-bold text-[14px] text-[#122222] dark:text-white truncate" title={c.title}>
                          {c.title}
                        </h4>
                        <ItemTypeBadge type={c.item_type} />
                      </div>
                      {c.author && (
                        <p className="text-[12px] text-[#122222]/60 dark:text-white/60 truncate mb-1">
                          {c.author}
                        </p>
                      )}
                      <div className="flex items-center gap-2.5 text-[11px] text-[#122222]/50 dark:text-white/50 font-mono">
                        <span>Barcode: <strong className="text-[#122222]/80 dark:text-white/80">{c.barcode}</strong></span>
                        <span>·</span>
                        <span>Accession: <strong className="text-[#122222]/80 dark:text-white/80">{c.accession_number}</strong></span>
                      </div>
                    </div>

                    {/* Shelf Status & Action Button */}
                    <div className="flex items-center gap-3 shrink-0">
                      {isCurrentShelf ? (
                        <span className="text-[11px] font-bold text-emerald bg-emerald/10 dark:bg-emerald-light/20 text-emerald dark:text-emerald-light px-2.5 py-1 rounded-md">
                          Placed on this shelf
                        </span>
                      ) : isOtherShelf ? (
                        <span className="text-[11px] font-semibold text-orange-600 dark:text-orange-400 bg-orange-500/10 px-2.5 py-1 rounded-md">
                          Shelf {c.shelf}
                        </span>
                      ) : (
                        <span className="text-[11px] text-[#122222]/40 dark:text-white/40 bg-black/5 dark:bg-white/5 px-2.5 py-1 rounded-md font-semibold">
                          Unassigned
                        </span>
                      )}

                      {isCurrentShelf ? (
                        <Button
                          variant="ghost"
                          className="text-[12px] text-red-500 hover:bg-red-500/10 py-1.5 px-3"
                          onClick={async () => {
                            await updateCopy(c.id, { shelf: null });
                            toast.success(`Removed "${c.title}" from shelf ${targetShelfForBrowse}`);
                            invalidate();
                            shelvesQuery.refetch();
                          }}
                        >
                          Remove
                        </Button>
                      ) : (
                        <Button
                          variant="primary"
                          className="text-[12px] py-1.5 px-3"
                          onClick={async () => {
                            await updateCopy(c.id, { shelf: targetShelfForBrowse });
                            toast.success(`Assigned "${c.title}" to shelf ${targetShelfForBrowse}`);
                            invalidate();
                            shelvesQuery.refetch();
                          }}
                        >
                          <Plus size={13} /> Add to Shelf
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="flex justify-end pt-3 border-t border-black/5 dark:border-white/5">
            <Button variant="secondary" onClick={() => setBrowseModalOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      </Modal>

      {/* New Bookcase modal */}
      {newBookcaseOpen && (
        <Modal isOpen={newBookcaseOpen} onClose={() => setNewBookcaseOpen(false)} title="Create New Bookshelf Column">
          <form onSubmit={newBookcaseForm.handleSubmit(v => createBookcaseMutation.mutate(v))} className="space-y-4 text-[13px]">
            <p className="text-[12px] text-[#122222]/60">Build a bookshelf unit (vertical column of shelves) at a specific column position on this floor.</p>
            
            <div className="grid grid-cols-2 gap-4">
              <label className="text-[11px] font-semibold text-[#122222]/60 block">
                Bookcase Unit / Section Name
                <Input {...newBookcaseForm.register("section")} placeholder="e.g. Unit A, Main Row" required className="mt-1" />
              </label>
              <label className="text-[11px] font-semibold text-[#122222]/60 block">
                Column Number (Bookshelf Column)
                <Input type="number" {...newBookcaseForm.register("columnNumber", { valueAsNumber: true })} min={1} required className="mt-1" />
              </label>
            </div>

            <div>
              <label className="text-[11px] font-bold text-[#122222]/60 uppercase block mb-2">Include Shelf Rows</label>
              <div className="flex flex-wrap gap-2 items-center mb-3">
                {availableRows.map(row => {
                  const checked = selectedRows.includes(row);
                  return (
                    <button
                      key={row}
                      type="button"
                      onClick={() => toggleRowSelect(row)}
                      className={`w-9 h-9 rounded-lg border font-bold text-xs transition-all cursor-pointer ${
                        checked 
                          ? "bg-emerald text-white border-emerald" 
                          : "bg-white dark:bg-[#1d2926] text-[#122222]/50 border-black/10 hover:border-[#b96f3e]"
                      }`}
                    >
                      {row}
                    </button>
                  );
                })}
              </div>
              
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="text"
                  placeholder="e.g. K, Z"
                  value={customRowInput}
                  onChange={e => setCustomRowInput(e.target.value)}
                  className="bg-white dark:bg-[#111d1a] border border-black/10 rounded-lg py-1.5 px-2.5 text-[11px] outline-none focus:border-emerald uppercase w-20 text-center font-bold"
                  maxLength={2}
                />
                <button
                  type="button"
                  onClick={() => {
                    const letter = customRowInput.trim().toUpperCase();
                    if (letter && /^[A-Z]{1,2}$/.test(letter) && !availableRows.includes(letter)) {
                      setAvailableRows(prev => [...prev, letter].sort((a, b) => a.localeCompare(b)));
                      setSelectedRows(prev => [...prev, letter]);
                      setCustomRowInput("");
                    }
                  }}
                  className="bg-[#122222]/[0.05] hover:bg-[#122222]/[0.08] dark:bg-white/[0.05] dark:hover:bg-white/[0.08] text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                >
                  Add Row Letter
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className="text-[11px] font-semibold text-[#122222]/60 block">
                Building Room Location
                <Input {...newBookcaseForm.register("room")} required className="mt-1" />
              </label>
              <label className="text-[11px] font-semibold text-[#122222]/60 block">
                Floor Location
                <Input {...newBookcaseForm.register("floor")} required className="mt-1" />
              </label>
            </div>

            <label className="text-[11px] font-semibold text-[#122222]/60 block">
              Default Shelf Capacity
              <Input type="number" {...newBookcaseForm.register("capacity", { valueAsNumber: true })} min={1} required className="mt-1" />
            </label>
            <label className="text-[11px] font-semibold text-[#122222]/60 block">
              Notes (Optional)
              <Input {...newBookcaseForm.register("notes")} placeholder="e.g. Science fiction shelf section" className="mt-1" />
            </label>
            <div className="flex gap-2 justify-end pt-4 border-t border-black/5">
              <Button type="button" variant="ghost" onClick={() => setNewBookcaseOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createBookcaseMutation.isPending}>
                {createBookcaseMutation.isPending ? "Generating..." : "Create Bookshelf"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Add single shelf modal */}
      {addShelfSection && (
        <Modal isOpen={!!addShelfSection} onClose={() => setAddShelfSection(null)} title={`Add Shelf at Coordinate: ${addShelfSection}`}>
          <form onSubmit={addShelfForm.handleSubmit(v => createShelfMutation.mutate({ ...v, section: "Main Room" }))} className="space-y-4 text-[13px]">
            <label className="text-[11px] font-semibold text-[#122222]/60 block">
              Shelf Location Code
              <Input {...addShelfForm.register("code")} placeholder="e.g. A-06" required className="mt-1" />
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="text-[11px] font-semibold text-[#122222]/60 block">
                Building Room Location
                <Input {...addShelfForm.register("room")} placeholder="e.g. Main Building" required className="mt-1" />
              </label>
              <label className="text-[11px] font-semibold text-[#122222]/60 block">
                Floor Location
                <Input {...addShelfForm.register("floor")} placeholder="e.g. First Floor" required className="mt-1" />
              </label>
            </div>
            <label className="text-[11px] font-semibold text-[#122222]/60 block">
              Shelf Capacity
              <Input type="number" {...addShelfForm.register("capacity", { valueAsNumber: true })} min={1} required className="mt-1" />
            </label>
            <label className="text-[11px] font-semibold text-[#122222]/60 block">
              Notes (Optional)
              <Input {...addShelfForm.register("notes")} placeholder="e.g. Reserved for oversized publications" className="mt-1" />
            </label>
            <div className="flex gap-2 justify-end pt-4 border-t border-black/5">
              <Button type="button" variant="ghost" onClick={() => setAddShelfSection(null)}>Cancel</Button>
              <Button type="submit" disabled={createShelfMutation.isPending}>Add Shelf</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit shelf modal */}
      {editingShelf && (
        <Modal isOpen={!!editingShelf} onClose={() => setEditingShelf(null)} title={`Edit Shelf: ${editingShelf.code}`}>
          <form onSubmit={editShelfForm.handleSubmit(v => updateShelfMutation.mutate({ ...v, id: editingShelf.id }))} className="space-y-4 text-[13px]">
            <label className="text-[11px] font-semibold text-[#122222]/60 block">
              Shelf Location Code
              <Input {...editShelfForm.register("code")} required className="mt-1" />
            </label>
            <label className="text-[11px] font-semibold text-[#122222]/60 block">
              Bookcase Unit / Section
              <Input {...editShelfForm.register("section")} required className="mt-1" />
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="text-[11px] font-semibold text-[#122222]/60 block">
                Building Room Location
                <Input {...editShelfForm.register("room")} required className="mt-1" />
              </label>
              <label className="text-[11px] font-semibold text-[#122222]/60 block">
                Floor Location
                <Input {...editShelfForm.register("floor")} required className="mt-1" />
              </label>
            </div>
            <label className="text-[11px] font-semibold text-[#122222]/60 block">
              Shelf Capacity
              <Input type="number" {...editShelfForm.register("capacity", { valueAsNumber: true })} min={1} required className="mt-1" />
            </label>
            <label className="text-[11px] font-semibold text-[#122222]/60 block">
              Notes (Optional)
              <Input {...editShelfForm.register("notes")} className="mt-1" />
            </label>
            <div className="flex gap-2 justify-end pt-4 border-t border-black/5">
              <Button type="button" variant="ghost" onClick={() => setEditingShelf(null)}>Cancel</Button>
              <Button type="submit" disabled={updateShelfMutation.isPending}>Save Changes</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Audit scan session setup modal */}
      {scanInitOpen && (
        <Modal isOpen={scanInitOpen} onClose={() => setScanInitOpen(false)} title="Scan Shelf Barcodes">
          <form onSubmit={startScanningSession} className="space-y-4">
            <p className="text-[13px] text-[#122222]/70 font-semibold">Enter or select a shelf code to scan. Scanned barcodes will highlight whether they are misplaced or correctly positioned on this shelf.</p>
            <div>
              <label className="text-[11px] font-bold text-[#122222]/60 uppercase block mb-1.5">Target Shelf Code</label>
              <Input
                type="text"
                placeholder="e.g. A-01, FIC-05"
                value={targetShelf}
                onChange={e => setTargetShelf(e.target.value)}
                required
              />
            </div>
            {allShelves.length > 0 && (
              <div>
                <p className="text-[11px] font-bold text-[#122222]/50 uppercase mb-2">Or click to select an active shelf:</p>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                  {allShelves.map((b: any) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setTargetShelf(b.code)}
                      className={`px-3 py-1.5 rounded-lg text-[12px] font-bold border border-solid cursor-pointer transition-all ${targetShelf.toUpperCase() === b.code.toUpperCase() ? "border-emerald bg-emerald/10 text-emerald" : "border-transparent bg-[#122222]/[0.03] dark:bg-white/[0.03] text-[#122222]/70 dark:text-white/70 hover:bg-[#122222]/[0.06]"}`}
                    >
                      {b.code}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2 justify-end pt-4 border-t border-black/5">
              <Button type="button" variant="ghost" onClick={() => setScanInitOpen(false)}>Cancel</Button>
              <Button type="submit">Begin Session</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Manage Locations Modal */}
      {manageLocationsOpen && (
        <ManageLocationsModal
          onClose={() => setManageLocationsOpen(false)}
          onRefresh={() => shelvesQuery.refetch()}
          locationTree={locationTree}
        />
      )}

      {/* Bulk select bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/95 dark:bg-[#1d2926]/95 backdrop-blur-md px-6 py-3 rounded-full border border-black/10 shadow-lg flex items-center gap-5 z-50">
          <span className="text-[13px] font-semibold text-[#122222]">{selectedIds.length} copies selected</span>
          <div className="h-4 w-px bg-black/10" />
          <button onClick={() => setSelectedIds([])} className="text-[12px] font-bold text-[#122222]/60 hover:underline cursor-pointer">Deselect all</button>
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
function CopyEditModal({ copy, onClose, shelves }: { copy: Copy & { title: string }; onClose: () => void; shelves: any[] }) {
  const { t } = useTranslation();
  const form = useForm({ defaultValues: { shelf: copy.shelf ?? "", condition: copy.condition, status: copy.status } });
  const mutation = useMutation({
    mutationFn: (v: any) => updateCopy(copy.id, v),
    onSuccess: () => { toast.success("Copy updated."); onClose(); },
    onError: (err: any) => toast.error(err.message)
  });

  // Parse shelves into rows and columns
  const parsedShelves = useMemo(() => {
    return shelves.map((s: any) => {
      const code = s.code || "";
      const m = code.match(/^([A-Za-z]+)[-_]?(\d+)$/);
      const row = m ? m[1].toUpperCase() : "A";
      const col = m ? m[2] : "01";
      return { id: s.id, code, row, col };
    });
  }, [shelves]);

  // Initial bookcase and row from copy's shelf code
  const initialShelfCode = copy.shelf || "";
  const initialMatch = initialShelfCode.match(/^([A-Za-z]+)[-_]?(\d+)$/);
  const initialRow = initialMatch ? initialMatch[1].toUpperCase() : "";
  const initialBookcase = initialMatch ? initialMatch[2] : "";

  const [selectedBookcase, setSelectedBookcase] = useState(initialBookcase);
  const [selectedRow, setSelectedRow] = useState(initialRow);

  const uniqueBookcases = useMemo(() => {
    const cols = parsedShelves.map(s => s.col);
    const set = new Set(cols);
    if (set.size === 0) return ["01", "02", "03", "04", "05", "06", "07", "08"];
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [parsedShelves]);

  const uniqueRows = useMemo(() => {
    const rows = parsedShelves.map(s => s.row);
    const set = new Set(rows);
    if (set.size === 0) return ["A", "B", "C", "D", "E"];
    return Array.from(set).sort();
  }, [parsedShelves]);

  const filteredRows = useMemo(() => {
    if (!selectedBookcase) return uniqueRows;
    const existing = parsedShelves.filter(s => s.col === selectedBookcase).map(s => s.row);
    if (existing.length === 0) return uniqueRows;
    return Array.from(new Set(existing)).sort();
  }, [uniqueRows, parsedShelves, selectedBookcase]);

  const filteredBookcases = useMemo(() => {
    if (!selectedRow) return uniqueBookcases;
    const existing = parsedShelves.filter(s => s.row === selectedRow).map(s => s.col);
    if (existing.length === 0) return uniqueBookcases;
    return Array.from(new Set(existing)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [uniqueBookcases, parsedShelves, selectedRow]);

  useEffect(() => {
    if (selectedBookcase && selectedRow) {
      const matched = parsedShelves.find(s => s.col === selectedBookcase && s.row === selectedRow);
      const code = matched ? matched.code : `${selectedRow}${selectedBookcase}`;
      form.setValue("shelf", code);
    } else {
      form.setValue("shelf", "");
    }
  }, [selectedBookcase, selectedRow, parsedShelves, form]);

  return (
    <Modal isOpen={true} onClose={onClose} title={`Edit Copy: ${copy.barcode}`}>
      <form onSubmit={form.handleSubmit(v => mutation.mutate(v))} className="space-y-4 text-[13px]">
        <div>
          <p className="text-[10px] text-[#122222]/40 uppercase tracking-wider font-semibold">{t("catalog.headers.title")}</p>
          <p className="font-semibold mt-0.5">{copy.title}</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <label className="text-[11px] font-semibold text-[#122222]/60 block">Bookcase
            <select 
              value={selectedBookcase} 
              onChange={(e) => setSelectedBookcase(e.target.value)}
              className="field-select text-[13px] py-2 px-3 mt-1 font-semibold w-full bg-white dark:bg-[#1d2926] border border-black/10 rounded-lg outline-none"
            >
              <option value="">None (Unassigned)</option>
              {filteredBookcases.map(col => (
                <option key={col} value={col}>Bookcase {col}</option>
              ))}
            </select>
          </label>
          <label className="text-[11px] font-semibold text-[#122222]/60 block">Row
            <select 
              value={selectedRow} 
              onChange={(e) => setSelectedRow(e.target.value)}
              className="field-select text-[13px] py-2 px-3 mt-1 font-semibold w-full bg-white dark:bg-[#1d2926] border border-black/10 rounded-lg outline-none"
            >
              <option value="">None (Unassigned)</option>
              {filteredRows.map(row => (
                <option key={row} value={row}>Row {row}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="text-[11px] font-semibold text-[#122222]/60 block">
          Condition
          <select {...form.register("condition")} className="field-select text-[13px] py-2 px-3 mt-1 font-semibold w-full bg-white dark:bg-[#1d2926] border border-black/10 rounded-lg outline-none">
            {["mint", "good", "fair", "worn", "damaged"].map(v => <option key={v} value={v} className="capitalize">{v.charAt(0).toUpperCase() + v.slice(1)}</option>)}
          </select>
        </label>
        <label className="text-[11px] font-semibold text-[#122222]/60 block">
          Status
          <select {...form.register("status")} className="field-select text-[13px] py-2 px-3 mt-1 font-semibold w-full bg-white dark:bg-[#1d2926] border border-black/10 rounded-lg outline-none">
            <option value="available">Available</option>
            <option value="on-loan">On Loan</option>
            <option value="reserved">Reserved</option>
            <option value="repair">In Repair</option>
            <option value="lost">Lost</option>
          </select>
        </label>
        <div className="flex gap-2 justify-end pt-4 border-t border-black/5">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={mutation.isPending}>Save Changes</Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Manage Locations Modal ───────────────────────────────────────────────────
function ManageLocationsModal({
  onClose,
  onRefresh,
  locationTree,
}: {
  onClose: () => void;
  onRefresh: () => void;
  locationTree: Record<string, string[]>;
}) {
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(
    Object.keys(locationTree)[0] ?? null
  );

  // Building state
  const [editingBuilding, setEditingBuilding] = useState<string | null>(null);
  const [buildingInput, setBuildingInput] = useState("");
  const [newBuildingInput, setNewBuildingInput] = useState("");
  const [addingBuilding, setAddingBuilding] = useState(false);

  // Floor state
  const [editingFloor, setEditingFloor] = useState<string | null>(null);
  const [floorInput, setFloorInput] = useState("");
  const [newFloorInput, setNewFloorInput] = useState("");
  const [addingFloor, setAddingFloor] = useState(false);

  // ── Building mutations ──
  const renameBuildingMutation = useMutation({
    mutationFn: ({ oldName, newName }: { oldName: string; newName: string }) =>
      renameBuilding(oldName, newName),
    onSuccess: (_, { newName }) => {
      toast.success("Building renamed.");
      setEditingBuilding(null);
      setSelectedBuilding(newName);
      onRefresh();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteBuildingMutation = useMutation({
    mutationFn: (name: string) => deleteBuilding(name),
    onSuccess: () => {
      toast.success("Building removed.");
      setSelectedBuilding(null);
      onRefresh();
    },
    onError: (err: any) => toast.error(err.message),
  });

  // ── Floor mutations ──
  const renameFloorMutation = useMutation({
    mutationFn: ({ room, oldFloor, newFloor }: { room: string; oldFloor: string; newFloor: string }) =>
      renameFloor(room, oldFloor, newFloor),
    onSuccess: () => {
      toast.success("Floor renamed.");
      setEditingFloor(null);
      onRefresh();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteFloorMutation = useMutation({
    mutationFn: ({ room, floor }: { room: string; floor: string }) =>
      deleteFloor(room, floor),
    onSuccess: () => {
      toast.success("Floor removed.");
      onRefresh();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const buildings = Object.keys(locationTree);
  const floors = selectedBuilding ? (locationTree[selectedBuilding] ?? []) : [];

  return (
    <Modal isOpen={true} onClose={onClose} title="Manage Buildings & Floors">
      <div className="flex gap-4 min-h-[320px] text-[13px]">

        {/* ── Buildings panel ── */}
        <div className="w-52 shrink-0 border-r border-black/5 dark:border-white/5 pr-4 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <Building2 size={13} className="text-[#b96f3e]" />
            <span className="font-bold text-[11px] uppercase tracking-wider text-[#122222]/60 dark:text-white/60 flex-1">Buildings</span>
            <button
              onClick={() => { setAddingBuilding(true); setNewBuildingInput(""); }}
              className="p-1 rounded hover:bg-black/5 text-emerald cursor-pointer"
              title="Add building"
            >
              <Plus size={13} />
            </button>
          </div>

          <div className="flex-1 space-y-1 overflow-y-auto">
            {buildings.map(building => (
              <div
                key={building}
                className={`group flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                  selectedBuilding === building
                    ? "bg-emerald/10 text-emerald"
                    : "text-[#122222]/70 dark:text-white/70 hover:bg-black/5"
                }`}
                onClick={() => { setSelectedBuilding(building); setEditingBuilding(null); setEditingFloor(null); }}
              >
                {editingBuilding === building ? (
                  <form
                    onSubmit={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (buildingInput.trim()) {
                        renameBuildingMutation.mutate({ oldName: building, newName: buildingInput.trim() });
                      }
                    }}
                    className="flex items-center gap-1 flex-1"
                    onClick={e => e.stopPropagation()}
                  >
                    <input
                      autoFocus
                      value={buildingInput}
                      onChange={e => setBuildingInput(e.target.value)}
                      className="flex-1 bg-white dark:bg-[#111d1a] border border-emerald rounded px-2 py-0.5 text-[12px] outline-none min-w-0"
                      onKeyDown={e => e.key === "Escape" && setEditingBuilding(null)}
                    />
                    <button type="submit" className="text-emerald hover:text-emerald/70 cursor-pointer"><Check size={12} /></button>
                    <button type="button" onClick={() => setEditingBuilding(null)} className="text-[#122222]/40 hover:text-red-500 cursor-pointer"><X size={12} /></button>
                  </form>
                ) : (
                  <>
                    <span className="flex-1 truncate text-[12px] font-medium">{building}</span>
                    <button
                      onClick={e => { e.stopPropagation(); setEditingBuilding(building); setBuildingInput(building); }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-black/10 text-[#122222]/50 dark:text-white/50 transition-opacity cursor-pointer"
                    >
                      <Pencil size={10} />
                    </button>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        if (confirm(`Delete building "${building}"? This only works if it has no shelves.`)) {
                          deleteBuildingMutation.mutate(building);
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-50 text-[#122222]/50 dark:text-white/50 hover:text-red-500 transition-opacity cursor-pointer"
                    >
                      <Trash size={10} />
                    </button>
                  </>
                )}
              </div>
            ))}

            {buildings.length === 0 && (
              <p className="text-[11px] text-[#122222]/40 dark:text-white/40 italic px-1 py-2">No buildings yet.</p>
            )}

            {addingBuilding && (
              <form
                onSubmit={e => {
                  e.preventDefault();
                  if (!newBuildingInput.trim()) return;
                  // Buildings without shelves don't need a DB call — just a reminder
                  toast.info(`Building "${newBuildingInput.trim()}" added. Assign shelves to it when creating new bookcases.`);
                  setAddingBuilding(false);
                  setNewBuildingInput("");
                }}
                className="flex items-center gap-1 px-2 py-1"
              >
                <input
                  autoFocus
                  placeholder="Building name…"
                  value={newBuildingInput}
                  onChange={e => setNewBuildingInput(e.target.value)}
                  className="flex-1 bg-white dark:bg-[#111d1a] border border-emerald rounded px-2 py-0.5 text-[12px] outline-none min-w-0"
                  onKeyDown={e => e.key === "Escape" && setAddingBuilding(false)}
                />
                <button type="submit" className="text-emerald cursor-pointer"><Check size={12} /></button>
                <button type="button" onClick={() => setAddingBuilding(false)} className="text-[#122222]/40 cursor-pointer"><X size={12} /></button>
              </form>
            )}
          </div>
        </div>

        {/* ── Floors panel ── */}
        <div className="flex-1 flex flex-col">
          {selectedBuilding ? (
            <>
              <div className="flex items-center gap-2 mb-3">
                <Layers size={13} className="text-[#b96f3e]" />
                <span className="font-bold text-[11px] uppercase tracking-wider text-[#122222]/60 dark:text-white/60 flex-1">
                  Floors — {selectedBuilding}
                </span>
                <button
                  onClick={() => { setAddingFloor(true); setNewFloorInput(""); }}
                  className="p-1 rounded hover:bg-black/5 text-emerald cursor-pointer"
                  title="Add floor"
                >
                  <Plus size={13} />
                </button>
              </div>

              <div className="flex-1 space-y-1 overflow-y-auto">
                {floors.map(floor => (
                  <div key={floor} className="group flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-black/5 transition-colors">
                    {editingFloor === floor ? (
                      <form
                        onSubmit={e => {
                          e.preventDefault();
                          if (floorInput.trim() && selectedBuilding) {
                            renameFloorMutation.mutate({ room: selectedBuilding, oldFloor: floor, newFloor: floorInput.trim() });
                          }
                        }}
                        className="flex items-center gap-1 flex-1"
                      >
                        <input
                          autoFocus
                          value={floorInput}
                          onChange={e => setFloorInput(e.target.value)}
                          className="flex-1 bg-white dark:bg-[#111d1a] border border-emerald rounded px-2 py-0.5 text-[12px] outline-none"
                          onKeyDown={e => e.key === "Escape" && setEditingFloor(null)}
                        />
                        <button type="submit" className="text-emerald cursor-pointer"><Check size={12} /></button>
                        <button type="button" onClick={() => setEditingFloor(null)} className="text-[#122222]/40 cursor-pointer"><X size={12} /></button>
                      </form>
                    ) : (
                      <>
                        <ShelfRowIcon size={12} className="text-[#122222]/40 dark:text-white/40 shrink-0" />
                        <span className="flex-1 text-[12px] text-[#122222]/80 dark:text-white/80">{floor}</span>
                        <button
                          onClick={() => { setEditingFloor(floor); setFloorInput(floor); }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-black/10 text-[#122222]/50 dark:text-white/50 transition-opacity cursor-pointer"
                        >
                          <Pencil size={10} />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete floor "${floor}" from ${selectedBuilding}? This only works if it has no shelves.`)) {
                              deleteFloorMutation.mutate({ room: selectedBuilding!, floor });
                            }
                          }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-50 text-[#122222]/50 hover:text-red-500 transition-opacity cursor-pointer"
                        >
                          <Trash size={10} />
                        </button>
                      </>
                    )}
                  </div>
                ))}

                {floors.length === 0 && !addingFloor && (
                  <p className="text-[11px] text-[#122222]/40 dark:text-white/40 italic px-1 py-2">
                    No floors assigned yet. Add a floor below.
                  </p>
                )}

                {addingFloor && (
                  <form
                    onSubmit={e => {
                      e.preventDefault();
                      if (!newFloorInput.trim()) return;
                      toast.info(`Floor "${newFloorInput.trim()}" added. Assign shelves to it when creating new bookcases.`);
                      setAddingFloor(false);
                      setNewFloorInput("");
                    }}
                    className="flex items-center gap-1 px-2 py-1"
                  >
                    <input
                      autoFocus
                      placeholder="Floor name… (e.g. Ground Floor)"
                      value={newFloorInput}
                      onChange={e => setNewFloorInput(e.target.value)}
                      className="flex-1 bg-white dark:bg-[#111d1a] border border-emerald rounded px-2 py-0.5 text-[12px] outline-none"
                      onKeyDown={e => e.key === "Escape" && setAddingFloor(false)}
                    />
                    <button type="submit" className="text-emerald cursor-pointer"><Check size={12} /></button>
                    <button type="button" onClick={() => setAddingFloor(false)} className="text-[#122222]/40 cursor-pointer"><X size={12} /></button>
                  </form>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-[#122222]/30 dark:text-white/30 gap-2">
              <Building2 size={28} className="opacity-40" />
              <p className="text-[12px]">Select a building to manage its floors</p>
            </div>
          )}
        </div>

      </div>

      <div className="flex justify-end pt-4 mt-2 border-t border-black/5">
        <Button variant="ghost" onClick={onClose}>Close</Button>
      </div>
    </Modal>
  );
}
