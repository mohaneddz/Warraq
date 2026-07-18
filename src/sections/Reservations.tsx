import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Search, Filter, Bookmark, Clock, Trash2 } from "lucide-react";
import { reservations, cancelReservation } from "../data/repositories/library";
import { queryClient } from "../app/providers";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { formatDisplayDate } from "../utils/dates";

const invalidate = () => queryClient.invalidateQueries();

export function ReservationsPage() {
  const { t } = useTranslation();
  const [term, setTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Queries
  const result = useQuery({ queryKey: ["reservations"], queryFn: reservations }); 

  // Client-side search filtering
  const filteredReservations = useMemo(() => {
    if (!result.data) return [];
    if (!term.trim()) return result.data;
    const q = term.toLowerCase().trim();
    return result.data.filter(r => 
      r.title?.toLowerCase().includes(q) || 
      r.member_name?.toLowerCase().includes(q)
    );
  }, [result.data, term]);

  // Mutations
  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelReservation(id),
    onSuccess: () => {
      invalidate();
      toast.success(t("members.alerts.reservationCancelled") || "Reservation cancelled.");
    },
    onError: (err) => toast.error(err.message)
  });

  const bulkCancelMutation = useMutation({
    mutationFn: async () => {
      await Promise.all(selectedIds.map(id => cancelReservation(id)));
    },
    onSuccess: () => {
      invalidate();
      toast.success(t("reservations.alerts.bulkCancelled") || "Selected reservations cancelled.");
      setSelectedIds([]);
    },
    onError: (err: any) => {
      toast.error(err.message || t("reservations.alerts.bulkCancelFailed") || "Failed to cancel reservations.");
    }
  });

  const handleBulkCancel = () => {
    if (confirm(t("reservations.alerts.confirmBulkCancel", { count: selectedIds.length }) || `Are you sure you want to cancel ${selectedIds.length} selected reservation(s)?`)) {
      bulkCancelMutation.mutate();
    }
  };

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="font-display text-[28px] font-bold text-[#122222] dark:text-white leading-tight">{t("reservations.title")}</h1>
          <p className="text-[13px] text-[#122222]/60 dark:text-white/60">{t("reservations.subtitle")}</p>
        </div>
      </div>

      {/* Main Panel */}
      <div className="flex-1 bg-white dark:bg-[#1d2926] border border-black/5 dark:border-white/5 rounded-2xl flex flex-col shadow-card overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-black/5 dark:border-white/5 flex items-center gap-3 bg-[#fcfbf8] dark:bg-[#111d1a]">
          <div className="flex-1 max-w-sm relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#122222]/40" />
            <input 
              type="text" 
              placeholder={t("reservations.searchPlaceholder")} 
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              className="w-full bg-white dark:bg-[#1d2926] border border-black/10 dark:border-white/10 rounded-lg py-2 pl-9 pr-3 text-[13px] text-[#122222] dark:text-[#f0ebe1] outline-none focus:border-emerald focus:ring-1 focus:ring-emerald" 
            />
          </div>
          <FilterSelect placeholder={t("reservations.allStatuses") || "All Statuses"} />
          <button className="flex items-center gap-2 text-[#122222]/60 dark:text-white/60 text-[13px] font-semibold px-3 py-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg ml-auto cursor-pointer">
            <Filter size={16} /> {t("reservations.moreFilters") || "More filters"}
          </button>
        </div>

        {/* Table Area */}
        <div className="flex-1 overflow-auto">
          {filteredReservations.length ? (
            <table className="w-full text-left text-[13px]">
              <thead className="bg-[#fcfbf8] dark:bg-[#111d1a] sticky top-0 border-b border-black/5 dark:border-white/5 text-[11px] font-bold text-[#122222]/50 dark:text-white/50 uppercase tracking-wider select-none">
                <tr>
                  <th className="px-6 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={filteredReservations.length > 0 && selectedIds.length === filteredReservations.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds(filteredReservations.map(r => r.id));
                        } else {
                          setSelectedIds([]);
                        }
                      }}
                      className="cursor-pointer rounded border-black/25 dark:border-white/25 text-emerald focus:ring-emerald h-4 w-4"
                    />
                  </th>
                  <th className="px-6 py-3">{t("catalog.headers.title")}</th>
                  <th className="px-6 py-3">{t("circulation.selectedMember")}</th>
                  <th className="px-6 py-3">{t("reservations.requestDate")}</th>
                  <th className="px-6 py-3">{t("status")}</th>
                  <th className="px-6 py-3 w-20">{t("actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/5">
                {filteredReservations.map((res) => (
                  <tr 
                    key={res.id} 
                    className={`hover:bg-black/5 dark:hover:bg-white/5 transition-colors group ${
                      selectedIds.includes(res.id) ? "bg-emerald/5 dark:bg-emerald-light/5" : ""
                    }`}
                  >
                    <td className="px-6 py-3 w-10" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(res.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds(prev => [...prev, res.id]);
                          } else {
                            setSelectedIds(prev => prev.filter(id => id !== res.id));
                          }
                        }}
                        className="cursor-pointer rounded border-black/25 dark:border-white/25 text-emerald focus:ring-emerald h-4 w-4"
                      />
                    </td>
                    <td className="px-6 py-3 font-semibold text-[#122222] dark:text-white">
                      {res.title || "—"}
                    </td>
                    <td className="px-6 py-3 text-[#122222]/70 dark:text-white/70">
                      {res.member_name || "—"}
                    </td>
                    <td className="px-6 py-3 text-[#122222]/70 dark:text-white/70">
                      <div className="flex items-center gap-2">
                        <Clock size={14} className="opacity-50"/>
                        {formatDisplayDate(res.reserved_at)}
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <span className={`px-2 py-1 rounded-[4px] text-[11px] font-bold ${
                        res.status === 'ready' 
                          ? 'bg-emerald/10 text-emerald dark:bg-emerald-light/20 dark:text-emerald-light' 
                          : res.status === 'queued'
                          ? 'bg-copper/10 text-copper'
                          : 'bg-gray-500/10 text-gray-500'
                      }`}>
                        {res.status === 'ready' ? t("reservations.status.ready") || "Ready" : res.status === 'queued' ? t("reservations.status.queued") || "Queued" : res.status}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      {(res.status === 'queued' || res.status === 'ready') && (
                        <button 
                          onClick={() => {
                            if (confirm(t("reservations.alerts.confirmCancel") || "Cancel this reservation?")) {
                              cancelMutation.mutate(res.id);
                            }
                          }}
                          className="text-red-500 hover:text-red-700 font-bold text-[11px] cursor-pointer"
                          disabled={cancelMutation.isPending}
                        >
                          {t("catalog.addModal.cancel") || "Cancel"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
             <div className="flex-1 flex flex-col items-center justify-center py-20 opacity-60">
              <div className="w-24 h-24 bg-black/5 dark:bg-white/5 rounded-full flex items-center justify-center text-[#122222]/40 dark:text-white/40 mb-6">
                <Bookmark size={40} />
              </div>
              <h2 className="text-[20px] font-bold text-[#122222] dark:text-white mb-2">{t("reservations.noReservations")}</h2>
              <p className="text-[14px] text-[#122222]/60 dark:text-white/60">{t("reservations.noReservationsHelp")}</p>
            </div>
          )}
        </div>
      </div>
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/90 dark:bg-[#1d2926]/90 backdrop-blur-md px-6 py-3 rounded-full border border-black/10 dark:border-white/10 shadow-lg flex items-center gap-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <span className="text-[13px] font-semibold text-[#122222] dark:text-white">
            {t("reservations.bulk.selectedCount", { count: selectedIds.length }) || `${selectedIds.length} reservations selected`}
          </span>
          <div className="h-4 w-px bg-black/10 dark:bg-white/10" />
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedIds(filteredReservations.map(r => r.id))}
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
              onClick={handleBulkCancel}
              className="flex items-center gap-1.5 text-[12px] font-bold bg-red-500 hover:bg-red-600 text-white px-4 py-1.5 rounded-full shadow transition-colors cursor-pointer"
            >
              <Trash2 size={13} />
              {t("reservations.cancelSelected") || "Cancel Selected"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterSelect({ placeholder }: { placeholder: string }) {
  return (
    <div className="relative">
      <select className="appearance-none bg-white dark:bg-[#1d2926] border border-black/5 dark:border-white/5 rounded-lg py-2 pl-3 pr-8 text-[13px] font-semibold text-[#122222]/70 dark:text-white/70 outline-none cursor-pointer hover:border-emerald/30 transition-colors">
        <option>{placeholder}</option>
      </select>
      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#122222]/40">
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </div>
  );
}
