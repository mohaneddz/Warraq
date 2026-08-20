import { useState, useMemo, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Search, Clock, Plus, RotateCcw, RefreshCw, BookOpen, Calendar, CheckCircle2,
  MapPin, Hash, Eye, Copy as CopyIcon, Globe, Building2, UserCheck, AlertTriangle,
  Check, X as XIcon, Undo2
} from "lucide-react";
import { useContextMenu } from "../components/ui/ContextMenu";

import {
  loans, returnCopies, renewLoan, updateLoanDueDate, members, copies, checkout
} from "../data/repositories/library";
import { useLibrarySettingsStore } from "../store/librarySettingsStore";
import { queryClient } from "../app/providers";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { formatDisplayDate } from "../utils/dates";
import { Modal, Button, ItemTypeBadge, PageLoader, DefaultCover, Spinner } from "../components/ui/primitives";
import type { Loan, LoanState, Member, Copy, ReservationScope } from "../types";
import { useThemedAsset } from "../utils/useThemedAsset";

const invalidate = () => queryClient.invalidateQueries();
const DAY_MS = 86_400_000;

/**
 * Where a loan sits relative to its due date. Overdue deliberately honours the configured
 * grace period rather than firing the moment due_at passes, so this screen agrees with the
 * dashboard's overdue count (which applies the same window server-side in dashboard_metrics).
 */
function loanState(loan: Loan, graceDays: number, dueSoonDays: number): LoanState {
  if (loan.returned_at) return "returned";
  const due = new Date(loan.due_at).getTime();
  const now = Date.now();
  if (now > due + graceDays * DAY_MS) return "overdue";
  if (dueSoonDays > 0 && due <= now + dueSoonDays * DAY_MS) return "dueSoon";
  return "active";
}

/** Whole days past due, ignoring grace — grace decides *when* to flag, not how late it reads. */
function daysOverdue(loan: Loan): number {
  const diff = Date.now() - new Date(loan.due_at).getTime();
  return diff <= 0 ? 0 : Math.floor(diff / DAY_MS);
}

function daysUntilDue(loan: Loan): number {
  const diff = new Date(loan.due_at).getTime() - Date.now();
  return diff <= 0 ? 0 : Math.ceil(diff / DAY_MS);
}

const STATE_STYLES: Record<LoanState, string> = {
  active: "bg-emerald/10 text-emerald dark:bg-emerald-light/20 dark:text-emerald-light",
  dueSoon: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  overdue: "bg-red-500/10 text-red-500",
  returned: "bg-gray-500/10 text-gray-500",
};

