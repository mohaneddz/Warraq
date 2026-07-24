import { useState, useMemo, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Search, Bookmark, Clock, Trash2, Plus,
  UserCheck, UserPlus, BookOpen, Calendar, CheckCircle2, ChevronRight,
  Layers, Tag, MapPin, Hash, XCircle, Eye, Copy as CopyIcon
} from "lucide-react";
import { useContextMenu } from "../components/ui/ContextMenu";


import {
  reservations, cancelReservation, deleteReservation, markReservationReady, extendReservation,
  members, books, addReservation, saveMember, getCopiesForBook
} from "../data/repositories/library";
import { queryClient } from "../app/providers";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { formatDisplayDate, today } from "../utils/dates";
import { Modal, Input, Button, ItemTypeBadge, StatusBadge } from "../components/ui/primitives";
import type { Book, Member, Copy, Reservation } from "../types";

const invalidate = () => queryClient.invalidateQueries();

export function ReservationsPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const [term, setTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedReservationDetails, setSelectedReservationDetails] = useState<Reservation | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const action = params.get("action");
    if (action === "new-reservation" || action === "add-reservation") {
      setIsAddModalOpen(true);
      const cleanUrl = window.location.hash ? window.location.hash.split("?")[0] : window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  }, [location.search]);
  
  // Queries
  const result = useQuery({ queryKey: ["reservations"], queryFn: reservations }); 

  // Status counts
  const counts = useMemo(() => {
    if (!result.data) return { all: 0, ready: 0, queued: 0, cancelled: 0 };
    const all = result.data.length;
    let ready = 0, queued = 0, cancelled = 0;
    result.data.forEach(r => {
      if (r.status === 'ready') ready++;
      else if (r.status === 'queued') queued++;
      else if (r.status === 'cancelled') cancelled++;
    });
    return { all, ready, queued, cancelled };
  }, [result.data]);

  // Client-side search and status filtering
  const filteredReservations = useMemo(() => {
    if (!result.data) return [];
    return result.data.filter(r => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!term.trim()) return true;
      const q = term.toLowerCase().trim();
      return (
        r.title?.toLowerCase().includes(q) || 
        r.member_name?.toLowerCase().includes(q) ||
        r.copy_barcode?.toLowerCase().includes(q) ||
        r.copy_shelf?.toLowerCase().includes(q)
      );
    });
  }, [result.data, term, statusFilter]);

  // Mutations
  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelReservation(id),
    onSuccess: () => {
      invalidate();
      toast.success(t("members.alerts.reservationCancelled") || "Reservation cancelled.");
    },
    onError: (err) => toast.error(err.message)
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteReservation(id),
    onSuccess: () => {
      invalidate();
      toast.success(t("reservations.alerts.deleted") || "Reservation deleted permanently.");
    },
    onError: (err: any) => toast.error(err.message)
  });

  const markReadyMutation = useMutation({
    mutationFn: (id: string) => markReservationReady(id),
    onSuccess: () => {
      invalidate();
      toast.success(t("reservations.alerts.markedReady") || "Reservation marked as Ready for Pickup.");
    },
    onError: (err: any) => toast.error(err.message)
  });

  const extendMutation = useMutation({
    mutationFn: (id: string) => extendReservation(id, 7),
    onSuccess: () => {
      invalidate();
      toast.success(t("reservations.alerts.extended") || "Reservation hold extended by 7 days.");
    },
    onError: (err: any) => toast.error(err.message)
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

  const bulkDeleteMutation = useMutation({
    mutationFn: async () => {
      await Promise.all(selectedIds.map(id => deleteReservation(id)));
    },
    onSuccess: () => {
      invalidate();
      toast.success(t("reservations.alerts.bulkDeleted") || "Selected reservations deleted.");
      setSelectedIds([]);
    },
    onError: (err: any) => toast.error(err.message || "Failed to delete reservations.")
  });

  const bulkMarkReadyMutation = useMutation({
    mutationFn: async () => {
      await Promise.all(selectedIds.map(id => markReservationReady(id)));
    },
    onSuccess: () => {
      invalidate();
      toast.success(t("reservations.alerts.bulkReady") || "Selected reservations marked ready.");
      setSelectedIds([]);
    },
    onError: (err: any) => toast.error(err.message || "Failed to mark ready.")
  });

  const { showContextMenu } = useContextMenu();

  const handleReservationContextMenu = (e: React.MouseEvent, res: Reservation) => {
    showContextMenu(e, [
      {
        id: "mark-ready",
        label: t("reservations.markReady", "Mark Ready for Pickup"),
        icon: CheckCircle2,
        hidden: res.status === "ready",
        variant: "success",
        onClick: () => markReadyMutation.mutate(res.id),
      },
      {
        id: "extend-hold",
        label: t("reservations.extendHold", "Extend Hold (+7 Days)"),
        icon: Clock,
        hidden: res.status === "cancelled",
        onClick: () => extendMutation.mutate(res.id),
      },
      {
        id: "cancel-res",
        label: t("reservations.cancelRes", "Cancel Reservation"),
        icon: XCircle,
        hidden: res.status === "cancelled",
        variant: "warning",
        onClick: () => cancelMutation.mutate(res.id),
      },
      { divider: true },
      {
        id: "view-details",
        label: t("reservations.viewDetails", "View Reservation Details"),
        icon: Eye,
        onClick: () => setSelectedReservationDetails(res),
      },
      {
        id: "copy-member",
        label: t("reservations.copyMember", "Copy Member Name"),
        icon: CopyIcon,
        onClick: () => {
          if (res.member_name) {
            navigator.clipboard.writeText(res.member_name);
            toast.success(t("reservations.copiedMember", "Member name copied"));
          }
        },
      },
      {
        id: "copy-barcode",
        label: t("reservations.copyBarcode", "Copy Barcode"),
        icon: CopyIcon,
        hidden: !res.copy_barcode,
        onClick: () => {
          if (res.copy_barcode) {
            navigator.clipboard.writeText(res.copy_barcode);
            toast.success(t("reservations.copiedBarcode", "Barcode copied"));
          }
        },
      },

      { divider: true },
      {
        id: "delete-res",
        label: t("reservations.deleteRes", "Delete Reservation"),
        icon: Trash2,
        variant: "danger",
        onClick: () => {
          if (confirm(t("reservations.confirmDelete", { title: res.title }) || `Are you sure you want to delete reservation for "${res.title}"?`)) {
            deleteMutation.mutate(res.id);
          }
        },
      },
    ], { title: res.title || "Reservation" });
  };


  const bulkExtendMutation = useMutation({
    mutationFn: async () => {
      await Promise.all(selectedIds.map(id => extendReservation(id, 7)));
    },
    onSuccess: () => {
      invalidate();
      toast.success(t("reservations.alerts.bulkExtended") || "Selected reservation holds extended.");
      setSelectedIds([]);
    },
    onError: (err: any) => toast.error(err.message || "Failed to extend reservations.")
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
          <h1 className="font-display text-[28px] font-bold text-[#122222] dark:text-white leading-tight">
            {t("reservations.title")}
          </h1>
          <p className="text-[13px] text-[#122222]/60 dark:text-white/60">
            {t("reservations.subtitle")}
          </p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 bg-emerald text-white px-4 py-2 rounded-xl text-[13px] font-semibold hover:bg-emerald/90 transition shadow-sm cursor-pointer"
        >
          <Plus size={16} />
          {t("reservations.newReservation") || "New Reservation"}
        </button>
      </div>

      {/* Main Panel */}
      <div className="flex-1 bg-white dark:bg-[#1d2926] border border-black/5 dark:border-white/5 rounded-2xl flex flex-col shadow-card overflow-hidden">
        {/* Toolbar with Quick Filters */}
        <div className="p-4 border-b border-black/5 dark:border-white/5 flex flex-wrap items-center gap-3 bg-[#fcfbf8] dark:bg-[#111d1a]">
          {/* Search Input */}
          <div className="flex-1 min-w-[220px] max-w-sm relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#122222]/40" />
            <input 
              type="text" 
              placeholder={t("reservations.searchPlaceholder") || "Search title, member, barcode, shelf..."} 
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              className="w-full bg-white dark:bg-[#1d2926] border border-black/10 dark:border-white/10 rounded-lg py-2 pl-9 pr-3 text-[13px] text-[#122222] dark:text-[#f0ebe1] outline-none focus:border-emerald focus:ring-1 focus:ring-emerald" 
            />
          </div>

          {/* Quick Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 text-[12px] font-semibold select-none">
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
                statusFilter === "all"
                  ? "bg-emerald text-white shadow-sm font-bold"
                  : "bg-white dark:bg-[#1d2926] text-[#122222]/70 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/5 border border-black/10 dark:border-white/10"
              }`}
            >
              <span>{t("reservations.filters.all", "All")}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${statusFilter === "all" ? "bg-white/20 text-white" : "bg-black/5 dark:bg-white/5 text-[#122222]/60 dark:text-white/60"}`}>
                {counts.all}
              </span>
            </button>

            <button
              onClick={() => setStatusFilter("ready")}
              className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
                statusFilter === "ready"
                  ? "bg-emerald text-white shadow-sm font-bold"
                  : "bg-white dark:bg-[#1d2926] text-emerald dark:text-emerald-light hover:bg-emerald/10 border border-emerald/20"
              }`}
            >
              <span>{t("reservations.status.ready", "Ready for Pickup")}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${statusFilter === "ready" ? "bg-white/20 text-white" : "bg-emerald/10 text-emerald dark:bg-emerald-light/20 dark:text-emerald-light font-bold"}`}>
                {counts.ready}
              </span>
            </button>

            <button
              onClick={() => setStatusFilter("queued")}
              className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
                statusFilter === "queued"
                  ? "bg-copper text-white shadow-sm font-bold"
                  : "bg-white dark:bg-[#1d2926] text-copper hover:bg-copper/10 border border-copper/20"
              }`}
            >
              <span>{t("reservations.status.queued", "Queued")}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${statusFilter === "queued" ? "bg-white/20 text-white" : "bg-copper/10 text-copper font-bold"}`}>
                {counts.queued}
              </span>
            </button>

            <button
              onClick={() => setStatusFilter("cancelled")}
              className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
                statusFilter === "cancelled"
                  ? "bg-gray-700 text-white shadow-sm font-bold"
                  : "bg-white dark:bg-[#1d2926] text-[#122222]/60 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/5 border border-black/10 dark:border-white/10"
              }`}
            >
              <span>{t("reservations.status.cancelled", "Cancelled")}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${statusFilter === "cancelled" ? "bg-white/20 text-white" : "bg-black/5 dark:bg-white/5 text-[#122222]/60 dark:text-white/60"}`}>
                {counts.cancelled}
              </span>
            </button>
          </div>

          {/* Status Dropdown Filter */}
          <div className="ml-auto relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none bg-white dark:bg-[#1d2926] border border-black/10 dark:border-white/10 rounded-lg py-2 pl-3 pr-8 text-[13px] font-semibold text-[#122222]/70 dark:text-white/70 outline-none cursor-pointer hover:border-emerald/30 transition-colors"
            >
              <option value="all">{t("reservations.allStatuses", "All Statuses")}</option>
              <option value="ready">{t("reservations.status.ready", "Ready for Pickup")}</option>
              <option value="queued">{t("reservations.status.queued", "Queued")}</option>
              <option value="cancelled">{t("reservations.status.cancelled", "Cancelled")}</option>
            </select>
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#122222]/40">
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
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
                  <th className="px-6 py-3">{t("reservations.addModal.copyBarcode") || "Copy Barcode"}</th>
                  <th className="px-6 py-3">{t("reservations.requestDate")}</th>
                  <th className="px-6 py-3">{t("reservations.expiresDate") || "Expires Date"}</th>
                  <th className="px-6 py-3">{t("status")}</th>
                  <th className="px-6 py-3 w-20">{t("actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/5">
                {filteredReservations.map((res) => (
                  <tr 
                    key={res.id} 
                    onClick={() => setSelectedReservationDetails(res)}
                    onContextMenu={(e) => handleReservationContextMenu(e, res)}
                    className={`hover:bg-black/5 dark:hover:bg-white/5 transition-colors group cursor-pointer ${
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
                      <div className="flex items-center gap-3">
                        {res.cover_path ? (
                          <img src={res.cover_path} alt="" className="w-8 h-11 object-cover rounded shadow-sm shrink-0" />
                        ) : (
                          <div className="w-8 h-11 bg-black/5 dark:bg-white/5 rounded flex items-center justify-center text-[#122222]/40 shrink-0">
                            <BookOpen size={16} />
                          </div>
                        )}
                        <div className="line-clamp-2" title={res.title || ""}>{res.title || "—"}</div>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-[#122222]/70 dark:text-white/70">
                      <div className="flex items-center gap-2.5">
                        {res.member_avatar ? (
                          <img src={res.member_avatar} alt="" className="w-8 h-8 rounded-full object-cover shadow-sm shrink-0 border border-black/10 dark:border-white/10" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-emerald/10 text-emerald dark:bg-emerald-light/10 dark:text-emerald-light font-bold text-[12px] flex items-center justify-center shrink-0">
                            {res.member_name?.charAt(0).toUpperCase() || "M"}
                          </div>
                        )}
                        <div>
                          <div className="font-semibold text-[#122222] dark:text-white line-clamp-1">{res.member_name || "—"}</div>
                          {res.member_number && (
                            <div className="text-[11px] font-mono text-[#122222]/50 dark:text-white/50">{res.member_number}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-[#122222]/70 dark:text-white/70">
                      {res.copy_barcode ? (
                        <div className="flex items-center gap-1.5 font-mono text-[12px] font-medium text-emerald dark:text-emerald-light">
                          <Hash size={13} className="opacity-60" />
                          {res.copy_barcode}
                          {res.copy_shelf && (
                            <span className="text-[10px] bg-emerald/10 text-emerald dark:bg-emerald-light/20 dark:text-emerald-light px-2 py-0.5 rounded font-semibold flex items-center gap-1 ml-1">
                              <MapPin size={10} />
                              {res.copy_shelf}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] opacity-40 italic">Auto-assigned</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-[#122222]/70 dark:text-white/70">
                      <div className="flex items-center gap-2">
                        <Clock size={14} className="opacity-50"/>
                        {formatDisplayDate(res.reserved_at)}
                      </div>
                    </td>
                    <td className="px-6 py-3 text-[#122222]/70 dark:text-white/70">
                      {res.expires_at ? (
                        <div className="flex items-center gap-2 font-medium text-amber-600 dark:text-amber-400">
                          <Calendar size={14} className="opacity-70"/>
                          {formatDisplayDate(res.expires_at)}
                        </div>
                      ) : (
                        <span className="opacity-40">—</span>
                      )}
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
                    <td className="px-6 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        {res.status === 'queued' && (
                          <button
                            title="Mark as Ready for Pickup"
                            onClick={() => markReadyMutation.mutate(res.id)}
                            className="p-1.5 rounded-lg text-emerald hover:bg-emerald/10 cursor-pointer transition-colors"
                          >
                            <CheckCircle2 size={15} />
                          </button>
                        )}
                        {(res.status === 'ready' || res.status === 'queued') && (
                          <button
                            title="Extend Hold by 7 Days"
                            onClick={() => extendMutation.mutate(res.id)}
                            className="p-1.5 rounded-lg text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 cursor-pointer transition-colors"
                          >
                            <Calendar size={15} />
                          </button>
                        )}
                        {(res.status === 'queued' || res.status === 'ready') && (
                          <button 
                            title="Cancel Reservation"
                            onClick={() => {
                              if (confirm(t("reservations.alerts.confirmCancel") || "Cancel this reservation?")) {
                                cancelMutation.mutate(res.id);
                              }
                            }}
                            className="p-1.5 rounded-lg text-orange-500 hover:bg-orange-500/10 cursor-pointer transition-colors"
                            disabled={cancelMutation.isPending}
                          >
                            <Clock size={15} />
                          </button>
                        )}
                        <button
                          title="Delete Reservation Permanently"
                          onClick={() => {
                            if (confirm("Permanently delete this reservation? This cannot be undone.")) {
                              deleteMutation.mutate(res.id);
                            }
                          }}
                          className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 cursor-pointer transition-colors"
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
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
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/95 dark:bg-[#1d2926]/95 backdrop-blur-md px-6 py-3 rounded-2xl border border-black/10 dark:border-white/10 shadow-2xl flex items-center gap-5 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <span className="text-[13px] font-semibold text-[#122222] dark:text-white shrink-0">
            {t("reservations.bulk.selectedCount", { count: selectedIds.length }) || `${selectedIds.length} selected`}
          </span>
          <div className="h-4 w-px bg-black/10 dark:bg-white/10" />
          <div className="flex items-center gap-2 flex-wrap">
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

            <div className="h-4 w-px bg-black/10 dark:bg-white/10 mx-1" />

            <button
              onClick={() => {
                if (confirm(`Mark ${selectedIds.length} selected reservation(s) as Ready for Pickup?`)) {
                  bulkMarkReadyMutation.mutate();
                }
              }}
              className="flex items-center gap-1.5 text-[12px] font-bold bg-emerald hover:bg-emerald/90 text-white px-3 py-1.5 rounded-xl shadow-sm transition-colors cursor-pointer"
            >
              <CheckCircle2 size={13} />
              {t("reservations.bulk.markReady") || "Mark Ready"}
            </button>

            <button
              onClick={() => {
                if (confirm(`Extend hold for ${selectedIds.length} selected reservation(s) by 7 days?`)) {
                  bulkExtendMutation.mutate();
                }
              }}
              className="flex items-center gap-1.5 text-[12px] font-bold bg-emerald/15 text-emerald dark:bg-emerald-light/20 dark:text-emerald-light border border-emerald/30 hover:bg-emerald/25 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
            >
              <Calendar size={13} />
              {t("reservations.bulk.extend7Days") || "Extend +7 Days"}
            </button>

            <button
              onClick={handleBulkCancel}
              className="flex items-center gap-1.5 text-[12px] font-bold bg-black/5 dark:bg-white/5 text-[#122222] dark:text-white hover:bg-black/10 dark:hover:bg-white/10 border border-black/10 dark:border-white/10 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
            >
              <Clock size={13} />
              {t("reservations.cancelSelected") || "Cancel Selected"}
            </button>

            <button
              onClick={() => {
                if (confirm(`PERMANENTLY DELETE ${selectedIds.length} selected reservation(s)? This action cannot be undone.`)) {
                  bulkDeleteMutation.mutate();
                }
              }}
              className="flex items-center gap-1.5 text-[12px] font-bold bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-xl shadow-sm transition-colors cursor-pointer"
            >
              <Trash2 size={13} />
              {t("reservations.bulk.deleteSelected") || "Delete Permanently"}
            </button>
          </div>
        </div>
      )}

      {/* Reservation Details Modal */}
      <ReservationDetailsModal
        reservation={selectedReservationDetails}
        onClose={() => setSelectedReservationDetails(null)}
        onCancel={(id) => {
          if (confirm(t("reservations.alerts.confirmCancel") || "Cancel this reservation?")) {
            cancelMutation.mutate(id);
          }
        }}
        onDelete={(id) => {
          if (confirm("Permanently delete this reservation?")) {
            deleteMutation.mutate(id);
          }
        }}
        onMarkReady={(id) => markReadyMutation.mutate(id)}
        onExtend={(id) => extendMutation.mutate(id)}
      />

      {/* New Reservation Modal */}
      <NewReservationModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
      />
    </div>
  );
}function ReservationDetailsModal({
  reservation,
  onClose,
  onCancel,
  onDelete,
  onMarkReady,
  onExtend
}: {
  reservation: Reservation | null;
  onClose: () => void;
  onCancel: (id: string) => void;
  onDelete: (id: string) => void;
  onMarkReady: (id: string) => void;
  onExtend: (id: string) => void;
}) {
  const { t } = useTranslation();
  if (!reservation) return null;

  return (
    <Modal
      isOpen={!!reservation}
      onClose={onClose}
      title={t("reservations.detailsModal.title") || "Reservation Details"}
      size="lg"
      className="max-h-[85vh] overflow-y-auto"
    >
      <div className="space-y-5">
        {/* Header Status & Queue Banner */}
        <div className="bg-[#fcfbf8] dark:bg-[#111d1a] border border-black/10 dark:border-white/10 p-4 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1.5 rounded-full text-[12px] font-bold ${
              reservation.status === 'ready' 
                ? 'bg-emerald/10 text-emerald dark:bg-emerald-light/20 dark:text-emerald-light' 
                : reservation.status === 'queued'
                ? 'bg-copper/10 text-copper'
                : 'bg-gray-500/10 text-gray-500'
            }`}>
              {reservation.status === 'ready' 
                ? t("reservations.status.ready") || "Ready for Pickup" 
                : reservation.status === 'queued' 
                ? t("reservations.status.queued") || "Queued in Line" 
                : reservation.status}
            </span>
            <span className="text-[12px] font-bold text-[#122222]/70 dark:text-white/70 bg-black/5 dark:bg-white/5 px-2.5 py-1 rounded-lg">
              Queue Position #{reservation.position || 1}
            </span>
          </div>

          <div className="text-[11px] font-mono text-[#122222]/50 dark:text-white/50">
            ID: {reservation.id.slice(0, 8)}
          </div>
        </div>

        {/* 2-Column Details Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Left Column: Book / Title Information */}
          <div className="border border-black/10 dark:border-white/10 rounded-2xl p-4 space-y-4 bg-white dark:bg-[#1d2926]">
            <h4 className="text-[12px] font-bold uppercase tracking-wider text-[#122222]/60 dark:text-white/60 flex items-center gap-2">
              <BookOpen size={16} className="text-emerald" />
              {t("reservations.addModal.summaryItem") || "Book / Item Information"}
            </h4>

            <div className="flex gap-4">
              {reservation.cover_path ? (
                <img 
                  src={reservation.cover_path} 
                  alt={reservation.title || ""} 
                  className="w-20 h-28 object-cover rounded-xl shadow border border-black/10 dark:border-white/10 shrink-0" 
                />
              ) : (
                <div className="w-20 h-28 bg-black/5 dark:bg-white/5 rounded-xl border border-black/10 dark:border-white/10 flex items-center justify-center text-[#122222]/40 shrink-0">
                  <BookOpen size={32} />
                </div>
              )}

              <div className="space-y-1.5 flex-1 min-w-0">
                <h3 className="font-bold text-[15px] text-[#122222] dark:text-white leading-snug line-clamp-2">
                  {reservation.title}
                </h3>
                {reservation.subtitle && (
                  <p className="text-[12px] text-[#122222]/70 dark:text-white/70 line-clamp-1">
                    {reservation.subtitle}
                  </p>
                )}
                {reservation.author && (
                  <p className="text-[12px] font-semibold text-emerald dark:text-emerald-light">
                    {reservation.author}
                  </p>
                )}

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {reservation.item_type && <ItemTypeBadge type={reservation.item_type} />}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Member & Copy Information */}
          <div className="border border-black/10 dark:border-white/10 rounded-2xl p-4 space-y-4 bg-white dark:bg-[#1d2926]">
            <h4 className="text-[12px] font-bold uppercase tracking-wider text-[#122222]/60 dark:text-white/60 flex items-center gap-2">
              <UserCheck size={16} className="text-emerald" />
              {t("reservations.addModal.summaryMember") || "Borrower / Member"}
            </h4>

            <div className="flex items-center gap-3">
              {reservation.member_avatar ? (
                <img src={reservation.member_avatar} alt="" className="w-10 h-10 rounded-full object-cover shadow-sm border border-black/10 dark:border-white/10" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-emerald/10 text-emerald dark:bg-emerald-light/10 dark:text-emerald-light font-bold text-[14px] flex items-center justify-center shrink-0">
                  {reservation.member_name?.charAt(0).toUpperCase() || "M"}
                </div>
              )}
              <div>
                <div className="font-bold text-[14px] text-[#122222] dark:text-white">{reservation.member_name}</div>
                {reservation.member_number && (
                  <div className="text-[12px] font-mono text-[#122222]/50 dark:text-white/50">{reservation.member_number}</div>
                )}
              </div>
            </div>

            {/* Hold Dates Card */}
            <div className="border border-black/10 dark:border-white/10 rounded-xl p-3 space-y-2 bg-[#fcfbf8] dark:bg-[#111d1a] text-[12px]">
              <div className="flex items-center justify-between">
                <span className="text-[#122222]/60 dark:text-white/60 flex items-center gap-1.5">
                  <Clock size={14} /> Request Date:
                </span>
                <span className="font-semibold text-[#122222] dark:text-white">
                  {formatDisplayDate(reservation.reserved_at)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#122222]/60 dark:text-white/60 flex items-center gap-1.5">
                  <Calendar size={14} /> Hold Expires On:
                </span>
                <span className="font-semibold text-amber-600 dark:text-amber-400">
                  {reservation.expires_at ? formatDisplayDate(reservation.expires_at) : "—"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-black/10 dark:border-white/10 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {reservation.status === 'queued' && (
              <Button
                type="button"
                className="bg-emerald text-white hover:bg-emerald/90 text-[12px] flex items-center gap-1.5 cursor-pointer"
                onClick={() => {
                  onMarkReady(reservation.id);
                  onClose();
                }}
              >
                <CheckCircle2 size={14} />
                Mark Ready
              </Button>
            )}

            {(reservation.status === 'ready' || reservation.status === 'queued') && (
              <Button
                type="button"
                variant="secondary"
                className="text-amber-700 border-amber-300 hover:bg-amber-50 text-[12px] flex items-center gap-1.5 cursor-pointer"
                onClick={() => {
                  onExtend(reservation.id);
                  onClose();
                }}
              >
                <Calendar size={14} />
                Extend Hold (+7 Days)
              </Button>
            )}

            {(reservation.status === 'queued' || reservation.status === 'ready') && (
              <Button
                type="button"
                variant="secondary"
                className="text-orange-600 hover:text-orange-700 border-orange-200 hover:border-orange-300 text-[12px] cursor-pointer"
                onClick={() => {
                  onCancel(reservation.id);
                  onClose();
                }}
              >
                Cancel Reservation
              </Button>
            )}

            <Button
              type="button"
              variant="secondary"
              className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300 text-[12px] flex items-center gap-1.5 cursor-pointer"
              onClick={() => {
                onDelete(reservation.id);
                onClose();
              }}
            >
              <Trash2 size={14} />
              Delete Permanently
            </Button>
          </div>

          <Button type="button" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}

interface NewReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function NewReservationModal({ isOpen, onClose }: NewReservationModalProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: Member / Visitor state & filters
  const [mode, setMode] = useState<"registered" | "visitor">("registered");
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedDept, setSelectedDept] = useState("all");
  const [selectedRole, setSelectedRole] = useState("all");
  
  const [visitorName, setVisitorName] = useState("");
  const [visitorEmail, setVisitorEmail] = useState("");
  const [visitorPhone, setVisitorPhone] = useState("");
  const [visitorDept, setVisitorDept] = useState("");

  // Step 2: Book / Item state & filters
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [bookSearch, setBookSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedItemType, setSelectedItemType] = useState("all");
  const [availabilityFilter, setAvailabilityFilter] = useState<"all" | "available" | "out_of_stock">("all");

  // Step 3: Physical Copy state
  const [selectedCopy, setSelectedCopy] = useState<Copy | null>(null);

  // Step 4: Duration state
  const [durationDays, setDurationDays] = useState<number>(7);
  const [customDate, setCustomDate] = useState<string>("");

  // Queries
  const membersQuery = useQuery({
    queryKey: ["members", memberSearch],
    queryFn: () => members(memberSearch),
    enabled: isOpen && mode === "registered"
  });

  const booksQuery = useQuery({
    queryKey: ["books", bookSearch],
    queryFn: () => books(bookSearch),
    enabled: isOpen && step === 2
  });

  const copiesQuery = useQuery({
    queryKey: ["copies", selectedBook?.id],
    queryFn: () => (selectedBook?.id ? getCopiesForBook(selectedBook.id) : Promise.resolve([])),
    enabled: isOpen && step === 3 && !!selectedBook?.id
  });

  // Extract unique departments & roles for filtering
  const departmentOptions = useMemo(() => {
    if (!membersQuery.data) return [];
    const depts = new Set<string>();
    membersQuery.data.forEach(m => {
      if (m.department?.trim()) depts.add(m.department.trim());
    });
    return Array.from(depts);
  }, [membersQuery.data]);

  const roleOptions = useMemo(() => {
    if (!membersQuery.data) return [];
    const roles = new Set<string>();
    membersQuery.data.forEach(m => {
      if (m.role?.trim()) roles.add(m.role.trim());
    });
    return Array.from(roles);
  }, [membersQuery.data]);

  // Extract unique categories & item types for book filtering
  const categoryOptions = useMemo(() => {
    if (!booksQuery.data) return [];
    const cats = new Set<string>();
    booksQuery.data.forEach(b => {
      if (b.category?.trim()) cats.add(b.category.trim());
    });
    return Array.from(cats);
  }, [booksQuery.data]);

  const itemTypeOptions = useMemo(() => {
    if (!booksQuery.data) return [];
    const types = new Set<string>();
    booksQuery.data.forEach(b => {
      if (b.item_type?.trim()) types.add(b.item_type.trim());
    });
    return Array.from(types);
  }, [booksQuery.data]);

  // Filtered members list
  const filteredMembersList = useMemo(() => {
    if (!membersQuery.data) return [];
    return membersQuery.data.filter(m => {
      if (selectedDept !== "all" && m.department !== selectedDept) return false;
      if (selectedRole !== "all" && m.role !== selectedRole) return false;
      return true;
    });
  }, [membersQuery.data, selectedDept, selectedRole]);

  // Filtered books list
  const filteredBooksList = useMemo(() => {
    if (!booksQuery.data) return [];
    return booksQuery.data.filter(b => {
      if (selectedCategory !== "all" && b.category !== selectedCategory) return false;
      if (selectedItemType !== "all" && b.item_type !== selectedItemType) return false;
      const avail = b.available_copies ?? 0;
      if (availabilityFilter === "available" && avail <= 0) return false;
      if (availabilityFilter === "out_of_stock" && avail > 0) return false;
      return true;
    });
  }, [booksQuery.data, selectedCategory, selectedItemType, availabilityFilter]);

  // Expiration calculation
  const expiresAtDate = useMemo(() => {
    if (customDate) return new Date(customDate);
    const d = new Date();
    d.setDate(d.getDate() + durationDays);
    return d;
  }, [durationDays, customDate]);

  // Create Reservation Mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      let targetMemberId = selectedMember?.id;
      let targetMemberName = selectedMember?.full_name || visitorName;

      // Handle visitor creation if visitor mode is active
      if (mode === "visitor") {
        if (!visitorName.trim()) {
          throw new Error(t("reservations.alerts.fillVisitorName") || "Please enter the visitor's full name.");
        }
        const visitorNumber = `VIS-${Math.floor(100000 + Math.random() * 900000)}`;
        const newVisitor = await saveMember({
          full_name: visitorName.trim(),
          email: visitorEmail.trim() || null,
          phone: visitorPhone.trim() || null,
          department: visitorDept.trim() || "Visitor",
          role: "Visitor",
          status: "active",
          member_number: visitorNumber
        });
        targetMemberId = newVisitor.id;
      }

      if (!targetMemberId) {
        throw new Error(t("reservations.alerts.selectMember") || "Please select a member or fill visitor details.");
      }
      if (!selectedBook?.id) {
        throw new Error(t("reservations.alerts.selectItem") || "Please select an item to reserve.");
      }

      const expiresAtIso = expiresAtDate.toISOString().split("T")[0];
      await addReservation(selectedBook.id, targetMemberId, expiresAtIso, selectedCopy?.id ?? null);
      return targetMemberName;
    },
    onSuccess: (memberName) => {
      invalidate();
      toast.success(
        t("reservations.alerts.reservationCreated", { name: memberName }) || 
        `Reservation created for ${memberName}.`
      );
      handleClose();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create reservation.");
    }
  });

  const handleClose = () => {
    setStep(1);
    setMode("registered");
    setSelectedMember(null);
    setMemberSearch("");
    setSelectedDept("all");
    setSelectedRole("all");
    setVisitorName("");
    setVisitorEmail("");
    setVisitorPhone("");
    setVisitorDept("");
    setSelectedBook(null);
    setSelectedCopy(null);
    setBookSearch("");
    setSelectedCategory("all");
    setSelectedItemType("all");
    setAvailabilityFilter("all");
    setDurationDays(7);
    setCustomDate("");
    onClose();
  };

  const isStep1Valid = mode === "registered" ? !!selectedMember : visitorName.trim().length > 0;
  const isStep2Valid = !!selectedBook;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t("reservations.addModal.title") || "New Reservation"}
      size="xl"
      className="h-[84vh] min-h-[580px] max-h-[820px]"
    >
      {/* Stepper Header (Fixed at top of modal body) */}
      <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-3 mb-4 text-[12px] font-bold shrink-0">
        <div className={`flex items-center gap-2 ${step === 1 ? "text-emerald dark:text-emerald-light font-extrabold" : "text-[#122222]/40 dark:text-white/40"}`}>
          <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] ${step === 1 ? "bg-emerald text-white shadow-sm" : "bg-black/10 dark:bg-white/10"}`}>1</span>
          <span className="text-[13px]">{t("reservations.addModal.stepMember") || "1. Member / Visitor"}</span>
        </div>
        <ChevronRight size={16} className="text-[#122222]/30 dark:text-white/30" />
        <div className={`flex items-center gap-2 ${step === 2 ? "text-emerald dark:text-emerald-light font-extrabold" : "text-[#122222]/40 dark:text-white/40"}`}>
          <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] ${step === 2 ? "bg-emerald text-white shadow-sm" : "bg-black/10 dark:bg-white/10"}`}>2</span>
          <span className="text-[13px]">{t("reservations.addModal.stepItem") || "2. Select Item"}</span>
        </div>
        <ChevronRight size={16} className="text-[#122222]/30 dark:text-white/30" />
        <div className={`flex items-center gap-2 ${step === 3 ? "text-emerald dark:text-emerald-light font-extrabold" : "text-[#122222]/40 dark:text-white/40"}`}>
          <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] ${step === 3 ? "bg-emerald text-white shadow-sm" : "bg-black/10 dark:bg-white/10"}`}>3</span>
          <span className="text-[13px]">{t("reservations.addModal.stepCopy") || "3. Select Copy & Location"}</span>
        </div>
        <ChevronRight size={16} className="text-[#122222]/30 dark:text-white/30" />
        <div className={`flex items-center gap-2 ${step === 4 ? "text-emerald dark:text-emerald-light font-extrabold" : "text-[#122222]/40 dark:text-white/40"}`}>
          <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] ${step === 4 ? "bg-emerald text-white shadow-sm" : "bg-black/10 dark:bg-white/10"}`}>4</span>
          <span className="text-[13px]">{t("reservations.addModal.stepDuration") || "4. Duration & Review"}</span>
        </div>
      </div>

      {/* Step 1: Member or Visitor */}
      {step === 1 && (
        <div className="flex-1 min-h-0 flex flex-col justify-between">
          <div className="flex-1 min-h-0 flex flex-col space-y-3">
            {/* Mode Switcher Tabs */}
            <div className="grid grid-cols-2 p-1 bg-black/5 dark:bg-white/5 rounded-xl text-[13px] font-semibold shrink-0">
              <button
                type="button"
                onClick={() => setMode("registered")}
                className={`flex items-center justify-center gap-2 py-2 rounded-lg transition-all cursor-pointer ${
                  mode === "registered" 
                    ? "bg-white dark:bg-[#1d2926] text-emerald dark:text-emerald-light shadow-sm font-bold" 
                    : "text-[#122222]/60 dark:text-white/60 hover:text-[#122222] dark:hover:text-white"
                }`}
              >
                <UserCheck size={18} />
                {t("reservations.addModal.tabRegistered") || "Registered Member"}
              </button>
              <button
                type="button"
                onClick={() => setMode("visitor")}
                className={`flex items-center justify-center gap-2 py-2 rounded-lg transition-all cursor-pointer ${
                  mode === "visitor" 
                    ? "bg-white dark:bg-[#1d2926] text-emerald dark:text-emerald-light shadow-sm font-bold" 
                    : "text-[#122222]/60 dark:text-white/60 hover:text-[#122222] dark:hover:text-white"
                }`}
              >
                <UserPlus size={18} />
                {t("reservations.addModal.tabVisitor") || "Visitor / Guest"}
              </button>
            </div>

            {/* Registered Member Tab Content */}
            {mode === "registered" ? (
              <div className="flex-1 min-h-0 flex flex-col space-y-3">
                {/* Search & Filters Toolbar */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 shrink-0">
                  <div className="md:col-span-1 relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#122222]/40" />
                    <Input
                      type="text"
                      placeholder={t("reservations.addModal.searchMemberPlaceholder") || "Search member by name, ID, email..."}
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>

                  {/* Department Filter */}
                  <div>
                    <select
                      value={selectedDept}
                      onChange={(e) => setSelectedDept(e.target.value)}
                      className="w-full bg-white dark:bg-[#1d2926] border border-black/15 dark:border-white/15 rounded-control py-2 px-3 text-sm text-[#122222] dark:text-white outline-none focus:border-emerald font-semibold cursor-pointer"
                    >
                      <option value="all">{t("reservations.addModal.filterDept") || "All Departments"}</option>
                      {departmentOptions.map(dept => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  </div>

                  {/* Role Filter */}
                  <div>
                    <select
                      value={selectedRole}
                      onChange={(e) => setSelectedRole(e.target.value)}
                      className="w-full bg-white dark:bg-[#1d2926] border border-black/15 dark:border-white/15 rounded-control py-2 px-3 text-sm text-[#122222] dark:text-white outline-none focus:border-emerald font-semibold cursor-pointer"
                    >
                      <option value="all">{t("reservations.addModal.filterRole") || "All Roles"}</option>
                      {roleOptions.map(role => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Members Scrollable Grid / List */}
                <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-black/5 dark:divide-white/5 border border-black/10 dark:border-white/10 rounded-xl bg-white dark:bg-[#1d2926]">
                  {membersQuery.isLoading ? (
                    <div className="p-6 text-center text-xs text-[#122222]/50">Loading members...</div>
                  ) : filteredMembersList.length > 0 ? (
                    filteredMembersList.map((mem) => {
                      const isSelected = selectedMember?.id === mem.id;
                      return (
                        <div
                          key={mem.id}
                          onClick={() => setSelectedMember(mem)}
                          className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${
                            isSelected ? "bg-emerald/10 dark:bg-emerald/20 border-l-4 border-emerald" : "hover:bg-black/5 dark:hover:bg-white/5"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {mem.avatar_path ? (
                              <img src={mem.avatar_path} alt="" className="w-9 h-9 rounded-full object-cover shadow-sm shrink-0 border border-black/10 dark:border-white/10" />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-emerald/10 dark:bg-emerald-light/10 text-emerald dark:text-emerald-light font-bold text-[13px] flex items-center justify-center shrink-0">
                                {mem.full_name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <div className="text-[13px] font-bold text-[#122222] dark:text-white flex items-center gap-2">
                                {mem.full_name}
                                <span className="text-[11px] font-mono font-medium text-[#122222]/50 dark:text-white/50">({mem.member_number})</span>
                              </div>
                              <div className="text-[11px] text-[#122222]/60 dark:text-white/60 flex items-center gap-3 mt-0.5">
                                <span>{mem.department || "General"}</span>
                                <span>•</span>
                                <span>{mem.role || "Member"}</span>
                                {mem.email && (
                                  <>
                                    <span>•</span>
                                    <span className="opacity-80">{mem.email}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {isSelected && (
                            <div className="flex items-center gap-1.5 text-emerald dark:text-emerald-light font-bold text-[12px]">
                              <CheckCircle2 size={18} />
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-6 text-center text-xs text-[#122222]/50">
                      {t("reservations.addModal.noMembersFound") || "No members found matching your search or filters."}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Visitor / Guest Form Content */
              <div className="space-y-3 bg-[#fcfbf8] dark:bg-[#111d1a] p-4 rounded-2xl border border-black/5 dark:border-white/5 overflow-y-auto">
                <div className="p-2.5 rounded-xl bg-emerald/10 text-emerald dark:text-emerald-light text-[12px] font-semibold flex items-center gap-2">
                  <UserPlus size={16} />
                  {t("reservations.addModal.visitorNotice") || "A guest/visitor profile will be automatically linked for this reservation."}
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[#122222]/80 dark:text-white/80 block mb-1">
                    {t("reservations.addModal.visitorName") || "Visitor Full Name"} *
                  </label>
                  <Input
                    type="text"
                    placeholder={t("reservations.addModal.visitorNamePlaceholder") || "e.g. John Doe (Visitor)"}
                    value={visitorName}
                    onChange={(e) => setVisitorName(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-[#122222]/80 dark:text-white/80 block mb-1">
                      {t("reservations.addModal.visitorEmail") || "Email (Optional)"}
                    </label>
                    <Input
                      type="email"
                      placeholder="visitor@example.com"
                      value={visitorEmail}
                      onChange={(e) => setVisitorEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-[#122222]/80 dark:text-white/80 block mb-1">
                      {t("reservations.addModal.visitorPhone") || "Phone (Optional)"}
                    </label>
                    <Input
                      type="tel"
                      placeholder="0550123456"
                      value={visitorPhone}
                      onChange={(e) => setVisitorPhone(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[#122222]/80 dark:text-white/80 block mb-1">
                    {t("reservations.addModal.visitorDept") || "Department / Organization"}
                  </label>
                  <Input
                    type="text"
                    placeholder="Visitor / Guest / External"
                    value={visitorDept}
                    onChange={(e) => setVisitorDept(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Fixed Footer Buttons Bar */}
          <div className="pt-3 mt-3 border-t border-black/10 dark:border-white/10 flex items-center justify-end shrink-0">
            <Button
              type="button"
              disabled={!isStep1Valid}
              onClick={() => setStep(2)}
            >
              {t("reservations.addModal.nextItem") || "Next: Select Item"}
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Book / Item Selection (Full Vertical Height) */}
      {step === 2 && (
        <div className="flex-1 min-h-0 flex flex-col justify-between">
          <div className="flex-1 min-h-0 flex flex-col space-y-3">
            {/* Search & Filtering Options Header */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 shrink-0">
              <div className="md:col-span-1 relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#122222]/40" />
                <Input
                  type="text"
                  placeholder={t("reservations.addModal.searchItemPlaceholder") || "Search book title, author, ISBN..."}
                  value={bookSearch}
                  onChange={(e) => setBookSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Category Filter */}
              <div>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full bg-white dark:bg-[#1d2926] border border-black/15 dark:border-white/15 rounded-control py-2 px-3 text-sm text-[#122222] dark:text-white outline-none focus:border-emerald font-semibold cursor-pointer"
                >
                  <option value="all">{t("reservations.addModal.filterCategory") || "All Categories"}</option>
                  {categoryOptions.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Item Type Filter */}
              <div>
                <select
                  value={selectedItemType}
                  onChange={(e) => setSelectedItemType(e.target.value)}
                  className="w-full bg-white dark:bg-[#1d2926] border border-black/15 dark:border-white/15 rounded-control py-2 px-3 text-sm text-[#122222] dark:text-white outline-none focus:border-emerald font-semibold cursor-pointer"
                >
                  <option value="all">{t("reservations.addModal.filterType") || "All Item Types"}</option>
                  {itemTypeOptions.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              {/* Availability Filter */}
              <div>
                <select
                  value={availabilityFilter}
                  onChange={(e) => setAvailabilityFilter(e.target.value as any)}
                  className="w-full bg-white dark:bg-[#1d2926] border border-black/15 dark:border-white/15 rounded-control py-2 px-3 text-sm text-[#122222] dark:text-white outline-none focus:border-emerald font-semibold cursor-pointer"
                >
                  <option value="all">{t("reservations.addModal.filterAvailability") || "All Availability"}</option>
                  <option value="available">{t("reservations.addModal.availableOnly") || "Available Only"}</option>
                  <option value="out_of_stock">{t("reservations.addModal.outOfStockOnly") || "Out of Stock Only"}</option>
                </select>
              </div>
            </div>

            {/* Book Selection List (Expands to fill 100% of middle available space) */}
            <div className="flex-1 min-h-0 flex flex-col">
              <label className="text-[11px] font-bold text-[#122222]/70 dark:text-white/70 block mb-1 uppercase tracking-wider shrink-0">
                Select Book Title / Item
              </label>
              <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-black/5 dark:divide-white/5 border border-black/10 dark:border-white/10 rounded-xl bg-white dark:bg-[#1d2926]">
                {booksQuery.isLoading ? (
                  <div className="p-6 text-center text-xs text-[#122222]/50">Loading catalog items...</div>
                ) : filteredBooksList.length > 0 ? (
                  filteredBooksList.map((bk) => {
                    const isSelected = selectedBook?.id === bk.id;
                    const availableCount = bk.available_copies ?? 0;
                    const totalCount = bk.total_copies ?? 0;
                    return (
                      <div
                        key={bk.id}
                        onClick={() => {
                          setSelectedBook(bk);
                          setSelectedCopy(null);
                        }}
                        className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${
                          isSelected ? "bg-emerald/10 dark:bg-emerald/20 border-l-4 border-emerald" : "hover:bg-black/5 dark:hover:bg-white/5"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {bk.cover_path ? (
                            <img src={bk.cover_path} alt="" className="w-9 h-12 object-cover rounded shadow-sm" />
                          ) : (
                            <div className="w-9 h-12 bg-black/5 dark:bg-white/5 rounded flex items-center justify-center text-[#122222]/40">
                              <BookOpen size={18} />
                            </div>
                          )}
                          <div>
                            <div className="text-[13px] font-bold text-[#122222] dark:text-white line-clamp-1">
                              {bk.title}
                            </div>
                            <div className="text-[11px] text-[#122222]/60 dark:text-white/60 flex items-center gap-2 mt-0.5">
                              <span>{bk.author || "Unknown Author"}</span>
                              <ItemTypeBadge type={bk.item_type} />
                              {bk.category && (
                                <span className="text-[10px] bg-black/5 dark:bg-white/5 px-1.5 py-0.5 rounded font-medium">
                                  {bk.category}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                            availableCount > 0 
                              ? "bg-emerald/10 text-emerald dark:bg-emerald-light/20 dark:text-emerald-light" 
                              : "bg-copper/10 text-copper"
                          }`}>
                            {availableCount > 0 
                              ? t("reservations.addModal.availableCopies", { available: availableCount, total: totalCount }) || `${availableCount}/${totalCount} available`
                              : t("reservations.addModal.outOfStock", { total: totalCount }) || `Out of stock (${totalCount})`}
                          </span>
                          {isSelected && (
                            <CheckCircle2 size={18} className="text-emerald dark:text-emerald-light" />
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-6 text-center text-xs text-[#122222]/50">
                    {t("reservations.addModal.noItemsFound") || "No items found matching your search or filters."}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Fixed Footer Buttons Bar */}
          <div className="pt-3 mt-3 border-t border-black/10 dark:border-white/10 flex items-center justify-between shrink-0">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setStep(1)}
            >
              {t("reservations.addModal.back") || "Back"}
            </Button>
            <Button
              type="button"
              disabled={!isStep2Valid}
              onClick={() => setStep(3)}
            >
              {t("reservations.addModal.nextCopy") || "Next: Select Copy & Location"}
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Physical Copy & Location Selection */}
      {step === 3 && (
        <div className="flex-1 min-h-0 flex flex-col justify-between">
          <div className="flex-1 min-h-0 flex flex-col space-y-3">
            {/* Selected Book Summary Header Banner */}
            {selectedBook && (
              <div className="bg-[#fcfbf8] dark:bg-[#111d1a] border border-black/10 dark:border-white/10 rounded-2xl p-3 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  {selectedBook.cover_path ? (
                    <img src={selectedBook.cover_path} alt="" className="w-9 h-12 object-cover rounded shadow-sm" />
                  ) : (
                    <div className="w-9 h-12 bg-black/5 dark:bg-white/5 rounded flex items-center justify-center text-[#122222]/40">
                      <BookOpen size={18} />
                    </div>
                  )}
                  <div>
                    <div className="text-[13px] font-bold text-[#122222] dark:text-white">
                      {selectedBook.title}
                    </div>
                    <div className="text-[11px] text-[#122222]/60 dark:text-white/60 flex items-center gap-2 mt-0.5">
                      <span>{selectedBook.author || "Unknown Author"}</span>
                      <ItemTypeBadge type={selectedBook.item_type} />
                      {selectedBook.category && (
                        <span className="text-[10px] bg-black/5 dark:bg-white/5 px-1.5 py-0.5 rounded font-medium">
                          {selectedBook.category}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-[#122222]/60 dark:text-white/60 block font-medium">
                    {copiesQuery.data?.length ?? 0} physical copy/copies total
                  </span>
                  <span className="text-[11px] font-bold text-emerald dark:text-emerald-light">
                    {selectedBook.available_copies ?? 0} available right now
                  </span>
                </div>
              </div>
            )}

            {/* Copies Selection List Container */}
            <div className="flex-1 min-h-0 flex flex-col space-y-2.5">
              <label className="text-[11px] font-bold text-[#122222]/70 dark:text-white/70 block uppercase tracking-wider shrink-0 flex items-center gap-2">
                <Layers size={15} className="text-emerald" />
                {t("reservations.addModal.selectCopy") || "Select Physical Copy & Shelf Location"}
              </label>

              {/* Default Option: Any Available Copy */}
              <div
                onClick={() => setSelectedCopy(null)}
                className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all shrink-0 ${
                  selectedCopy === null 
                    ? "bg-white dark:bg-[#1d2926] border-emerald ring-2 ring-emerald/20 shadow-sm font-bold" 
                    : "border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 bg-white/60 dark:bg-[#1d2926]/60 opacity-90"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Tag size={16} className="text-emerald" />
                  <div>
                    <div className="text-[13px] font-bold text-[#122222] dark:text-white">
                      {t("reservations.addModal.anyAvailableCopy") || "Any Available Copy (Auto-assign upon return)"}
                    </div>
                    <div className="text-[11px] text-[#122222]/60 dark:text-white/60 font-normal">
                      {t("reservations.addModal.anyAvailableDesc") || "Recommended if any available physical copy can be assigned when pickup occurs."}
                    </div>
                  </div>
                </div>
                {selectedCopy === null && (
                  <CheckCircle2 size={18} className="text-emerald dark:text-emerald-light" />
                )}
              </div>

              {/* Specific Copies Grid / Scrollable List (Fills Available Space) */}
              <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
                {copiesQuery.isLoading ? (
                  <div className="text-xs text-center py-6 text-[#122222]/50">Loading physical copies & shelf locations...</div>
                ) : copiesQuery.data && copiesQuery.data.length > 0 ? (
                  copiesQuery.data.map((cp) => {
                    const isCopySelected = selectedCopy?.id === cp.id;
                    return (
                      <div
                        key={cp.id}
                        onClick={() => setSelectedCopy(cp)}
                        className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer text-[12px] transition-all ${
                          isCopySelected
                            ? "bg-white dark:bg-[#1d2926] border-emerald ring-2 ring-emerald/20 shadow-md font-bold"
                            : "border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 bg-white/80 dark:bg-[#1d2926]/80"
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          {/* Prominent Location Badge */}
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald/10 text-emerald dark:bg-emerald-light/20 dark:text-emerald-light font-extrabold text-[12px]">
                            <MapPin size={14} />
                            <span>{cp.shelf ? `Shelf: ${cp.shelf}` : "Unassigned Shelf"}</span>
                          </div>

                          <div>
                            <div className="font-mono font-bold text-[#122222] dark:text-white flex items-center gap-2 text-[12px]">
                              <Hash size={13} className="opacity-50" />
                              {cp.barcode}
                            </div>
                            <div className="text-[11px] text-[#122222]/60 dark:text-white/60 flex items-center gap-3 mt-0.5">
                              <span>Index: <strong className="font-mono font-semibold text-[#122222] dark:text-white">{cp.accession_number}</strong></span>
                              <span>•</span>
                              <span>Condition: <strong className="capitalize">{cp.condition || "good"}</strong></span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <StatusBadge value={cp.status} />
                          {isCopySelected && (
                            <CheckCircle2 size={18} className="text-emerald dark:text-emerald-light" />
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-xs text-center py-6 text-[#122222]/50 italic">
                    {t("reservations.addModal.noCopiesFound") || "No physical copies recorded for this item."}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Fixed Footer Buttons Bar */}
          <div className="pt-3 mt-3 border-t border-black/10 dark:border-white/10 flex items-center justify-between shrink-0">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setStep(2)}
            >
              {t("reservations.addModal.back") || "Back"}
            </Button>
            <Button
              type="button"
              onClick={() => setStep(4)}
            >
              {t("reservations.addModal.nextDuration") || "Next: Duration & Review"}
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Hold Duration & Review */}
      {step === 4 && (
        <div className="flex-1 min-h-0 flex flex-col justify-between">
          <div className="flex-1 min-h-0 flex flex-col space-y-4 overflow-y-auto">
            {/* Duration Selector */}
            <div className="shrink-0">
              <label className="text-[12px] font-bold text-[#122222] dark:text-white block mb-2">
                {t("reservations.addModal.durationLabel") || "Hold Expiration Duration"}
              </label>

              {/* 5-Option Grid: Predefined Durations + Custom Date */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[3, 7, 14, 30].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      setDurationDays(d);
                      setCustomDate("");
                    }}
                    className={`py-3 px-2 rounded-xl text-[13px] font-bold border transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                      durationDays === d && !customDate
                        ? "bg-emerald text-white border-emerald shadow-sm ring-2 ring-emerald/20"
                        : "border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-[#122222] dark:text-white bg-white dark:bg-[#1d2926]"
                    }`}
                  >
                    <Clock size={16} className={durationDays === d && !customDate ? "text-white" : "text-emerald"} />
                    <span>{t("reservations.addModal.days" + d) || `${d} Days`}</span>
                  </button>
                ))}

                {/* Custom Date Option */}
                <button
                  type="button"
                  onClick={() => {
                    if (!customDate) {
                      const defaultCustom = new Date();
                      defaultCustom.setDate(defaultCustom.getDate() + 10);
                      setCustomDate(defaultCustom.toISOString().split("T")[0]);
                    }
                  }}
                  className={`py-3 px-2 rounded-xl text-[13px] font-bold border transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                    !!customDate
                      ? "bg-emerald text-white border-emerald shadow-sm ring-2 ring-emerald/20"
                      : "border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-[#122222] dark:text-white bg-white dark:bg-[#1d2926]"
                  }`}
                >
                  <Calendar size={16} className={!!customDate ? "text-white" : "text-emerald"} />
                  <span>{t("reservations.addModal.customDate") || "Custom Date"}</span>
                </button>
              </div>

              {/* Custom Date Picker Input (Revealed when Custom Date option is active) */}
              {!!customDate && (
                <div className="mt-3.5 p-3 rounded-xl bg-emerald/5 dark:bg-emerald-light/10 border border-emerald/20 animate-in fade-in duration-200">
                  <label className="text-[11px] font-bold text-emerald dark:text-emerald-light block mb-1.5 flex items-center gap-1.5">
                    <Calendar size={14} />
                    {t("reservations.addModal.customDate") || "Select Specific Expiry Date"}
                  </label>
                  <Input
                    type="date"
                    min={today()}
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                    className="bg-white dark:bg-[#1d2926]"
                  />
                </div>
              )}
            </div>

            {/* Summary Preview Card */}
            <div className="bg-[#fcfbf8] dark:bg-[#111d1a] border border-black/10 dark:border-white/10 rounded-2xl p-4 space-y-3 shrink-0">
              <h4 className="text-[11px] font-bold text-[#122222]/60 dark:text-white/60 uppercase tracking-wider">
                {t("reservations.addModal.summaryTitle") || "Reservation Details Summary"}
              </h4>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-[13px]">
                <div>
                  <span className="text-[#122222]/60 dark:text-white/60 text-[11px] block mb-0.5">
                    {t("reservations.addModal.summaryMember") || "Member / Visitor"}
                  </span>
                  <span className="font-bold text-[#122222] dark:text-white block">
                    {mode === "registered" ? selectedMember?.full_name : `${visitorName} (Visitor)`}
                  </span>
                  <span className="text-[11px] text-[#122222]/50 dark:text-white/50 block">
                    {mode === "registered" ? selectedMember?.member_number : visitorDept || "Guest"}
                  </span>
                </div>

                <div>
                  <span className="text-[#122222]/60 dark:text-white/60 text-[11px] block mb-0.5">
                    {t("reservations.addModal.summaryItem") || "Book / Item"}
                  </span>
                  <span className="font-bold text-[#122222] dark:text-white line-clamp-1 block">
                    {selectedBook?.title}
                  </span>
                  <span className="text-[11px] text-[#122222]/50 dark:text-white/50 block">
                    {selectedBook?.author || "Author"}
                  </span>
                </div>

                <div>
                  <span className="text-[#122222]/60 dark:text-white/60 text-[11px] block mb-0.5">
                    {t("reservations.addModal.copyBarcode") || "Physical Copy & Location"}
                  </span>
                  <span className="font-bold text-[#122222] dark:text-white block">
                    {selectedCopy ? selectedCopy.barcode : "Auto-assigned"}
                  </span>
                  <span className="text-[11px] font-bold text-emerald dark:text-emerald-light block mt-0.5">
                    {selectedCopy?.shelf ? `Shelf: ${selectedCopy.shelf}` : "Any available"}
                  </span>
                </div>

                <div>
                  <span className="text-[#122222]/60 dark:text-white/60 text-[11px] block mb-0.5">
                    {t("reservations.addModal.summaryExpires") || "Hold Expires On"}
                  </span>
                  <span className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5 mt-0.5">
                    <Calendar size={14} className="opacity-80" />
                    {formatDisplayDate(expiresAtDate.toISOString().split("T")[0])}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Fixed Footer Buttons Bar */}
          <div className="pt-3 mt-3 border-t border-black/10 dark:border-white/10 flex items-center justify-between shrink-0">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setStep(3)}
            >
              {t("reservations.addModal.back") || "Back"}
            </Button>
            <Button
              type="button"
              disabled={createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending 
                ? t("reservations.addModal.submitting") || "Creating..." 
                : t("reservations.addModal.submit") || "Create Reservation"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
