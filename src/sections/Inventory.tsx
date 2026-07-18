import { useState, useMemo, useEffect, useRef } from "react";
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

// lucide-react imports for icons
import { 
  ScanLine as ScanIcon, MoreHorizontal as MoreIcon, ChevronLeft as LeftIcon, ChevronRight as RightIcon, BookCopy as CopyIcon, CheckCircle2 as CheckIcon, AlertTriangle as AlertIcon, HelpCircle as HelpIcon, Trash2
} from "lucide-react";


const invalidate = () => queryClient.invalidateQueries();

interface ScannedItem {
  barcode: string;
  title: string;
  currentShelf: string;
  result: "found" | "misplaced" | "unknown";
  copyId?: string;
}

export function InventoryPage() {
  const { t } = useTranslation();
  const [term, setTerm] = useState("");
  const [selectedCopy, setSelectedCopy] = useState<(Copy & { title: string }) | null>(null);

  // Shelf Scan workflow state
  const [scanInitOpen, setScanInitOpen] = useState(false);
  const [targetShelf, setTargetShelf] = useState("");
  const [activeSession, setActiveSession] = useState(false);
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [barcodeInput, setBarcodeInput] = useState("");
  const scanInputRef = useRef<HTMLInputElement>(null);

  // Sorting and filters
  const [shelfFilter, setShelfFilter] = useState("All Shelves");
  const [conditionFilter, setConditionFilter] = useState("All Conditions");
  const [page, setPage] = useState(1);
  const itemsPerPage = useUiStore((state) => state.preferences.pageSize) || 10;
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Queries
  const result = useQuery({ queryKey: ["copies", "inventory"], queryFn: () => copies() });

  const bulkArchiveMutation = useMutation({
    mutationFn: async () => {
      await Promise.all(selectedIds.map(id => deleteCopy(id)));
    },
    onSuccess: () => {
      invalidate();
      toast.success(t("inventory.alerts.bulkArchived") || "Selected copies archived.");
      setSelectedIds([]);
    },
    onError: (err: any) => {
      toast.error(err.message || t("inventory.alerts.bulkArchiveFailed") || "Failed to archive copies.");
    }
  });

  const handleBulkArchive = () => {
    if (confirm(t("inventory.alerts.confirmBulkArchive", { count: selectedIds.length }) || `Are you sure you want to archive ${selectedIds.length} selected copy/copies?`)) {
      bulkArchiveMutation.mutate();
    }
  };

  // Focus scan input when session becomes active
  useEffect(() => {
    if (activeSession && scanInputRef.current) {
      scanInputRef.current.focus();
    }
  }, [activeSession]);

  // Extract unique shelves and conditions
  const shelvesList = useMemo(() => {
    if (!result.data) return [];
    const set = new Set(result.data.map(c => c.shelf).filter(Boolean));
    return Array.from(set) as string[];
  }, [result.data]);

  const conditionsList = useMemo(() => {
    if (!result.data) return [];
    const set = new Set(result.data.map(c => c.condition).filter(Boolean));
    return Array.from(set) as string[];
  }, [result.data]);

  // Apply filters
  const filteredCopies = useMemo(() => {
    if (!result.data) return [];
    return result.data.filter(c => {
      // Term filter
      if (term.trim()) {
        const q = term.toLowerCase().trim();
        const matches = 
          c.barcode.toLowerCase().includes(q) || 
          c.accession_number.toLowerCase().includes(q) || 
          c.title.toLowerCase().includes(q);
        if (!matches) return false;
      }
      // Shelf filter
      if (shelfFilter !== "All Shelves") {
        if (c.shelf !== shelfFilter) return false;
      }
      // Condition filter
      if (conditionFilter !== "All Conditions") {
        if (c.condition !== conditionFilter) return false;
      }
      return true;
    });
  }, [result.data, term, shelfFilter, conditionFilter]);

  // Paginated copies
  const paginatedCopies = useMemo(() => {
    const start = (page - 1) * itemsPerPage;
    return filteredCopies.slice(start, start + itemsPerPage);
  }, [filteredCopies, page]);

  const totalPages = Math.ceil(filteredCopies.length / itemsPerPage) || 1;

  // Compute status counts dynamically
  const counts = useMemo(() => {
    if (!result.data) return { available: 0, loan: 0, other: 0 };
    return result.data.reduce((all, copy) => {
      if (copy.status === "available") {
        all.available += 1;
      } else if (copy.status === "on-loan") {
        all.loan += 1;
      } else {
        all.other += 1;
      }
      return all;
    }, { available: 0, loan: 0, other: 0 });
  }, [result.data]);

  const startScanningSession = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanShelf = cleanText(targetShelf);
    if (!cleanShelf) {
      toast.warning(t("inventory.alerts.specifyShelf") || "Please specify a shelf code.");
      return;
    }
    setTargetShelf(cleanShelf);
    setScannedItems([]);
    setScanInitOpen(false);
    setActiveSession(true);
  };

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const barcode = cleanBarcode(barcodeInput);
    if (!barcode) return;

    // Check if barcode is already scanned in this session
    if (scannedItems.some(item => item.barcode === barcode)) {
      toast.warning(t("inventory.alerts.alreadyScanned") || "This barcode has already been scanned in this session.");
      setBarcodeInput("");
      return;
    }

    // Look up barcode in copy inventory
    const matched = result.data?.find(c => c.barcode.toUpperCase() === barcode);
    if (matched) {
      const matchShelf = matched.shelf || "";
      const isCorrectShelf = matchShelf.trim().toLowerCase() === targetShelf.trim().toLowerCase();
      
      setScannedItems(prev => [
        {
          barcode,
          title: matched.title,
          currentShelf: matchShelf || t("inventory.unassigned") || "Unassigned",
          result: isCorrectShelf ? "found" : "misplaced",
          copyId: matched.id
        },
        ...prev
      ]);
      toast.success(t("inventory.alerts.scannedSuccess", { title: matched.title }) || `Scanned: ${matched.title}`);
    } else {
      setScannedItems(prev => [
        {
          barcode,
          title: t("inventory.unknownItem") || "Unknown Item",
          currentShelf: "Unknown",
          result: "unknown"
        },
        ...prev
      ]);
      toast.error(t("inventory.alerts.notRecognized", { barcode }) || `Barcode "${barcode}" not recognized in system.`);
    }

    setBarcodeInput("");
  };

  // Session completion mutation
  const finishSessionMutation = useMutation({
    mutationFn: async () => {
      // Loop misplaced items and update their shelf
      const misplaced = scannedItems.filter(item => item.result === "misplaced" && item.copyId);
      for (const item of misplaced) {
        await updateCopy(item.copyId!, { shelf: targetShelf });
      }
    },
    onSuccess: () => {
      toast.success(t("inventory.alerts.auditComplete") || "Audit complete. Locations updated for misplaced books.");
      setActiveSession(false);
      setScannedItems([]);
      setTargetShelf("");
      invalidate();
    },
    onError: (err: any) => toast.error(err.message)
  });

  return (
    <div className="flex flex-col gap-6 w-full text-[13px]">
      {/* Header */}
      <div className="flex justify-between items-end mb-2">
        <div>
          <h1 className="font-display text-[28px] font-bold text-[#122222] dark:text-white leading-tight">{t("inventory.title")}</h1>
          <p className="text-[13px] text-[#122222]/60 dark:text-white/60">{t("inventory.subtitle")}</p>
        </div>
        <button 
          onClick={() => setScanInitOpen(true)}
          className="flex items-center gap-2 bg-emerald text-white px-4 py-2.5 rounded-lg font-bold text-[13px] hover:bg-emerald/90 transition-colors shadow-sm shadow-emerald/20 cursor-pointer"
        >
          <ScanIcon size={16} /> {t("inventory.startScan")}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SummaryCard title={t("inventory.metrics.available")} count={counts.available} color="bg-emerald" />
        <SummaryCard title={t("inventory.metrics.onLoan")} count={counts.loan} color="bg-[#b96f3e]" />
        <SummaryCard title={t("inventory.metrics.other")} count={counts.other} color="bg-gray-400" />
      </div>

      {/* Main Panel */}
      <div className="bg-white dark:bg-[#1d2926] border border-black/5 dark:border-white/5 rounded-2xl flex flex-col shadow-card overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-black/5 dark:border-white/5 flex items-center gap-3 bg-[#fcfbf8] dark:bg-[#111d1a]">
          <div className="flex-1 max-w-sm relative">
            <ScanIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#122222]/40" />
            <input 
              type="text" 
              placeholder={t("inventory.searchPlaceholder")} 
              value={term}
              onChange={(e) => { setTerm(e.target.value); setPage(1); }}
              className="w-full bg-white dark:bg-[#1d2926] border border-black/10 dark:border-white/10 rounded-lg py-2 pl-9 pr-3 text-[13px] text-[#122222] dark:text-[#f0ebe1] outline-none focus:border-emerald focus:ring-1 focus:ring-emerald" 
            />
          </div>

          <select 
            value={shelfFilter} 
            onChange={(e) => { setShelfFilter(e.target.value); setPage(1); }}
            className="bg-white dark:bg-[#1d2926] border border-black/5 dark:border-white/5 rounded-lg py-2 px-4 text-[13px] font-semibold text-[#122222]/70 dark:text-white/70 outline-none cursor-pointer hover:border-emerald/30 transition-colors"
          >
            <option value="All Shelves">{t("inventory.allShelves")}</option>
            {shelvesList.map(shelf => (
              <option key={shelf} value={shelf}>Shelf {shelf}</option>
            ))}
          </select>

          <select 
            value={conditionFilter} 
            onChange={(e) => { setConditionFilter(e.target.value); setPage(1); }}
            className="bg-white dark:bg-[#1d2926] border border-black/5 dark:border-white/5 rounded-lg py-2 px-4 text-[13px] font-semibold text-[#122222]/70 dark:text-white/70 outline-none cursor-pointer hover:border-emerald/30 transition-colors"
          >
            <option value="All Conditions">{t("inventory.allConditions")}</option>
            {conditionsList.map(cond => (
              <option key={cond} value={cond}>{t("catalog.condition." + cond?.toLowerCase()) || cond}</option>
            ))}
          </select>
        </div>

        {/* Table Area */}
        <div className="flex-1 overflow-auto">
          {paginatedCopies.length ? (
            <table className="w-full text-left text-[13px]">
              <thead className="bg-[#fcfbf8] dark:bg-[#111d1a] sticky top-0 border-b border-black/5 dark:border-white/5 text-[11px] font-bold text-[#122222]/50 dark:text-white/50 uppercase tracking-wider select-none">
                <tr>
                  <th className="px-6 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={filteredCopies.length > 0 && selectedIds.length === filteredCopies.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds(filteredCopies.map(c => c.id));
                        } else {
                          setSelectedIds([]);
                        }
                      }}
                      className="cursor-pointer rounded border-black/25 dark:border-white/25 text-emerald focus:ring-emerald h-4 w-4"
                    />
                  </th>
                  <th className="px-6 py-3">{t("circulation.barcode")}</th>
                  <th className="px-6 py-3">{t("catalog.headers.title")}</th>
                  <th className="px-6 py-3">{t("inventory.shelfLocation")}</th>
                  <th className="px-6 py-3">{t("inventory.condition")}</th>
                  <th className="px-6 py-3">{t("status")}</th>
                  <th className="px-6 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/5">
                {paginatedCopies.map((copy) => (
                  <tr 
                    key={copy.id} 
                    onClick={() => setSelectedCopy(copy)}
                    className={`hover:bg-black/5 dark:hover:bg-white/5 transition-colors group cursor-pointer ${
                      selectedIds.includes(copy.id) ? "bg-emerald/5 dark:bg-emerald-light/5" : ""
                    }`}
                  >
                    <td className="px-6 py-3 w-10" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(copy.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds(prev => [...prev, copy.id]);
                          } else {
                            setSelectedIds(prev => prev.filter(id => id !== copy.id));
                          }
                        }}
                        className="cursor-pointer rounded border-black/25 dark:border-white/25 text-emerald focus:ring-emerald h-4 w-4"
                      />
                    </td>
                    <td className="px-6 py-3 font-mono font-bold text-[#122222] dark:text-white">{copy.barcode}</td>
                    <td className="px-6 py-3 font-semibold text-[#122222]/80 dark:text-white/80">{copy.title}</td>
                    <td className="px-6 py-3 text-[#122222]/75 dark:text-white/75 font-semibold">
                      {copy.shelf ? `Shelf ${copy.shelf}` : t("inventory.unassigned") || "Unassigned"}
                    </td>
                    <td className="px-6 py-3 text-[#122222]/70 dark:text-white/70">
                      <span className="capitalize">{t("catalog.condition." + copy.condition?.toLowerCase()) || copy.condition}</span>
                    </td>
                    <td className="px-6 py-3">
                      <StatusBadge value={copy.status} />
                    </td>
                    <td className="px-6 py-3 text-[#122222]/40 group-hover:text-[#122222]"><MoreIcon size={16} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
             <div className="flex-1 flex flex-col items-center justify-center py-20 opacity-60">
              <div className="w-24 h-24 bg-black/5 dark:bg-white/5 rounded-full flex items-center justify-center text-[#122222]/40 dark:text-white/40 mb-6">
                <CopyIcon size={40} />
              </div>
              <h2 className="text-[20px] font-bold text-[#122222] dark:text-white mb-2">{t("inventory.noCopies")}</h2>
              <p className="text-[14px] text-[#122222]/60 dark:text-white/60">{t("inventory.noCopiesHelp")}</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        <div className="p-3 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-[12px] text-[#122222]/60 dark:text-white/60 font-semibold bg-[#fcfbf8] dark:bg-[#111d1a] rounded-b-xl select-none">
          <div>{t("catalog.showing", { start: Math.min(filteredCopies.length, (page - 1) * itemsPerPage + 1), end: Math.min(filteredCopies.length, page * itemsPerPage), total: filteredCopies.length })}</div>
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="w-7 h-7 rounded flex items-center justify-center hover:bg-black/5 disabled:opacity-30 cursor-pointer"
            >
              <LeftIcon size={14} />
            </button>
            <span className="px-2">{page} / {totalPages}</span>
            <button 
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="w-7 h-7 rounded flex items-center justify-center hover:bg-black/5 disabled:opacity-30 cursor-pointer"
            >
              <RightIcon size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Copy Editing modal */}
      {selectedCopy && (
        <CopyEditModal copy={selectedCopy} onClose={() => { setSelectedCopy(null); invalidate(); }} />
      )}

      {/* Session Init modal */}
      {scanInitOpen && (
        <Modal isOpen={scanInitOpen} onClose={() => setScanInitOpen(false)} title={t("inventory.startScan")}>
          <form onSubmit={startScanningSession} className="space-y-4">
            <p className="text-[13px] text-[#122222]/70 dark:text-white/70">{t("inventory.scanInstructions")}</p>
            <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 block">{t("inventory.targetShelfCode")}
              <Input 
                type="text" 
                placeholder="e.g. A-12, MEDICINE-3"
                value={targetShelf}
                onChange={(e) => setTargetShelf(e.target.value)}
                required
                className="mt-1"
              />
            </label>
            <div className="flex gap-2 justify-end pt-4 pb-4 border-t border-black/5 dark:border-white/5">
              <Button type="button" variant="ghost" onClick={() => setScanInitOpen(false)}>{t("catalog.addModal.cancel")}</Button>
              <Button type="submit">{t("inventory.beginSession")}</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Active scanning session modal */}
      {activeSession && (
        <Modal isOpen={activeSession} onClose={() => {}} title={`${t("inventory.scanningShelf")}: ${targetShelf}`}>
          <div className="flex flex-col gap-4 text-[13px] max-w-lg w-full">
            <p className="text-[#122222]/70 dark:text-white/70">
              {t("inventory.scanningHelp")}
            </p>
            
            <form onSubmit={handleBarcodeSubmit} className="flex gap-2">
              <input 
                ref={scanInputRef}
                type="text"
                placeholder={t("inventory.enterBarcodePlaceholder") || "Scan or enter book barcode..."}
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                className="flex-1 bg-white dark:bg-[#1d2926] border border-black/15 dark:border-white/15 rounded-lg py-2.5 px-3 text-[14px] text-[#122222] dark:text-white outline-none focus:border-emerald font-semibold"
              />
              <Button type="submit">{t("search")}</Button>
            </form>

            {/* Audit Scan list */}
            <div className="flex-1 overflow-y-auto space-y-3 min-h-[250px] pr-1 no-scrollbar">
              {scannedItems.length > 0 ? (
                scannedItems.map((item) => (
                  <div 
                    key={item.barcode} 
                    className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                      item.result === "found" 
                        ? "border-[#1a4d40]/10 bg-[#1a4d40]/5" 
                        : item.result === "misplaced"
                        ? "border-[#b96f3e]/20 bg-[#b96f3e]/5"
                        : "border-red-500/20 bg-red-500/5"
                    }`}
                  >
                    <div>
                      <div className="font-bold text-[#122222] dark:text-white">{item.title}</div>
                      <div className="text-[11px] text-[#122222]/50 dark:text-white/50 font-mono mt-0.5">{t("circulation.barcode")}: {item.barcode}</div>
                    </div>
                    <div className="text-right">
                      {item.result === "found" && (
                        <span className="text-[11px] font-bold text-emerald dark:text-emerald-light bg-emerald-500/10 px-2.5 py-1 rounded flex items-center gap-1">
                          <CheckIcon size={12}/> {t("inventory.correctShelf")}
                        </span>
                      )}
                      {item.result === "misplaced" && (
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-bold text-[#b96f3e] bg-[#b96f3e]/10 px-2 py-0.5 rounded flex items-center gap-1">
                            <AlertIcon size={11}/> {t("inventory.misplaced", { shelf: item.currentShelf })}
                          </span>
                          <span className="text-[9px] text-[#b96f3e] block font-semibold">{t("inventory.willUpdate", { target: targetShelf })}</span>
                        </div>
                      )}
                      {item.result === "unknown" && (
                        <span className="text-[11px] font-bold text-red-500 bg-red-500/10 px-2.5 py-1 rounded flex items-center gap-1">
                          <HelpIcon size={12}/> {t("inventory.unknownItem")}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-[#122222]/40 dark:text-white/40 flex flex-col items-center justify-center">
                  <ScanIcon size={32} className="animate-pulse mb-3 opacity-60 text-emerald" />
                  <span>{t("inventory.readyToScanHelp") || "Ready to scan. Place cursor in input field and scan copies."}</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-between items-center pt-4 pb-4 border-t border-black/5 dark:border-white/5">
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => {
                  if (confirm(t("inventory.alerts.confirmDiscardSession") || "Discard all scanning progress in this session?")) {
                    setActiveSession(false);
                    setScannedItems([]);
                  }
                }}
                className="text-red-500 hover:bg-red-500/10 cursor-pointer"
              >
                {t("inventory.cancelSession") || "Cancel Session"}
              </Button>
              <Button 
                onClick={() => finishSessionMutation.mutate()} 
                disabled={finishSessionMutation.isPending}
                className="cursor-pointer"
              >
                {finishSessionMutation.isPending ? t("circulation.completingCheckout") || "Completing..." : t("inventory.finishSession", { count: scannedItems.filter(i => i.result === 'misplaced').length }) || `Finish & Update Locations (${scannedItems.filter(i => i.result === 'misplaced').length})`}
              </Button>
            </div>
          </div>
        </Modal>
      )}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/90 dark:bg-[#1d2926]/90 backdrop-blur-md px-6 py-3 rounded-full border border-black/10 dark:border-white/10 shadow-lg flex items-center gap-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <span className="text-[13px] font-semibold text-[#122222] dark:text-white">
            {t("inventory.bulk.selectedCount", { count: selectedIds.length }) || `${selectedIds.length} copies selected`}
          </span>
          <div className="h-4 w-px bg-black/10 dark:bg-white/10" />
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedIds(filteredCopies.map(c => c.id))}
              className="text-[12px] font-bold text-emerald dark:text-emerald-light hover:underline px-2 py-1 cursor-pointer"
            >
              {t("catalog.bulk.selectAll") || "Select All"}
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="text-[12px] font-bold text-[#122222]/60 dark:text-white/60 hover:underline px-2 py-1 cursor-pointer"
            >
              {t("catalog.bulk.deselectAll") || "Deselect All"}
            </button>
            <button
              onClick={handleBulkArchive}
              className="flex items-center gap-1.5 text-[12px] font-bold bg-red-500 hover:bg-red-600 text-white px-4 py-1.5 rounded-full shadow transition-colors cursor-pointer"
            >
              <Trash2 size={13} />
              {t("catalog.bulk.archiveSelected") || "Archive Selected"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Copy Editing Modal Component
function CopyEditModal({ copy, onClose }: { copy: Copy & { title: string }; onClose: () => void }) {
  const { t } = useTranslation();
  const form = useForm({
    defaultValues: {
      shelf: copy.shelf || "",
      condition: copy.condition,
      status: copy.status
    }
  });

  const mutation = useMutation({
    mutationFn: (values: any) => updateCopy(copy.id, values),
    onSuccess: () => {
      toast.success(t("inventory.alerts.copyUpdated") || "Copy details updated.");
      onClose();
    },
    onError: (err: any) => toast.error(err.message)
  });

  return (
    <Modal isOpen={true} onClose={onClose} title={t("inventory.editCopyTitle", { barcode: copy.barcode }) || `Edit Copy: ${copy.barcode}`}>
      <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4 text-[13px]">
        <div>
          <p className="text-xs text-ink/40 dark:text-parchment/40 uppercase tracking-wider font-semibold">{t("catalog.headers.title")}</p>
          <p className="text-sm font-semibold mt-0.5">{copy.title}</p>
        </div>
        
        <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 block">{t("inventory.shelfLocationLabel") || "Shelf Location (Code)"}
          <Input {...form.register("shelf")} placeholder={t("catalog.details.copyShelfPlaceholder") || "e.g. A-12"} />
        </label>

        <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 block">{t("catalog.details.copyCondition")}
          <select {...form.register("condition")} className="field-select text-[13px] py-2 px-3 mt-1 font-semibold">
            <option value="mint">{t("catalog.condition.mint") || "Mint"}</option>
            <option value="good">{t("catalog.condition.good") || "Good"}</option>
            <option value="fair">{t("catalog.condition.fair") || "Fair"}</option>
            <option value="worn">{t("catalog.condition.worn") || "Worn"}</option>
            <option value="damaged">{t("catalog.condition.damaged") || "Damaged"}</option>
          </select>
        </label>

        <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 block">{t("status")}
          <select {...form.register("status")} className="field-select text-[13px] py-2 px-3 mt-1 font-semibold">
            <option value="available">{t("status.available")}</option>
            <option value="on-loan">{t("status.onloan")}</option>
            <option value="reserved">{t("status.reserved")}</option>
            <option value="repair">{t("status.repair") || "In Repair"}</option>
            <option value="lost">{t("status.lost") || "Lost"}</option>
          </select>
        </label>

        <div className="flex gap-2 justify-end pt-4 border-t border-black/5 dark:border-white/5">
          <Button type="button" variant="ghost" onClick={onClose}>{t("catalog.addModal.cancel")}</Button>
          <Button type="submit" disabled={mutation.isPending}>{t("inventory.saveChanges") || "Save Changes"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function SummaryCard({ title, count, color }: any) {
  return (
    <div className="bg-white dark:bg-[#1d2926] p-6 rounded-2xl border border-black/5 dark:border-white/5 shadow-sm relative overflow-hidden group hover:border-black/10 dark:hover:border-white/10 transition-colors">
      <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${color}`} />
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[13px] font-bold text-[#122222]/50 dark:text-white/50 uppercase tracking-wider mb-2">{title}</p>
          <p className="text-[36px] font-display font-bold text-[#122222] dark:text-white leading-none">{count}</p>
        </div>
        <div className={`w-12 h-12 rounded-full ${color} bg-opacity-10 dark:bg-opacity-20 flex items-center justify-center`}>
          <CheckIcon size={24} className={color.replace('bg-', 'text-')} />
        </div>
      </div>
    </div>
  );
}
