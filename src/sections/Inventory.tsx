import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { copies, updateCopy } from "../data/repositories/library";
import { Modal, Input, Button, StatusBadge } from "../components/ui/primitives";
import { toast } from "sonner";
import { queryClient } from "../app/providers";
import type { Copy } from "../types";

// lucide-react imports for icons
import { 
  ScanLine as ScanIcon, MoreHorizontal as MoreIcon, ChevronLeft as LeftIcon, ChevronRight as RightIcon, BookCopy as CopyIcon, CheckCircle2 as CheckIcon, AlertTriangle as AlertIcon, HelpCircle as HelpIcon
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
  const itemsPerPage = 8;

  // Queries
  const result = useQuery({ queryKey: ["copies", "inventory"], queryFn: () => copies() });

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
    if (!targetShelf.trim()) {
      toast.warning("Please specify a shelf code.");
      return;
    }
    setScannedItems([]);
    setScanInitOpen(false);
    setActiveSession(true);
  };

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const barcode = barcodeInput.trim();
    if (!barcode) return;

    // Check if barcode is already scanned in this session
    if (scannedItems.some(item => item.barcode === barcode)) {
      toast.warning("This barcode has already been scanned in this session.");
      setBarcodeInput("");
      return;
    }

    // Look up barcode in copy inventory
    const matched = result.data?.find(c => c.barcode === barcode);
    if (matched) {
      const matchShelf = matched.shelf || "";
      const isCorrectShelf = matchShelf.trim().toLowerCase() === targetShelf.trim().toLowerCase();
      
      setScannedItems(prev => [
        {
          barcode,
          title: matched.title,
          currentShelf: matchShelf || "Unassigned",
          result: isCorrectShelf ? "found" : "misplaced",
          copyId: matched.id
        },
        ...prev
      ]);
    } else {
      setScannedItems(prev => [
        {
          barcode,
          title: "Unknown Book Copy",
          currentShelf: "Unknown",
          result: "unknown"
        },
        ...prev
      ]);
    }

    setBarcodeInput("");
    // Re-focus input
    setTimeout(() => scanInputRef.current?.focus(), 50);
  };

  // Commit session location updates
  const finishSessionMutation = useMutation({
    mutationFn: async () => {
      const misplaced = scannedItems.filter(s => s.result === "misplaced" && s.copyId);
      for (const item of misplaced) {
        await updateCopy(item.copyId!, { shelf: targetShelf, status: "available" });
      }
      return misplaced.length;
    },
    onSuccess: (updatedCount) => {
      toast.success(`Shelf scan completed. Corrected location of ${updatedCount} misplaced books.`);
      setActiveSession(false);
      setScannedItems([]);
      setTargetShelf("");
      invalidate();
    },
    onError: (err: any) => {
      toast.error("Failed to commit scanner changes: " + err.message);
    }
  });

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="font-display text-[28px] font-bold text-[#122222] dark:text-white leading-tight">Inventory</h1>
          <p className="text-[13px] text-[#122222]/60 dark:text-white/60">Review copy condition and status before running a shelf-scanning session.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setScanInitOpen(true)}
            className="flex items-center gap-2 bg-[#1a4d40] text-white px-4 py-2 rounded-lg font-bold text-[13px] hover:bg-[#1a4d40]/90 transition-colors shadow-sm shadow-[#1a4d40]/20"
          >
            <ScanIcon size={16} /> Start shelf scan
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <SummaryCard title="Available on shelf" count={counts.available.toLocaleString()} color="bg-[#1a4d40]" />
        <SummaryCard title="Currently on loan" count={counts.loan.toLocaleString()} color="bg-[#b96f3e]" />
        <SummaryCard title="In repair / Lost / Other" count={counts.other.toLocaleString()} color="bg-red-500" />
      </div>

      {/* Main Panel */}
      <div className="flex-1 bg-white dark:bg-[#1d2926] border border-black/5 dark:border-white/5 rounded-2xl flex flex-col shadow-card overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-black/5 dark:border-white/5 flex items-center gap-3 bg-[#fcfbf8] dark:bg-[#111d1a]">
          <div className="flex-1 max-w-sm relative">
             <input 
              type="text" 
              placeholder="Search barcode, accession, or title..." 
              value={term}
              onChange={(e) => { setTerm(e.target.value); setPage(1); }}
              className="w-full bg-white dark:bg-[#1d2926] border border-black/10 dark:border-white/10 rounded-lg py-2 pl-3 pr-3 text-[13px] text-[#122222] dark:text-[#f0ebe1] outline-none focus:border-[#1a4d40]" 
            />
          </div>
          
          {/* Shelf Filter */}
          <select 
            value={shelfFilter}
            onChange={(e) => { setShelfFilter(e.target.value); setPage(1); }}
            className="bg-white dark:bg-[#1d2926] border border-black/5 dark:border-white/5 rounded-lg py-2 px-4 text-[13px] font-semibold text-[#122222]/70 dark:text-white/70 outline-none cursor-pointer"
          >
            <option value="All Shelves">All Shelves</option>
            {shelvesList.map(shelf => (
              <option key={shelf} value={shelf}>{shelf}</option>
            ))}
          </select>

          {/* Condition Filter */}
          <select 
            value={conditionFilter}
            onChange={(e) => { setConditionFilter(e.target.value); setPage(1); }}
            className="bg-white dark:bg-[#1d2926] border border-black/5 dark:border-white/5 rounded-lg py-2 px-4 text-[13px] font-semibold text-[#122222]/70 dark:text-white/70 outline-none cursor-pointer"
          >
            <option value="All Conditions">All Conditions</option>
            {conditionsList.map(cond => (
              <option key={cond} value={cond}>{cond.charAt(0).toUpperCase() + cond.slice(1)}</option>
            ))}
          </select>
        </div>

        {/* Table Area */}
        <div className="flex-1 overflow-auto">
          {paginatedCopies.length ? (
            <table className="w-full text-left text-[13px]">
              <thead className="bg-[#fcfbf8] dark:bg-[#111d1a] sticky top-0 border-b border-black/5 dark:border-white/5 text-[11px] font-bold text-[#122222]/50 dark:text-white/50 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3">COPY</th>
                  <th className="px-6 py-3">TITLE</th>
                  <th className="px-6 py-3">SHELF</th>
                  <th className="px-6 py-3">CONDITION</th>
                  <th className="px-6 py-3">STATUS</th>
                  <th className="px-6 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/5">
                {paginatedCopies.map((copy) => (
                  <tr 
                    key={copy.id} 
                    className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer group"
                    onClick={() => setSelectedCopy(copy)}
                  >
                    <td className="px-6 py-3">
                      <div className="font-mono font-bold text-[#122222] dark:text-white">{copy.accession_number}</div>
                      <div className="text-[11px] text-[#122222]/50 dark:text-white/50 mt-0.5">{copy.barcode}</div>
                    </td>
                    <td className="px-6 py-3 font-semibold text-[#122222] dark:text-white max-w-xs truncate">{copy.title}</td>
                    <td className="px-6 py-3 text-[#122222]/70 dark:text-white/70">{copy.shelf || "—"}</td>
                    <td className="px-6 py-3">
                      <span className={`px-2 py-0.5 rounded-[4px] text-[11px] font-bold ${
                        copy.condition === 'good' 
                          ? 'bg-[#1a4d40]/10 text-[#1a4d40] dark:bg-[#1b9277]/20 dark:text-[#1b9277]' 
                          : 'bg-[#b96f3e]/10 text-[#b96f3e]'
                      }`}>
                        {copy.condition.charAt(0).toUpperCase() + copy.condition.slice(1)}
                      </span>
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
              <h2 className="text-[20px] font-bold text-[#122222] dark:text-white mb-2">No copies found</h2>
              <p className="text-[14px] text-[#122222]/60 dark:text-white/60">Add a barcode when cataloguing a title to create its first copy.</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {filteredCopies.length ? (
          <div className="p-3 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-[12px] text-[#122222]/60 dark:text-white/60 font-semibold bg-[#fcfbf8] dark:bg-[#111d1a]">
            <div>Showing {Math.min(filteredCopies.length, (page - 1) * itemsPerPage + 1)} to {Math.min(filteredCopies.length, page * itemsPerPage)} of {filteredCopies.length} results</div>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setPage(p => Math.max(1, p - 1))} 
                disabled={page === 1}
                className="w-7 h-7 rounded flex items-center justify-center hover:bg-black/5 disabled:opacity-30"
              >
                <LeftIcon size={14}/>
              </button>
              <span className="px-2">{page} / {totalPages}</span>
              <button 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
                disabled={page === totalPages}
                className="w-7 h-7 rounded flex items-center justify-center hover:bg-black/5 disabled:opacity-30"
              >
                <RightIcon size={14}/>
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {selectedCopy && (
        <CopyEditModal 
          copy={selectedCopy} 
          onClose={() => {
            setSelectedCopy(null);
            invalidate();
          }}
        />
      )}

      {/* Start Scan Parameters Modal */}
      {scanInitOpen && (
        <Modal isOpen={scanInitOpen} onClose={() => setScanInitOpen(false)} title="Start Shelf Scanning Session">
          <form onSubmit={startScanningSession} className="space-y-4 text-[13px]">
            <p className="text-[#122222]/60 dark:text-white/60">Define the physical shelf location you are about to scan. Misplaced books found will be automatically reassigned to this location.</p>
            <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 block"><span>Shelf Code <span className="text-red-500">*</span></span>
              <Input 
                value={targetShelf} 
                onChange={(e) => setTargetShelf(e.target.value)} 
                placeholder="e.g. A-12 or B-04" 
                required 
                className="mt-1"
              />
            </label>
            <div className="flex gap-2 justify-end pt-4 border-t border-black/5 dark:border-white/5">
              <Button type="button" variant="ghost" onClick={() => setScanInitOpen(false)}>Cancel</Button>
              <Button type="submit">Begin Scan Session</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Active Scanning Session Modal Overlay */}
      {activeSession && (
        <Modal 
          isOpen={activeSession} 
          onClose={() => {}} // Block clicking outside to close
          title={`Active Scan: Shelf ${targetShelf}`}
        >
          <div className="space-y-6 text-[13px] flex flex-col max-h-[75vh]">
            <div className="flex justify-between items-center bg-[#fcfbf8] dark:bg-[#111d1a] p-4 rounded-xl border border-black/5 dark:border-white/5">
              <div>
                <span className="text-[10px] font-bold text-[#122222]/50 dark:text-white/50 uppercase block">Shelf target</span>
                <span className="text-[16px] font-bold text-[#1a4d40] dark:text-[#1b9277]">{targetShelf}</span>
              </div>
              <div className="flex gap-3 text-center">
                <div>
                  <span className="text-[10px] font-bold text-[#122222]/50 dark:text-white/50 uppercase block">Found</span>
                  <span className="text-[14px] font-bold text-[#1a4d40]">{scannedItems.filter(i => i.result === 'found').length}</span>
                </div>
                <div className="w-px bg-black/10 dark:bg-white/10" />
                <div>
                  <span className="text-[10px] font-bold text-[#122222]/50 dark:text-white/50 uppercase block">Misplaced</span>
                  <span className="text-[14px] font-bold text-[#b96f3e]">{scannedItems.filter(i => i.result === 'misplaced').length}</span>
                </div>
                <div className="w-px bg-black/10 dark:bg-white/10" />
                <div>
                  <span className="text-[10px] font-bold text-[#122222]/50 dark:text-white/50 uppercase block">Unknown</span>
                  <span className="text-[14px] font-bold text-red-500">{scannedItems.filter(i => i.result === 'unknown').length}</span>
                </div>
              </div>
            </div>

            {/* Scanning Form */}
            <form onSubmit={handleBarcodeSubmit} className="flex gap-2">
              <input 
                ref={scanInputRef}
                type="text"
                placeholder="Scan or enter book barcode..."
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                className="flex-1 bg-white dark:bg-[#1d2926] border border-black/15 dark:border-white/15 rounded-lg py-2.5 px-3 text-[14px] text-[#122222] dark:text-white outline-none focus:border-[#1a4d40]"
              />
              <Button type="submit">Submit</Button>
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
                      <div className="text-[11px] text-[#122222]/50 dark:text-white/50 font-mono mt-0.5">Barcode: {item.barcode}</div>
                    </div>
                    <div className="text-right">
                      {item.result === "found" && (
                        <span className="text-[11px] font-bold text-[#1a4d40] dark:text-[#1b9277] bg-emerald-500/10 px-2.5 py-1 rounded flex items-center gap-1">
                          <CheckIcon size={12}/> Correct Shelf
                        </span>
                      )}
                      {item.result === "misplaced" && (
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-bold text-[#b96f3e] bg-[#b96f3e]/10 px-2 py-0.5 rounded flex items-center gap-1">
                            <AlertIcon size={11}/> Misplaced (on {item.currentShelf})
                          </span>
                          <span className="text-[9px] text-[#b96f3e] block font-semibold">Will update to {targetShelf} on finish</span>
                        </div>
                      )}
                      {item.result === "unknown" && (
                        <span className="text-[11px] font-bold text-red-500 bg-red-500/10 px-2.5 py-1 rounded flex items-center gap-1">
                          <HelpIcon size={12}/> Unknown Item
                        </span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-[#122222]/40 dark:text-white/40 flex flex-col items-center justify-center">
                  <ScanIcon size={32} className="animate-pulse mb-3 opacity-60" />
                  <span>Ready to scan. Place cursor in input field and scan copies.</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-between items-center pt-4 border-t border-black/5 dark:border-white/5">
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => {
                  if (confirm("Discard all scanning progress in this session?")) {
                    setActiveSession(false);
                    setScannedItems([]);
                  }
                }}
                className="text-red-500 hover:bg-red-500/10"
              >
                Cancel Session
              </Button>
              <Button 
                onClick={() => finishSessionMutation.mutate()} 
                disabled={finishSessionMutation.isPending}
              >
                {finishSessionMutation.isPending ? "Updating library..." : `Finish & Update Locations (${scannedItems.filter(i => i.result === 'misplaced').length})`}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// Copy Editing Modal Component
function CopyEditModal({ copy, onClose }: { copy: Copy & { title: string }; onClose: () => void }) {
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
      toast.success("Copy details updated.");
      onClose();
    },
    onError: (err: any) => toast.error(err.message)
  });

  return (
    <Modal isOpen={true} onClose={onClose} title={`Edit Copy: ${copy.barcode}`}>
      <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
        <div>
          <p className="text-xs text-ink/40 dark:text-parchment/40 uppercase tracking-wider font-semibold">Title</p>
          <p className="text-sm font-semibold mt-0.5">{copy.title}</p>
        </div>
        
        <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 block">Shelf Location (Code)
          <Input {...form.register("shelf")} placeholder="e.g. A-12" />
        </label>

        <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 block">Condition
          <select {...form.register("condition")} className="field-select text-[13px] py-2 px-3">
            <option value="good">Good</option>
            <option value="fair">Fair</option>
            <option value="poor">Poor</option>
            <option value="damaged">Damaged</option>
          </select>
        </label>

        <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 block">Status
          <select {...form.register("status")} className="field-select text-[13px] py-2 px-3">
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
