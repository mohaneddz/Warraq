import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ScanLine, AlertTriangle, ArrowRight, X, CheckCircle2, RotateCw } from "lucide-react";
import { 
  members, copies, loans, checkout, returnCopies, renewLoan 
} from "../data/repositories/library";
import { useUiStore } from "../store/uiStore";
import { queryClient } from "../app/providers";
import { toast } from "sonner";
import { daysLate, formatDisplayDate } from "../utils/dates";
import { cleanBarcode } from "../utils/isbn";
import { formatDisplayCurrency } from "../utils/currency";
import type { Member, Copy } from "../types";
import { useTranslation } from "react-i18next";

const invalidate = () => queryClient.invalidateQueries();

export function CirculationPage() {
  const { t } = useTranslation();
  const prefs = useUiStore((state) => state.preferences);
  const [scanInput, setScanInput] = useState("");
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [scannedCopies, setScannedCopies] = useState<(Copy & { title: string })[]>([]);
  const [manualCopyInput, setManualCopyInput] = useState("");

  // Queries
  const memberQuery = useQuery({ queryKey: ["members-all-circ"], queryFn: () => members() });
  const copyQuery = useQuery({ queryKey: ["copies-all-circ"], queryFn: () => copies() });
  const loanQuery = useQuery({ queryKey: ["loans-open-circ"], queryFn: () => loans(true) });

  // Get active loans of currently selected member
  const activeLoansForMember = useMemo(() => {
    if (!selectedMember || !loanQuery.data) return [];
    return loanQuery.data.filter(l => l.member_id === selectedMember.id);
  }, [selectedMember, loanQuery.data]);

  // Mutations
  const checkoutMutation = useMutation({
    mutationFn: () => checkout(
      selectedMember!.id, 
      scannedCopies.map(c => c.id), 
      prefs.loanLimit, 
      prefs.loanDays
    ),
    onSuccess: () => {
      invalidate();
      toast.success("Checkout completed successfully.");
      setScannedCopies([]);
    },
    onError: (err) => toast.error(err.message)
  });

  const returnMutation = useMutation({
    mutationFn: (copyIds: string[]) => returnCopies(copyIds, prefs.reservationHoldDays),
    onSuccess: () => {
      invalidate();
      toast.success("Item(s) returned successfully.");
    },
    onError: (err) => toast.error(err.message)
  });

  const renewMutation = useMutation({
    mutationFn: (loanId: string) => renewLoan(loanId, prefs.loanDays),
    onSuccess: () => {
      invalidate();
      toast.success("Loan renewed.");
    },
    onError: (err) => toast.error(err.message)
  });

  // Handle main scanner submit
  const handleScannerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = scanInput.trim().toUpperCase();
    if (!val) return;

    // 1. Check if input matches a member by number or name
    const foundMember = memberQuery.data?.find(
      m => m.member_number.toUpperCase() === val || 
           m.full_name.toUpperCase() === val
    );

    if (foundMember) {
      if (foundMember.status !== "active") {
        toast.error(`Member "${foundMember.full_name}" is currently ${foundMember.status}.`);
        return;
      }
      setSelectedMember(foundMember);
      toast.success(`Active session started for: ${foundMember.full_name}`);
      setScanInput("");
      return;
    }

    // 2. Check if input matches a copy barcode/accession that is currently checked out (return flow)
    const activeLoan = loanQuery.data?.find(
      l => l.barcode?.toUpperCase() === val
    );

    if (activeLoan) {
      returnMutation.mutate([activeLoan.copy_id]);
      toast.success(`Returned "${activeLoan.title}" (borrower: ${activeLoan.member_name})`);
      setScanInput("");
      return;
    }

    // 3. Check if input matches an available copy (checkout flow)
    const foundCopy = copyQuery.data?.find(
      c => c.barcode.toUpperCase() === val || 
           c.accession_number.toUpperCase() === val
    );

    if (foundCopy) {
      if (foundCopy.status !== "available") {
        toast.error(`Copy ${foundCopy.barcode} is not available (status: ${foundCopy.status}).`);
        setScanInput("");
        return;
      }
      if (!selectedMember) {
        toast.error("Please select or scan a member card first before checking out items.");
        setScanInput("");
        return;
      }
      // Add copy to pending list if not already there
      if (scannedCopies.some(c => c.id === foundCopy.id)) {
        toast.warning("Copy is already in the pending checkout list.");
      } else {
        setScannedCopies([...scannedCopies, foundCopy]);
        toast.info(`Added "${foundCopy.title}" to pending checkout list.`);
      }
      setScanInput("");
      return;
    }

    toast.error(`"${val}" not recognized as a member number or copy barcode.`);
    setScanInput("");
  };

  const addManualCopy = (e: React.FormEvent) => {
    e.preventDefault();
    const barcode = cleanBarcode(manualCopyInput);
    if (!barcode) return;
    const foundCopy = copyQuery.data?.find(
      c => c.barcode.toUpperCase() === barcode || 
           c.accession_number.toUpperCase() === barcode
    );
    if (!foundCopy) {
      toast.error(`Barcode "${barcode}" not found.`);
      return;
    }
    if (foundCopy.status !== "available") {
      toast.error(`Copy is not available (status: ${foundCopy.status}).`);
      return;
    }
    if (scannedCopies.some(c => c.id === foundCopy.id)) {
      toast.warning("Copy is already in checkout list.");
      return;
    }
    setScannedCopies([...scannedCopies, foundCopy]);
    toast.info(`Added "${foundCopy.title}" to pending checkout list.`);
    setManualCopyInput("");
  };

  const removePendingCopy = (id: string) => {
    setScannedCopies(scannedCopies.filter(c => c.id !== id));
  };

  return (
    <div className="flex flex-col gap-6 h-full w-full">
      {/* Header */}
      <div>
        <h1 className="font-display text-[28px] font-bold text-[#122222] dark:text-white leading-tight">{t("circulation.title")}</h1>
      </div>

      {/* Main Scanner Bar */}
      <form onSubmit={handleScannerSubmit} className="flex gap-4">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-[#122222]/40">
            <ScanLine size={20} />
          </div>
          <input 
            type="text"
            placeholder={t("circulation.placeholder")}
            value={scanInput}
            onChange={(e) => setScanInput(e.target.value)}
            className="w-full bg-white dark:bg-[#1d2926] border border-black/5 dark:border-white/5 rounded-2xl py-4 pl-12 pr-4 text-[15px] text-[#122222] dark:text-white outline-none focus:border-emerald focus:ring-2 focus:ring-emerald/20 transition-all font-semibold shadow-card"
            autoFocus
          />
        </div>
        <button type="submit" className="bg-emerald text-white rounded-2xl px-8 font-bold text-[14px] hover:bg-emerald/90 transition-colors shadow-sm shadow-emerald/20 cursor-pointer">
          {t("search")}
        </button>
        {selectedMember && (
          <button 
            type="button"
            onClick={() => {
              setSelectedMember(null);
              setScannedCopies([]);
            }}
            className="border-2 border-red-500/20 text-red-500 rounded-2xl px-6 font-bold text-[14px] hover:bg-red-500/10 transition-colors cursor-pointer"
          >
            End Session
          </button>
        )}
      </form>

      {selectedMember ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Left Column: Member Info & Active Loans */}
          <div className="flex flex-col gap-6">
            <div className="bg-[#fcfbf8] dark:bg-[#111d1a] border border-emerald/20 rounded-2xl p-6 relative overflow-hidden">
               {/* Decorative background */}
               <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-emerald/5 to-transparent pointer-events-none" />
               
               <div className="flex items-start justify-between mb-4 relative z-10">
                 <div className="flex items-center gap-4">
                   <div className="w-14 h-14 bg-[#122222] text-white rounded-full flex items-center justify-center text-[20px] font-bold shadow-sm">
                     {selectedMember.full_name.substring(0, 2).toUpperCase()}
                   </div>
                   <div>
                     <h2 className="text-[18px] font-bold text-[#122222] dark:text-white">{selectedMember.full_name}</h2>
                     <p className="text-[13px] font-semibold text-emerald dark:text-emerald-light">{selectedMember.role || "Patron"} • {selectedMember.department || "General"}</p>
                   </div>
                 </div>
                 <div className="text-right">
                   <div className="text-[11px] font-bold text-[#122222]/50 dark:text-white/50 uppercase tracking-wider">{t("circulation.memberId")}</div>
                   <div className="text-[14px] font-mono font-semibold text-[#122222] dark:text-white mt-0.5">{selectedMember.member_number}</div>
                 </div>
               </div>
               
               <div className="flex items-center gap-6 pt-4 border-t border-black/5 dark:border-white/5 relative z-10">
                 <div>
                   <div className="text-[11px] font-bold text-[#122222]/50 dark:text-white/50 uppercase">{t("status")}</div>
                   <div className="flex items-center gap-1.5 text-[13px] font-bold text-emerald-600 mt-1">
                     <CheckCircle2 size={14}/> {t("members.active")}
                   </div>
                 </div>
                 <div>
                   <div className="text-[11px] font-bold text-[#122222]/50 dark:text-white/50 uppercase">{t("circulation.limit")}</div>
                   <div className="text-[13px] font-bold text-[#122222] dark:text-white mt-1">{activeLoansForMember.length} / {prefs.loanLimit} {t("circulation.items", { count: prefs.loanLimit })}</div>
                 </div>
               </div>
            </div>

            <div>
              <h3 className="font-bold text-[16px] text-[#122222] dark:text-white mb-4">{t("circulation.activeLoansCount", { count: activeLoansForMember.length })}</h3>
              <div className="space-y-3">
                {activeLoansForMember.length > 0 ? (
                  activeLoansForMember.map((loan) => {
                    const overdueDays = daysLate(loan.due_at);
                    const overdue = overdueDays > 0;
                    const hasGrace = prefs.gracePeriodEnabled && overdueDays <= prefs.gracePeriodDays;
                    const fineAmount = (prefs.finesEnabled && overdue && !hasGrace)
                      ? Math.min(overdueDays * prefs.finePerDay, prefs.maxFineAmount)
                      : 0;
                    const renewDisabled = loan.renewed_count >= prefs.renewLimit;

                    return (
                      <div key={loan.id} className="bg-white dark:bg-[#1d2926] p-4 rounded-xl border border-black/5 dark:border-white/5 shadow-sm flex items-center justify-between group hover:border-emerald/20 transition-colors">
                        <div className="flex items-start gap-3 min-w-0 flex-1 pr-4">
                          <div className="w-8 h-10 bg-[#122222] rounded flex items-center justify-center shrink-0 overflow-hidden relative">
                             <div className="absolute left-0.5 top-0 bottom-0 w-0.5 bg-white/20" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="text-[13px] font-bold text-[#122222] dark:text-white leading-tight truncate">{loan.title}</h4>
                            <p className="text-[11px] text-[#122222]/50 dark:text-white/50 mt-0.5">{t("circulation.barcode")}: {loan.barcode}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-[10px] flex items-center gap-1 font-bold ${overdue ? "text-red-500" : "text-[#122222]/60 dark:text-white/60"}`}>
                                {overdue && <AlertTriangle size={10} />}
                                {t("circulation.due")}: {formatDisplayDate(loan.due_at)} {overdue && `(${t("circulation.daysOverdue", { count: overdueDays })})`}
                              </span>
                              {fineAmount > 0 && (
                                <span className="text-[10px] bg-red-500/10 text-red-500 font-bold px-2 py-0.5 rounded">
                                  {t("circulation.fine")}: {formatDisplayCurrency(fineAmount)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button 
                            onClick={() => renewMutation.mutate(loan.id)}
                            disabled={renewMutation.isPending || renewDisabled}
                            className="h-8 px-3 rounded-lg bg-[#fcfbf8] dark:bg-[#111d1a] border border-black/10 dark:border-white/10 text-[11px] font-bold text-[#122222] dark:text-white hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            title={renewDisabled ? "Renewal limit reached" : undefined}
                          >
                            <RotateCw size={12} /> {renewDisabled ? "Limit reached" : `${t("circulation.renew")} (${loan.renewed_count}/${prefs.renewLimit})`}
                          </button>
                          <button 
                            onClick={() => returnMutation.mutate([loan.copy_id])}
                            disabled={returnMutation.isPending}
                            className="h-8 px-3 rounded-lg bg-emerald/10 text-emerald dark:bg-emerald-light/10 dark:text-emerald-light border border-emerald/20 text-[11px] font-bold hover:bg-emerald/20 transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <CheckCircle2 size={12} /> {t("circulation.return")}
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-center text-[13px] text-[#122222]/50 py-4">{t("circulation.noActiveLoans")}</p>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Checkout Session */}
          <div className="bg-white dark:bg-[#1d2926] rounded-2xl shadow-card border border-black/5 dark:border-white/5 flex flex-col min-h-[500px]">
            <div className="p-6 border-b border-black/5 dark:border-white/5 bg-[#fcfbf8] dark:bg-[#111d1a] rounded-t-2xl">
              <h3 className="font-bold text-[16px] text-[#122222] dark:text-white mb-1">{t("circulation.checkoutNew")}</h3>
              <p className="text-[13px] text-[#122222]/60 dark:text-white/60">{t("circulation.checkoutSub")}</p>
            </div>
            
            <div className="flex-1 p-6 flex flex-col gap-4">
              {/* Scanned Items List */}
              <div className="flex-1 space-y-3 overflow-y-auto max-h-[300px]">
                {scannedCopies.length > 0 ? (
                  scannedCopies.map((copy) => (
                    <div key={copy.id} className="flex items-center justify-between p-3 rounded-xl border border-emerald/20 bg-emerald/5 dark:bg-emerald-light/5">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className="w-8 h-10 bg-[#122222] rounded flex items-center justify-center shrink-0 overflow-hidden relative">
                           <div className="absolute left-0.5 top-0 bottom-0 w-0.5 bg-white/20" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-[13px] font-bold text-[#122222] dark:text-white leading-tight truncate">{copy.title}</h4>
                          <p className="text-[11px] text-[#122222]/50 dark:text-white/50 mt-0.5">{t("circulation.barcode")}: {copy.barcode}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => removePendingCopy(copy.id)}
                        className="w-8 h-8 rounded-lg text-[#122222]/40 dark:text-white/40 hover:bg-black/5 dark:hover:bg-white/5 hover:text-red-500 flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center py-10 text-[#122222]/40">
                     <ScanLine size={32} className="mb-2 opacity-50" />
                     <p className="text-[13px]">No copies scanned yet. Use scanner or manual entry below.</p>
                  </div>
                )}
              </div>

              {/* Input for manual entry if needed */}
              <form onSubmit={addManualCopy} className="relative mt-4 flex gap-2">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-emerald">
                    <ScanLine size={16} />
                  </div>
                  <input 
                    type="text"
                    placeholder="Enter copy barcode..."
                    value={manualCopyInput}
                    onChange={(e) => setManualCopyInput(e.target.value)}
                    className="w-full bg-[#fcfbf8] dark:bg-[#111d1a] border border-black/10 dark:border-white/10 rounded-xl py-3 pl-10 pr-4 text-[14px] text-[#122222] dark:text-white outline-none focus:border-emerald font-semibold"
                  />
                </div>
                <button type="submit" className="bg-emerald text-white rounded-xl px-4 font-bold text-[13px] cursor-pointer">Add</button>
              </form>
            </div>

            <div className="p-6 border-t border-black/5 dark:border-white/5 bg-[#fcfbf8] dark:bg-[#111d1a] rounded-b-2xl">
              <button 
                onClick={() => checkoutMutation.mutate()}
                disabled={scannedCopies.length === 0 || checkoutMutation.isPending}
                className="w-full bg-emerald text-white py-4 rounded-xl font-bold text-[15px] hover:bg-emerald/90 transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {checkoutMutation.isPending ? "Completing..." : `${t("circulation.completeCheckout")} (${scannedCopies.length} ${t("circulation.items", { count: scannedCopies.length })})`} <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="flex-1 flex flex-col items-center justify-center py-20 opacity-60">
          <div className="w-24 h-24 bg-black/5 dark:bg-white/5 rounded-full flex items-center justify-center text-[#122222]/40 dark:text-white/40 mb-6">
            <ScanLine size={40} />
          </div>
          <h2 className="text-[20px] font-bold text-[#122222] dark:text-white mb-2">Ready for circulation</h2>
          <p className="text-[14px] text-[#122222]/60 dark:text-white/60">{t("circulation.scanHelp")}</p>
        </div>
      )}
    </div>
  );
}
