import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Bell, BellRing, BellOff, CalendarClock, CheckCheck, Clock, Search, Info } from "lucide-react";
import { toast } from "sonner";

import { dashboard, reservations, notifications, markNotificationRead, markAllNotificationsRead } from "../data/repositories/library";
import { useLibrarySettingsStore } from "../store/librarySettingsStore";
import { formatDisplayDate } from "../utils/dates";

type NotificationKind = "overdue" | "ready" | "system";

interface NotificationRow {
  id: string;
  kind: NotificationKind;
  title: string;
  subtitle: string;
  date: string;
  isRead: boolean;
  markable: boolean;
  onOpen: () => void;
}

function KindBadge({ kind, t }: { kind: NotificationKind; t: (k: string, d: string) => string }) {
  const styles: Record<NotificationKind, string> = {
    overdue: "bg-red-500/10 text-red-500 border border-red-500/20",
    ready: "bg-emerald/10 text-emerald dark:bg-emerald-light/20 dark:text-emerald-light border border-emerald/20",
    system: "bg-black/5 dark:bg-white/5 text-[#122222]/70 dark:text-white/70 border border-black/10 dark:border-white/10",
  };
  const labels: Record<NotificationKind, string> = {
    overdue: t("notificationsPage.kindOverdue", "Overdue"),
    ready: t("notificationsPage.kindReady", "Ready for Pickup"),
    system: t("notificationsPage.kindSystem", "System"),
  };
  return <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap ${styles[kind]}`}>{labels[kind]}</span>;
}

export function NotificationsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const librarySettings = useLibrarySettingsStore((s) => s.settings);

  const [term, setTerm] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | NotificationKind>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "unread">("all");

  const { data: dashData, isLoading: dashLoading } = useQuery({ queryKey: ["dashboard-shell"], queryFn: dashboard });
  const overdueList = librarySettings.notify_overdue ? (dashData?.overdueLoans ?? []) : [];

  const { data: resData, isLoading: resLoading } = useQuery({
    queryKey: ["reservations-shell"],
    queryFn: reservations,
    enabled: librarySettings.notify_ready,
  });
  const readyReservations = librarySettings.notify_ready
    ? (resData?.filter((r) => r.status === "ready") ?? [])
    : [];

  const { data: history, isLoading: historyLoading } = useQuery({ queryKey: ["notifications"], queryFn: () => notifications(200) });

  const handleMarkRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      qc.invalidateQueries({ queryKey: ["notifications"] });
    } catch (err: any) {
      toast.error(err?.message || String(err));
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      qc.invalidateQueries({ queryKey: ["notifications"] });
    } catch (err: any) {
      toast.error(err?.message || String(err));
    }
  };

  // Notifications are marked read individually when clicked (see the history rows below), so
  // opening the page no longer silently clears every unread item — the badge only drops as the
  // user actually reads each one, or via the explicit "Mark all as read" button.

  const rows: NotificationRow[] = useMemo(() => {
    const overdueRows: NotificationRow[] = overdueList.map((loan) => ({
      id: `overdue-${loan.id}`,
      kind: "overdue",
      title: loan.title ?? "",
      subtitle: `${t("circulation.selectedMember")}: ${loan.member_name}`,
      date: loan.due_at,
      isRead: false,
      markable: false,
      onOpen: () => navigate("/members"),
    }));
    const readyRows: NotificationRow[] = readyReservations.map((res) => ({
      id: `ready-${res.id}`,
      kind: "ready",
      title: res.title ?? "",
      subtitle: `${t("circulation.selectedMember")}: ${res.member_name}`,
      date: res.reserved_at || res.requested_at,
      isRead: false,
      markable: false,
      onOpen: () => navigate("/reservations"),
    }));
    const historyRows: NotificationRow[] = (history ?? []).map((n) => ({
      id: n.id,
      kind: n.type === "reservation_ready" ? "ready" : "system",
      title: n.title,
      subtitle: n.body ?? "",
      date: n.created_at,
      isRead: n.is_read,
      markable: true,
      onOpen: () => {
        if (!n.is_read) handleMarkRead(n.id);
        if (n.link) navigate(n.link);
      },
    }));
    return [...overdueRows, ...readyRows, ...historyRows].sort((a, b) => new Date(b.date).valueOf() - new Date(a.date).valueOf());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overdueList, readyReservations, history, t]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (kindFilter !== "all" && r.kind !== kindFilter) return false;
      if (statusFilter === "unread" && r.isRead) return false;
      if (term.trim()) {
        const q = term.trim().toLowerCase();
        if (!r.title.toLowerCase().includes(q) && !r.subtitle.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [rows, kindFilter, statusFilter, term]);

  const unreadCount = rows.filter((r) => !r.isRead).length;
  const isLoading = dashLoading || resLoading || historyLoading;

  return (
    <div className="flex flex-col h-full w-full text-[13px]">
      {/* Header */}
      <div className="flex justify-between items-end mb-6">
        <div>
          <h1 className="font-display text-[28px] font-bold text-[#122222] dark:text-white leading-tight">
            {t("nav.notifications")}
          </h1>
          <p className="text-[13px] text-[#122222]/60 dark:text-white/60">
            {t("notificationsPage.subtitle", "Overdue loans, ready holds, and notification history")}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-2 bg-white dark:bg-[#1d2926] border border-black/10 dark:border-white/10 text-[#122222] dark:text-white px-4 py-2 rounded-xl font-bold text-[13px] hover:bg-black/5 dark:hover:bg-white/5 transition-colors shadow-card cursor-pointer"
          >
            <CheckCheck size={16} />
            {t("notificationsPage.markAllRead", "Mark all as read")}
          </button>
        )}
      </div>

      {/* Summary Metric Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: t("notificationsPage.total", "Total"), val: rows.length, icon: Bell, color: "emerald" },
          { label: t("notificationsPage.unread", "Unread"), val: unreadCount, icon: BellRing, color: "emerald" },
          { label: t("notificationsPage.kindOverdue", "Overdue"), val: overdueList.length, icon: Clock, color: "red" },
          { label: t("notificationsPage.kindReady", "Ready for Pickup"), val: readyReservations.length, icon: CalendarClock, color: "emerald" },
        ].map((m) => {
          const colorClass = m.color === "red" ? "text-red-500" : "text-emerald dark:text-emerald-light";
          const bgLight = m.color === "red" ? "bg-red-500/10" : "bg-emerald/10 dark:bg-emerald-light/10";
          return (
            <div key={m.label} className="bg-white dark:bg-[#1d2926] border border-black/5 dark:border-white/5 p-3 rounded-2xl shadow-card flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${bgLight}`}>
                <m.icon size={18} className={colorClass} />
              </div>
              <div>
                <div className="text-[11px] font-semibold text-[#122222]/50 dark:text-white/50 uppercase">{m.label}</div>
                <div className="text-[16px] font-bold text-[#122222] dark:text-white">{m.val}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Panel */}
      <div className="flex-1 bg-white dark:bg-[#1d2926] border border-black/5 dark:border-white/5 rounded-2xl flex flex-col shadow-card overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-black/5 dark:border-white/5 flex items-center gap-3 bg-[#fcfbf8] dark:bg-[#111d1a] flex-wrap">
          <div className="flex-1 max-w-sm relative min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#122222]/40 dark:text-white/40" />
            <input
              type="text"
              placeholder={t("notificationsPage.searchPlaceholder", "Search notifications...") as string}
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              className="w-full bg-white dark:bg-[#1d2926] border border-black/10 dark:border-white/10 rounded-xl py-2 pl-9 pr-3 text-[13px] text-[#122222] dark:text-[#f0ebe1] outline-none focus:border-emerald focus:ring-1 focus:ring-emerald"
            />
          </div>

          <select
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value as "all" | NotificationKind)}
            className="bg-white dark:bg-[#1d2926] border border-black/10 dark:border-white/10 rounded-xl py-2 px-3 text-[13px] font-semibold text-[#122222]/70 dark:text-white/70 outline-none cursor-pointer hover:border-emerald/30 transition-colors"
          >
            <option value="all">{t("notificationsPage.allTypes", "All Types")}</option>
            <option value="overdue">{t("notificationsPage.kindOverdue", "Overdue")}</option>
            <option value="ready">{t("notificationsPage.kindReady", "Ready for Pickup")}</option>
            <option value="system">{t("notificationsPage.kindSystem", "System")}</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "all" | "unread")}
            className="bg-white dark:bg-[#1d2926] border border-black/10 dark:border-white/10 rounded-xl py-2 px-3 text-[13px] font-semibold text-[#122222]/70 dark:text-white/70 outline-none cursor-pointer hover:border-emerald/30 transition-colors"
          >
            <option value="all">{t("notificationsPage.allStatus", "All Status")}</option>
            <option value="unread">{t("notificationsPage.unread", "Unread")}</option>
          </select>
        </div>

        {/* Table Area */}
        <div className="flex-1 overflow-auto font-sans">
          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-zinc-500 text-[13px]">
              {t("notificationsPage.loading", "Loading notifications...")}
            </div>
          ) : filteredRows.length ? (
            <table className="w-full text-left text-[13px]">
              <thead className="bg-[#fcfbf8] dark:bg-[#111d1a] sticky top-0 border-b border-black/5 dark:border-white/5 text-[11px] font-bold text-[#122222]/50 dark:text-white/50 uppercase tracking-wider select-none">
                <tr>
                  <th className="px-6 py-3 w-10"></th>
                  <th className="px-6 py-3">{t("notificationsPage.type", "Type")}</th>
                  <th className="px-6 py-3">{t("notificationsPage.details", "Details")}</th>
                  <th className="px-6 py-3">{t("notificationsPage.date", "Date")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/5">
                {filteredRows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={row.onOpen}
                    className={`hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer ${!row.isRead ? "bg-[#b96f3e]/[0.03]" : ""}`}
                  >
                    <td className="px-6 py-3">
                      <span className={`block w-2 h-2 rounded-full ${!row.isRead ? "bg-[#b96f3e]" : "bg-transparent"}`} />
                    </td>
                    <td className="px-6 py-3">
                      <KindBadge kind={row.kind} t={t} />
                    </td>
                    <td className="px-6 py-3 max-w-md">
                      <div className="font-bold text-[#122222] dark:text-white truncate" title={row.title}>{row.title}</div>
                      {row.subtitle && <div className="text-[11px] text-[#122222]/60 dark:text-white/60 mt-0.5 truncate" title={row.subtitle}>{row.subtitle}</div>}
                    </td>
                    <td className="px-6 py-3 text-[#122222]/70 dark:text-white/70 whitespace-nowrap">{formatDisplayDate(row.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center text-[#122222]/50 dark:text-white/50">
              <div className="mb-4 grid h-20 w-20 place-items-center rounded-full bg-emerald/10 text-emerald dark:bg-emerald-light/10 dark:text-emerald-light">
                {rows.length === 0 ? <BellOff size={38} /> : <Info size={38} />}
              </div>
              <p className="font-bold text-[16px] text-[#122222] dark:text-white">{rows.length === 0 ? t("notificationsPage.emptyTitle", "You're all caught up") : t("notificationsPage.noMatches", "No notifications match your filters")}</p>
              <p className="mt-1 max-w-sm text-[13px]">{rows.length === 0 ? t("notificationsPage.emptyDesc", "No overdue loans, ready holds, or system alerts right now. New notifications will appear here.") : t("notificationsPage.noMatchesDesc", "Try clearing the search or changing the filters above.")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
