import { useState, useMemo, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Search, Clock, Trash2, Plus,
  UserCheck, BookOpen, Calendar, CheckCircle2,
  MapPin, Hash, XCircle, Eye, Copy as CopyIcon, Ban, Globe, Building2,
  Pencil, Check, X as XIcon, MoreVertical
} from "lucide-react";
import { useContextMenu } from "../components/ui/ContextMenu";
import { NewCirculationModal } from "../components/NewCirculationModal";


import {
  reservations, cancelReservation, deleteReservation, acceptReservation, declineReservation, extendReservation,
  banMember, updateReservation, fulfilReservation
} from "../data/repositories/library";
import { queryClient } from "../app/providers";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { formatDisplayDate } from "../utils/dates";
import { Modal, Button, ItemTypeBadge, PageLoader, DefaultCover } from "../components/ui/primitives";
import type { Reservation } from "../types";
import { useThemedAsset } from "../utils/useThemedAsset";

const invalidate = () => queryClient.invalidateQueries();

export function ReservationsPage() {
  const { t } = useTranslation();
  const noReservationsSrc = useThemedAsset("no-reservations");
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
    if (!result.data) return { all: 0, pending: 0, ready: 0, queued: 0, cancelled: 0, declined: 0 };
    const all = result.data.length;
    let pending = 0, ready = 0, queued = 0, cancelled = 0, declined = 0;
    result.data.forEach(r => {
      if (r.status === 'pending') pending++;
      else if (r.status === 'ready') ready++;
      else if (r.status === 'queued') queued++;
      else if (r.status === 'cancelled') cancelled++;
      else if (r.status === 'declined') declined++;
    });
    return { all, pending, ready, queued, cancelled, declined };
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

  const acceptMutation = useMutation({
    mutationFn: (id: string) => acceptReservation(id),
    onSuccess: () => {
      invalidate();
      toast.success(t("reservations.alerts.accepted") || "Reservation accepted.");
    },
    onError: (err: any) => toast.error(err.message)
  });

  const declineMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => declineReservation(id, reason),
    onSuccess: () => {
      invalidate();
      toast.success(t("reservations.alerts.declined") || "Reservation declined.");
    },
    onError: (err: any) => toast.error(err.message)
  });

  const banMutation = useMutation({
    mutationFn: ({ memberId, reason }: { memberId: string; reason: string }) => banMember(memberId, reason),
    onSuccess: () => {
      invalidate();
      toast.success(t("reservations.alerts.banned") || "Member banned from making further reservations.");
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

  const editMutation = useMutation({
    mutationFn: ({ id, expiresAt }: { id: string; expiresAt: string | null }) => updateReservation(id, { expiresAt }),
    onSuccess: () => {
      invalidate();
      toast.success(t("reservations.alerts.updated") || "Reservation updated.");
    },
    onError: (err: any) => toast.error(err.message || "Failed to update reservation.")
  });

  // Converts a "ready" hold into an actual loan — the member has come to the desk to collect it.
  const fulfilMutation = useMutation({
    mutationFn: (id: string) => fulfilReservation(id),
    onSuccess: () => {
      invalidate();
      toast.success(t("reservations.alerts.pickedUp") || "Reservation checked out to the member.");
      setSelectedReservationDetails(null);
    },
    onError: (err: any) => toast.error(err.message || "Failed to check out reservation.")
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

  const bulkAcceptMutation = useMutation({
    mutationFn: async () => {
      await Promise.all(selectedIds.map(id => acceptReservation(id)));
    },
    onSuccess: () => {
      invalidate();
      toast.success(t("reservations.alerts.bulkAccepted") || "Selected reservations accepted.");
      setSelectedIds([]);
    },
    onError: (err: any) => toast.error(err.message || "Failed to accept reservations.")
  });

  const { showContextMenu } = useContextMenu();

  const handleReservationContextMenu = (e: React.MouseEvent, res: Reservation) => {
    showContextMenu(e, [
      {
        id: "accept-res",
        label: t("reservations.accept", "Accept Reservation"),
        icon: CheckCircle2,
        hidden: res.status !== "pending",
        variant: "success",
        onClick: () => acceptMutation.mutate(res.id),
      },
      {
        id: "decline-res",
        label: t("reservations.decline", "Decline Reservation"),
        icon: XCircle,
        hidden: res.status !== "pending",
        variant: "warning",
        onClick: () => {
          const reason = prompt(t("reservations.declineReasonPrompt", "Reason for declining (optional):") as string) ?? undefined;
          declineMutation.mutate({ id: res.id, reason });
        },
      },
      {
        id: "ban-member",
        label: t("reservations.banMember", "Ban Member From Reservations"),
        icon: Ban,
        variant: "danger",
        onClick: () => {
          const reason = prompt(t("reservations.banReasonPrompt", "Reason for banning this member:") as string);
          if (reason && reason.trim()) banMutation.mutate({ memberId: res.member_id, reason: reason.trim() });
        },
      },
      {
        id: "extend-hold",
        label: t("reservations.extendHold", "Extend Hold (+7 Days)"),
        icon: Clock,
        hidden: res.status !== "ready",
        onClick: () => extendMutation.mutate(res.id),
      },
      {
        id: "cancel-res",
        label: t("reservations.cancelRes", "Cancel Reservation"),
        icon: XCircle,
        hidden: !["queued", "ready"].includes(res.status),
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
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#122222]/40 dark:text-white/40" />
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
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#122222]/40 dark:text-white/40">
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
        </div>

        {/* Table Area */}
        <div className="flex-1 overflow-auto">
          {result.isLoading ? (
            <PageLoader label={t("reservations.loading", "Loading reservations…")} />
          ) : filteredReservations.length ? (
            <table className="w-full table-fixed text-left text-[13px]">
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
                  <th className="px-6 py-3 w-[24%]">{t("catalog.headers.title")}</th>
                  <th className="px-6 py-3 w-[16%]">{t("circulation.selectedMember")}</th>
                  <th className="px-6 py-3 w-[16%]">{t("reservations.addModal.copyBarcode") || "Copy Barcode"}</th>
                  <th className="px-6 py-3 w-[12%]">{t("reservations.requestDate")}</th>
                  <th className="px-6 py-3 w-[12%]">{t("reservations.expiresDate") || "Expires Date"}</th>
                  <th className="px-6 py-3 w-[10%]">{t("status")}</th>
                  <th className="px-6 py-3 w-24">{t("actions")}</th>
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
                      <div className="flex items-center gap-3 min-w-0">
                        {res.cover_path ? (
                          <img src={res.cover_path} alt="" className="w-8 h-11 object-cover rounded shadow-sm shrink-0" />
                        ) : (
                          <DefaultCover type={res.item_type} className="w-8 h-11 shrink-0" iconSize={15} />
                        )}
                        <div className="truncate" title={res.title || ""}>{res.title || "—"}</div>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-[#122222]/70 dark:text-white/70">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {res.member_avatar ? (
                          <img src={res.member_avatar} alt="" className="w-8 h-8 rounded-full object-cover shadow-sm shrink-0 border border-black/10 dark:border-white/10" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-emerald/10 text-emerald dark:bg-emerald-light/10 dark:text-emerald-light font-bold text-[12px] flex items-center justify-center shrink-0">
                            {res.member_name?.charAt(0).toUpperCase() || "M"}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-semibold text-[#122222] dark:text-white truncate" title={res.member_name || ""}>{res.member_name || "—"}</div>
                          {res.member_number && (
                            <div className="text-[11px] font-mono text-[#122222]/50 dark:text-white/50 truncate">{res.member_number}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-[#122222]/70 dark:text-white/70">
                      {res.copy_barcode ? (
                        <div className="flex items-center gap-1.5 font-mono text-[12px] font-medium text-emerald dark:text-emerald-light min-w-0">
                          <Hash size={13} className="opacity-60 shrink-0" />
                          <span className="truncate" title={res.copy_barcode}>{res.copy_barcode}</span>
                          {res.copy_shelf && (
                            <span className="text-[10px] bg-emerald/10 text-emerald dark:bg-emerald-light/20 dark:text-emerald-light px-2 py-0.5 rounded font-semibold flex items-center gap-1 ml-1 shrink-0">
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
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <Clock size={14} className="opacity-50 shrink-0"/>
                        <span className="truncate">{formatDisplayDate(res.reserved_at)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-[#122222]/70 dark:text-white/70">
                      {res.expires_at ? (
                        <div className="flex items-center gap-2 font-medium text-amber-600 dark:text-amber-400 whitespace-nowrap">
                          <Calendar size={14} className="opacity-70 shrink-0"/>
                          <span className="truncate">{formatDisplayDate(res.expires_at)}</span>
                        </div>
                      ) : (
                        <span className="opacity-40">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-[4px] text-[11px] font-bold ${
                        res.status === 'ready'
                          ? 'bg-emerald/10 text-emerald dark:bg-emerald-light/20 dark:text-emerald-light'
                          : res.status === 'queued'
                          ? 'bg-copper/10 text-copper'
                          : res.status === 'pending'
                          ? 'bg-amber-500/10 text-amber-600'
                          : res.status === 'declined'
                          ? 'bg-red-500/10 text-red-500'
                          : 'bg-gray-500/10 text-gray-500'
                      }`}>
                        {res.status === 'ready' ? t("reservations.status.ready") || "Ready"
                          : res.status === 'queued' ? t("reservations.status.queued") || "Queued"
                          : res.status === 'pending' ? t("reservations.status.pending") || "Pending"
                          : res.status === 'declined' ? t("reservations.status.declined") || "Declined"
                          : res.status}
                      </span>
                    </td>
                    <td className="px-6 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        {res.status === 'pending' && (
                          <>
                            <button
                              title="Accept Reservation"
                              onClick={() => acceptMutation.mutate(res.id)}
                              className="p-1.5 rounded-lg text-emerald hover:bg-emerald/10 cursor-pointer transition-colors"
                            >
                              <CheckCircle2 size={15} />
                            </button>
                            <button
                              title="Decline Reservation"
                              onClick={() => declineMutation.mutate({ id: res.id })}
                              className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 cursor-pointer transition-colors"
                            >
                              <XCircle size={15} />
                            </button>
                          </>
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
            <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
              <img src={noReservationsSrc} alt="" aria-hidden="true" className="h-72 w-auto object-contain mb-3 opacity-90" />
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
                if (confirm(`Accept ${selectedIds.length} selected pending reservation(s)?`)) {
                  bulkAcceptMutation.mutate();
                }
              }}
              className="flex items-center gap-1.5 text-[12px] font-bold bg-emerald hover:bg-emerald/90 text-white px-3 py-1.5 rounded-xl shadow-sm transition-colors cursor-pointer"
            >
              <CheckCircle2 size={13} />
              {t("reservations.bulk.accept") || "Accept"}
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
        onAccept={(id) => acceptMutation.mutate(id)}
        onDecline={(id) => declineMutation.mutate({ id })}
        onBan={(memberId, reason) => banMutation.mutate({ memberId, reason })}
        onExtend={(id) => extendMutation.mutate(id)}
        onFulfil={(id) => fulfilMutation.mutate(id)}
        onSaveExpiry={(id, expiresAt) => editMutation.mutate({ id, expiresAt })}
        isSaving={editMutation.isPending}
      />

      {/* New Reservation Modal */}
      <NewCirculationModal
        kind="reservation"
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />
    </div>
  );
}

function ReservationDetailsModal({
  reservation,
  onClose,
  onCancel,
  onDelete,
  onAccept,
  onDecline,
  onBan,
  onExtend,
  onFulfil,
  onSaveExpiry,
  isSaving
}: {
  reservation: Reservation | null;
  onClose: () => void;
  onCancel: (id: string) => void;
  onDelete: (id: string) => void;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  onBan: (memberId: string, reason: string) => void;
  onExtend: (id: string) => void;
  onFulfil: (id: string) => void;
  onSaveExpiry: (id: string, expiresAt: string | null) => void;
  isSaving: boolean;
}) {
  const { t } = useTranslation();
  const { showContextMenu } = useContextMenu();
  const [isEditingExpiry, setIsEditingExpiry] = useState(false);
  const [expiryDraft, setExpiryDraft] = useState("");

  // Reset local edit state whenever a different reservation is opened / the modal closes
  useEffect(() => {
    setIsEditingExpiry(false);
    setExpiryDraft(reservation?.expires_at ? reservation.expires_at.slice(0, 10) : "");
  }, [reservation?.id]);

  if (!reservation) return null;

  const statusStyles: Record<string, string> = {
    ready: "bg-emerald/10 text-emerald dark:bg-emerald-light/20 dark:text-emerald-light",
    queued: "bg-copper/10 text-copper",
    pending: "bg-amber-500/10 text-amber-600",
    declined: "bg-red-500/10 text-red-500",
  };
  const statusLabels: Record<string, string> = {
    ready: t("reservations.status.ready") || "Ready for Pickup",
    queued: t("reservations.status.queued") || "Queued in Line",
    pending: t("reservations.status.pending") || "Pending Approval",
    declined: t("reservations.status.declined") || "Declined",
  };

  const startEditingExpiry = () => {
    setExpiryDraft(reservation.expires_at ? reservation.expires_at.slice(0, 10) : "");
    setIsEditingExpiry(true);
  };

  const saveExpiry = () => {
    const iso = expiryDraft ? new Date(`${expiryDraft}T23:59:59`).toISOString() : null;
    onSaveExpiry(reservation.id, iso);
    setIsEditingExpiry(false);
  };

  return (
    <Modal
      isOpen={!!reservation}
      onClose={onClose}
      title={t("reservations.detailsModal.title") || "Reservation Details"}
      size="xl"
      className="max-h-[88vh]"
    >
      <div className="flex flex-col h-full">
        <div className="flex-1 min-h-0 overflow-y-auto space-y-5 pr-1">
          {/* Header Status & Queue Banner */}
          <div className="bg-[#fcfbf8] dark:bg-[#111d1a] border border-black/10 dark:border-white/10 p-4 rounded-2xl flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-3 py-1.5 rounded-full text-[12px] font-bold ${statusStyles[reservation.status] || "bg-gray-500/10 text-gray-500"}`}>
                {statusLabels[reservation.status] || reservation.status}
              </span>
              <span className="text-[11px] font-bold text-[#122222]/70 dark:text-white/70 bg-black/5 dark:bg-white/5 px-2.5 py-1 rounded-lg uppercase flex items-center gap-1">
                {reservation.scope === "external" ? <Globe size={11} /> : <Building2 size={11} />}
                {reservation.scope === "external" ? t("reservations.scope.external", "External") : t("reservations.scope.internal", "Internal")}
              </span>
              {reservation.status === "queued" && (
                <span className="text-[12px] font-bold text-[#122222]/70 dark:text-white/70 bg-black/5 dark:bg-white/5 px-2.5 py-1 rounded-lg">
                  {t("reservations.queuePosition", { position: reservation.position || 1 }) || `Queue Position #${reservation.position || 1}`}
                </span>
              )}
            </div>

            <div className="text-[11px] font-mono text-[#122222]/50 dark:text-white/50 shrink-0">
              ID: {reservation.id.slice(0, 8)}
            </div>
          </div>

          {/* 2-Column Details Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-stretch">
            {/* Left Column: Book / Title Information */}
            <div className="border border-black/10 dark:border-white/10 rounded-2xl p-4 space-y-4 bg-white dark:bg-[#1d2926] flex flex-col">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#122222]/60 dark:text-white/60 flex items-center gap-2 shrink-0">
                <BookOpen size={15} className="text-emerald" />
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
                  <DefaultCover type={reservation.item_type} className="w-20 h-28 rounded-xl shrink-0 shadow-sm" iconSize={30} />
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
                    <p className="text-[12px] font-semibold text-emerald dark:text-emerald-light truncate">
                      {reservation.author}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {reservation.item_type && <ItemTypeBadge type={reservation.item_type} />}
                  </div>
                </div>
              </div>

              {reservation.copy_barcode && (
                <div className="mt-auto pt-3 border-t border-black/5 dark:border-white/5 text-[11px] text-[#122222]/60 dark:text-white/60 flex items-center gap-2">
                  <MapPin size={13} className="text-emerald shrink-0" />
                  <span className="truncate">
                    {reservation.copy_shelf ? `Shelf: ${reservation.copy_shelf}` : "Unassigned shelf"} · {reservation.copy_barcode}
                  </span>
                </div>
              )}
            </div>

            {/* Right Column: Member & Hold Information */}
            <div className="border border-black/10 dark:border-white/10 rounded-2xl p-4 space-y-4 bg-white dark:bg-[#1d2926] flex flex-col">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#122222]/60 dark:text-white/60 flex items-center gap-2 shrink-0">
                <UserCheck size={15} className="text-emerald" />
                {t("reservations.addModal.summaryMember") || "Borrower / Member"}
              </h4>

              <div className="flex items-center gap-3">
                {reservation.member_avatar ? (
                  <img src={reservation.member_avatar} alt="" className="w-10 h-10 rounded-full object-cover shadow-sm border border-black/10 dark:border-white/10 shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-emerald/10 text-emerald dark:bg-emerald-light/10 dark:text-emerald-light font-bold text-[14px] flex items-center justify-center shrink-0">
                    {reservation.member_name?.charAt(0).toUpperCase() || "M"}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="font-bold text-[14px] text-[#122222] dark:text-white truncate">{reservation.member_name}</div>
                  {reservation.member_number && (
                    <div className="text-[12px] font-mono text-[#122222]/50 dark:text-white/50">{reservation.member_number}</div>
                  )}
                </div>
              </div>

              {/* Hold Dates Card */}
              <div className="border border-black/10 dark:border-white/10 rounded-xl p-3 space-y-2 bg-[#fcfbf8] dark:bg-[#111d1a] text-[12px] mt-auto">
                <div className="flex items-center justify-between">
                  <span className="text-[#122222]/60 dark:text-white/60 flex items-center gap-1.5">
                    <Clock size={14} /> {t("reservations.detailsModal.requestDate", "Request Date:")}
                  </span>
                  <span className="font-semibold text-[#122222] dark:text-white">
                    {formatDisplayDate(reservation.reserved_at)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#122222]/60 dark:text-white/60 flex items-center gap-1.5 shrink-0">
                    <Calendar size={14} /> {t("reservations.detailsModal.expiresOn", "Hold Expires On:")}
                  </span>
                  {isEditingExpiry ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="date"
                        value={expiryDraft}
                        onChange={(e) => setExpiryDraft(e.target.value)}
                        className="text-[11px] font-semibold bg-white dark:bg-[#1d2926] border border-black/15 dark:border-white/15 rounded-control px-1.5 py-0.5 outline-none focus:border-emerald"
                      />
                      <button
                        type="button"
                        onClick={saveExpiry}
                        disabled={isSaving}
                        aria-label={t("common.save", "Save") as string}
                        className="p-1 rounded-control bg-emerald text-white hover:bg-emerald/90 cursor-pointer disabled:opacity-50"
                      >
                        <Check size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingExpiry(false)}
                        aria-label={t("common.cancel", "Cancel") as string}
                        className="p-1 rounded-control bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 cursor-pointer"
                      >
                        <XIcon size={12} />
                      </button>
                    </div>
                  ) : (
                    <span className="font-semibold text-amber-600 dark:text-amber-400">
                      {reservation.expires_at ? formatDisplayDate(reservation.expires_at) : "—"}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions (fixed, same position across all reservation states) */}
        <div className="pt-4 mt-4 border-t border-black/10 dark:border-white/10 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            {reservation.status === 'pending' && (
              <>
                <Button
                  type="button"
                  className="text-[12px] flex items-center gap-1.5 cursor-pointer"
                  onClick={() => { onAccept(reservation.id); onClose(); }}
                >
                  <CheckCircle2 size={14} />
                  {t("reservations.accept", "Accept")}
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  className="text-[12px] flex items-center gap-1.5 cursor-pointer"
                  onClick={() => { onDecline(reservation.id); onClose(); }}
                >
                  <XCircle size={14} />
                  {t("reservations.decline", "Decline")}
                </Button>
              </>
            )}

            {reservation.status === 'ready' && (
              <Button
                type="button"
                className="text-[12px] flex items-center gap-1.5 cursor-pointer"
                onClick={() => onFulfil(reservation.id)}
              >
                <UserCheck size={14} />
                {t("reservations.markPickedUp", "Mark as Picked Up")}
              </Button>
            )}

            {(reservation.status === 'ready' || reservation.status === 'queued') && (
              <Button
                type="button"
                variant="secondary"
                className="text-amber-700 dark:text-amber-400 text-[12px] flex items-center gap-1.5 cursor-pointer"
                onClick={() => onExtend(reservation.id)}
              >
                <Calendar size={14} />
                {t("reservations.extendHold", "Extend Hold (+7 Days)")}
              </Button>
            )}

            {(reservation.status === 'queued' || reservation.status === 'ready') && (
              <Button
                type="button"
                variant="secondary"
                className="text-orange-700 dark:text-orange-400 text-[12px] cursor-pointer"
                onClick={() => { onCancel(reservation.id); onClose(); }}
              >
                {t("reservations.cancelReservation", "Cancel Reservation")}
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              aria-label={t("reservations.moreActions", "More actions") as string}
              onClick={(e) => showContextMenu(e, [
                {
                  id: "ban-member",
                  label: t("reservations.banMember", "Ban Member"),
                  icon: Ban,
                  variant: "danger",
                  onClick: () => {
                    const reason = prompt(t("reservations.banReasonPrompt", "Reason for banning this member:") as string);
                    if (reason && reason.trim()) { onBan(reservation.member_id, reason.trim()); onClose(); }
                  },
                },
                {
                  id: "delete-permanently",
                  label: t("reservations.deletePermanently", "Delete Permanently"),
                  icon: Trash2,
                  variant: "danger",
                  onClick: () => { onDelete(reservation.id); onClose(); },
                },
              ], { title: t("reservations.detailsModal.title") || "Reservation Details" })}
              className="w-9 h-9 flex items-center justify-center rounded-control text-[#122222]/50 dark:text-white/50 hover:bg-black/5 dark:hover:bg-white/10 hover:text-red-600 transition-colors cursor-pointer"
            >
              <MoreVertical size={16} />
            </button>
            {!isEditingExpiry && (
              <Button
                type="button"
                variant="secondary"
                className="flex items-center gap-1.5 cursor-pointer"
                onClick={startEditingExpiry}
              >
                <Pencil size={14} />
                {t("common.edit", "Edit")}
              </Button>
            )}
            <Button type="button" variant="secondary" onClick={onClose}>
              {t("common.close", "Close")}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
