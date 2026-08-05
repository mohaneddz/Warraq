import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Bell, BellRing, CalendarClock, CheckCheck, Clock } from "lucide-react";

import { dashboard, reservations, notifications, markNotificationRead, markAllNotificationsRead } from "../data/repositories/library";
import { useLibrarySettingsStore } from "../store/librarySettingsStore";
import { formatDisplayDate } from "../utils/dates";

export function NotificationsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const librarySettings = useLibrarySettingsStore((s) => s.settings);

  const { data: dashData } = useQuery({ queryKey: ["dashboard-shell"], queryFn: dashboard });
  const overdueList = librarySettings.notify_overdue ? (dashData?.overdueLoans ?? []) : [];

  const { data: resData } = useQuery({
    queryKey: ["reservations-shell"],
    queryFn: reservations,
    enabled: librarySettings.notify_ready,
  });
  const readyReservations = librarySettings.notify_ready
    ? (resData?.filter((r) => r.status === "ready") ?? [])
    : [];

  const { data: history } = useQuery({ queryKey: ["notifications"], queryFn: () => notifications(200) });

  const handleMarkRead = async (id: string) => {
    await markNotificationRead(id);
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  const hasAttention = overdueList.length > 0 || readyReservations.length > 0;
  const hasUnread = (history ?? []).some((n) => !n.is_read);

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="font-display text-[28px] font-bold text-[#122222] dark:text-white leading-tight">
            {t("nav.notifications")}
          </h1>
          <p className="text-[13px] text-[#122222]/60 dark:text-white/60">
            {t("notificationsPage.subtitle", "Overdue loans, ready holds, and notification history")}
          </p>
        </div>
        {hasUnread && (
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-2 bg-white dark:bg-[#1d2926] border border-black/10 dark:border-white/10 text-[#122222] dark:text-white px-4 py-2 rounded-xl font-bold text-[13px] hover:bg-black/5 dark:hover:bg-white/5 transition-colors shadow-card cursor-pointer"
          >
            <CheckCheck size={16} />
            {t("notificationsPage.markAllRead", "Mark all as read")}
          </button>
        )}
      </div>

      <div className="max-w-3xl w-full">

      {/* Needs Attention (live) */}
      <section className="mb-8">
        <h2 className="text-[11px] font-bold text-[#122222]/40 dark:text-white/40 uppercase tracking-wider mb-2.5 px-1">
          {t("notificationsPage.needsAttention", "Needs Attention")}
        </h2>
        <div className="bg-white dark:bg-[#1d2926] border border-black/10 dark:border-white/10 rounded-2xl divide-y divide-black/5 dark:divide-white/5 overflow-hidden">
          {!hasAttention ? (
            <div className="flex flex-col items-center justify-center py-10 text-center text-[#122222]/40 dark:text-white/40">
              <Bell size={28} className="mb-2 opacity-40" />
              <span className="text-[13px]">{t("nav.allClear")}</span>
            </div>
          ) : (
            <>
              {overdueList.map((loan) => (
                <div
                  key={loan.id}
                  onClick={() => navigate("/members")}
                  className="p-4 flex items-center gap-3 hover:bg-emerald/5 dark:hover:bg-emerald-light/10 transition-colors cursor-pointer"
                >
                  <span className="w-9 h-9 shrink-0 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center">
                    <Clock size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-[13px] text-[#122222] dark:text-white truncate">{loan.title}</div>
                    <div className="text-[11px] text-[#122222]/60 dark:text-white/60 mt-0.5">{t("circulation.selectedMember")}: {loan.member_name}</div>
                  </div>
                  <div className="text-[10px] text-red-500 font-bold shrink-0">{t("circulation.due")}: {formatDisplayDate(loan.due_at)}</div>
                </div>
              ))}
              {readyReservations.map((res) => (
                <div
                  key={res.id}
                  onClick={() => navigate("/reservations")}
                  className="p-4 flex items-center gap-3 hover:bg-emerald/5 dark:hover:bg-emerald-light/10 transition-colors cursor-pointer"
                >
                  <span className="w-9 h-9 shrink-0 rounded-full bg-emerald/10 text-emerald-600 dark:text-emerald-light flex items-center justify-center">
                    <CalendarClock size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-[13px] text-[#122222] dark:text-white truncate">{res.title}</div>
                    <div className="text-[11px] text-[#122222]/60 dark:text-white/60 mt-0.5">{t("circulation.selectedMember")}: {res.member_name}</div>
                  </div>
                  <div className="text-[10px] text-emerald-600 dark:text-emerald-light font-bold shrink-0">{t("dashboard.ready")}</div>
                </div>
              ))}
            </>
          )}
        </div>
      </section>

      {/* History (persisted) */}
      <section>
        <h2 className="text-[11px] font-bold text-[#122222]/40 dark:text-white/40 uppercase tracking-wider mb-2.5 px-1">
          {t("notificationsPage.history", "History")}
        </h2>
        <div className="bg-white dark:bg-[#1d2926] border border-black/10 dark:border-white/10 rounded-2xl divide-y divide-black/5 dark:divide-white/5 overflow-hidden">
          {!history || history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center text-[#122222]/40 dark:text-white/40">
              <BellRing size={28} className="mb-2 opacity-40" />
              <span className="text-[13px]">{t("notificationsPage.empty", "No notifications yet.")}</span>
            </div>
          ) : (
            history.map((n) => (
              <div
                key={n.id}
                onClick={() => {
                  if (!n.is_read) handleMarkRead(n.id);
                  if (n.link) navigate(n.link);
                }}
                className={`p-4 flex items-center gap-3 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors cursor-pointer ${!n.is_read ? "bg-[#b96f3e]/[0.04]" : ""}`}
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${!n.is_read ? "bg-[#b96f3e]" : "bg-transparent"}`} />
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-[13px] text-[#122222] dark:text-white truncate">{n.title}</div>
                  {n.body && <div className="text-[11px] text-[#122222]/60 dark:text-white/60 mt-0.5 truncate">{n.body}</div>}
                </div>
                <div className="text-[10px] text-[#122222]/40 dark:text-white/40 shrink-0">{formatDisplayDate(n.created_at)}</div>
              </div>
            ))
          )}
        </div>
      </section>
      </div>
    </div>
  );
}