export function LoansPage() {
  const { t } = useTranslation();
  // Shared circulation empty-state illustration (no loans and no reservations are the same
  // "nothing is out" state visually); swap for a dedicated asset if one is ever drawn.
  const noLoansSrc = useThemedAsset("no-reservations");
  const location = useLocation();
  const settings = useLibrarySettingsStore((s) => s.settings);

  const graceDays = settings.grace_period_enabled ? (settings.grace_period_days ?? 0) : 0;
  const dueSoonDays = settings.notify_due_soon_days ?? 0;

  const [term, setTerm] = useState("");
  const [stateFilter, setStateFilter] = useState<"all" | LoanState>("all");
  const [sortBy, setSortBy] = useState("dueAsc");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("action") === "new-loan") {
      setIsAddModalOpen(true);
      const cleanUrl = window.location.hash ? window.location.hash.split("?")[0] : window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  }, [location.search]);

  const result = useQuery({ queryKey: ["loans"], queryFn: () => loans(false) });

  // Each loan's state is derived once here so the counts, the filter and the table row all
  // read from the same value instead of recomputing (and potentially disagreeing) three times.
  const withState = useMemo(
    () => (result.data ?? []).map((l) => ({ loan: l, state: loanState(l, graceDays, dueSoonDays) })),
    [result.data, graceDays, dueSoonDays]
  );

  const counts = useMemo(() => {
    const c = { all: withState.length, active: 0, dueSoon: 0, overdue: 0, returned: 0 };
    withState.forEach(({ state }) => { c[state]++; });
    return c;
  }, [withState]);

  const filtered = useMemo(() => {
    const q = term.trim().toLowerCase();
    const rows = withState.filter(({ loan, state }) => {
      if (stateFilter !== "all" && state !== stateFilter) return false;
      if (!q) return true;
      return (
        loan.title?.toLowerCase().includes(q) ||
        loan.author?.toLowerCase().includes(q) ||
        loan.member_name?.toLowerCase().includes(q) ||
        loan.member_number?.toLowerCase().includes(q) ||
        loan.barcode?.toLowerCase().includes(q) ||
        loan.copy_shelf?.toLowerCase().includes(q)
      );
    });

    const byDue = (a: Loan, b: Loan) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
    const byBorrowed = (a: Loan, b: Loan) => new Date(a.borrowed_at).getTime() - new Date(b.borrowed_at).getTime();
    const sorted = [...rows];
    sorted.sort((x, y) => {
      switch (sortBy) {
        case "dueDesc": return byDue(y.loan, x.loan);
        case "borrowedAsc": return byBorrowed(x.loan, y.loan);
        case "borrowedDesc": return byBorrowed(y.loan, x.loan);
        case "member": return (x.loan.member_name ?? "").localeCompare(y.loan.member_name ?? "");
        case "title": return (x.loan.title ?? "").localeCompare(y.loan.title ?? "");
        default: return byDue(x.loan, y.loan);
      }
    });
    return sorted;
  }, [withState, term, stateFilter, sortBy]);

  // Bulk actions only ever apply to still-open loans; a returned loan can't be returned or
  // renewed again, and silently skipping them is less confusing than a partial-failure toast.
  const openSelected = useMemo(
    () => filtered.filter(({ loan }) => selectedIds.includes(loan.id) && !loan.returned_at).map(({ loan }) => loan),
    [filtered, selectedIds]
  );

  const returnMutation = useMutation({
    mutationFn: (copyIds: string[]) => returnCopies(copyIds),
    onSuccess: (_d, copyIds) => {
      invalidate();
      setSelectedIds([]);
      setSelectedLoan(null);
      toast.success(t("loans.alerts.returned", { count: copyIds.length, defaultValue: "Item returned." }));
    },
    onError: (err: any) => toast.error(err.message || t("loans.alerts.returnFailed", "Failed to return item.")),
  });

  const renewMutation = useMutation({
    mutationFn: (loanId: string) => renewLoan(loanId),
    onSuccess: () => {
      invalidate();
      toast.success(t("loans.alerts.renewed", "Loan renewed."));
    },
    onError: (err: any) => toast.error(err.message || t("loans.alerts.renewFailed", "Failed to renew loan.")),
  });

  const bulkRenewMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      // Sequential, not Promise.all: renew_loan enforces renew_limit per loan and a rejected
      // one must not abort the rest. Failures are collected and reported together.
      const failures: string[] = [];
      for (const id of ids) {
        try { await renewLoan(id); } catch (e: any) { failures.push(e?.message ?? "unknown error"); }
      }
      return failures;
    },
    onSuccess: (failures, ids) => {
      invalidate();
      setSelectedIds([]);
      const ok = ids.length - failures.length;
      if (ok > 0) toast.success(t("loans.alerts.bulkRenewed", { count: ok, defaultValue: `${ok} loan(s) renewed.` }));
      if (failures.length > 0) {
        toast.error(t("loans.alerts.bulkRenewPartial", {
          count: failures.length,
          reason: failures[0],
          defaultValue: `${failures.length} could not be renewed: ${failures[0]}`,
        }));
      }
    },
    onError: (err: any) => toast.error(err.message),
  });

  const dueDateMutation = useMutation({
    mutationFn: ({ id, dueAt }: { id: string; dueAt: string }) => updateLoanDueDate(id, dueAt),
    onSuccess: () => {
      invalidate();
      toast.success(t("loans.alerts.dueUpdated", "Due date updated."));
    },
    onError: (err: any) => toast.error(err.message || t("loans.alerts.dueUpdateFailed", "Failed to update due date.")),
  });

  const { showContextMenu } = useContextMenu();

  const handleContextMenu = (e: React.MouseEvent, loan: Loan) => {
    showContextMenu(e, [
      {
        id: "return-loan",
        label: t("loans.returnItem", "Return Item"),
        icon: RotateCcw,
        hidden: !!loan.returned_at,
        variant: "success",
        onClick: () => returnMutation.mutate([loan.copy_id]),
      },
      {
        id: "renew-loan",
        label: t("loans.renewLoan", "Renew Loan"),
        icon: RefreshCw,
        hidden: !!loan.returned_at,
        onClick: () => renewMutation.mutate(loan.id),
      },
      { divider: true },
      {
        id: "view-loan",
        label: t("loans.viewDetails", "View Loan Details"),
        icon: Eye,
        onClick: () => setSelectedLoan(loan),
      },
      {
        id: "copy-member",
        label: t("loans.copyMember", "Copy Member Name"),
        icon: CopyIcon,
        hidden: !loan.member_name,
        onClick: () => {
          navigator.clipboard.writeText(loan.member_name ?? "");
          toast.success(t("loans.copiedMember", "Member name copied"));
        },
      },
      {
        id: "copy-barcode",
        label: t("loans.copyBarcode", "Copy Barcode"),
        icon: CopyIcon,
        hidden: !loan.barcode,
        onClick: () => {
          navigator.clipboard.writeText(loan.barcode ?? "");
          toast.success(t("loans.copiedBarcode", "Barcode copied"));
        },
      },
    ], { title: loan.title || "Loan" });
  };

  const stateLabel = (s: LoanState) => ({
    active: t("loans.state.active", "On Loan"),
    dueSoon: t("loans.state.dueSoon", "Due Soon"),
    overdue: t("loans.state.overdue", "Overdue"),
    returned: t("loans.state.returned", "Returned"),
  }[s]);

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="font-display text-[28px] font-bold text-[#122222] dark:text-white leading-tight">
            {t("loans.title", "Loans")}
          </h1>
          <p className="text-[13px] text-[#122222]/60 dark:text-white/60">
            {t("loans.subtitle", "Every item currently out, overdue, or returned.")}
          </p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 bg-emerald text-white px-4 py-2 rounded-xl text-[13px] font-semibold hover:bg-emerald/90 transition shadow-sm cursor-pointer"
        >
          <Plus size={16} />
          {t("loans.newLoan", "New Loan")}
        </button>
      </div>

      {/* Main Panel */}
      <div className="flex-1 bg-white dark:bg-[#1d2926] border border-black/5 dark:border-white/5 rounded-2xl flex flex-col shadow-card overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-black/5 dark:border-white/5 flex flex-wrap items-center gap-3 bg-[#fcfbf8] dark:bg-[#111d1a]">
          <div className="flex-1 min-w-[220px] max-w-sm relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#122222]/40 dark:text-white/40" />
            <input
              type="text"
              placeholder={t("loans.searchPlaceholder", "Search title, member, barcode, shelf...")}
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              className="w-full bg-white dark:bg-[#1d2926] border border-black/10 dark:border-white/10 rounded-lg py-2 pl-9 pr-3 text-[13px] text-[#122222] dark:text-[#f0ebe1] outline-none focus:border-emerald focus:ring-1 focus:ring-emerald"
            />
          </div>

          {/* Quick Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 text-[12px] font-semibold select-none">
            <FilterPill
              label={t("loans.filters.all", "All")}
              count={counts.all}
              active={stateFilter === "all"}
              onClick={() => setStateFilter("all")}
              tone="neutral"
            />
            <FilterPill
              label={t("loans.state.active", "On Loan")}
              count={counts.active}
              active={stateFilter === "active"}
              onClick={() => setStateFilter("active")}
              tone="emerald"
            />
            <FilterPill
              label={t("loans.state.dueSoon", "Due Soon")}
              count={counts.dueSoon}
              active={stateFilter === "dueSoon"}
              onClick={() => setStateFilter("dueSoon")}
              tone="amber"
            />
            <FilterPill
              label={t("loans.state.overdue", "Overdue")}
              count={counts.overdue}
              active={stateFilter === "overdue"}
              onClick={() => setStateFilter("overdue")}
              tone="red"
            />
            <FilterPill
              label={t("loans.state.returned", "Returned")}
              count={counts.returned}
              active={stateFilter === "returned"}
              onClick={() => setStateFilter("returned")}
              tone="neutral"
            />
          </div>

          {/* Sort */}
          <div className="ml-auto relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              aria-label={t("loans.sortBy", "Sort by") as string}
              className="appearance-none bg-white dark:bg-[#1d2926] border border-black/10 dark:border-white/10 rounded-lg py-2 pl-3 pr-8 text-[13px] font-semibold text-[#122222]/70 dark:text-white/70 outline-none cursor-pointer hover:border-emerald/30 transition-colors"
            >
              <option value="dueAsc">{t("loans.sort.dueAsc", "Due date (soonest)")}</option>
              <option value="dueDesc">{t("loans.sort.dueDesc", "Due date (latest)")}</option>
              <option value="borrowedDesc">{t("loans.sort.borrowedDesc", "Borrowed (newest)")}</option>
              <option value="borrowedAsc">{t("loans.sort.borrowedAsc", "Borrowed (oldest)")}</option>
              <option value="member">{t("loans.sort.member", "Member name")}</option>
              <option value="title">{t("loans.sort.title", "Title")}</option>
            </select>
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#122222]/40 dark:text-white/40">
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {result.isLoading ? (
            <PageLoader label={t("loans.loading", "Loading loans…")} />
          ) : filtered.length ? (
            <table className="w-full table-fixed text-left text-[13px]">
              <thead className="bg-[#fcfbf8] dark:bg-[#111d1a] sticky top-0 border-b border-black/5 dark:border-white/5 text-[11px] font-bold text-[#122222]/50 dark:text-white/50 uppercase tracking-wider select-none">
                <tr>
                  <th className="px-6 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={filtered.length > 0 && selectedIds.length === filtered.length}
                      onChange={(e) => setSelectedIds(e.target.checked ? filtered.map(({ loan }) => loan.id) : [])}
                      className="cursor-pointer rounded border-black/25 dark:border-white/25 text-emerald focus:ring-emerald h-4 w-4"
                    />
                  </th>
                  <th className="px-6 py-3 w-[24%]">{t("catalog.headers.title")}</th>
                  <th className="px-6 py-3 w-[16%]">{t("circulation.selectedMember")}</th>
                  <th className="px-6 py-3 w-[15%]">{t("circulation.barcode", "Barcode")}</th>
                  <th className="px-6 py-3 w-[12%]">{t("loans.borrowedDate", "Borrowed")}</th>
                  <th className="px-6 py-3 w-[13%]">{t("circulation.due", "Due")}</th>
                  <th className="px-6 py-3 w-[11%]">{t("status")}</th>
                  <th className="px-6 py-3 w-24">{t("actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/5">
                {filtered.map(({ loan, state }) => (
                  <tr
                    key={loan.id}
                    onClick={() => setSelectedLoan(loan)}
                    onContextMenu={(e) => handleContextMenu(e, loan)}
                    className={`hover:bg-black/5 dark:hover:bg-white/5 transition-colors group cursor-pointer ${
                      selectedIds.includes(loan.id) ? "bg-emerald/5 dark:bg-emerald-light/5" : ""
                    }`}
                  >
                    <td className="px-6 py-3 w-10" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(loan.id)}
                        onChange={(e) =>
                          setSelectedIds((prev) =>
                            e.target.checked ? [...prev, loan.id] : prev.filter((id) => id !== loan.id)
                          )
                        }
                        className="cursor-pointer rounded border-black/25 dark:border-white/25 text-emerald focus:ring-emerald h-4 w-4"
                      />
                    </td>

                    <td className="px-6 py-3 font-semibold text-[#122222] dark:text-white">
                      <div className="flex items-center gap-3 min-w-0">
                        {loan.cover_path ? (
                          <img src={loan.cover_path} alt="" className="w-8 h-11 object-cover rounded shadow-sm shrink-0" />
                        ) : (
                          <DefaultCover type={loan.item_type} className="w-8 h-11 shrink-0" iconSize={15} />
                        )}
                        <div className="min-w-0">
                          <div className="truncate" title={loan.title || ""}>{loan.title || "—"}</div>
                          {loan.author && (
                            <div className="text-[11px] font-medium text-[#122222]/50 dark:text-white/50 truncate">{loan.author}</div>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-3 text-[#122222]/70 dark:text-white/70">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {loan.member_avatar ? (
                          <img src={loan.member_avatar} alt="" className="w-8 h-8 rounded-full object-cover shadow-sm shrink-0 border border-black/10 dark:border-white/10" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-emerald/10 text-emerald dark:bg-emerald-light/10 dark:text-emerald-light font-bold text-[12px] flex items-center justify-center shrink-0">
                            {loan.member_name?.charAt(0).toUpperCase() || "M"}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-semibold text-[#122222] dark:text-white truncate" title={loan.member_name || ""}>
                            {loan.member_name || "—"}
                          </div>
                          {loan.member_number && (
                            <div className="text-[11px] font-mono text-[#122222]/50 dark:text-white/50 truncate">{loan.member_number}</div>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-3 text-[#122222]/70 dark:text-white/70">
                      {loan.barcode ? (
                        <div className="flex items-center gap-1.5 font-mono text-[12px] font-medium text-emerald dark:text-emerald-light min-w-0">
                          <Hash size={13} className="opacity-60 shrink-0" />
                          <span className="truncate" title={loan.barcode}>{loan.barcode}</span>
                          {loan.copy_shelf && (
                            <span className="text-[10px] bg-emerald/10 text-emerald dark:bg-emerald-light/20 dark:text-emerald-light px-2 py-0.5 rounded font-semibold flex items-center gap-1 ml-1 shrink-0">
                              <MapPin size={10} />
                              {loan.copy_shelf}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="opacity-40">—</span>
                      )}
                    </td>

                    <td className="px-6 py-3 text-[#122222]/70 dark:text-white/70">
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <Clock size={14} className="opacity-50 shrink-0" />
                        <span className="truncate">{formatDisplayDate(loan.borrowed_at)}</span>
                      </div>
                    </td>

                    <td className="px-6 py-3">
                      <div className={`flex items-center gap-2 whitespace-nowrap font-medium ${
                        state === "overdue" ? "text-red-500"
                          : state === "dueSoon" ? "text-amber-600 dark:text-amber-400"
                          : "text-[#122222]/70 dark:text-white/70"
                      }`}>
                        <Calendar size={14} className="opacity-70 shrink-0" />
                        <span className="truncate">{formatDisplayDate(loan.due_at)}</span>
                      </div>
                      {state === "overdue" && (
                        <div className="text-[10.5px] font-bold text-red-500 mt-0.5">
                          {t("circulation.daysOverdue", { count: daysOverdue(loan), defaultValue: `${daysOverdue(loan)} days overdue` })}
                        </div>
                      )}
                      {state === "dueSoon" && (
                        <div className="text-[10.5px] font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                          {t("loans.dueInDays", { count: daysUntilDue(loan), defaultValue: `Due in ${daysUntilDue(loan)} day(s)` })}
                        </div>
                      )}
                    </td>

                    <td className="px-6 py-3 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-[4px] text-[11px] font-bold ${STATE_STYLES[state]}`}>
                        {stateLabel(state)}
                      </span>
                      {loan.renewed_count > 0 && (
                        <div className="text-[10px] font-semibold text-[#122222]/45 dark:text-white/45 mt-1">
                          {t("loans.renewedTimes", { count: loan.renewed_count, defaultValue: `Renewed ${loan.renewed_count}×` })}
                        </div>
                      )}
                    </td>

                    <td className="px-6 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        {!loan.returned_at && (
                          <>
                            <button
                              title={t("loans.returnItem", "Return Item") as string}
                              onClick={() => returnMutation.mutate([loan.copy_id])}
                              disabled={returnMutation.isPending}
                              className="p-1.5 rounded-lg text-emerald hover:bg-emerald/10 cursor-pointer transition-colors disabled:opacity-40"
                            >
                              <RotateCcw size={15} />
                            </button>
                            <button
                              title={t("loans.renewLoan", "Renew Loan") as string}
                              onClick={() => renewMutation.mutate(loan.id)}
                              disabled={renewMutation.isPending}
                              className="p-1.5 rounded-lg text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 cursor-pointer transition-colors disabled:opacity-40"
                            >
                              <RefreshCw size={15} />
                            </button>
                          </>
                        )}
                        <button
                          title={t("loans.viewDetails", "View Loan Details") as string}
                          onClick={() => setSelectedLoan(loan)}
                          className="p-1.5 rounded-lg text-[#122222]/50 dark:text-white/50 hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer transition-colors"
                        >
                          <Eye size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
              <img src={noLoansSrc} alt="" aria-hidden="true" className="h-72 w-auto object-contain mb-3 opacity-90" />
              <h2 className="text-[20px] font-bold text-[#122222] dark:text-white mb-2">
                {term || stateFilter !== "all"
                  ? t("loans.noMatches", "No loans match these filters")
                  : t("loans.noLoans", "No loans yet")}
              </h2>
              <p className="text-[14px] text-[#122222]/60 dark:text-white/60">
                {term || stateFilter !== "all"
                  ? t("loans.noMatchesHelp", "Try a different search or clear the filter.")
                  : t("loans.noLoansHelp", "Check an item out to a member to start tracking it here.")}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/95 dark:bg-[#1d2926]/95 backdrop-blur-md px-6 py-3 rounded-2xl border border-black/10 dark:border-white/10 shadow-2xl flex items-center gap-5 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <span className="text-[13px] font-semibold text-[#122222] dark:text-white shrink-0">
            {t("loans.bulk.selectedCount", { count: selectedIds.length, defaultValue: `${selectedIds.length} selected` })}
          </span>
          <div className="h-4 w-px bg-black/10 dark:bg-white/10" />
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setSelectedIds(filtered.map(({ loan }) => loan.id))}
              className="text-[12px] font-bold text-emerald dark:text-emerald-light hover:underline px-2 py-1 cursor-pointer"
            >
              {t("catalog.bulk.selectAll", "Select All")}
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="text-[12px] font-bold text-[#122222]/60 dark:text-white/60 hover:underline px-2 py-1 cursor-pointer"
            >
              {t("catalog.bulk.deselectAll", "Deselect All")}
            </button>

            <div className="h-4 w-px bg-black/10 dark:bg-white/10 mx-1" />

            <button
              disabled={openSelected.length === 0 || returnMutation.isPending}
              onClick={() => {
                if (confirm(t("loans.alerts.confirmBulkReturn", { count: openSelected.length, defaultValue: `Return ${openSelected.length} item(s)?` }) as string)) {
                  returnMutation.mutate(openSelected.map((l) => l.copy_id));
                }
              }}
              className="flex items-center gap-1.5 text-[12px] font-bold bg-emerald hover:bg-emerald/90 text-white px-3 py-1.5 rounded-xl shadow-sm transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RotateCcw size={13} />
              {t("loans.bulk.return", "Return")} ({openSelected.length})
            </button>

            <button
              disabled={openSelected.length === 0 || bulkRenewMutation.isPending}
              onClick={() => {
                if (confirm(t("loans.alerts.confirmBulkRenew", { count: openSelected.length, defaultValue: `Renew ${openSelected.length} loan(s)?` }) as string)) {
                  bulkRenewMutation.mutate(openSelected.map((l) => l.id));
                }
              }}
              className="flex items-center gap-1.5 text-[12px] font-bold bg-emerald/15 text-emerald dark:bg-emerald-light/20 dark:text-emerald-light border border-emerald/30 hover:bg-emerald/25 px-3 py-1.5 rounded-xl transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RefreshCw size={13} />
              {t("loans.bulk.renew", "Renew")} ({openSelected.length})
            </button>
          </div>
        </div>
      )}

      <LoanDetailsModal
        loan={selectedLoan}
        state={selectedLoan ? loanState(selectedLoan, graceDays, dueSoonDays) : "active"}
        renewLimit={settings.renew_limit ?? 2}
        onClose={() => setSelectedLoan(null)}
        onReturn={(copyId) => returnMutation.mutate([copyId])}
        onRenew={(id) => renewMutation.mutate(id)}
        onSaveDueDate={(id, dueAt) => dueDateMutation.mutate({ id, dueAt })}
        isSaving={dueDateMutation.isPending}
      />

      <NewLoanModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />
    </div>
  );
}

function FilterPill({
  label, count, active, onClick, tone,
}: {
  label: string; count: number; active: boolean; onClick: () => void;
  tone: "neutral" | "emerald" | "amber" | "red";
}) {
  const activeBg = {
    neutral: "bg-emerald text-white",
    emerald: "bg-emerald text-white",
    amber: "bg-amber-500 text-white",
    red: "bg-red-500 text-white",
  }[tone];

  const idleBg = {
    neutral: "bg-white dark:bg-[#1d2926] text-[#122222]/70 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/5 border border-black/10 dark:border-white/10",
    emerald: "bg-white dark:bg-[#1d2926] text-emerald dark:text-emerald-light hover:bg-emerald/10 border border-emerald/20",
    amber: "bg-white dark:bg-[#1d2926] text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 border border-amber-500/20",
    red: "bg-white dark:bg-[#1d2926] text-red-500 hover:bg-red-500/10 border border-red-500/20",
  }[tone];

  const idleCount = {
    neutral: "bg-black/5 dark:bg-white/5 text-[#122222]/60 dark:text-white/60",
    emerald: "bg-emerald/10 text-emerald dark:bg-emerald-light/20 dark:text-emerald-light font-bold",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold",
    red: "bg-red-500/10 text-red-500 font-bold",
  }[tone];

  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
        active ? `${activeBg} shadow-sm font-bold` : idleBg
      }`}
    >
      <span>{label}</span>
      <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${active ? "bg-white/20 text-white" : idleCount}`}>
        {count}
      </span>
    </button>
  );
}

function LoanDetailsModal({
  loan, state, renewLimit, onClose, onReturn, onRenew, onSaveDueDate, isSaving,
}: {
  loan: Loan | null;
  state: LoanState;
  renewLimit: number;
  onClose: () => void;
  onReturn: (copyId: string) => void;
  onRenew: (id: string) => void;
  onSaveDueDate: (id: string, dueAt: string) => void;
  isSaving: boolean;
}) {
  const { t } = useTranslation();
  const [isEditingDue, setIsEditingDue] = useState(false);
  const [dueDraft, setDueDraft] = useState("");

  useEffect(() => {
    setIsEditingDue(false);
    setDueDraft(loan?.due_at ? loan.due_at.slice(0, 10) : "");
  }, [loan?.id]);

  if (!loan) return null;

  const stateLabels: Record<LoanState, string> = {
    active: t("loans.state.active", "On Loan"),
    dueSoon: t("loans.state.dueSoon", "Due Soon"),
    overdue: t("loans.state.overdue", "Overdue"),
    returned: t("loans.state.returned", "Returned"),
  };

  const saveDue = () => {
    if (!dueDraft) return;
    // End-of-day so a date picked here behaves like a full lending day, matching how
    // reservation expiry is stored.
    onSaveDueDate(loan.id, new Date(`${dueDraft}T23:59:59`).toISOString());
    setIsEditingDue(false);
  };

  const renewalsLeft = Math.max(0, renewLimit - loan.renewed_count);

  return (
    <Modal
      isOpen={!!loan}
      onClose={onClose}
      title={t("loans.detailsModal.title", "Loan Details")}
      size="xl"
      className="max-h-[88vh]"
    >
      <div className="flex flex-col h-full">
        <div className="flex-1 min-h-0 overflow-y-auto space-y-5 pr-1">
          {/* Status banner */}
          <div className="bg-[#fcfbf8] dark:bg-[#111d1a] border border-black/10 dark:border-white/10 p-4 rounded-2xl flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-3 py-1.5 rounded-full text-[12px] font-bold ${STATE_STYLES[state]}`}>
                {stateLabels[state]}
              </span>
              <span className="text-[11px] font-bold text-[#122222]/70 dark:text-white/70 bg-black/5 dark:bg-white/5 px-2.5 py-1 rounded-lg uppercase flex items-center gap-1">
                {loan.scope === "internal" ? <Building2 size={11} /> : <Globe size={11} />}
                {loan.scope === "internal"
                  ? t("reservations.scope.internal", "Internal")
                  : t("reservations.scope.external", "External")}
              </span>
              {state === "overdue" && (
                <span className="text-[12px] font-bold text-red-500 bg-red-500/10 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                  <AlertTriangle size={12} />
                  {t("circulation.daysOverdue", { count: daysOverdue(loan), defaultValue: `${daysOverdue(loan)} days overdue` })}
                </span>
              )}
            </div>
            <div className="text-[11px] font-mono text-[#122222]/50 dark:text-white/50 shrink-0">
              ID: {loan.id.slice(0, 8)}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-stretch">
            {/* Item */}
            <div className="border border-black/10 dark:border-white/10 rounded-2xl p-4 space-y-4 bg-white dark:bg-[#1d2926] flex flex-col">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#122222]/60 dark:text-white/60 flex items-center gap-2 shrink-0">
                <BookOpen size={15} className="text-emerald" />
                {t("reservations.addModal.summaryItem", "Book / Item Information")}
              </h4>

              <div className="flex gap-4">
                {loan.cover_path ? (
                  <img
                    src={loan.cover_path}
                    alt={loan.title || ""}
                    className="w-20 h-28 object-cover rounded-xl shadow border border-black/10 dark:border-white/10 shrink-0"
                  />
                ) : (
                  <DefaultCover type={loan.item_type} className="w-20 h-28 rounded-xl shrink-0 shadow-sm" iconSize={30} />
                )}

                <div className="space-y-1.5 flex-1 min-w-0">
                  <h3 className="font-bold text-[15px] text-[#122222] dark:text-white leading-snug line-clamp-2">{loan.title}</h3>
                  {loan.subtitle && (
                    <p className="text-[12px] text-[#122222]/70 dark:text-white/70 line-clamp-1">{loan.subtitle}</p>
                  )}
                  {loan.author && (
                    <p className="text-[12px] font-semibold text-emerald dark:text-emerald-light truncate">{loan.author}</p>
                  )}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {loan.item_type && <ItemTypeBadge type={loan.item_type} />}
                  </div>
                </div>
              </div>

              <div className="mt-auto pt-3 border-t border-black/5 dark:border-white/5 space-y-1.5 text-[11px] text-[#122222]/60 dark:text-white/60">
                {loan.barcode && (
                  <div className="flex items-center gap-2">
                    <MapPin size={13} className="text-emerald shrink-0" />
                    <span className="truncate">
                      {loan.copy_shelf
                        ? t("loans.shelfLabel", { shelf: loan.copy_shelf, defaultValue: `Shelf: ${loan.copy_shelf}` })
                        : t("loans.unassignedShelf", "Unassigned shelf")} · {loan.barcode}
                    </span>
                  </div>
                )}
                {loan.call_number && (
                  <div className="flex items-center gap-2">
                    <Hash size={13} className="text-emerald shrink-0" />
                    <span className="font-mono truncate">{loan.call_number}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Member + dates */}
            <div className="border border-black/10 dark:border-white/10 rounded-2xl p-4 space-y-4 bg-white dark:bg-[#1d2926] flex flex-col">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#122222]/60 dark:text-white/60 flex items-center gap-2 shrink-0">
                <UserCheck size={15} className="text-emerald" />
                {t("reservations.addModal.summaryMember", "Borrower / Member")}
              </h4>

              <div className="flex items-center gap-3">
                {loan.member_avatar ? (
                  <img src={loan.member_avatar} alt="" className="w-10 h-10 rounded-full object-cover shadow-sm border border-black/10 dark:border-white/10 shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-emerald/10 text-emerald dark:bg-emerald-light/10 dark:text-emerald-light font-bold text-[14px] flex items-center justify-center shrink-0">
                    {loan.member_name?.charAt(0).toUpperCase() || "M"}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="font-bold text-[14px] text-[#122222] dark:text-white truncate">{loan.member_name}</div>
                  {loan.member_number && (
                    <div className="text-[12px] font-mono text-[#122222]/50 dark:text-white/50">{loan.member_number}</div>
                  )}
                  {loan.member_dept && (
                    <div className="text-[11px] text-[#122222]/50 dark:text-white/50 truncate">{loan.member_dept}</div>
                  )}
                </div>
              </div>

              <div className="border border-black/10 dark:border-white/10 rounded-xl p-3 space-y-2 bg-[#fcfbf8] dark:bg-[#111d1a] text-[12px] mt-auto">
                <div className="flex items-center justify-between">
                  <span className="text-[#122222]/60 dark:text-white/60 flex items-center gap-1.5">
                    <Clock size={14} /> {t("loans.borrowedOn", "Borrowed on:")}
                  </span>
                  <span className="font-semibold text-[#122222] dark:text-white">{formatDisplayDate(loan.borrowed_at)}</span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#122222]/60 dark:text-white/60 flex items-center gap-1.5 shrink-0">
                    <Calendar size={14} /> {t("loans.dueOn", "Due on:")}
                  </span>
                  {isEditingDue ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="date"
                        value={dueDraft}
                        onChange={(e) => setDueDraft(e.target.value)}
                        className="text-[11px] font-semibold bg-white dark:bg-[#1d2926] border border-black/15 dark:border-white/15 rounded-control px-1.5 py-0.5 outline-none focus:border-emerald"
                      />
                      <button
                        type="button"
                        onClick={saveDue}
                        disabled={isSaving}
                        aria-label={t("save", "Save") as string}
                        className="p-1 rounded-control bg-emerald text-white hover:bg-emerald/90 cursor-pointer disabled:opacity-50"
                      >
                        <Check size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingDue(false)}
                        aria-label={t("cancel", "Cancel") as string}
                        className="p-1 rounded-control bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 cursor-pointer"
                      >
                        <XIcon size={12} />
                      </button>
                    </div>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <span className={`font-semibold ${state === "overdue" ? "text-red-500" : "text-amber-600 dark:text-amber-400"}`}>
                        {formatDisplayDate(loan.due_at)}
                      </span>
                      {!loan.returned_at && (
                        <button
                          type="button"
                          onClick={() => { setDueDraft(loan.due_at.slice(0, 10)); setIsEditingDue(true); }}
                          aria-label={t("loans.editDueDate", "Edit due date") as string}
                          className="p-1 rounded-control hover:bg-black/5 dark:hover:bg-white/10 text-[#122222]/40 dark:text-white/40 cursor-pointer"
                        >
                          <Calendar size={12} />
                        </button>
                      )}
                    </span>
                  )}
                </div>

                {loan.returned_at && (
                  <div className="flex items-center justify-between">
                    <span className="text-[#122222]/60 dark:text-white/60 flex items-center gap-1.5">
                      <Undo2 size={14} /> {t("circulation.returnedOn", "Returned on")}:
                    </span>
                    <span className="font-semibold text-emerald dark:text-emerald-light">{formatDisplayDate(loan.returned_at)}</span>
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-black/5 dark:border-white/5 pt-2">
                  <span className="text-[#122222]/60 dark:text-white/60 flex items-center gap-1.5">
                    <RefreshCw size={14} /> {t("loans.renewals", "Renewals:")}
                  </span>
                  <span className="font-semibold text-[#122222] dark:text-white">
                    {loan.renewed_count} / {renewLimit}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {loan.notes && (
            <div className="border border-black/10 dark:border-white/10 rounded-2xl p-4 bg-white dark:bg-[#1d2926]">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#122222]/60 dark:text-white/60 mb-2">
                {t("loans.notes", "Notes")}
              </h4>
              <p className="text-[12.5px] text-[#122222]/80 dark:text-white/80 whitespace-pre-line">{loan.notes}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 mt-4 border-t border-black/10 dark:border-white/10 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            {!loan.returned_at && (
              <>
                <Button
                  type="button"
                  className="text-[12px] flex items-center gap-1.5 cursor-pointer"
                  onClick={() => onReturn(loan.copy_id)}
                >
                  <RotateCcw size={14} />
                  {t("loans.returnItem", "Return Item")}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="text-amber-700 dark:text-amber-400 text-[12px] flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                  disabled={renewalsLeft === 0}
                  title={renewalsLeft === 0 ? (t("loans.renewLimitReached", "Renewal limit reached") as string) : undefined}
                  onClick={() => onRenew(loan.id)}
                >
                  <RefreshCw size={14} />
                  {t("loans.renewLoan", "Renew Loan")}
                  {renewalsLeft > 0 && <span className="opacity-60">({renewalsLeft})</span>}
                </Button>
              </>
            )}
          </div>

          <Button type="button" variant="ghost" className="text-[12px] cursor-pointer" onClick={onClose}>
            {t("common.close", "Close")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Direct-desk checkout. Until now `checkout()` existed in the data layer but had no UI at all,
 * so a loan could only ever be created by fulfilling a reservation — this closes that gap.
 * The copy list is filtered to `available` because checkout() rejects anything else server-side,
 * and offering an unavailable copy would only produce a confusing failure at confirm time.
 */
function NewLoanModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const settings = useLibrarySettingsStore((s) => s.settings);

  const [memberTerm, setMemberTerm] = useState("");
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [copyTerm, setCopyTerm] = useState("");
  const [selectedCopies, setSelectedCopies] = useState<(Copy & { title: string })[]>([]);
  const [scope, setScope] = useState<ReservationScope>("external");

  useEffect(() => {
    if (!isOpen) {
      setMemberTerm(""); setSelectedMember(null);
      setCopyTerm(""); setSelectedCopies([]); setScope("external");
    }
  }, [isOpen]);

  const membersQuery = useQuery({
    queryKey: ["members", memberTerm],
    queryFn: () => members(memberTerm),
    enabled: isOpen && !selectedMember,
  });

  const copiesQuery = useQuery({
    queryKey: ["copies", copyTerm],
    queryFn: () => copies(copyTerm),
    enabled: isOpen && !!selectedMember,
  });

  const availableCopies = useMemo(
    () => (copiesQuery.data ?? []).filter(
      (c) => c.status === "available" && !selectedCopies.some((s) => s.id === c.id)
    ),
    [copiesQuery.data, selectedCopies]
  );

  const checkoutMutation = useMutation({
    mutationFn: () =>
      checkout(selectedMember!.id, selectedCopies.map((c) => c.id), settings.loan_limit ?? 5, scope),
    onSuccess: () => {
      invalidate();
      toast.success(t("circulation.alerts.checkoutSuccess", "Checkout completed successfully."));
      onClose();
    },
    onError: (err: any) => toast.error(err.message || t("loans.alerts.checkoutFailed", "Checkout failed.")),
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("loans.newLoan", "New Loan")}
      size="lg"
      className="max-h-[88vh]"
    >
      <div className="flex flex-col h-full">
        <div className="flex-1 min-h-0 overflow-y-auto space-y-5 pr-1">
          {/* Member */}
          <section className="space-y-2">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#122222]/60 dark:text-white/60 flex items-center gap-2">
              <UserCheck size={15} className="text-emerald" />
              {t("circulation.selectedMember", "Selected Member")}
            </h4>

            {selectedMember ? (
              <div className="flex items-center justify-between gap-3 border border-emerald/30 bg-emerald/5 rounded-xl p-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-emerald/10 text-emerald dark:bg-emerald-light/10 dark:text-emerald-light font-bold text-[13px] flex items-center justify-center shrink-0">
                    {selectedMember.full_name?.charAt(0).toUpperCase() || "M"}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-[13.5px] text-[#122222] dark:text-white truncate">{selectedMember.full_name}</div>
                    <div className="text-[11.5px] font-mono text-[#122222]/50 dark:text-white/50">{selectedMember.member_number}</div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedMember(null)}
                  className="text-[12px] font-semibold text-[#122222]/60 dark:text-white/60 hover:underline cursor-pointer shrink-0"
                >
                  {t("loans.change", "Change")}
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#122222]/40 dark:text-white/40" />
                  <input
                    autoFocus
                    value={memberTerm}
                    onChange={(e) => setMemberTerm(e.target.value)}
                    placeholder={t("loans.searchMember", "Search member by name or number...") as string}
                    className="w-full bg-white dark:bg-[#1d2926] border border-black/10 dark:border-white/10 rounded-lg py-2 pl-9 pr-3 text-[13px] outline-none focus:border-emerald"
                  />
                </div>
                <div className="max-h-52 overflow-y-auto border border-black/10 dark:border-white/10 rounded-xl divide-y divide-black/5 dark:divide-white/5">
                  {membersQuery.isLoading ? (
                    <div className="p-4 flex justify-center"><Spinner size={18} /></div>
                  ) : (membersQuery.data ?? []).length === 0 ? (
                    <p className="p-4 text-[12.5px] text-center text-[#122222]/50 dark:text-white/50">
                      {t("loans.noMembers", "No members found.")}
                    </p>
                  ) : (
                    (membersQuery.data ?? []).slice(0, 40).map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setSelectedMember(m)}
                        className="w-full text-left p-2.5 hover:bg-emerald/5 flex items-center justify-between gap-3 cursor-pointer"
                      >
                        <span className="min-w-0">
                          <span className="block font-semibold text-[13px] text-[#122222] dark:text-white truncate">{m.full_name}</span>
                          <span className="block text-[11px] font-mono text-[#122222]/50 dark:text-white/50">{m.member_number}</span>
                        </span>
                        {m.status !== "active" && (
                          <span className="text-[10px] font-bold uppercase text-red-500 bg-red-500/10 px-2 py-0.5 rounded shrink-0">
                            {m.status}
                          </span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </section>

          {/* Copies */}
          {selectedMember && (
            <section className="space-y-2">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#122222]/60 dark:text-white/60 flex items-center gap-2">
                <BookOpen size={15} className="text-emerald" />
                {t("loans.itemsToLend", "Items to lend")}
              </h4>

              {selectedCopies.length > 0 && (
                <div className="space-y-1.5">
                  {selectedCopies.map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-3 border border-emerald/30 bg-emerald/5 rounded-xl p-2.5">
                      <div className="min-w-0">
                        <div className="font-semibold text-[13px] text-[#122222] dark:text-white truncate">{c.title}</div>
                        <div className="text-[11px] font-mono text-emerald dark:text-emerald-light">{c.barcode}</div>
                      </div>
                      <button
                        onClick={() => setSelectedCopies((prev) => prev.filter((x) => x.id !== c.id))}
                        aria-label={t("loans.removeItem", "Remove item") as string}
                        className="p-1 rounded-control hover:bg-black/10 dark:hover:bg-white/10 text-[#122222]/50 dark:text-white/50 cursor-pointer shrink-0"
                      >
                        <XIcon size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#122222]/40 dark:text-white/40" />
                <input
                  value={copyTerm}
                  onChange={(e) => setCopyTerm(e.target.value)}
                  placeholder={t("loans.searchCopy", "Scan or search a copy barcode / title...") as string}
                  className="w-full bg-white dark:bg-[#1d2926] border border-black/10 dark:border-white/10 rounded-lg py-2 pl-9 pr-3 text-[13px] outline-none focus:border-emerald"
                />
              </div>

              <div className="max-h-48 overflow-y-auto border border-black/10 dark:border-white/10 rounded-xl divide-y divide-black/5 dark:divide-white/5">
                {copiesQuery.isLoading ? (
                  <div className="p-4 flex justify-center"><Spinner size={18} /></div>
                ) : availableCopies.length === 0 ? (
                  <p className="p-4 text-[12.5px] text-center text-[#122222]/50 dark:text-white/50">
                    {t("loans.noAvailableCopies", "No available copies match.")}
                  </p>
                ) : (
                  availableCopies.slice(0, 40).map((c) => (
                    <button
                      key={c.id}
                      onClick={() => { setSelectedCopies((prev) => [...prev, c]); setCopyTerm(""); }}
                      className="w-full text-left p-2.5 hover:bg-emerald/5 flex items-center justify-between gap-3 cursor-pointer"
                    >
                      <span className="min-w-0">
                        <span className="block font-semibold text-[13px] text-[#122222] dark:text-white truncate">{c.title}</span>
                        <span className="block text-[11px] font-mono text-[#122222]/50 dark:text-white/50">{c.barcode}</span>
                      </span>
                      <Plus size={14} className="text-emerald shrink-0" />
                    </button>
                  ))
                )}
              </div>

              {/* Scope */}
              <div className="flex items-center gap-2 pt-1">
                <span className="text-[12px] font-semibold text-[#122222]/60 dark:text-white/60">
                  {t("loans.scope", "Scope:")}
                </span>
                {(["external", "internal"] as ReservationScope[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setScope(s)}
                    className={`px-3 py-1.5 rounded-xl text-[12px] font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                      scope === s
                        ? "bg-emerald text-white"
                        : "bg-white dark:bg-[#1d2926] text-[#122222]/70 dark:text-white/70 border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5"
                    }`}
                  >
                    {s === "internal" ? <Building2 size={12} /> : <Globe size={12} />}
                    {s === "internal"
                      ? t("reservations.scope.internal", "Internal")
                      : t("reservations.scope.external", "External")}
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="pt-4 mt-4 border-t border-black/10 dark:border-white/10 flex items-center justify-end gap-2 shrink-0">
          <Button type="button" variant="ghost" className="text-[12px] cursor-pointer" onClick={onClose}>
            {t("cancel", "Cancel")}
          </Button>
          <Button
            type="button"
            className="text-[12px] flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
            disabled={!selectedMember || selectedCopies.length === 0 || checkoutMutation.isPending}
            onClick={() => checkoutMutation.mutate()}
          >
            <CheckCircle2 size={14} />
            {checkoutMutation.isPending
              ? t("circulation.completingCheckout", "Completing...")
              : t("loans.confirmCheckout", { count: selectedCopies.length, defaultValue: `Lend ${selectedCopies.length} item(s)` })}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
