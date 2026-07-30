import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import {
  ArrowRight, BookOpen, Clock3, AlertTriangle, Bookmark,
  ScanLine, BookCopy, UsersRound, Warehouse, CalendarClock, RotateCcw,
  RefreshCw, Plus, UserPlus
} from "lucide-react";
import { dashboard, reservations } from "../data/repositories/library";
import { daysLate, formatDisplayDate } from "../utils/dates";
import { useTranslation } from "react-i18next";
import { useUiStore } from "../store/uiStore";
import { useAuthStore } from "../store/authStore";
import { useContextMenu } from "../components/ui/ContextMenu";
import { queryClient } from "../app/providers";
import { toast } from "sonner";
import { useThemedAsset } from "../utils/useThemedAsset";
import { cn } from "../utils/cn";


export function DashboardPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const prefs = useUiStore((state) => state.preferences);
  const user = useAuthStore((state) => state.user);

  // Queries
  const { data } = useQuery({ queryKey: ["dashboard"], queryFn: dashboard });
  const reservationsQuery = useQuery({ queryKey: ["reservations-dashboard"], queryFn: reservations });

  const metrics = data ?? { titles: 0, copies: 0, onLoan: 0, members: 0, overdue: 0, readyReservations: 0, recentLoans: [], overdueLoans: [], activity: [] };
  const readyResList = useMemo(() => {
    return reservationsQuery.data?.filter(r => r.status === "ready").slice(0, 5) ?? [];
  }, [reservationsQuery.data]);

  // Today's hourly rhythm — an all-quiet day is real data, not a reason to show made-up
  // activity numbers.
  const circulationRhythm = useMemo(() => metrics.circulationRhythm ?? [], [metrics.circulationRhythm]);

  const activeDepartmentsList = useMemo(() => {
    if (!metrics.activeDepartments || metrics.activeDepartments.length === 0) return [];
    const maxVal = Math.max(...metrics.activeDepartments.map(d => d.count), 1);
    return metrics.activeDepartments.map(d => ({
      name: d.name,
      val: d.count,
      percent: (d.count / maxVal) * 100
    }));
  }, [metrics.activeDepartments]);

  // 7-day activity mapper
  const activityData = useMemo(() => {
    return (metrics.activity ?? []).map(act => {
      // Localize the date string
      const dateVal = new Date(act.date);
      const dayLabel = dateVal.toLocaleDateString(prefs.locale === "ar" ? "ar-DZ" : prefs.locale === "fr" ? "fr-FR" : "en-US", { month: 'short', day: 'numeric' });
      return {
        day: dayLabel,
        checkouts: act.count,
      };
    });
  }, [metrics.activity, prefs.locale]);

  const heroSrc = useThemedAsset("dashboard-hero-book");
  const recentBooksSrc = useThemedAsset("dashboard-recent-books-quill");
  const clockSrc = useThemedAsset("dashboard-clock");
  const medalSrc = useThemedAsset("activity-medal");
  const quillSrc = useThemedAsset("dashboard-quill");
  const isRtl = prefs.locale === "ar";

  const { showContextMenu } = useContextMenu();


  const handleDashboardContextMenu = (e: React.MouseEvent) => {
    showContextMenu(e, [
      {
        id: "refresh-dashboard",
        label: t("dashboard.refresh", "Refresh Dashboard Data"),
        icon: RefreshCw,
        variant: "accent",
        onClick: () => {
          queryClient.invalidateQueries();
          toast.success(t("dashboard.refreshed", "Dashboard data updated"));
        },
      },
      { divider: true },
      {
        id: "goto-catalog",
        label: t("dashboard.gotoCatalog", "Go to Catalog"),
        icon: BookOpen,
        onClick: () => navigate("/catalog"),
      },
      {
        id: "goto-members",
        label: t("dashboard.gotoMembers", "Go to Members"),
        icon: UsersRound,
        onClick: () => navigate("/members"),
      },
      {
        id: "goto-reservations",
        label: t("dashboard.gotoReservations", "Go to Reservations"),
        icon: CalendarClock,
        onClick: () => navigate("/reservations"),
      },
      {
        id: "goto-inventory",
        label: t("dashboard.gotoInventory", "Go to Inventory"),
        icon: Warehouse,
        onClick: () => navigate("/inventory"),
      },
      { divider: true },
      {
        id: "add-member",
        label: t("members.addMember", "Add New Member"),
        icon: Plus,
        onClick: () => navigate("/members?action=add-member"),
      },
      {
        id: "add-book",
        label: t("catalog.addBook", "Add New Book"),
        icon: Plus,
        onClick: () => navigate("/catalog?action=add-book"),
      },
    ], { title: t("dashboard.title", "Dashboard Overview") });
  };

  return (
    <div onContextMenu={handleDashboardContextMenu} className="flex flex-col gap-6 w-full">
      {/* Top Header & Greeting Row */}
      <div className="flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-center bg-white dark:bg-[#1d2926] p-6 rounded-2xl border border-black/5 dark:border-white/5 shadow-card relative overflow-hidden">
        {/* Ambient background decoration */}
        <img
          src={heroSrc}
          alt=""
          aria-hidden="true"
          className={cn(
            "absolute top-1/2 -translate-y-1/2 h-[160%] w-auto opacity-15 dark:opacity-25 pointer-events-none select-none",
            isRtl ? "left-0 scale-x-[-1]" : "right-0"
          )}
        />

        <div className="relative z-10 max-w-xl">
          <h1 className="font-display text-[26px] font-bold text-[#122222] dark:text-white leading-tight">
            {t("dashboard.welcome", { name: user?.full_name || "Librarian" })}
          </h1>
          <p className="text-[14px] text-[#122222]/60 dark:text-white/60 mt-1">{t("dashboard.subtitle")}</p>
        </div>

        {/* Quote Card */}
        <div className="relative z-10  dark:border-emerald/25 px-5 py-3.5 max-w-md shrink-0">
          <h2 className={cn("text-[15px] sm:text-[16px] font-bold text-emerald dark:text-emerald-light leading-snug mb-1", isRtl ? "font-arabic" : "font-display")}>
            “{t("dashboard.quote")}”
          </h2>
          <p className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 uppercase tracking-wider">
            — {t("dashboard.quoteTranslation")}
          </p>
        </div>
      </div>

      {/* Full-width Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 w-full">
        <MetricCard icon={<BookOpen size={24} className="text-emerald" />} value={metrics.titles.toLocaleString(prefs.locale)} label={t("dashboard.metrics.titles")} trend={t("dashboard.metrics.registered")} />
        <MetricCard icon={<BookCopy size={24} className="text-copper" />} value={metrics.copies.toLocaleString(prefs.locale)} label={t("dashboard.metrics.copies")} trend={t("dashboard.metrics.physical")} />
        <MetricCard icon={<RotateCcw size={24} className="text-copper" />} value={metrics.onLoan.toLocaleString(prefs.locale)} label={t("dashboard.metrics.borrowed")} trend={t("dashboard.metrics.activeLoans")} />
        <MetricCard icon={<UsersRound size={24} className="text-emerald" />} value={metrics.members.toLocaleString(prefs.locale)} label={t("dashboard.metrics.members")} trend={t("dashboard.metrics.activeAccounts")} />
        <MetricCard icon={<Clock3 size={24} className="text-copper" />} value={metrics.overdue.toLocaleString(prefs.locale)} label={t("dashboard.metrics.overdue")} trend={t("dashboard.metrics.attention")} isDanger={metrics.overdue > 0} />
      </div>

      {/* Grid Layout for Panels */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Circulation Rhythm panel - 1 Column */}
        <div className="bg-white dark:bg-[#1d2926] p-6 rounded-2xl shadow-card border border-black/5 dark:border-white/5 flex flex-col h-[300px] xl:col-span-1">
          <div className="mb-4">
            <h3 className="font-bold text-[14px] text-[#122222] dark:text-white">{t("dashboard.circulationRhythm")}</h3>
            <p className="text-[11px] text-[#122222]/50 dark:text-white/50 mt-0.5">{t("dashboard.rhythmHelp")}</p>
          </div>

          <div className="flex-1 min-h-0 -mx-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={circulationRhythm} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCheckouts" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1a4d40" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#1a4d40" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorReturns" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#b96f3e" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#b96f3e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#122222', opacity: 0.5 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#122222', opacity: 0.5 }} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '11px' }} />
                <Area type="monotone" dataKey="checkouts" stroke="var(--color-accent)" strokeWidth={2} fillOpacity={1} fill="url(#colorCheckouts)" />
                <Area type="monotone" dataKey="returns" stroke="#b96f3e" strokeWidth={2} fillOpacity={1} fill="url(#colorReturns)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="flex justify-center gap-6 mt-4 text-[11px] font-semibold text-[#122222]/60 dark:text-white/60">
            <div className="flex items-center gap-2"><div className="w-3 h-1 bg-emerald rounded-full" />{t("dashboard.checkouts")}</div>
            <div className="flex items-center gap-2"><div className="w-3 h-1 bg-copper rounded-full" />{t("dashboard.returns")}</div>
          </div>
        </div>

        {/* Recent borrowings */}
        <Panel
          title={t("dashboard.recentBorrowings")}
          subtitle={t("dashboard.latestTransactions")}
          actionText={t("dashboard.viewAll")}
          onActionClick={() => navigate("/members")}
          className="xl:col-span-1"
        >
          <div className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-auto space-y-4 pr-2 no-scrollbar">
              {metrics.recentLoans.length ? (
                metrics.recentLoans.map((loan) => (
                  <div key={loan.id} className="flex gap-3 items-center group cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 p-2 -mx-2 rounded-lg transition-colors" onClick={() => navigate("/members")}>
                    <div className="w-10 h-14 bg-white dark:bg-[#1d2926] shadow-sm rounded flex items-center justify-center border border-black/5 dark:border-white/5 shrink-0 overflow-hidden">
                      <div className="w-full h-full bg-[#f4ebdd] opacity-50 relative flex items-center justify-center">
                        <BookOpen size={16} className="text-emerald/40" />
                        <div className="absolute left-1 top-0 bottom-0 w-[2px] bg-emerald/20" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[13px] font-bold text-[#122222] dark:text-white truncate">{loan.title}</h4>
                      <p className="text-[11px] text-[#122222]/50 dark:text-white/50 truncate">{t("circulation.barcode")}: {loan.barcode}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[12px] font-semibold text-[#122222] dark:text-white truncate max-w-[100px]">{loan.member_name}</p>
                      <p className="text-[10px] text-[#122222]/50 dark:text-white/50">{formatDisplayDate(loan.borrowed_at)}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-6 opacity-70">
                  <img src={recentBooksSrc} alt="" aria-hidden="true" className="h-32 w-auto object-contain mb-1" />
                  <span className="text-xs">{t("dashboard.noActiveLoans")}</span>
                </div>
              )}
            </div>
            <div className="mt-4 pt-4 border-t border-black/5 dark:border-white/5 flex justify-between items-center cursor-pointer" onClick={() => navigate("/members")}>
              <span className="text-[12px] text-[#122222]/60 dark:text-white/60 font-medium">{t("dashboard.metrics.activeLoans")}: {metrics.onLoan.toLocaleString(prefs.locale)}</span>
              <ArrowRight size={16} className="text-emerald" />
            </div>
          </div>
        </Panel>

        {/* Overdue priority queue */}
        <Panel
          title={t("dashboard.overdueQueue")}
          subtitle={t("dashboard.itemsOverdue", { count: metrics.overdue })}
          actionText={t("dashboard.viewAll")}
          onActionClick={() => navigate("/members")}
          className="xl:col-span-1"
        >
          <div className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-auto space-y-4 pr-2 no-scrollbar">
              {metrics.overdueLoans.length ? (
                metrics.overdueLoans.map((loan) => {
                  const overdueDays = daysLate(loan.due_at);

                  return (
                    <div key={loan.id} className="flex gap-3 items-center group cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 p-2 -mx-2 rounded-lg transition-colors" onClick={() => navigate("/members")}>
                      <div className="w-10 h-14 bg-[#122222] rounded shadow-sm border border-black/10 shrink-0 overflow-hidden relative flex items-center justify-center">
                        <BookOpen size={16} className="text-white/30" />
                        <div className="absolute left-1 top-0 bottom-0 w-[2px] bg-white/10" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-[13px] font-bold text-[#122222] dark:text-white truncate">{loan.title}</h4>
                        <p className="text-[11px] text-[#122222]/50 dark:text-white/50 truncate">{t("circulation.due")}: {formatDisplayDate(loan.due_at)}</p>
                      </div>
                      <div className="text-right flex items-center gap-2">
                        <div>
                          <p className="text-[12px] font-semibold text-[#122222] dark:text-white truncate max-w-[80px]">{loan.member_name}</p>
                          <p className="text-[10px] text-red-500 font-bold">
                            {t("dashboard.daysLate", { count: overdueDays })}
                          </p>
                        </div>
                        <AlertTriangle size={16} className="text-red-500 shrink-0" />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center py-6 opacity-40">
                  <img src={medalSrc} alt="" aria-hidden="true" className="h-32 w-auto object-contain mb-1" />
                  <span className="text-xs">{t("dashboard.noOverdueLoans")}</span>
                </div>
              )}
            </div>
            <div className="mt-4 pt-4 border-t border-black/5 dark:border-white/5 flex justify-between items-center text-emerald dark:text-emerald-light font-semibold text-[13px] cursor-pointer" onClick={() => navigate("/members")}>
              {t("dashboard.manageOverdue")}
              <ArrowRight size={16} />
            </div>
          </div>
        </Panel>

        {/* Reservations ready */}
        <Panel
          title={t("dashboard.reservationsReady")}
          subtitle={t("dashboard.holdsReady", { count: metrics.readyReservations })}
          actionText={t("dashboard.viewAll")}
          onActionClick={() => navigate("/reservations")}
          className="xl:col-span-1"
        >
          <div className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-auto space-y-4 pr-2 no-scrollbar">
              {readyResList.length ? (
                readyResList.map((res) => (
                  <div key={res.id} className="flex gap-3 items-center group cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 p-2 -mx-2 rounded-lg transition-colors" onClick={() => navigate("/reservations")}>
                    <div className="w-10 h-10 bg-[#1a4d40] text-white rounded flex items-center justify-center shadow-sm shrink-0">
                      <Bookmark size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[13px] font-bold text-[#122222] dark:text-white truncate">{res.title}</h4>
                      <p className="text-[11px] text-[#122222]/50 dark:text-white/50 truncate font-semibold">{t("circulation.selectedMember")}: {res.member_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] font-bold text-emerald dark:text-emerald-light">{t("dashboard.ready")}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-6 opacity-70">
                  <img src={clockSrc} alt="" aria-hidden="true" className="h-32 w-auto object-contain mb-1" />
                  <span className="text-xs">{t("dashboard.noHoldsReady")}</span>
                </div>
              )}
            </div>
            <div className="mt-4 pt-4 border-t border-black/5 dark:border-white/5 flex justify-between items-center text-emerald dark:text-emerald-light font-semibold text-[13px] cursor-pointer" onClick={() => navigate("/reservations")}>
              {t("dashboard.goHoldShelf")}
              <ArrowRight size={16} />
            </div>
          </div>
        </Panel>

        {/* Activity Overview */}
        <Panel title={<div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-[#b96f3e] flex items-center justify-center text-white text-[10px]">U</div> {t("dashboard.activityOverview")}</div>} className="xl:col-span-2">
          <div className="flex-1 min-h-[150px] -mx-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activityData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorActivity" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1a4d40" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#1a4d40" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#122222', opacity: 0.5 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#122222', opacity: 0.5 }} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '12px' }} />
                <Area type="monotone" dataKey="checkouts" stroke="var(--color-accent)" strokeWidth={2} fillOpacity={1} fill="url(#colorActivity)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        {/* Most active departments */}
        <Panel title={t("dashboard.activeDepartments")} subtitle={t("dashboard.deptsHelp")} actionText={t("dashboard.viewAll")} className="xl:col-span-1">
          <div className="flex-1 flex flex-col justify-between py-2">
            {activeDepartmentsList.map(dept => (
              <div key={dept.name} className="flex items-center gap-3">
                <div className="w-20 text-[12px] font-semibold text-[#122222] dark:text-white truncate">{dept.name}</div>
                <div className="flex-1 h-1.5 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald" style={{ width: `${dept.percent}%` }} />
                </div>
                <div className="w-8 text-right text-[12px] font-bold text-[#122222]/70 dark:text-white/70">{dept.val}</div>
              </div>
            ))}
          </div>
        </Panel>

        {/* Quick actions & At a glance */}
        <div className="xl:col-span-1 flex flex-col gap-6 h-[300px]">
          {/* Quick Actions */}
          <div className="relative flex-1 bg-white dark:bg-[#1d2926] rounded-2xl p-5 shadow-card border border-black/5 dark:border-white/5 flex flex-col overflow-hidden">
            <img
              src={quillSrc}
              alt=""
              aria-hidden="true"
              className={`absolute -bottom-6 h-[140%] w-auto object-contain opacity-[0.06] pointer-events-none select-none ${isRtl ? "-left-6" : "-right-6"}`}
            />
            <h3 className="relative font-bold text-[14px] text-[#122222] dark:text-white mb-4">{t("dashboard.quickActions")}</h3>
            <div className="relative grid grid-cols-2 gap-3 flex-1">
              <ActionCard icon={<ScanLine size={20} />} title={t("dashboard.scanIsbn") || "Scan ISBN"} subtitle={t("dashboard.addBook") || "Add new book"} onClick={() => navigate("/catalog?action=add-book")} />
              <ActionCard icon={<UsersRound size={20} />} title={t("dashboard.addMember") || "Add Member"} subtitle={t("dashboard.addMemberSub") || "Create member profile"} onClick={() => navigate("/members?action=add-member")} />
              <ActionCard icon={<CalendarClock size={20} />} title={t("dashboard.newReservation") || "New Reservation"} subtitle={t("dashboard.newReservationSub") || "Reserve item for member"} onClick={() => navigate("/reservations?action=new-reservation")} />
              <ActionCard icon={<UserPlus size={20} />} title={t("dashboard.addUser") || "Add Staff User"} subtitle={t("dashboard.addUserSub") || "Create user credentials"} onClick={() => navigate("/settings?tab=users&action=add-user")} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon, value, label, trend, isDanger = false }: any) {
  return (
    <div className="bg-white dark:bg-[#1d2926] p-4 rounded-2xl flex items-center gap-4 w-full shadow-card border border-black/5 dark:border-white/5">
      <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: isDanger ? '#ffeceb' : '#f5f1e8' }}>
        {icon}
      </div>
      <div>
        <div className="text-[24px] font-bold text-[#122222] dark:text-white leading-none mb-1">{value}</div>
        <div className="text-[12px] font-semibold text-[#122222]/60 dark:text-white/60 mb-1">{label}</div>
        <div className={`text-[10px] font-bold ${isDanger ? 'text-red-500' : 'text-emerald'}`}>{trend}</div>
      </div>
    </div>
  );
}

function Panel({ title, subtitle, actionText, onActionClick, children, className = "" }: any) {
  return (
    <div className={`bg-white dark:bg-[#1d2926] p-6 rounded-2xl shadow-card border border-black/5 dark:border-white/5 flex flex-col h-[300px] ${className}`}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="font-bold text-[14px] text-[#122222] dark:text-white">{title}</h3>
          {subtitle && <p className="text-[11px] text-[#122222]/50 dark:text-white/50 mt-0.5">{subtitle}</p>}
        </div>
        {actionText && (
          <button onClick={onActionClick} className="text-[11px] font-bold text-emerald dark:text-emerald-light hover:underline">
            {actionText}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function ActionCard({ icon, title, subtitle, onClick }: any) {
  return (
    <button onClick={onClick} className="flex flex-col items-center justify-center bg-[#F9F8F4] dark:bg-[#111d1a] hover:bg-emerald/5 rounded-xl p-3 border border-[#122222]/10 dark:border-white/10 transition-colors text-center h-full gap-2 cursor-pointer">
      <div className="text-emerald dark:text-emerald-light">{icon}</div>
      <div>
        <div className="text-[12px] font-bold text-[#122222] dark:text-white">{title}</div>
        <div className="text-[10px] text-[#122222]/50 dark:text-white/50">{subtitle}</div>
      </div>
    </button>
  );
}
